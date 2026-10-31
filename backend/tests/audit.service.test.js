jest.mock('../src/models/AuditLog', () => ({ create: jest.fn() }));
const AuditLog = require('../src/models/AuditLog');
const { recordAudit, recordCheckIn } = require('../src/modules/audit/audit.service');
const actor = '64b0000000000000000000a1';
const target = '64b0000000000000000000e1';
beforeEach(() => { jest.resetAllMocks(); AuditLog.create.mockResolvedValue([]); });
test('stores only allowlisted fields, server time and effective IP', async () => {
  const req = { user: { _id: actor }, ip: '::ffff:127.0.0.1',
    body: { password: 'never-log-password', token: 'never-log-token' },
    headers: { authorization: 'never-log-header', 'x-forwarded-for': '1.2.3.4' }, cookies: { ems_token: 'never-log-cookie' } };
  const session = {};
  await recordAudit(req, 'EVENT_APPROVED', { targetId: target, targetType: 'Event', session,
    password: 'never-log-option', timestamp: new Date(0), metadata: req });
  const [[entry], options] = AuditLog.create.mock.calls[0];
  expect(entry).toEqual({ userId: actor, action: 'EVENT_APPROVED', ip: '::ffff:127.0.0.1',
    timestamp: expect.any(Date), targetId: target, targetType: 'Event' });
  expect(entry.timestamp.getTime()).toBeGreaterThan(Date.now() - 10000);
  expect(options.session).toBe(session);
  expect(JSON.stringify(entry)).not.toContain('never-log');
});
test('unknown login identity is null, not the supplied email or ID', async () => {
  await recordAudit({ ip: '127.0.0.1', body: { userId: actor, email: 'private@test.local' } }, 'LOGIN_FAILED', { userId: null });
  expect(AuditLog.create.mock.calls[0][0][0].userId).toBeNull();
});
test('does not accept arbitrary action text', async () => {
  await expect(recordAudit({ ip: '127.0.0.1' }, 'password-from-request')).rejects.toThrow('Unsupported audit action');
  expect(AuditLog.create).not.toHaveBeenCalled();
});
test('audit failures are sanitized and propagated, not silently ignored', async () => {
  AuditLog.create.mockRejectedValue(new Error('password=private-token'));
  const error = await recordAudit({ ip: '127.0.0.1' }, 'LOGIN_FAILED').catch(value => value);
  expect(error.status).toBe(503);
  expect(error.code).toBe('AUDIT_UNAVAILABLE');
  expect(error.message).not.toContain('private-token');
});
test('check-in hook accepts a completed check-in and shares its transaction', async () => {
  const session = {};
  await recordCheckIn({ user: { _id: actor }, ip: '127.0.0.1' },
    { _id: target, status: 'Checked-in', checkedInAt: new Date() }, session);
  expect(AuditLog.create).toHaveBeenCalledWith([expect.objectContaining({ action: 'CHECK_IN', targetId: target, targetType: 'Registration' })], { session });
  expect(() => recordCheckIn({}, { status: 'Confirmed' }, session)).toThrow('Only completed');
});
