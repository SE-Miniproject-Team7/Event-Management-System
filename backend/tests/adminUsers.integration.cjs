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
  it('discovers users by name/email with safe fields and pagination', async () => {
    const res = await request(app).get('/api/admin/users').query({ q: target.email, page: 1 }).set('Cookie', cookie(admin));
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 1);
    assert.equal(res.body.items[0].id, String(target._id));
    assert.deepEqual(Object.keys(res.body.items[0]).sort(), ['active', 'email', 'id', 'name', 'role']);
    const literal = await request(app).get('/api/admin/users').query({ q: '.*(' }).set('Cookie', cookie(admin));
    assert.equal(literal.status, 200);
    assert.equal(literal.body.total, 0);
    const denied = await request(app).get('/api/admin/users').set('Cookie', cookie(target, 'Admin'));
    assert.equal(denied.status, 403);
  });

  it('returns the second page of a real matching result set', async () => {
    const needle = randomUUID();
    const accounts = await User.create(Array.from({ length: 11 }, (_, i) => ({
      name: `Page Account ${String(i).padStart(2, '0')}`,
      email: `${needle}-${i}@test.local`, passwordHash, role: 'Attendee',
    })));
    try {
      const first = await request(app).get('/api/admin/users').query({ q: needle, page: 1 }).set('Cookie', cookie(admin));
      const second = await request(app).get('/api/admin/users').query({ q: needle, page: 2 }).set('Cookie', cookie(admin));
      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(first.body.total, 11);
      assert.equal(first.body.items.length, 10);
      assert.equal(second.body.items.length, 1);
      assert.equal(second.body.items[0].name, 'Page Account 10');
    } finally {
      await User.deleteMany({ _id: { $in: accounts.map(account => account._id) } });
    }
  });

  it('rejects deactivation/demotion of the last active admin, ignoring inactive admins', async () => {
    await User.updateOne({ _id: target._id }, { $set: { role: 'Admin', active: false } });
    for (const body of [{ active: false }, { role: 'Attendee' }]) {
      const res = await request(app).patch(`/api/admin/users/${admin._id}`).set('Cookie', cookie(admin)).send(body);
      assert.equal(res.status, 409);
      assert.equal(res.body.error.code, 'LAST_ACTIVE_ADMIN');
    }
    assert.equal(await User.countDocuments({ role: 'Admin', active: true }), 1);
  });

  it('serializes simultaneous self-demotions so one active admin always survives', async () => {
    await User.updateOne({ _id: target._id }, { $set: { role: 'Admin' } });
    // Repeat with both deactivation and role changes; use real MongoDB transactions.
    for (const changes of [{ role: 'Attendee' }, { active: false }, { role: 'Organizer', active: false }]) {
      await User.updateMany({ _id: { $in: [admin._id, target._id] } }, { $set: { role: 'Admin', active: true } });
      const results = await Promise.all([admin, target].map(user =>
        request(app).patch(`/api/admin/users/${user._id}`).set('Cookie', cookie(user, 'Admin')).send(changes)
      ));
      assert.deepEqual(results.map(res => res.status).sort(), [200, 409]);
      assert.equal(await User.countDocuments({ role: 'Admin', active: true }), 1);
    }
  });

});
