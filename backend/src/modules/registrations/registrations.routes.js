const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const { authenticate, requireRole } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

const ACTIVE = ['Confirmed', 'Waitlisted', 'Checked-in'];
const CANCELLABLE = ['Confirmed', 'Waitlisted'];

async function inTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

function registrationCode() {
  return 'REG-' + crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

// Register an attendee for an event.
router.post('/events/:id/registrations', authenticate, requireRole('Attendee'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) {
    throw new AppError(404, 'NOT_FOUND', 'Event not found');
  }

  try {
    const result = await inTransaction(async (session) => {
      const event = await Event.findById(id).session(session);
      if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found');

      if (event.status !== 'Published' || new Date() > event.registrationDeadline) {
        throw new AppError(409, 'EVENT_CLOSED', 'Registration is closed for this event');
      }

      const duplicate = await Registration.findOne({
        eventId: id,
        userId: req.user._id,
        status: { $in: ACTIVE },
      }).session(session);

      if (duplicate) {
        throw new AppError(409, 'DUPLICATE_REGISTRATION', 'Already registered');
      }

      const seat = await Event.findOneAndUpdate(
        { _id: id, $expr: { $lt: ['$seatsTaken', '$capacity'] } },
        { $inc: { seatsTaken: 1 } },
        { new: true, session }
      );

      if (seat) {
        const [reg] = await Registration.create([{
          eventId: id,
          userId: req.user._id,
          regCode: registrationCode(),
          status: 'Confirmed',
        }], { session });

        return {
          registrationId: reg._id,
          regCode: reg.regCode,
          status: 'Confirmed',
        };
      }

      const position = await Registration.countDocuments({
        eventId: id,
        status: 'Waitlisted',
      }).session(session) + 1;

      const [reg] = await Registration.create([{
        eventId: id,
        userId: req.user._id,
        regCode: registrationCode(),
        status: 'Waitlisted',
        waitlistPosition: position,
      }], { session });

      return {
        registrationId: reg._id,
        regCode: reg.regCode,
        status: 'Waitlisted',
        waitlistPosition: position,
      };
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, 'DUPLICATE_REGISTRATION', 'Already registered');
    }
    throw err;
  }
}));

// Return the authenticated attendee's registrations.
router.get('/registrations/me', authenticate, requireRole('Attendee'), asyncHandler(async (req, res) => {
  const allowedStatuses = ['Confirmed', 'Waitlisted', 'Cancelled', 'Checked-in'];
  const filter = { userId: req.user._id };

  if (typeof req.query.status === 'string') {
    if (!allowedStatuses.includes(req.query.status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Invalid registration status');
    }
    filter.status = req.query.status;
  }

  const regs = await Registration.find(filter)
    .sort({ createdAt: -1 })
    .populate('eventId', 'title startAt venue');

  res.json({
    items: regs.map((r) => ({
      _id: r._id,
      regCode: r.regCode,
      status: r.status,
      waitlistPosition: r.waitlistPosition,
      checkedInAt: r.checkedInAt,
      event: r.eventId,
    })),
  });
}));

// Cancel a registration and promote the oldest waitlisted attendee if needed.
router.delete('/registrations/:id', authenticate, requireRole('Attendee'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError(404, 'NOT_FOUND', 'Registration not found');
  }

  await inTransaction(async (session) => {
    const reg = await Registration.findById(req.params.id).session(session);

    if (!reg) throw new AppError(404, 'NOT_FOUND', 'Registration not found');
    if (!reg.userId.equals(req.user._id)) {
      throw new AppError(403, 'FORBIDDEN', 'Not your registration');
    }
    if (!CANCELLABLE.includes(reg.status)) {
      throw new AppError(409, 'CANCEL_NOT_ALLOWED', 'This registration cannot be cancelled');
    }

    const wasConfirmed = reg.status === 'Confirmed';
    const oldPosition = reg.waitlistPosition;

    reg.status = 'Cancelled';
    reg.waitlistPosition = null;
    await reg.save({ session });

    if (wasConfirmed) {
      const promoted = await Registration.findOneAndUpdate(
        { eventId: reg.eventId, status: 'Waitlisted' },
        { $set: { status: 'Confirmed', waitlistPosition: null } },
        { sort: { createdAt: 1 }, new: false, session }
      );

        // The promoted attendee left the waitlist, so everyone behind moves up one place.
        if (promoted && Number.isInteger(promoted.waitlistPosition)) {
          await Registration.updateMany(
            {
              eventId: reg.eventId,
              status: 'Waitlisted',
              waitlistPosition: { $gt: promoted.waitlistPosition },
            },
            { $inc: { waitlistPosition: -1 } },
            { session }
          );
        }

      // A promotion replaces the cancelled confirmed attendee, so seatsTaken
      // stays unchanged. If nobody is waiting, release the seat.
      if (!promoted) {
        const eventUpdate = await Event.updateOne(
          { _id: reg.eventId, seatsTaken: { $gt: 0 } },
          { $inc: { seatsTaken: -1 } },
          { session }
        );

        if (eventUpdate.modifiedCount !== 1) {
          throw new Error('Seat count invariant violated during cancellation');
        }
      }
    } else if (Number.isInteger(oldPosition)) {
      // Keep displayed waitlist positions contiguous after cancellation.
      await Registration.updateMany(
        {
          eventId: reg.eventId,
          status: 'Waitlisted',
          waitlistPosition: { $gt: oldPosition },
        },
        { $inc: { waitlistPosition: -1 } },
        { session }
      );
    }
  });

  res.json({ status: 'Cancelled' });
}));

module.exports = router;
