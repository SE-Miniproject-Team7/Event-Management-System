const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { MongoServerError } = require('mongodb');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const AuditLog = require('../src/models/AuditLog');
const { recordCheckIn } = require('../src/modules/audit/audit.service');
const app = require('../src/app');

describe('Audit log integration (TC-SEC-05)', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  const testDb = `ems_test_audit_${randomUUID().replaceAll('-', '')}`;
  const oldSecret = process.env.JWT_SECRET;
  let admin, organizer, attendee, pending, published, hash;
  const cookie = user => `ems_token=${jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET)}`;
  const patchUser = body => request(app).patch(`/api/admin/users/${attendee._id}`).set('Cookie', cookie(admin)).send(body);
  const approval = (event, decision) => request(app).patch(`/api/events/${event._id}/approval`).set('Cookie', cookie(admin)).send({ decision, reason: 'Not appropriate for this venue' });
  const cancel = event => request(app).post(`/api/events/${event._id}/cancel`).set('Cookie', cookie(organizer));
  const eventData = status => ({ title: 'Audit fixture', description: 'Synthetic event',
    categoryId: new mongoose.Types.ObjectId(), organizerId: organizer._id, venue: 'Test Hall',
    startAt: new Date(Date.now() + 7200000), endAt: new Date(Date.now() + 18000000),
    registrationDeadline: new Date(Date.now() + 3600000), capacity: 10, status });
  before(async () => {
    if (!new URL(process.env.MONGO_TEST_URI).pathname.startsWith('/ems_test_')) throw new Error('Use a dedicated ems_test_* database');
    process.env.JWT_SECRET = randomUUID();
    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: testDb, serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Event.init(), Registration.init(), AuditLog.init()]);
    hash = await bcrypt.hash('AuditPassword123', 4);
  });
  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), Event.deleteMany({}), Registration.deleteMany({}), AuditLog.deleteMany({})]);
    [admin, organizer, attendee] = await User.create(['Admin', 'Organizer', 'Attendee'].map((role, i) => ({
      name: `Audit ${role}`, email: `audit${i}@test.local`, role, active: true, passwordHash: hash,
    })));
    [pending, published] = await Event.create([eventData('Pending Approval'), eventData('Published')]);
  });
  after(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === testDb) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  it('logs successful and failed login attempts without credentials, including unknown and locked users', async () => {
    const login = (email, password) => request(app).post('/api/auth/login').set('X-Forwarded-For', '203.0.113.99').send({ email, password, token: 'secret-request-token' });
    const success = await login(attendee.email, 'AuditPassword123');
    assert.equal(success.status, 200);
    assert.equal((await login(attendee.email, 'WrongPassword123')).status, 401);
    assert.equal((await login('unknown@test.local', 'WrongPassword123')).status, 401);
    assert.equal((await login('', '')).status, 401);
    await User.updateOne({ _id: attendee._id }, { $set: { lockUntil: new Date(Date.now() + 60000) } });
    assert.equal((await login(attendee.email, 'AuditPassword123')).status, 423);
    await User.updateOne({ _id: organizer._id }, { $set: { active: false } });
    assert.equal((await login(organizer.email, 'AuditPassword123')).status, 401);
    const logs = await AuditLog.find().sort({ _id: 1 }).lean();
    assert.deepEqual(logs.map(log => log.action), ['LOGIN', 'LOGIN_FAILED', 'LOGIN_FAILED', 'LOGIN_FAILED', 'LOGIN_FAILED', 'LOGIN_FAILED']);
    assert.equal(String(logs[0].userId), String(attendee._id));
    assert.equal(logs[2].userId, null);
    assert.equal(logs[3].userId, null);
    for (const log of logs) {
      assert.ok(log.timestamp instanceof Date);
      assert.ok(log.ip.includes('127.0.0.1') || log.ip === '::1');
      assert.notEqual(log.ip, '203.0.113.99');
    }
    const serialized = JSON.stringify(logs);
    for (const secret of ['AuditPassword123', 'WrongPassword123', hash, 'secret-request-token', attendee.email, 'unknown@test.local', cookie(attendee).slice(10)]) {
      assert.ok(!serialized.includes(secret));
    }
  });
  it('logs real role/activity changes, but not no-ops or rejected operations', async () => {
    assert.equal((await patchUser({ role: 'Organizer' })).status, 200);
    assert.equal((await patchUser({ role: 'Organizer' })).status, 200);
    assert.equal((await patchUser({ active: false })).status, 200);
    assert.equal((await patchUser({ role: 'Owner' })).status, 422);
    const logs = await AuditLog.find().sort({ _id: 1 });
    assert.deepEqual(logs.map(log => log.action), ['USER_ROLE_CHANGED', 'USER_ACTIVITY_CHANGED']);
    assert.ok(logs.every(log => String(log.userId) === String(admin._id) && String(log.targetId) === String(attendee._id)));
  });
  it('records each successful approval, rejection and cancellation once', async () => {
    const rejected = await Event.create(eventData('Pending Approval'));
    assert.equal((await approval(pending, 'approve')).status, 200);
    assert.equal((await approval(rejected, 'reject')).status, 200);
    assert.equal((await cancel(pending)).status, 200);
    assert.equal((await cancel(pending)).status, 409);
    assert.equal((await approval(pending, 'approve')).status, 409);
    const denied = await request(app).patch(`/api/events/${published._id}/approval`).set('Cookie', cookie(attendee)).send({ decision: 'approve' });
    assert.equal(denied.status, 403);
    const logs = await AuditLog.find().sort({ _id: 1 });
    assert.deepEqual(logs.map(log => log.action), ['EVENT_APPROVED', 'EVENT_REJECTED', 'EVENT_CANCELLED']);
    assert.equal(String(logs[2].userId), String(organizer._id));
    assert.equal(String(logs[2].targetId), String(pending._id));
  });
  it('rolls back security changes if the audit write fails, and issues no login cookie', async () => {
    const registration = await Registration.create({ eventId: published._id, userId: attendee._id, regCode: 'ROLLBACK', status: 'Confirmed' });
    await Event.updateOne({ _id: published._id }, { $set: { seatsTaken: 1 } });
    const original = AuditLog.create;
    AuditLog.create = async () => { throw new Error('secret-token-must-not-leak'); };
    try {
      for (const response of [await patchUser({ role: 'Organizer' }), await approval(pending, 'approve'), await cancel(published)]) {
        assert.equal(response.status, 503);
        assert.equal(response.body.error.code, 'AUDIT_UNAVAILABLE');
        assert.ok(!JSON.stringify(response.body).includes('secret-token'));
      }
      const login = await request(app).post('/api/auth/login').send({ email: attendee.email, password: 'AuditPassword123' });
      assert.equal(login.status, 503);
      assert.equal(login.headers['set-cookie'], undefined);
      assert.equal((await User.findById(attendee._id)).role, 'Attendee');
      assert.equal((await Event.findById(pending._id)).status, 'Pending Approval');
      assert.equal((await Event.findById(published._id)).status, 'Published');
      assert.equal((await Event.findById(published._id)).seatsTaken, 1);
      assert.equal((await Registration.findById(registration._id)).status, 'Confirmed');
      assert.equal(await AuditLog.countDocuments(), 0);
    } finally { AuditLog.create = original; }
  });
  it('transaction retry does not duplicate audit entries', async () => {
    const original = AuditLog.create;
    let attempts = 0;
    AuditLog.create = async function(...args) {
      const result = await original.apply(this, args);
      if (++attempts === 1) {
        const error = new MongoServerError({ message: 'Synthetic write conflict', code: 112 });
        error.addErrorLabel('TransientTransactionError');
        throw error;
      }
      return result;
    };
    try {
      assert.equal((await approval(pending, 'approve')).status, 200);
      assert.equal(attempts, 2);
      assert.equal(await AuditLog.countDocuments({ action: 'EVENT_APPROVED' }), 1);
    } finally { AuditLog.create = original; }
  });
  it('provides the transactional check-in hook required by issue #29', async () => {
    const registration = await Registration.create({ eventId: published._id, userId: attendee._id, regCode: 'CHECKIN', status: 'Confirmed' });
    const checkIn = () => mongoose.connection.transaction(async session => {
      const changed = await Registration.findOneAndUpdate({ _id: registration._id, status: 'Confirmed' },
        { $set: { status: 'Checked-in', checkedInAt: new Date() } }, { returnDocument: 'after', session });
      if (changed) await recordCheckIn({ user: organizer, ip: '127.0.0.1' }, changed, session);
    });
    await checkIn(); await checkIn();
    const logs = await AuditLog.find({ action: 'CHECK_IN' });
    assert.equal(logs.length, 1);
    assert.equal(String(logs[0].userId), String(organizer._id));
    assert.equal(String(logs[0].targetId), String(registration._id));
  });
  it('creates a 90-day TTL index on the stored timestamp', async () => {
    const indexes = await AuditLog.collection.indexes();
    assert.ok(indexes.some(index => index.key.timestamp === 1 && index.expireAfterSeconds === 7776000));
  });
});
