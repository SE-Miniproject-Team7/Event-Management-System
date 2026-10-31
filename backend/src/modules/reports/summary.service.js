const Event = require('../../models/Event');
const User = require('../../models/User');
const Registration = require('../../models/Registration');

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;
const eventStatuses = ['Pending Approval', 'Published', 'Rejected', 'Cancelled'];
const userRoles = ['Attendee', 'Organizer', 'Admin'];
function counts(keys, rows) {
  const result = Object.fromEntries(keys.map(key => [key, 0]));
  for (const row of rows) {
    if (Object.hasOwn(result, row._id)) result[row._id] = row.count;
  }
  return result;
}

// Today (partial) plus the previous 29 calendar days, displayed in IST.
module.exports = async function getSummary(now = new Date()) {
  const todayIST = new Date(now.getTime() + IST_OFFSET).toISOString().slice(0, 10);
  const midnight = new Date(`${todayIST}T00:00:00+05:30`);
  const start = new Date(midnight.getTime() - 29 * DAY_MS);
  const [events, users, registrations] = await Promise.all([
    Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Registration.aggregate([
      { $match: { createdAt: { $gte: start, $lte: now } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } },
        count: { $sum: 1 },
      } },
    ]),
  ]);
  const daily = new Map(registrations.map(row => [row._id, row.count]));
  const registrationsPerDay = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start.getTime() + index * DAY_MS + IST_OFFSET).toISOString().slice(0, 10);
    return { date, count: daily.get(date) || 0 };
  });
  return {
    eventsByStatus: counts(eventStatuses, events),
    usersByRole: counts(userRoles, users),
    registrationsPerDay,
  };
};
