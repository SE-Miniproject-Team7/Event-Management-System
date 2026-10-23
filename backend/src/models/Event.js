const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  organizerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  venue: { type: String, required: true },
  startAt: { type: Date, required: true },
  endAt: { type: Date, required: true },
  registrationDeadline: { type: Date, required: true },
  capacity: { type: Number, required: true, min: 1, max: 10000 },
  seatsTaken: { type: Number, default: 0 },
  status: { type: String, enum: ['Pending Approval', 'Published', 'Rejected', 'Cancelled'], default: 'Pending Approval' },
  rejectionReason: { type: String },
}, { timestamps: true });

eventSchema.index({ status: 1, startAt: 1 });

module.exports = mongoose.model('Event', eventSchema);
