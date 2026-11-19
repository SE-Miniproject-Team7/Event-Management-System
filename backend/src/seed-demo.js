require('dotenv').config();

const bcrypt = require('bcryptjs');
const { randomBytes } = require('node:crypto');
const mongoose = require('mongoose');
const Category = require('./models/Category');
const Event = require('./models/Event');
const Registration = require('./models/Registration');
const User = require('./models/User');

const accounts = [
  ['admin', 'Admin'],
  ['organizer', 'Organizer'],
  ['attendee1', 'Attendee'],
  ['attendee2', 'Attendee'],
];

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!/^mongodb:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/ems_demo\?[^#]*\breplicaSet=[\w-]+(?:&|$)/.test(uri)) {
    throw new Error('Set MONGO_URI to a localhost replica set using the ems_demo database.');
  }
  if (!process.env.SEED_PASSWORD) {
    throw new Error('Set SEED_PASSWORD to a password for the local demo accounts.');
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 7000 });
  await Promise.all([Category.init(), Event.init(), Registration.init(), User.init()]);
  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 12);
  const users = {};
  for (const [handle, role] of accounts) {
    const email = `demo.${handle}@ems.local`;
    users[handle] = await User.findOneAndUpdate(
      { email },
      { $set: { name: `Demo ${handle}`, role, active: true, passwordHash, failedLogins: 0, lockUntil: null } },
      { upsert: true, returnDocument: 'after', runValidators: true },
    );
  }

  const category = await Category.findOneAndUpdate(
    { name: 'Campus Demo' },
    { $set: { active: true } },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const runId = randomBytes(5).toString('hex');
  const now = Date.now();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const names = ['Approval practice', 'One-seat workshop', 'Check-in and reports'];
      const events = await Event.create(names.map((name, index) => ({
        title: `Demo ${name} ${runId}`,
        description: 'Synthetic campus event for the local EMS demonstration.',
        categoryId: category._id,
        organizerId: users.organizer._id,
        venue: 'Campus Demo Room',
        startAt: new Date(now + 45 * 60_000),
        endAt: new Date(now + 120 * 60_000),
        registrationDeadline: new Date(now + 30 * 60_000),
        capacity: index === 1 ? 1 : 10,
        seatsTaken: index === 2 ? 1 : 0,
        status: index === 0 ? 'Pending Approval' : 'Published',
      })), { session, ordered: true });
      await Registration.create([{
        eventId: events[2]._id,
        userId: users.attendee1._id,
        regCode: `DEMO-${runId}`,
        status: 'Confirmed',
      }], { session });
    });
  } finally {
    await session.endSession();
  }

  console.log(`Demo seed completed. Search for ${runId} to find this run's events.`);
  console.log(`Check-in code: DEMO-${runId}`);
  console.log('Logins: demo.admin@ems.local, demo.organizer@ems.local, demo.attendee1@ems.local, demo.attendee2@ems.local');
  console.log('All four accounts use the local SEED_PASSWORD.');
}

main()
  .catch(error => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
