
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('./models/User');
const Event = require('./models/Event');
const Category = require('./models/Category');
const Registration = require('./models/Registration');

const EVENT_COUNT = 5000;

const categoryNames = [
  'Technology',
  'Music',
  'Sports',
  'Education',
  'Business',
  'Arts',
  'Health',
  'Science',
  'Community',
  'Entertainment',
];

const eventStatuses = [
  'Pending Approval',
  'Published',
  'Rejected',
  'Cancelled',
];

async function seed() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI must be configured.');
  }

  if (!process.env.SEED_PASSWORD) {
    throw new Error(
      'Set SEED_PASSWORD in your local .env before running the seed script.'
    );
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD, 10);

  // # CHANGED: Create or update the required test accounts idempotently.
  const accountSpecs = [
    {
      name: 'Seed Admin',
      email: 'seed.admin@ems.local',
      role: 'Admin',
    },
    ...Array.from({ length: 3 }, (_, i) => ({
      name: `Seed Organizer ${i + 1}`,
      email: `seed.organizer${i + 1}@ems.local`,
      role: 'Organizer',
    })),
    ...Array.from({ length: 50 }, (_, i) => ({
      name: `Seed Attendee ${String(i + 1).padStart(2, '0')}`,
      email: `seed.attendee${String(i + 1).padStart(2, '0')}@ems.local`,
      role: 'Attendee',
    })),
  ];

  const users = [];

  for (const spec of accountSpecs) {
    const user = await User.findOneAndUpdate(
      { email: spec.email },
      {
        $set: {
          name: spec.name,
          role: spec.role,
          active: true,
        },
        $setOnInsert: {
          email: spec.email,
          passwordHash,
          failedLogins: 0,
          lockUntil: null,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    users.push(user);
  }

  const admin = users.find((user) => user.role === 'Admin');
  const organizers = users.filter((user) => user.role === 'Organizer');
  const attendees = users.filter((user) => user.role === 'Attendee');

  // # CHANGED: Create the ten required categories without duplicates.
  await Category.bulkWrite(
    categoryNames.map((name) => ({
      updateOne: {
        filter: { name },
        update: {
          $set: { active: true },
          $setOnInsert: { name },
        },
        upsert: true,
      },
    }))
  );

  const categories = await Category.find({
    name: { $in: categoryNames },
  }).sort({ name: 1 });

  const categoryByName = new Map(
    categories.map((category) => [category.name, category])
  );

  if (categories.length !== 10) {
    throw new Error(`Expected 10 categories; found ${categories.length}.`);
  }

  // # CHANGED: Generate 5,000 events across all four event statuses.
  const now = new Date();
  const eventOperations = [];

  for (let i = 0; i < EVENT_COUNT; i++) {
    const number = i + 1;
    const startAt = new Date(
      now.getTime() + ((i % 365) + 2) * 24 * 60 * 60 * 1000
    );
    startAt.setUTCHours(10, 0, 0, 0);

    const endAt = new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    const registrationDeadline = new Date(
      startAt.getTime() - 24 * 60 * 60 * 1000
    );

    const categoryName = categoryNames[i % categoryNames.length];
    const organizer = organizers[i % organizers.length];
    const status = eventStatuses[i % eventStatuses.length];

    eventOperations.push({
      updateOne: {
        filter: { title: `Seed Event ${String(number).padStart(4, '0')}` },
        update: {
          $set: {
            description: `Test event ${number} for EMS testing and load testing.`,
            categoryId: categoryByName.get(categoryName)._id,
            organizerId: organizer._id,
            venue: `Test Venue ${((i % 20) + 1)}`,
            startAt,
            endAt,
            registrationDeadline,
            capacity: 100,
            seatsTaken: number === 1 || number === 4 ? 1 : 0,
            status,
          },
          $setOnInsert: {
            title: `Seed Event ${String(number).padStart(4, '0')}`,
          },
        },
        upsert: true,
      },
    });
  }

  await Event.bulkWrite(eventOperations, { ordered: true });

  // # CHANGED: Ensure each registration status is represented.
  // Each registration uses a distinct attendee/event pair.
  const registrationSpecs = [
    { eventNumber: 1, attendeeIndex: 0, status: 'Confirmed' },
    { eventNumber: 2, attendeeIndex: 1, status: 'Waitlisted' },
    { eventNumber: 3, attendeeIndex: 2, status: 'Cancelled' },
    { eventNumber: 4, attendeeIndex: 3, status: 'Checked-in' },
  ];

  for (const spec of registrationSpecs) {
    const title = `Seed Event ${String(spec.eventNumber).padStart(4, '0')}`;
    const event = await Event.findOne({ title });

    if (!event) {
      throw new Error(`Seed event not found: ${title}`);
    }

    const attendee = attendees[spec.attendeeIndex];

    await Registration.findOneAndUpdate(
      { regCode: `SEED-REG-${String(spec.eventNumber).padStart(4, '0')}` },
      {
        $set: {
          eventId: event._id,
          userId: attendee._id,
          status: spec.status,
          waitlistPosition:
            spec.status === 'Waitlisted' ? 1 : null,
          checkedInAt:
            spec.status === 'Checked-in' ? new Date() : null,
        },
        $setOnInsert: {
          regCode: `SEED-REG-${String(spec.eventNumber).padStart(4, '0')}`,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  console.log('Seed completed successfully.');
  console.log(`Accounts: ${users.length} (1 Admin, 3 Organizers, 50 Attendees)`);
  console.log(`Categories: ${categories.length}`);
  console.log(`Events: ${EVENT_COUNT}`);
  console.log('Registrations: all four statuses represented.');
  console.log(`Admin login: ${admin.email}`);
  console.log('Use SEED_PASSWORD as the password for newly created seed accounts.');
}

seed()
  .catch(() => {
    console.error('Seed failed. Check database configuration, connectivity and seed input.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
