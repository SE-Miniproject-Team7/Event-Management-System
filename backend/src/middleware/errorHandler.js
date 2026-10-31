const AppError = require('../utils/AppError');

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const trusted = err instanceof AppError && Number.isInteger(err.status) && err.status >= 400 && err.status <= 599;
  const malformed = err.type === 'entity.parse.failed';
  const oversized = err.type === 'entity.too.large';
  const status = trusted ? err.status : malformed ? 400 : oversized ? 413 : 500;
  const code = trusted && typeof err.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(err.code)
    ? err.code : malformed ? 'INVALID_JSON' : oversized ? 'PAYLOAD_TOO_LARGE' : 'INTERNAL_ERROR';
  if (status >= 500) {
    // Palash's structured logger can consume these safe fields. Never log err,
    // stack, request URLs/bodies/headers, MongoDB query values or credentials.
    console.error(JSON.stringify({ level: 'error', event: 'request_failed', status, code }));
  }
  const body = { error: {
    code,
    message: status === 500 ? 'Something went wrong' : trusted ? err.message :
      malformed ? 'Request body must be valid JSON' : 'Request body is too large',
  } };
  if (trusted && status < 500 && err.fields) body.error.fields = err.fields;
  if (trusted && Number.isFinite(err.retryAfterSeconds)) body.error.retryAfterSeconds = err.retryAfterSeconds;
  res.status(status).json(body);
};
