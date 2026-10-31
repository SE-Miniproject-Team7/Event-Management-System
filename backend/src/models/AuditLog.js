const mongoose = require('mongoose');
const actions = require('../modules/audit/actions');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, default: null },
  action: { type: String, enum: actions, required: true },
  ip: { type: String, required: true, maxlength: 45 },
  timestamp: { type: Date, required: true, default: Date.now },
  targetId: { type: mongoose.Schema.Types.ObjectId, default: null },
  targetType: { type: String, enum: ['User', 'Event', 'Registration'], default: undefined },
}, { strict: 'throw', versionKey: false });
// Expiry is enforced asynchronously by MongoDB's TTL monitor.
schema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
module.exports = mongoose.model('AuditLog', schema);
