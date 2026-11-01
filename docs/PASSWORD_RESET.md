# Password reset — issue #11

Implements EMS-F-005 and TC-AUTH-06 using the SAD endpoints:

- POST /api/auth/forgot-password {email}: 202 with the same message for unknown,
  inactive and active accounts. Malformed email is 422. Requests are limited to
  10/minute/IP before JSON parsing, in addition to the existing API limiter.
- POST /api/auth/reset-password {token,newPassword}: 200 on success, 400
  TOKEN_INVALID for malformed/expired/used tokens, 422 for password validation.

Login links to /forgot-password. Email links open /reset-password#<token>.
The 256-bit random secret is in the URL fragment so it is not sent in HTTP paths,
queries or referrers. The reset page sends it only in the POST body and removes
the fragment after success. Never share screenshots of live links.

Only the SHA-256 token hash and expiry are stored on User, hidden by default.
Issuing another link supersedes the previous link. Tokens expire at 30 minutes.
The notification job necessarily contains the deliverable link: treat queue
database access and backups as sensitive. No reset URLs/passwords enter logs.
The password is bcrypt-hashed at cost 12. A single conditional database update
checks expiry/activity, consumes the token, updates the password and clears
failed-login counters. Concurrent reuse allows one successful update.
The submitting browser's cookie is cleared; existing cookies in other browsers
retain the project's existing 60-minute session lifetime.

Queue insertion and token replacement share a MongoDB transaction. A queue-write
failure aborts token replacement. Actual SMTP failures are retried by #26's
worker. MongoDB must support transactions (replica set or Atlas).

## Configuration and manual delivery check

Use #26's SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM and
NOTIFICATION_WORKER_ENABLED=true in your private backend environment. Set
CLIENT_ORIGIN to the frontend origin; production requires HTTPS. Never commit
credentials. The worker polls once per minute. A retry retains the same link's
original expiry, rather than extending its validity.

1. Start database, backend and frontend with the configured worker.
2. Request a reset for an account whose inbox you control. Check the generic
   response; open its received email link and choose a valid new password.
3. Sign in with the new password; confirm the old password fails. Reuse the
   email link and verify rejection. Request another link to try again.
4. A link older than 30 minutes must fail. A newly requested link supersedes
   earlier links. Never paste live reset tokens or credentials into evidence.

Automated checks use synthetic accounts and isolated ems_test_* databases:

    npm test
    MONGO_TEST_URI=<dedicated replica-set test URI> npm run test:reset

The real database tests check single-use concurrency, old/new password hashes,
expiry, supersession, inactive accounts, generic responses and rollback when
enqueueing fails. Frontend tests check request, confirmation and missing-link
behaviour; worker tests verify template dispatch without logging links.
External provider delivery and clicking its real link remain a deployment
step. Local automated tests do not claim production TLS or live SMTP delivery.

## Team integration

This adds PASSWORD_RESET to #26's shared notification model/service/worker.
Palash should preserve it when adding WAITLIST_PROMOTION for #83; Rakshan should
preserve it when adding reminder/change templates. No new sender is introduced.

## Recorded verification — 1 November 2026

296 backend Jest tests, 33 existing MongoDB integration tests plus 5 reset
integration tests, and 37 frontend tests passed. Frontend lint and production
build passed. Tests used synthetic accounts; no live reset email was sent.

## SMTP and browser acceptance — 1 November 2026

Verified using the real Nodemailer transport, shared queue worker, real MongoDB
and Chrome against an isolated local SMTP inbox. The email was delivered and its
link was opened in the browser. Password reset succeeded, the old password was
rejected by login, the new password logged in, reuse of the delivered link was
rejected, and a Sent delivery log was recorded. Test accounts/database were
removed afterwards. No external Mailtrap delivery is claimed: this laptop has
no SMTP provider credentials. Production SMTP configuration remains deployment
work. A same-tab hash navigation issue found during this check was fixed.
