# Dashboard Module

Owns read-only KPI summaries.

## Includes

- today dashboard metrics
- monthly dashboard metrics
- course completion counts
- payment and settlement summaries
- monthly close snapshot summaries for closed months

## Upstream

- `calls`
- `settlements`
- `closing`

## Snapshot Rules

- `마감확정` and `잠금` operating months use the latest `MonthlyClosing` snapshot as the historical KPI source.
- Reopened `검토중` months use current recalculation as the editable truth; previous snapshots are historical reference only.
- Dashboard route components should consume a dashboard query DTO instead of parsing `MonthlyClosing.snapshotJson` directly.
- Missing snapshots for closed or locked months must be surfaced as a distinct state, not hidden by current preview fallback.

## Story 6.1 Today Dashboard

- `dashboard-query-service.ts` owns `getTodayDashboardMetrics({ operatingMonthId, serviceDate, prismaClient? })`.
- The service returns a read-only DTO for `/dashboard/today`: operating month, service date, status counts, financials, therapist summary, A-E course completions, warning counts, empty state, and source basis.
- It reuses `getDailyCallLedgerSummary()` for call counts, completed-call financial totals, expenses, course completions, and warning propagation.
- It reuses `listTherapistDailySettlements()` for `THERAPIST_1`/`THERAPIST_2` assigned-call counts and therapist settlement totals.
- Route components and UI components must not recalculate call, discount, commission, course, or therapist evidence rules.
- Empty dates are shown as no-call state; warning dates are shown as calculated values with explicit policy/rate/D-course exclusions.

## Downstream

- dashboard screens and reports

## Does Not Own

- core calculation rules
- mutable operational records
- close confirmation
