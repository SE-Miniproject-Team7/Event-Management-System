// MONGO_TEST_URI=mongodb://.../ems_test_* node --test tests/adminUsers.integration.cjs
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const app = require('../src/app');

describe('Admin user management with real MongoDB', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  let admin;
  let target;
  let passwordHash;
  const previousSecret = process.env.JWT_SECRET;
  const cookie = (user, role = user.role) => `ems_token=${jwt.sign({ id: user._id, role }, process.env.JWT_SECRET, { expiresIn: '60m' })}`;
  const patch = body => request(app).patch(`/api/admin/users/${target._id}`).set('Cookie', cookie(admin)).send(body);

  before(async () => {
    const uri = process.env.MONGO_TEST_URI;
    if (!new URL(uri).pathname.startsWith('/ems_test_')) {
      throw new Error('MONGO_TEST_URI must point to a dedicated ems_test_* database');
    }
    process.env.JWT_SECRET = randomUUID();
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    await User.init();
    passwordHash = await bcrypt.hash('Correct123', 10);
  });
  beforeEach(async () => {
    [admin, target] = await User.create([
      { name: 'Test Admin', email: `${randomUUID()}@test.local`, passwordHash, role: 'Admin' },
      { name: 'Test Attendee', email: `${randomUUID()}@test.local`, passwordHash, role: 'Attendee' },
    ]);
  });
  afterEach(async () => {
    const ids = [admin?._id, target?._id].filter(Boolean);
    if (ids.length) await User.deleteMany({ _id: { $in: ids } });
  });
  after(async () => {
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('deactivates an existing session, blocks login and allows reactivation', async () => {
    const login = () => request(app).post('/api/auth/login').send({ email: target.email, password: 'Correct123' });
    const initialLogin = await login();
    assert.equal(initialLogin.status, 200);
    const session = initialLogin.headers['set-cookie'][0].split(';')[0];
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', session)).status, 200);
    const changed = await patch({ active: false });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.user.active, false);
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', session)).status, 401);
    assert.equal((await login()).status, 401);
    assert.equal((await patch({ active: true })).status, 200);
    assert.equal((await login()).status, 200);
    assert.equal((await User.findById(target._id)).passwordHash, passwordHash);
  });

  it('applies promotion and demotion to the same session immediately', async () => {
    const session = cookie(target);
    const mine = () => request(app).get('/api/events/mine').set('Cookie', session);
    assert.equal((await mine()).status, 403);
    assert.equal((await patch({ role: 'Organizer' })).status, 200);
    assert.equal((await mine()).status, 200);
    assert.equal((await patch({ role: 'Attendee' })).status, 200);
    assert.equal((await mine()).status, 403);
    assert.equal((await patch({ role: 'Admin' })).status, 200);
    assert.equal((await request(app).patch(`/api/admin/users/${admin._id}`).set('Cookie', session).send({ role: 'Attendee' })).status, 200);
    assert.equal((await patch({ active: false })).status, 403);
  });

  it('rejects privilege escalation and invalid fields without partial writes or leaks', async () => {
    const unauthorized = await request(app).patch(`/api/admin/users/${admin._id}`).set('Cookie', cookie(target, 'Admin')).send({ active: false });
    assert.equal(unauthorized.status, 403);
    assert.equal((await patch({ active: false, role: 'Unknown' })).status, 422);
    assert.equal((await User.findById(target._id)).active, true);
    assert.equal((await patch({ active: false, passwordHash: 'replaced' })).status, 422);
    assert.equal((await User.findById(target._id)).active, true);
    const updated = await patch({ active: false, role: 'Organizer' });
    assert.equal(updated.status, 200);
    assert.deepEqual(Object.keys(updated.body.user).sort(), ['active', 'email', 'id', 'name', 'role']);
    const stored = await User.findById(target._id);
    assert.equal(stored.role, 'Organizer');
    assert.equal(stored.active, false);
    assert.equal(stored.passwordHash, passwordHash);
  });
});
