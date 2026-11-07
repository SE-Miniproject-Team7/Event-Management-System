# Code Coverage Report

Measurement date: 7 November 2026 (IST).
Tested code: `f132eb400f367786a54d1fde835a3d389de624db`.
Environment: Windows, localhost development mode, Node.js 24.11.0, real MongoDB 8.2 replica set on `127.0.0.1:27030`.
CI uses its own Linux/Node 20 environment; this report describes the local execution, not a fresh CI run.
No public deployment or paid hosting was used. Synthetic data was isolated from the development/demo database. No real account credentials are included.

## Measured scope

Jest collection: `backend/src/modules/**/*.js`. This is the backend module scope used by the existing service-coverage command, including route modules. It does not include all middleware, models, scripts or frontend code. Frontend tests were executed, but frontend coverage was not measured.

| Metric | Covered | Total | Coverage |
|---|---:|---:|---:|
| Statements | 848 | 923 | 91.87% |
| Lines | 778 | 838 | 92.84% |
| Functions | 86 | 92 | 93.47% |
| Branches | 634 | 769 | 82.44% |

TC-MNT-01 requires at least 70% service statement coverage. This measured backend-module scope achieves **91.87%**, so that threshold passes. Frontend lint returned zero errors.

## Evidence review and status

**Status: PASS for the stated backend-module statement-coverage threshold; limited to the measured scope.**

The committed [`evidence/coverage-summary.json`](evidence/coverage-summary.json) contains 19 module entries. Its aggregate totals match this report: 848/923 statements (91.87%), 778/838 lines (92.84%), 86/92 functions (93.47%) and 634/769 branches (82.44%).

This is a recorded local test execution, not a fresh CI result. The 70% criterion is a statement-coverage threshold. This report does not claim that every module passes an individual threshold, that all system test cases are complete, or that the frontend or entire repository has 90% coverage.

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
| `backend/src/modules/notifications/notification.worker.js` | 88.37% | 89.07% | 90.90% |
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


## Remaining coverage gaps and limitations

- `backend/src/modules/admin/withAdminLock.js` has **36.36% statement coverage (4/11) and 0% branch coverage (0/2)** in this snapshot.
- `backend/src/modules/notifications/notification.worker.js` has **88.37% statement coverage (114/129) and 64.91% branch coverage (74/114)**. This is a notable remaining decision-path gap.
- `backend/src/modules/registrations/registrations.routes.js` has **86.17% statement coverage (81/94) and 69.09% branch coverage (38/55)**.
- The 82.44% aggregate branch figure is reported for transparency. The supplied plan specifies no separate branch-coverage acceptance threshold.
- The report covers only `backend/src/modules/**/*.js`; middleware, models, scripts and frontend files are outside the measured coverage scope. Passing test counts and frontend lint/build results are documented separately and must not be presented as frontend coverage.
- This is local localhost evidence on the stated runtime/database. It does not prove production deployment behavior, and it does not replace the separate system-validation, security or load-test results.

## Final review checklist

- [x] Aggregate totals checked against the committed JSON evidence.
- [x] Tested commit, environment and exact measurement scope identified.
- [x] Current `main` compared with the measured commit; no backend module source changes found in the comparison.
- [x] 91.87% statement-coverage result restricted to backend-module scope.
- [x] Lower-coverage modules and the absence of a branch-coverage gate disclosed.
- [ ] Rerun the coverage command if backend module source changes, or if a fresh execution record is required by the evaluator.



