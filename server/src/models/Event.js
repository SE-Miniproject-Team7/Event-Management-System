import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  type: { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, required: true, maxlength: 5000 },
  eligibility: { type: String, default: 'All eligible attendees', maxlength: 500 },
  inCharge: { type: String, required: true, maxlength: 160 },
  date: { type: Date, required: true },
  venue: { type: String, required: true, maxlength: 200 },
  capacity: { type: Number, required: true, min: 1, max: 10000 },
  registrationDeadline: { type: Date, required: true },
  status: { type: String, enum: ['Pending Approval', 'Published', 'Rejected', 'Cancelled'], default: 'Pending Approval' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

export default mongoose.model('Event', eventSchema);
