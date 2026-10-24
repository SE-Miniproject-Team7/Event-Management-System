jest.mock('../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      _id: { toString: () => '64b000000000000000000099', equals: (other) => String(other) === '64b000000000000000000099' },
      role: 'Attendee',
    };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

jest.mock('../src/models/Event', () => ({
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../src/models/Registration', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  updateMany: jest.fn(),
}));

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    ...actual,
    startSession: jest.fn(),
  };
});

const request = require('supertest');
const mongoose = require('mongoose');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const app = require('../src/app');

const EVENT_ID = '64b000000000000000000001';
const REG_ID = '64b000000000000000000002';

function query(value) {
  return { session: jest.fn().mockResolvedValue(value) };
}

function mockTransaction() {
  const session = {
    withTransaction: jest.fn(async (callback) => callback()),
    endSession: jest.fn().mockResolvedValue(undefined),
  };
  mongoose.startSession.mockResolvedValue(session);
  return session;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTransaction();
});

describe('Attendee registration API', () => {
  test('returns 404 for an invalid event ID', async () => {
    const res = await request(app).post('/api/events/not-an-id/registrations');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('creates a confirmed registration within a transaction when a seat is available', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));
    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue({ seatsTaken: 1 });
    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Confirmed');
    expect(Event.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), expect.objectContaining({ session: expect.any(Object) })
    );
    expect(Registration.create).toHaveBeenCalledWith(
      [expect.objectContaining({ status: 'Confirmed' })],
      expect.objectContaining({ session: expect.any(Object) })
    );
    expect(mongoose.startSession).toHaveBeenCalledTimes(1);
  });

  test('creates a waitlisted registration when capacity is full', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));
    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue(null);
    Registration.countDocuments.mockReturnValue(query(2));
    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Waitlisted');
    expect(res.body.waitlistPosition).toBe(3);
  });

  test('rejects a duplicate active registration', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));
    Registration.findOne.mockReturnValue(query({ _id: REG_ID }));

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REGISTRATION');
    expect(Registration.create).not.toHaveBeenCalled();
  });

  test('rejects registration when the event is closed', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Cancelled',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CLOSED');
  });

  test('rolls back a transaction when registration creation fails', async () => {
    const session = mockTransaction();
    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));
    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue({ seatsTaken: 1 });
    Registration.create.mockRejectedValue(new Error('database failure'));

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(500);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('requires login for the registration endpoints', async () => {
    jest.resetModules();
    jest.doMock('../src/middleware/auth', () => ({
      authenticate: (req, res, next) => {
        const AppError = require('../src/utils/AppError');
        next(new AppError(401, 'UNAUTHENTICATED', 'Please log in'));
      },
      requireRole: () => (req, res, next) => next(),
    }));
    const unauthenticatedApp = require('../src/app');

    const post = await request(unauthenticatedApp).post(`/api/events/${EVENT_ID}/registrations`);
    const get = await request(unauthenticatedApp).get('/api/registrations/me');
    const del = await request(unauthenticatedApp).delete(`/api/registrations/${REG_ID}`);

    expect(post.status).toBe(401);
    expect(get.status).toBe(401);
    expect(del.status).toBe(401);
  });
  test('cancelling a confirmed registration promotes the oldest waitlisted attendee', async () => {
    const session = mockTransaction();
    const reg = {
      _id: REG_ID,
      eventId: EVENT_ID,
      userId: { equals: () => true },
      status: 'Confirmed',
      waitlistPosition: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    Registration.findById.mockReturnValue(query(reg));
    Registration.findOneAndUpdate.mockResolvedValue({ _id: 'oldest-waitlisted' });

    const res = await request(app).delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');
    expect(reg.save).toHaveBeenCalledWith({ session });
    expect(Registration.findOneAndUpdate).toHaveBeenCalledWith(
      { eventId: EVENT_ID, status: 'Waitlisted' },
      { $set: { status: 'Confirmed', waitlistPosition: null } },
      expect.objectContaining({
        sort: { createdAt: 1 },
        new: true,
        session,
      })
    );
    expect(Event.updateOne).not.toHaveBeenCalled();
  });

  test('cancelling a confirmed registration releases a seat when nobody is waitlisted', async () => {
    const reg = {
      _id: REG_ID,
      eventId: EVENT_ID,
      userId: { equals: () => true },
      status: 'Confirmed',
      waitlistPosition: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    Registration.findById.mockReturnValue(query(reg));
    Registration.findOneAndUpdate.mockResolvedValue(null);
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await request(app).delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(200);
    expect(Event.updateOne).toHaveBeenCalledWith(
      { _id: EVENT_ID, seatsTaken: { $gt: 0 } },
      { $inc: { seatsTaken: -1 } },
      expect.objectContaining({ session: expect.any(Object) })
    );
  });

  test('prevents an attendee from cancelling someone else’s registration', async () => {
    const reg = {
      _id: REG_ID,
      eventId: EVENT_ID,
      userId: { equals: () => false },
      status: 'Confirmed',
      save: jest.fn(),
    };

    Registration.findById.mockReturnValue(query(reg));

    const res = await request(app).delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(reg.save).not.toHaveBeenCalled();
  });
});
