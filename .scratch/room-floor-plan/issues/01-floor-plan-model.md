# 01: 평면 배치 모델 — 좌표, 방→칸, 곧 비는 방, 흔든 선

**What to build:** 화면 없이 평면도를 그리는 데 필요한 순수 모듈을 만든다. "use client"가 없는 모듈(예: `src/modules/rooms/floor-plan.ts`)에 두고 단위 테스트로 굳힌다. (스펙 D1, D2)

**Blocked by:** 없음

**Status:** done

- [x] 배치 데이터: 4층(`top`)과 1–3층(`std`) 좌표를 시안 `mockup/_shared.js`의 `PLAN.LAYOUTS` 값 그대로 둔다(가로 1165 × 세로 400, 방 칸, 복도, 엘리베이터, 칸막이).
- [x] 방→칸: `RoomStatusDto[]`를 받아 층마다 칸과 방을 짝짓는다. 기준은 방 이름 앞 숫자(`roomFloorGroups`와 같은 규칙). 배치에 없는 방은 "기타"로, 방이 없는 칸은 빈 칸으로 돌려준다. 어떤 방도 빠지지 않는다.
- [x] 한 줄 규칙: 상태별로 {종류, 라벨, 값}을 돌려준다(사용중·종료임박 → 남은 분, 0 미만은 0 / 예약 → 시작 시각 / 종료확인 → 할 일 / 청소중·빈방 → 없음). 문구는 화면 경계에서 번역하므로 여기서는 키나 숫자만 준다.
- [x] 곧 비는 방: 빈방 전부 + 사용중·종료임박 중 남은 분 적은 순 3개. 남은 분이 같으면 방 순서로 안정 정렬한다.
- [x] 흔든 선: 층 번호 씨앗의 결정적 난수로 벽·엘리베이터 경로(SVG `d` 문자열)를 만든다. 같은 입력이면 늘 같은 문자열이다(서버·클라이언트 렌더 일치).
- [x] 단위 테스트(`tdd` 스킬): 방→칸(기본 11개, 번호 없는 방, 5xx 방, 빠진 방), 한 줄 규칙, 곧 비는 방 순서·개수, 흔든 선 결정성.

## Comments

### 2026-10-20 구현 (Claude)

**한 일**

- `src/modules/rooms/floor-plan.ts`("use client" 없음): `FLOOR_PLAN_LAYOUTS`(시안 `PLAN.LAYOUTS` 값 그대로), `floorPlanFloors`(방→칸, 기타), `floorPlanRoomLine`(한 줄 규칙), `floorPlanFreeRooms`(지금 빈방·곧 비는 방), `floorPlanPencilPaths`(층 씨앗 `floor × 7919`의 Park–Miller 난수로 벽·엘리베이터 경로).
- 방→칸은 이름 앞 숫자로 찾는다. 배치에 없는 번호(번호 없음, 5xx, `12번방` 같은 두 자리)와 **같은 칸의 두 번째 방**(예: `301 호실`과 `301-B`)은 들어온 순서대로 `others`(기타)로 보낸다. 방이 없는 칸은 `status: null`이고 네 층은 늘 돌려준다.
- 정한 것(스펙에 없는 세부):
  - 사용중·종료임박인데 `remainingMinutes`가 null이면 줄이 없다(0분으로 꾸미지 않는다). 예약인데 `startTime`이 null이어도 줄이 없다.
  - 곧 비는 방은 `remainingMinutes`가 있는 방만 고르고, 같은 분이면 들어온 순서(`listRoomStatuses`의 `sortOrder` 순)를 지킨다(안정 정렬).
  - 빈방은 들어온 순서 그대로 전부다.

**검증**

- `src/modules/rooms/floor-plan.test.ts` 14건: 기본 11개 배치, 기타(번호 없음·5xx·같은 칸 중복·두 자리), 빈 칸, 방 0개, 한 줄 규칙 4건, 곧 비는 방 순서·개수·동률·없음, 흔든 선이 시안과 같은 문자열(시안 `_shared.js`·`_pencil.js`를 node로 돌려 뽑은 4층·1층 경로), `Math.random` 막고도 같은 값, 층마다 다른 모양.
- `pnpm test:unit` 1023/1023 통과, `tsc --noEmit` 통과.
