process.env.JWT_SECRET = 'test-secret-for-account-registration';

const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const bcrypt = require('bcryptjs');

jest.mock('../src/models/User');
const User = require('../src/models/User');
const authRoutes = require('../src/modules/auth/auth.routes');
const errorHandler = require('../src/middleware/errorHandler');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

const valid = { name: 'Test Attendee', email: 'attendee@example.com', password: 'Event123' };

beforeEach(() => {
  jest.resetAllMocks();
  User.findOne.mockResolvedValue(null);
  User.create.mockImplementation(async (data) => ({ _id: 'user123', ...data }));
});

describe('Account registration (TC-AUTH-01, TC-AUTH-02, TC-SEC-01)', () => {
  test('creates an Attendee with a bcrypt hash and only public response fields', async () => {
    const res = await request(app).post('/api/auth/register').send({
      ...valid, name: '  Test Attendee  ', email: ' ATTENDEE@EXAMPLE.COM ',
      phone: ' 9876543210 ', role: 'Admin', active: false,
    });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: 'user123', name: 'Test Attendee', role: 'Attendee' });
    expect(User.findOne).toHaveBeenCalledWith({ email: 'attendee@example.com' });
    const saved = User.create.mock.calls[0][0];
    expect(saved).toMatchObject({
      name: 'Test Attendee', email: 'attendee@example.com', phone: '9876543210',
      role: 'Attendee', active: true, failedLogins: 0, lockUntil: null,
    });
    expect(saved).not.toHaveProperty('password');
    expect(await bcrypt.compare(valid.password, saved.passwordHash)).toBe(true);
    expect(bcrypt.getRounds(saved.passwordHash)).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(res.body)).not.toContain(saved.passwordHash);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test.each([
    ['minimum lengths and omitted phone', { name: 'Ana', password: 'Event123' }],
    ['maximum lengths', { name: 'N'.repeat(60), email: 'a'.repeat(88) + '@example.com', password: 'A1' + 'x'.repeat(62) }],
    ['empty optional phone', { phone: '' }],
  ])('accepts %s', async (label, fields) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, ...fields });
    expect(res.status).toBe(201);
  });

  test.each([
    ['missing name', { name: undefined }, 'name'],
    ['short name', { name: 'An' }, 'name'],
    ['blank name', { name: '   ' }, 'name'],
    ['long name', { name: 'N'.repeat(61) }, 'name'],
    ['non-string name', { name: ['Ana'] }, 'name'],
    ['missing email', { email: undefined }, 'email'],
    ['invalid email', { email: 'bad-email' }, 'email'],
    ['long email', { email: 'a'.repeat(89) + '@example.com' }, 'email'],
    ['NoSQL email payload', { email: { $ne: null } }, 'email'],
    ['missing password', { password: undefined }, 'password'],
    ['short password', { password: 'Event12' }, 'password'],
    ['long password', { password: 'A1' + 'x'.repeat(63) }, 'password'],
    ['letters-only password', { password: 'abcdefgh' }, 'password'],
    ['digits-only password', { password: '12345678' }, 'password'],
    ['non-string password', { password: { $ne: null } }, 'password'],
    ['short phone', { phone: '987654321' }, 'phone'],
    ['long phone', { phone: '98765432100' }, 'phone'],
    ['non-numeric phone', { phone: 'abcdefghij' }, 'phone'],
    ['numeric phone type', { phone: 9876543210 }, 'phone'],
    ['null phone', { phone: null }, 'phone'],
  ])('rejects %s with a 422 field error before querying the database', async (label, fields, field) => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, ...fields });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field, message: expect.any(String) }),
    ]));
    expect(User.findOne).not.toHaveBeenCalled();
    expect(User.create).not.toHaveBeenCalled();
    expect(JSON.stringify(res.body)).not.toContain(valid.password);
  });

  test('rejects a non-object body with 422', async () => {
    const res = await request(app).post('/api/auth/register').send([]);
    expect(res.status).toBe(422);
    expect(User.findOne).not.toHaveBeenCalled();
  });

  test('returns all invalid fields together', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.status).toBe(422);
    expect(res.body.error.fields.map(({ field }) => field)).toEqual(['name', 'email', 'password']);
  });

  test('rejects an existing email with 409 without creating a user', async () => {
    User.findOne.mockResolvedValue({ _id: 'existing' });
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(User.create).not.toHaveBeenCalled();
  });

  test('handles a duplicate email created concurrently with 409', async () => {
    User.create.mockRejectedValue({ code: 11000 });
    const res = await request(app).post('/api/auth/register').send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('a newly registered user can log in and access their authenticated profile', async () => {
    let storedUser;
    User.create.mockImplementation(async (data) => {
      storedUser = { _id: 'user123', ...data, save: jest.fn().mockResolvedValue(undefined) };
      return storedUser;
    });
    const signup = await request(app).post('/api/auth/register').send(valid);
    expect(signup.status).toBe(201);

    User.findOne.mockResolvedValue(storedUser);
    User.findOneAndUpdate.mockImplementation(async (_filter, update) => Object.assign(storedUser, update.$set));
    User.findById.mockResolvedValue(storedUser);
    User.findOneAndUpdate.mockResolvedValue(storedUser);
    const login = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password });
    expect(login.status).toBe(200);
    const cookie = login.headers['set-cookie'][0].split(';')[0];
    const profile = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(profile.status).toBe(200);
    expect(profile.body.user).toEqual(signup.body);
  });
});
