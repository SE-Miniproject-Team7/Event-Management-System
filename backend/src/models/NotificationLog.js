
const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NotificationJob',
    required: true,
    index: true,
  },
  recipient: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
  },
  attempt: {
    type: Number,
    required: true,
    min: 1,
  },
  status: {
    type: String,
    enum: ['Sent', 'Failed', 'Skipped'],
    required: true,
  },
  error: {
    type: String,
    maxlength: 1000,
    default: null,
  },
  attemptedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

notificationLogSchema.index({ jobId: 1, attemptedAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);
