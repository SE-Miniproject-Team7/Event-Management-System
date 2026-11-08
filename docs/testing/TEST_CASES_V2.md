# Updated Test Case Document — version 2 (Deliverable 3)

Date: 2 November 2026 (IST). Tested code: `0a72a1291c8213484cd5b7ff7db829b1089f30ee`.
Environment: Windows, localhost development mode, Node.js 24.11.0, real MongoDB
8.2 replica set on 127.0.0.1:27030. CI uses its own Linux/Node 20 environment;
these reports describe this local execution, not a fresh CI run.
No public deployment or paid hosting was used. Synthetic data was isolated from
the development/demo database. No real account credentials are included.

Source: [submitted Test Plan v1](../FINAL_TEST_PLAN_DOCUMENT.pdf), section 13.1.
The original PDF is preserved. This version retains all 44 case IDs and original
acceptance criteria, and adds sprint-change execution notes. It supplements the
PDF; it does not delete unexecuted requirements or imply teacher approval of a
scope change.

## Execution conventions and scope changes

- Run against localhost, per the team's requested evaluation setup. Deployed
  TLS/redirect tests remain NOT EXECUTED; deployed ZAP baseline is also pending.
- Use dedicated ems_test_* replica-set databases; never re-seed development data.
- Time-dependent tests may use deterministic clocks or fixture timestamps.
- Evidence references identify relevant checks, not a claim that every original
  manual step or numeric threshold was measured. See System Validation Report.
- Five-person usability and unavailable browser/accessibility runs remain pending.
- Preserve real results even if performance thresholds fail.

## TC-AUTH-01

Requirements: EMS-F-001.

**Original steps and expected result:** EMS-F-001 Integration / Functional Register with valid data. Open Register page. Enter name, unused email, password 'Event123'. Submit. Account created within 3 s; Attendee role assigned; success message shown; password not shown in response.

**Sprint-update execution notes:** Use a fresh attendee email and the current 3–60 name / 8–64 password rules. Verify the three-second target separately; latest unit counts alone do not establish it.

**Evidence references:** accountRegistration.test.js; security.integration.cjs.

## TC-AUTH-02

Requirements: EMS-F-001.

**Original steps and expected result:** EMS-F-001 Integration / Functional Duplicate email and weak password rejected. Register again with the same email. Then register a new email with password 'abc'. First attempt rejected with 'Email already in use'; second rejected with password-rule message; no account created.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** accountRegistration.test.js.

## TC-AUTH-03

Requirements: EMS-F-002.

**Original steps and expected result:** EMS-F-002 System / Functional Login and token expiry. Login with valid credentials; note token expiry claim; call a protected API with the token before and after 60 minutes (use a clock stub). Login succeeds; token expires 60 min after issue; call after expiry returns 401.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** auth.test.js; security.integration.cjs.

## TC-AUTH-04

Requirements: EMS-F-003, EMS-SEC-005.

**Original steps and expected result:** EMS-F-003, EMS-SEC-005 Integration / Functional Lockout after 5 failed logins. Submit a wrong password 5 times for one account, then submit the correct password. 6th attempt refused for 15 minutes with remaining time displayed, even with the correct password; login works after the lock ends.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** lockout.test.js; lockout.integration.cjs.

## TC-AUTH-05

Requirements: EMS-F-004, EMS-SEC-003.

**Original steps and expected result:** EMS-F-004, EMS-SEC-003 Integration / Security Role-based access control. As Attendee call POST /events and PATCH /events/{id}/approval; as Organizer call PATCH /admin/users/{id}. Every call returns 403 and no data changes.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** events.test.js; adminUsers.test.js; checkin.integration.cjs.

## TC-AUTH-06

Requirements: EMS-F-005.

**Original steps and expected result:** EMS-F-005 Integration / Functional Password reset link is single-use and expires. Request reset; use the emailed link to set a new password; reuse the same link; separately wait 31 minutes and use a fresh link. First use succeeds; reuse and expired link rejected; old password no longer works.

**Sprint-update execution notes:** Use /forgot-password and /reset-password with a fragment token. Use controlled time/database expiry instead of waiting 31 real minutes. Add supersession, concurrent reuse, inactive-account and queue-failure checks. Historical local SMTP/Chrome evidence is in PASSWORD_RESET.md.

**Evidence references:** reset.integration.cjs; reset.test.js; PASSWORD_RESET.md.

## TC-AUTH-07

Requirements: EMS-F-006.

**Original steps and expected result:** EMS-F-006 Unit / Functional Profile update validation. Update name and phone with 10 digits; then try a 9-digit phone number. Valid update saved; 9-digit phone rejected with field error.

**Sprint-update execution notes:** The merged implementation is PUT /api/users/me. Validate 3–60 trimmed name and exactly 10 phone digits. Profile API currently returns a validation message rather than a structured phone field entry; record this presentation difference. No profile-edit screen was added by #95.

**Evidence references:** users.test.js; fresh localhost profile API check.

## TC-EVT-01

Requirements: EMS-F-007, EMS-F-009.

**Original steps and expected result:** EMS-F-007, EMS-F-009 System / Functional Organizer creates event (pending). Login as Organizer, submit a valid event form. Then open public listing as a visitor. Event saved with status Pending Approval; not visible in public listing.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** events.test.js.

## TC-EVT-02

Requirements: EMS-F-007, EMS-F-008.

**Original steps and expected result:** EMS-F-007, EMS-F-008 Unit / Functional Event field and date validation. Submit with: missing venue; end before start; deadline after start; capacity 0; capacity 10001. Each submission rejected (422) with an error naming the offending field; nothing saved.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** events.test.js.

## TC-EVT-03

Requirements: EMS-F-010.

**Original steps and expected result:** EMS-F-010 System / Functional Admin approves and rejects events. As Admin approve event A; reject event B with reason 'too short'(9 chars), then with a 10+ character reason. A becomes Published and appears publicly; 9-character reason refused; B becomes Rejected; organizer receives both decisions by email.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** audit.integration.cjs; notification.worker.test.js.

## TC-EVT-04

Requirements: EMS-F-011, EMS-SEC-003.

**Original steps and expected result:** EMS-F-011, EMS-SEC-003 Integration / Functional Edit rules and ownership. Organizer edits own event capacity from 50 to 5 when 8 are Confirmed; Organizer 2 tries to edit Organizer 1's event. Capacity reduction rejected; edit of another organizer's event returns 403.

**Sprint-update execution notes:** Add null-date, audit-failure and notification-failure rollback checks. Published edits return to Pending Approval; retain this documented behaviour.

**Evidence references:** events.test.js; audit.integration.cjs.

## TC-EVT-05

Requirements: EMS-F-012, EMS-F-024.

**Original steps and expected result:** EMS-F-012, EMS-F-024 System / Functional Cancel event notifies attendees. Organizer cancels a Published event that has 3 Confirmed and 2 Waitlisted attendees. Status becomes Cancelled; 5 cancellation emails queued within 5 minutes; event shows as cancelled to attendees.

**Sprint-update execution notes:** Email jobs are committed transactionally and delivered asynchronously. Verify recipient list and queue timing separately from external-mailbox arrival.

**Evidence references:** audit.integration.cjs; notification.worker.test.js.

## TC-SRC-01

Requirements: EMS-F-013, EMS-F-014.

**Original steps and expected result:** EMS-F-013, EMS-F-014 System / Functional Browse, search and filter. Seed 25 published events (some past). Open list; search keyword 'hack'; filter category 'Workshop'; filter date range; tick 'seats available'. Only upcoming Published events shown, 10 per page sorted by start; each filter returns only matching events; combined filters use AND.

**Sprint-update execution notes:** Date-only search boundaries use IST. Test combined filters, zero remaining seats, pagination and filter-reset behaviour.

**Evidence references:** events.test.js; EventsPage.test.jsx.

## TC-SRC-02

Requirements: EMS-F-015.

**Original steps and expected result:** EMS-F-015 Integration / Functional Event details and remaining seats. Open the detail page of an event with capacity 50 and 12 Confirmed registrations. All required fields shown; remaining seats shown as 38.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** events.test.js; EventDetailsPage.test.jsx; fresh Chrome detail.

## TC-REG-01

Requirements: EMS-F-016.

**Original steps and expected result:** EMS-F-016 System / Functional Register for an event. Login as Attendee, open a Published event with free seats, click Register. Confirmed registration created with unique registration ID and QR code; remaining seats reduce by 1.

**Sprint-update execution notes:** QR payload is regCode. Confirm saved access on My Registrations and use it with the organizer reader.

**Evidence references:** registrations.test.js; fresh Chrome registration/QR.

## TC-REG-02

Requirements: EMS-F-016, EMS-F-017.

**Original steps and expected result:** EMS-F-016, EMS-F-017 Integration / Functional Duplicate and late registration blocked. Register twice for the same event; then try to register after the registration deadline. Second attempt shows 'Already registered' (409); late attempt refused; no extra registrations stored.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** registrations.test.js.

## TC-REG-03

Requirements: EMS-F-018.

**Original steps and expected result:** EMS-F-018 System / Functional Full event goes to waitlist. Fill an event of capacity 2; a third Attendee clicks Register. Third attendee is Waitlisted with position 1; Confirmed count remains 2.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** registrations.test.js; EventDetailsPage.test.jsx.

## TC-REG-04

Requirements: EMS-F-018, EMS-F-019.

**Original steps and expected result:** EMS-F-018, EMS-F-019 System / Functional Cancellation promotes first waitlisted attendee. With 2 Confirmed and Waitlist [W1, W2], a Confirmed attendee cancels. Registration Cancelled; W1 (not W2) promoted to Confirmed; W1 receives promotion email; Confirmed count stays at capacity.

**Sprint-update execution notes:** Cancellation is permitted only before event start. Verify FIFO order, compaction after both cancellation types, unchanged occupied seats after promotion and transactional promotion-email queueing.

**Evidence references:** registrations.concurrent.integration.cjs; notification.worker.test.js.

## TC-REG-05

Requirements: EMS-F-020.

**Original steps and expected result:** EMS-F-020 Integration / Functional My Registrations list. Attendee with one Confirmed, one Waitlisted, one Cancelled and one Checked-in registration opens My Registrations. All four are listed with correct event name, date and status.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** registrations.test.js; MyRegistrationsPage.test.jsx; fresh Chrome list.

## TC-REG-06

Requirements: EMS-F-021.

**Original steps and expected result:** EMS-F-021 Integration / Functional Concurrent registrations never exceed capacity. Event capacity 10. Script 60 different attendees registering at the same moment (parallel requests). Exactly 10 Confirmed and 50 Waitlisted; seatsTaken equals 10; no duplicates.

**Sprint-update execution notes:** The real replica-set test extends the original 60-user case with unique positions 1–50, deterministic FIFO sequence ordering, promotion of the earliest waiter, and contiguous positions after both confirmed and waitlisted cancellations. Use an isolated replica-set test database.

**Evidence references:** registrations.concurrent.integration.cjs.

## TC-NTF-01

Requirements: EMS-F-022.

**Original steps and expected result:** EMS-F-022 System / Functional Confirmation email within 60 seconds. Register for an event using a test mailbox (Mailtrap). Measure time to delivery. Registration confirmation email is successfully queued/submitted for delivery within 60 seconds of successful registration.

**Sprint-update execution notes:** A queue record is different from SMTP submission. Observe queueing and actual transport submission within 60 seconds; no new external Mailtrap check is claimed by this report.

**Evidence references:** notifications.integration.cjs; fresh browser DB queue observation.

## TC-NTF-02

Requirements: EMS-F-023.

**Original steps and expected result:** EMS-F-023 Integration / Functional 24-hour reminder. Create an event starting in 24 h 5 min with 2 Confirmed attendees; advance the scheduler clock. Both attendees receive exactly one reminder between 23h45m and 24h15m before start; Waitlisted and Cancelled attendees get none.

**Sprint-update execution notes:** Use controlled scheduler time. Include repeated/concurrent runs, restart catch-up within ±15 minutes, current recipient eligibility and suppression of stale/out-of-window jobs.

**Evidence references:** reminder.scheduler.integration.cjs; notification.worker.test.js.

## TC-NTF-03

Requirements: EMS-F-025.

**Original steps and expected result:** EMS-F-025 Unit / Functional Failed email retried 3 times and logged. Stub the SMTP service to fail every call; trigger one confirmation email. Exactly 3 retries at about 1-minute intervals; log shows status Failed and attempts = 4 (1 initial + 3 retries); app continues to work.

**Sprint-update execution notes:** Four attempts means one initial attempt plus three retries. Verify the nextAttemptAt interval and delivery-log entries, not just repeated immediate mock calls.

**Evidence references:** notification.worker.test.js.

## TC-CHK-01

Requirements: EMS-F-026.

**Original steps and expected result:** EMS-F-026 System / Functional Check-in within the event window. Check- in using the registration ID and QR code succeeds within the event window with timestamps; the attempts 2 h before start and 1 h after end are rejected as outside the window. Check-in at 30 min before start succeeds with timestamp; the other two are rejected as outside window.

**Sprint-update execution notes:** The inclusive server check-in window is start minus one hour through end. Test the exact boundaries plus the original early/late examples. Camera permission/device coverage is separate from code/QR unit tests.

**Evidence references:** checkin.integration.cjs; CheckInPage.test.jsx.

## TC-CHK-02

Requirements: EMS-F-027.

**Original steps and expected result:** EMS-F-027 Unit / Functional Invalid check-in rejected. Check in the same registration twice; check in a Waitlisted registration; check in with a registration of another event. Each attempt is rejected with a message stating the reason; no state change.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** checkin.integration.cjs.

## TC-RPT-01

Requirements: EMS-F-028, EMS-F-029.

**Original steps and expected result:** EMS-F-028, EMS-F-029 System / Functional Organizer dashboard and CSV export. Event with 8 Confirmed (6 checked-in), 3 Waitlisted, 2 Cancelled. Open dashboard; click Export CSV. Dashboard shows 8 / 3 / 2 / 6 and attendance 75%; CSV has the required 5 columns and one row per registration.

**Sprint-update execution notes:** For the original fixture, 6 Checked-in + 2 still Confirmed = 8 occupied bookings, 3 Waitlisted and 2 Cancelled; attendance is 6/8=75%. UI separates still-Confirmed from Checked-in. CSV includes the five required fields plus additional event/summary fields. Record the display interpretation and extra columns as explicit implementation differences.

**Evidence references:** eventReports.test.js; fresh Chrome 75% report/CSV fixture.

## TC-RPT-02

Requirements: EMS-F-030.

**Original steps and expected result:** EMS-F-030 Integration / Functional Admin platform summary. Seed known data (events in each status, users in each role, registrations over 30 days). Open the summary as Admin. Counts and daily registration series match the seeded data.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** adminSummary.integration.cjs; AdminSummaryPage.test.jsx; fresh Chrome summary route.

## TC-ADM-01

Requirements: EMS-F-031.

**Original steps and expected result:** EMS-F-031 Integration / Functional Deactivate user and change role. Admin deactivates a logged-in Attendee; that user calls any API and tries to log in again; Admin then changes another user to Organizer. Deactivated user gets 401 on next request and cannot log in; promoted user can access Organizer endpoints.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** adminUsers.integration.cjs; AdminUsersPage.test.jsx.

## TC-ADM-02

Requirements: EMS-F-032.

**Original steps and expected result:** EMS-F-032 Integration / Functional Manage categories. Admin adds 'Seminar', renames it, then disables it; Organizer opens the create-event form. Category appears after adding; disabled category is not selectable for new events but still shown on existing events.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** AdminCategoriesPage.test.jsx; fresh Chrome category create/disable.

## TC-PERF-01

Requirements: EMS-NF-001, EMS-NF-008.

**Original steps and expected result:** EMS-NF-001, EMS-NF-008 System / Non- functional Search load test. Seed 1,000 registered users and 5,000 events. Run a baseline search test and then run JMeter with 100 concurrent users for 5 minutes under the required dataset. 95th percentile response time is at most 2 s, error rate is below 1%, and response-time degradation compared with the baseline does not exceed 10%. Design inspection confirms that the API tier maintains no per-user session state in server memory.

**Sprint-update execution notes:** Keep the original 1,000-user/5,000-event, 100-user, five-minute thresholds and <=10% degradation limit. The local executable uses Node HTTP, not JMeter, with a recorded 60.5-second per-user interval to respect the unchanged 100/minute/IP limiter. It measured 30 sequential baseline searches and 500 loaded searches in five synchronized batches of 100. Search p95 was 267.22 ms versus a 12.37 ms baseline p95 (2059.69% degradation): absolute latency and error gates passed, but the degradation gate failed. This is evidence for the exact localhost workload, not an equivalent JMeter run; the baseline sample is small and query profiling is absent. Preserve the result and threshold. Do not mark TC-PERF-01 as passed until a valid run meets every original gate.

**Evidence references:** timed localhost search workload.

## TC-PERF-02

Requirements: EMS-NF-002.

**Original steps and expected result:** EMS-NF-002 System / Non- functional Registration load test. JMeter: 100 concurrent users register for different events for 5 minutes. 95th percentile response time at most 3 s; error rate below 1%.

**Sprint-update execution notes:** Keep p95<=3 seconds and error<1% with 100 users for five minutes. Use distinct event/attendee registrations, synthetic JWTs and the same declared think time. Do not count a 60-request correctness test as a five-minute load test.

**Evidence references:** timed localhost registration workload.

## TC-AVL-01

Requirements: EMS-NF-003, EMS-NF-006.

**Original steps and expected result:** EMS-NF-003, EMS-NF-006 System / Non- functional Health check, availability and backup restore. Run an uptime monitor against /health for the test period; run the backup script and restore it into a clean database. Measured availability at least 99%; restored database passes a record- count and sample-record comparison.

**Sprint-update execution notes:** Report /health availability for the exact observed local duration only. This does not establish production availability. Backup restore checks counts and sample BSON data; Unix mode tests do not prove Windows NTFS ACLs.

**Evidence references:** health.test.js; databaseBackup.integration.cjs; timed /health sampling.

## TC-USB-01

Requirements: EMS-NF-004.

**Original steps and expected result:** EMS-NF-004 System / Non- functional Usability test of registration. Give 5 first- time users the task 'find a workshop and register'. Time them and count clicks. At least 4 of 5 finish within 3 minutes using no more than 5 clicks without help.

**Sprint-update execution notes:** Record five real first-time participants using USABILITY_RECORD.md. AI/browser automation is not a substitute for human usability results.

**Evidence references:** five first-time human participants required.

## TC-CMP-01

Requirements: EMS-NF-005, EMS-NF-009.

**Original steps and expected result:** EMS-NF-005, EMS-NF-009 System / Non- functional Cross-browser, responsive and accessibility check. Run the main flows in latest Chrome, Firefox, Edge at 360 px and 1920 px widths; run Lighthouse on 4 key pages. No functional defect or horizontal scroll; Lighthouse Accessibility at least 90 on each page.

**Sprint-update execution notes:** Chrome at 360/1920 on three pages is only partial evidence. Retain Firefox/Edge and Lighthouse>=90 on four pages as pending until actually measured.

**Evidence references:** [8 November browser and Lighthouse evidence](evidence/browser-follow-up.json).

## TC-MNT-01

Requirements: EMS-NF-007.

**Original steps and expected result:** EMS-NF-007 Unit / Non- functional Coverage and lint gate. Run 'npm test -- -- coverage' and 'npm run lint' in CI. Service-layer statement coverage at least 70%; ESLint reports 0 errors.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** Jest coverage summary; frontend ESLint.

## TC-TZ-01

Requirements: EMS-NF-010.

**Original steps and expected result:** EMS-NF-010 Unit / Functional UTC storage and IST display. Create an event for 10:00 IST; inspect the stored value; view it in the UI. Database holds 04:30 UTC; UI shows 10:00 IST.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** dateTime.test.js; backend IST date-boundary cases.

## TC-SAF-01

Requirements: EMS-SAF-001, EMS-SAF-002.

**Original steps and expected result:** EMS-SAF-001, EMS-SAF-002 System / Non- functional Confirmation dialogs and data minimisation. Trigger cancel event, cancel registration and deactivate user from the UI; then inspect the users collection and registration form fields. Each action shows a confirmation naming the item and does nothing until confirmed; only the minimum required personal data is stored, while required security metadata such as user ID and IP address may be retained for audit logging.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** fresh Chrome registration confirmation dialog; adminUsers.test.js.

## TC-SEC-01

Requirements: EMS-SEC-001.

**Original steps and expected result:** EMS-SEC-001 Integration / Security Password storage and leakage. Register a user, inspect the users collection, API responses and application logs. Only a bcrypt hash (cost at least 10) is stored; plaintext password appears nowhere.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** security.integration.cjs; accountRegistration.test.js.

## TC-SEC-02

Requirements: EMS-SEC-002.

**Original steps and expected result:** EMS-SEC-002 System / Security TLS enforcement. Call the deployed site over http://; run an SSL scan (for example testssl.sh or SSL Labs). HTTP redirects to HTTPS; only TLS 1.2 or higher accepted.

**Sprint-update execution notes:** Localhost HTTP evaluation means this deployed TLS/redirect case was NOT EXECUTED. Retain it in the plan; no instructor waiver or passing result is claimed.

**Evidence references:** not executed: no deployed HTTPS target.

## TC-SEC-03

Requirements: EMS-SEC-004.

**Original steps and expected result:** EMS-SEC-004 Integration / Security Injection and XSS attempts. Send {"email":{"$ne":null}} to login; enter &lt;script&gt;alert(1)&lt;/script&gt; as event title and name; fuzz numeric fields with negative, huge and non-numeric values. NoSQL operator payload rejected; script text stored as plain text and displayed encoded (no alert); invalid values rejected with 422.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** security.integration.cjs; security.test.js; historical browser XSS.

## TC-SEC-04

Requirements: EMS-SEC-005.

**Original steps and expected result:** EMS-SEC-005 Integration / Security Rate limiting. Send 11 login requests and 101 other API requests within one minute from one IP. Requests beyond each limit receive HTTP 429.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** rateLimit.test.js.

## TC-SEC-05

Requirements: EMS-SEC-006.

**Original steps and expected result:** EMS-SEC-006 Integration / Security Audit log content. Perform login, failed login, role change, event approval, cancellation and check-in; read the audit log. One entry per action with user ID, action, IP and timestamp; no passwords or tokens present.

**Sprint-update execution notes:** Retain the original steps and acceptance criteria. Use the current localhost routes and record any unexecuted portions separately.

**Evidence references:** audit.integration.cjs; audit.model.test.js.

## TC-SEC-06

Requirements: EMS-SEC-007.

**Original steps and expected result:** EMS-SEC-007 Integration / Security Token tampering and cookie flags. Modify the token payload; use an expired token; use the token of a deactivated user; inspect the cookie flags. All three tokens rejected with 401; cookie has HttpOnly, Secure and SameSite=Strict.

**Sprint-update execution notes:** Local development cookies intentionally omit Secure for HTTP. Production-mode API tests inspect Secure/HttpOnly/SameSite flags; actual HTTPS browser behaviour remains unexecuted.

**Evidence references:** security.integration.cjs; security.test.js.

## TC-SEC-07

Requirements: EMS-SEC-008.

**Original steps and expected result:** EMS-SEC-008 System / Security Secrets and dependency scan. Run a secret scan (for example gitleaks) over the repository history; run 'npm audit -- omit=dev'. No secrets found in the repository; zero high or critical vulnerabilities.

**Sprint-update execution notes:** Use fully redacted history scans and production-only npm audits. Development dependency findings are outside the production audit result, not silently counted as clean.

**Evidence references:** fresh production audits and redacted Gitleaks history scan.
