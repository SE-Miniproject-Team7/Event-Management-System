# Code Coverage Report

Measurement date: 8 November 2026 (IST). Tested commit: `de16fd3aacfb82054f2b11348237906c269866dd`.
Environment: Windows, Node.js v24.11.0, Jest/Istanbul.

## Measured scope

Jest collection: `backend/src/modules/**/*.js`. This is the backend module scope
used by the existing service-coverage command, including route modules. It does
not include all middleware, models, scripts or frontend code. Frontend tests
were executed, but frontend coverage was not measured. No whole-project 90%
coverage claim is made.

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Lines | 778 | 838 | 92.84% |
| Statements | 848 | 923 | 91.87% |
| Functions | 86 | 92 | 93.47% |
| Branches | 634 | 769 | 82.44% |

TC-MNT-01 requires at least 70% service statement coverage. The measured scope
achieved **91.87%**, so the statement threshold passed.

| Backend module | Statements | Lines | Functions |
|---|---:|---:|---:|
| `backend/src/modules/admin/admin.routes.js` | 92.45% | 93.87% | 100% |
| `backend/src/modules/admin/withAdminLock.js` | 36.36% | 40% | 0% |
| `backend/src/modules/attendance/attendance.routes.js` | 100% | 100% | 100% |
| `backend/src/modules/attendance/checkin.service.js` | 100% | 100% | 100% |
| `backend/src/modules/audit/actions.js` | 100% | 100% | 100% |
| `backend/src/modules/audit/audit.service.js` | 95.23% | 100% | 100% |
| `backend/src/modules/auth/auth.routes.js` | 88.31% | 88.31% | 75% |
| `backend/src/modules/auth/lockout.js` | 100% | 100% | 100% |
| `backend/src/modules/auth/reset.service.js` | 83.33% | 84% | 100% |
| `backend/src/modules/categories/categories.routes.js` | 100% | 100% | 100% |
| `backend/src/modules/events/events.routes.js` | 94.5% | 96.93% | 93.75% |
| `backend/src/modules/notifications/email.transport.js` | 100% | 100% | 100% |
| `backend/src/modules/notifications/notification.service.js` | 92.3% | 92.3% | 100% |
| `backend/src/modules/notifications/notification.worker.js` | 88.37% | 89.07% | 90.9% |
| `backend/src/modules/notifications/reminder.scheduler.js` | 94.73% | 97.14% | 100% |
| `backend/src/modules/registrations/registrations.routes.js` | 86.17% | 87.09% | 100% |
| `backend/src/modules/reports/eventReport.routes.js` | 100% | 100% | 100% |
| `backend/src/modules/reports/summary.service.js` | 100% | 100% | 100% |
| `backend/src/modules/users/users.routes.js` | 92% | 92% | 100% |

## Reproduce

From backend:

```powershell
npm test -- --runInBand --coverage --collectCoverageFrom="src/modules/**/*.js" --coverageReporters=json-summary --coverageReporters=json --coverageReporters=lcov --coverageReporters=text-summary --silent
```

The generated interactive HTML is `backend/coverage/lcov-report/index.html`.
It is a local generated artifact ignored by Git; the measured summary is
included in [coverage-summary.json](evidence/coverage-summary.json).
See [Branch Coverage Report](BRANCH_COVERAGE_REPORT.md) for missing decisions.
