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

## Owner review: baseline validity and search performance

The baseline and loaded search phases use the same 1,000-user/5,000-event
database, endpoint, query term, and page cycle. The 30 baseline searches are
sequential; the 500 loaded searches run as five synchronized batches of 100
requests over five minutes. The script restarts the Express server between
phases while retaining the MongoDB dataset and connection. This compares
unloaded sequential latency with the measured 100-user burst workload, which
is consistent with the test plan's baseline-then-load intent for this Node
substitute.

The comparison has limits: its baseline has only 30 samples versus 500 loaded
samples, the virtual users issue synchronized bursts, and it is not the
specified JMeter run. The reported 12.37 ms baseline p95 is therefore a weak
estimate of general unloaded p95; the 267.22 ms loaded p95 is the measured
result for the exact local workload. The ratio is about 21.6x (2059.69%
degradation). Search meets the 2 s absolute p95 and <1% error gates, but
TC-PERF-01 still **fails** its unchanged <=10% degradation gate.

Search currently uses case-insensitive substring regular expressions over
title and description, plus a separate count query. The existing event index
supports Published/start-time filtering and ordering, but the evidence contains
no query-plan or profiler output to isolate the cost of the text search, count,
or database queueing. Optimization is needed before claiming the original
degradation gate passes; this run does not prove which implementation change
will help. Profile the actual query, make a behavior-preserving optimization
if indicated, and rerun the same acceptance criteria. Keep the measured
values and <=10% threshold unchanged. No optimization result is claimed here.

The raw evidence stores aggregate latency summaries rather than every request
sample, so the recorded p95 values cannot be independently recomputed from
request-level observations. Future runs should retain raw-safe latency samples
or a histogram alongside the summary.

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
