
jest.mock('../src/middleware/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = {
      _id: {
        toString: () => '64b000000000000000000099',
        equals: (other) => String(other) === '64b000000000000000000099',
      },
      name: 'Test Attendee',
      email: 'attendee@example.com',
      role: 'Attendee',
    };
    next();
  },
  requireRole: () => (req, res, next) => next(),
}));

jest.mock('../src/models/User', () => ({ findById: jest.fn() }));

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

jest.mock('../src/modules/notifications/notification.service', () => ({
  enqueueNotification: jest.fn(),
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
const User = require('../src/models/User');
const Registration = require('../src/models/Registration');
const {
  enqueueNotification,
} = require('../src/modules/notifications/notification.service');
const app = require('../src/app');

const EVENT_ID = '64b000000000000000000001';
const REG_ID = '64b000000000000000000002';

function query(value) {
  const result = {
    session: jest.fn().mockResolvedValue(value),
    select: jest.fn(),
  };
  result.select.mockReturnValue(result);
  return result;
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
  enqueueNotification.mockResolvedValue({ _id: 'notification-123' });
});

describe('Attendee registration API', () => {
  test('returns 404 for an invalid event ID', async () => {
    const res = await request(app)
      .post('/api/events/not-an-id/registrations');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(mongoose.startSession).not.toHaveBeenCalled();
  });

  test('creates a confirmed registration and queues a confirmation email', async () => {
    const session = mongoose.startSession.mock.results;

    Event.findById.mockReturnValue(query({
      title: 'Tech Conference',
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue({ seatsTaken: 1 });

    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Confirmed');

    expect(Event.findOneAndUpdate).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ session: expect.any(Object) })
    );

    expect(Registration.create).toHaveBeenCalledWith(
      [expect.objectContaining({ status: 'Confirmed' })],
      expect.objectContaining({ session: expect.any(Object) })
    );

    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REGISTRATION_CONFIRMATION',
        recipient: 'attendee@example.com',
        subject: 'Registration confirmed: Tech Conference',
        payload: expect.objectContaining({
          idempotencyKey: `registration:${REG_ID}`,
          attendeeName: 'Test Attendee',
          eventTitle: 'Tech Conference',
          regCode: 'REG-ABC123',
        }),
        session: expect.any(Object),
      })
    );

    expect(mongoose.startSession).toHaveBeenCalledTimes(1);
  });

  test('creates a waitlisted registration without queuing a confirmation email', async () => {
    Event.findById.mockReturnValue(query({
      title: 'Tech Conference',
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ waitlistSequence: 1 });
    Registration.countDocuments.mockReturnValue(query(2));

    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('Waitlisted');
    expect(res.body.waitlistPosition).toBe(3);
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  test('rolls back registration when notification queue insertion fails', async () => {
    const session = mockTransaction();

    Event.findById.mockReturnValue(query({
      title: 'Tech Conference',
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue({ seatsTaken: 1 });

    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    enqueueNotification.mockRejectedValueOnce(
      new Error('Notification database unavailable')
    );

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(500);

    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);

    expect(Registration.create).toHaveBeenCalledTimes(1);

    expect(enqueueNotification).toHaveBeenCalledTimes(1);
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REGISTRATION_CONFIRMATION',
        session,
      })
    );
  });

  test('waitlists the third attendee at position one when a capacity-two event is full', async () => {
    const fullEvent = {
      status: 'Published',
      capacity: 2,
      seatsTaken: 2,
      registrationDeadline: new Date(Date.now() + 60000),
    };
    Event.findById.mockReturnValue(query(fullEvent));
    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ waitlistSequence: 1 });
    Registration.countDocuments.mockReturnValue(query(0));
    Registration.create.mockResolvedValue([{
      _id: REG_ID,
      regCode: 'REG-ABC123',
    }]);

    const res = await request(app).post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'Waitlisted',
      waitlistPosition: 1,
    });
    expect(Registration.countDocuments).toHaveBeenCalledWith({
      eventId: EVENT_ID,
      status: 'Waitlisted',
    });
    expect(Registration.create).toHaveBeenCalledWith(
      [expect.objectContaining({
        status: 'Waitlisted',
        waitlistPosition: 1,
      })],
      expect.objectContaining({ session: expect.any(Object) })
    );
    expect(fullEvent.seatsTaken).toBe(2);
  });

  test('rejects a duplicate active registration', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    Registration.findOne.mockReturnValue(query({ _id: REG_ID }));

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('DUPLICATE_REGISTRATION');
    expect(Registration.create).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  test('rejects registration when the event is closed', async () => {
    Event.findById.mockReturnValue(query({
      status: 'Cancelled',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EVENT_CLOSED');
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  test('rolls back a transaction when registration creation fails', async () => {
    const session = mockTransaction();

    Event.findById.mockReturnValue(query({
      status: 'Published',
      registrationDeadline: new Date(Date.now() + 60000),
    }));

    Registration.findOne.mockReturnValue(query(null));
    Event.findOneAndUpdate.mockResolvedValue({ seatsTaken: 1 });

    Registration.create.mockRejectedValue(
      new Error('database failure')
    );

    const res = await request(app)
      .post(`/api/events/${EVENT_ID}/registrations`);

    expect(res.status).toBe(500);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(enqueueNotification).not.toHaveBeenCalled();
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

    const post = await request(unauthenticatedApp)
      .post(`/api/events/${EVENT_ID}/registrations`);

    const get = await request(unauthenticatedApp)
      .get('/api/registrations/me');

    const del = await request(unauthenticatedApp)
      .delete(`/api/registrations/${REG_ID}`);

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
    Registration.findOneAndUpdate.mockResolvedValue({
      _id: 'oldest-waitlisted',
      userId: '64b000000000000000000003',
      waitlistPosition: 1,
    });
    Event.findById.mockReturnValue(query({
      title: 'Design Week',
      startAt: new Date('2030-01-01T10:00:00Z'),
      venue: 'Hall A',
    }));
    User.findById.mockReturnValue(query({
      name: 'Waitlisted Attendee',
      email: 'waitlist@example.com',
    }));

    const res = await request(app)
      .delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Cancelled');
    expect(reg.save).toHaveBeenCalledWith({ session });

    expect(Registration.findOneAndUpdate).toHaveBeenCalledWith(
      { eventId: EVENT_ID, status: 'Waitlisted' },
      { $set: { status: 'Confirmed', waitlistPosition: null } },
      expect.objectContaining({
        sort: { waitlistSequence: 1, createdAt: 1, _id: 1 },
        new: false,
        session,
      })
    );

    expect(Event.updateOne).not.toHaveBeenCalled();
    expect(enqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'WAITLIST_PROMOTION',
        recipient: 'waitlist@example.com',
        subject: 'Your waitlist place is confirmed: Design Week',
        payload: expect.objectContaining({
          idempotencyKey: `waitlist-promotion:${EVENT_ID}:oldest-waitlisted`,
          attendeeName: 'Waitlisted Attendee',
          eventTitle: 'Design Week',
          startAt: new Date('2030-01-01T10:00:00Z'),
          venue: 'Hall A',
        }),
        session,
      })
    );
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
    Event.findById.mockReturnValue(query({
      startAt: new Date('2030-01-01T10:00:00Z'),
    }));
    Registration.findOneAndUpdate.mockResolvedValue(null);
    Event.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const res = await request(app)
      .delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(200);

    expect(Event.updateOne).toHaveBeenCalledWith(
      { _id: EVENT_ID, seatsTaken: { $gt: 0 } },
      { $inc: { seatsTaken: -1 } },
      expect.objectContaining({ session: expect.any(Object) })
    );
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  test('rolls back cancellation and FIFO promotion when queue insertion fails', async () => {
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
    Event.findById.mockReturnValue(query({
      title: 'Design Week',
      startAt: new Date('2030-01-01T10:00:00Z'),
      venue: 'Hall A',
    }));
    Registration.findOneAndUpdate.mockResolvedValue({
      _id: 'oldest-waitlisted',
      userId: '64b000000000000000000003',
      waitlistPosition: 1,
    });
    User.findById.mockReturnValue(query({
      name: 'Waitlisted Attendee',
      email: 'waitlist@example.com',
    }));
    enqueueNotification.mockRejectedValueOnce(new Error('Notification database unavailable'));

    const res = await request(app).delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(500);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(enqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'WAITLIST_PROMOTION',
      session,
      payload: expect.objectContaining({
        idempotencyKey: `waitlist-promotion:${EVENT_ID}:oldest-waitlisted`,
      }),
    }));
  });

  test('rejects cancellation after the event has started', async () => {
    const reg = {
      _id: REG_ID,
      eventId: EVENT_ID,
      userId: { equals: () => true },
      status: 'Confirmed',
      save: jest.fn(),
    };
    Registration.findById.mockReturnValue(query(reg));
    Event.findById.mockReturnValue(query({
      startAt: new Date(Date.now() - 60000),
    }));

    const res = await request(app).delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CANCEL_NOT_ALLOWED');
    expect(reg.save).not.toHaveBeenCalled();
    expect(Registration.findOneAndUpdate).not.toHaveBeenCalled();
    expect(enqueueNotification).not.toHaveBeenCalled();
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

    const res = await request(app)
      .delete(`/api/registrations/${REG_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(reg.save).not.toHaveBeenCalled();
  });
});
