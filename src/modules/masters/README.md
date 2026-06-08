# Masters Module

Owns configuration and master data.

## Includes

- operating months
- rooms
- employees
- courses
- course display names
- therapist course rates
- operations-team incentive rules
- status, payment, discount, confirmation, and attendance codes
- time slots

## Upstream

None. This module is the source of reference data for other modules.

## Downstream

- `calls`
- `rooms`
- `settlements`
- `closing`
- `dashboard`

## Operating Month Contract

운영월은 모든 콜 입력, 정산, 대시보드, 월마감이 공유하는 월 기준 마스터 데이터다.

- `createOperatingMonth()` creates a single `YYYY-MM` operating month with calculated ISO date range and default status `작성중`.
- `listOperatingMonths()` returns dense management-list DTOs with `monthKey`, `startDate`, `endDate`, `status`, `createdAt`, and `updatedAt`.
- `changeOperatingMonthStatus()` supports only `작성중` to `검토중` in Story 1.4. `마감확정`, `잠금`, and reopen transitions belong to monthly-close stories.
- `getOperatingMonthDateRange()` returns `{ monthKey, startDate, endDate, status }` so `calls`, `settlements`, `dashboard`, and `closing` can aggregate by operating-month dates instead of Excel row ranges.
- Successful creates record `operating_month.created`; status changes record `operating_month.status_changed`. Audit snapshots use ISO date strings, not `Date` objects.

## Does Not Own

- service-call transactions
- daily settlement results
- monthly close snapshots
