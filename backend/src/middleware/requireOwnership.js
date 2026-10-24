const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Checks whether the authenticated user owns a resource.
 *
 * Model: Mongoose model to query.
 * ownerField: Field containing the owner's user ID.
 * paramName: Route parameter containing the resource ID.
 * resourceName: Human-readable resource name for errors.
 * allowAdmin: Whether Admin may bypass ownership (explicit opt-in).
 */
const requireOwnership = ({
  Model,
  ownerField,
  paramName = 'id',
  resourceName = 'Resource',
  allowAdmin = false,
}) => {
  if (!Model || typeof Model.findById !== 'function') {
    throw new TypeError('requireOwnership requires a model with findById');
  }

  if (typeof ownerField !== 'string' || !ownerField.trim()) {
    throw new TypeError('requireOwnership requires an ownerField');
  }

  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Please log in');
    }

    const resourceId = req.params && req.params[paramName];

    if (!resourceId) {
      throw new AppError(404, 'NOT_FOUND', `${resourceName} not found`);
    }

    let resource;

    try {
      resource = await Model.findById(resourceId);
    } catch (error) {
      // Treat malformed IDs as not found, but preserve genuine database errors.
      if (error && error.name === 'CastError') {
        throw new AppError(404, 'NOT_FOUND', `${resourceName} not found`);
      }
      throw error;
    }

    if (!resource) {
      throw new AppError(404, 'NOT_FOUND', `${resourceName} not found`);
    }

    if (allowAdmin && req.user.role === 'Admin') {
      req.ownedResource = resource;
      return next();
    }

    const ownerId = resource[ownerField];
    const userId = req.user._id;

    const ownerIdString = ownerId && ownerId._id
      ? String(ownerId._id)
      : ownerId && typeof ownerId.toString === 'function'
        ? ownerId.toString()
        : String(ownerId ?? '');

    const userIdString = userId && userId._id
      ? String(userId._id)
      : userId && typeof userId.toString === 'function'
        ? userId.toString()
        : String(userId ?? '');

    if (!ownerIdString || ownerIdString !== userIdString) {
      throw new AppError(403, 'FORBIDDEN', 'You do not own this resource');
    }

    req.ownedResource = resource;
    next();
  });
};

module.exports = requireOwnership;
