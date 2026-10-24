const request = require('supertest');
const app = require('../src/app');

// These need no database: the auth guard rejects before any query runs.
describe('events and categories endpoints are protected', () => {
  test('POST /api/events without login returns 401', async () => {
    const res = await request(app).post('/api/events').send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('GET /api/events/pending without login returns 401', async () => {
    const res = await request(app).get('/api/events/pending');
    expect(res.status).toBe(401);
  });

  test('PATCH /api/events/:id/approval without login returns 401', async () => {
    const res = await request(app).patch('/api/events/64b000000000000000000001/approval').send({ decision: 'approve' });
    expect(res.status).toBe(401);
  });

  test('POST /api/admin/categories without login returns 401', async () => {
    const res = await request(app).post('/api/admin/categories').send({ name: 'Seminar' });
    expect(res.status).toBe(401);
  });
});
