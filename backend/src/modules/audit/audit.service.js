const { isIP } = require('node:net');
const mongoose = require('mongoose');
const AuditLog = require('../../models/AuditLog');
const AppError = require('../../utils/AppError');
const actions = require('./actions');
const objectId = value => value && mongoose.isValidObjectId(value) ? value : null;
async function recordAudit(req, action, options = {}) {
  if (!actions.includes(action)) throw new TypeError('Unsupported audit action');
  // Only explicit fields: never serialize requests, bodies, headers or errors.
  const entry = {
    userId: objectId(options.userId === undefined ? req.user?._id : options.userId),
    action,
    ip: typeof req.ip === 'string' && isIP(req.ip) ? req.ip : 'unknown',
    timestamp: new Date(),
    targetId: objectId(options.targetId),
  };
  if (['User', 'Event', 'Registration'].includes(options.targetType)) entry.targetType = options.targetType;
  try {
    await AuditLog.create([entry], { session: options.session });
  } catch (error) {
    // Keep MongoDB's retry signal so a transaction can roll back and retry.
    if (options.session && error.hasErrorLabel?.('TransientTransactionError')) throw error;
    throw new AppError(503, 'AUDIT_UNAVAILABLE', 'Security logging is temporarily unavailable. Please try again.');
  }
}
// The attendance endpoint calls this once inside its successful transaction.
function recordCheckIn(req, registration, session) {
  if (registration.status !== 'Checked-in' || !registration.checkedInAt) {
    throw new TypeError('Only completed check-ins can be audited');
  }
  return recordAudit(req, 'CHECK_IN', {
    targetId: registration._id, targetType: 'Registration', session,
  });
}
module.exports = { recordAudit, recordCheckIn };
