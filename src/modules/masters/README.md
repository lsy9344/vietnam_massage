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

## Code And Time Slot Contract

코드와 시간 슬롯은 콜 원장, 정산, 객실 현황이 공유하는 드롭다운 기준 데이터다.

- `ensureDefaultCodeItems()` prepares `SERVICE_STATUS`, `PAYMENT_METHOD`, `DISCOUNT_TYPE`, `ATTENDANCE_STATUS`, and `CONFIRMATION` defaults. Empty discount/confirmation choices are represented by downstream `null`, not blank code rows.
- `ensureDefaultTimeSlots()` prepares exactly 29 input slots from `11:00` through `01:00`; workbook-only later values such as `01:30`, `02:00`, and `02:30` are not seeded for Story 1.6.
- `listCodeItems()` and `listTimeSlots()` return active and inactive rows for administrator management; `listActiveCodeItems()` and `listActiveTimeSlots()` return active-only dropdown DTOs for downstream modules.
- `CodeItem.codeType + code` and `TimeSlot.id`/`CodeItem.id` are stable references. `displayName` and `value` are operational labels that can change.
- `deactivateCodeItem()` and `deactivateTimeSlot()` set `isActive=false`; normal code/time-slot master flows do not physically remove rows.
- Successful writes record `code_item.created`, `code_item.display_name_changed`, `code_item.sort_order_changed`, `code_item.deactivated`, `time_slot.created`, `time_slot.value_changed`, `time_slot.sort_order_changed`, or `time_slot.deactivated` with plain JSON snapshots.

## Does Not Own

- service-call transactions
- daily settlement results
- monthly close snapshots
