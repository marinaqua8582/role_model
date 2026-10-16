# Legacy step8Data compatibility regression

2026-10-15. Migration preparation only; no operating deployment or database import.

- Parse the legacy Tests `step8Data` JSON column and expose its detail as `step8`, including per-test notes.
- Reject malformed JSON and conflicting simultaneous `step8`/`step8Data` aliases rather than choosing an answer.
- Preserve the unchanged raw archive. Tests use newly authored synthetic values only.
- Added one automated test covering notes/results/problem preservation, malformed JSON, conflicting and identical aliases, and archive equality.
- Affected migration/cutover tests: 16 passed, 0 failed. Lint and default production build passed.
- Previous full-suite 251 result remains historical; a new full-suite 252 run was not performed. Login/save code and UI did not change, so existing external concurrency/UI checks were not repeated.
- No real student values, source files, identifiers, or individual hashes are included here. Actual backup, import, operating settings, main, and production remain unexecuted.
