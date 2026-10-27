
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../../utils/token');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function createAccountLockedError(lockUntil) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((new Date(lockUntil).getTime() - Date.now()) / 1000)
  );
  const minutes = Math.ceil(retryAfterSeconds / 60);

  const error = new AppError(
    423,
    'ACCOUNT_LOCKED',
    `Try again in ${minutes} minute${minutes === 1 ? '' : 's'}`
  );

  error.retryAfterSeconds = retryAfterSeconds;
  return error;
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
  };
}

// Register a new attendee account.
router.post('/register', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim()
    : '';

  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  const password = typeof req.body?.password === 'string'
    ? req.body.password
    : '';

  const phone = typeof req.body?.phone === 'string'
    ? req.body.phone.trim()
    : '';

  const fields = {};

  if (!name || name.length > 100) {
    fields.name = 'Name is required and must be at most 100 characters.';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.email = 'Enter a valid email address.';
  }

  if (password.length < 8 || password.length > 128) {
    fields.password = 'Password must be between 8 and 128 characters.';
  }

  if (phone.length > 30) {
    fields.phone = 'Phone number must be at most 30 characters.';
  }

  if (Object.keys(fields).length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Please check your details.',
      fields
    );
  }

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError(
      409,
      'EMAIL_ALREADY_EXISTS',
      'An account with this email already exists.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const userData = {
    name,
    email,
    passwordHash,
    role: 'Attendee',
  };

  if (phone) {
    userData.phone = phone;
  }

  const newUser = new User(userData);

  try {
    await newUser.save();
  } catch (error) {
    // Protect against simultaneous registrations with the same email.
    if (error.code === 11000) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.'
      );
    }

    throw error;
  }

  res.status(201).json({
    message: 'Account created successfully. You can now sign in.',
    user: publicUser(newUser),
  });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';
  const password = typeof req.body?.password === 'string'
    ? req.body.password
    : '';

  if (!email || !password) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw createAccountLockedError(user.lockUntil);
  }

  if (user.lockUntil && user.lockUntil <= new Date()) {
    user.failedLogins = 0;
    user.lockUntil = null;
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    user.failedLogins = (user.failedLogins || 0) + 1;

    if (user.failedLogins >= MAX_FAILED_ATTEMPTS) {
      user.failedLogins = 0;
      user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
    }

    await user.save();

    if (user.lockUntil) {
      throw createAccountLockedError(user.lockUntil);
    }

    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  if (!user.active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  user.failedLogins = 0;
  user.lockUntil = null;
  await user.save();

  setAuthCookie(res, user);
  res.status(200).json({ user: publicUser(user) });
}));

// Return the currently authenticated user's public details.
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({ user: publicUser(req.user) });
});

// Clear the authentication cookie to log out.
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
