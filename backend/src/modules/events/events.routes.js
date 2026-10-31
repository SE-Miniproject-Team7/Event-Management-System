const router = require('express').Router();
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const User = require('../../models/User');
const Category = require('../../models/Category');
const Registration = require('../../models/Registration');
const { authenticate, requireRole } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { recordAudit } = require('../audit/audit.service');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const withRemaining = (e) => ({ ...e.toObject(), remainingSeats: e.capacity - e.seatsTaken });
const notFound = () => new AppError(404, 'NOT_FOUND', 'Event not found');
const parseDate = (value) => typeof value === 'string' && value.trim() ? new Date(value) : new Date(NaN);

// Create event (Organizer) -> status Pending Approval (EMS-F-007/008/009)
router.post('/', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  const b = req.body || {};
  const fields = [];
  const start = parseDate(b.startAt), end = parseDate(b.endAt), deadline = parseDate(b.registrationDeadline);
  if (typeof b.title !== 'string' || b.title.trim().length < 3 || b.title.trim().length > 100) fields.push({ field: 'title', message: 'Title must be 3 to 100 characters' });
  if (typeof b.description !== 'string' || !b.description.trim() || b.description.trim().length > 2000) fields.push({ field: 'description', message: 'Description is required (max 2000 characters)' });
  if (typeof b.venue !== 'string' || !b.venue.trim() || b.venue.trim().length > 100) fields.push({ field: 'venue', message: 'Venue is required (max 100 characters)' });
  if (isNaN(start)) fields.push({ field: 'startAt', message: 'Valid start date required' });
  if (isNaN(end) || end <= start) fields.push({ field: 'endAt', message: 'End must be after start' });
  if (isNaN(deadline) || deadline > start) fields.push({ field: 'registrationDeadline', message: 'Deadline must be on or before the start' });
  if (!Number.isInteger(b.capacity) || b.capacity < 1 || b.capacity > 10000) fields.push({ field: 'capacity', message: 'Capacity must be 1 to 10000' });
  if (typeof b.categoryId !== 'string' || !mongoose.isValidObjectId(b.categoryId) ||
      !(await Category.findOne({ _id: b.categoryId, active: true }))) {
    fields.push({ field: 'categoryId', message: 'Choose a valid category' });
  }
  if (fields.length) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid event data', fields);

  const event = await Event.create({
    title: b.title.trim(), description: b.description.trim(), categoryId: b.categoryId,
    organizerId: req.user._id, venue: b.venue.trim(),
    startAt: start, endAt: end, registrationDeadline: deadline, capacity: b.capacity,
    status: 'Pending Approval',
  });
  res.status(201).json({ event });
}));

// Public list: upcoming Published events with search, filter and pagination
router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50);
  const and = [{ status: 'Published' }, { startAt: { $gte: new Date() } }];
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const rx = new RegExp(escapeRegex(req.query.q.trim()), 'i');
    and.push({ $or: [{ title: rx }, { description: rx }] });
  }
  if (typeof req.query.category === 'string' && mongoose.isValidObjectId(req.query.category)) {
    and.push({ categoryId: req.query.category });
  }
  // # CHANGED: Treat YYYY-MM-DD filters as inclusive calendar dates.
  if (typeof req.query.from === 'string') {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from);
    const d = new Date(dateOnly ? `${req.query.from}T00:00:00+05:30` : req.query.from);
    if (!isNaN(d)) {
      and.push({ startAt: { $gte: d } });
    }
  }

  if (typeof req.query.to === 'string') {
    const d = new Date(req.query.to);

    if (!isNaN(d)) {
      // # CHANGED: Include the entire end date for date-only query values.
      if (/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) {
        const end = new Date(`${req.query.to}T00:00:00+05:30`);
        end.setUTCDate(end.getUTCDate() + 1);
        and.push({ startAt: { $lt: end } });
      } else {
        // Preserve exact timestamp behavior for timestamp query values.
        and.push({ startAt: { $lte: d } });
      }
    }
  }
  if (req.query.available === 'true') and.push({ $expr: { $lt: ['$seatsTaken', '$capacity'] } });

  const filter = { $and: and };
  const [items, total] = await Promise.all([
    Event.find(filter).sort({ startAt: 1 }).skip((page - 1) * limit).limit(limit),
    Event.countDocuments(filter),
  ]);
  res.json({ items: items.map(withRemaining), page, total });
}));

// IMPORTANT: /mine and /pending must stay above /:id
router.get('/mine', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  const items = await Event.find({ organizerId: req.user._id }).sort({ createdAt: -1 });
  res.json({ items });
}));

router.get('/pending', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  const items = await Event.find({ status: 'Pending Approval' }).sort({ createdAt: 1 });
  res.json({ items });
}));



router.get('/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();

  const event = await Event.findOne({
    _id: req.params.id,
    status: 'Published',
  });

  if (!event) throw notFound();

  // Return display names only; never serialize private organizer fields.
  const [category, organizer] = await Promise.all([
    Category.findById(event.categoryId),
    User.findById(event.organizerId, 'name'),
  ]);

  res.json({
    event,
    remainingSeats: event.capacity - event.seatsTaken,
    categoryName: category?.name || null,
    organizerName: organizer?.name || null,
  });
}));



// Organizer edits an event they own (EMS-F-011).
// Editing a published event returns it to the approval queue.
router.patch('/:id', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();

  const body = req.body || {};
  const allowed = ['title', 'description', 'categoryId', 'venue', 'startAt', 'endAt', 'registrationDeadline', 'capacity'];
  const supplied = Object.keys(body);
  if (!supplied.length || supplied.some((key) => !allowed.includes(key))) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide only editable event fields', [
      { field: 'body', message: 'At least one editable field is required; status and ownership cannot be changed' },
    ]);
  }

  const updated = await mongoose.connection.transaction(async (session) => {
    const event = await Event.findById(req.params.id, null, { session });
    if (!event) throw notFound();
    if (!event.organizerId.equals(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Not your event');
    if (['Cancelled', 'Rejected'].includes(event.status) || event.startAt <= new Date()) {
      throw new AppError(409, 'EDIT_NOT_ALLOWED', 'This event can no longer be edited');
    }

    const next = {
      title: body.title === undefined ? event.title : body.title,
      description: body.description === undefined ? event.description : body.description,
      categoryId: body.categoryId === undefined ? String(event.categoryId) : body.categoryId,
      venue: body.venue === undefined ? event.venue : body.venue,
      startAt: new Date(body.startAt === undefined ? event.startAt : body.startAt),
      endAt: new Date(body.endAt === undefined ? event.endAt : body.endAt),
      registrationDeadline: new Date(body.registrationDeadline === undefined ? event.registrationDeadline : body.registrationDeadline),
      capacity: body.capacity === undefined ? event.capacity : body.capacity,
    };
    const fields = [];
    if (typeof next.title !== 'string' || next.title.trim().length < 3 || next.title.trim().length > 100) fields.push({ field: 'title', message: 'Title must be 3 to 100 characters' });
    if (typeof next.description !== 'string' || !next.description.trim() || next.description.trim().length > 2000) fields.push({ field: 'description', message: 'Description is required (max 2000 characters)' });
    if (typeof next.venue !== 'string' || !next.venue.trim() || next.venue.trim().length > 100) fields.push({ field: 'venue', message: 'Venue is required (max 100 characters)' });
    if (isNaN(next.startAt)) fields.push({ field: 'startAt', message: 'Valid start date required' });
    if (isNaN(next.endAt) || next.endAt <= next.startAt) fields.push({ field: 'endAt', message: 'End must be after start' });
    if (isNaN(next.registrationDeadline) || next.registrationDeadline > next.startAt) fields.push({ field: 'registrationDeadline', message: 'Deadline must be on or before the start' });
    if (!Number.isInteger(next.capacity) || next.capacity < 1 || next.capacity > 10000 || next.capacity < event.seatsTaken) {
      fields.push({ field: 'capacity', message: 'Capacity must be 1 to 10000 and cannot be below current registrations' });
    }
    if (typeof next.categoryId !== 'string' || !mongoose.isValidObjectId(next.categoryId) ||
        !(await Category.findOne({ _id: next.categoryId, active: true }))) {
      fields.push({ field: 'categoryId', message: 'Choose a valid category' });
    }
    if (fields.length) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid event data', fields);

    event.title = next.title.trim();
    event.description = next.description.trim();
    event.categoryId = next.categoryId;
    event.venue = next.venue.trim();
    event.startAt = next.startAt;
    event.endAt = next.endAt;
    event.registrationDeadline = next.registrationDeadline;
    event.capacity = next.capacity;
    if (event.status === 'Published') event.status = 'Pending Approval';
    await event.save({ session });
    await recordAudit(req, 'EVENT_UPDATED', { targetId: event._id, targetType: 'Event', session });
    return event;
  });
  res.json({ event: updated });
}));

// Admin approves or rejects (EMS-F-010)
router.patch('/:id/approval', authenticate, requireRole('Admin'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const { decision, reason } = req.body || {};
  const event = await mongoose.connection.transaction(async session => {
    const event = await Event.findById(req.params.id, null, { session });
    if (!event) throw notFound();
    if (event.status !== 'Pending Approval') throw new AppError(409, 'NOT_PENDING', 'Event is not pending approval');
    if (decision === 'approve') {
      event.status = 'Published';
    } else if (decision === 'reject') {
      if (typeof reason !== 'string' || reason.trim().length < 10) {
        throw new AppError(422, 'VALIDATION_ERROR', 'Reason must be at least 10 characters', [{ field: 'reason', message: 'Min 10 characters' }]);
      }
      event.status = 'Rejected';
      event.rejectionReason = reason.trim();
    } else {
      throw new AppError(422, 'VALIDATION_ERROR', 'decision must be approve or reject', [{ field: 'decision', message: 'approve or reject' }]);
    }
    await event.save({ session });
    await recordAudit(req, decision === 'approve' ? 'EVENT_APPROVED' : 'EVENT_REJECTED', {
      targetId: event._id, targetType: 'Event', session,
    });
    return event;
  });
  res.json({ event });
}));

// Organizer cancels own Published event. Every active registration is cancelled in the
// same transaction, so seatsTaken stays equal to the number of Confirmed registrations.
router.post('/:id/cancel', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();

  const session = await mongoose.startSession();
  let event;
  let cancelledRegistrations = 0;
  try {
    await session.withTransaction(async () => {
      event = await Event.findById(req.params.id, null, { session });
      if (!event) throw notFound();
      if (!event.organizerId.equals(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Not your event');
      if (event.status !== 'Published' || event.startAt <= new Date()) {
        throw new AppError(409, 'CANCEL_NOT_ALLOWED', 'This event cannot be cancelled');
      }

      const result = await Registration.updateMany(
        { eventId: event._id, status: { $in: ['Confirmed', 'Waitlisted', 'Checked-in'] } },
        { $set: { status: 'Cancelled', waitlistPosition: null } },
        { session }
      );
      cancelledRegistrations = result.modifiedCount || 0;

      event.status = 'Cancelled';
      event.seatsTaken = 0;
      await event.save({ session });
      await recordAudit(req, 'EVENT_CANCELLED', { targetId: event._id, targetType: 'Event', session });
    });
  } finally {
    await session.endSession();
  }

  // TODO (Sprint 2, EMS-F-024): queue a cancellation email for each affected attendee.
  res.json({ event, cancelledRegistrations });
}));

module.exports = router;
