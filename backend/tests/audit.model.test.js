const AuditLog = require('../src/models/AuditLog');
test('audit records have a 90-day timestamp TTL index', () => {
  expect(AuditLog.schema.indexes()).toContainEqual([
    { timestamp: 1 }, expect.objectContaining({ expireAfterSeconds: 7776000 }),
  ]);
});
test('schema rejects undeclared credential fields and arbitrary action strings', async () => {
  expect(() => new AuditLog({ action: 'LOGIN', ip: '127.0.0.1', password: 'secret' })).toThrow();
  const error = await new AuditLog({ action: 'untrusted text', ip: '127.0.0.1' }).validate().catch(value => value);
  expect(error.errors.action).toBeDefined();
});
