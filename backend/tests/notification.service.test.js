jest.mock('../src/models/NotificationJob');

const NotificationJob = require('../src/models/NotificationJob');

const {
  enqueueNotification,
} = require('../src/modules/notifications/notification.service');

describe('Notification service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validNotification = {
    type: 'REGISTRATION_CONFIRMATION',
    recipient: '  TEST@example.com ',
    subject: ' Registration confirmed ',
    payload: {
      idempotencyKey: 'registration-123',
      attendeeName: 'Test User',
      eventTitle: 'Tech Conference',
      regCode: 'EMS-123',
    },
  };

  test('creates a pending notification job', async () => {
    const createdJob = { _id: 'job-123', status: 'Pending' };

    NotificationJob.create.mockResolvedValue(createdJob);

    const result = await enqueueNotification(validNotification);

    expect(result).toBe(createdJob);

    expect(NotificationJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REGISTRATION_CONFIRMATION',
        recipient: 'test@example.com',
        subject: 'Registration confirmed',
        status: 'Pending',
        attempts: 0,
        maxAttempts: 4,
        payload: validNotification.payload,
      })
    );
  });

  test('returns the existing job when an idempotency duplicate occurs', async () => {
    const existingJob = { _id: 'job-existing' };

    NotificationJob.create.mockRejectedValue({ code: 11000 });
    NotificationJob.findOne.mockResolvedValue(existingJob);

    const result = await enqueueNotification(validNotification);

    expect(result).toBe(existingJob);

    expect(NotificationJob.findOne).toHaveBeenCalledWith({
      type: validNotification.type,
      'payload.idempotencyKey': 'registration-123',
    });
  });

  test('throws when notification type is unsupported', async () => {
    await expect(
      enqueueNotification({
        ...validNotification,
        type: 'UNKNOWN_TYPE',
      })
    ).rejects.toThrow('Unsupported notification type');
  });

  test('throws when recipient is missing', async () => {
    await expect(
      enqueueNotification({
        ...validNotification,
        recipient: ' ',
      })
    ).rejects.toThrow('A notification recipient is required');
  });

  test('throws when subject is missing', async () => {
    await expect(
      enqueueNotification({
        ...validNotification,
        subject: '',
      })
    ).rejects.toThrow('A notification subject is required');
  });

  test('throws when payload is not an object', async () => {
    await expect(
      enqueueNotification({
        ...validNotification,
        payload: null,
      })
    ).rejects.toThrow('Notification payload must be an object');
  });

  test('throws when idempotency key is missing', async () => {
    await expect(
      enqueueNotification({
        ...validNotification,
        payload: {},
      })
    ).rejects.toThrow('A notification idempotency key is required');
  });

  test('throws when a duplicate cannot be recovered', async () => {
    NotificationJob.create.mockRejectedValue({ code: 11000 });
    NotificationJob.findOne.mockResolvedValue(null);

    await expect(
      enqueueNotification(validNotification)
    ).rejects.toThrow('Duplicate notification could not be recovered');
  });

  test('rethrows unexpected database errors', async () => {
    NotificationJob.create.mockRejectedValue(
      new Error('Database unavailable')
    );

    await expect(
      enqueueNotification(validNotification)
    ).rejects.toThrow('Database unavailable');
  });
});