jest.mock('../src/models/User', () => ({ findById: jest.fn(), findOneAndUpdate: jest.fn() }));

const User = require('../src/models/User');
const { checkLock, recordLoginAttempt } = require('../src/modules/auth/lockout');

const makeUser = (overrides = {}) => ({
  _id: '64b0000000000000000000a1',
  active: true,
  passwordHash: 'hashed-password',
  failedLogins: 0,
  lockUntil: null,
  ...overrides,
});

beforeEach(() => jest.resetAllMocks());

describe('authentication lockout service', () => {
  test('successful password resets failed attempts and clears the lock', async () => {
    const user = makeUser({ failedLogins: 3, lockUntil: new Date(Date.now() - 1000) });
    const updated = makeUser();
    User.findOneAndUpdate.mockResolvedValue(updated);

    await expect(recordLoginAttempt(user, true)).resolves.toBe(updated);

    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: user._id, passwordHash: user.passwordHash }),
      { $set: { failedLogins: 0, lockUntil: null } },
      { returnDocument: 'after' }
    );
  });

  test('failed password increments the existing failure count', async () => {
    const user = makeUser({ failedLogins: 2 });
    const updated = makeUser({ failedLogins: 3 });
    User.findOneAndUpdate.mockResolvedValue(updated);

    await expect(recordLoginAttempt(user, false)).resolves.toBe(updated);
    expect(User.findOneAndUpdate.mock.calls[0][1].$set).toEqual({
      failedLogins: 3,
      lockUntil: null,
    });
  });

  test('fifth consecutive failure locks the account and returns retry metadata', async () => {
    const user = makeUser({ failedLogins: 4 });
    const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
    User.findOneAndUpdate.mockResolvedValue(makeUser({ failedLogins: 0, lockUntil }));

    const error = await recordLoginAttempt(user, false).catch(value => value);
    expect(error.status).toBe(423);
    expect(error.code).toBe('ACCOUNT_LOCKED');
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
    expect(User.findOneAndUpdate.mock.calls[0][1].$set.lockUntil).toBeInstanceOf(Date);
  });

  test('checkLock rejects an active lock with a positive retry delay', () => {
    const lockUntil = new Date(Date.now() + 30_000);
    try {
      checkLock(makeUser({ lockUntil }));
      throw new Error('Expected checkLock to throw');
    } catch (error) {
      expect(error.status).toBe(423);
      expect(error.code).toBe('ACCOUNT_LOCKED');
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    }
  });

  test('expired locks start a fresh failure count', async () => {
    const user = makeUser({ failedLogins: 4, lockUntil: new Date(Date.now() - 1000) });
    User.findOneAndUpdate.mockResolvedValue(makeUser({ failedLogins: 1 }));

    await recordLoginAttempt(user, false);
    expect(User.findOneAndUpdate.mock.calls[0][1].$set).toEqual({
      failedLogins: 1,
      lockUntil: null,
    });
  });

  test('compare-and-set conflicts reload the account and retry', async () => {
    const original = makeUser();
    const reloaded = makeUser({ failedLogins: 1 });
    const updated = makeUser({ failedLogins: 2 });
    User.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce(updated);
    User.findById.mockResolvedValue(reloaded);

    await expect(recordLoginAttempt(original, false)).resolves.toBe(updated);
    expect(User.findById).toHaveBeenCalledWith(original._id);
    expect(User.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  test('inactive accounts cannot record login attempts', async () => {
    await expect(recordLoginAttempt(makeUser({ active: false }), false)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(User.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('password changes during a retry stop the old attempt', async () => {
    const original = makeUser();
    User.findOneAndUpdate.mockResolvedValue(null);
    User.findById.mockResolvedValue(makeUser({ passwordHash: 'new-hash' }));

    await expect(recordLoginAttempt(original, false)).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
    expect(User.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });
});
