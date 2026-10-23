import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth.js';
import eventRoutes from './routes/events.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173' }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ems-api' }));
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT || 5000);
try {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ems');
  app.listen(port, () => console.log(`EMS API listening on http://localhost:${port}`));
} catch (err) {
  console.error('MongoDB connection failed. Check MONGODB_URI and that MongoDB is running.', err.message);
  process.exit(1);
}
