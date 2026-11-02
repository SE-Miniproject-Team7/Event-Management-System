# Optional localhost validation tools

Run one at a time, from the repository root. Install backend/frontend packages
first. MongoDB must be a running replica set. Provide a dedicated ems_test_* URI;
both tools allocate a fresh random database and delete only that database during
normal cleanup. Interrupted processes can leave disposable test fixtures.

```powershell
$env:MONGO_TEST_URI='mongodb://127.0.0.1:27030/ems_test_validation?replicaSet=emsLocal'
node docs/testing/tools/localhost-load.cjs
```

The load tool takes approximately ten minutes: five-minute search, then
five-minute registration. It uses 100 virtual users, one request per user every
60.5 seconds, and the unmodified application rate limiter. It is a Node HTTP
substitution, not a JMeter execution. It writes machine-readable summaries to
evidence/load-results.json, unless EMS_LOAD_OUTPUT overrides that location.

The browser tool needs an installed Playwright Node package and Chrome.
If Playwright is outside this repository, set PLAYWRIGHT_MODULE_PATH to its
installed absolute module directory; no production dependency is added here.

```powershell
$env:PLAYWRIGHT_MODULE_PATH='C:\path\to\installed\playwright'
node docs/testing/tools/localhost-browser.cjs
```

It uses localhost ports 5023 (temporary API) and 5188 (temporary Vite). The
notification worker is disabled; no external email is sent. Chrome performs
real API/UI operations on synthetic accounts. It closes its browser, API and
Vite helper on normal completion and records results. Edge/Firefox/Lighthouse
and a human usability panel are separate checks, not implied by this script.
