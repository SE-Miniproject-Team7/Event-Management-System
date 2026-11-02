jest.mock('../src/models/User');

const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-jwt-secret-for-users-tests';

const User = require('../src/models/User');
const usersRoutes = require('../src/modules/users/users.routes');
const errorHandler = require('../src/middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/users', usersRoutes);
app.use(errorHandler);

describe('Profile Update', () => {
  let user;
  let token;

  beforeEach(() => {
    jest.clearAllMocks();

    user = {
      _id: '64b0000000000000000000a1',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
      role: 'Attendee',
      active: true,
      save: jest.fn().mockResolvedValue(undefined),
    };

    User.findById = jest.fn().mockResolvedValue(user);

    token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '60m' }
    );
  });

  test('updates name and valid 10-digit phone', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Cookie', `ems_token=${token}`)
      .send({ name: 'Updated User', phone: '9876543210' });

    expect(response.status).toBe(200);
    expect(user.name).toBe('Updated User');
    expect(user.phone).toBe('9876543210');
    expect(user.save).toHaveBeenCalled();
    expect(response.body.user.name).toBe('Updated User');
    expect(response.body.user.phone).toBe('9876543210');
  });

  test('rejects phone numbers with fewer than 10 digits', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Cookie', `ems_token=${token}`)
      .send({ phone: '123456789' });

    expect(response.status).toBe(422);
    expect(user.save).not.toHaveBeenCalled();
  });

  test('rejects an empty update', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .set('Cookie', `ems_token=${token}`)
      .send({});

    expect(response.status).toBe(422);
    expect(user.save).not.toHaveBeenCalled();
  });
  test('rejects requests without authentication', async () => {
    const response = await request(app)
      .put('/api/users/me')
      .send({ name: 'Updated User' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

