process.env.JWT_SECRET = 'checkin-unit-test-only';
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const request = require('supertest');
jest.mock('../src/models/Event', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../src/models/Registration', () => ({ findOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/modules/audit/audit.service', () => ({ recordCheckIn: jest.fn() }));
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const User = require('../src/models/User');
const { recordCheckIn } = require('../src/modules/audit/audit.service');
const { assertCheckInAllowed } = require('../src/modules/attendance/checkin.service');
const app = require('../src/app');
const ORG = '64b0000000000000000000a1';
const EVENT = '64b0000000000000000000e1';
const REG = '64b0000000000000000000f1';
const session = { testSession: true };
const cookie = () => `ems_token=${jwt.sign({ id: ORG, role: 'Organizer' }, process.env.JWT_SECRET)}`;
const post = body => request(app).post(`/api/events/${EVENT}/checkin`).set('Cookie', cookie()).send(body);
let event;
beforeEach(() => {
  jest.resetAllMocks();
  User.findById.mockResolvedValue({ _id: ORG, role: 'Organizer', active: true });
  event = { _id: EVENT, organizerId: ORG, status: 'Published', startAt: new Date(Date.now() + 1800000), endAt: new Date(Date.now() + 7200000) };
  Event.findById.mockResolvedValue(event);
  Event.updateOne.mockResolvedValue({ modifiedCount: 1 });
  Registration.findOneAndUpdate.mockImplementation(async (_filter, update) => ({ _id: REG, regCode: 'REG-ABC123', ...update.$set }));
  jest.spyOn(mongoose.connection, 'transaction').mockImplementation(async operation => operation(session));
});
afterAll(() => jest.restoreAllMocks());
describe('Check-in endpoint (TC-CHK-01/02)', () => {
  test('confirms attendance and audit in the same transaction without changing seats', async () => {
    const res = await post({ regCode: ' REG-ABC123 ' });
    expect(res.status).toBe(200);
    expect(res.body.registration).toBe('Checked-in');
    expect(res.body.regCode).toBe('REG-ABC123');
    expect(new Date(res.body.checkedInAt).getTime()).toBeGreaterThan(Date.now() - 10000);
    expect(Registration.findOneAndUpdate).toHaveBeenCalledWith(
      { eventId: EVENT, regCode: 'REG-ABC123', status: 'Confirmed' },
      { $set: { status: 'Checked-in', checkedInAt: expect.any(Date) } },
      { returnDocument: 'after', runValidators: true, session });
    expect(recordCheckIn).toHaveBeenCalledTimes(1);
    expect(recordCheckIn).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ _id: ORG }) }), expect.objectContaining({ _id: REG }), session);
    expect(Event.updateOne).toHaveBeenCalledWith({ _id: EVENT }, { $inc: { attendanceVersion: 1 } }, { session });
  });
  test('requires authentication', async () => {
    const res = await request(app).post(`/api/events/${EVENT}/checkin`).send({ regCode: 'REG-ABC123' });
    expect(res.status).toBe(401);
    expect(Event.findById).not.toHaveBeenCalled();
  });
  test.each(['Attendee', 'Admin'])('rejects current %s role even with an Organizer JWT', async role => {
    User.findById.mockResolvedValue({ _id: ORG, role, active: true });
    expect((await post({ regCode: 'REG-ABC123' })).status).toBe(403);
    expect(Event.findById).not.toHaveBeenCalled();
  });
  test('rejects a deactivated organizer', async () => {
    User.findById.mockResolvedValue({ _id: ORG, role: 'Organizer', active: false });
    expect((await post({ regCode: 'REG-ABC123' })).status).toBe(401);
  });
  test.each([{}, [], { regCode: null }, { regCode: { $ne: null } }, { regCode: '' },
    { regCode: 'A'.repeat(101) }, { regCode: '<script>' }, { regCode: 'REG-ABC123', checkedInAt: '2000-01-01' }])('rejects invalid request %j', async body => {
    expect((await post(body)).status).toBe(422);
    expect(Event.findById).not.toHaveBeenCalled();
  });
  test('rejects an invalid event id', async () => {
    const res = await request(app).post('/api/events/not-an-id/checkin').set('Cookie', cookie()).send({ regCode: 'REG-ABC123' });
    expect(res.status).toBe(404);
  });
  test.each([
    ['Checked-in', 'ALREADY_CHECKED_IN'], ['Waitlisted', 'NOT_CONFIRMED'], ['Cancelled', 'NOT_CONFIRMED'],
  ])('rejects %s registrations with a clear reason', async (status, code) => {
    Registration.findOneAndUpdate.mockResolvedValue(null);
    Registration.findOne.mockResolvedValue({ status });
    const res = await post({ regCode: 'REG-ABC123' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe(code);
    expect(recordCheckIn).not.toHaveBeenCalled();
  });
  test('a code from another event is not found in the selected event', async () => {
    Registration.findOneAndUpdate.mockResolvedValue(null);
    Registration.findOne.mockResolvedValue(null);
    const res = await post({ regCode: 'REG-OTHER' });
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('for this event');
    expect(Registration.findOne).toHaveBeenCalledWith({ eventId: EVENT, regCode: 'REG-OTHER' }, null, { session });
  });
  test('audit failure prevents a successful response', async () => {
    recordCheckIn.mockRejectedValue(Object.assign(new Error('Audit unavailable'), { status: 503, code: 'AUDIT_UNAVAILABLE' }));
    expect((await post({ regCode: 'REG-ABC123' })).status).toBe(503);
  });
});
describe('Check-in rules and inclusive time boundaries', () => {
  const actor = { _id: ORG };
  const fixture = { organizerId: ORG, status: 'Published', startAt: new Date('2026-11-01T10:00:00Z'), endAt: new Date('2026-11-01T12:00:00Z') };
  test.each(['2026-11-01T09:00:00Z', '2026-11-01T09:30:00Z', '2026-11-01T10:00:00Z', '2026-11-01T12:00:00Z'])('accepts %s', now => {
    expect(() => assertCheckInAllowed(fixture, actor, new Date(now))).not.toThrow();
  });
  test.each(['2026-11-01T08:59:59.999Z', '2026-11-01T08:00:00Z', '2026-11-01T12:00:00.001Z', '2026-11-01T13:00:00Z'])('rejects outside-window time %s', now => {
    expect(() => assertCheckInAllowed(fixture, actor, new Date(now))).toThrow(expect.objectContaining({ code: 'OUTSIDE_WINDOW' }));
  });
  test('requires an existing event belonging to the organizer', () => {
    expect(() => assertCheckInAllowed(null, actor, new Date())).toThrow(expect.objectContaining({ status: 404 }));
    expect(() => assertCheckInAllowed(fixture, { _id: REG }, new Date())).toThrow(expect.objectContaining({ status: 403 }));
  });
  test.each(['Pending Approval', 'Rejected', 'Cancelled'])('rejects %s events', status => {
    expect(() => assertCheckInAllowed({ ...fixture, status }, actor, fixture.startAt)).toThrow(expect.objectContaining({ code: 'EVENT_NOT_PUBLISHED' }));
  });
});
