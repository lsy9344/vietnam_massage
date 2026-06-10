# Dashboard Module

## Source Documents

- `client_erp_specification.md` sections 6.1, 7.1
- `sheet_erp_design.md` sections 7.1, 12
- Excel sheet: `오늘대시보드`

## Responsibility

The dashboard module owns read-only operational KPI summaries:

- today reservation count
- today completed calls
- today no-shows
- today cancellations
- today payment total
- today therapist call and settlement summary
- completed calls by course
- monthly completed calls
- monthly reservations, no-shows, cancellations, and sales
- monthly close payout snapshot summaries for closed operating months

## Core Models

- `TodayDashboardMetric`
- `MonthlyDashboardMetric`
- `CourseCompletionMetric`

## Rules

- Sales and settlement amounts are based on completed calls only.
- Dashboard should query by date and operating month, not by Excel row ranges.
- Dashboard should not own business calculations that belong to `calls`, `settlements`, or `closing`.
- For `마감확정` or `잠금` operating months, monthly KPI and payout composition views must read the latest `MonthlyClosing` snapshot from `closing`, ordered by operating month and `closeVersion`.
- For reopened `검토중` operating months, current dashboard values are the editable current truth. Any previous monthly close snapshot is historical reference only and must not be shown as the current KPI source.
- Dashboard components must not parse `snapshotJson` ad hoc inside route components. Use a dashboard query service or closing adapter that returns a stable DTO for charts and KPI cards.
- If a required close snapshot is missing for a closed/locked month, show a distinct snapshot-missing state instead of silently falling back to current recalculation.

## Handoffs

- Reads current metrics from `calls` and `settlements`.
- Reads historical monthly close values from `closing` snapshots.
- Does not mutate operational records.
