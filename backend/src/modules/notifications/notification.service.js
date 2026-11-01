const NotificationJob = require('../../models/NotificationJob');

const ALLOWED_TYPES = [
  'REGISTRATION_CONFIRMATION',
  'WAITLIST_PROMOTION',
  'EVENT_CANCELLATION',
];

async function enqueueNotification({
  type,
  recipient,
  subject,
  payload = {},
}) {
  if (!ALLOWED_TYPES.includes(type)) {
    throw new TypeError('Unsupported notification type');
  }

  if (typeof recipient !== 'string' || !recipient.trim()) {
    throw new TypeError('A notification recipient is required');
  }

  if (typeof subject !== 'string' || !subject.trim()) {
    throw new TypeError('A notification subject is required');
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Notification payload must be an object');
  }

  const idempotencyKey = payload.idempotencyKey;

  if (typeof idempotencyKey !== 'string' || !idempotencyKey.trim()) {
    throw new TypeError('A notification idempotency key is required');
  }

  try {
    return await NotificationJob.create({
      type,
      recipient: recipient.trim().toLowerCase(),
      subject: subject.trim(),
      payload,
      status: 'Pending',
      attempts: 0,
      maxAttempts: 4,
      nextAttemptAt: new Date(),
    });
  } catch (error) {
    if (error.code === 11000) {
      const existingJob = await NotificationJob.findOne({
        type,
        'payload.idempotencyKey': idempotencyKey,
      });

      if (existingJob) return existingJob;

      throw new Error('Duplicate notification could not be recovered');
    }

    throw error;
  }
}

module.exports = {
  enqueueNotification,
};