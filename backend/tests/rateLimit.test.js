const express = require('express');
const request = require('supertest');
const { createApiLimiter, createLoginLimiter } = require('../src/middleware/rateLimit');
const errorHandler = require('../src/middleware/errorHandler');

function createApp() {
  const app = express();
  app.use('/api', createApiLimiter());
  app.post('/api/auth/login', createLoginLimiter(), (req, res) => res.sendStatus(401));
  app.get('/api/auth/me', (req, res) => res.sendStatus(200));
  app.post('/api/auth/logout', (req, res) => res.sendStatus(200));
  app.get('/api/probe', (req, res) => res.sendStatus(200));
  app.get('/health', (req, res) => res.sendStatus(200));
  app.use(errorHandler);
  return app;
}

test('the eleventh login attempt is limited within a 60-second window', async () => {
  const app = createApp();
  for (let i = 0; i < 10; i++) {
    expect((await request(app).post('/api/auth/login')).status).toBe(401);
  }
  const res = await request(app).post('/api/auth/login');
  expect(res.status).toBe(429);
  expect(res.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  expect(res.headers['ratelimit-policy']).toContain('q=10; w=60');
  expect(Number(res.headers['retry-after'])).toBeLessThanOrEqual(60);
});

test('profile and logout requests do not use the login attempt allowance', async () => {
  const app = createApp();
  for (let i = 0; i < 11; i++) {
    expect((await request(app).get('/api/auth/me')).status).toBe(200);
    expect((await request(app).post('/api/auth/logout')).status).toBe(200);
  }
  expect((await request(app).post('/api/auth/login')).status).toBe(401);
});

test('the 101st API request is limited while health remains available', async () => {
  const app = createApp();
  for (let i = 0; i < 100; i++) {
    expect((await request(app).get('/api/probe')).status).toBe(200);
  }
  const res = await request(app).get('/api/probe');
  expect(res.status).toBe(429);
  expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  expect(res.headers['ratelimit-policy']).toContain('q=100; w=60');
  expect((await request(app).get('/health')).status).toBe(200);
});

test('the real app counts malformed JSON toward both login and API limits', async () => {
  const app = require('../src/app');
  const malformed = path => request(app).post(path).set('Content-Type', 'application/json').send('{"invalid":');
  for (let i = 0; i < 10; i++) expect((await malformed('/api/auth/login')).status).toBe(400);
  const loginLimited = await malformed('/api/auth/login');
  expect(loginLimited.status).toBe(429);
  expect(loginLimited.body.error.code).toBe('AUTH_RATE_LIMIT_EXCEEDED');
  for (let i = 0; i < 89; i++) expect((await malformed('/api/security-probe')).status).toBe(400);
  const apiLimited = await malformed('/api/security-probe');
  expect(apiLimited.status).toBe(429);
  expect(apiLimited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
  expect((await request(app).get('/health')).status).toBe(200);
});
