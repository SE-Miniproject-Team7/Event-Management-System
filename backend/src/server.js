
require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const AuditLog = require('./models/AuditLog');
const {
  startNotificationWorker,
  stopNotificationWorker,
} = require('./modules/notifications/notification.worker');

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI).then(async () => {
  await AuditLog.init();

  console.log(JSON.stringify({ level: 'info', event: 'database_connected' }));

  startNotificationWorker();

  const server = app.listen(PORT, () => {
    console.log(JSON.stringify({ level: 'info', event: 'api_listening', port: Number(PORT) }));
  });

  const shutdown = async () => {
    stopNotificationWorker();

    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}).catch(() => {
  console.error(JSON.stringify({
    level: 'error',
    event: 'database_startup_failed',
  }));
  process.exit(1);
});
