
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { createApiLimiter, createLoginLimiter } = require('./middleware/rateLimit');
const mongoose = require('mongoose');
const AppError = require('./utils/AppError');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.disable('x-powered-by');

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', createApiLimiter());
app.post('/api/auth/login', createLoginLimiter());

app.get('/health', (req, res) =>
  res.json({
    status: 'ok',
    db: mongoose.connection.readyState === 1 ? 'up' : 'down',
  })
);

app.use('/api/auth', require('./modules/auth/auth.routes'));
app.use('/api/categories', require('./modules/categories/categories.routes'));
app.use('/api/events', require('./modules/events/events.routes'));
app.use('/api', require('./modules/registrations/registrations.routes'));
app.use('/api/admin', require('./modules/admin/admin.routes'));

app.use((req, res, next) =>
  next(new AppError(404, 'NOT_FOUND', 'Route not found'))
);

app.use(errorHandler);

module.exports = app;
