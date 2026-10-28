
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../../utils/token');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

// Return only public account details.
function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    role: user.role,
  };
}

// Validate registration input.
function validateRegistration({ name, email, phone, password }) {
  const fields = [];

  if (name.length < 3 || name.length > 60) {
    fields.push({ field: 'name', message: 'Name must be between 3 and 60 characters.' });
  }

  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fields.push({ field: 'email', message: 'Enter a valid email address of at most 100 characters.' });
  }

  if (password.length < 8 || password.length > 64 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    fields.push({ field: 'password', message: 'Password must be 8 to 64 characters and include a letter and a digit.' });
  }

  if (typeof phone !== 'string' || (phone !== '' && !/^[0-9]{10}$/.test(phone))) {
    fields.push({ field: 'phone', message: 'Phone number must contain exactly 10 digits.' });
  }

  if (fields.length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Please check your details.', fields);
  }
}

// Register a new attendee.
router.post('/register', asyncHandler(async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Request body must be a JSON object.');
  }

  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim()
    : '';

  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  const phone = typeof req.body?.phone === 'string'
    ? req.body.phone.trim()
    : req.body.phone === undefined ? '' : req.body.phone;

  const password = typeof req.body?.password === 'string'
    ? req.body.password
    : '';

  validateRegistration({ name, email, phone, password });

  const existingUser = await User.findOne({ email });

  if (existingUser) {
    throw new AppError(
      409,
      'EMAIL_ALREADY_EXISTS',
      'An account with this email already exists.'
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: 'Attendee',
      active: true,
      failedLogins: 0,
      lockUntil: null,
    });

    return res.status(201).json(publicUser(user));
  } catch (error) {
    // Handle simultaneous registrations with the same email.
    if (error.code === 11000) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email already exists.'
      );
    }

    throw error;
  }
}));

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

// Log in an existing user.
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

  if (user.lockUntil && user.lockUntil > new Date()) {
    throw createAccountLockedError(user.lockUntil);
  }

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
      throw createAccountLockedError(user.lockUntil);
    }

    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  if (!user.active) {
    throw new AppError(
      401,
      'INVALID_CREDENTIALS',
      'Email or password is incorrect'
    );
  }

  user.failedLogins = 0;
  user.lockUntil = null;
  await user.save();

  setAuthCookie(res, user);

  return res.status(200).json({
    user: publicUser(user),
  });
}));

// Return the currently authenticated user's public details.
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    user: publicUser(req.user),
  });
});

// Log out by clearing the authentication cookie.
router.post('/logout', (req, res) => {
  clearAuthCookie(res);

  res.status(200).json({
    message: 'Logged out successfully',
  });
});

module.exports = router;
