const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const AuditLog = require('../src/models/AuditLog');
const app = require('../src/app');
describe('Real check-in endpoint (TC-CHK-01/02 and TC-SEC-05)', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  const dbName = `ems_test_checkin_${randomUUID().replaceAll('-', '')}`;
  const oldSecret = process.env.JWT_SECRET;
  let organizer, otherOrganizer, attendee, event, registration;
  const cookie = user => `ems_token=${jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET)}`;
  const post = (code = registration.regCode, actor = organizer, eventId = event._id) =>
    request(app).post(`/api/events/${eventId}/checkin`).set('Cookie', cookie(actor)).send({ regCode: code });
  before(async () => {
    if (!new URL(process.env.MONGO_TEST_URI).pathname.startsWith('/ems_test_')) throw new Error('Use a dedicated ems_test_* database');
    process.env.JWT_SECRET = randomUUID();
    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName, serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Event.init(), Registration.init(), AuditLog.init()]);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({}), AuditLog.deleteMany({})]);
    [organizer, otherOrganizer, attendee] = await User.create(['Organizer', 'Organizer', 'Attendee'].map((role, i) => ({
      name: `Check-in User ${i}`, email: `checkin${i}@test.local`, passwordHash: 'not-used', role,
    })));
    event = await Event.create({ title: 'Check-in Event', description: 'Integration fixture',
      categoryId: new mongoose.Types.ObjectId(), organizerId: organizer._id, venue: 'Hall', capacity: 10, seatsTaken: 1,
      startAt: new Date(Date.now() + 1800000), endAt: new Date(Date.now() + 7200000),
      registrationDeadline: new Date(Date.now() + 600000), status: 'Published' });
    registration = await Registration.create({ eventId: event._id, userId: attendee._id, regCode: 'REG-ABC123', status: 'Confirmed' });
  });
  after(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
  });
  it('checks in 30 minutes before start and writes one real audit entry with timestamp', async () => {
    const res = await post();
    assert.equal(res.status, 200);
    assert.equal(res.body.registration, 'Checked-in');
    const saved = await Registration.findById(registration._id);
    assert.equal(saved.status, 'Checked-in');
    assert.equal(saved.checkedInAt.toISOString(), res.body.checkedInAt);
    assert.equal((await Event.findById(event._id)).seatsTaken, 1);
    const logs = await AuditLog.find({ action: 'CHECK_IN' });
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].userId), String(organizer._id));
    assert.equal(String(logs[0].targetId), String(registration._id));
    assert.ok(logs[0].ip.includes('127.0.0.1') || logs[0].ip === '::1');
    assert.ok(logs[0].timestamp instanceof Date);
  });
  it('serializes eight simultaneous requests into one check-in and one audit', async () => {
    const results = await Promise.all(Array.from({ length: 8 }, () => post()));
    assert.equal(results.filter(res => res.status === 200).length, 1);
    assert.equal(results.filter(res => res.status === 409 && res.body.error.code === 'ALREADY_CHECKED_IN').length, 7);
    assert.equal(await AuditLog.countDocuments({ action: 'CHECK_IN' }), 1);
    assert.equal((await Event.findById(event._id)).seatsTaken, 1);
  });
  it('rejects waitlisted/cancelled registrations and a code belonging to another event', async () => {
    for (const status of ['Waitlisted', 'Cancelled']) {
      await Registration.updateOne({ _id: registration._id }, { $set: { status } });
      const res = await post();
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'NOT_CONFIRMED');
    }
    await Registration.updateOne({ _id: registration._id }, { $set: { eventId: new mongoose.Types.ObjectId(), status: 'Confirmed' } });
    const wrongEvent = await post();
    assert.equal(wrongEvent.status, 404);
    assert.ok(wrongEvent.body.error.message.includes('for this event'));
    assert.equal(await AuditLog.countDocuments(), 0);
  });
  it('rejects requests two hours before start and one hour after end with no state changes', async () => {
    await Event.updateOne({ _id: event._id }, { $set: { startAt: new Date(Date.now() + 7200000), endAt: new Date(Date.now() + 10800000) } });
    assert.equal((await post()).body.error.code, 'OUTSIDE_WINDOW');
    await Event.updateOne({ _id: event._id }, { $set: { startAt: new Date(Date.now() - 7200000), endAt: new Date(Date.now() - 3600000) } });
    assert.equal((await post()).body.error.code, 'OUTSIDE_WINDOW');
    assert.equal((await Registration.findById(registration._id)).status, 'Confirmed');
    assert.equal(await AuditLog.countDocuments(), 0);
  });
  it('enforces owner, role, current account activity and published-event status', async () => {
    assert.equal((await post(registration.regCode, otherOrganizer)).status, 403);
    assert.equal((await post(registration.regCode, attendee)).status, 403);
    await User.updateOne({ _id: organizer._id }, { $set: { active: false } });
    assert.equal((await post()).status, 401);
    await User.updateOne({ _id: organizer._id }, { $set: { active: true } });
    await Event.updateOne({ _id: event._id }, { $set: { status: 'Cancelled' } });
    assert.equal((await post()).body.error.code, 'EVENT_NOT_PUBLISHED');
    assert.equal(await AuditLog.countDocuments(), 0);
  });
  it('rolls back check-in and event guard if audit persistence fails', async () => {
    const original = AuditLog.create;
    AuditLog.create = async () => { throw new Error('Synthetic persistence failure'); };
    try {
      const res = await post();
      assert.equal(res.status, 503);
      assert.equal(res.body.error.code, 'AUDIT_UNAVAILABLE');
      assert.equal((await Registration.findById(registration._id)).status, 'Confirmed');
      assert.equal((await Registration.findById(registration._id)).checkedInAt, null);
      const stored = await Event.findById(event._id).select('+attendanceVersion');
      assert.equal(stored.attendanceVersion, undefined);
      assert.equal(stored.seatsTaken, 1);
    } finally { AuditLog.create = original; }
  });
  it('cannot leave a checked-in attendee active after a concurrent event cancellation', async () => {
    const [checkin, cancel] = await Promise.all([post(),
      request(app).post(`/api/events/${event._id}/cancel`).set('Cookie', cookie(organizer))]);
    assert.equal(cancel.status, 200);
    assert.ok([200, 409].includes(checkin.status));
    assert.equal((await Event.findById(event._id)).status, 'Cancelled');
    assert.equal((await Event.findById(event._id)).seatsTaken, 0);
    assert.equal((await Registration.findById(registration._id)).status, 'Cancelled');
    assert.equal(await AuditLog.countDocuments({ action: 'CHECK_IN' }), checkin.status === 200 ? 1 : 0);
  });
});
