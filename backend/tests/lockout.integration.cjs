// Run with npm run test:integration and a dedicated MONGO_TEST_URI.
const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const cookieParser = require('cookie-parser');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const authRoutes = require('../src/modules/auth/auth.routes');
const errorHandler = require('../src/middleware/errorHandler');

describe('Lockout with real MongoDB', { skip: !process.env.MONGO_TEST_URI, timeout: 30000 }, () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  let user;
  let passwordHash;
  const previousSecret = process.env.JWT_SECRET;

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
    user = await User.create({ name: 'Lockout Test', email: `${randomUUID()}@test.local`, passwordHash });
  });
  afterEach(async () => {
    if (user) await User.deleteOne({ _id: user._id });
  });
  after(async () => {
    await mongoose.disconnect();
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  const login = password => request(app).post('/api/auth/login').send({ email: user.email, password });

  it('six parallel failures lock the account and a correct password cannot bypass it', async () => {
    const responses = await Promise.all(Array.from({ length: 6 }, () => login('Wrong123')));
    assert.equal(responses.filter(r => r.status === 401).length, 4);
    assert.equal(responses.filter(r => r.status === 423).length, 2);
    const stored = await User.findById(user._id);
    assert.ok(stored.lockUntil.getTime() > Date.now());
    assert.equal(stored.failedLogins, 0);
    const correct = await login('Correct123');
    assert.equal(correct.status, 423);
    assert.ok(correct.body.error.retryAfterSeconds > 0);
    assert.equal(correct.headers['set-cookie'], undefined);
  });

  it('an expired lock permits login and a successful login resets the count', async () => {
    await User.updateOne({ _id: user._id }, { $set: { lockUntil: new Date(Date.now() - 1000), failedLogins: 4 } });
    assert.equal((await login('Wrong123')).status, 401);
    assert.equal((await User.findById(user._id)).failedLogins, 1);
    assert.equal((await login('Correct123')).status, 200);
    const stored = await User.findById(user._id);
    assert.equal(stored.failedLogins, 0);
    assert.equal(stored.lockUntil, null);
  });

  it('requests during a lock do not extend its duration', async () => {
    const lockUntil = new Date(Date.now() + 600000);
    await User.updateOne({ _id: user._id }, { $set: { lockUntil } });
    const responses = await Promise.all([login('Wrong123'), login('Correct123')]);
    assert.deepEqual(responses.map(r => r.status), [423, 423]);
    assert.equal((await User.findById(user._id)).lockUntil.getTime(), lockUntil.getTime());
  });
});
