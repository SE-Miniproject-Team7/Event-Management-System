const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Event = require('../src/models/Event');
const AuditLog = require('../src/models/AuditLog');
const app = require('../src/app');
describe('Security pass against real MongoDB (TC-SEC-01/03/06)', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  const dbName = `ems_test_security_${randomUUID().replaceAll('-', '')}`;
  const oldSecret = process.env.JWT_SECRET, oldEnv = process.env.NODE_ENV;
  let organizer, attendee, category, hash, logs;
  const oldError = console.error;
  const cookie = (user, role = user.role) => `ems_token=${jwt.sign({ id: String(user._id), role }, process.env.JWT_SECRET, { expiresIn: '60m' })}`;
  before(async () => {
    if (!new URL(process.env.MONGO_TEST_URI).pathname.startsWith('/ems_test_')) throw new Error('Use a dedicated ems_test_* database');
    process.env.JWT_SECRET = randomUUID();
    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName, serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Category.init(), Event.init(), AuditLog.init()]);
    hash = await bcrypt.hash('FixturePassword123', 10);
    console.error = (...args) => logs.push(args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' '));
  });
  beforeEach(async () => {
    logs = [];
    await Promise.all([User.deleteMany({}), Category.deleteMany({}), Event.deleteMany({}), AuditLog.deleteMany({})]);
    [organizer, attendee] = await User.create(['Organizer', 'Attendee'].map((role, index) => ({
      name: `Security ${role}`, email: `security${index}@test.local`, role, passwordHash: hash,
    })));
    category = await Category.create({ name: 'Security Test' });
  });
  after(async () => {
    console.error = oldError;
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
    if (oldEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
  });
  it('stores only a strong bcrypt hash, ignores privilege fields and leaks no password in responses/logs', async () => {
    const password = 'SecurityProbe123';
    const name = '<script>alert(1)</script>';
    const res = await request(app).post('/api/auth/register').send({ name, email: 'new@test.local', password, role: 'Admin', active: false, $set: { role: 'Admin' } });
    assert.equal(res.status, 201);
    assert.equal(res.body.role, 'Attendee');
    const saved = await User.findOne({ email: 'new@test.local' });
    assert.equal(saved.role, 'Attendee'); assert.equal(saved.active, true);
    assert.equal(saved.name, name);
    assert.ok(bcrypt.getRounds(saved.passwordHash) >= 10);
    assert.ok(await bcrypt.compare(password, saved.passwordHash));
    assert.equal(saved.toObject().password, undefined);
    assert.deepEqual(Object.keys(res.body).sort(), ['id', 'name', 'role']);
    assert.ok(!JSON.stringify(res.body).includes(password));
    assert.ok(!JSON.stringify(logs).includes(password));
    assert.ok(!JSON.stringify(res.body).includes(saved.passwordHash));
  });
  it('rejects operator payloads and invalid numeric fields; XSS input remains literal text', async () => {
    const injected = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: 'FixturePassword123' });
    assert.equal(injected.status, 401); assert.equal(injected.headers['set-cookie'], undefined);
    const signup = await request(app).post('/api/auth/register').send({ name: 'Valid Name', email: { $ne: null }, password: 'SecurityProbe123' });
    assert.equal(signup.status, 422);
    const body = { title: '<script>alert(1)</script>', description: '<img src=x onerror=alert(1)>', venue: 'Hall', categoryId: String(category._id),
      startAt: new Date(Date.now() + 86400000).toISOString(), endAt: new Date(Date.now() + 90000000).toISOString(),
      registrationDeadline: new Date(Date.now() + 3600000).toISOString(), capacity: 10 };
    for (const capacity of [-1, 1e20, 1.5, '10', { $gt: 0 }]) {
      const res = await request(app).post('/api/events').set('Cookie', cookie(organizer)).send({ ...body, capacity });
      assert.equal(res.status, 422);
    }
    assert.equal(await Event.countDocuments(), 0);
    const res = await request(app).post('/api/events').set('Cookie', cookie(organizer)).send(body);
    assert.equal(res.status, 201);
    const saved = await Event.findById(res.body.event._id);
    assert.equal(saved.title, body.title); assert.equal(saved.description, body.description);
  });
  it('enforces production cookie flags, exact token lifetime and current server-side identity', async () => {
    process.env.NODE_ENV = 'production';
    const login = await request(app).post('/api/auth/login').send({ email: attendee.email, password: 'FixturePassword123' });
    assert.equal(login.status, 200);
    const header = login.headers['set-cookie'][0];
    assert.match(header, /HttpOnly/i); assert.match(header, /Secure/i); assert.match(header, /SameSite=Strict/i);
    const token = header.split(';')[0].slice('ems_token='.length);
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    assert.equal(payload.exp - payload.iat, 3600);
    const invalid = [
      jwt.sign({ id: String(attendee._id) }, '', { algorithm: 'none' }),
      jwt.sign({ id: String(attendee._id) }, process.env.JWT_SECRET, { algorithm: 'HS512' }),
      jwt.sign({ id: String(attendee._id) }, process.env.JWT_SECRET, { expiresIn: -1 }),
      jwt.sign({ id: { $ne: null } }, process.env.JWT_SECRET),
      jwt.sign({ id: String(attendee._id) }, 'different-signing-key'),
    ];
    for (const value of invalid) assert.equal((await request(app).get('/api/auth/me').set('Cookie', `ems_token=${value}`)).status, 401);
    assert.equal((await request(app).get('/api/admin/users').set('Cookie', cookie(attendee, 'Admin'))).status, 403);
    await User.updateOne({ _id: attendee._id }, { $set: { active: false } });
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', header.split(';')[0])).status, 401);
    const serialized = JSON.stringify(await AuditLog.find().lean());
    assert.ok(!serialized.includes(token)); assert.ok(!serialized.includes('FixturePassword123'));
  });
  it('sanitizes unexpected database failures, malformed JSON and oversized request bodies', async () => {
    const original = User.findOne;
    User.findOne = async () => { throw Object.assign(new Error('SENSITIVE-PASSWORD SENSITIVE-JWT SENSITIVE-URI'), { fields: [{ message: 'SENSITIVE-PASSWORD' }] }); };
    try {
      const res = await request(app).post('/api/auth/login').send({ email: attendee.email, password: 'SENSITIVE-PASSWORD' });
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
      assert.ok(!JSON.stringify(logs).includes('SENSITIVE-'));
    } finally { User.findOne = original; }
    const malformed = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"password":"SENSITIVE-PASSWORD",');
    assert.equal(malformed.status, 400);
    assert.equal(malformed.body.error.code, 'INVALID_JSON');
    const oversized = await request(app).post('/api/auth/login').send({ password: 'SENSITIVE-PASSWORD'.repeat(1000) });
    assert.equal(oversized.status, 413);
    assert.ok(!JSON.stringify([logs, malformed.body, oversized.body]).includes('SENSITIVE-'));
  });
  it('uses security response headers without advertising the framework', async () => {
    const res = await request(app).get('/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.ok(res.headers['content-security-policy']);
    assert.ok(res.headers['strict-transport-security']);
    // Header presence does not prove HTTPS transport; TC-SEC-02 needs deployment.
  });
});
