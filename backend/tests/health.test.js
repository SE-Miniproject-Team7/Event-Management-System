jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'),
  connection: { ...jest.requireActual('mongoose').connection, readyState: 1 },
}));

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

let log;
beforeEach(() => {
  log = jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  log.mockRestore();
});

test('GET /health returns status, database state, and process uptime when ready', async () => {
  mongoose.connection.readyState = 1;
  const res = await request(app).get('/health');

  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  expect(res.body.uptimeSeconds).toEqual(expect.any(Number));
});

test('GET /health returns 503 when the database is unavailable', async () => {
  mongoose.connection.readyState = 0;
  const res = await request(app).get('/health');

  expect(res.status).toBe(503);
  expect(res.body).toMatchObject({ status: 'degraded', db: 'down' });
});

test('request logs include safe structured request metadata and exclude query data', async () => {
  mongoose.connection.readyState = 1;
  const res = await request(app).get('/health?token=never-log-this');

  const requestId = res.headers['x-request-id'];
  expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
  const logLine = log.mock.calls.map(([line]) => line)
    .map((line) => JSON.parse(line))
    .find((entry) => entry.requestId === requestId);
  expect(logLine).toMatchObject({
    level: 'info',
    requestId,
    route: '/health',
    method: 'GET',
    status: 200,
  });
  expect(logLine.durationMs).toEqual(expect.any(Number));
  expect(logLine.time).toEqual(expect.any(String));
  expect(JSON.stringify(logLine)).not.toContain('never-log-this');
});
