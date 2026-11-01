const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const { enqueueNotification } = require('../notifications/notification.service');

const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');
const invalidToken = () => new AppError(400, 'TOKEN_INVALID', 'Reset link is invalid or expired. Request a new link.');

async function requestReset(email) {
  const origin = new URL(process.env.CLIENT_ORIGIN || 'http://localhost:5173');
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password ||
      (process.env.NODE_ENV === 'production' && origin.protocol !== 'https:')) {
    throw new Error('Invalid client origin configuration');
  }
  const token = crypto.randomBytes(32).toString('hex');
  await mongoose.connection.transaction(async session => {
    const user = await User.findOneAndUpdate({ email, active: true }, { $set: {
      resetTokenHash: hashToken(token), resetTokenExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    } }, { new: true, session });
    if (!user) return;
    // The fragment keeps the bearer secret out of HTTP paths and access logs.
    const url = new URL('/reset-password', origin);
    url.hash = token;
    await enqueueNotification({ type: 'PASSWORD_RESET', recipient: user.email,
      subject: 'Reset your EMS password', payload: {
        idempotencyKey: `reset:${hashToken(token)}`, resetUrl: url.href,
      }, session });
  });
}

async function resetPassword(token, password) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw invalidToken();
  if (typeof password !== 'string' || password.length < 8 || password.length > 64 ||
      !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Password must be 8 to 64 characters and include a letter and a digit.');
  }
  const passwordHash = await bcrypt.hash(password, 12);
  // One conditional write consumes the token and replaces the password together.
  const user = await User.findOneAndUpdate({ active: true, resetTokenHash: hashToken(token),
    resetTokenExpiresAt: { $gt: new Date() } }, {
    $set: { passwordHash, failedLogins: 0, lockUntil: null },
    $unset: { resetTokenHash: '', resetTokenExpiresAt: '' },
  });
  if (!user) throw invalidToken();
}
module.exports = { requestReset, resetPassword, hashToken };
