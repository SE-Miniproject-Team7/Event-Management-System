const fs = require('node:fs/promises');
const path = require('node:path');
const mongoose = require('mongoose');
const { EJSON } = require('bson');

const FORMAT = 'ems-ejson-backup-v1';

function databaseNameFromUri(uri) {
  const name = new URL(uri).pathname.replace(/^\//, '').split('/')[0];
  if (!name) throw new Error('MongoDB URI must include a database name');
  return name;
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

async function createBackup({ uri, file, databaseName }) {
  if (!uri || !file) throw new Error('A MongoDB URI and backup file path are required');
  await mongoose.connect(uri, databaseName ? { dbName: databaseName } : {});
  try {
    const db = mongoose.connection.db;
    const names = (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((item) => item.name)
      .filter((name) => !name.startsWith('system.'));
    const collections = [];
    for (const name of names) {
      const collection = db.collection(name);
      const [documents, indexes] = await Promise.all([
        collection.find({}).toArray(),
        collection.listIndexes().toArray(),
      ]);
      collections.push({
        name,
        documents,
        indexes: indexes.filter((index) => index.name !== '_id_').map((index) => {
          const options = { ...index };
          delete options.key;
          delete options.ns;
          delete options.v;
          return { key: index.key, options };
        }),
      });
    }

    const archive = {
      format: FORMAT,
      sourceDatabase: db.databaseName,
      createdAt: new Date(),
      collections,
    };
    const output = path.resolve(file);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, EJSON.stringify(archive, { relaxed: false }), { mode: 0o600 });
    await fs.chmod(output, 0o600);
    return { file: output, collectionCount: collections.length };
  } finally {
    await disconnect();
  }
}

async function restoreBackup({ uri, file, databaseName }) {
  if (!uri || !file) throw new Error('A restore URI and backup file path are required');
  const targetName = databaseName || databaseNameFromUri(uri);
  if (!/^ems_test_[a-z0-9_-]+$/i.test(targetName)) {
    throw new Error('Restore is limited to an empty ems_test_* database');
  }
  const archive = EJSON.parse(await fs.readFile(file, 'utf8'));
  if (archive.format !== FORMAT || !Array.isArray(archive.collections)) {
    throw new Error('Unsupported or invalid EMS backup file');
  }

  await mongoose.connect(uri, { dbName: targetName });
  try {
    const db = mongoose.connection.db;
    const existing = (await db.listCollections({}, { nameOnly: true }).toArray())
      .filter((item) => !item.name.startsWith('system.'));
    if (existing.length) {
      throw new Error('Restore target must be an empty database');
    }

    for (const item of archive.collections) {
      if (!/^[A-Za-z0-9_-]+$/.test(item.name) || !Array.isArray(item.documents)) {
        throw new Error('Backup contains an invalid collection entry');
      }
      const collection = await db.createCollection(item.name);
      if (item.documents.length) await collection.insertMany(item.documents);
      for (const index of item.indexes || []) {
        await collection.createIndex(index.key, index.options);
      }
    }
    return { databaseName: targetName, collectionCount: archive.collections.length };
  } finally {
    await disconnect();
  }
}

async function main() {
  const command = process.argv[2];
  if (command === 'backup') {
    const uri = process.env.MONGO_URI;
    const file = process.env.BACKUP_FILE ||
      path.resolve('backups', `ems-${new Date().toISOString().replaceAll(':', '-')}.ejson`);
    const result = await createBackup({ uri, file });
    console.log(JSON.stringify({ level: 'info', event: 'database_backup_created', ...result }));
    return;
  }
  if (command === 'restore') {
    const uri = process.env.RESTORE_URI;
    const file = process.env.BACKUP_FILE;
    const result = await restoreBackup({ uri, file });
    console.log(JSON.stringify({ level: 'info', event: 'database_backup_restored', ...result }));
    return;
  }
  throw new Error('Usage: node scripts/databaseBackup.js <backup|restore>');
}

if (require.main === module) {
  main().catch((error) => {
    console.error(JSON.stringify({ level: 'error', event: 'database_maintenance_failed' }));
    process.exitCode = 1;
  });
}

module.exports = { createBackup, restoreBackup, databaseNameFromUri };
