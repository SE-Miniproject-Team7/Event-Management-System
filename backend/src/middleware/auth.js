const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const token = req.cookies && req.cookies.ems_token;
  if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Please log in');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw new AppError(401, 'UNAUTHENTICATED', 'Session expired or invalid'); }
  const user = await User.findById(payload.id);
  if (!user || !user.active) throw new AppError(401, 'UNAUTHENTICATED', 'Account not available');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new AppError(403, 'FORBIDDEN', 'You do not have access'));
  }
  next();
};

module.exports = { authenticate, requireRole };
