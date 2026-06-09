# Rooms Module

## Source Documents

- `client_erp_specification.md` sections 6.3, 6.4
- `sheet_erp_design.md` sections 7.3, 7.4, 8.2, 10.2
- Excel sheets: `웨이터리스트`, `TV현황판`, `TV설정`

## Responsibility

The rooms module owns room-status presentation for operational use:

- waiter room list
- TV room board
- remaining-time calculation
- expected end time
- display status and display color mapping
- waiter guidance text

## Core Models

- `RoomStatusDto`
- `RoomStatusCourseDto`
- `RoomStatusAssigneeDto`
- `RoomDisplayCard`

## Story 3.1 Contract

- `RoomStatusDto` includes stable room/call/course/employee IDs, display names, sort order, display status, source call status, start time, expected end, remaining minutes, guidance text, and update timestamp.
- `listRoomStatuses({ operatingMonthId, serviceDate, now?, prismaClient? })` owns the active call calculation for all room-status surfaces.
- The service finds the latest active call by room using service date, 자정-normalized start time, and deterministic update/create/id tie breakers.
- Active call statuses are `예약`/`RESERVED`, `사용중`/`IN_USE`/`USING`, and `청소중`/`CLEANING`.
- Excluded statuses are `방문완료`/`VISIT_COMPLETE`, `노쇼`/`NO_SHOW`, and `취소`/`CANCELED`; they do not occupy a room.
- Missing course policy keeps the room occupied but returns `course`, `expectedEndAt`, and `remainingMinutes` as `null`.
- The service is read-only / 조회 전용 and does not mutate calls, status history, settlement, closing, or audit records.

## Rules

- Find the latest active call by room where status is `사용중`, `청소중`, or `예약`.
- If no active call exists, display `빈방`.
- If a room is `사용중` and remaining minutes are zero, display `종료확인`.
- Start times crossing midnight must be normalized.
- TV display is read-only.

## Handoffs

- Reads `calls` and `masters`.
- Feeds room display screens and dashboard summaries.
- Does not mutate settlement or closing records.
