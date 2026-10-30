process.env.JWT_SECRET = 'test-secret-for-events';

const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

jest.mock('../src/models/User', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/models/Category', () => ({
  find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), create: jest.fn(),
}));
jest.mock('../src/models/Event', () => ({
  create: jest.fn(), find: jest.fn(), findOne: jest.fn(), findById: jest.fn(),
  countDocuments: jest.fn(), updateOne: jest.fn(), findOneAndUpdate: jest.fn(),
}));
jest.mock('../src/models/Registration', () => ({
  updateMany: jest.fn(), find: jest.fn(), findOne: jest.fn(), findById: jest.fn(),
  create: jest.fn(), countDocuments: jest.fn(), findOneAndUpdate: jest.fn(),
}));

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const app = require('../src/app');

const DAY = 24 * 60 * 60 * 1000;
const ORG_ID = new mongoose.Types.ObjectId('64b0000000000000000000a1');
const ORG2_ID = new mongoose.Types.ObjectId('64b0000000000000000000a2');
const ADMIN_ID = new mongoose.Types.ObjectId('64b0000000000000000000a3');
const ATT_ID = new mongoose.Types.ObjectId('64b0000000000000000000a4');
const CAT_ID = '64b0000000000000000000c1';
const EVENT_ID = '64b0000000000000000000e1';

const iso = (days, hours = 0) => new Date(Date.now() + days * DAY + hours * 3600e3).toISOString();

function loginAs(role, id = ORG_ID) {
  const user = { _id: id, role, name: role, active: true };
  User.findById.mockResolvedValue(user);
  const token = jwt.sign({ id: id.toString(), role }, process.env.JWT_SECRET, { expiresIn: '60m' });
  return { user, cookie: `ems_token=${token}` };
}

function validBody(over = {}) {
  return {
    title: 'Hack Night', description: 'Overnight hackathon', categoryId: CAT_ID, venue: 'Hall A',
    startAt: iso(10), endAt: iso(10, 3), registrationDeadline: iso(9), capacity: 50, ...over,
  };
}

function makeEvent(over = {}) {
  return {
    _id: EVENT_ID, title: 'Hack Night', capacity: 50, seatsTaken: 12,
    organizerId: ORG_ID, status: 'Published', startAt: new Date(Date.now() + 10 * DAY),
    save: jest.fn().mockResolvedValue(undefined),
    toObject() { return { title: this.title, capacity: this.capacity, seatsTaken: this.seatsTaken }; },
    ...over,
  };
}

beforeEach(() => { jest.resetAllMocks(); });
afterAll(() => { jest.restoreAllMocks(); });

describe('endpoints are protected', () => {
  test('POST /api/events without login returns 401', async () => {
    const res = await request(app).post('/api/events').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('GET /api/events/pending without login returns 401', async () => {
    expect((await request(app).get('/api/events/pending')).status).toBe(401);
  });

  test('PATCH approval without login returns 401', async () => {
    const res = await request(app).patch(`/api/events/${EVENT_ID}/approval`).send({ decision: 'approve' });
    expect(res.status).toBe(401);
  });

  test('POST /api/admin/categories without login returns 401', async () => {
    expect((await request(app).post('/api/admin/categories').send({ name: 'Seminar' })).status).toBe(401);
  });
});

describe('create event (TC-EVT-01, TC-EVT-02)', () => {
  beforeEach(() => {
    Category.findOne.mockResolvedValue({ _id: CAT_ID, name: 'Workshop', active: true });
    Event.create.mockImplementation(async (doc) => ({ _id: EVENT_ID, ...doc }));
  });

  test('Organizer creates an event with status Pending Approval', async () => {
    const { user, cookie } = loginAs('Organizer');
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody());
    expect(res.status).toBe(201);
    expect(res.body.event.status).toBe('Pending Approval');
    expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'Pending Approval', organizerId: user._id, capacity: 50,
    }));
  });

  test.each([[1], [10000]])('boundary capacity %i is accepted', async (capacity) => {
    const { cookie } = loginAs('Organizer');
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody({ capacity }));
    expect(res.status).toBe(201);
  });

  test.each([
    ['venue', { venue: '' }],
    ['title', { title: 'ab' }],
    ['title', { title: 'x'.repeat(101) }],
    ['description', { description: 'x'.repeat(2001) }],
    ['venue', { venue: 'x'.repeat(101) }],
    ['startAt', { startAt: null }],
    ['startAt', { startAt: 0 }],
    ['startAt', { startAt: [] }],
    ['endAt', { endAt: null }],
    ['endAt', { endAt: false }],
    ['registrationDeadline', { registrationDeadline: null }],
    ['registrationDeadline', { registrationDeadline: {} }],
    ['endAt', { endAt: iso(10, -1) }],
    ['registrationDeadline', { registrationDeadline: iso(11) }],
    ['capacity', { capacity: 0 }],
    ['capacity', { capacity: 10001 }],
    ['capacity', { capacity: 'ten' }],
  ])('rejects invalid %s', async (field, override) => {
    const { cookie } = loginAs('Organizer');
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody(override));
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields.map((f) => f.field)).toContain(field);
    expect(Event.create).not.toHaveBeenCalled();
  });

  test('accepts maximum text lengths and trims the stored values', async () => {
    const { cookie } = loginAs('Organizer');
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody({
      title: '  ' + 'T'.repeat(100) + '  ', description: 'D'.repeat(2000), venue: 'V'.repeat(100),
    }));
    expect(res.status).toBe(201);
    expect(Event.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'T'.repeat(100), description: 'D'.repeat(2000), venue: 'V'.repeat(100),
    }));
  });

  test('rejects an unknown or inactive category', async () => {
    Category.findOne.mockResolvedValue(null);
    const { cookie } = loginAs('Organizer');
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody());
    expect(res.status).toBe(422);
    expect(res.body.error.fields.map((f) => f.field)).toContain('categoryId');
    expect(Event.create).not.toHaveBeenCalled();
  });

  test('Attendee cannot create events (403)', async () => {
    const { cookie } = loginAs('Attendee', ATT_ID);
    const res = await request(app).post('/api/events').set('Cookie', cookie).send(validBody());
    expect(res.status).toBe(403);
    expect(Event.create).not.toHaveBeenCalled();
  });
});

describe('admin approval (TC-EVT-03)', () => {
  const approval = (cookie, body) =>
    request(app).patch(`/api/events/${EVENT_ID}/approval`).set('Cookie', cookie).send(body);

  test('approve publishes a pending event', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    const ev = makeEvent({ status: 'Pending Approval' });
    Event.findById.mockResolvedValue(ev);
    const res = await approval(cookie, { decision: 'approve' });
    expect(res.status).toBe(200);
    expect(ev.status).toBe('Published');
    expect(ev.save).toHaveBeenCalled();
  });

  test('reject with a 9-character reason is refused', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    const ev = makeEvent({ status: 'Pending Approval' });
    Event.findById.mockResolvedValue(ev);
    const res = await approval(cookie, { decision: 'reject', reason: 'too short' });
    expect(res.status).toBe(422);
    expect(ev.status).toBe('Pending Approval');
    expect(ev.save).not.toHaveBeenCalled();
  });

  test('reject with a 10+ character reason marks the event Rejected', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    const ev = makeEvent({ status: 'Pending Approval' });
    Event.findById.mockResolvedValue(ev);
    const res = await approval(cookie, { decision: 'reject', reason: 'Does not meet guidelines' });
    expect(res.status).toBe(200);
    expect(ev.status).toBe('Rejected');
    expect(ev.rejectionReason).toBe('Does not meet guidelines');
    expect(ev.save).toHaveBeenCalled();
  });

  test('invalid decision returns 422', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Event.findById.mockResolvedValue(makeEvent({ status: 'Pending Approval' }));
    expect((await approval(cookie, { decision: 'maybe' })).status).toBe(422);
  });

  test('event that is not pending returns 409', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Event.findById.mockResolvedValue(makeEvent({ status: 'Published' }));
    const res = await approval(cookie, { decision: 'approve' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NOT_PENDING');
  });

  test('unknown event returns 404', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Event.findById.mockResolvedValue(null);
    expect((await approval(cookie, { decision: 'approve' })).status).toBe(404);
  });

  test('Organizer cannot approve (403)', async () => {
    const { cookie } = loginAs('Organizer');
    const res = await approval(cookie, { decision: 'approve' });
    expect(res.status).toBe(403);
    expect(Event.findById).not.toHaveBeenCalled();
  });
});

describe('organizer cancels event (TC-EVT-04, TC-EVT-05)', () => {
  let session;
  const cancel = (cookie, id = EVENT_ID) => request(app).post(`/api/events/${id}/cancel`).set('Cookie', cookie);

  beforeEach(() => {
    session = {
      withTransaction: jest.fn(async (fn) => fn()),
      endSession: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(mongoose, 'startSession').mockResolvedValue(session);
  });

  test('owner cancels: event cancelled, registrations cancelled, seats reset', async () => {
    const { cookie } = loginAs('Organizer');
    const ev = makeEvent({ seatsTaken: 3 });
    Event.findById.mockResolvedValue(ev);
    Registration.updateMany.mockResolvedValue({ modifiedCount: 5 });

    const res = await cancel(cookie);

    expect(res.status).toBe(200);
    expect(res.body.cancelledRegistrations).toBe(5);
    expect(ev.status).toBe('Cancelled');
    expect(ev.seatsTaken).toBe(0);
    expect(Registration.updateMany).toHaveBeenCalledWith(
      { eventId: ev._id, status: { $in: ['Confirmed', 'Waitlisted', 'Checked-in'] } },
      { $set: { status: 'Cancelled', waitlistPosition: null } },
      { session }
    );
    expect(ev.save).toHaveBeenCalledWith({ session });
    expect(session.endSession).toHaveBeenCalled();
  });

  test('another organizer gets 403 and nothing changes', async () => {
    const { cookie } = loginAs('Organizer', ORG2_ID);
    const ev = makeEvent();
    Event.findById.mockResolvedValue(ev);
    const res = await cancel(cookie);
    expect(res.status).toBe(403);
    expect(ev.status).toBe('Published');
    expect(Registration.updateMany).not.toHaveBeenCalled();
    expect(ev.save).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalled();
  });

  test.each([
    ['pending approval', { status: 'Pending Approval' }],
    ['already cancelled', { status: 'Cancelled' }],
    ['already started', { startAt: new Date(Date.now() - 1000) }],
  ])('%s event cannot be cancelled (409)', async (label, override) => {
    const { cookie } = loginAs('Organizer');
    Event.findById.mockResolvedValue(makeEvent(override));
    const res = await cancel(cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANCEL_NOT_ALLOWED');
    expect(Registration.updateMany).not.toHaveBeenCalled();
  });

  test('unknown event returns 404', async () => {
    const { cookie } = loginAs('Organizer');
    Event.findById.mockResolvedValue(null);
    expect((await cancel(cookie)).status).toBe(404);
  });

  test('invalid id returns 404 before any transaction starts', async () => {
    const { cookie } = loginAs('Organizer');
    const res = await cancel(cookie, 'abc');
    expect(res.status).toBe(404);
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('Attendee cannot cancel events (403)', async () => {
    const { cookie } = loginAs('Attendee', ATT_ID);
    expect((await cancel(cookie)).status).toBe(403);
  });
});

describe('category management (TC-ADM-02)', () => {
  const cats = [{ _id: CAT_ID, name: 'Seminar', active: true }, { _id: 'x2', name: 'Workshop', active: true }];

  test('public list returns only active categories', async () => {
    Category.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(cats) });
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(Category.find).toHaveBeenCalledWith({ active: true });
  });

  test('Admin lists all categories', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Category.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(cats) });
    const res = await request(app).get('/api/admin/categories').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(Category.find).toHaveBeenCalledWith();
  });

  test('Admin adds a category (name is trimmed)', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Category.create.mockResolvedValue({ _id: CAT_ID, name: 'Seminar', active: true });
    const res = await request(app).post('/api/admin/categories').set('Cookie', cookie).send({ name: '  Seminar  ' });
    expect(res.status).toBe(201);
    expect(Category.create).toHaveBeenCalledWith({ name: 'Seminar' });
  });

  test.each([[{ name: 'a' }], [{ name: 123 }], [{}]])('invalid category %j returns 422', async (body) => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    const res = await request(app).post('/api/admin/categories').set('Cookie', cookie).send(body);
    expect(res.status).toBe(422);
    expect(Category.create).not.toHaveBeenCalled();
  });

  test('duplicate name returns 409', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Category.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    const res = await request(app).post('/api/admin/categories').set('Cookie', cookie).send({ name: 'Seminar' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_CATEGORY');
  });

  test('Admin renames then disables a category', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    const cat = { _id: CAT_ID, name: 'Seminar', active: true, save: jest.fn().mockResolvedValue(undefined) };
    Category.findById.mockResolvedValue(cat);
    const res = await request(app).patch(`/api/admin/categories/${CAT_ID}`).set('Cookie', cookie)
      .send({ name: 'Seminars', active: false });
    expect(res.status).toBe(200);
    expect(cat.name).toBe('Seminars');
    expect(cat.active).toBe(false);
    expect(cat.save).toHaveBeenCalled();
  });

  test('invalid active value returns 422', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Category.findById.mockResolvedValue({ _id: CAT_ID, name: 'Seminar', active: true, save: jest.fn() });
    const res = await request(app).patch(`/api/admin/categories/${CAT_ID}`).set('Cookie', cookie).send({ active: 'no' });
    expect(res.status).toBe(422);
  });

  test('unknown category returns 404', async () => {
    const { cookie } = loginAs('Admin', ADMIN_ID);
    Category.findById.mockResolvedValue(null);
    const res = await request(app).patch(`/api/admin/categories/${CAT_ID}`).set('Cookie', cookie).send({ active: false });
    expect(res.status).toBe(404);
  });

  test.each([['Organizer', ORG_ID], ['Attendee', ATT_ID]])('%s cannot manage categories (403)', async (role, id) => {
    const { cookie } = loginAs(role, id);
    const res = await request(app).post('/api/admin/categories').set('Cookie', cookie).send({ name: 'Seminar' });
    expect(res.status).toBe(403);
    expect(Category.create).not.toHaveBeenCalled();
  });
});


 // # CHANGED: Add dedicated coverage for EMS-F-015 event details.
describe('event details with remaining seats (EMS-F-015, TC-SRC-02)', () => {
  test('returns published event details and remaining seats', async () => {
    const event = makeEvent({ capacity: 50, seatsTaken: 12 });
    Event.findOne.mockResolvedValue(event);
    Category.findById.mockResolvedValue({ name: 'Workshop' });
    User.findById.mockResolvedValue({ name: 'Event Organizer', email: 'private@example.test', role: 'Organizer' });

    const res = await request(app).get(`/api/events/${EVENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.event).toBeDefined();
    expect(res.body.remainingSeats).toBe(38);
    expect(res.body.categoryName).toBe('Workshop');
    expect(res.body.organizerName).toBe('Event Organizer');
    expect(JSON.stringify(res.body)).not.toContain('private@example.test');
    expect(res.body.event).not.toHaveProperty('role');
    expect(User.findById).toHaveBeenCalledWith(ORG_ID, 'name');
    expect(Event.findOne).toHaveBeenCalledWith({
      _id: EVENT_ID,
      status: 'Published',
    });
  });

  test('returns zero remaining seats when the event is fully booked', async () => {
    const event = makeEvent({ capacity: 50, seatsTaken: 50 });
    Event.findOne.mockResolvedValue(event);

    const res = await request(app).get(`/api/events/${EVENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.remainingSeats).toBe(0);
    expect(res.body).toHaveProperty('remainingSeats', 0);
  });

  test('returns 404 for an invalid event ID', async () => {
    const res = await request(app).get('/api/events/not-an-id');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(Event.findOne).not.toHaveBeenCalled();
  });

  test('returns 404 when the event is not published or does not exist', async () => {
    Event.findOne.mockResolvedValue(null);

    const res = await request(app).get(`/api/events/${EVENT_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(Event.findOne).toHaveBeenCalledWith({
      _id: EVENT_ID,
      status: 'Published',
    });
  });
});


describe('browse, search and filter (TC-SRC-01)', () => {
  function mockList(items = [], total = items.length) {
    const chain = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(items),
    };
    Event.find.mockReturnValue(chain);
    Event.countDocuments.mockResolvedValue(total);
    return chain;
  }
  const clauses = () => Event.find.mock.calls[0][0].$and;

  test('default list: only upcoming Published events, sorted by start, 10 per page', async () => {
    const chain = mockList([makeEvent()], 1);
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(clauses()).toContainEqual({ status: 'Published' });
    const startClause = clauses().find((c) => c.startAt);
    expect(startClause.startAt.$gte).toBeInstanceOf(Date);
    expect(chain.sort).toHaveBeenCalledWith({ startAt: 1 });
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(res.body.page).toBe(1);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].remainingSeats).toBe(38);
  });

  test('keyword search matches title or description, case-insensitively', async () => {
    mockList();
    await request(app).get('/api/events?q=hack');
    const or = clauses().find((c) => c.$or).$or;
    expect(or[0].title.test('Hack Night')).toBe(true);
    expect(or[1].description.test('A HACKATHON for all')).toBe(true);
    expect(or[0].title.test('Workshop')).toBe(false);
  });

  test('regex characters in the search text are escaped', async () => {
    mockList();
    const res = await request(app).get('/api/events').query({ q: 'a.b(' });
    expect(res.status).toBe(200);
    const rx = clauses().find((c) => c.$or).$or[0].title;
    expect(rx.test('a.b(')).toBe(true);
    expect(rx.test('axb(')).toBe(false);
  });

  test('blank search text is ignored', async () => {
    mockList();
    await request(app).get('/api/events').query({ q: '   ' });
    expect(clauses().find((c) => c.$or)).toBeUndefined();
  });

  test('category filter is applied; an invalid id is ignored', async () => {
    mockList();
    await request(app).get(`/api/events?category=${CAT_ID}`);
    expect(clauses()).toContainEqual({ categoryId: CAT_ID });

    Event.find.mockClear();
    mockList();
    await request(app).get('/api/events?category=not-an-id');
    expect(clauses().find((c) => c.categoryId)).toBeUndefined();
  });

  test('date range adds start bounds; invalid dates are ignored', async () => {
    mockList();
    await request(app).get('/api/events?from=2026-11-01&to=2026-11-30');
    const startClauses = clauses().filter((c) => c.startAt);
    expect(startClauses).toHaveLength(3);
    expect(startClauses.some((c) => c.startAt.$gte && c.startAt.$gte.toISOString() === '2026-10-31T18:30:00.000Z')).toBe(true);
    // # CHANGED: Date-only upper bound is exclusive midnight of the next day.
    expect(
      startClauses.some(
        (c) =>
          c.startAt.$lt &&
          c.startAt.$lt.toISOString() === '2026-11-30T18:30:00.000Z'
      )
    ).toBe(true);

    Event.find.mockClear();
    mockList();
    await request(app).get('/api/events?from=garbage&to=nonsense');
    expect(clauses().filter((c) => c.startAt)).toHaveLength(1);
  });

  test('available=true keeps only events with seats left; otherwise no seat filter', async () => {
    mockList();
    await request(app).get('/api/events?available=true');
    expect(clauses().find((c) => c.$expr)).toBeDefined();

    Event.find.mockClear();
    mockList();
    await request(app).get('/api/events?available=false');
    expect(clauses().find((c) => c.$expr)).toBeUndefined();
  });

  test('combined filters are joined with AND', async () => {
    mockList();
    await request(app).get(`/api/events?q=hack&category=${CAT_ID}&from=2026-11-01&to=2026-11-30&available=true`);
    const filter = Event.find.mock.calls[0][0];
    expect(Object.keys(filter)).toEqual(['$and']);
    // status + upcoming + keyword + category + from + to + available
    expect(filter.$and).toHaveLength(7);
  });

  test('page two uses ten-event pages and counts the same combined result set', async () => {
    const chain = mockList([], 23);
    const res = await request(app).get(`/api/events?q=hack&category=${CAT_ID}&from=2026-11-01&to=2026-11-30&available=true&page=2`);

    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(10);
    expect(res.body).toMatchObject({ page: 2, total: 23, items: [] });
    expect(Event.countDocuments).toHaveBeenCalledWith(Event.find.mock.calls[0][0]);
    expect(Event.find.mock.calls[0][0].$and).toHaveLength(7);
  });


  test('pagination: page 3 with limit 5 skips 10', async () => {
    const chain = mockList([], 25);
    const res = await request(app).get('/api/events?page=3&limit=5');
    expect(chain.skip).toHaveBeenCalledWith(10);
    expect(chain.limit).toHaveBeenCalledWith(5);
    expect(res.body.page).toBe(3);
    expect(res.body.total).toBe(25);
  });

  test('limit is capped at 50 and bad paging values fall back to defaults', async () => {
    let chain = mockList();
    await request(app).get('/api/events?limit=500');
    expect(chain.limit).toHaveBeenCalledWith(50);

    Event.find.mockClear();
    chain = mockList();
    await request(app).get('/api/events?page=0&limit=abc');
    expect(chain.skip).toHaveBeenCalledWith(0);
    expect(chain.limit).toHaveBeenCalledWith(10);
  });

test('from date starts at midnight India time', async () => {
  mockList();
  await request(app).get('/api/events?from=2026-11-30');
  expect(clauses()).toContainEqual({
    startAt: { $gte: new Date('2026-11-29T18:30:00.000Z') },
  });
});

// # CHANGED: Date-only upper bounds use exclusive midnight in India.
test('to date includes events throughout that calendar day', async () => {
  mockList();

  await request(app).get('/api/events?to=2026-11-30');

  const dateClause = clauses().find(
    (clause) => clause.startAt && clause.startAt.$lt
  );

  expect(dateClause).toBeDefined();
  expect(dateClause.startAt.$lt.toISOString()).toBe(
    '2026-11-30T18:30:00.000Z'
  );
});

// # CHANGED: Exact timestamp upper bounds remain inclusive.
test('to timestamp remains an inclusive exact timestamp', async () => {
  mockList();

  await request(app).get(
    '/api/events?to=2026-11-30T15:30:00.000Z'
  );

  const dateClause = clauses().find(
    (clause) => clause.startAt && clause.startAt.$lte
  );

  expect(dateClause).toBeDefined();
  expect(dateClause.startAt.$lte.toISOString()).toBe(
    '2026-11-30T15:30:00.000Z'
  );
});
});
