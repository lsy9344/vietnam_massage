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

`MonthlyClosing` is the persisted historical close record in `monthly_closings`. It stores one immutable snapshot per `OperatingMonth` through the unique `operatingMonthId` constraint.

- `startMonthlyCloseReview()` owns the `작성중 -> 검토중` transition for the closing workflow and records `operating_month.status_changed`.
- `confirmMonthlyClose()` owns the `검토중 -> 마감확정` transition, calls `listMonthlyClosingPreview()` inside the transaction boundary, creates the `MonthlyClosing` snapshot, and records `monthly_close.confirmed`.
- `getMonthlyClosingSnapshot()` returns the stored `snapshotJson`; it must not call the preview service and present recalculated current values as historical values.
- The snapshot normalizes preview data into a confirmation DTO with month key/date range/status at confirmation, therapist rows, operations rows, earcare rows, totals, warning counts, evidence, and source basis.
- Snapshot rows preserve stable identifiers (`Employee.id`, `staffCode`, `Course.code` where present), display labels, ISO dates/date-times, warning/evidence strings, and VND number amounts as plain JSON.
- Confirmation uses a transaction across conditional `OperatingMonth.updateMany`, `MonthlyClosing.create`, and audit logging. Duplicate confirm is blocked by both domain status checks and the DB unique constraint.
- `monthly_close.confirmed` uses `targetType: "monthly_close"`; operating-month review status changes use `targetType: "operating_month"`.
- The UI separates preview and snapshot: current recalculating values are labeled `현재 기준 미리보기`, while persisted historical values are labeled `확정 스냅샷`.
- Story 5.4 will add lock-state write blocking, Story 5.5 will own reopen/cancel policy with reason, and Story 5.6 will own the double-confirmation dialog/focus contract.

## Downstream

- `dashboard` for closed-month summaries
- `audit` for close events

## Does Not Own

- daily attendance entry
- room status
- service-call UI state
