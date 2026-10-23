const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  phone: { type: String },
  role: { type: String, enum: ['Attendee', 'Organizer', 'Admin'], default: 'Attendee' },
  active: { type: Boolean, default: true },
  failedLogins: { type: Number, default: 0 },
  lockUntil: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
