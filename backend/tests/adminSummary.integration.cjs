const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const getSummary = require('../src/modules/reports/summary.service');
const app = require('../src/app');

describe('Admin summary with real MongoDB (TC-RPT-02)', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  const testDb = `ems_test_summary_${randomUUID().replaceAll('-', '')}`;
  const previousSecret = process.env.JWT_SECRET;
  before(async () => {
    if (!new URL(process.env.MONGO_TEST_URI).pathname.startsWith('/ems_test_')) {
      throw new Error('MONGO_TEST_URI must point to a dedicated ems_test_* database');
    }
    process.env.JWT_SECRET = randomUUID();
    // A distinct database keeps summary totals isolated from other integration suites.
    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: testDb, serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Event.init(), Registration.init()]);
  });
  after(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === testDb) {
      await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });
  it('matches known counts and IST boundaries, including empty days and all statuses', async () => {
    const now = new Date('2026-11-30T18:45:00.000Z');
    const empty = await getSummary(now);
    assert.equal(Object.values(empty.eventsByStatus).reduce((a,b) => a+b, 0), 0);
    assert.equal(Object.values(empty.usersByRole).reduce((a,b) => a+b, 0), 0);
    assert.equal(empty.registrationsPerDay.length, 30);
    assert.ok(empty.registrationsPerDay.every(day => day.count === 0));
    const roles = ['Admin', 'Organizer', 'Organizer', 'Attendee'];
    const users = await User.create(roles.map((role, index) => ({
      name: `Summary User ${index}`, email: `summary${index}@test.local`,
      passwordHash: 'not-used-for-login', role, active: index !== 2,
    })));
    const events = await Event.create(['Published', 'Published', 'Pending Approval', 'Rejected', 'Cancelled'].map((status, index) => ({
      title: `Summary Event ${index}`, description: 'Integration fixture',
      categoryId: new mongoose.Types.ObjectId(), organizerId: users[1]._id,
      venue: 'Test Hall', startAt: new Date('2027-01-01T10:00:00Z'),
      endAt: new Date('2027-01-01T12:00:00Z'), registrationDeadline: new Date('2027-01-01T09:00:00Z'),
      capacity: 50, status,
    })));
    const start = new Date('2026-11-01T18:30:00.000Z');
    const dates = [start.getTime() - 1, start.getTime(), start.getTime() + 86400000 - 1,
      start.getTime() + 86400000, now.getTime(), now.getTime() - 3600000, now.getTime() + 1];
    await Registration.insertMany(dates.map((timestamp, index) => ({
      eventId: events[index % 2]._id, userId: users[Math.floor(index / 2)]._id,
      regCode: `SUMMARY-${index}`, status: ['Confirmed', 'Waitlisted', 'Cancelled', 'Checked-in'][index % 4],
      createdAt: new Date(timestamp), updatedAt: new Date(timestamp),
    })));
    const result = await getSummary(now);
    assert.deepEqual(result.eventsByStatus, { 'Pending Approval': 1, Published: 2, Rejected: 1, Cancelled: 1 });
    assert.deepEqual(result.usersByRole, { Attendee: 1, Organizer: 2, Admin: 1 });
    assert.deepEqual(result.registrationsPerDay[0], { date: '2026-11-02', count: 2 });
    assert.deepEqual(result.registrationsPerDay[1], { date: '2026-11-03', count: 1 });
    assert.deepEqual(result.registrationsPerDay.at(-2), { date: '2026-11-30', count: 1 });
    assert.deepEqual(result.registrationsPerDay.at(-1), { date: '2026-12-01', count: 1 });
    assert.equal(result.registrationsPerDay.reduce((sum, day) => sum + day.count, 0), 5);
    assert.equal(result.registrationsPerDay.filter(day => day.count === 0).length, 26);
    const cookie = user => `ems_token=${jwt.sign({ id: user._id, role: 'Admin' }, process.env.JWT_SECRET)}`;
    const response = await request(app).get('/api/admin/summary').set('Cookie', cookie(users[0]));
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.eventsByStatus, result.eventsByStatus);
    assert.deepEqual(response.body.usersByRole, result.usersByRole);
    assert.equal((await request(app).get('/api/admin/summary')).status, 401);
    for (const user of [users[1], users[3]]) {
      assert.equal((await request(app).get('/api/admin/summary').set('Cookie', cookie(user))).status, 403);
    }
    assert.equal((await request(app).get('/api/admin/summary').set('Cookie', cookie(users[2]))).status, 401);
  });
});
