import { Router } from 'express';
import mongoose from 'mongoose';
import Event from '../models/Event.js';
import { auth, allow } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const filter = { status: 'Published' };
    if (req.query.search) filter.name = { $regex: String(req.query.search).slice(0, 80), $options: 'i' };
    const events = await Event.find(filter).sort({ date: 1 }).limit(100).lean();
    res.json({ events });
  } catch (err) { next(err); }
});

router.get('/manage/all', auth, allow('Organizer', 'Admin'), async (req, res, next) => {
  try {
    const filter = req.user.role === 'Admin' ? {} : { createdBy: req.user._id };
    const events = await Event.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    res.json({ events });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid event ID' });
    const event = await Event.findOne({ _id: req.params.id, status: 'Published' }).lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });
    res.json({ event });
  } catch (err) { next(err); }
});

router.post('/', auth, allow('Organizer', 'Admin'), async (req, res, next) => {
  try {
    const { name, type, description, eligibility, inCharge, date, venue, capacity, registrationDeadline } = req.body;
    if (!name?.trim() || !type?.trim() || !description?.trim() || !inCharge?.trim() || !venue?.trim() ||
        !Number.isInteger(Number(capacity)) || Number(capacity) < 1 ||
        !Number.isFinite(Date.parse(date)) || !Number.isFinite(Date.parse(registrationDeadline))) {
      return res.status(400).json({ message: 'Provide valid required fields, dates and a positive integer capacity' });
    }
    const event = await Event.create({
      name, type, description, eligibility, inCharge, date, venue, capacity: Number(capacity),
      registrationDeadline, status: 'Pending Approval', createdBy: req.user._id
    });
    res.status(201).json({ event });
  } catch (err) { next(err); }
});

router.patch('/:id/approval', auth, allow('Admin'), async (req, res, next) => {
  try {
    if (!['Published', 'Rejected'].includes(req.body.status)) return res.status(400).json({ message: 'Status must be Published or Rejected' });
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, status: 'Pending Approval' },
      { status: req.body.status }, { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ message: 'Pending event not found' });
    res.json({ event });
  } catch (err) { next(err); }
});

router.patch('/:id', auth, allow('Organizer', 'Admin'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (req.user.role !== 'Admin' && String(event.createdBy) !== String(req.user._id)) return res.status(403).json({ message: 'You can edit only your own events' });
    const allowed = ['name', 'type', 'description', 'eligibility', 'inCharge', 'date', 'venue', 'capacity', 'registrationDeadline'];
    for (const key of allowed) if (req.body[key] !== undefined) event[key] = req.body[key];
    await event.save();
    res.json({ event });
  } catch (err) { next(err); }
});

router.delete('/:id', auth, allow('Organizer', 'Admin'), async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (req.user.role !== 'Admin' && String(event.createdBy) !== String(req.user._id)) return res.status(403).json({ message: 'You can cancel only your own events' });
    event.status = 'Cancelled';
    await event.save();
    res.json({ message: 'Event cancelled', event });
  } catch (err) { next(err); }
});

export default router;
