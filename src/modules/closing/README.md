# Closing Module

Owns monthly close and payout snapshots.

## Includes

- monthly close preview
- monthly close confirmation
- monthly payout snapshots
- close locks
- close reopen events

## Upstream

- `calls` for sales, recognized calls, and expenses
- `settlements` for daily settlement totals
- `masters` for effective policies

## Monthly Closing Preview Service

`listMonthlyClosingPreview()` is the read-only orchestration service for `/closing`.

- It reads one `OperatingMonth` and iterates the ISO `YYYY-MM-DD` operating-month range.
- It reuses `listTherapistDailySettlements()` for therapist monthly call and payout totals.
- It reuses `listOpsDailyIncentives()` for operating team daily incentives.
- It reuses `listOpsMonthlyIncentivePreview()` for operating team monthly incentive threshold, team split, employee rows, call evidence, and warning messages.
- It reuses `listEarcareDailySettlements()` for earcare pool, distributed amount, undistributed amount, eligible day count, and normal-staff-zero warnings.
- Row identity and downstream identifiers stay on `Employee.id`; `staffCode` and names are display evidence only.
- `draft_current` means 작성중/검토중 current preview. `closed_current` means 마감확정/잠금 current preview, not a persisted closing snapshot.
- Story 5.2 applies therapist bonus calculations in the preview DTO:
  - full-attendance allowance uses `20` recognized days as the threshold and pays `2,000,000 VND`.
  - count-king uses monthly therapist `totalCallCount >= 40`, ranks only 1st to 3rd, and pays `5,000,000 / 3,000,000 / 1,000,000 VND`.
  - deterministic count-king tie-breaker is `totalCallCount desc`, `monthlySettlementAmount desc`, `staffCode asc`, `Employee.id asc`.
  - `finalPayoutAmount` is `monthlySettlementAmount + fullAttendanceAllowanceAmount + countKingBonusAmount`.
- Full-attendance recognition remains owned by Story 4.1 / settlements attendance source. When that source is absent, the service returns `fullAttendanceSourceStatus: "missing_story_4_1_source"` and warning evidence instead of estimating days or silently treating the allowance as a successful 0 VND calculation.
- The preview is read-only: no persistence, no `MonthlyClose`/snapshot model, no payout table, no audit event, no status mutation, no Server Action write path.

## Story 5.3 Monthly Close Confirmation

`MonthlyClosing` is the persisted historical close record in `monthly_closings`. Story 5.5 makes it versioned by `operatingMonthId + closeVersion`, so an operating month can preserve prior snapshots after reopen and reconfirm.

- `startMonthlyCloseReview()` owns the `작성중 -> 검토중` transition for the closing workflow and records `operating_month.status_changed`.
- `confirmMonthlyClose()` owns the `검토중 -> 마감확정` transition, calls `listMonthlyClosingPreview()` inside the transaction boundary, creates the `MonthlyClosing` snapshot, and records `monthly_close.confirmed`.
- `getMonthlyClosingSnapshot()` returns the stored `snapshotJson`; it must not call the preview service and present recalculated current values as historical values.
- The snapshot normalizes preview data into a confirmation DTO with month key/date range/status at confirmation, therapist rows, operations rows, earcare rows, totals, warning counts, evidence, and source basis.
- Snapshot rows preserve stable identifiers (`Employee.id`, `staffCode`, `Course.code` where present), display labels, ISO dates/date-times, warning/evidence strings, and VND number amounts as plain JSON.
- Confirmation uses a transaction across conditional `OperatingMonth.updateMany`, `MonthlyClosing.create`, and audit logging. Reconfirmation after reopen creates the next `closeVersion`; same-version races fail through the DB unique constraint.
- `monthly_close.confirmed` uses `targetType: "monthly_close"`; operating-month review status changes use `targetType: "operating_month"`.
- The UI separates preview and snapshot: current recalculating values are labeled `현재 기준 미리보기`, while persisted historical values are labeled `확정 스냅샷`.
- Story 5.6 will own the double-confirmation dialog/focus contract.

## Story 5.4 Lock And Payout Write Blocking

`lockMonthlyClose()` owns the `마감확정 -> 잠금` transition. It does not create or overwrite a `MonthlyClosing` snapshot; it requires the existing snapshot row and records `monthly_close.locked` with `targetType: "monthly_close"`, `lockedAt`, `lockedByAccountId`, and operating-month before/after state as plain JSON.

- Only `마감확정` can be locked. `작성중` and `검토중` return `MONTHLY_CLOSE_NOT_CONFIRMED`; duplicate `잠금` returns `MONTHLY_CLOSE_ALREADY_LOCKED` without a new audit event.
- `마감확정` and `잠금` are both read-only states for payout-impacting writes. The shared `month-lock-guard` helpers define this rule for calls, daily expenses, earcare attendance, ops attendance, course policies, therapist rates, and ops incentive policy ranges.
- `/closing` actions call `requirePermission("closing:write")` and delegate transition/audit work to the closing domain service. UI components only render forms and status copy.
- `getMonthlyClosingSnapshot()` remains the historical source for closed or locked months and must return stored `snapshotJson`. Preview/current recalculation is labeled separately as `현재 기준 미리보기`.
- Monthly payout views such as `/settlements/operations/monthly` must show the persisted snapshot in a distinct `확정 스냅샷` section for `마감확정` or `잠금` months before showing any `현재 기준 미리보기` recalculation.
- Employee/profile/course active flag changes are not a second historical source. Closed-month payout/KPI display must prefer the saved snapshot display values.

## Story 5.5 Administrator Reopen

`reopenMonthlyClose()` owns the `잠금 -> 검토중` transition. It requires an administrator-only `closing:reopen` permission at the Server Action boundary and a non-empty trimmed reason of at least five characters. `settlement_manager` keeps `closing:write` for review/confirm/lock but cannot reopen.

- Reopen is allowed only from `잠금`. `작성중`, `검토중`, and `마감확정` return `INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION` without changing the operating month, snapshot metadata, or audit logs.
- The latest `MonthlyClosing` row is found by `operatingMonthId` ordered by `closeVersion desc`. The snapshot JSON is never overwritten. Optional reopen metadata (`reopenedAt`, `reopenedByAccountId`, `reopenReason`) is written to the latest row so the prior snapshot is distinguishable as historical.
- `monthly_close.reopened` uses `targetType: "monthly_close"` and `targetId` equal to the latest snapshot id. The audit `afterValue` includes operating month id/monthKey, status `검토중`, reason, reopenedAt, reopenedByAccountId, snapshot id, and closeVersion as plain JSON.
- After reopen, `검토중` is not a payout lock state. Payout-impacting writes are allowed or blocked only by each domain service boundary and must record their own domain audit events.
- `/closing` labels the prior snapshot as `이전 확정 스냅샷` for reopened `검토중` months and keeps the current recalculation under `현재 기준 미리보기`.
- Future dashboard/KPI readers must treat versioned snapshots the same way: `마감확정`/`잠금` reads use the latest saved snapshot, while reopened `검토중` months show current preview as the editable truth and prior snapshots only as historical reference.

## Downstream

- `dashboard` for closed-month summaries
- `audit` for close events

## Does Not Own

- daily attendance entry
- room status
- service-call UI state
