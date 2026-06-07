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

- `RoomStatusView`
- `RoomStatusSnapshot`
- `RoomDisplayCard`

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

