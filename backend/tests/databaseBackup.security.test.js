const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('backup CLI suppresses credential-bearing database error messages', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ems-backup-security-'));
  const preload = path.join(directory, 'preload.cjs');
  try {
    fs.writeFileSync(preload, `const mongoose = require(${JSON.stringify(require.resolve('mongoose'))});
      mongoose.connect = async () => { throw new Error('SYNTHETIC-PRIVATE-URI-AND-PASSWORD'); };`);
    const result = spawnSync(process.execPath,
      ['--require', preload, path.resolve(__dirname, '../scripts/databaseBackup.js'), 'backup'], {
        cwd: directory, encoding: 'utf8', timeout: 10000,
        env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1/ems_test_synthetic', BACKUP_FILE: path.join(directory, 'unused.ejson') },
      });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).not.toContain('SYNTHETIC-PRIVATE');
    expect(JSON.parse(result.stderr.trim())).toEqual({ level: 'error', event: 'database_maintenance_failed' });
  } finally {
    fs.unlinkSync(preload);
    fs.rmdirSync(directory);
  }
});
