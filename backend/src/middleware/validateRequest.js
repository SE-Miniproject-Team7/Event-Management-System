
const AppError = require('../utils/AppError');

/**
 * Validates required fields in req.body.
 * Usage: validateRequest(['name', 'email'])
 */
function validateRequest(requiredFields = []) {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
      return next(
        new AppError(400, 'INVALID_REQUEST_BODY', 'Request body must be a JSON object')
      );
    }

    const errors = requiredFields
      .filter((field) => {
        const value = req.body[field];
        return (
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim() === '')
        );
      })
      .map((field) => ({
        field,
        message: `${field} is required`,
      }));

    if (errors.length > 0) {
      return next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed', errors)
      );
    }

    next();
  };
}

module.exports = validateRequest;
