const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const AppError = require('../../utils/AppError');
const { recordCheckIn } = require('../audit/audit.service');

function assertCheckInAllowed(event, actor, now) {
  if (!event) throw new AppError(404, 'NOT_FOUND', 'Event not found');
  if (String(event.organizerId) !== String(actor._id)) {
    throw new AppError(403, 'FORBIDDEN', 'You can check in attendees only for your own events');
  }
  if (event.status !== 'Published') {
    throw new AppError(409, 'EVENT_NOT_PUBLISHED', 'Check-in requires a published event');
  }
  if (now.getTime() < new Date(event.startAt).getTime() - 3600000 || now > new Date(event.endAt)) {
    throw new AppError(422, 'OUTSIDE_WINDOW', 'Check-in opens one hour before the event starts and closes when it ends');
  }
}
async function checkIn(req, eventId, regCode) {
  return mongoose.connection.transaction(async session => {
    const event = await Event.findById(eventId, null, { session });
    assertCheckInAllowed(event, req.user, new Date());
    // An actual event write serializes this operation with event cancellation/editing.
    await Event.updateOne({ _id: eventId }, { $inc: { attendanceVersion: 1 } }, { session });
    const checkedInAt = new Date();
    assertCheckInAllowed(event, req.user, checkedInAt);
    const registration = await Registration.findOneAndUpdate(
      { eventId, regCode, status: 'Confirmed' },
      { $set: { status: 'Checked-in', checkedInAt } },
      { returnDocument: 'after', runValidators: true, session }
    );
    if (!registration) {
      const existing = await Registration.findOne({ eventId, regCode }, null, { session });
      if (!existing) throw new AppError(404, 'NOT_FOUND', 'Registration not found for this event');
      if (existing.status === 'Checked-in') throw new AppError(409, 'ALREADY_CHECKED_IN', 'This registration is already checked in');
      throw new AppError(409, 'NOT_CONFIRMED', 'Only confirmed registrations can be checked in');
    }
    await recordCheckIn(req, registration, session);
    return {
      registration: registration.status, registrationId: String(registration._id),
      regCode: registration.regCode, checkedInAt: registration.checkedInAt,
    };
  });
}
module.exports = { checkIn, assertCheckInAllowed };
