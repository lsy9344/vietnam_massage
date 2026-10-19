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
- `/tv` is read-only / 조회 전용 and uses `requireRouteAccess("/tv")` for administrator/counter/read_only_viewer access only (spec 9.1 grants 카운터 "TV 화면 조회"); waiter and settlement_manager redirect to their landing.
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

## Ticket 14 Contract (객실 겹침)

- 객실 겹침은 콜 서비스의 `roomFloorFactsForDate()`가 판정한다(원장 행의 `room_overlap` 경고와 같은 판정). `listRoomStatuses()`는 그 결과를 받아 객실마다 `overlappingCalls`에 옮길 뿐 다시 판정하거나 다시 정렬하지 않는다. UI 계산 재구현 금지.
- `overlappingCalls`는 `includeOverlaps: true`일 때만 채운다(객실 화면). 실시간과 TV는 끄고, 그때 읽는 콜도 예전처럼 활성 상태뿐이다.
- 항목에는 예약시각, 코스, Therapist, 상태, 표시 종료만 있다. 고객/메모, 연락처, 금액, 수당은 담지 않는다.
- 객실 카드는 겹침이 있으면 "겹친 콜 N건"과 펼침 목록을 보인다. 원장의 콜 상세 링크는 `/calls`에 들어갈 수 있는 역할(관리자·카운터)에게만 있다. 실시간 카드에는 목록 대신 대표 콜의 원장 상세 링크가 있다. TV에는 둘 다 없다.

## 객실 평면도 Contract (.scratch/room-floor-plan)

- `/live`와 `/tv`의 객실판은 층별 평면도다(`RoomFloorPlan`). 이 절이 위 Story 3.2·3.4·3.5의 "카드를 그린다", "TV typography keeps `text-[40px]`…" 문장보다 앞선다. `/rooms`는 그대로 `RoomStatusCard` 목록이고 Story 3.5의 카드 계약이 그대로 적용된다.
- 평면도 이름표도 `StatusBadge`로 색·글자·기호를 함께 그린다. 예외는 폭 140px 이하의 좁은 칸뿐으로, 배지 글자를 숨기고 기호와 색만 둔다. 그 뜻은 같은 화면의 범례(상태 배지 6개)가 주고, 방 버튼의 접근 이름에는 상태 글자가 늘 들어 있다(스펙 D2).
- TV 이름표 크기는 방 번호 40px, 배지 22px, 값 34px다(폭 1600px 이상, 스펙 D4).
- 배치 좌표, 방→칸(방 이름 앞 숫자, 배치에 없는 방은 기타), 이름표의 한 줄, "지금 빈방 / 곧 비는 방", 손그림 선 경로는 `floor-plan.ts`가 정한다. 서버 페이지와 클라이언트가 함께 쓰므로 "use client"를 붙이지 않는다.
- 값은 `RoomStatusDto` 그대로다. 남은 분·상태·시작 시각을 다시 계산하지 않는다(UI 계산 재구현 금지). 남은 분이 0 미만이면 0으로 보일 뿐이다.
- `/live`는 방이나 빈방 칩을 누르면 서랍(`ModalPanel`)에 서버가 그린 `RoomStatusCard`를 띄운다. 원장 링크 권한은 카드 그대로다. `/tv`는 읽기 전용이라 누르는 것이 없다.

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
