const router = require('express').Router();
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const { authenticate, requireRole } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Event not found');
}

function csvCell(value) {
  let text = value == null ? '' : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replace(/"/g, '""') + '"';
}

function buildReport(event, registrations) {
  const rows = registrations.map((registration) => {
    const attendee = registration.userId && typeof registration.userId === 'object' ? registration.userId : {};
    return {
      registrationId: String(registration._id),
      attendeeName: attendee.name || '',
      attendeeEmail: attendee.email || '',
      regCode: registration.regCode,
      status: registration.status,
      registeredAt: registration.createdAt || null,
      checkedInAt: registration.checkedInAt || null,
    };
  });

  const summary = { confirmed: 0, waitlisted: 0, checkedIn: 0, cancelled: 0, attendanceRate: 0 };
  for (const registration of registrations) {
    if (registration.status === 'Confirmed') summary.confirmed += 1;
    else if (registration.status === 'Waitlisted') summary.waitlisted += 1;
    else if (registration.status === 'Checked-in') summary.checkedIn += 1;
    else if (registration.status === 'Cancelled') summary.cancelled += 1;
  }
  const eligible = summary.confirmed + summary.checkedIn;
  summary.attendanceRate = eligible ? Math.round((summary.checkedIn / eligible) * 10000) / 100 : 0;

  return {
    event: {
      id: String(event._id), title: event.title, startAt: event.startAt,
      endAt: event.endAt, venue: event.venue, capacity: event.capacity,
    },
    summary,
    registrations: rows,
  };
}

async function getOwnedEventReport(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const event = await Event.findById(req.params.id);
  if (!event) throw notFound();
  if (!event.organizerId || !event.organizerId.equals(req.user._id)) {
    throw new AppError(403, 'FORBIDDEN', 'Not your event');
  }
  const registrations = await Registration.find({ eventId: event._id })
    .sort({ createdAt: 1, _id: 1 })
    .populate('userId', 'name email')
    .lean();
  return buildReport(event, registrations);
}

router.get('/:id/report', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  res.json(await getOwnedEventReport(req));
}));

const CSV_HEADERS = [
  'eventId', 'eventTitle', 'eventStartAt', 'eventEndAt', 'eventVenue', 'eventCapacity',
  'summaryConfirmed', 'summaryWaitlisted', 'summaryCheckedIn', 'summaryCancelled', 'summaryAttendanceRate',
  'registrationId', 'attendeeName', 'attendeeEmail', 'regCode', 'status', 'registeredAt', 'checkedInAt',
];

router.get('/:id/report.csv', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  const { event, summary, registrations } = await getOwnedEventReport(req);
  const rows = registrations.length ? registrations : [null];
  const lines = [CSV_HEADERS.map(csvCell).join(',')];
  for (const registration of rows) {
    lines.push([
      event.id, event.title, event.startAt, event.endAt, event.venue, event.capacity,
      summary.confirmed, summary.waitlisted, summary.checkedIn, summary.cancelled, summary.attendanceRate,
      registration && registration.registrationId, registration && registration.attendeeName,
      registration && registration.attendeeEmail, registration && registration.regCode,
      registration && registration.status, registration && registration.registeredAt,
      registration && registration.checkedInAt,
    ].map(csvCell).join(','));
  }
  res.status(200)
    .set('Content-Type', 'text/csv; charset=utf-8')
    .set('Content-Disposition', 'attachment; filename="event-report-' + event.id + '.csv"')
    .send(lines.join('\r\n') + '\r\n');
}));

module.exports = router;
