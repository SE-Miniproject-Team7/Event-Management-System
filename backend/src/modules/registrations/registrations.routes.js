
const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Event = require('../../models/Event');
const Registration = require('../../models/Registration');
const { authenticate, requireRole } = require('../../middleware/auth');
const requireOwnership = require('../../middleware/requireOwnership');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

const ACTIVE = ['Confirmed', 'Waitlisted', 'Checked-in'];

// Register for an event (Attendee).
// Confirmed if a seat is free, otherwise Waitlisted.
router.post(
  '/events/:id/registrations',
  authenticate,
  requireRole('Attendee'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    const event = await Event.findById(id);

    if (!event) {
      throw new AppError(404, 'NOT_FOUND', 'Event not found');
    }

    if (
      event.status !== 'Published' ||
      new Date() > event.registrationDeadline
    ) {
      throw new AppError(
        409,
        'EVENT_CLOSED',
        'Registration is closed for this event'
      );
    }

    const dup = await Registration.findOne({
      eventId: id,
      userId: req.user._id,
      status: { $in: ACTIVE },
    });

    if (dup) {
      throw new AppError(
        409,
        'DUPLICATE_REGISTRATION',
        'Already registered'
      );
    }

    const regCode =
      'REG-' +
      crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();

    // Atomically allocate a seat only when capacity is available.
    const seat = await Event.findOneAndUpdate(
      {
        _id: id,
        $expr: { $lt: ['$seatsTaken', '$capacity'] },
      },
      { $inc: { seatsTaken: 1 } },
      { new: true }
    );

    try {
      if (seat) {
        const reg = await Registration.create({
          eventId: id,
          userId: req.user._id,
          regCode,
          status: 'Confirmed',
        });

        return res.status(201).json({
          registrationId: reg._id,
          regCode,
          status: 'Confirmed',
        });
      }

      const position =
        (await Registration.countDocuments({
          eventId: id,
          status: 'Waitlisted',
        })) + 1;

      const reg = await Registration.create({
        eventId: id,
        userId: req.user._id,
        regCode,
        status: 'Waitlisted',
        waitlistPosition: position,
      });

      return res.status(201).json({
        registrationId: reg._id,
        regCode,
        status: 'Waitlisted',
        waitlistPosition: position,
      });
    } catch (err) {
      // Roll back the seat allocation if registration creation fails.
      if (seat) {
        await Event.updateOne(
          { _id: id },
          { $inc: { seatsTaken: -1 } }
        );
      }

      if (err.code === 11000) {
        throw new AppError(
          409,
          'DUPLICATE_REGISTRATION',
          'Already registered'
        );
      }

      throw err;
    }
  })
);

// Get the current attendee's registrations.
router.get(
  '/registrations/me',
  authenticate,
  requireRole('Attendee'),
  asyncHandler(async (req, res) => {
    const filter = { userId: req.user._id };

    if (typeof req.query.status === 'string') {
      filter.status = req.query.status;
    }

    const regs = await Registration.find(filter)
      .sort({ createdAt: -1 })
      .populate('eventId', 'title startAt venue');

    res.json({
      items: regs.map((r) => ({
        _id: r._id,
        regCode: r.regCode,
        status: r.status,
        waitlistPosition: r.waitlistPosition,
        checkedInAt: r.checkedInAt,
        event: r.eventId,
      })),
    });
  })
);

// Cancel a registration.
// Cancelling a Confirmed registration promotes the oldest Waitlisted attendee.
router.delete(
  '/registrations/:id',
  authenticate,
  requireRole('Attendee'),
  requireOwnership({
    Model: Registration,
    ownerField: 'userId',
    resourceName: 'Registration',
  }),
  asyncHandler(async (req, res) => {
    const reg = req.ownedResource;

    if (!['Confirmed', 'Waitlisted'].includes(reg.status)) {
      throw new AppError(
        409,
        'CANCEL_NOT_ALLOWED',
        'This registration cannot be cancelled'
      );
    }

    const wasConfirmed = reg.status === 'Confirmed';

    reg.status = 'Cancelled';
    reg.waitlistPosition = null;

    await reg.save();

    if (wasConfirmed) {
      const promoted = await Registration.findOneAndUpdate(
        {
          eventId: reg.eventId,
          status: 'Waitlisted',
        },
        {
          status: 'Confirmed',
          waitlistPosition: null,
        },
        {
          sort: { createdAt: 1 },
          new: true,
        }
      );

      // Release the seat if nobody is waiting.
      if (!promoted) {
        await Event.updateOne(
          { _id: reg.eventId },
          { $inc: { seatsTaken: -1 } }
        );
      }
    }

    res.json({ status: 'Cancelled' });
  })
);

module.exports = router;
