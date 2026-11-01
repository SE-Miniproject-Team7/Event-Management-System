
const cron = require('node-cron');
const mongoose = require('mongoose');
const NotificationJob = require('../../models/NotificationJob');
const NotificationLog = require('../../models/NotificationLog');
const { sendEmail } = require('./email.transport');

const RETRY_INTERVAL_MINUTES = Math.max(
  1,
  Number(process.env.NOTIFICATION_RETRY_INTERVAL_MINUTES) || 1
);

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;
const BATCH_SIZE = 10;

let task = null;
let processing = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function buildEmail(job) {
  const payload = job.payload || {};

  if (job.type === 'REGISTRATION_CONFIRMATION') {
    const name = payload.attendeeName || 'Attendee';
    const event = payload.eventTitle || 'your event';
    const code = payload.regCode || '';

    return {
      subject: job.subject,
      text: `Hello ${name},

Your registration for ${event} is confirmed.
Registration code: ${code}

Thank you.`,
      html: `<p>Hello ${escapeHtml(name)},</p>
        <p>Your registration for <strong>${escapeHtml(event)}</strong> is confirmed.</p>
        <p>Registration code: <strong>${escapeHtml(code)}</strong></p>
        <p>Thank you.</p>`,
    };
  }

  if (job.type === 'EVENT_CANCELLATION') {
    const name = payload.attendeeName || 'Attendee';
    const event = payload.eventTitle || 'your event';
    const venue = payload.venue || 'the previously announced venue';
    return {
      subject: job.subject,
      text: `Hello ${name},

The event "${event}" has been cancelled by the organizer.
Venue: ${venue}

Your registration has also been cancelled. We apologize for the inconvenience.`,
      html: `<p>Hello ${escapeHtml(name)},</p>
        <p>The event <strong>${escapeHtml(event)}</strong> has been cancelled by the organizer.</p>
        <p>Venue: ${escapeHtml(venue)}</p>
        <p>Your registration has also been cancelled. We apologize for the inconvenience.</p>`,
    };
  }

  if (job.type === 'EVENT_UPDATED') {
    const name = payload.attendeeName || 'Attendee';
    const event = payload.eventTitle || 'your event';
    const venue = payload.venue || 'not specified';
    const startAt = payload.startAt || 'not specified';
    const approvalNote = payload.awaitingApproval
      ? '\nThe event is awaiting administrator re-approval before it is published again.'
      : '';
    const approvalHtml = payload.awaitingApproval
      ? '<p>The event is awaiting administrator re-approval before it is published again.</p>'
      : '';
    return {
      subject: job.subject,
      text: `Hello ${name},

The details for "${event}" have changed.
Venue: ${venue}
Start time: ${startAt}

Please review the updated event details before attending.${approvalNote}`,
      html: `<p>Hello ${escapeHtml(name)},</p>
        <p>The details for <strong>${escapeHtml(event)}</strong> have changed.</p>
        <p>Venue: ${escapeHtml(venue)}<br>Start time: ${escapeHtml(startAt)}</p>
        <p>Please review the updated event details before attending.</p>${approvalHtml}`,
    };
  }

  if (job.type === 'EVENT_APPROVED') {
    const name = payload.organizerName || 'Organizer';
    const event = payload.eventTitle || 'your event';
    return {
      subject: job.subject,
      text: `Hello ${name},

Your event "${event}" has been approved and is now published.`,
      html: `<p>Hello ${escapeHtml(name)},</p>
        <p>Your event <strong>${escapeHtml(event)}</strong> has been approved and is now published.</p>`,
    };
  }

  if (job.type === 'EVENT_REJECTED') {
    const name = payload.organizerName || 'Organizer';
    const event = payload.eventTitle || 'your event';
    const reason = payload.rejectionReason || 'No reason provided';
    return {
      subject: job.subject,
      text: `Hello ${name},

Your event "${event}" was not approved.
Reason: ${reason}

Please review the feedback and update your submission if needed.`,
      html: `<p>Hello ${escapeHtml(name)},</p>
        <p>Your event <strong>${escapeHtml(event)}</strong> was not approved.</p>
        <p>Reason: ${escapeHtml(reason)}</p>
        <p>Please review the feedback and update your submission if needed.</p>`,
    };
  }

  throw new Error('Unsupported notification template');
}

async function recoverExhaustedJobs() {
  const staleBefore = new Date(Date.now() - LOCK_TIMEOUT_MS);

  const exhaustedJobs = await NotificationJob.find({
    status: 'Processing',
    lockedAt: { $lte: staleBefore },
    $expr: { $gte: ['$attempts', '$maxAttempts'] },
  }).select('_id recipient type attempts');

  for (const job of exhaustedJobs) {
    await NotificationLog.create({
      jobId: job._id,
      recipient: job.recipient,
      type: job.type,
      attempt: job.attempts,
      status: 'Failed',
      error: 'Worker interrupted during final attempt',
    });

    await NotificationJob.updateOne(
      {
        _id: job._id,
        status: 'Processing',
        attempts: job.attempts,
        lockedAt: { $lte: staleBefore },
      },
      {
        $set: {
          status: 'Failed',
          lockedAt: null,
          lastError: 'Worker interrupted during final attempt',
        },
      }
    );
  }
}

async function claimJob() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);

  return NotificationJob.findOneAndUpdate(
    {
      $or: [
        {
          status: 'Pending',
          $expr: { $lt: ['$attempts', '$maxAttempts'] },
          nextAttemptAt: { $lte: now },
        },
        {
          status: 'Processing',
          lockedAt: { $lte: staleBefore },
          $expr: { $lt: ['$attempts', '$maxAttempts'] },
        },
      ],
    },
    {
      $set: {
        status: 'Processing',
        lockedAt: now,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { nextAttemptAt: 1, createdAt: 1 },
      new: true,
    }
  );
}

async function processJob(job) {
  const attempt = job.attempts;

  try {
    const email = buildEmail(job);

    await sendEmail({
      to: job.recipient,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } catch {
    const failedPermanently = attempt >= job.maxAttempts;
    const safeError = 'Email delivery failed';

    await NotificationLog.create({
      jobId: job._id,
      recipient: job.recipient,
      type: job.type,
      attempt,
      status: 'Failed',
      error: safeError,
    });

    await NotificationJob.updateOne(
      { _id: job._id, status: 'Processing' },
      {
        $set: {
          status: failedPermanently ? 'Failed' : 'Pending',
          nextAttemptAt: new Date(
            Date.now() + RETRY_INTERVAL_MINUTES * 60 * 1000
          ),
          lockedAt: null,
          lastError: safeError,
        },
      }
    );

    console.error(JSON.stringify({
      level: 'error',
      event: 'notification_delivery_failed',
      attempt,
      final: failedPermanently,
    }));

    return;
  }

  await NotificationLog.create({
    jobId: job._id,
    recipient: job.recipient,
    type: job.type,
    attempt,
    status: 'Sent',
  });

  await NotificationJob.updateOne(
    { _id: job._id, status: 'Processing' },
    {
      $set: {
        status: 'Sent',
        sentAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    }
  );
}

async function processDueNotifications() {
  if (processing || mongoose.connection.readyState !== 1) return;

  processing = true;

  try {
    await recoverExhaustedJobs();

    for (let count = 0; count < BATCH_SIZE; count += 1) {
      const job = await claimJob();

      if (!job) break;

      try {
        await processJob(job);
      } catch {
        console.error(JSON.stringify({
          level: 'error',
          event: 'notification_job_processing_failed',
        }));
      }
    }
  } catch {
    console.error(JSON.stringify({
      level: 'error',
      event: 'notification_worker_failed',
    }));
  } finally {
    processing = false;
  }
}

function startNotificationWorker() {
  if (process.env.NOTIFICATION_WORKER_ENABLED !== 'true') {
    console.log('Notification worker disabled');
    return;
  }

  if (task) return;

  task = cron.schedule('* * * * *', processDueNotifications);

  void processDueNotifications();

  console.log('Notification worker started');
}

function stopNotificationWorker() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = {
  processDueNotifications,
  recoverExhaustedJobs,
  startNotificationWorker,
  stopNotificationWorker,
};
