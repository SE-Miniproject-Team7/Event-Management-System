const { randomUUID } = require('node:crypto');

module.exports = function requestLogger(req, res, next) {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = req.route?.path
      ? `${req.baseUrl}${req.route.path}`
      : req.path;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    console.log(JSON.stringify({
      level,
      time: new Date().toISOString(),
      requestId,
      route,
      method: req.method,
      status,
      durationMs: Number(durationMs.toFixed(3)),
    }));
  });

  next();
};
