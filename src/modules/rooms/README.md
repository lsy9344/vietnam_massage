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

## Story 3.2 Contract

- `/live` is a read-only / 읽기 전용 first screen that consumes `RoomStatusDto` from `listRoomStatuses()`.
- The shared room-status card receives `RoomStatusDto` as-is and must not recalculate active-call selection, remaining minutes, expected end, or `종료확인`; UI 계산 재구현 금지.
- `/live` exposes last refresh and 갱신 지연 affordances while keeping the previous rendered values visible during refresh.

## Story 3.3 Contract

- `/rooms` is the 웨이터 and 조회 전용 landing for 객실 현황.
- `/rooms` is read-only / 읽기 전용 and does not expose call ledger grid, autosave, daily expense, settlement, or closing mutations.
- `/rooms` consumes `RoomStatusDto` from `listRoomStatuses()` and renders `RoomStatusCard`; it must not recalculate active-call selection, remaining minutes, expected end, `종료확인`, or guidance text. UI 계산 재구현 금지.
- `ROOM_STATUS_GUIDANCE_TEXT` is the source of truth for status-specific waiter guidance.
- `/rooms` uses shared 15초 refresh affordance with last refresh, `갱신 중`, and `갱신 지연`.

## Story 3.4 Contract

- `/tv` is the fullscreen TV board route outside the ERP shell; ERP chrome 없음 means no sidebar, topbar, or input/edit affordances.
- `/tv` is read-only / 조회 전용 and uses `requireRouteAccess("/tv")` for administrator/read_only_viewer access only.
- `/tv` consumes `RoomStatusDto` from `listRoomStatuses()` and renders `RoomStatusCard variant="tv"`; it must not recalculate active-call selection, remaining minutes, expected end, `종료확인`, course labels, or assignees. UI 계산 재구현 금지.
- `/tv` uses shared 15초 refresh affordance through `RoomStatusRefreshController variant="tv"` with last refresh, `갱신 중`, and `갱신 지연`.
- TV status presentation combines color, text label, and glyph; `종료확인` shows short attention copy such as `결제·확인 필요`.

## Story 3.5 Contract

- `src/app/globals.css` and `src/components/domain/status-badge.tsx` are the status token source of truth.
- `StatusBadge` always renders 색상, 텍스트 라벨, 글리프 together: `사용중 ●`, `예약 ◷`, `청소중 ◐`, `종료확인 ⚠`, `빈방 ○`.
- `청소중` uses `text-status-cleaning-foreground`, never white foreground, on the gold fill.
- `빈방` uses outline/ghost styling with `border-status-empty`, `bg-surface`, and dark foreground.
- `종료확인` separates dark text badge fill from bright `status-complete-check-glow` card ring/accent; the badge itself does not animate.
- `prefers-reduced-motion` disables attention animation and keeps the static ring plus `⚠` label.
- TV typography keeps `text-[40px]`, `text-[28px]`, and `text-[22px]` ramp; status cannot collapse to a swatch 단독.
- Route UI must not create local status color maps or recalculate `종료확인`; UI 계산 재구현 금지.

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
- `/live` first-screen room cards
- `/rooms` waiter room-status cards
- `/tv` fullscreen room-status board

## Does Not Own

- service-call mutation
- settlement calculation
- monthly close data
