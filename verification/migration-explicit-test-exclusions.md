# Explicit test exclusions, original archive retained

2026-10-15. The operator confirmed two legacy keys as teacher-created/test-only records. Exclusion is explicit input to `planRegisteredMigration`, never a default or name-based heuristic. Production data was not reread, backed up, changed, or imported for this work.

- `excludeStudentKeys` removes only confirmed keys from destination identities/documents/receipts. The complete original `legacyArchive`, including excluded rows and all original cells, remains unchanged.
- Academic fields conflicting with an explicit row key still stop planning. Other orphan records still stop planning. No automatic student relinking or answer merging was introduced.
- The source digest includes the exclusion policy; changing that policy cannot reuse a different migration's receipt identity. Apply reconstructs the plan with the same policy and validates the entire plan before writing.
- A new synthetic regression covers untouched raw archive, excluded-row counts, malformed test-only content retained in the archive, canonical exclusion order, policy-specific digest, conflicting academic fields, durable local synthetic apply/replay, excluded receipt absence, and tamper refusal.
- Affected migration/cutover suite: 17 passed, 0 failed. Lint and default production build passed. Existing full-suite and external performance/UI results are historical and were not rerun.
- A separate empty operating Supabase project was created by the operator. No operating DB credentials were read or saved by this change; no operating DB schema was initialized. Backup location, separate key custody, retention/deletion rules and execution authorization remain unconfirmed. Operating app/Sheets/GAS/main/production are unchanged.
