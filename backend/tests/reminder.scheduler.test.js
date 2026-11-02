jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../src/models/Event');
jest.mock('../src/models/Registration');
jest.mock('../src/modules/notifications/notification.service', () => ({ enqueueNotification: jest.fn() }));

const cron = require('node-cron');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const { enqueueNotification } = require('../src/modules/notifications/notification.service');
const { runReminderScheduler, startReminderScheduler, stopReminderScheduler } = require('../src/modules/notifications/reminder.scheduler');

describe('24-hour reminder scheduler (EMS-F-023 / TC-NTF-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOTIFICATION_WORKER_ENABLED = 'true';
    Event.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
  });

  afterEach(() => {
    stopReminderScheduler();
    process.env.NOTIFICATION_WORKER_ENABLED = 'false';
  });

  test('queries only published events entering the 24-hour window using the supplied clock', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await runReminderScheduler({ now });
    expect(Event.find).toHaveBeenCalledWith({
      status: 'Published',
      startAt: { $gte: new Date('2030-01-01T23:45:00.000Z'), $lte: new Date('2030-01-02T00:15:00.000Z') },
    });
  });

  test('queues only confirmed attendees and keys jobs by event, registration and scheduled start', async () => {
    const event = { _id: 'event-1', title: 'Tech Day', venue: '<Hall>', startAt: new Date('2030-01-02T00:00:30.000Z') };
    const registration = { _id: 'reg-1', userId: { name: '<A>', email: 'a@example.test' } };
    Event.find.mockReturnValue({ select: jest.fn().mockResolvedValue([event]) });
    Registration.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([registration, { _id: 'reg-2', userId: null }]) });

    const result = await runReminderScheduler({ now: new Date('2030-01-01T00:00:00.000Z'), toleranceMs: 15 * 60 * 1000 });

    expect(result).toEqual({ events: 1, queued: 1 });
    expect(Registration.find).toHaveBeenCalledWith({ eventId: 'event-1', status: 'Confirmed' });
    expect(enqueueNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'EVENT_REMINDER',
      recipient: 'a@example.test',
      payload: expect.objectContaining({
        idempotencyKey: 'event-reminder:event-1:reg-1:2030-01-02T00:00:30.000Z',
        eventId: 'event-1',
        registrationId: 'reg-1',
        scheduledStartAt: '2030-01-02T00:00:30.000Z',
      }),
    }));
  });

  test('enables only one cron task when started repeatedly', () => {
    startReminderScheduler();
    startReminderScheduler();
    expect(cron.schedule).toHaveBeenCalledTimes(1);
    stopReminderScheduler();
  });
});
