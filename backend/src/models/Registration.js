const mongoose = require('mongoose');

const regSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  regCode: { type: String, required: true, unique: true },
  status: { type: String, enum: ['Confirmed', 'Waitlisted', 'Cancelled', 'Checked-in'], required: true },
  waitlistPosition: { type: Number, default: null },
  checkedInAt: { type: Date, default: null },
}, { timestamps: true });

// Bounds the 30-day platform summary scan.
regSchema.index({ createdAt: 1 });

regSchema.index(
  { eventId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['Confirmed', 'Waitlisted', 'Checked-in'] } } }
);

module.exports = mongoose.model('Registration', regSchema);
