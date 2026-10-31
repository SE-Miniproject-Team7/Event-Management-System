# Deviations from the submitted documents

Differences between what was built and what the SRS, SAD and Test Plan (v1.0) describe, with the reason for each. To be explained at the final demo.

| # | Document / ref | Planned | Actual | Reason |
|---|---|---|---|---|
| 1 | SAD 3.6 (security libraries) | bcrypt | bcryptjs | Pure JavaScript, so it installs on Windows without native build tools. Same hash format, cost factor 10. |
| 2 | SAD 3.6, indexes | Text index on event title and description | Case-insensitive regex search on title and description | Partial words such as "hack" must match (TC-SRC-01); a text index only matches whole words. |
| 3 | SAD 4.3.2 (event API) | Listed endpoints only | Added GET /api/events/mine, GET /api/events/pending and a public GET /api/categories | Needed by the organizer dashboard, the admin approval screen and the event forms. |
| 4 | SAD ADR-6 | One central validation middleware | Most validation is done inside the route handlers; a shared middleware covers the core cases | Faster to deliver in one sprint. Same error format (SAD 4.4) is returned. |
| 5 | SAD 4.3.2 / EMS-F-012, EMS-F-024 | Cancelling an event notifies attendees | Cancelling an event cancels all active registrations (Confirmed, Waitlisted, Checked-in) and resets seatsTaken to 0 in one transaction. Cancellation emails are not sent yet | Keeps confirmed registrations equal to seatsTaken. Emails depend on the notification queue planned for Sprint 2. |
| 6 | STP TC-MNT-01, TC-SEC-07 | CI runs lint, tests, npm audit and a gitleaks secret scan | CI runs npm ci, the Jest tests and a non-blocking npm audit | Lint and gitleaks are not configured yet; planned for Sprint 2 if time allows. |
| 7 | SRS F5, F6, F7, F8 and EMS-F-005, EMS-F-006 | All features in the first two sprints | Email notifications and reminders, check-in, reports and CSV export, admin summary, user management, password reset and profile update are scheduled for Sprint 2; any not finished by the freeze will be listed here | Sprint 1 covered the demo flow: register, login, create event, approve, browse and register for an event. |
# Deviations from submitted documents

- Event cancellation cancels all active registrations (Confirmed, Waitlisted, Checked-in) and resets seatsTaken to 0 in one transaction. Cancellation emails (EMS-F-024) are deferred to the Sprint 2 notification queue.

## Admin user management (EMS-F-031 / TC-ADM-01)

- Added Admin-only `GET /api/admin/users?q=&page=` for name/email discovery,
  with ten accounts per page and only id, name, email, role and active fields.
- Account updates require at least one active Admin to remain. Self-deactivation
  or demotion is allowed only when another active Admin exists. A shared MongoDB
  transaction lock serializes account changes, including concurrent requests;
  the acting administrator is rechecked inside the transaction. MongoDB must
  support transactions (replica set or Atlas), as required by registration too.
- Seed/bootstrap scripts are operational tools outside this HTTP policy; do not
  use them concurrently with account administration.

## Admin platform summary (EMS-F-030 / TC-RPT-02)

`GET /api/admin/summary` follows SAD 4.3.4 and returns `eventsByStatus`,
`usersByRole`, and `registrationsPerDay` (30 `{date, count}` entries).
The reporting window is today in IST (partial, through the request time) plus
29 previous IST calendar days. Empty days/statuses/roles return zero.
Registration counts use creation time and include every registration status;
user totals include active and inactive accounts. The Admin screen labels this
scope and offers exact daily values alongside the visual chart.

## Security audit logging (EMS-SEC-006 / TC-SEC-05)

See [AUDIT_LOGGING.md](AUDIT_LOGGING.md) for events, failure behavior, privacy,
90-day TTL retention and verification. Unknown login attempts use null user ID
because no authenticated actor exists; no attempted email or credentials are
stored. Mutation audit entries share their transaction with the domain write.
The #29 check-in endpoint now calls the audit hook in its transaction. Real HTTP
integration tests verify one audit per successful check-in, concurrent attempts,
and rollback when audit persistence fails.

## Attendance check-in (EMS-F-026/027 / TC-CHK-01/02)

The SAD endpoint `POST /api/events/:id/checkin` accepts `{regCode}`. QR codes
contain that same registration code, with no user details or session token.
The organizer screen supports manual entry, camera scan and local image decoding;
reading a QR fills the form and requires explicit submission for the selected event.
A QR receipt is shown after registration; save it for entry. The existing
`GET /api/registrations/me` continues to expose codes for future My Registrations UI.

The interval is inclusive from one hour before start through the event end,
using server time. Only the owning Organizer and Confirmed registrations qualify.
A private event attendance-version field serializes check-in with cancellation
and edits. Check-in leaves seatsTaken unchanged: Checked-in attendees still occupy
their booked seats, avoiding new capacity after attendance is recorded.

Camera use requires localhost or HTTPS and browser permission; uploaded QR images
and manual entry are available as fallbacks. Camera decoding/cleanup was tested
with a simulated video stream; physical-device permission behavior remains a
manual browser/device check. See CHECK_IN.md for reproduction.
