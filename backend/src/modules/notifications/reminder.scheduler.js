const cron = require('node-cron');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const { enqueueNotification } = require('./notification.service');

const DAY_MS = 24 * 60 * 60 * 1000;
const REMINDER_TOLERANCE_MS = 15 * 60 * 1000;
const SCHEDULER_INTERVAL_MS = 60 * 1000;
let task = null;
let running = false;

/**
 * Queue reminders only while an event is 23h45m–24h15m away.
 * The sliding query window also catches scheduler runs delayed by up to
 * 15 minutes; the unique job index makes overlapping runs safe.
 */
async function runReminderScheduler({
  now = new Date(),
  toleranceMs = REMINDER_TOLERANCE_MS,
} = {}) {
  const windowStart = new Date(now.getTime() + DAY_MS - toleranceMs);
  const windowEnd = new Date(now.getTime() + DAY_MS + toleranceMs);
  const events = await Event.find({
    status: 'Published',
    startAt: { $gte: windowStart, $lte: windowEnd },
  }).select('_id title venue startAt');

  let queued = 0;
  for (const event of events) {
    const registrations = await Registration.find({
      eventId: event._id,
      status: 'Confirmed',
    }).populate('userId', 'name email');

    for (const registration of registrations) {
      const attendee = registration.userId;
      if (!attendee || !attendee.email) continue;
      const scheduledStartAt = new Date(event.startAt).toISOString();
      await enqueueNotification({
        type: 'EVENT_REMINDER',
        recipient: attendee.email,
        subject: `Reminder: ${event.title} starts in 24 hours`,
        payload: {
          idempotencyKey: `event-reminder:${event._id}:${registration._id}:${scheduledStartAt}`,
          eventId: String(event._id),
          registrationId: String(registration._id),
          scheduledStartAt,
          attendeeName: attendee.name || 'Attendee',
          eventTitle: event.title,
          venue: event.venue || '',
          startAt: scheduledStartAt,
        },
      });
      queued += 1;
    }
  }
  return { events: events.length, queued };
}

async function tick() {
  if (running) return;
  running = true;
  try {
    await runReminderScheduler();
  } catch {
    console.error(JSON.stringify({ level: 'error', event: 'reminder_scheduler_failed' }));
  } finally {
    running = false;
  }
}

function startReminderScheduler() {
  if (process.env.NOTIFICATION_WORKER_ENABLED !== 'true' || task) return;
  task = cron.schedule('* * * * *', tick);
  void tick();
}

function stopReminderScheduler() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = {
  runReminderScheduler,
  startReminderScheduler,
  stopReminderScheduler,
  REMINDER_TOLERANCE_MS,
};
