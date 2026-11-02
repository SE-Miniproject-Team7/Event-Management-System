const router = require('express').Router();
const User = require('../../models/User');
const AppError = require('../../utils/AppError');
const asyncHandler = require('../../utils/asyncHandler');
const { authenticate } = require('../../middleware/auth');

router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { name, phone } = req.body || {};

  if (name === undefined && phone === undefined) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide a name or phone to update');
  }

  const updates = {};

  if (name !== undefined) {
    if (typeof name !== 'string') {
      throw new AppError(422, 'VALIDATION_ERROR', 'Name must be a string');
    }

    const trimmedName = name.trim();

    if (trimmedName.length < 3 || trimmedName.length > 60) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Name must be between 3 and 60 characters');
    }

    updates.name = trimmedName;
  }

  if (phone !== undefined) {
    if (typeof phone !== 'string' || !/^[0-9]{10}$/.test(phone)) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Phone must contain exactly 10 digits');
    }

    updates.phone = phone;
  }

  Object.assign(req.user, updates);
  await req.user.save();

  res.status(200).json({
    user: {
      id: req.user._id.toString(),
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || '',
      role: req.user.role,
    },
  });
}));

module.exports = router;
