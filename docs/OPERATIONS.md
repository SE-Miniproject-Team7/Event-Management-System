# Operations: health, logging, and database recovery

## Health monitoring

Poll `GET /health`. A healthy application and MongoDB connection return HTTP 200 with
`status: "ok"` and `db: "up"`. A disconnected database returns HTTP 503 with
`status: "degraded"` and `db: "down"`. The response includes process uptime in seconds.
Use the HTTP status for alerting; a live application with an unavailable database is not
reported as healthy.

The endpoint check in CI verifies both database-ready states. The SRS target is 99% availability over a rolling 30-day measurement period, excluding
announced maintenance. CI health checks verify response behavior only; they do not measure
production availability. This target remains unverified until deployment monitoring has
collected a complete measurement period.

## Structured application logs

Each completed request emits one JSON line with `level`, `time`, `requestId`, `route`,
`method`, `status`, and `durationMs`. The request ID is also returned in the
`X-Request-Id` response header. Error logs include safe status/code metadata. Request
bodies, headers, cookies, tokens, URL query strings, and database values are not logged.

## Database backup and test restore

Run from the `backend` directory with a configured `MONGO_URI`:

```sh
npm run backup:create
```

Set `BACKUP_FILE` to choose another output path. The default is
`backend/backups/ems-<timestamp>.ejson`; backup files are ignored by Git and written with
owner-only permissions. EJSON preserves BSON ObjectIds and dates.

Restore is deliberately limited to an empty database whose name begins with `ems_test_`.
Set `RESTORE_URI` to that disposable target and `BACKUP_FILE` to the archive:

```sh
RESTORE_URI='mongodb://localhost:27017/ems_test_restore' BACKUP_FILE='backups/snapshot.ejson' npm run backup:restore
```

The restore command refuses non-test database names and non-empty targets. Never point a
recovery test at a production database. The integration test checks collection counts,
ObjectIds, dates, and a sample record after restore.
