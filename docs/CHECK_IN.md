# Attendee check-in — issue #29

Implements EMS-F-026/027, SAD 4.3.4, TC-CHK-01/02 and the remaining real-endpoint
check-in coverage for TC-SEC-05.

## Organizer workflow

1. Log in as the organizer who owns the event.
2. Open **Check in attendees** in the navigation (`/organizer/checkin`).
3. Select the published event. The permitted time window is shown in IST.
4. Enter the registration code, use **Scan QR with camera**, or upload a saved
   QR image (PNG, JPEG or WebP; at most 5 MB).
5. Verify the event and decoded code, then choose **Check in attendee**.
6. A successful result shows the code and check-in timestamp in IST. The input
   clears for the next attendee. Duplicate attempts show a specific rejection.

An attendee sees a QR receipt after registering through the event-details page.
The QR contains only the printed registration code; save/screenshot it for entry.
The existing registration-list API also returns regCode. This change does not
replace the teammate-owned My Registrations page.

QR images are decoded locally in the browser, never uploaded to the API. No
QR URLs are opened or followed. Camera mode asks for permission and releases
its stream when a code is found, the organizer stops it, changes event or leaves
the page. Use localhost or HTTPS for camera access. Manual entry/image upload
remain available when a camera is unavailable.

## API and rules

`POST /api/events/:id/checkin` requires a current active Organizer session.
Body: `{ "regCode": "REG-ABC123" }`; arbitrary fields, client timestamps and
operator objects are rejected. The trimmed plain code is also the QR payload.

Success: `{registration: "Checked-in", registrationId, regCode, checkedInAt}`.

- 401: no valid/current active session.
- 403: wrong role or another organizer's event.
- 404: event absent, or registration not found in the selected event.
- 409 EVENT_NOT_PUBLISHED: pending, rejected or cancelled event.
- 409 NOT_CONFIRMED: waitlisted or cancelled registration.
- 409 ALREADY_CHECKED_IN: duplicate check-in.
- 422 OUTSIDE_WINDOW: earlier than start minus one hour, or later than end.
- 422 VALIDATION_ERROR: malformed body/code.
- 503 AUDIT_UNAVAILABLE: audit persistence failed; check-in is rolled back.

Start-minus-one-hour and event end are inclusive. All comparisons/timestamps use
server UTC time; display uses IST. The conditional registration update, event
write guard and audit entry share one MongoDB transaction. Transaction retries
cannot create duplicate check-ins or audit entries. Check-in never frees a seat.
MongoDB must support transactions (replica set or Atlas).

## Verification

- `npm test` in backend: route authorization, input validation, registration
  eligibility, wrong-event codes, exact time boundaries and shared audit session.
- `MONGO_TEST_URI` must reference an `ems_test_*` database. Run
  `npm run test:integration` for real MongoDB tests, including eight concurrent
  attempts, cancellation races, timestamps and audit-failure rollback.
- `npm test`, `npm run lint`, and `npm run build` in frontend.
- Browser verification used real registrations, generated QR images, real image
  decoding and a simulated-camera video stream through the real QR decoder.
  Three successful check-ins produced exactly three stored CHECK_IN audit entries.
  Physical-camera/permission testing still needs the team's actual devices.

For a manual demo, create and approve a future event starting in 30 minutes,
with an open registration deadline. Register an attendee, save its QR, switch to
an organizer browser profile and follow the workflow above. Retry the same code,
a waitlisted code and a code from another event; each must reject without a new
check-in or audit entry.

## Dependencies

Uses qrcode.react to render the registration code and @zxing/browser for local
camera/image decoding. The QR decoder is loaded only when used. The frontend
lockfile also updates the existing follow-redirects dependency to its patched
version. Production dependency audit reports zero vulnerabilities; outstanding
moderate development-tool findings remain part of the security pass in #41.
