
const {
  describe,
  it,
  before,
  after,
  beforeEach,
  afterEach,
} = require('node:test');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');

const NotificationJob = require('../src/models/NotificationJob');
const NotificationLog = require('../src/models/NotificationLog');
const {
  enqueueNotification,
} = require('../src/modules/notifications/notification.service');

describe(
  'Notifications with real MongoDB',
  { skip: !process.env.MONGO_TEST_URI, timeout: 30000 },
  () => {
    let idempotencyKey;
    let createdJobIds = [];

    before(async () => {
      const uri = process.env.MONGO_TEST_URI;

      if (!new URL(uri).pathname.startsWith('/ems_test_')) {
        throw new Error(
          'MONGO_TEST_URI must point to a dedicated ems_test_* database'
        );
      }

      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
      });

      await NotificationJob.init();
      await NotificationLog.init();
    });

    beforeEach(() => {
      idempotencyKey = `notification-test:${randomUUID()}`;
      createdJobIds = [];
    });

    afterEach(async () => {
      if (createdJobIds.length > 0) {
        await NotificationLog.deleteMany({
          jobId: { $in: createdJobIds },
        });

        await NotificationJob.deleteMany({
          _id: { $in: createdJobIds },
        });
      }
    });

    after(async () => {
      await mongoose.disconnect();
    });

    it('persists a new confirmation notification as Pending', async () => {
      const job = await enqueueNotification({
        type: 'REGISTRATION_CONFIRMATION',
        recipient: 'Attendee@Test.Local',
        subject: 'Registration confirmed',
        payload: {
          idempotencyKey,
          attendeeName: 'Test Attendee',
          eventTitle: 'Integration Test Event',
          regCode: 'EMS-TEST-001',
        },
      });

      createdJobIds.push(job._id);

      const storedJob = await NotificationJob.findById(job._id);

      assert.ok(storedJob);
      assert.equal(storedJob.status, 'Pending');
      assert.equal(storedJob.attempts, 0);
      assert.equal(storedJob.maxAttempts, 4);
      assert.equal(storedJob.recipient, 'attendee@test.local');
      assert.equal(
        storedJob.payload.idempotencyKey,
        idempotencyKey
      );
    });

    it('returns the existing job for a duplicate idempotency key', async () => {
      const input = {
        type: 'REGISTRATION_CONFIRMATION',
        recipient: 'attendee@test.local',
        subject: 'Registration confirmed',
        payload: {
          idempotencyKey,
          attendeeName: 'Test Attendee',
          eventTitle: 'Integration Test Event',
          regCode: 'EMS-TEST-002',
        },
      };

      const firstJob = await enqueueNotification(input);
      createdJobIds.push(firstJob._id);

      const duplicateJob = await enqueueNotification(input);

      assert.equal(
        String(duplicateJob._id),
        String(firstJob._id)
      );

      const matchingJobs = await NotificationJob.countDocuments({
        type: input.type,
        'payload.idempotencyKey': idempotencyKey,
      });

      assert.equal(matchingJobs, 1);
    });

    it('persists delivery attempt logs against a notification job', async () => {
      const job = await enqueueNotification({
        type: 'REGISTRATION_CONFIRMATION',
        recipient: 'attendee@test.local',
        subject: 'Registration confirmed',
        payload: {
          idempotencyKey,
          attendeeName: 'Test Attendee',
          eventTitle: 'Integration Test Event',
          regCode: 'EMS-TEST-003',
        },
      });

      createdJobIds.push(job._id);

      await NotificationLog.create({
        jobId: job._id,
        recipient: job.recipient,
        type: job.type,
        attempt: 1,
        status: 'Failed',
        error: 'Email delivery failed',
      });

      await NotificationLog.create({
        jobId: job._id,
        recipient: job.recipient,
        type: job.type,
        attempt: 2,
        status: 'Sent',
      });

      const logs = await NotificationLog.find({
        jobId: job._id,
      }).sort({ attempt: 1 });

      assert.equal(logs.length, 2);
      assert.equal(logs[0].attempt, 1);
      assert.equal(logs[0].status, 'Failed');
      assert.equal(logs[1].attempt, 2);
      assert.equal(logs[1].status, 'Sent');
    });
  }
);
