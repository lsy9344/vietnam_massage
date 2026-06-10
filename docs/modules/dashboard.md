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
- graph report datasets for owner-facing trends and rankings

## Core Models

- `TodayDashboardMetric`
- `MonthlyDashboardMetric`
- `CourseCompletionMetric`

## Rules

- Sales and settlement amounts are based on completed calls only.
- Dashboard should query by date and operating month, not by Excel row ranges.
- Dashboard should not own business calculations that belong to `calls`, `settlements`, or `closing`.
- Story 6.1 today KPI is owned by `src/modules/dashboard/dashboard-query-service.ts`.
- `/dashboard/today` consumes `getTodayDashboardMetrics()` and must not calculate call counts, completed-call financial totals, therapist evidence, or course completion rules in the route component.
- `getTodayDashboardMetrics()` reuses `getDailyCallLedgerSummary()` for status counts, payment/net sales/discount/expense/earcare/commission totals, A-E course completions, and warning counts.
- `getTodayDashboardMetrics()` reuses `listTherapistDailySettlements()` for `THERAPIST_1`/`THERAPIST_2` assigned-call counts and therapist settlement totals, including same-therapist dual-role evidence.
- Today dashboard empty state distinguishes dates with no calls from dates where warning rows are excluded from amount/course aggregates.
- Story 6.2 monthly KPI is owned by `getMonthlyDashboardMetrics({ operatingMonthId })`.
- `/dashboard/monthly` canonicalizes `operatingMonthId` in URL search params and consumes the monthly dashboard DTO.
- Monthly KPI reads `OperatingMonth.startDate` through `endDate` with `operatingMonthId`; it does not use Excel row ranges.
- Monthly status counts and completed-call financial/course values are accumulated from `getDailyCallLedgerSummary()` range results so warning and completed-only semantics stay aligned with the call ledger.
- For `마감확정` or `잠금` operating months, monthly KPI and payout composition views must read the latest `MonthlyClosing` snapshot through `getMonthlyClosingSnapshot()`, ordered by operating month and `closeVersion`.
- Closed/locked dashboard payout values are labeled `확정 스냅샷 기준` and expose `closeVersion` and `confirmedAt`.
- Missing closed snapshots are a distinct `snapshot_missing` state; current payout preview must not be shown as a fallback.
- For reopened `검토중` operating months, current dashboard values are the editable current truth. Any previous monthly close snapshot is historical reference only and must not be shown as the current KPI source.
- Dashboard components must not parse `snapshotJson` ad hoc inside route components. Use a dashboard query service or closing adapter that returns a stable DTO for charts and KPI cards.
- If a required close snapshot is missing for a closed/locked month, show a distinct snapshot-missing state instead of silently falling back to current recalculation.
- Story 6.3 graph reports are owned by `getDashboardGraphReport({ operatingMonthId, serviceDate })` and returned as `DashboardGraphReportDto`.
- `/dashboard/reports` canonicalizes `operatingMonthId` and `serviceDate` in URL search params and consumes the graph report DTO.
- Graph report `sourceBasis` uses the same `current_recalculation`, `closed_snapshot`, and `snapshot_missing` semantics as Story 6.2.
- Daily revenue and no-show/cancel trends scan `OperatingMonth.startDate` through `endDate` and include only completed calculated calls for revenue.
- Course mix uses stable A-E course codes from calculated service-call DTOs. CRM, customer segment, marketing, or non-Excel-derived metrics are not part of this report.
- Therapist call ranking aggregates `THERAPIST_1` and `THERAPIST_2` evidence by `Employee.id`, including same employee dual-role assignments.
- Therapist settlement ranking and payout composition use current monthly closing preview for open/review months and latest closing snapshot for closed/locked months.
- Room status distribution uses `listRoomStatuses()` and `RoomStatusDto.displayStatus`; route/chart code must not recalculate occupancy or `종료확인`.
- Chart components must provide accessible labels, visible values, legends or text labels, and table/list fallback data. Color-only meaning is not allowed.
- Route and chart components must not parse `snapshotJson`, query call rows directly, or recreate calls, settlements, closing, or room-status business calculations.
- Story 6.4 formalizes dashboard state handling across today, monthly, and reports. `loading` uses layout-preserving Skeleton UI with Korean labels; `error` uses safe Korean copy, alert semantics, retry, and refresh; `empty` states distinguish no calls, no calculated completed calls, missing settlement source, missing room status data, and `snapshot_missing`.
- Story 6.4 status color rule: status color tokens are used only for room or service status meaning through `StatusBadge` or equivalent status UI. Revenue, ranking, payout composition, no-show, and cancel chart series must use non-status colors such as brand/danger.
- Story 6.4 forbids fake 0값 graphs for missing calculated data. If calculated completed-call data is missing, show an explicit empty message and do not render revenue or course mix charts as successful completed charts.
- Story 6.4 keeps the Story 6.3 project-local SVG/CSS primitives. Do not add a chart dependency unless a later story verifies and pins the exact version and records compatibility and bundle impact.

## Handoffs

- Reads current metrics from `calls` and `settlements`.
- Reads historical monthly close values from `closing` snapshots.
- Does not mutate operational records.
- Exposes today KPI DTO fields: `operatingMonth`, `serviceDate`, `statusCounts`, `financials`, `therapistSummary`, `courseCompletions`, `warningCounts`, `emptyState`, and `sourceBasis`.
- Exposes monthly KPI DTO fields: `operatingMonth`, `sourceBasis`, `statusCounts`, `financials`, `courseCompletions`, `warningCounts`, `settlementSummary`, `snapshot`, and `emptyState`.
- Exposes graph report DTO fields: `operatingMonth`, `serviceDate`, `sourceBasis`, `dailyRevenueTrend`, `courseMix`, `therapistCallRanking`, `therapistSettlementRanking`, `roomStatusDistribution`, `noShowCancelTrend`, `opsIncentiveOrPayoutComposition`, `warningCounts`, and `emptyStates`.
