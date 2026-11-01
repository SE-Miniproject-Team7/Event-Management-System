process.env.JWT_SECRET = 'test-secret-for-event-reports';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Event', () => ({ findById: jest.fn() }));
jest.mock('../src/models/Registration', () => ({ find: jest.fn() }));

const User = require('../src/models/User');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const app = require('../src/app');

const ORG_ID = new mongoose.Types.ObjectId('64b0000000000000000000a1');
const OTHER_ORG_ID = new mongoose.Types.ObjectId('64b0000000000000000000a2');
const ATTENDEE_ID = new mongoose.Types.ObjectId('64b0000000000000000000a3');
const EVENT_ID = '64b0000000000000000000e1';

function loginAs(role = 'Organizer', id = ORG_ID) {
  const user = { _id: id, role, active: true };
  User.findById.mockResolvedValue(user);
  const token = jwt.sign({ id: id.toString(), role }, process.env.JWT_SECRET, { expiresIn: '60m' });
  return { cookie: 'ems_token=' + token };
}

function makeEvent(overrides = {}) {
  return {
    _id: new mongoose.Types.ObjectId(EVENT_ID),
    title: 'Hack Night',
    startAt: new Date('2026-12-01T10:00:00.000Z'),
    endAt: new Date('2026-12-01T13:00:00.000Z'),
    venue: 'Hall A',
    capacity: 50,
    organizerId: { equals: (id) => id.equals(ORG_ID) },
    ...overrides,
  };
}

function setupRegistrations(items) {
  const query = {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(items),
  };
  Registration.find.mockReturnValue(query);
  return query;
}

beforeEach(() => jest.resetAllMocks());

describe('organizer event reports (EMS-F-028/029, TC-RPT-01)', () => {
  test('returns event, registration counts and attendance rate for the owner', async () => {
    const { cookie } = loginAs();
    Event.findById.mockResolvedValue(makeEvent());
    const query = setupRegistrations([
      { _id: 'reg1', userId: { name: 'Asha', email: 'asha@example.test' }, regCode: 'REG-AAA111', status: 'Checked-in', createdAt: new Date('2026-10-01T10:00:00Z'), checkedInAt: new Date('2026-10-01T10:30:00Z') },
      { _id: 'reg2', userId: { name: 'Dev', email: 'dev@example.test' }, regCode: 'REG-BBB222', status: 'Confirmed', createdAt: new Date('2026-10-02T10:00:00Z'), checkedInAt: null },
      { _id: 'reg3', userId: { name: 'Mira', email: 'mira@example.test' }, regCode: 'REG-CCC333', status: 'Waitlisted', createdAt: new Date('2026-10-03T10:00:00Z'), checkedInAt: null },
      { _id: 'reg4', userId: { name: 'Sam', email: 'sam@example.test' }, regCode: 'REG-DDD444', status: 'Cancelled', createdAt: new Date('2026-10-04T10:00:00Z'), checkedInAt: null },
    ]);
    const res = await request(app).get('/api/events/' + EVENT_ID + '/report').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.event).toMatchObject({ id: EVENT_ID, title: 'Hack Night', venue: 'Hall A', capacity: 50 });
    expect(res.body.summary).toEqual({ confirmed: 1, waitlisted: 1, checkedIn: 1, cancelled: 1, attendanceRate: 50 });
    expect(res.body.registrations[0]).toMatchObject({
      registrationId: 'reg1', attendeeName: 'Asha', attendeeEmail: 'asha@example.test',
      regCode: 'REG-AAA111', status: 'Checked-in',
    });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: 1, _id: 1 });
    expect(query.populate).toHaveBeenCalledWith('userId', 'name email');
  });

  test('rejects unauthenticated users and non-organizers', async () => {
    expect((await request(app).get('/api/events/' + EVENT_ID + '/report')).status).toBe(401);
    const { cookie } = loginAs('Attendee', ATTENDEE_ID);
    expect((await request(app).get('/api/events/' + EVENT_ID + '/report').set('Cookie', cookie)).status).toBe(403);
    expect(Event.findById).not.toHaveBeenCalled();
  });

  test('prevents one organizer from reading another organizer report', async () => {
    const { cookie } = loginAs('Organizer', OTHER_ORG_ID);
    Event.findById.mockResolvedValue(makeEvent());
    const res = await request(app).get('/api/events/' + EVENT_ID + '/report').set('Cookie', cookie);
    expect(res.status).toBe(403);
    expect(Registration.find).not.toHaveBeenCalled();
  });

  test('invalid or missing event returns 404', async () => {
    const { cookie } = loginAs();
    expect((await request(app).get('/api/events/not-an-id/report').set('Cookie', cookie)).status).toBe(404);
    Event.findById.mockResolvedValue(null);
    expect((await request(app).get('/api/events/' + EVENT_ID + '/report').set('Cookie', cookie)).status).toBe(404);
  });

  test('CSV has stable headers and neutralizes spreadsheet formulas', async () => {
    const { cookie } = loginAs();
    Event.findById.mockResolvedValue(makeEvent());
    setupRegistrations([{
      _id: 'reg1', userId: { name: '=HYPERLINK("https://evil.test","click")', email: 'a,b@example.test' },
      regCode: 'REG-AAA111', status: 'Confirmed', createdAt: new Date('2026-10-01T10:00:00Z'), checkedInAt: null,
    }]);
    const res = await request(app).get('/api/events/' + EVENT_ID + '/report.csv').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('event-report-' + EVENT_ID + '.csv');
    expect(res.text.split('\r\n')[0]).toBe('"eventId","eventTitle","eventStartAt","eventEndAt","eventVenue","eventCapacity","summaryConfirmed","summaryWaitlisted","summaryCheckedIn","summaryCancelled","summaryAttendanceRate","registrationId","attendeeName","attendeeEmail","regCode","status","registeredAt","checkedInAt"');
    expect(res.text).toContain('"\'=HYPERLINK(""https://evil.test"",""click"")"');
    expect(res.text).toContain('"a,b@example.test"');
  });

  test('CSV still exports event and summary when there are no registrations', async () => {
    const { cookie } = loginAs();
    Event.findById.mockResolvedValue(makeEvent());
    setupRegistrations([]);
    const res = await request(app).get('/api/events/' + EVENT_ID + '/report.csv').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.text.split('\r\n')).toHaveLength(3);
    expect(res.text).toContain('"Hack Night"');
  });
});
