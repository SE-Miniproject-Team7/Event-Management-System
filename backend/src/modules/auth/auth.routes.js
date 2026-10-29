
const router = require('express').Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');
const { setAuthCookie, clearAuthCookie } = require('../../utils/token');

const { checkLock, recordLoginAttempt } = require('./lockout');

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
  const fields = {};

  if (!name || name.length > 100) {
    fields.name = 'Name is required and must be at most 100 characters.';
  }

  if (
    !email ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    fields.email = 'Enter a valid email address.';
  }

  if (password.length < 8 || password.length > 128) {
    fields.password = 'Password must be between 8 and 128 characters.';
  }

  if (phone && phone.length > 30) {
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
}

// Register a new attendee.
router.post('/register', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string'
    ? req.body.name.trim()
    : '';

  const email = typeof req.body?.email === 'string'
    ? req.body.email.trim().toLowerCase()
    : '';

  const phone = typeof req.body?.phone === 'string'
    ? req.body.phone.trim()
    : '';

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

    return res.status(201).json({
      message: 'Account created successfully. You can now sign in.',
      user: publicUser(user),
    });
  } catch (error) {
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

  let user = await User.findOne({ email });

  if (!user || !user.active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

  checkLock(user);

  const validPassword = await bcrypt.compare(
    password,
    user.passwordHash
  );

  user = await recordLoginAttempt(user, validPassword);

  if (!validPassword) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  }

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
