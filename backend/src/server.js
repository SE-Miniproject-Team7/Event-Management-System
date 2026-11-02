
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const AuditLog = require('./models/AuditLog');
const {
  startNotificationWorker,
  stopNotificationWorker,
} = require('./modules/notifications/notification.worker');

const { startReminderScheduler, stopReminderScheduler } = require('./modules/notifications/reminder.scheduler');

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await AuditLog.init();

  console.log('MongoDB connected');

  startNotificationWorker();
  startReminderScheduler();

  const server = app.listen(PORT, () => {
    console.log(`API on http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    stopNotificationWorker();
    stopReminderScheduler();

    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(() => {
  console.error(
    'Database startup failed. Check database availability and environment configuration.'
  );
  process.exit(1);
});
