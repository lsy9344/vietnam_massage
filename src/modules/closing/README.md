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

`listMonthlyClosingPreview()` is the Story 5.1 read-only orchestration service for `/closing`.

- It reads one `OperatingMonth` and iterates the ISO `YYYY-MM-DD` operating-month range.
- It reuses `listTherapistDailySettlements()` for therapist monthly call and payout totals.
- It reuses `listOpsDailyIncentives()` for operating team daily incentives.
- It reuses `listOpsMonthlyIncentivePreview()` for operating team monthly incentive threshold, team split, employee rows, call evidence, and warning messages.
- It reuses `listEarcareDailySettlements()` for earcare pool, distributed amount, undistributed amount, eligible day count, and normal-staff-zero warnings.
- Row identity and downstream identifiers stay on `Employee.id`; `staffCode` and names are display evidence only.
- `draft_current` means 작성중/검토중 current preview. `closed_current` means 마감확정/잠금 current preview, not a persisted closing snapshot.
- Story 5.1 intentionally leaves full-attendance allowance and count-king bonus as `pending_story_5_2`; no fake bonus calculation is performed.
- The preview is read-only: no persistence, no `MonthlyClose`/snapshot model, no payout table, no audit event, no status mutation, no Server Action write path.

## Downstream

- `dashboard` for closed-month summaries
- `audit` for close events

## Does Not Own

- daily attendance entry
- room status
- service-call UI state
