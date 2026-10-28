const router = require('express').Router();
const mongoose = require('mongoose');
const Category = require('../../models/Category');
const User = require('../../models/User');
const { authenticate, requireRole } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

router.use(authenticate, requireRole('Admin'));

// Manage account activity and roles (EMS-F-031 / TC-ADM-01).
router.patch('/users/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }

  const fields = [];
  const changes = {};
  for (const field of Object.keys(body)) {
    if (field !== 'active' && field !== 'role') {
      fields.push({ field, message: 'Only active and role can be updated' });
    }
  }
  if (!Object.hasOwn(body, 'active') && !Object.hasOwn(body, 'role')) {
    fields.push({ field: 'body', message: 'Provide active or role to update' });
  }
  if (Object.hasOwn(body, 'active')) {
    if (typeof body.active !== 'boolean') {
      fields.push({ field: 'active', message: 'active must be true or false' });
    } else {
      changes.active = body.active;
    }
  }
  if (Object.hasOwn(body, 'role')) {
    if (!['Attendee', 'Organizer', 'Admin'].includes(body.role)) {
      fields.push({ field: 'role', message: 'Role must be Attendee, Organizer or Admin' });
    } else {
      changes.role = body.role;
    }
  }
  if (fields.length) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid user update', fields);
  }

  // Update only the supplied fields, atomically, without saving a stale user copy.
  const user = await User.findByIdAndUpdate(
    req.params.id, { $set: changes }, { returnDocument: 'after', runValidators: true }
  );
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found');

  res.json({ user: {
    id: String(user._id), name: user.name, email: user.email,
    role: user.role, active: user.active,
  } });
}));

// Manage categories (EMS-F-032)
router.get('/categories', asyncHandler(async (req, res) => {
  const items = await Category.find().sort({ name: 1 });
  res.json({ items });
}));

router.post('/categories', asyncHandler(async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (name.length < 2 || name.length > 50) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Invalid category', [{ field: 'name', message: 'Name must be 2 to 50 characters' }]);
  }
  try {
    const category = await Category.create({ name });
    res.status(201).json({ category });
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'DUPLICATE_CATEGORY', 'Category already exists');
    throw err;
  }
}));

router.patch('/categories/:id', asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  const category = await Category.findById(req.params.id);
  if (!category) throw new AppError(404, 'NOT_FOUND', 'Category not found');
  const b = req.body || {};
  if ('name' in b) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 2 || name.length > 50) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid category', [{ field: 'name', message: 'Name must be 2 to 50 characters' }]);
    }
    category.name = name;
  }
  if ('active' in b) {
    if (typeof b.active !== 'boolean') {
      throw new AppError(422, 'VALIDATION_ERROR', 'Invalid category', [{ field: 'active', message: 'active must be true or false' }]);
    }
    category.active = b.active;
  }
  try {
    await category.save();
  } catch (err) {
    if (err.code === 11000) throw new AppError(409, 'DUPLICATE_CATEGORY', 'Category already exists');
    throw err;
  }
  res.json({ category });
}));

module.exports = router;
