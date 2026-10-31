# Security audit logging — issue #40

Implements EMS-SEC-006 and the action paths in TC-SEC-05, including the check-in endpoint added for #29.

## Records and privacy

MongoDB collection: `auditlogs`. Each record contains `userId` (actor), `action`,
`ip`, UTC `timestamp`, and optional `targetId` / `targetType` identifying the
account, event or registration affected. Unknown login identities have null
`userId`; attempted email addresses are not retained. A known inactive or locked
account can still be identified on a failed login.

The service uses an explicit field allowlist. It never serializes request bodies,
headers, cookies, passwords, password hashes, JWTs, reset links or error details.
The schema also rejects undeclared fields. IP comes from Express `req.ip`, not a
client-supplied `X-Forwarded-For`. Configure only known trusted proxies when
hosting behind a reverse proxy; do not trust arbitrary forwarded headers.

## Actions

| Action | When recorded |
|---|---|
| LOGIN | Credentials accepted, before an authentication cookie is issued |
| LOGIN_FAILED | Invalid/missing credentials, unknown/inactive account, or account lock |
| USER_ROLE_CHANGED | A real role change by an administrator |
| USER_ACTIVITY_CHANGED | Account activation/deactivation (additional security coverage) |
| EVENT_APPROVED | Pending event approved by an administrator |
| EVENT_REJECTED | Pending event rejected by an administrator |
| EVENT_CANCELLED | Published event cancelled by its organizer |
| CHECK_IN | Confirmed registration changed to Checked-in through POST /api/events/:id/checkin |

Unauthenticated/unauthorized mutations, validation failures and no-op account
updates do not create successful-action entries. Requests rejected by the
request/login rate limiter never reach credential processing; they are not
counted as processed login attempts in this collection.

## Durability and retention

Role/activity updates, event decisions and event cancellation write their audit
record in the same MongoDB transaction as the domain change. An audit failure
aborts that transaction. Transient transaction errors retain the retry signal;
a retry commits only its final audit entry. Login audit failure returns a
sanitized HTTP 503 and issues no authentication cookie. Existing login counters
may still update; a failed audit write does not grant a session.

A TTL index on `timestamp` expires records after 7,776,000 seconds (90 days).
MongoDB's TTL monitor removes expired records asynchronously, so deletion is not
instantaneous at the exact expiry second. The API startup initializes this index
before accepting requests. Do not edit audit documents as part of app operation.
No public audit browsing/editing API is added.

## Check-in integration — issue #29

`POST /api/events/:id/checkin` now calls `recordCheckIn(req, registration, session)`
after its conditional Confirmed-to-Checked-in update and before transaction
commit. Duplicate, ineligible, wrong-event and out-of-window requests create no
successful check-in entry. Audit failure rolls back check-in and its timestamp.

`checkin.integration.cjs` exercises the real HTTP endpoint, stored audit records,
eight concurrent attempts, audit failure rollback and event cancellation races.
This completes the endpoint wiring that was pending when #40 was implemented.
See [CHECK_IN.md](CHECK_IN.md) for the workflow and remaining device testing.

## Verification

Run `npm test` in `backend`. With a replica-set MongoDB server, set
`MONGO_TEST_URI` to a dedicated database whose name begins with `ems_test_`, then
run `npm run test:integration`. The audit suite creates its own uniquely named
test database and removes only that database afterward.

Tests cover login outcomes, role/activity no-ops, approval/rejection/cancellation,
privacy, spoofed forwarded headers, audit failure rollback, transaction retries,
the check-in hook, the real check-in endpoint and the installed TTL index. TTL configuration is verified;
the tests do not wait 90 days for the monitor.

To inspect local results through MongoDB Compass or mongosh, open `auditlogs`
and project only the known fields. Example in mongosh, using your development DB:

```js
db.auditlogs.find({}, {
  userId: 1, action: 1, ip: 1, timestamp: 1, targetId: 1, targetType: 1
}).sort({ timestamp: -1 }).limit(20)
```

## Suggested commits

1. Audit schema, actions, shared service and their unit tests.
2. Transactional route integration, startup index initialization and route tests.
3. Real-MongoDB integration tests, integration script and documentation.
