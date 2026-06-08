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

## Room Contract

객실은 콜 원장, 객실 현황, TV 현황판이 공유하는 기준 마스터 데이터다.

- `ensureDefaultRooms()` prepares the default 11 rooms from `101 호실` through `402 호실` with stable IDs, spaced sort orders, and preserved hidden-list references from `1번방` through `11번방`.
- `listRooms()` returns active and inactive rooms for administrator management; `listActiveRooms()` returns only active rooms for downstream selection lists.
- `updateRoomDisplayName()` changes the operational display label while preserving the stable `Room.id` and `migrationReferenceName`.
- `updateRoomSortOrder()` changes TV/room-card order and rejects duplicate sort order values.
- `deactivateRoom()` sets `isActive=false`; normal room master flows do not physically remove room rows.
- Successful room writes record `room.created`, `room.display_name_changed`, `room.sort_order_changed`, or `room.deactivated` with plain JSON snapshots.

## Does Not Own

- service-call transactions
- daily settlement results
- monthly close snapshots
