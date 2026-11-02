jest.mock('../src/models/User', () => ({ findOneAndUpdate: jest.fn() }));
jest.mock('../src/modules/notifications/notification.service', () => ({ enqueueNotification: jest.fn() }));
jest.mock('mongoose', () => ({ connection: { transaction: jest.fn() } }));
const User = require('../src/models/User');
const mongoose = require('mongoose');
const { enqueueNotification } = require('../src/modules/notifications/notification.service');
const { requestReset, resetPassword, hashToken } = require('../src/modules/auth/reset.service');
beforeEach(() => { jest.resetAllMocks(); mongoose.connection.transaction.mockImplementation(fn => fn({ testSession: true })); });
test('unknown accounts do not queue mail', async () => {
  User.findOneAndUpdate.mockResolvedValue(null);
  await requestReset('unknown@example.test');
  expect(enqueueNotification).not.toHaveBeenCalled();
});
test('reset hash and queued email share a transaction session', async () => {
  User.findOneAndUpdate.mockResolvedValue({ email: 'a@example.test' });
  await requestReset('a@example.test');
  const job = enqueueNotification.mock.calls[0][0];
  const token = new URL(job.payload.resetUrl).hash.slice(1);
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(User.findOneAndUpdate).toHaveBeenCalledWith(expect.any(Object),
    expect.objectContaining({ $set: expect.objectContaining({ resetTokenHash: hashToken(token) }) }),
    expect.objectContaining({ session: job.session }));
});
test.each([null, {}, 'bad'])('malformed tokens are rejected without database access: %p', async token => {
  await expect(resetPassword(token, 'Password123')).rejects.toMatchObject({ code: 'TOKEN_INVALID' });
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});
test.each(['short1', 'abcdefgh', '12345678', 'A1'.repeat(33)])('password policy rejects invalid password', async password => {
  await expect(resetPassword('a'.repeat(64), password)).rejects.toMatchObject({ status: 422 });
  expect(User.findOneAndUpdate).not.toHaveBeenCalled();
});
