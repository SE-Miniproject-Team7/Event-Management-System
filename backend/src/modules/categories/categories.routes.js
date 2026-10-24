const router = require('express').Router();
const Category = require('../../models/Category');
const asyncHandler = require('../../utils/asyncHandler');

// Public: active categories for the event form and filters
router.get('/', asyncHandler(async (req, res) => {
  const items = await Category.find({ active: true }).sort({ name: 1 });
  res.json({ items });
}));

module.exports = router;
