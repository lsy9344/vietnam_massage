# 객실 평면도: 실시간·TV 객실판을 실제 도면 배치로

Status: ready-for-agent

기준일: 2026-10-19. 구현 티켓은 `issues/` 01–04다. 브랜치 `feat/room-floor-plan`(워크트리 `../vietnam_massage-floor-plan`)은 지금 프리뷰로 배포된 `preview/dock-zone-menu`(a9e0261) 위에서 시작한다. main 병합, push, 배포는 하지 않는다.

**확정 시안:** `mockup/c3-pencil.html`(사용자 확정 "C3 연필 스케치", 글자 정렬은 왼쪽 위). 브라우저로 열고 주소 뒤에 `?view=tv`, `?lang=vi`, `?room=301`(서랍 열림)을 붙여 본다. 점선 위의 버튼 줄(시안·화면·언어·글자 정렬)은 시안 도구라서 앱에 넣지 않는다. 시안의 좌표·문구·규칙은 `mockup/_shared.js`(`PLAN`, `minimalLine`)와 `mockup/_pencil.js`(흔든 선, 이름표, 곧 비는 방)에 있다.

**원본 도면:** `/mnt/c/Users/dltnd/Desktop/garbage/1_sideview.jpg`(단면), `2_topview_2nd_f.jpg`(2층 평면), `3_topview_4nd_f.jpg`(4층 평면).

## Problem Statement

`/live`(첫화면 실시간 현황)와 `/tv`(TV 현황판)의 객실판은 층별로 둥근 카드를 격자로 늘어놓는다. 카드 자리가 실제 방 위치와 관계없어서, 직원은 "301이 건물 어디지"를 머릿속으로 바꿔야 한다. 4층 401은 침대 둘인 큰 방인데 다른 방과 같은 크기 카드다.

## Solution

층마다 실제 평면을 손으로 쓱 그린 듯한 연필선으로 그리고, 방 자리에 방 번호·상태 배지·값 하나를 둔다. 손이 가야 하는 방(종료임박·종료확인)은 번호에 상태색 마커 동그라미를 친다. 평면도 위(TV는 아래)에 "지금 빈방 / 곧 비는 방" 한 줄을 둔다. 실시간 화면에서 방을 누르면 오른쪽 서랍에 지금 객실 카드(RoomStatusCard) 전체가 뜬다.

상태 판정, 남은 분 계산, 권한, 갱신 방식은 바뀌지 않는다. 바뀌는 것은 객실판을 그리는 방법뿐이다.

## 결정 (2026-10-19 사용자와 시안 3차까지 거쳐 확정)

### D1 건물과 배치

- 건물은 층마다 왼쪽에서 오른쪽으로 길다. 왼쪽 띠는 **엘리베이터와 복도**다(사용자 정정: 계단이 아니다). 아래 띠는 복도이고 왼쪽 띠와 이어진 한 공간이다. 오른쪽 바깥벽은 창이지만 따로 그리지 않는다.
- 4층: 402(계단 쪽 칸) · 401(두 칸 너비, 복도 깊이까지). 1–3층: n03 · n02 · n01(창 쪽, 복도 깊이까지). 사용자는 "2·3층은 같다"고 했다. **1층이 같은 배치라는 것은 가정이다**(단면도의 칸 나눔은 같다). 다르면 배치 데이터만 고친다.
- 좌표는 도면 단위 가로 1165 × 세로 400이다. 값은 `mockup/_shared.js`의 `PLAN.LAYOUTS`(`std`, `top`)를 그대로 쓴다: 방 칸(`slots`), 복도(`corridor`), 엘리베이터 상자(`elevator`), 칸막이(`walls`, 끊긴 자리가 문).
- 방을 칸에 놓는 기준은 방 이름 앞 숫자다(`roomFloorGroups`와 같은 규칙). 401 → 4층 wide, 402 → 4층 03, n01·n02·n03 → n층 01·02·03.
- 배치에 없는 활성 방(번호가 없거나 5xx 등)은 평면도 아래 "기타" 줄에 같은 이름표로 둔다. 어떤 방도 화면에서 사라지면 안 된다.
- 배치 칸에 해당하는 방이 없으면(비활성 등) 벽은 그리고 이름표는 두지 않는다.

### D2 모양 (design.md를 따른다)

- **벽:** 층 번호로 정한 고정 씨앗의 난수로 살짝 흔든 두 겹 연필선이다(시안 `_pencil.js`의 `wobble`). 새로고침·자동 갱신·서버/클라이언트 렌더에서 모양이 같아야 한다. `Math.random` 금지. 선은 `--text` 82% 불투명, 1.5px(TV 2.2px), `vector-effect: non-scaling-stroke`. 엘리베이터 상자와 ▲▼는 더 옅은 선이다.
- **없앨 것:** 가구, 바닥색, 무늬, 문 열림 호. 새 색 토큰을 만들지 않는다.
- **이름표(왼쪽 위 정렬):** 방 번호(앞 숫자), `StatusBadge`(작은 크기), 한 줄, (TV만) 담당 Therapist 이름.
- **한 줄 규칙:** 사용중·종료임박 → "{n}분 남음"(새 문구, 0 미만은 0). 예약 → "시작 HH:mm". 종료확인 → 기존 "결제·확인 필요"(`roomCard.guidance.completeCheck`). 청소중·빈방 → 줄 없음(배지로 충분).
- **마커 동그라미:** 종료임박·종료확인 방 번호에 손그림 고리(`--status-ending-soon` / `--status-complete-check`, 2.5px, TV 4px). 움직이지 않는다.
- **좁은 칸(휴대폰):** 컨테이너 쿼리로 배지 글자·라벨·담당자를 숨기고 기호만 둔다. 범례가 기호의 뜻을 준다. 엘리베이터 글자는 600px 미만에서 숨긴다.
- **지금 빈방 / 곧 비는 방:** 빈방 전부와, 사용중·종료임박 중 남은 분이 적은 순서로 3개. 값은 `RoomStatusDto` 그대로다(새 계산 규칙이 아니다). 없으면 "없음".
- **범례:** 상태 배지 6개. 화면 낭독기에는 숨긴다(`aria-hidden`).

### D3 실시간 화면 `/live`

- 요약 카드와 아래 상세(오늘 상태 요약·결제수단별·코스별) 사이의 객실판 자리만 평면도로 바꾼다. 도구줄, 요약 카드, 아래 상세, 갱신 컨트롤러·지연 안내는 그대로다.
- 순서: "지금 빈방 / 곧 비는 방" 줄 → 층 카드 → 범례. 층 카드는 1200px 이상에서 2×2(4·3 / 2·1), 미만에서 1열이다. 층 카드는 `--surface`, 1px `--border`, 18px.
- 방 하나가 버튼 하나다. 접근 이름에 번호·상태·한 줄이 들린다. 누르면 `ModalPanel` 서랍에 지금 `RoomStatusCard`가 그대로 뜬다(원장 링크는 지금처럼 원장 권한 역할에게만). Esc·뒤 덮개·닫기로 닫고, 포커스는 누른 자리(방 버튼 또는 빈방 칩)로 돌아간다. 열린 방 버튼은 `aria-expanded="true"`와 안쪽 3px 검정 테두리다.
- 자동 갱신으로 데이터가 바뀌면 열린 서랍도 새 값을 보인다(roomId로 찾는다). 그 방이 목록에서 없어지면 서랍을 닫는다.

### D4 TV `/tv`

- 머리말은 그대로다. 평면도 2×2, 그 아래 "지금 빈방 / 곧 비는 방"(크게). 범례는 없다. 상호작용이 없다.
- 1920×1080에서 한국어·베트남어 모두 세로 스크롤 없이 한 화면에 들어간다.
- 크기: 층 이름 30px/900, 방 번호 40px/900, 배지 22px/800, 값 34px/900, 담당자 20px/700. 시안 `_minimal.css`의 `.tv` 규칙을 따른다.

### D5 문구 (ko·vi)

새 키를 더한다(이름은 구현이 정한다, 예: `floorPlan.*`). 베트남어는 시안 값이고 고객 확인 전이다.

| 뜻 | ko | vi |
| --- | --- | --- |
| 층 | {n}층 | Tầng {n} |
| 엘리베이터 | 엘리베이터 | Thang máy |
| 복도 | 복도 | Hành lang |
| 지금 빈방 | 지금 빈방 | Trống ngay |
| 곧 비는 방 | 곧 비는 방 | Sắp trống |
| 없음 | 없음 | Không có |
| 남은 시간 | {n}분 남음 | còn {n} phút |
| 범례 | 상태 | Trạng thái |
| 기타 줄 | 기타 | Khác |

### D6 design.md

- 2.5 객실 상태색: 평면도의 마커 고리(글자가 아닌 표시, 바탕 대비 3:1 이상)에도 쓴다고 적는다.
- 6절에 "객실 평면도" 절을 더한다: 손그림 벽, 이름표, 마커 고리, 빈방 줄, TV 크기, 좁은 칸 규칙.
- 6.15 TV 절의 "객실 카드 `--surface` 18px"를 평면도에 맞게 고친다.

## 범위 밖

`/rooms`(객실 현황, 겹친 콜 목록) 화면, `RoomStatusCard` 자체의 모양, 상태 판정과 남은 분 계산, DB와 마이그레이션, 대기실·리셉션 같은 다른 층 그림.

## 구현 함정 (이 저장소에서 이미 겪은 것)

- **"use client" 경계:** 서버 페이지와 클라이언트가 함께 쓰는 상수·순수 함수(배치 좌표, 방→칸, 곧 비는 방 고르기, 흔든 선 경로)는 "use client"가 없는 모듈(예: `src/modules/rooms/` 아래)에 둔다. 서버 페이지가 "use client" 파일의 값을 가져오면 클라이언트 참조 프록시가 되어 운영 빌드 화면에서만 깨지고, 단위 테스트로는 안 잡힌다.
- **설치:** 새 워크트리라 `node_modules`가 없다. `pnpm install --frozen-lockfile --prefer-offline`.
- **E2E는 운영 빌드로:** `pnpm build` 뒤 `next start --hostname 127.0.0.1 --port <빈 포트>`를 `setsid -f`로 띄우고 `ss -ltnp`로 실제 PID를 적어 그 PID만 끈다. DB는 컨테이너 `vietnam-shell-02-e2e`(127.0.0.1:3450)에 **자기 이름의 새 DB**(예: `vietnam_aesthetic_fp`)를 만들어 쓴다: `DROP DATABASE IF EXISTS … WITH (FORCE)` → `CREATE DATABASE …` → `npx prisma migrate deploy` → `npx tsx scripts/seed-dev-accounts.ts` → `npx tsx scripts/seed-master-data.ts`. 다른 세션이 `vietnam_aesthetic` DB와 3100 포트를 쓰고 있을 수 있으니 건드리지 않는다. 환경 변수: `DATABASE_URL`·`DIRECT_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:3450/<자기 DB>`, `NEXTAUTH_SECRET`(32자 이상), `NEXTAUTH_URL=http://127.0.0.1:<포트>`, `PLAYWRIGHT_SKIP_WEBSERVER=1`, `PLAYWRIGHT_PORT=<포트>`.
- **기존 실패:** 2-5:268, 5-3:173·243, 5-5:211·250, 5-6:176, ticket-36:408은 서버 액션 결과가 화면에 반영되지 않는 기존 문제(pending 고착)다. 현장 스펙(3-2·3-3·3-4·3-5)은 오늘 날짜의 같은 기본 객실에 콜을 넣고, ticket-04:209는 그 콜 때문에 오염된 DB에서만 실패한다. 새 실패가 나오면 새 DB에서 직렬로 다시 돌리고, 그래도 남으면 기준 커밋 a9e0261을 다른 폴더에서 빌드해 같은 조건으로 비교한다.
- **lint 사슬:** `pnpm lint`는 검증 스크립트를 `&&`로 이어서 앞에서 멈춘다. `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`로 모두 돌린다. 기존 실패(4-6)는 기준 커밋에서도 실패한다.
- **객실판을 읽는 기존 스펙·검증기:** `tests/e2e/story-3-2-live-status`, `story-3-4-tv-fullscreen-board`, `story-3-5-status-badge-accessibility`, `story-ticket-04-floor-screens`, `story-ticket-14-room-overlap`, `story-ticket-36-…`, `client-revision-verification`, `scripts/validate-story-3-2·3-3·3-4·3-5.mjs`. 실시간·TV의 `data-testid="room-status-card"`를 세거나 읽는다. 평면도에 맞게 고치되 상태·시각·권한 단언의 뜻은 약하게 하지 않는다. `validate-story-3-5`(상태색 고정값)는 그대로 통과해야 한다.

## 완료 기준

- 타입 검사, 단위 테스트 전체(`pnpm test:unit`), 검증 스크립트 전체(위 루프)가 기존 실패 말고 통과한다.
- 새 DB 운영 빌드에서 위 영향 스펙과 새 평면도 스펙이 직렬로 통과한다(기존 실패 목록 제외).
- 운영 빌드 스크린숏으로 시안과 비교한다: `/live` 1440·390px, `/tv` 1920×1080 한국어·베트남어. 가로 스크롤이 없고, TV는 세로 스크롤도 없다.
- 끝에 `code-review` 스킬로 리뷰하고 지적을 반영한다.
- 티켓 파일마다 `Status: done`과 `## Comments`에 한 일·검증을 적는다.
- `feat/room-floor-plan`에 커밋한다. push·병합·배포는 하지 않는다.
