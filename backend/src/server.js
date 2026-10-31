require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./app');
const AuditLog = require('./models/AuditLog');

const PORT = process.env.PORT || 5000;

// # CHANGED: Start the API only after MongoDB connects successfully.
mongoose.connect(process.env.MONGO_URI).then(async () => {
  await AuditLog.init();
  console.log('MongoDB connected');
  app.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));
}).catch(() => { console.error('Database startup failed. Check database availability and environment configuration.'); process.exit(1); });
