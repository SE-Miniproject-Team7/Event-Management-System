module.exports = (err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) console.error(err);
  const body = {
    error: {
      code: err.code || (status === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: status === 500 ? 'Something went wrong' : err.message,
    },
  };
  if (err.fields) body.error.fields = err.fields;
  if (err.retryAfterSeconds) body.error.retryAfterSeconds = err.retryAfterSeconds;
  res.status(status).json(body);
};
