
jest.mock('node-cron', () => ({
  schedule: jest.fn(() => ({
    stop: jest.fn(),
  })),
}));

jest.mock('mongoose', () => {
  const actualMongoose = jest.requireActual('mongoose');

  return {
    ...actualMongoose,
    connection: { readyState: 1 },
  };
});

jest.mock('../src/models/NotificationJob');
jest.mock('../src/models/NotificationLog');

jest.mock('../src/modules/notifications/email.transport', () => ({
  sendEmail: jest.fn(),
}));

const mongoose = require('mongoose');
const cron = require('node-cron');
const NotificationJob = require('../src/models/NotificationJob');
const NotificationLog = require('../src/models/NotificationLog');
const { sendEmail } = require('../src/modules/notifications/email.transport');

const {
  processDueNotifications,
  startNotificationWorker,
  stopNotificationWorker,
} = require('../src/modules/notifications/notification.worker');

describe('Notification worker', () => {
  const job = {
    _id: 'job-123',
    type: 'REGISTRATION_CONFIRMATION',
    recipient: 'attendee@example.com',
    subject: 'Registration confirmed',
    payload: {
      attendeeName: 'Test User',
      eventTitle: 'Tech Conference',
      regCode: 'EMS-123',
    },
    attempts: 1,
    maxAttempts: 4,
  };

  let consoleError;

  beforeEach(() => {
    jest.clearAllMocks();

    mongoose.connection.readyState = 1;

    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    NotificationJob.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([]),
    });

    NotificationJob.findOneAndUpdate.mockResolvedValue(null);
    NotificationJob.updateOne.mockResolvedValue({ modifiedCount: 1 });
    NotificationLog.create.mockResolvedValue({});
    sendEmail.mockResolvedValue({ messageId: 'email-123' });
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  test('sends reset links only to the mail transport and never into logs', async () => {
    const resetUrl = 'https://ems.example.test/reset-password#' + 'a'.repeat(64);
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      NotificationJob.findOneAndUpdate.mockResolvedValueOnce({ ...job, type: 'PASSWORD_RESET',
        subject: 'Reset your EMS password', payload: { resetUrl } });
      await processDueNotifications();
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
        to: job.recipient, text: expect.stringContaining(resetUrl),
        html: expect.stringContaining('expires in 30 minutes'),
      }));
      expect(JSON.stringify(log.mock.calls) + JSON.stringify(consoleError.mock.calls)).not.toContain(resetUrl);
      expect(NotificationLog.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'Sent' }));
    } finally { log.mockRestore(); }
  });

  test('does not process jobs when MongoDB is disconnected', async () => {
    mongoose.connection.readyState = 0;

    await processDueNotifications();

    expect(NotificationJob.find).not.toHaveBeenCalled();
    expect(NotificationJob.findOneAndUpdate).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('sends confirmation email and records successful delivery', async () => {
    NotificationJob.findOneAndUpdate.mockResolvedValueOnce(job);

    await processDueNotifications();

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'attendee@example.com',
        subject: 'Registration confirmed',
      })
    );

    expect(NotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-123',
        attempt: 1,
        status: 'Sent',
      })
    );

    expect(NotificationJob.updateOne).toHaveBeenCalledWith(
      { _id: 'job-123', status: 'Processing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'Sent',
          lockedAt: null,
        }),
      })
    );
  });

  test('records failed attempt and schedules a retry after approximately one minute', async () => {
    NotificationJob.findOneAndUpdate.mockResolvedValueOnce(job);
    sendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    const beforeAttempt = Date.now();

    await processDueNotifications();

    const afterAttempt = Date.now();

    expect(NotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 1,
        status: 'Failed',
        error: 'Email delivery failed',
      })
    );

    const updateCall = NotificationJob.updateOne.mock.calls.find(
      ([filter]) => filter._id === 'job-123'
    );

    expect(updateCall).toBeDefined();

    const update = updateCall[1].$set;

    expect(update.status).toBe('Pending');
    expect(update.lastError).toBe('Email delivery failed');
    expect(update.lockedAt).toBeNull();

    const retryTime = update.nextAttemptAt.getTime();
    const expectedMinimum = beforeAttempt + 60 * 1000;
    const expectedMaximum = afterAttempt + 60 * 1000;

    expect(retryTime).toBeGreaterThanOrEqual(expectedMinimum);
    expect(retryTime).toBeLessThanOrEqual(expectedMaximum);
  });

  test('marks job Failed after the fourth unsuccessful attempt', async () => {
    const finalAttemptJob = {
      ...job,
      attempts: 4,
    };

    NotificationJob.findOneAndUpdate.mockResolvedValueOnce(finalAttemptJob);
    sendEmail.mockRejectedValueOnce(new Error('SMTP unavailable'));

    await processDueNotifications();

    expect(NotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt: 4,
        status: 'Failed',
      })
    );

    expect(NotificationJob.updateOne).toHaveBeenCalledWith(
      { _id: 'job-123', status: 'Processing' },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'Failed',
        }),
      })
    );
  });

  test('recovers a stale job interrupted during its fourth attempt', async () => {
    const staleJob = {
      _id: 'job-stale',
      recipient: 'attendee@example.com',
      type: 'REGISTRATION_CONFIRMATION',
      attempts: 4,
    };

    NotificationJob.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([staleJob]),
    });

    await processDueNotifications();

    expect(NotificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-stale',
        attempt: 4,
        status: 'Failed',
        error: 'Worker interrupted during final attempt',
      })
    );

    expect(NotificationJob.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: 'job-stale',
        status: 'Processing',
        attempts: 4,
        lockedAt: expect.any(Object),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'Failed',
          lockedAt: null,
        }),
      })
    );

    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('escapes HTML content in confirmation emails', async () => {
    const unsafeJob = {
      ...job,
      payload: {
        attendeeName: '<script>alert(1)</script>',
        eventTitle: '<b>Unsafe Event</b>',
        regCode: 'EMS-123',
      },
    };

    NotificationJob.findOneAndUpdate.mockResolvedValueOnce(unsafeJob);

    await processDueNotifications();

    const sentEmail = sendEmail.mock.calls[0][0];

    expect(sentEmail.html).not.toContain('<script>');
    expect(sentEmail.html).toContain('&lt;script&gt;');
    expect(sentEmail.html).toContain('&lt;b&gt;');
  });

  test('stops processing when there are no pending jobs', async () => {
    NotificationJob.findOneAndUpdate.mockResolvedValueOnce(null);

    await processDueNotifications();

    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('does not schedule worker when disabled', () => {
    process.env.NOTIFICATION_WORKER_ENABLED = 'false';

    startNotificationWorker();

    expect(cron.schedule).not.toHaveBeenCalled();
  });

  test('starts and stops the scheduled worker when enabled', () => {
    process.env.NOTIFICATION_WORKER_ENABLED = 'true';

    startNotificationWorker();

    expect(cron.schedule).toHaveBeenCalledWith(
      '* * * * *',
      expect.any(Function)
    );

    stopNotificationWorker();

    expect(cron.schedule.mock.results[0].value.stop).toHaveBeenCalled();

    process.env.NOTIFICATION_WORKER_ENABLED = 'false';
  });
});
