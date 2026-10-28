const rateLimit = require('express-rate-limit');
const AppError = require('../utils/AppError');

function createLimiter(limit, code, message) {
  return rateLimit({
    windowMs: 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res, next) => next(new AppError(429, code, message)),
  });
}

const createApiLimiter = () => createLimiter(
  100, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.'
);
const createLoginLimiter = () => createLimiter(
  10, 'AUTH_RATE_LIMIT_EXCEEDED', 'Too many authentication attempts. Please try again later.'
);

module.exports = { createApiLimiter, createLoginLimiter };
