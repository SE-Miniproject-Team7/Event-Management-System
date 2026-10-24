const request = require('supertest');
const app = require('../src/app');

// These checks need no database: the auth guard rejects before any query runs.
describe('registrations endpoints require login', () => {
  test('POST /api/events/:id/registrations returns 401 without a cookie', async () => {
    const res = await request(app).post('/api/events/64b000000000000000000001/registrations');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  test('GET /api/registrations/me returns 401 without a cookie', async () => {
    const res = await request(app).get('/api/registrations/me');
    expect(res.status).toBe(401);
  });

  test('DELETE /api/registrations/:id returns 401 without a cookie', async () => {
    const res = await request(app).delete('/api/registrations/64b000000000000000000001');
    expect(res.status).toBe(401);
  });
});
