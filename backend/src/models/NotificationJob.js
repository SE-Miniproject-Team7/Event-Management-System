
const mongoose = require('mongoose');

const notificationJobSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'REGISTRATION_CONFIRMATION',
      'WAITLIST_PROMOTION',
      'EVENT_CANCELLATION',
    ],
  },
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Sent', 'Failed'],
    default: 'Pending',
    index: true,
  },
  attempts: {
    type: Number,
    default: 0,
    min: 0,
  },
  maxAttempts: {
    type: Number,
    default: 4,
    min: 1,
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  lockedAt: {
    type: Date,
    default: null,
  },
  lastError: {
    type: String,
    maxlength: 1000,
    default: null,
  },
  sentAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

notificationJobSchema.index({
  status: 1,
  nextAttemptAt: 1,
});

notificationJobSchema.index(
  { type: 1, 'payload.idempotencyKey': 1 },
  {
    unique: true,
    partialFilterExpression: {
      'payload.idempotencyKey': { $type: 'string' },
    },
  },
);

module.exports = mongoose.model('NotificationJob', notificationJobSchema);
