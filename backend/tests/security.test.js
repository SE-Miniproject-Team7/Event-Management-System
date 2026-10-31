process.env.JWT_SECRET = 'security-unit-test-only';
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/models/User', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../src/modules/audit/audit.service', () => ({ recordAudit: jest.fn() }));
const User = require('../src/models/User');
const { authenticate } = require('../src/middleware/auth');
const errorHandler = require('../src/middleware/errorHandler');
const AppError = require('../src/utils/AppError');
const { setAuthCookie, clearAuthCookie } = require('../src/utils/token');
const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use('/auth', require('../src/modules/auth/auth.routes'));
app.get('/protected', authenticate, (req, res) => res.json({ id: req.user._id }));
app.get('/raw-error', (req, res, next) => next(Object.assign(new Error('private-password private-token'), {
  code: 'private-token', fields: [{ field: 'password', message: 'private-password' }],
  query: { passwordHash: 'private-hash' },
})));
app.get('/trusted-error', (req, res, next) => next(new AppError(500, 'INTERNAL_ERROR', 'private-token', [{ field: 'password', message: 'private-password' }])));
app.use(errorHandler);
const id = '64b0000000000000000000a1';
const signed = payload => `ems_token=${jwt.sign(payload, process.env.JWT_SECRET)}`;
let consoleError;
beforeEach(() => {
  jest.resetAllMocks();
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  User.findById.mockResolvedValue({ _id: id, active: true, role: 'Attendee' });
});
afterEach(() => jest.restoreAllMocks());
describe('Security regression pass (TC-SEC-01/03/06)', () => {
  test.each(['/raw-error', '/trusted-error'])('does not expose exception metadata through %s or server logs', async path => {
    const res = await request(app).get(path);
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const log = JSON.parse(consoleError.mock.calls[0][0]);
    expect(log).toEqual({ level: 'error', event: 'request_failed', status: 500, code: 'INTERNAL_ERROR' });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('private-');
  });
  test('malformed JSON is rejected without reflecting or logging its body', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"password":"private-password",');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
    expect(JSON.stringify(res.body)).not.toContain('private-password');
    expect(consoleError).not.toHaveBeenCalled();
  });
  test('oversized bodies receive a sanitized 413 response', async () => {
    const res = await request(app).post('/auth/login').send({ password: 'private-password'.repeat(1000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    expect(JSON.stringify(res.body)).not.toContain('private-password');
    expect(consoleError).not.toHaveBeenCalled();
  });
  test.each([null, {}, [], { id: null }, { id: { $ne: null } }, { id: ['admin'] }, { id: 'not-an-id' }])('rejects signed malformed identity %j before any database query', async payload => {
    // jsonwebtoken does not sign null/array payloads; use a valid object wrapper
    // for those malformed id shapes instead.
    const value = payload === null ? { role: 'Admin' } : Array.isArray(payload) ? { id: payload } : payload;
    const res = await request(app).get('/protected').set('Cookie', signed(value));
    expect(res.status).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
  test('pins verification to the algorithm issued by the application', async () => {
    const token = jwt.sign({ id }, process.env.JWT_SECRET, { algorithm: 'HS512' });
    const res = await request(app).get('/protected').set('Cookie', `ems_token=${token}`);
    expect(res.status).toBe(401);
    expect(User.findById).not.toHaveBeenCalled();
  });
  test('rejects unsigned tokens', async () => {
    const token = jwt.sign({ id }, '', { algorithm: 'none' });
    expect((await request(app).get('/protected').set('Cookie', `ems_token=${token}`)).status).toBe(401);
  });
  test('does not use NoSQL operator objects as login filters', async () => {
    const res = await request(app).post('/auth/login').send({ email: { $ne: null }, password: 'Correct123' });
    expect(res.status).toBe(401);
    expect(User.findOne).not.toHaveBeenCalled();
  });
  test('production cookie is HttpOnly/Secure/Strict and token lifetime is 60 minutes', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = { cookie: jest.fn(), clearCookie: jest.fn() };
      setAuthCookie(res, { _id: id, role: 'Attendee' });
      const [name, token, options] = res.cookie.mock.calls[0];
      expect(name).toBe('ems_token');
      expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 3600000 });
      const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      expect(payload.exp - payload.iat).toBe(3600);
      clearAuthCookie(res);
      expect(res.clearCookie).toHaveBeenCalledWith('ems_token', expect.objectContaining({ httpOnly: true, secure: true, sameSite: 'strict', path: '/' }));
    } finally { process.env.NODE_ENV = previous; }
  });
});

test.each(['server.js', 'seed.js'])('%s startup failure does not print credential-bearing driver messages', filename => {
  const { spawnSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ems-security-'));
  try {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../src', filename)], {
      cwd: directory, encoding: 'utf8', timeout: 10000,
      env: { ...process.env, MONGO_URI: 'invalid-SENSITIVE-DATABASE-URI',
        JWT_SECRET: 'test-only-signing-value', SEED_PASSWORD: 'TestSeed123', NODE_ENV: 'test' },
    });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('SENSITIVE-DATABASE-URI');
    expect(result.stderr).toMatch(/startup failed|Seed failed/);
  } finally { fs.rmdirSync(directory) }
});
