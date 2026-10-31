# Security pass — issue #41

Review date: 31 October 2026 (IST). Base: `05e714d4e23a870adaf1c3370e6c4c4db8adf070`
plus this branch's working changes. Scope: merged functionality and existing
open PR dependencies. **Refs #41; do not close it as fully complete yet.**
The team confirmed that the application is not deployed.

## Results against the submitted test plan

| Test | Result | Evidence / limit |
|---|---|---|
| TC-SEC-01: password storage/leakage | Local pass | Real signup stores bcrypt cost 12, public DTO excludes hashes/passwords, audit excludes secrets. Forced exceptions and malformed requests produce sanitized responses and logs. |
| TC-SEC-02: HTTPS/TLS | NOT TESTED | No deployed site. A security header on localhost is not proof of TLS or HTTP-to-HTTPS redirection. |
| TC-SEC-03: injection/XSS | Local pass for merged routes | Operator objects do not become login filters; privilege fields cannot elevate signup; invalid capacities rejected; stored XSS payloads render as encoded text in discovery/details and user greeting. |
| TC-SEC-04: rate limiting | Local pass | Eleven login requests and 101 API requests hit the documented limits. Real-app regression verifies malformed JSON also consumes those allowances; /health stays outside limits. |
| TC-SEC-05: audit trail | Local pass | Real MongoDB suites cover login outcomes, role/activity changes, event approvals/rejections/cancellation and the actual check-in endpoint. Rollback and transaction retries tested. |
| TC-SEC-06: sessions | Local pass | Secure/HttpOnly/SameSite=Strict in production mode; 60-minute expiry; tampered, expired, unsigned, wrong-algorithm, malformed-ID and deactivated-user tokens rejected. Current DB roles override JWT role claims. |
| TC-SEC-07: secrets/dependencies | Local pass within scan scope | Default Gitleaks 8.30.1 scan of all fetched Git refs: 0 findings, 108 commits, non-shallow clone. Only .env.example files are tracked. Both production dependency audits: 0 vulnerabilities. Current-source scan recorded in security/evidence.json. |

The deployed OWASP ZAP baseline described in the test plan is also NOT TESTED.
Password reset, profile update, notification delivery and event editing require
another security pass after their actual implementations merge. Existing tests
are regression evidence, not a declaration that unimplemented features pass.

## Defects fixed on this branch

1. The error handler printed full exception objects, potentially including query
   values, passwords, tokens, database URIs or parser bodies. It now logs only
   controlled `level`, `event`, `status` and `code` values. Unexpected exceptions
   return a generic 500 without arbitrary fields. Trusted AppError validation
   responses remain usable. Malformed JSON and oversized bodies return sanitized
   400/413 responses. Startup/seed failures no longer print raw driver messages.
2. Session verification now pins HS256, the algorithm issued by this application,
   and validates the ID shape before querying MongoDB. Signed malformed claims
   receive 401 rather than entering a cast/query error path.
3. API/login limiters now run before JSON parsing, so malformed/oversized requests
   cannot bypass the attempt counters.

This is intentionally not a replacement for #25's full structured request logger
or #68's CI changes. Do not reintroduce raw exception/body/header/URL logging
when those features land. Reset links and query strings can contain secrets too.

## Verification performed

- Backend: 247 Jest tests; focused `npm run test:security`: 219 tests.
- Real MongoDB: 30 tests across the six integration suites.
- Frontend: 27 Vitest tests, lint and production build.
- Chrome: real stored malicious user name, event title and description displayed
  without an injected element or alert on discovery/details pages.
- `npm audit --omit=dev --json`: zero findings in backend and frontend.
- Gitleaks 8.30.1 official Windows x64 release checksum verified before use:
  `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e`.
- No actual .env file was read into the report or added to Git. Raw scan reports
  remain outside the repository and were generated with full redaction.

Gitleaks is a pattern-based check, not proof that no secret can exist. History
coverage is all refs fetched into this clone, not private forks or unreachable
objects. Rerun it after new commits/merges. Development-tool audit findings are
separate from the clean production audits; no forced major tool upgrades were
performed in this pass.

## Reproduce

From `backend`:

```powershell
npm.cmd test
npm.cmd run test:security
$env:MONGO_TEST_URI='mongodb://127.0.0.1:27030/ems_test_security?replicaSet=emsLocal'
npm.cmd run test:integration
npm.cmd audit --omit=dev --audit-level=high
```

The MongoDB URI above is a local test example. Use a replica set/Atlas test DB,
not production data. Tests require an ems_test_* name and isolate their fixtures.

From `frontend`:

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=high
```

With Gitleaks installed, from the repository root:

```powershell
git fetch --all --prune
gitleaks git --redact=100 --log-opts="--all" --no-banner
```

Do not publish raw credential matches if a future scan finds anything. Review
locally, revoke/rotate real credentials, and coordinate history cleanup with the
team. Do not rewrite shared history as an automatic test step.

## Required before final sign-off

1. Review/merge this branch and rerun CI.
2. Re-test merged event editing, profile, password reset and notification flows.
3. Deploy; verify HTTP redirects, TLS 1.2+ only, production cookie behavior over
   HTTPS and a permitted OWASP ZAP baseline against the team's deployment.
4. Resolve team findings listed in TEAM_HANDOFF.md and rerun the affected suites.
5. Update the evidence/date, then close #41 through the final reviewed change.

References: submitted SRS 6.3 and Test Plan TC-SEC-01–07;
[Gitleaks usage](https://github.com/gitleaks/gitleaks#usage),
[verified release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
