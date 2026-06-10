# Dashboard Module

Owns read-only KPI summaries.

## Includes

- today dashboard metrics
- monthly dashboard metrics
- graph report metrics
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

## Story 6.2 Monthly Dashboard

- `dashboard-query-service.ts` owns `getMonthlyDashboardMetrics({ operatingMonthId, prismaClient? })`.
- The service returns a read-only DTO for `/dashboard/monthly`: operating month, `sourceBasis`, monthly status counts, completed-call financials, A-E course completions, warning counts, settlement summary, snapshot reference, and empty state.
- Monthly call metrics are accumulated over `OperatingMonth.startDate` through `endDate` with `operatingMonthId`; Excel row ranges are not a query boundary.
- `sourceBasis.kind` is `current_recalculation`, `closed_snapshot`, or `snapshot_missing`.
- `작성중` and `검토중` months use current call ledger and `listMonthlyClosingPreview()` payout summary and are labeled `미확정 현재 기준`.
- `마감확정` and `잠금` months use `getMonthlyClosingSnapshot()` latest `MonthlyClosing` snapshot for payout/settlement summary and are labeled `확정 스냅샷 기준` with `closeVersion` and `confirmedAt`.
- Missing closed snapshots surface `snapshot_missing`; the dashboard must not silently fallback to current payout preview.
- Reopened `검토중` months keep current recalculation as the KPI source. Any latest snapshot is returned only as `이전 확정 스냅샷` reference.
- `/dashboard/monthly` consumes the DTO and must not parse `MonthlyClosing.snapshotJson`, read service call rows directly, or recreate course/settlement calculations in route code.

## Story 6.3 Graph Report

- `dashboard-query-service.ts` owns `getDashboardGraphReport({ operatingMonthId, serviceDate, prismaClient?, dependencies? })`.
- The service returns a read-only `DashboardGraphReportDto` for `/dashboard/reports`: operating month, selected service date, `sourceBasis`, daily revenue trend, A-E course mix, therapist call ranking, therapist settlement ranking, room status distribution, no-show/cancel trend, payout composition, warning counts, and empty states.
- Revenue trend, no-show/cancel trend, and warning counts are accumulated over `OperatingMonth.startDate` through `endDate` with `operatingMonthId`; Excel row ranges are not a query boundary.
- Course mix uses calculated completed service-call DTOs with stable `courseCode`; route and chart components must not recompute payment, discount, course policy, or therapist rate rules from raw rows.
- Therapist call ranking aggregates `THERAPIST_1` and `THERAPIST_2` assignment evidence by `Employee.id`. Display names and staff codes are labels only.
- Therapist settlement ranking and payout composition use `listMonthlyClosingPreview()` for `작성중`/`검토중` and latest `getMonthlyClosingSnapshot()` for `마감확정`/`잠금`.
- Missing closed snapshots surface `sourceBasis.kind = "snapshot_missing"` and empty settlement/payout graph states. Current preview must not be shown as fallback.
- Room status distribution uses `listRoomStatuses()` and `RoomStatusDto.displayStatus`; dashboard code must not recreate active call selection, remaining minutes, or `종료확인`.
- `/dashboard/reports` consumes `DashboardGraphReportDto` only. Chart components may compute visual scaling or presentation percentages, but must not create business aggregates, parse `snapshotJson`, or call upstream calls/settlements/rooms services directly.
- Charts must include accessible names, visible numeric labels, legends or labels, and table/list fallback data so color is never the only source of meaning.

## Story 6.4 Dashboard State and Color Contract

- Story 6.4 keeps the dashboard loading, error, empty, and chart color rules as a route-local presentation contract. Add a shared helper only when today, monthly, and reports all reuse it and it reduces tests.
- Dashboard loading screens must preserve the real layout outline with `Skeleton`, `aria-busy="true"`, and Korean loading labels. While URL criteria change, the UI must not show the previous date or month as if it were the new server query basis.
- Dashboard error boundaries must show safe Korean copy, `role="alert"`, `다시 시도`, and `현재 조건 새로고침`. They must not expose raw server error details.
- Dashboard empty states must distinguish no calls, no calculated completed calls, missing settlement source, missing room status data, and `snapshot_missing`. Do not render missing completed data as a fake 0값 completed graph.
- status color tokens are reserved for room/status meaning only. General revenue, ranking, payout, no-show, and cancel series use brand/danger or another non-status chart color.
- Chart legend, visible labels, SVG titles, and table/list fallback must include text and numbers; color alone is not enough.
- No chart dependency is allowed for this story. If a later story requires one, pin an exact compatible version and document the bundle impact before adding it.

## Downstream

- dashboard screens and reports

## Does Not Own

- core calculation rules
- mutable operational records
- close confirmation
