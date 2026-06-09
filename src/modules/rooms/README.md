# Rooms Module

Owns room-status views for waiters and TV display.

## Story 3.1 Contract

- `RoomStatusDto` is the shared DTO for the first screen, waiter room status, and TV board.
- `listRoomStatuses({ operatingMonthId, serviceDate, now?, prismaClient? })` is the domain service for current room occupancy.
- The latest active call per room is selected from active call statuses `예약`/`RESERVED`, `사용중`/`IN_USE`/`USING`, and `청소중`/`CLEANING`.
- Excluded statuses `방문완료`/`VISIT_COMPLETE`, `노쇼`/`NO_SHOW`, and `취소`/`CANCELED` never occupy a room.
- Start times crossing 자정 are normalized before latest-call and remaining-time calculations.
- Elapsed `사용중` calls return `displayStatus="종료확인"` while preserving the original `sourceCallStatus`.
- This service is read-only / 조회 전용 and must not mutate service calls, settlement, closing, or audit data.

## Includes

- room status view
- remaining minutes
- expected end time
- display status
- waiter guidance text
- TV display card data

## Upstream

- `calls` for active reservations and usage
- `masters` for rooms and course display data

## Downstream

- dashboard and room-display screens

## Does Not Own

- service-call mutation
- settlement calculation
- monthly close data
