# Branch Coverage Report

Date: 2 November 2026 (IST). Tested code: `0a72a1291c8213484cd5b7ff7db829b1089f30ee`.
Environment: Windows, localhost development mode, Node.js 24.11.0, real MongoDB
8.2 replica set on 127.0.0.1:27030. CI uses its own Linux/Node 20 environment;
these reports describe this local execution, not a fresh CI run.
No public deployment or paid hosting was used. Synthetic data was isolated from
the development/demo database. No real account credentials are included.

## Result

Jest/Istanbul measured **615/769 branch alternatives
(79.97%)** in `backend/src/modules/**/*.js`.
An Istanbul branch alternative is a recorded decision arm (such as an if/else,
conditional expression or short-circuit path), not a separate test case.

The submitted plan defines a 70% service statement threshold, not a separate
branch percentage threshold. This report records branch coverage without
inventing a branch acceptance gate. Frontend branch coverage is not measured.

| Module | Covered alternatives | Total | Branch coverage |
|---|---:|---:|---:|
| `backend/src/modules/admin/admin.routes.js` | 69 | 81 | 85.18% |
| `backend/src/modules/admin/withAdminLock.js` | 0 | 2 | 0% |
| `backend/src/modules/attendance/attendance.routes.js` | 10 | 10 | 100% |
| `backend/src/modules/attendance/checkin.service.js` | 16 | 16 | 100% |
| `backend/src/modules/audit/actions.js` | 0 | 0 | 100% |
| `backend/src/modules/audit/audit.service.js` | 20 | 23 | 86.95% |
| `backend/src/modules/auth/auth.routes.js` | 55 | 64 | 85.93% |
| `backend/src/modules/auth/lockout.js` | 29 | 29 | 100% |
| `backend/src/modules/auth/reset.service.js` | 19 | 24 | 79.16% |
| `backend/src/modules/categories/categories.routes.js` | 0 | 0 | 100% |
| `backend/src/modules/events/events.routes.js` | 178 | 207 | 85.99% |
| `backend/src/modules/notifications/email.transport.js` | 14 | 16 | 87.5% |
| `backend/src/modules/notifications/notification.service.js` | 26 | 28 | 92.85% |
| `backend/src/modules/notifications/notification.worker.js` | 55 | 114 | 48.24% |
| `backend/src/modules/notifications/reminder.scheduler.js` | 16 | 19 | 84.21% |
| `backend/src/modules/registrations/registrations.routes.js` | 38 | 55 | 69.09% |
| `backend/src/modules/reports/eventReport.routes.js` | 49 | 54 | 90.74% |
| `backend/src/modules/reports/summary.service.js` | 4 | 5 | 80% |
| `backend/src/modules/users/users.routes.js` | 17 | 22 | 77.27% |

## Uncovered decision locations

Line numbers refer to the tested commit above. Zero executions indicate a gap,
not a demonstrated defect. Multiple arms at one source location are possible.

| Module | Line | Branch type | Uncovered arm indexes |
|---|---:|---|---|
| `backend/src/modules/admin/admin.routes.js` | 25 | binary-expr | 1 |
| `backend/src/modules/admin/admin.routes.js` | 28 | if | 1 |
| `backend/src/modules/admin/admin.routes.js` | 29 | if | 0 |
| `backend/src/modules/admin/admin.routes.js` | 86 | if | 0 |
| `backend/src/modules/admin/admin.routes.js` | 123 | if | 1 |
| `backend/src/modules/admin/admin.routes.js` | 129 | if | 0 |
| `backend/src/modules/admin/admin.routes.js` | 132 | binary-expr | 1 |
| `backend/src/modules/admin/admin.routes.js` | 134 | cond-expr | 1 |
| `backend/src/modules/admin/admin.routes.js` | 135 | if | 0 |
| `backend/src/modules/admin/admin.routes.js` | 140 | if | 1 |
| `backend/src/modules/admin/admin.routes.js` | 149 | if | 0, 1 |
| `backend/src/modules/admin/withAdminLock.js` | 12 | if | 0, 1 |
| `backend/src/modules/audit/audit.service.js` | 13 | cond-expr | 1 |
| `backend/src/modules/audit/audit.service.js` | 22 | if | 0 |
| `backend/src/modules/audit/audit.service.js` | 22 | binary-expr | 1 |
| `backend/src/modules/auth/auth.routes.js` | 97 | if | 1 |
| `backend/src/modules/auth/auth.routes.js` | 111 | cond-expr | 0, 1 |
| `backend/src/modules/auth/auth.routes.js` | 112 | if | 0, 1 |
| `backend/src/modules/auth/auth.routes.js` | 112 | binary-expr | 0, 1 |
| `backend/src/modules/auth/auth.routes.js` | 132 | cond-expr | 1 |
| `backend/src/modules/auth/auth.routes.js` | 170 | if | 1 |
| `backend/src/modules/auth/reset.service.js` | 13 | if | 0 |
| `backend/src/modules/auth/reset.service.js` | 13 | binary-expr | 4 |
| `backend/src/modules/auth/reset.service.js` | 35 | if | 1 |
| `backend/src/modules/auth/reset.service.js` | 46 | if | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 20 | binary-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 133 | binary-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 152 | cond-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 153 | cond-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 161 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 162 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 163 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 170 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 177 | cond-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 192 | if | 1 |
| `backend/src/modules/events/events.routes.js` | 198 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 205 | binary-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 221 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 222 | binary-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 244 | cond-expr | 0 |
| `backend/src/modules/events/events.routes.js` | 247 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 250 | cond-expr | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 252 | cond-expr | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 256 | binary-expr | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 257 | binary-expr | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 259 | cond-expr | 0, 1 |
| `backend/src/modules/events/events.routes.js` | 296 | binary-expr | 1 |
| `backend/src/modules/events/events.routes.js` | 305 | if | 0 |
| `backend/src/modules/events/events.routes.js` | 312 | binary-expr | 1 |
| `backend/src/modules/notifications/email.transport.js` | 20 | binary-expr | 1 |
| `backend/src/modules/notifications/email.transport.js` | 46 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.service.js` | 19 | default-arg | 0 |
| `backend/src/modules/notifications/notification.service.js` | 57 | if | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 32 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 36 | if | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 43 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 44 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 45 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 63 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 64 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 65 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 66 | cond-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 91 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 92 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 93 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 110 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 111 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 112 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 113 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 114 | cond-expr | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 117 | cond-expr | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 136 | if | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 137 | binary-expr | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 138 | binary-expr | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 139 | binary-expr | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 140 | cond-expr | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 158 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 159 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 170 | if | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 171 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 172 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 173 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 265 | default-arg | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 266 | binary-expr | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 267 | if | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 268 | if | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 268 | binary-expr | 0, 1, 2 |
| `backend/src/modules/notifications/notification.worker.js` | 274 | if | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 274 | binary-expr | 0, 1, 2, 3 |
| `backend/src/modules/notifications/notification.worker.js` | 275 | if | 0, 1 |
| `backend/src/modules/notifications/notification.worker.js` | 280 | binary-expr | 0, 1, 2, 3 |
| `backend/src/modules/notifications/notification.worker.js` | 302 | if | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 302 | binary-expr | 1 |
| `backend/src/modules/notifications/notification.worker.js` | 410 | if | 0 |
| `backend/src/modules/notifications/notification.worker.js` | 420 | if | 1 |
| `backend/src/modules/notifications/reminder.scheduler.js` | 48 | binary-expr | 1 |
| `backend/src/modules/notifications/reminder.scheduler.js` | 50 | binary-expr | 1 |
| `backend/src/modules/notifications/reminder.scheduler.js` | 61 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 50 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 89 | binary-expr | 1 |
| `backend/src/modules/registrations/registrations.routes.js` | 110 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 136 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 149 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 150 | if | 0, 1 |
| `backend/src/modules/registrations/registrations.routes.js` | 175 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 182 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 190 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 206 | if | 1 |
| `backend/src/modules/registrations/registrations.routes.js` | 234 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 244 | binary-expr | 1 |
| `backend/src/modules/registrations/registrations.routes.js` | 247 | binary-expr | 1 |
| `backend/src/modules/registrations/registrations.routes.js` | 260 | if | 0 |
| `backend/src/modules/registrations/registrations.routes.js` | 264 | if | 0, 1 |
| `backend/src/modules/reports/eventReport.routes.js` | 21 | cond-expr | 1 |
| `backend/src/modules/reports/eventReport.routes.js` | 24 | binary-expr | 1 |
| `backend/src/modules/reports/eventReport.routes.js` | 25 | binary-expr | 1 |
| `backend/src/modules/reports/eventReport.routes.js` | 28 | binary-expr | 1 |
| `backend/src/modules/reports/eventReport.routes.js` | 38 | if | 1 |
| `backend/src/modules/reports/summary.service.js` | 12 | if | 1 |
| `backend/src/modules/users/users.routes.js` | 8 | binary-expr | 1 |
| `backend/src/modules/users/users.routes.js` | 17 | if | 0 |
| `backend/src/modules/users/users.routes.js` | 23 | if | 0 |
| `backend/src/modules/users/users.routes.js` | 30 | if | 1 |
| `backend/src/modules/users/users.routes.js` | 46 | binary-expr | 1 |

Reproduce using the coverage command in [Code Coverage Report](CODE_COVERAGE_REPORT.md).
