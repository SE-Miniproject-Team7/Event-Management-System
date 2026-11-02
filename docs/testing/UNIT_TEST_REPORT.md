# Unit Test Report

Date: 2 November 2026 (IST). Tested code: `0a72a1291c8213484cd5b7ff7db829b1089f30ee`.
Environment: Windows, localhost development mode, Node.js 24.11.0, real MongoDB
8.2 replica set on 127.0.0.1:27030. CI uses its own Linux/Node 20 environment;
these reports describe this local execution, not a fresh CI run.
No public deployment or paid hosting was used. Synthetic data was isolated from
the development/demo database. No real account credentials are included.

## Results

| Runner | Tests | Passed | Failed |
|---|---:|---:|---:|
| Backend Jest | 328 | 328 | 0 |
| Frontend Vitest | 54 | 54 | 0 |
| Real MongoDB integration (reported separately) | 47 | 47 | 0 |

Backend Jest includes isolated unit tests and mocked Supertest API tests; these
are not all pure unit tests. The separate Node test runner uses real MongoDB
transactions and HTTP API calls. Passing these counts is not proof that all
44 original system test cases are complete.

Frontend ESLint and the Vite production build also passed.

## Per-file automated results

| Runner | File | Assertions | Passed | Failed |
|---|---|---:|---:|---:|
| Backend Jest | `backend/tests/events.test.js` | 84 | 84 | 0 |
| Backend Jest | `backend/tests/registrations.test.js` | 15 | 15 | 0 |
| Backend Jest | `backend/tests/auth.test.js` | 21 | 21 | 0 |
| Backend Jest | `backend/tests/notification.worker.test.js` | 15 | 15 | 0 |
| Backend Jest | `backend/tests/adminUsers.test.js` | 38 | 38 | 0 |
| Backend Jest | `backend/tests/checkin.test.js` | 31 | 31 | 0 |
| Backend Jest | `backend/tests/security.test.js` | 17 | 17 | 0 |
| Backend Jest | `backend/tests/accountRegistration.test.js` | 29 | 29 | 0 |
| Backend Jest | `backend/tests/eventReports.test.js` | 6 | 6 | 0 |
| Backend Jest | `backend/tests/lockout.test.js` | 8 | 8 | 0 |
| Backend Jest | `backend/tests/notification.service.test.js` | 9 | 9 | 0 |
| Backend Jest | `backend/tests/adminSummary.test.js` | 6 | 6 | 0 |
| Backend Jest | `backend/tests/notification.transport.test.js` | 5 | 5 | 0 |
| Backend Jest | `backend/tests/requireOwnership.test.js` | 6 | 6 | 0 |
| Backend Jest | `backend/tests/rateLimit.test.js` | 4 | 4 | 0 |
| Backend Jest | `backend/tests/reminder.scheduler.test.js` | 3 | 3 | 0 |
| Backend Jest | `backend/tests/audit.service.test.js` | 5 | 5 | 0 |
| Backend Jest | `backend/tests/users.test.js` | 4 | 4 | 0 |
| Backend Jest | `backend/tests/requestLogger.test.js` | 2 | 2 | 0 |
| Backend Jest | `backend/tests/coreMiddleware.test.js` | 5 | 5 | 0 |
| Backend Jest | `backend/tests/reset.test.js` | 9 | 9 | 0 |
| Backend Jest | `backend/tests/health.test.js` | 3 | 3 | 0 |
| Backend Jest | `backend/tests/databaseBackup.security.test.js` | 1 | 1 | 0 |
| Backend Jest | `backend/tests/audit.model.test.js` | 2 | 2 | 0 |
| Frontend Vitest | `frontend/src/App.test.jsx` | 1 | 1 | 0 |
| Frontend Vitest | `frontend/src/security.test.jsx` | 2 | 2 | 0 |
| Frontend Vitest | `frontend/src/components/QrScanner.test.jsx` | 3 | 3 | 0 |
| Frontend Vitest | `frontend/src/pages/AdminCategoriesPage.test.jsx` | 6 | 6 | 0 |
| Frontend Vitest | `frontend/src/pages/AdminSummaryPage.test.jsx` | 5 | 5 | 0 |
| Frontend Vitest | `frontend/src/pages/AdminUsersPage.test.jsx` | 6 | 6 | 0 |
| Frontend Vitest | `frontend/src/pages/CheckInPage.test.jsx` | 7 | 7 | 0 |
| Frontend Vitest | `frontend/src/pages/EventDetailsPage.test.jsx` | 4 | 4 | 0 |
| Frontend Vitest | `frontend/src/pages/EventReportsPage.test.jsx` | 9 | 9 | 0 |
| Frontend Vitest | `frontend/src/pages/EventsPage.test.jsx` | 2 | 2 | 0 |
| Frontend Vitest | `frontend/src/pages/MyRegistrationsPage.test.jsx` | 3 | 3 | 0 |
| Frontend Vitest | `frontend/src/pages/PasswordResetPage.test.jsx` | 3 | 3 | 0 |
| Frontend Vitest | `frontend/src/utils/dateTime.test.js` | 3 | 3 | 0 |

## Real database scope

Lockout, admin account safety, admin summary, event lifecycle/audit transactions,
check-in/concurrent cancellation, password/session/input security, notification
idempotency/log persistence, reminder timing, reset expiry/concurrent reuse and
queue rollback, 60 simultaneous registrations/FIFO promotion, backup/restore.
All 47 assertions passed; no integration suites were skipped.

## Reproduce

Backend: `npm ci`, then `npm test -- --runInBand --silent`.
Frontend: `npm ci`, `npm test -- --maxWorkers=1`, `npm run lint`, `npm run build`.
For database tests, use a dedicated replica-set `MONGO_TEST_URI` with an
`ems_test_*` database. Run `npm run test:integration`, `npm run test:reset`,
then `node --test tests/registrations.concurrent.integration.cjs tests/databaseBackup.integration.cjs`.
The local combined invocation included all 11 integration files in one Node run.

Machine-readable counts and per-file results: [automated results](evidence/automated-results.json).
