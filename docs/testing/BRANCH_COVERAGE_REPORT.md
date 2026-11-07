# Branch Coverage Report

Date: 7 November 2026 (IST).
Tested code: `f132eb400f367786a54d1fde835a3d389de624db`.
Environment: Windows, localhost development mode, Node.js 24.
Coverage tool: Jest/Istanbul.

## Result

The backend test suite completed successfully:

- Test suites: **24 passed / 24 total**
- Tests: **336 passed / 336 total**
- Snapshots: 0
- Duration: 26.471 seconds

## Coverage Summary

| Metric | Coverage | Covered / Total |
|---|---:|---:|
| Statements | 91.87% | 848 / 923 |
| Branches | 82.44% | 634 / 769 |
| Functions | 93.47% | 86 / 92 |
| Lines | 92.84% | 778 / 838 |

Branch coverage measures the decision alternatives exercised by the test suite. A total of 135 branch alternatives remain uncovered (769 total - 634 covered).

The submitted plan defines a 70% service statement threshold, not a separate branch coverage threshold. This report records branch coverage without inventing a branch acceptance gate.

## Conclusion

The automated backend test suite passed with no test failures. Statement coverage reached 91.87%, and branch coverage reached 82.44%. Uncovered branches remain opportunities for further test improvements and do not necessarily indicate defects.

These results represent the local test execution and should not be interpreted as a fresh CI or production deployment result.


## Uncovered Branch Breakdown by Module

The LCOV report was analyzed to identify uncovered branch alternatives by source module. The following breakdown accounts for all 135 uncovered branch alternatives.

| Module | Uncovered Branch Alternatives |
|---|---:|
| `notifications/notification.worker.js` | 40 |
| `events/events.routes.js` | 29 |
| `registrations/registrations.routes.js` | 17 |
| `admin/admin.routes.js` | 12 |
| `auth/auth.routes.js` | 9 |
| `reports/eventReport.routes.js` | 5 |
| `users/users.routes.js` | 5 |
| `auth/reset.service.js` | 5 |
| `notifications/reminder.scheduler.js` | 3 |
| `audit/audit.service.js` | 3 |
| `notifications/email.transport.js` | 2 |
| `admin/withAdminLock.js` | 2 |
| `notifications/notification.service.js` | 2 |
| `reports/summary.service.js` | 1 |
| **Total** | **135** |

### Analysis

The largest concentration of uncovered branch alternatives is in `notifications/notification.worker.js` (40), followed by `events/events.routes.js` (29) and `registrations/registrations.routes.js` (17).

These three modules account for 86 of the 135 uncovered branch alternatives. This breakdown identifies areas where additional tests may improve branch coverage. Uncovered alternatives do not necessarily indicate defects; they represent execution paths not exercised by the current test suite.

### Conclusion

The backend achieved 82.44% branch coverage, with 634 of 769 branch alternatives covered. The uncovered alternatives have been documented by module to support future targeted testing and coverage improvement.
