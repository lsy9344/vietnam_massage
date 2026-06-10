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

## Downstream

- `dashboard` for closed-month summaries
- `audit` for close events

## Does Not Own

- daily attendance entry
- room status
- service-call UI state
