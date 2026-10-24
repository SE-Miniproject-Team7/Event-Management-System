
const requireOwnership = require('../src/middleware/requireOwnership');
const express = require('express');
const request = require('supertest');
const errorHandler = require('../src/middleware/errorHandler');

function createApp({ resource, user, allowAdmin = false, findById }) {
  const Model = {
    findById: findById || jest.fn().mockResolvedValue(resource),
  };

  const ownership = requireOwnership({
    Model,
    ownerField: 'userId',
    resourceName: 'Registration',
    allowAdmin,
  });

  const app = express();

  app.get(
    '/resources/:id',
    (req, res, next) => {
      req.user = user;
      next();
    },
    ownership,
    (req, res) => {
      res.json({ id: String(req.ownedResource._id) });
    }
  );

  app.use(errorHandler);

  return { app, Model };
}

describe('requireOwnership middleware', () => {
  const resource = {
    _id: 'resource123',
    userId: 'user123',
  };

  test('allows the owner', async () => {
    const { app } = createApp({
      resource,
      user: { _id: 'user123', role: 'Attendee' },
    });

    const res = await request(app).get('/resources/resource123');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('resource123');
  });

  test('rejects a user who does not own the resource', async () => {
    const { app } = createApp({
      resource,
      user: { _id: 'other-user', role: 'Attendee' },
    });

    const res = await request(app).get('/resources/resource123');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('returns 404 when the resource does not exist', async () => {
    const { app } = createApp({
      resource: null,
      user: { _id: 'user123', role: 'Attendee' },
    });

    const res = await request(app).get('/resources/missing');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('does not let Admin bypass ownership by default', async () => {
    const { app } = createApp({
      resource,
      user: { _id: 'admin123', role: 'Admin' },
    });

    const res = await request(app).get('/resources/resource123');

    expect(res.status).toBe(403);
  });

  test('allows Admin bypass only when explicitly enabled', async () => {
    const { app } = createApp({
      resource,
      user: { _id: 'admin123', role: 'Admin' },
      allowAdmin: true,
    });

    const res = await request(app).get('/resources/resource123');

    expect(res.status).toBe(200);
  });

  test('forwards database errors to the error handler', async () => {
    const { app } = createApp({
      resource: null,
      user: { _id: 'user123', role: 'Attendee' },
      findById: jest.fn().mockRejectedValue(
        new Error('Database unavailable')
      ),
    });

    const res = await request(app).get('/resources/resource123');

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
