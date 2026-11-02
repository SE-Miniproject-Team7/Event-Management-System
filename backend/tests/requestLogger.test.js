const express = require('express');
const request = require('supertest');
const requestLogger = require('../src/middleware/requestLogger');

let log;
const app = express();
app.use(requestLogger);
app.use(express.json());
app.get('/events/:eventId', (req, res) => res.sendStatus(200));
app.use((req, res) => res.sendStatus(404));

beforeEach(() => {
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  log.mockRestore();
});

function logFor(requestId) {
  return log.mock.calls.map(([line]) => JSON.parse(line))
    .find((entry) => entry.requestId === requestId);
}

test('matched requests log the route template and safe response metadata', async () => {
  const pathSecret = 'event-secret-491';
  const querySecret = 'query-secret-825';
  const response = await request(app).get(`/events/${pathSecret}?token=${querySecret}`);
  const requestId = response.headers['x-request-id'];

  expect(response.status).toBe(200);
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(logFor(requestId)).toMatchObject({
    requestId, route: '/events/:eventId', method: 'GET', status: 200,
  });
  expect(logFor(requestId).durationMs).toEqual(expect.any(Number));
  expect(JSON.stringify(log.mock.calls)).not.toContain(pathSecret);
  expect(JSON.stringify(log.mock.calls)).not.toContain(querySecret);
});

test('unmatched paths never log path, query, credentials, or body values', async () => {
  const secrets = {
    path: 'synthetic-path-secret-719',
    query: 'synthetic-query-secret-384',
    credential: 'synthetic-credential-secret-206',
    body: 'synthetic-body-secret-573',
  };
  const response = await request(app)
    .post(`/missing/${secrets.path}?access_token=${secrets.query}`)
    .set('Authorization', `Bearer ${secrets.credential}`)
    .send({ password: secrets.body });
  const requestId = response.headers['x-request-id'];
  const entry = logFor(requestId);

  expect(response.status).toBe(404);
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(entry).toMatchObject({
    requestId, route: 'UNMATCHED_ROUTE', method: 'POST', status: 404,
  });
  expect(entry.durationMs).toEqual(expect.any(Number));
  const serializedLogs = JSON.stringify(log.mock.calls);
  for (const secret of Object.values(secrets)) {
    expect(serializedLogs).not.toContain(secret);
  }
});
