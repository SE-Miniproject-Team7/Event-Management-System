# System Validation Report

Date: 3 November 2026 (IST). Tested code: `1a6a21bd99dde5bb5fac34806695475222561e20`.
Environment: Windows, localhost development mode, Node.js 24.11.0, real MongoDB
8.2 replica set on 127.0.0.1:27030. CI uses its own Linux/Node 20 environment;
these reports describe this local execution, not a fresh CI run.
No public deployment or paid hosting was used. Synthetic data was isolated from
the development/demo database. No real account credentials are included.

## Overall result: PARTIAL - not all original acceptance tests are complete

The functional regression suites and fresh Chrome smoke flow passed. Outstanding
human usability, full browser/accessibility, load-tool equivalence and deployed
transport checks prevent a blanket statement that the entire Test Plan passed.
Original thresholds remain visible in [Test Cases v2](TEST_CASES_V2.md).

## Fresh browser/API walkthrough

Browser: Chrome 156.0.8078.74. Real frontend, Express
API and isolated MongoDB; browser checks were not fulfilled with mocked API data.

| Check | Result |
|---|---|
| Real attendee login, event detail, registration and saved registration QR | pass |
| Registration confirmation queued in real database | pass |
| Registration cancellation requires confirmation and updates stored state | pass |
| Real profile API saves validated fields and ignores attempted role escalation | pass |
| Report 75% fixture, same-event refresh and downloaded CSV with 13 registration rows | pass |
| Admin summary and user-management routes retain authenticated access | pass |
| Admin category create/disable and exclusion from public category options | pass |

### Responsive observations

| Screen | Width | No page horizontal overflow |
|---|---:|---|
| `/registrations/me` | 360 | True |
| `/registrations/me` | 1920 | True |
| `/organizer/reports` | 360 | True |
| `/organizer/reports` | 1920 | True |
| `/admin/categories` | 360 | True |
| `/admin/categories` | 1920 | True |

Firefox and Edge executables were unavailable in this environment; Lighthouse
scores were not measured. These observations do not complete TC-CMP-01.

## Test-plan traceability

AUTOMATED EVIDENCE means relevant automated assertions passed; it is not a
full-case PASS for every original system step. PARTIAL identifies a specific
remaining part. LOAD CHECK refers to the separately measured workload below.

| Case | Execution classification | Evidence |
|---|---|---|
| TC-AUTH-01 | PARTIAL | accountRegistration.test.js; security.integration.cjs |
| TC-AUTH-02 | AUTOMATED EVIDENCE | accountRegistration.test.js |
| TC-AUTH-03 | AUTOMATED EVIDENCE | auth.test.js; security.integration.cjs |
| TC-AUTH-04 | AUTOMATED EVIDENCE | lockout.test.js; lockout.integration.cjs |
| TC-AUTH-05 | AUTOMATED EVIDENCE | events.test.js; adminUsers.test.js; checkin.integration.cjs |
| TC-AUTH-06 | AUTOMATED EVIDENCE | reset.integration.cjs; reset.test.js; PASSWORD_RESET.md |
| TC-AUTH-07 | AUTOMATED EVIDENCE | users.test.js; fresh localhost profile API check |
| TC-EVT-01 | AUTOMATED EVIDENCE | events.test.js |
| TC-EVT-02 | AUTOMATED EVIDENCE | events.test.js |
| TC-EVT-03 | PARTIAL | audit.integration.cjs; notification.worker.test.js |
| TC-EVT-04 | AUTOMATED EVIDENCE | events.test.js; audit.integration.cjs |
| TC-EVT-05 | AUTOMATED EVIDENCE | audit.integration.cjs; notification.worker.test.js |
| TC-SRC-01 | AUTOMATED EVIDENCE | events.test.js; EventsPage.test.jsx |
| TC-SRC-02 | AUTOMATED EVIDENCE | events.test.js; EventDetailsPage.test.jsx; fresh Chrome detail |
| TC-REG-01 | AUTOMATED EVIDENCE | registrations.test.js; fresh Chrome registration/QR |
| TC-REG-02 | AUTOMATED EVIDENCE | registrations.test.js |
| TC-REG-03 | AUTOMATED EVIDENCE | registrations.test.js; EventDetailsPage.test.jsx |
| TC-REG-04 | AUTOMATED EVIDENCE | registrations.concurrent.integration.cjs; notification.worker.test.js |
| TC-REG-05 | AUTOMATED EVIDENCE | registrations.test.js; MyRegistrationsPage.test.jsx; fresh Chrome list |
| TC-REG-06 | AUTOMATED EVIDENCE | registrations.concurrent.integration.cjs |
| TC-NTF-01 | PARTIAL | notifications.integration.cjs; fresh browser DB queue observation |
| TC-NTF-02 | AUTOMATED EVIDENCE | reminder.scheduler.integration.cjs; notification.worker.test.js |
| TC-NTF-03 | AUTOMATED EVIDENCE | notification.worker.test.js |
| TC-CHK-01 | AUTOMATED EVIDENCE | checkin.integration.cjs; CheckInPage.test.jsx |
| TC-CHK-02 | AUTOMATED EVIDENCE | checkin.integration.cjs |
| TC-RPT-01 | AUTOMATED EVIDENCE | eventReports.test.js; fresh Chrome 75% report/CSV fixture |
| TC-RPT-02 | PARTIAL | adminSummary.integration.cjs; AdminSummaryPage.test.jsx; fresh Chrome summary route |
| TC-ADM-01 | AUTOMATED EVIDENCE | adminUsers.integration.cjs; AdminUsersPage.test.jsx |
| TC-ADM-02 | PARTIAL | AdminCategoriesPage.test.jsx; fresh Chrome category create/disable |
| TC-PERF-01 | LOAD CHECK | timed localhost search workload |
| TC-PERF-02 | LOAD CHECK | timed localhost registration workload |
| TC-AVL-01 | PARTIAL | health.test.js; databaseBackup.integration.cjs; timed /health sampling |
| TC-USB-01 | PENDING HUMAN TEST | five first-time human participants required |
| TC-CMP-01 | PARTIAL | fresh Chrome desktop/mobile smoke; Edge/Firefox/Lighthouse pending |
| TC-MNT-01 | AUTOMATED EVIDENCE | Jest coverage summary; frontend ESLint |
| TC-TZ-01 | PARTIAL | dateTime.test.js; backend IST date-boundary cases |
| TC-SAF-01 | PARTIAL | fresh Chrome registration confirmation dialog; adminUsers.test.js |
| TC-SEC-01 | AUTOMATED EVIDENCE | security.integration.cjs; accountRegistration.test.js |
| TC-SEC-02 | NOT EXECUTED | not executed: no deployed HTTPS target |
| TC-SEC-03 | AUTOMATED EVIDENCE | security.integration.cjs; security.test.js; historical browser XSS |
| TC-SEC-04 | AUTOMATED EVIDENCE | rateLimit.test.js |
| TC-SEC-05 | AUTOMATED EVIDENCE | audit.integration.cjs; audit.model.test.js |
| TC-SEC-06 | PARTIAL | security.integration.cjs; security.test.js |
| TC-SEC-07 | AUTOMATED EVIDENCE | fresh production audits and redacted Gitleaks history scan |

## Remaining validation and limitations

- TC-USB-01: five real participants, at least four successful within three minutes
  and at most five clicks without help. Use [the observation form](USABILITY_RECORD.md).
- TC-CMP-01: remaining browser/width matrix and four Lighthouse scores >=90.
- TC-SEC-02/deployed ZAP: not executed for localhost-only scope. Preserve this
  exception in DEVIATIONS; no instructor-approved waiver is asserted.
- TC-PERF-01/02: see [Load Test Report](LOAD_TEST_REPORT.md). The Node workload
  substitutes for the original JMeter tool; compare the recorded thresholds.
- TC-AVL-01: local sampling has only the documented observation duration; no
  longer-term or deployed availability guarantee follows from it.
- TC-NTF-01 and lifecycle email routing: queue and template checks passed;
  a new external Mailtrap delivery/latency measurement was not performed.
- Profile validation returns a generic error message rather than a structured
  field entry. A profile-edit screen was not added by the merged API PR.
- The report UI shows still-Confirmed and Checked-in separately; original 8
  occupied bookings with 6 checked in yields 75%. CSV has extra columns while
  retaining the five required attendee fields. These differences are explicit.

Raw-safe summaries: [automated results](evidence/automated-results.json),
[browser results](evidence/browser-results.json), [coverage](evidence/coverage-summary.json).
Do not count the 44 plan cases as 44 passed cases based on automated test totals.

## Completed timed workload result

Search: 500 requests over 300.006 seconds, p95 267.22 ms, zero errors.
Registration: 500 requests over 300.012 seconds, p95 404.60 ms, zero errors.
The sequential search baseline p95 was 12.37 ms; the recorded p95 ratio
produces 2059.69% degradation and FAILS the original <=10% criterion under
this baseline definition. Absolute latency/error gates pass. This is a
disclosed Node workload, not the original JMeter execution. Palash must review
baseline equivalence and/or performance; the case is not a full pass.
58/58 local health samples succeeded during the two phases. This is only
a roughly ten-minute observation. See LOAD_TEST_REPORT.md for full conditions.



## Additional Functional Registration Check — 3 November 2026

Five synthetic attendee accounts were created locally and used to register
for the approved Introduction to Cybersecurity Workshop.

| Check | Result |
|---|---|
| Synthetic accounts created | 5 |
| Workshop registration successful | 5/5 |
| Registration errors observed | 0 |

This was facilitator-performed account-based functional testing. It does not
replace TC-USB-01, which remains pending five real first-time human participants.
No usability timing or click-count results were collected.
