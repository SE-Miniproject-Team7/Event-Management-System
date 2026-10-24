
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { setAuthCookie } = require('../../utils/token');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 12 * 60 * 1000;

function createAccountLockedError() {
  const error = new AppError(
    423,
    'ACCOUNT_LOCKED',
    'Try again in 12 minutes'
  );
  error.retryAfterSeconds = 720;
  return error;
}

router.post('/login', asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  const password = typeof req.body?.password === 'string'
    ? req.body.password
    : '';

  if (!email || !password) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  // Reject accounts that are currently locked.
  if (user.lockUntil && user.lockUntil > new Date()) {
    throw createAccountLockedError();
  }

  // Reset an expired lock before checking credentials again.
  if (user.lockUntil && user.lockUntil <= new Date()) {
    user.failedLogins = 0;
    user.lockUntil = null;
  }

  const validPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!validPassword) {
    user.failedLogins = (user.failedLogins || 0) + 1;

    if (user.failedLogins >= MAX_FAILED_ATTEMPTS) {
      user.failedLogins = 0;
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await user.save();

    if (user.lockUntil) {
      throw createAccountLockedError();
    }

    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  // Do not allow inactive users to log in.
  if (!user.active) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  // Successful login resets the failed-attempt counter.
  user.failedLogins = 0;
  user.lockUntil = null;
  await user.save();

  setAuthCookie(res, user);

  res.status(200).json({
    user: {
      id: user._id.toString(),
      name: user.name,
      role: user.role,
    },
  });
}));

module.exports = router;
