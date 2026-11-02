// Real replica-set integration coverage for TC-REG-06.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const app = require('../src/app');

describe('60 concurrent registrations against real MongoDB', {
  skip: !process.env.MONGO_TEST_URI,
  timeout: 180000,
}, () => {
  const dbName = `ems_test_registrations_${randomUUID().replaceAll('-', '')}`;
  const previousSecret = process.env.JWT_SECRET;
  let attendees = [];
  let event;

  before(async () => {
    const uri = process.env.MONGO_TEST_URI;
    if (!new URL(uri).pathname.startsWith('/ems_test_')) {
      throw new Error('MONGO_TEST_URI must point to a dedicated ems_test_* database');
    }
    process.env.JWT_SECRET = randomUUID();
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 15000,
      maxPoolSize: 100,
    });
    await Promise.all([User.init(), Event.init(), Registration.init()]);

    const organizer = await User.create({
      name: 'Concurrency Test Organizer',
      email: `${randomUUID()}@test.local`,
      passwordHash: 'not-used-for-login',
      role: 'Organizer',
    });
    attendees = await User.create(Array.from({ length: 60 }, (_, index) => ({
      name: `Concurrency Attendee ${index + 1}`,
      email: `${randomUUID()}@test.local`,
      passwordHash: 'not-used-for-login',
      role: 'Attendee',
    })));
    event = await Event.create({
      title: 'Concurrency Integration Event',
      description: 'Dedicated integration fixture',
      categoryId: new mongoose.Types.ObjectId(),
      organizerId: organizer._id,
      venue: 'Integration Hall',
      startAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endAt: new Date(Date.now() + 50 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      capacity: 10,
      seatsTaken: 0,
      status: 'Published',
    });
  });

  after(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('creates exactly 10 confirmed and 50 waitlisted registrations with no duplicates', async () => {
    const responses = await Promise.all(attendees.map((attendee) => {
      const token = jwt.sign(
        { id: attendee._id.toString(), role: 'Attendee' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' },
      );
      return request(app)
        .post(`/api/events/${event._id}/registrations`)
        .set('Cookie', `ems_token=${token}`);
    }));

    assert.ok(responses.every((response) => response.status === 201),
      `Expected 60 successful registrations; statuses: ${responses.map((response) => response.status).join(', ')}`);
    assert.equal(responses.filter((response) => response.body.status === 'Confirmed').length, 10);
    assert.equal(responses.filter((response) => response.body.status === 'Waitlisted').length, 50);

    const [confirmed, waitlisted, eventAfter, registrations] = await Promise.all([
      Registration.countDocuments({ eventId: event._id, status: 'Confirmed' }),
      Registration.countDocuments({ eventId: event._id, status: 'Waitlisted' }),
      Event.findById(event._id),
      Registration.find({ eventId: event._id }).select('userId'),
    ]);
    assert.equal(confirmed, 10);
    assert.equal(waitlisted, 50);
    assert.equal(eventAfter.seatsTaken, 10);
    assert.equal(new Set(registrations.map((registration) => registration.userId.toString())).size, 60);

    const initial = await Registration.find({ eventId: event._id, status: 'Waitlisted' })
      .sort({ waitlistPosition: 1 }).select('_id userId waitlistPosition waitlistSequence');
    assert.deepEqual(initial.map((r) => r.waitlistPosition), Array.from({ length: 50 }, (_, i) => i + 1));
    assert.equal(new Set(initial.map((r) => r.waitlistPosition)).size, 50);
    assert.equal(new Set(initial.map((r) => r.waitlistSequence)).size, 50);

    const confirmedRegistration = await Registration.findOne({ eventId: event._id, status: 'Confirmed' });
    const authCookie = (attendee) => `ems_token=${jwt.sign(
      { id: attendee._id.toString(), role: 'Attendee' }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
    const cancel = (registration, attendee) => request(app)
      .delete(`/api/registrations/${registration._id}`).set('Cookie', authCookie(attendee));
    const confirmedUser = attendees.find((a) => a._id.equals(confirmedRegistration.userId));
    assert.equal((await cancel(confirmedRegistration, confirmedUser)).status, 200);
    const promoted = await Registration.findById(initial[0]._id);
    assert.equal(promoted.status, 'Confirmed');
    assert.equal(promoted.waitlistPosition, null);

    let remaining = await Registration.find({ eventId: event._id, status: 'Waitlisted' })
      .sort({ waitlistPosition: 1 }).select('_id userId waitlistPosition waitlistSequence');
    assert.deepEqual(remaining.map((r) => r.waitlistPosition), Array.from({ length: 49 }, (_, i) => i + 1));
    assert.deepEqual(remaining.map((r) => r.waitlistSequence), initial.slice(1).map((r) => r.waitlistSequence));
    assert.equal((await Event.findById(event._id)).seatsTaken, 10);

    const toCancel = remaining[3];
    const waiterUser = attendees.find((a) => a._id.equals(toCancel.userId));
    const waiterReg = await Registration.findById(toCancel._id);
    assert.equal((await cancel(waiterReg, waiterUser)).status, 200);
    remaining = await Registration.find({ eventId: event._id, status: 'Waitlisted' })
      .sort({ waitlistPosition: 1 }).select('_id waitlistPosition waitlistSequence');
    assert.deepEqual(remaining.map((r) => r.waitlistPosition), Array.from({ length: 48 }, (_, i) => i + 1));
    assert.deepEqual(remaining.map((r) => r.waitlistSequence),
      initial.slice(1).filter((r) => !r._id.equals(toCancel._id)).map((r) => r.waitlistSequence));
    assert.equal((await Event.findById(event._id)).seatsTaken, 10);
  });
});
