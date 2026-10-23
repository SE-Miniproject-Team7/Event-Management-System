const express = require('express');
const request = require('supertest');
const validateRequest = require('../src/middleware/validateRequest');
const errorHandler = require('../src/middleware/errorHandler');
const AppError = require('../src/utils/AppError');

describe('Core middleware', () => {
  const app = express();
  app.use(express.json());

  app.post('/validate', validateRequest(['name', 'email']), (req, res) => {
    res.status(200).json({ success: true });
  });

  app.get('/error', (req, res, next) => {
    next(new AppError(400, 'TEST_ERROR', 'Test error message'));
  });

  app.use((req, res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Route not found'));
  });

  app.use(errorHandler);

  test('accepts valid required fields', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Test User', email: 'test@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: 'Test User' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual([
      { field: 'email', message: 'email is required' },
    ]);
  });

  test('rejects blank required fields', async () => {
    const res = await request(app)
      .post('/validate')
      .send({ name: '   ', email: 'test@example.com' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns structured application errors', async () => {
    const res = await request(app).get('/error');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('TEST_ERROR');
    expect(res.body.error.message).toBe('Test error message');
  });

  test('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/unknown');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
