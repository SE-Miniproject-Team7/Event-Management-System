# Deliverable 3 — proposed team split

This is a proposed division for team agreement, not a reassignment of GitHub
issues or a claim that the reports have been reviewed. All report files are
drafts until their owners review the evidence and outstanding cases.

| Person | Primary report | Follow-up responsibility |
|---|---|---|
| Prajin | System Validation Report | AUTH/ADM/security case updates, local scope and deviations, integrate shared results |
| Palash | Unit Test Report | Reconcile current automated test counts, backend registration/concurrency results and performance evidence |
| Rakshan | Code Coverage Report | Reproduce statement/line/function scope, verify the 70% statement gate, Sprint 2 video and #44 |
| Yathindra | Branch Coverage Report | Review uncovered decisions, UI/browser/responsive/accessibility validation and UI case updates |

The report owner is the editor/integrator; every developer still updates and
cross-tests their own features. Code/branch coverage are generated from the
same measured backend module run, so do not rerun them separately just to make
different numbers. Do not add empty tests solely to increase percentages.

## Share without duplicating work

1. Share the baseline evidence/test-case package in a reviewed PR once the team
   agrees the split. This records the actual shared work already done.
2. Each owner then branches from current main, reviews/finalizes their report,
   fills genuine gaps and raises their own PR. Do not blindly re-create reports
   or copy another person's commit history as individual work.
3. Shared items such as Test Cases v2 and DEVIATIONS need one integrator; send
   updates to Prajin or coordinate a merge order to avoid editing them together.
4. Keep NOT RUN/PARTIAL results until observations exist. Five-person usability,
   missing browser runs and unmeasured Lighthouse scores cannot be inferred
   from green CI. Localhost scope does not prove deployed TLS.

## Existing plan ownership discrepancy

The submitted Test Plan's module-ownership paragraph lists Rakshan twice and
does not list Yathindra. Reconcile that paragraph explicitly in the updated
document with the team's agreed allocation; do not silently claim an earlier
assignment that was never recorded. Existing implementation issue ownership
is unchanged by this proposal.

## Documents already prepared

- TEST_CASES_V2.md: all 44 original IDs and acceptance text, plus sprint changes.
- UNIT_TEST_REPORT.md: current backend/frontend and database results.
- CODE_COVERAGE_REPORT.md and BRANCH_COVERAGE_REPORT.md: measured backend modules.
- SYSTEM_VALIDATION_REPORT.md: local evidence and remaining validation.
- LOAD_TEST_REPORT.md: timed workload results and disclosed JMeter substitution.
- USABILITY_RECORD.md: blank form for five actual participants.
- SPRINT2_RECORDING_GUIDE.md: complete two-minute sequence for Rakshan.

None of these drafts automatically closes #41 or #44. Review actual results,
the agreed test scope and final video/documentation obligations before closure.
