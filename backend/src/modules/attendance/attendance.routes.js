const router = require('express').Router();
const mongoose = require('mongoose');
const { authenticate, requireRole } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');
const { checkIn } = require('./checkin.service');

router.post('/:id/checkin', authenticate, requireRole('Organizer'), asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError(404, 'NOT_FOUND', 'Event not found');
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some(key => key !== 'regCode') ||
      typeof body.regCode !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(body.regCode.trim())) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Provide a valid registration code', [
      { field: 'regCode', message: 'Enter the registration code printed with the QR code' },
    ]);
  }
  res.json(await checkIn(req, req.params.id, body.regCode.trim()));
}));
module.exports = router;
