process.env.JWT_SECRET = 'test-admin-summary-only';
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/models/Event', () => ({ aggregate: jest.fn() }));
jest.mock('../src/models/User', () => ({ aggregate: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/Registration', () => ({ aggregate: jest.fn() }));
const Event = require('../src/models/Event');
const User = require('../src/models/User');
const Registration = require('../src/models/Registration');
const getSummary = require('../src/modules/reports/summary.service');
const app = require('../src/app');
const id = '64b0000000000000000000a1';
const cookie = () => `ems_token=${jwt.sign({ id, role: 'Admin' }, process.env.JWT_SECRET)}`;
beforeEach(() => {
  jest.resetAllMocks();
  Event.aggregate.mockResolvedValue([]);
  User.aggregate.mockResolvedValue([]);
  Registration.aggregate.mockResolvedValue([]);
  User.findById.mockResolvedValue({ _id: id, role: 'Admin', active: true });
});
describe('platform summary (EMS-F-030 / TC-RPT-02)', () => {
  test('zero-fills missing statuses, roles and all 30 IST days across a month boundary', async () => {
    Event.aggregate.mockResolvedValue([{ _id: 'Published', count: 3 }]);
    User.aggregate.mockResolvedValue([{ _id: 'Admin', count: 2 }]);
    Registration.aggregate.mockResolvedValue([{ _id: '2026-11-30', count: 7 }]);
    const now = new Date('2026-11-30T18:45:00.000Z');
    const result = await getSummary(now);
    expect(result.eventsByStatus).toEqual({ 'Pending Approval': 0, Published: 3, Rejected: 0, Cancelled: 0 });
    expect(result.usersByRole).toEqual({ Attendee: 0, Organizer: 0, Admin: 2 });
    expect(result.registrationsPerDay).toHaveLength(30);
    expect(result.registrationsPerDay[0]).toEqual({ date: '2026-11-02', count: 0 });
    expect(result.registrationsPerDay.at(-1)).toEqual({ date: '2026-12-01', count: 0 });
    expect(result.registrationsPerDay.at(-2)).toEqual({ date: '2026-11-30', count: 7 });
    const pipeline = Registration.aggregate.mock.calls[0][0];
    expect(pipeline[0].$match.createdAt).toEqual({ $gte: new Date('2026-11-01T18:30:00.000Z'), $lte: now });
    expect(pipeline[1].$group._id.$dateToString.timezone).toBe('Asia/Kolkata');
    expect(pipeline[0].$match).not.toHaveProperty('status');
  });
  test('requires authentication before running aggregates', async () => {
    const res = await request(app).get('/api/admin/summary');
    expect(res.status).toBe(401);
    expect(Event.aggregate).not.toHaveBeenCalled();
  });
  test.each(['Attendee', 'Organizer'])('denies current %s role even with an Admin JWT', async role => {
    User.findById.mockResolvedValue({ _id: id, role, active: true });
    const res = await request(app).get('/api/admin/summary').set('Cookie', cookie());
    expect(res.status).toBe(403);
    expect(Event.aggregate).not.toHaveBeenCalled();
  });
  test('rejects inactive admins', async () => {
    User.findById.mockResolvedValue({ _id: id, role: 'Admin', active: false });
    expect((await request(app).get('/api/admin/summary').set('Cookie', cookie())).status).toBe(401);
    expect(Event.aggregate).not.toHaveBeenCalled();
  });
  test('returns only the documented aggregate fields to an Admin', async () => {
    const res = await request(app).get('/api/admin/summary').set('Cookie', cookie());
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['eventsByStatus', 'registrationsPerDay', 'usersByRole']);
    expect(res.body.registrationsPerDay).toHaveLength(30);
  });
});
