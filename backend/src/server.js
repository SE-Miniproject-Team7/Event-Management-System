require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const AuditLog = require('./models/AuditLog');

const PORT = process.env.PORT || 5000;

// # CHANGED: Start the API only after MongoDB connects successfully.
mongoose.connect(process.env.MONGO_URI).then(async () => {
  await AuditLog.init();
  console.log(JSON.stringify({ level: 'info', event: 'database_connected', time: new Date().toISOString() }));
  app.listen(PORT, () => console.log(JSON.stringify({
    level: 'info', event: 'server_listening', time: new Date().toISOString(), port: Number(PORT),
  })));
}).catch(() => {
  console.error(JSON.stringify({ level: 'fatal', event: 'database_startup_failed', time: new Date().toISOString() }));
  process.exit(1);
});
