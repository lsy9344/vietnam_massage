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

## Story 3.2 First Screen Handoff

- `/live` is a read-only / 읽기 전용 downstream screen that consumes `RoomStatusDto` from `listRoomStatuses()`.
- The first screen, waiter room status, and future TV board must reuse the same DTO and shared room-status card surface.
- `/live` must not recalculate active calls, remaining minutes, expected end, or `종료확인`; UI 계산 재구현 금지.
- The screen displays the last room-status update and 갱신 지연 state so operators do not mistake stale data for current state.

## Story 3.3 Waiter Room Status Screen

- `/rooms` is the 웨이터 and 조회 전용 landing for room status. It is read-only / 읽기 전용.
- `/rooms` consumes `RoomStatusDto` from `listRoomStatuses()` and renders `RoomStatusCard`; it must not recalculate active calls, remaining minutes, expected end, `종료확인`, or guidance text. UI 계산 재구현 금지.
- Status guidance comes from `ROOM_STATUS_GUIDANCE_TEXT` in `src/modules/rooms/room-status-service.ts`. `/rooms` does not own a separate guidance copy.
- `/rooms` may change only lookup conditions through operating-month/date query params. It does not include call ledger grid, autosave, daily expense, settlement, or closing mutation affordances.
- `/rooms` uses the shared `RoomStatusRefreshController` with 15초 polling, manual refresh, last refresh time, `갱신 중`, and `갱신 지연`.

## Story 3.4 TV Fullscreen Board

- `/tv` is a fullscreen route outside the ERP shell. ERP chrome 없음: no sidebar, topbar, account badge, call-ledger grid, or edit controls render on the TV board.
- `/tv` is 조회 전용 / 읽기 전용 and consumes `RoomStatusDto` from `listRoomStatuses()` through `RoomStatusCard variant="tv"`.
- `/tv` must not recalculate active calls, remaining minutes, expected end, `종료확인`, course TV labels, or assignee display. UI 계산 재구현 금지.
- `/tv` uses the shared `RoomStatusRefreshController variant="tv"` with 15초 polling, manual refresh, last refresh time, `갱신 중`, and `갱신 지연`.
- TV cards always show status color, text label, and glyph. `종료확인` uses a strong attention treatment and short copy such as `결제·확인 필요`.
- `/tv` keeps `requireRouteAccess("/tv")`; administrator and read_only_viewer can access it, while waiter/counter/settlement_manager redirect to their role landing.

## Story 3.5 Status Presentation Contract

- The status token source of truth is `src/app/globals.css` plus `src/components/domain/status-badge.tsx`; room status surfaces must consume `RoomStatusCard` and `StatusBadge` instead of route-local status color maps.
- Every badge combines 색상, 텍스트 라벨, 글리프. Fixed glyphs are `사용중 ●`, `예약 ◷`, `청소중 ◐`, `종료확인 ⚠`, and `빈방 ○`.
- `청소중` uses `bg-status-cleaning text-status-cleaning-foreground`; white foreground on the gold fill is forbidden.
- `빈방` uses an outline/ghost treatment with `border-status-empty`, `bg-surface`, and `text-status-empty-foreground`; filled bronze badges are forbidden.
- `종료확인` uses dark `status-complete-check` for text-bearing badges. Bright `status-complete-check-glow` is limited to glow/ring/accent treatment.
- `.status-attention` may use only a slow opacity breathe on the non-text ring pseudo-element. Under `prefers-reduced-motion: reduce`, animation is disabled and the static ring plus `⚠` label remain.
- TV typography keeps the large-distance ramp: room name `text-[40px]`, status badge `text-[28px]`, and meta text `text-[22px]`. A small swatch 단독 must never carry status meaning.
- This polish does not change domain calculation ownership. `RoomStatusDto` still owns `displayStatus`, remaining minutes, expected end, course labels, and assignees; UI 계산 재구현 금지.

## Rules

- Find the latest active call by room where status is `사용중`, `청소중`, or `예약`.
- If no active call exists, display `빈방`.
- If a room is `사용중` and remaining minutes are zero, display `종료확인`.
- Start times crossing midnight must be normalized.
- TV display is read-only.

## Handoffs

- Reads `calls` and `masters`.
- Feeds room display screens and dashboard summaries.
- Feeds `/live` first-screen room cards.
- Feeds `/rooms` waiter room-status cards and guidance text.
- Feeds `/tv` fullscreen room-status board.
- Does not mutate settlement or closing records.
