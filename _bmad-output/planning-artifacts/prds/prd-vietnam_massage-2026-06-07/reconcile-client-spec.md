# Input Reconciliation — Client ERP Specification

Source: `client_erp_specification.md`
Target: `prd.md`

## Verdict

The PRD covers the specification's screen inventory, master data, call ledger, room status, TV board, daily settlements, monthly closing, permissions, audit logging, and migration validation requirements.

## Gaps Found

- **`실시간콜입력` U:X summary/detail area should be fully named.** The source calls out daily reservation count, completed count, no-show/cancel, payment total, therapist settlement, earcare pool, discount total, expense total, net sales, A-E course counts, discount count, therapist assignment count, and daily expense rows.
- **Room status operation could mention status transitions more clearly.** The source says manual `청소중`/`빈방` transition may be needed. The PRD covers call status changes and active-call calculation, but should make clear that room state is controlled through service-call state transitions rather than a separate settlement mutation.
- **TV display update mechanism can remain open.** The source recommends auto-refresh or websocket. The PRD leaves this as an architecture choice, which is acceptable.

## Recommended Fix

Expand `FR-15` and add one validation condition to room/status requirements clarifying that room display state follows service-call status.
