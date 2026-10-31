const User = require('../../models/User');
const AppError = require('../../utils/AppError');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function accountLockedError(lockUntil) {
  const retryAfterSeconds = Math.max(1, Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 1000));
  const minutes = Math.ceil(retryAfterSeconds / 60);
  const error = new AppError(423, 'ACCOUNT_LOCKED', `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`);
  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function checkLock(user) {
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw accountLockedError(user.lockUntil);
  }
}

// Compare-and-set prevents concurrent attempts from overwriting each other's
// counters, or a successful login from clearing a lock established meanwhile.
async function recordLoginAttempt(user, validPassword) {
  const passwordHash = user.passwordHash;

  while (user && user.active && user.passwordHash === passwordHash) {
    checkLock(user);
    const now = new Date();
    const expiredLock = user.lockUntil && user.lockUntil <= now;
    const failures = validPassword ? 0 : (expiredLock ? 0 : user.failedLogins || 0) + 1;
    const locked = failures >= MAX_FAILED_ATTEMPTS;

    const updated = await User.findOneAndUpdate(
      {
        _id: user._id,
        active: true,
        passwordHash,
        $expr: { $eq: [{ $ifNull: ['$failedLogins', 0] }, user.failedLogins || 0] },
        lockUntil: user.lockUntil || null,
      },
      { $set: {
        failedLogins: locked ? 0 : failures,
        lockUntil: locked ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
      } },
      { returnDocument: 'after' }
    );

    if (updated) {
      if (locked) throw accountLockedError(updated.lockUntil);
      return updated;
    }

    // Another attempt, account deactivation or password change won the update.
    // Reload before deciding whether this attempt may proceed.
    user = await User.findById(user._id);
  }

  throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
}

module.exports = { checkLock, recordLoginAttempt };
