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

## Core Models

- `TodayDashboardMetric`
- `MonthlyDashboardMetric`
- `CourseCompletionMetric`

## Rules

- Sales and settlement amounts are based on completed calls only.
- Dashboard should query by date and operating month, not by Excel row ranges.
- Dashboard should not own business calculations that belong to `calls`, `settlements`, or `closing`.

## Handoffs

- Reads from `calls`, `settlements`, and `closing`.
- Does not mutate operational records.

