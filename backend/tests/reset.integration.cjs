const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const User = require('../src/models/User');
const Job = require('../src/models/NotificationJob');
const { requestReset, resetPassword, hashToken } = require('../src/modules/auth/reset.service');
const app = require('../src/app');
const dbName = 'ems_test_reset_' + randomUUID().replaceAll('-', '');
let user;
before(async () => {
  if (!process.env.MONGO_TEST_URI || !new URL(process.env.MONGO_TEST_URI).pathname.startsWith('/ems_test_')) throw new Error('Dedicated test database required');
  await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
  await Promise.all([User.init(), Job.init()]);
  user = await User.create({ name: 'Reset Attendee', email: 'reset@example.test', passwordHash: await bcrypt.hash('OldPassword123', 12) });
});
after(async () => {
  if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
async function latestToken() {
  const job = await Job.findOne({ type: 'PASSWORD_RESET' }).sort({ createdAt: -1 });
  return new URL(job.payload.resetUrl).hash.slice(1);
}
test('requests have identical responses for existing and unknown accounts and never expose tokens', async () => {
  const a = await request(app).post('/api/auth/forgot-password').send({ email: user.email });
  const b = await request(app).post('/api/auth/forgot-password').send({ email: 'unknown@example.test' });
  assert.equal(a.status, 202); assert.deepEqual(a.body, b.body);
  const token = await latestToken();
  assert.ok(!JSON.stringify(a.body).includes(token));
  const stored = await User.findById(user._id).select('+resetTokenHash +resetTokenExpiresAt');
  assert.equal(stored.resetTokenHash, hashToken(token));
  assert.ok(stored.resetTokenExpiresAt - Date.now() <= 1800000);
});
test('one concurrent use succeeds, reuse fails and only the new password works', async () => {
  const token = await latestToken();
  const outcomes = await Promise.allSettled([resetPassword(token, 'NewPassword123'), resetPassword(token, 'NewPassword123')]);
  assert.equal(outcomes.filter(x => x.status === 'fulfilled').length, 1);
  const stored = await User.findById(user._id);
  assert.ok(await bcrypt.compare('NewPassword123', stored.passwordHash));
  assert.equal(await bcrypt.compare('OldPassword123', stored.passwordHash), false);
  await assert.rejects(resetPassword(token, 'Another123'), e => e.code === 'TOKEN_INVALID');
});
test('expired and superseded tokens fail; invalid passwords do not consume valid tokens', async () => {
  await requestReset(user.email); const old = await latestToken();
  await requestReset(user.email); const current = await latestToken();
  await assert.rejects(resetPassword(old, 'NewPassword123'), e => e.code === 'TOKEN_INVALID');
  await assert.rejects(resetPassword(current, 'weak'), e => e.status === 422 || e.statusCode === 422);
  await User.updateOne({ _id: user._id }, { $set: { resetTokenExpiresAt: new Date(Date.now() - 1) } });
  await assert.rejects(resetPassword(current, 'NewPassword123'), e => e.code === 'TOKEN_INVALID');
});
test('queue failure rolls back token replacement', async () => {
  await requestReset(user.email); const token = await latestToken();
  const create = Job.create;
  Job.create = async () => { throw new Error('Synthetic queue failure'); };
  try { await assert.rejects(requestReset(user.email)); } finally { Job.create = create; }
  const stored = await User.findById(user._id).select('+resetTokenHash');
  assert.equal(stored.resetTokenHash, hashToken(token));
});
test('invalid inputs and inactive accounts cannot reset passwords', async () => {
  assert.equal((await request(app).post('/api/auth/forgot-password').send({ email: { $ne: null } })).status, 422);
  assert.equal((await request(app).post('/api/auth/reset-password').send({ token: 'bad', newPassword: 'NewPassword123' })).status, 400);
  await requestReset(user.email); const token = await latestToken();
  await User.updateOne({ _id: user._id }, { $set: { active: false } });
  await assert.rejects(resetPassword(token, 'NewPassword123'), e => e.code === 'TOKEN_INVALID');
});
