
process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/User');

const User = require('../src/models/User');
const authRoutes = require('../src/modules/auth/auth.routes');
const { authenticate } = require('../src/middleware/auth');
const errorHandler = require('../src/middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

app.get('/api/protected', authenticate, (req, res) => {
  res.status(200).json({ message: 'Authenticated' });
});

// Must be registered after the routes.
app.use(errorHandler);

describe('Authentication', () => {
  let passwordHash;
  let user;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Correct123!', 4);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    user = {
      _id: 'user123',
      name: 'Test User',
      email: 'test@example.com',
      role: 'Attendee',
      passwordHash,
      active: true,
      failedLogins: 0,
      lockUntil: null,
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findOne = jest.fn().mockResolvedValue(user);
    User.findById = jest.fn().mockResolvedValue(user);
  });

  test('successful login returns user details and sets secure JWT cookie', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'TEST@example.com',
        password: 'Correct123!',
      });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 'user123',
      name: 'Test User',
      role: 'Attendee',
    });

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith('ems_token=')
    );

    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/HttpOnly/i);
    expect(authCookie).toMatch(/Secure/i);
    expect(authCookie).toMatch(/SameSite=Strict/i);
    expect(authCookie).toMatch(/Max-Age=3600/i);

    const token = authCookie
      .split(';')[0]
      .slice('ems_token='.length);

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    expect(payload.id).toBe('user123');
    expect(payload.exp - payload.iat).toBe(3600);
  });

  test('incorrect password returns the required 401 response', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword!',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
  });

  test('unknown email returns the same invalid credentials response', async () => {
    User.findOne.mockResolvedValueOnce(null);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'unknown@example.com',
        password: 'Correct123!',
      });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect',
    });
  });

  test('five consecutive failed attempts lock the account for 15 minutes', async () => {
    user.failedLogins = 4;

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'WrongPassword!',
      });

    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(response.body.error.message).toMatch(/Try again in 15 minutes/);

    // Allow for a small timing difference while the request is processed.
    expect(response.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(response.body.error.retryAfterSeconds).toBeLessThanOrEqual(900);

    expect(user.failedLogins).toBe(0);
    expect(user.lockUntil).toBeInstanceOf(Date);
    expect(user.lockUntil.getTime()).toBeGreaterThan(Date.now());
    expect(user.lockUntil.getTime()).toBeLessThanOrEqual(
      Date.now() + 15 * 60 * 1000
    );
    expect(user.save).toHaveBeenCalled();
  });

  test('already locked account returns the remaining lockout time', async () => {
    // A 12-minute remaining lock proves the response is calculated dynamically.
    user.lockUntil = new Date(Date.now() + 12 * 60 * 1000);

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Correct123!',
      });

    expect(response.status).toBe(423);
    expect(response.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(response.body.error.message).toMatch(/Try again in 12 minutes/);
    expect(response.body.error.retryAfterSeconds).toBeGreaterThan(0);
    expect(response.body.error.retryAfterSeconds).toBeLessThanOrEqual(720);
  });

  test('inactive user cannot log in', async () => {
    user.active = false;

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'Correct123!',
      });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('request without a token is rejected', async () => {
    const response = await request(app).get('/api/protected');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('tampered token is rejected', async () => {
    const token = jwt.sign(
      { id: 'user123', role: 'Attendee' },
      process.env.JWT_SECRET,
      { expiresIn: '60m' }
    );

    const parts = token.split('.');
    parts[1] = `${parts[1].slice(0, -1)}x`;

    const tamperedToken = parts.join('.');

    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', `ems_token=${tamperedToken}`);

    expect(response.status).toBe(401);
  });

  test('expired token is rejected', async () => {
    const token = jwt.sign(
      { id: 'user123', role: 'Attendee' },
      process.env.JWT_SECRET,
      { expiresIn: -1 }
    );

    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', `ems_token=${token}`);

    expect(response.status).toBe(401);
  });

  test('token for a deactivated user is rejected', async () => {
    User.findById.mockResolvedValueOnce({
      _id: 'user123',
      active: false,
      role: 'Attendee',
    });

    const token = jwt.sign(
      { id: 'user123', role: 'Attendee' },
      process.env.JWT_SECRET,
      { expiresIn: '60m' }
    );

    const response = await request(app)
      .get('/api/protected')
      .set('Cookie', `ems_token=${token}`);

    expect(response.status).toBe(401);
  });

  test('GET /api/auth/me returns the authenticated user', async () => {
    const token = jwt.sign(
      { id: 'user123', role: 'Attendee' },
      process.env.JWT_SECRET,
      { expiresIn: '60m' }
    );

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `ems_token=${token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      id: 'user123',
      name: 'Test User',
      role: 'Attendee',
    });
  });

  test('GET /api/auth/me rejects requests without a token', async () => {
    const response = await request(app).get('/api/auth/me');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('POST /api/auth/logout clears the authentication cookie', async () => {
    const response = await request(app).post('/api/auth/logout');

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Logged out successfully');

    const cookies = response.headers['set-cookie'];
    expect(cookies).toBeDefined();

    const authCookie = cookies.find((cookie) =>
      cookie.startsWith('ems_token=')
    );

    expect(authCookie).toBeDefined();
    expect(authCookie).toMatch(/Expires=/i);
    expect(authCookie).toMatch(/HttpOnly/i);
  });
});
