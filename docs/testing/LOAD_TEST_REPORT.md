# Localhost Load Test Report

Date: 2 November 2026. Node HTTP workload against the real Express application
and an isolated MongoDB replica-set database. This substitutes for the test
plan's JMeter tool and is explicitly not a JMeter execution/report.

## Dataset and pacing

- 1000 synthetic users and 5000 Published future events.
- 100 virtual users, five request rounds over five minutes per phase.
- Each user has a 60.5-second think time; this is a paced workload respecting
  the existing 100-requests/minute/IP limit. It is not an unbounded throughput test.
- Search and registration phases ran sequentially. Fresh application instances
  reset rate-limit counters between phases, without disabling the limiter.
- Registration uses distinct event/attendee pairs and synthetic signed sessions;
  SMTP delivery is disabled. Confirmation jobs are still written to MongoDB.
- Baseline: 30 sequential searches before the concurrent search phase.
- Local Windows desktop measurements include client/server/DB on one machine;
  they are not production or dedicated-host capacity guarantees.

## Measurements

| Phase | Requests | Duration | p95 | Mean | Error rate |
|---|---:|---:|---:|---:|---:|
| Sequential search baseline | 30 | Not a five-minute phase | 12.37 ms | 9.85 ms | 0.00% |
| 100-user search | 500 | 300.01 s | 267.22 ms | 189.50 ms | 0.00% |
| 100-user registration | 500 | 300.01 s | 404.60 ms | 360.93 ms | 0.00% |

## Original acceptance gates

| Gate | Result |
|---|---|
| TC-PERF-01 search p95 <=2 s | PASS |
| TC-PERF-01 search error rate <1% | PASS |
| TC-PERF-01 degradation <=10% versus baseline | FAIL: 2059.69% using p95 ratio |
| TC-PERF-02 registration p95 <=3 s | PASS |
| TC-PERF-02 registration error rate <1% | PASS |

Search degradation is `(concurrent p95 / sequential baseline p95 - 1) * 100`.
This baseline/concurrency comparison is sensitive to queueing and the local
test machine; preserve it rather than changing the threshold after measurement.
TC-PERF-01 is not a full pass if the degradation criterion fails, even when
absolute latency and error thresholds pass. The original JMeter procedure and
acceptance of the tool substitution remain for the team's evaluator to review.

## Local health observation

58 of 58 sampled /health requests returned 200
(100.00%) over the two recorded local phases.
This describes only this approximately ten-minute observation, not long-term
99% production availability. Backup/restore counts and sample BSON checks
passed separately in the 47-test integration run.

## Ownership and reproduction

Palash owns review of TC-PERF measurements under the proposed split. Investigate
failed gates and document the workload/baseline; do not replace failed values
with CI status or adjust expected criteria silently. If using JMeter, retain
the required dataset, duration, concurrency and recorded pacing and compare
equivalent baseline/workload conditions.

Reproduce the local substitute using `tools/localhost-load.cjs`; see its README.
Raw-safe summary: [load-results.json](evidence/load-results.json).
