const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Event = require('../src/models/Event');
const Registration = require('../src/models/Registration');
const NotificationJob = require('../src/models/NotificationJob');
const NotificationLog = require('../src/models/NotificationLog');
const { runReminderScheduler, REMINDER_TOLERANCE_MS } = require('../src/modules/notifications/reminder.scheduler');
const { reminderIsEligible } = require('../src/modules/notifications/notification.worker');

const DAY_MS = 24 * 60 * 60 * 1000;

describe(
  '24-hour reminder scheduler with real MongoDB (EMS-F-023 / TC-NTF-02)',
  { skip: !process.env.MONGO_TEST_URI, timeout: 30000 },
  () => {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    let category;
    let users = [];
    let events = [];
    let registrations = [];
    let jobs = [];

    before(async () => {
      const uri = process.env.MONGO_TEST_URI;
      if (!new URL(uri).pathname.startsWith('/ems_test_')) {
        throw new Error('MONGO_TEST_URI must point to a dedicated ems_test_* database');
      }
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
      await Promise.all([
        User.init(), Category.init(), Event.init(), Registration.init(),
        NotificationJob.init(), NotificationLog.init(),
      ]);
    });

    beforeEach(async () => {
      category = await Category.create({ name: `Reminder Test ${suffix}`, active: true });
      users = await User.create([
        { name: 'Confirmed One', email: `confirmed-one-${suffix}@test.local`, passwordHash: 'not-a-real-password' },
        { name: 'Confirmed Two', email: `confirmed-two-${suffix}@test.local`, passwordHash: 'not-a-real-password' },
        { name: 'Waitlisted', email: `waitlisted-${suffix}@test.local`, passwordHash: 'not-a-real-password' },
        { name: 'Cancelled', email: `cancelled-${suffix}@test.local`, passwordHash: 'not-a-real-password' },
      ]);
      events = [];
      registrations = [];
      jobs = [];
    });

    afterEach(async () => {
      if (jobs.length) {
        await NotificationLog.deleteMany({ jobId: { $in: jobs } });
        await NotificationJob.deleteMany({ _id: { $in: jobs } });
      }
      if (registrations.length) await Registration.deleteMany({ _id: { $in: registrations } });
      if (events.length) await Event.deleteMany({ _id: { $in: events } });
      if (users.length) await User.deleteMany({ _id: { $in: users.map(user => user._id) } });
      if (category) await Category.deleteOne({ _id: category._id });
    });

    after(async () => {
      await mongoose.disconnect();
    });

    async function makeEvent(startAt, title) {
      const event = await Event.create({
        title,
        description: 'Synthetic reminder integration test',
        categoryId: category._id,
        organizerId: users[0]._id,
        venue: 'Test Hall',
        startAt,
        endAt: new Date(startAt.getTime() + 60 * 60 * 1000),
        registrationDeadline: new Date(startAt.getTime() - 60 * 60 * 1000),
        capacity: 20,
        status: 'Published',
      });
      events.push(event);
      return event;
    }

    async function makeRegistration(event, user, status, code) {
      const registration = await Registration.create({
        eventId: event._id,
        userId: user._id,
        regCode: `REM-${suffix}-${code}`,
        status,
      });
      registrations.push(registration);
      return registration;
    }

    it('creates exactly one persisted job per Confirmed attendee across repeated and concurrent runs', async () => {
      const now = new Date();
      const event = await makeEvent(new Date(now.getTime() + DAY_MS - 10 * 60 * 1000), 'Catch-up Event');
      await makeRegistration(event, users[0], 'Confirmed', 'C1');
      await makeRegistration(event, users[1], 'Confirmed', 'C2');
      await makeRegistration(event, users[2], 'Waitlisted', 'W1');
      await makeRegistration(event, users[3], 'Cancelled', 'X1');

      // Two simultaneous scheduler processes plus a subsequent restart/run.
      await Promise.all([
        runReminderScheduler({ now }),
        runReminderScheduler({ now }),
      ]);
      await runReminderScheduler({ now: new Date(now.getTime() + 60 * 1000) });

      const storedJobs = await NotificationJob.find({
        type: 'EVENT_REMINDER',
        'payload.eventId': String(event._id),
      }).sort({ recipient: 1 });
      jobs = storedJobs.map(job => job._id);

      assert.equal(storedJobs.length, 2, 'only the two Confirmed attendees should have jobs');
      assert.deepEqual(
        storedJobs.map(job => job.recipient).sort(),
        [users[0].email, users[1].email].sort(),
      );
      assert.equal(new Set(storedJobs.map(job => job.payload.idempotencyKey)).size, 2);
      for (const user of users.slice(2)) {
        assert.equal(storedJobs.some(job => job.recipient === user.email), false);
      }
      for (const user of users.slice(0, 2)) {
        assert.equal(
          await NotificationJob.countDocuments({
            type: 'EVENT_REMINDER',
            recipient: user.email,
            'payload.eventId': String(event._id),
          }),
          1,
          `expected one reminder job for ${user.email}`,
        );
      }
    });

    it('catches up within ±15 minutes but excludes events outside the permitted window', async () => {
      const now = new Date();
      const catchUp = await makeEvent(
        new Date(now.getTime() + DAY_MS - REMINDER_TOLERANCE_MS + 60 * 1000),
        'Within Tolerance',
      );
      const tooEarly = await makeEvent(
        new Date(now.getTime() + DAY_MS + REMINDER_TOLERANCE_MS + 60 * 1000),
        'Outside Early Boundary',
      );
      const tooLate = await makeEvent(
        new Date(now.getTime() + DAY_MS - REMINDER_TOLERANCE_MS - 60 * 1000),
        'Outside Late Boundary',
      );
      await makeRegistration(catchUp, users[0], 'Confirmed', 'IN');
      await makeRegistration(tooEarly, users[1], 'Confirmed', 'EARLY');
      await makeRegistration(tooLate, users[2], 'Confirmed', 'LATE');

      await runReminderScheduler({ now });

      const storedJobs = await NotificationJob.find({
        type: 'EVENT_REMINDER',
        'payload.eventId': { $in: events.map(event => String(event._id)) },
      });
      jobs = storedJobs.map(job => job._id);
      assert.equal(storedJobs.length, 1);
      assert.equal(storedJobs[0].payload.eventId, String(catchUp._id));
    });

    it('worker eligibility rejects delivery outside the same timing window', async () => {
      const now = new Date();
      const event = await makeEvent(new Date(now.getTime() + DAY_MS), 'Eligibility Event');
      const registration = await makeRegistration(event, users[0], 'Confirmed', 'ELIGIBLE');

      const jobFor = scheduledStartAt => ({
        type: 'EVENT_REMINDER',
        payload: {
          eventId: String(event._id),
          registrationId: String(registration._id),
          scheduledStartAt: new Date(scheduledStartAt).toISOString(),
        },
      });

      for (const delta of [DAY_MS - REMINDER_TOLERANCE_MS, DAY_MS, DAY_MS + REMINDER_TOLERANCE_MS]) {
        const startAt = new Date(now.getTime() + delta);
        await Event.updateOne({ _id: event._id }, { $set: { startAt } });
        assert.equal(await reminderIsEligible(jobFor(startAt), now), true);
      }
      for (const delta of [DAY_MS - REMINDER_TOLERANCE_MS - 1, DAY_MS + REMINDER_TOLERANCE_MS + 1]) {
        const startAt = new Date(now.getTime() + delta);
        await Event.updateOne({ _id: event._id }, { $set: { startAt } });
        assert.equal(await reminderIsEligible(jobFor(startAt), now), false);
      }
    });
  },
);
