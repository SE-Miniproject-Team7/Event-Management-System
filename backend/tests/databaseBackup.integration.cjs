const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const mongoose = require('mongoose');
const { ObjectId } = require('bson');
const { createBackup, restoreBackup } = require('../scripts/databaseBackup');

describe('database backup and restore with MongoDB', {
  skip: !process.env.MONGO_TEST_URI,
  timeout: 60000,
}, () => {
  const sourceDb = `ems_test_backup_${randomUUID().replaceAll('-', '')}`;
  const targetDb = `ems_test_restore_${randomUUID().replaceAll('-', '')}`;
  const directory = path.join(os.tmpdir(), `ems-backup-${randomUUID()}`);
  const file = path.join(directory, 'snapshot.ejson');
  const sampleId = new ObjectId();
  const sampleDate = new Date('2026-11-01T12:00:00.000Z');

  before(async () => {
    await fs.mkdir(directory, { recursive: true });
    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: sourceDb });
    await mongoose.connection.db.collection('attendees').insertMany([
      { _id: sampleId, name: 'Backup Sample', role: 'Attendee', createdAt: sampleDate },
      { _id: new ObjectId(), name: 'Backup Count', role: 'Attendee', createdAt: sampleDate },
    ]);
    await mongoose.connection.db.collection('events').insertOne({
      _id: new ObjectId(), title: 'Backup Event', capacity: 10, createdAt: sampleDate,
    });
    await mongoose.disconnect();
  });

  after(async () => {
    for (const dbName of [sourceDb, targetDb]) {
      try {
        await mongoose.connect(process.env.MONGO_TEST_URI, { dbName });
        await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    }
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('restores collection counts, BSON dates, ObjectIds, and sample documents', async () => {
    const backup = await createBackup({
      uri: process.env.MONGO_TEST_URI,
      databaseName: sourceDb,
      file,
    });
    assert.equal(backup.collectionCount, 2);
    // Windows reports DOS permission bits; POSIX mode checks apply on Unix.
    if (process.platform !== 'win32') {
      assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
    }

    const restored = await restoreBackup({
      uri: process.env.MONGO_TEST_URI,
      databaseName: targetDb,
      file,
    });
    assert.equal(restored.collectionCount, 2);

    await mongoose.connect(process.env.MONGO_TEST_URI, { dbName: targetDb });
    const db = mongoose.connection.db;
    assert.equal(await db.collection('attendees').countDocuments(), 2);
    assert.equal(await db.collection('events').countDocuments(), 1);
    const sample = await db.collection('attendees').findOne({ _id: sampleId });
    assert.equal(sample.name, 'Backup Sample');
    assert.equal(sample.role, 'Attendee');
    assert.equal(sample.createdAt.toISOString(), sampleDate.toISOString());
    await mongoose.disconnect();
  });

  it('refuses a restore target outside the guarded test database namespace', async () => {
    await assert.rejects(
      restoreBackup({ uri: process.env.MONGO_TEST_URI, databaseName: 'production', file }),
      /empty ems_test_\* database/,
    );
  });
});
