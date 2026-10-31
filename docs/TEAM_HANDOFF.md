# Sprint 2 coordination snapshot

31 October 2026. Read alongside SECURITY_REVIEW.md. This documents existing
assignments; it does not reassign issues or create replacement issues.

## Prajin — voke1308

- #29/#31/#32/#40 changes are merged: check-in with audit logging, admin summary,
  account search and user-management UI/API. Preserve these when updating branches.
- Current branch `test/issue-41-security-pass`: security fixes, tests and evidence.
  #41 remains open for deployment checks and re-testing the remaining features.
- #11 password reset depends on Yathindra's #26 queue/delivery contract. Agree on
  its callable interface before integrating reset mail; do not expose reset links
  in API responses or logs as a substitute for email delivery.

## Yathindra — yathindra854

1. #26: prioritize the email queue, confirmation/retry/delivery-log interface.
   Share its calling contract with Prajin for #11 and Rakshan for #27/#28.
2. #36: build My Registrations using existing GET /api/registrations/me. QR
   rendering dependency qrcode.react is installed; encode regCode, matching the
   check-in reader. Persist access to saved registration codes in this page.
3. #37: the check-in screen already exists at /organizer/checkin. Integrate it
   with the organizer dashboard from Rakshan's #30; avoid rebuilding its API or
   dropping the route/navigation during App.jsx merges.
4. #38: AdminUsersPage and AdminSummaryPage already exist. Finish category UI
   and integrate the console around those screens and existing admin endpoints.
5. #12/#39: profile, IST/accessibility/responsive work remains. Preserve server
   authorization, safe React text rendering and the auth-interceptor behavior.

## Palash — Palash1246

- #21/#24: a fresh real-MongoDB probe sent 60 parallel registrations to capacity
  10. Result: 10 Confirmed, 50 Waitlisted, seatsTaken=10 (capacity respected),
  but only 15 distinct waitlist positions for the 50 waitlisted rows. Fix atomic
  position allocation/FIFO behavior and prove it under concurrency. This was an
  isolated synthetic database; no development/demo data was changed.
- #22: after moving that fixture event's start into the past, cancellation of a
  confirmed registration returned HTTP 200. SRS EMS-F-019 requires cancellation
  before event start. Add the time restriction with the transaction and tests.
- #23: the registration-list API is present; verify status filtering, population
  and ownership end to end with Yathindra's #36 UI, rather than duplicate it.
- #25: full structured request logging/health work remains yours. The security
  branch fixes raw error leakage only; reuse its sanitized fields. Never log
  raw exceptions, bodies, cookies, Authorization, reset URLs or query strings.

## Rakshan — rakshan-2006

- #69 / #16 (reviewed head 17ec461): update from main before final review.
  Capacity checking currently reads seatsTaken then saves a stale event; make
  it atomic against registration/check-in/cancellation. Preserve the new
  attendanceVersion write guard and audit transactions. Define/document the
  Published-to-Pending-Approval-on-edit transition and align field/date checks.
- #75 (reviewed head 2b1af7d): browser date constraints are UX checks. If the new
  future-date rule is adopted, enforce it consistently on the server too and
  test it; do not treat a browser min attribute as server validation.
- #68 (reviewed head 4ab4b04): frontend checks are useful, but its new JS regexes
  are still malformed and the merge guard does not bind CI/approval to the
  current commit. Prefer CI-only changes with frontend tests/lint/build and
  blocking production dependency checks; keep manual reviews/merges until a
  correct automation policy is independently verified. This branch does not
  edit the workflow files, avoiding overlapping work.
- #70 duplicates the auth CAS mock fix already in main. Close as superseded;
  merging its extra commit is unnecessary.
- #17 cancellation backend exists; verify it with the owner-facing UI and #28
  emails instead of duplicating the transactional cancellation implementation.
- #27/#28 wait on #26. #30 reporting/CSV can proceed using Confirmed + Checked-in
  as occupied bookings; check-in does not free seats. Coordinate UI with #37.
- #42: measure the actual service coverage; use the new tests rather than
  recreate them. #44: final two-minute video, final docs and freeze come after
  integration and remaining deployment/security evidence, not merely PR count.

## Coordination order

1. Merge independent reviewed work; maintain current ownership.
2. Prioritize #26 so notification/reset dependencies can integrate.
3. Palash resolves waitlist/FIFO/time-bound cancellation; Rakshan resolves edit
   concurrency and reporting; Yathindra integrates the existing UI/API pieces.
4. Rerun functional/security suites on the combined main branch.
5. Complete deployment checks, accurate deviations and the final demo/freeze.

These are findings and handoff notes only. No teammate was messaged and no
remote issue, assignment, PR review or merge was changed by this security pass.
