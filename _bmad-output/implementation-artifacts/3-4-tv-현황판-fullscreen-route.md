---
baseline_commit: f2293c9
created_at: 2026-06-09T00:00:00+0900
discovery:
  epics: _bmad-output/planning-artifacts/epics.md
  architecture: _bmad-output/planning-artifacts/architecture.md
  prd: _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md
  ux:
    - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md
    - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md
    - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/validation-report.md
    - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/review-accessibility.md
  previous_story: _bmad-output/implementation-artifacts/3-3-객실-현황-화면과-웨이터-안내-문구.md
---

# Story 3.4: TV 현황판 fullscreen route

Status: done

## Story

As a 조회 전용 사용자,
I want TV에서 입력 없는 전체화면 객실 현황판을 보기를,
so that 매장 안에서 멀리서도 객실 상태와 종료확인을 빠르게 파악할 수 있다.

## Acceptance Criteria

1. **Given** 조회 전용 사용자 또는 허용된 운영 사용자가 TV 현황판 route에 접근한다  
   **When** route가 렌더링된다  
   **Then** sidebar, topbar, 일반 ERP chrome은 숨겨진다  
   **And** 입력 버튼, 수정 기능, 콜 원장 편집 기능은 제공되지 않는다.
2. **Given** TV 현황판이 데이터를 조회한다  
   **When** 화면이 표시된다  
   **Then** 11개 객실이 대형 카드 grid로 표시된다  
   **And** 각 카드는 Story 3.1의 `RoomStatusDto`를 사용한다.
3. **Given** TV 현황판의 객실 카드가 표시된다  
   **When** 객실 상태가 표시된다  
   **Then** 객실명, 상태, 남은 시간, 코스, 담당자가 멀리서 읽을 수 있는 크기로 표시된다  
   **And** 상태는 색상, 텍스트 라벨, 글리프를 함께 사용한다.
4. **Given** 표시 상태가 `종료확인`인 객실이 있다  
   **When** TV 현황판이 렌더링된다  
   **Then** 해당 카드는 TV에서도 명확한 주의 상태로 표시된다  
   **And** "결제·확인 필요" 또는 TV에 적합한 짧은 문구가 표시된다.
5. **Given** TV 현황판이 열려 있다  
   **When** 자동 갱신 interval이 도래한다  
   **Then** 객실 상태 데이터가 주기적으로 갱신된다  
   **And** v1 기본 방식은 polling/auto-refresh로 시작한다.
6. **Given** 데이터가 정상 갱신된다  
   **When** 화면이 최신 데이터를 표시한다  
   **Then** 마지막 갱신 시각이 표시된다  
   **And** 사용자는 현황판이 살아 있는지 확인할 수 있다.
7. **Given** 데이터 갱신이 실패하거나 지연된다  
   **When** refresh delay가 감지된다  
   **Then** `갱신 지연` 또는 동등한 한국어 상태가 표시된다  
   **And** 기존 값을 유지하되 오래된 상태임을 알 수 있게 한다.
8. **Given** TV 현황판이 사용된다  
   **When** 사용자가 마우스나 키보드로 카드를 조작하려 한다  
   **Then** 상태 변경이나 입력 action은 실행되지 않는다  
   **And** TV 현황판은 조회 전용 화면으로 유지된다.
9. **Given** 개발자가 TV 현황판을 검증한다  
   **When** fullscreen chrome 숨김, 11개 카드, 자동 갱신, 마지막 갱신 시각, 갱신 지연, 읽기 전용 테스트를 실행한다  
   **Then** 모든 테스트가 통과한다  
   **And** TV 현황판은 객실 현황 화면과 같은 상태 계산 결과를 표시한다.

## Tasks / Subtasks

- [x] Task 1: `/tv`를 일반 ERP shell 밖의 fullscreen route로 재배치한다 (AC: 1, 8, 9)
  - [x] 현재 `src/app/(erp)/tv/page.tsx`는 `(erp)/layout.tsx`의 sidebar/topbar를 상속하는 placeholder다. 기존 파일을 그대로 구현하면 fullscreen AC를 만족할 수 없다.
  - [x] 권장 구조는 `src/app/tv/page.tsx`로 route를 옮기고 `src/app/(erp)/tv/page.tsx`를 제거하는 것이다. 최상위 `src/app/layout.tsx`는 `<html><body>{children}</body></html>`만 제공하므로 chrome 없는 `/tv`에 적합하다.
  - [x] Next.js route group은 URL에 포함되지 않으므로 `src/app/(erp)/tv/page.tsx`와 `src/app/(fullscreen)/tv/page.tsx`를 동시에 두지 않는다. 둘 다 `/tv`로 resolve되어 route conflict가 난다.
  - [x] `requireRouteAccess("/tv")`는 새 fullscreen page에서도 유지한다. 인증/권한 없는 public TV board를 만들지 않는다.
  - [x] administrator와 read_only_viewer의 `/tv` 접근은 유지하고, waiter/counter/settlement_manager 접근을 넓히지 않는다. 허용 범위를 바꾸려면 `src/lib/authorization.ts`와 테스트를 같이 갱신해야 한다.
- [x] Task 2: `/tv` page를 `RoomStatusDto` 기반 Server Component로 구현한다 (AC: 2, 5, 6, 7, 9)
  - [x] `listOperatingMonths()`, `selectedOperatingMonthFor()`, `clampDateToOperatingMonth()`를 `/rooms`와 같은 방식으로 사용한다.
  - [x] `listRoomStatuses({ operatingMonthId, serviceDate })`를 서버에서 호출한다. Client Component에서 Prisma/domain service를 호출하지 않는다.
  - [x] 운영월이 없을 때도 ERP shell이 아닌 fullscreen-friendly fallback을 표시한다. 관리자에게만 운영월 관리 링크를 보여도 되지만, TV 화면에는 설정/수정 UI처럼 보이는 요소를 과하게 넣지 않는다.
  - [x] `latestUpdatedAt(roomStatuses)` 또는 동등한 helper로 `RoomStatusRefreshController`에 넘길 last-updated 값을 만든다.
  - [x] URL query param으로 `operatingMonthId`와 `serviceDate` 조회 조건을 받을 수 있게 하되, TV 화면 안에 일반 ERP form controls를 반드시 노출할 필요는 없다. 노출한다면 조회 조건 변경만 가능해야 한다.
- [x] Task 3: TV 전용 대형 room card grid를 만든다 (AC: 2, 3, 4, 8, 9)
  - [x] 기존 `src/components/domain/room-status-card.tsx`의 `variant="tv"`를 실제 TV typography ramp에 맞게 강화하거나, `RoomStatusCard`를 감싸는 `TvRoomStatusBoard`/`TvRoomStatusCard`를 `src/components/domain`에 추가한다.
  - [x] 핵심 원칙은 새 계산 금지다. 카드 component는 `RoomStatusDto`를 받고 `displayStatus`, `remainingMinutes`, `expectedEndAt`, `course.tvDisplayName`, 담당자 표시를 다시 계산하지 않는다.
  - [x] 11개 객실을 한 화면에서 읽을 수 있게 큰 grid로 표시한다. 기준은 TV/거리 가독성: 객실명 약 40px/900, 상태 약 28px/900, 코스/담당/남은시간 약 22px/700.
  - [x] `StatusBadge` 또는 동등한 내부 UI는 상태별 색상 + 텍스트 라벨 + 글리프를 항상 표시한다. 색상만으로 상태를 전달하지 않는다.
  - [x] `종료확인` 카드는 `status-attention`, `⚠`, "결제·확인 필요" 같은 짧은 행동 문구를 TV에서도 명확히 보여준다.
  - [x] `빈방`은 dashed/outline/후퇴 표현을 유지하고, bronze fill + 흰 텍스트 조합을 만들지 않는다.
  - [x] 카드 클릭, 키보드 조작, hover 상태가 편집 modal, 원장 이동, status mutation, autosave affordance를 열지 않게 한다.
- [x] Task 4: fullscreen loading과 refresh affordance를 추가한다 (AC: 5, 6, 7, 9)
  - [x] `src/app/tv/loading.tsx`를 추가해 11개 대형 카드 skeleton을 표시한다. blank screen으로 보이면 안 된다.
  - [x] `RoomStatusRefreshController`를 재사용하되 TV에서는 버튼/텍스트 크기와 배치를 멀리서 보이는 header/status strip에 맞게 조정할 수 있다. 재사용이 어렵다면 prop으로 `variant="tv"`를 추가한다.
  - [x] 기본 polling은 현재 shared controller의 15초를 유지한다. 아키텍처는 5~10초도 허용하지만, Story 3.2/3.3에서 확정된 15초 shared controller와 다르게 갈 이유가 있으면 문서화한다.
  - [x] `갱신 중`, `마지막 갱신`, `갱신 지연`, 수동 `새로고침` 또는 TV에 맞는 동등 affordance를 제공한다.
  - [x] 갱신 중/지연 시 직전 렌더 값을 제거하지 않는다. 오래된 board를 최신으로 오해하지 않게 stale 상태를 보이는 것이 핵심이다.
- [x] Task 5: 역할/내비게이션 계약을 보존한다 (AC: 1, 8, 9)
  - [x] `src/lib/authorization.ts`의 `administrator: [..., "/tv"]`, `read_only_viewer: ["/rooms", "/tv", "/dashboard/today"]`를 보존한다.
  - [x] `src/lib/navigation.ts`의 sidebar TV 항목은 administrator/read_only_viewer에게만 보이게 유지한다. `/tv` 자체는 fullscreen이라 sidebar가 렌더링되지 않아야 하지만, ERP shell에서 링크로 진입할 수는 있어야 한다.
  - [x] 권한 없는 route 접근은 `requireRouteAccess("/tv")`가 역할 landing으로 redirect한다. UI 숨김만으로 보안을 처리하지 않는다.
- [x] Task 6: Story 3.4 validator와 E2E를 추가한다 (AC: 1-9)
  - [x] `scripts/validate-story-3-4.mjs`를 추가하고 `package.json`의 `npm run lint` validator chain에 연결한다.
  - [x] validator는 `src/app/(erp)/tv/page.tsx`가 없어졌는지 또는 ERP chrome을 상속하지 않는 구조인지, `src/app/tv/page.tsx`, `requireRouteAccess("/tv")`, `listRoomStatuses`, `RoomStatusDto`/`RoomStatusCard` 또는 TV card, `RoomStatusRefreshController`, `loading.tsx`, E2E spec, docs/project-context 동기화를 확인한다.
  - [x] `tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`를 추가한다. fixture prefix는 `story34_*` 또는 `E2E34-*`를 사용한다.
  - [x] E2E는 read_only_viewer와 administrator의 `/tv` 접근, sidebar/topbar/chrome 부재, 11개 카드, 상태 라벨+글리프, TV 대형 텍스트 class/구조, `종료확인` 문구, 마지막 갱신/갱신 지연, 입력/수정 UI 부재를 검증한다.
  - [x] E2E는 waiter/counter 등 권한 없는 역할이 `/tv`에 접근할 때 landing으로 redirect되는지 검증한다.
  - [x] Playwright는 locator와 web assertion을 사용한다. `waitForTimeout()`은 사용하지 않는다.
- [x] Task 7: 문서와 project context를 동기화한다 (AC: 1-9)
  - [x] `_bmad-output/project-context.md`에 Story 3.4 확정 규칙을 추가한다: `/tv`는 fullscreen route, ERP chrome 없음, read-only, `RoomStatusDto`/room status card 재사용, 15초 polling 또는 문서화된 shared refresh, 지연 상태 표시, UI 계산 재구현 금지.
  - [x] `docs/modules/rooms.md`와 `src/modules/rooms/README.md`에 `/tv` downstream 화면 규칙을 추가한다.
  - [x] 필요하면 `docs/modules/calls.md`에는 `/tv`가 콜 원장을 읽는 downstream 소비자이며 mutation을 수행하지 않는다는 점을 남긴다.
- [x] Task 8: 검증을 실행하고 결과를 기록한다 (AC: 9)
  - [x] `node scripts/validate-story-3-4.mjs`
  - [x] `npm run test:unit`
  - [x] `npm run lint`
  - [ ] `npm run test:e2e -- tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`
  - [x] dev server listen이 sandbox에서 `EPERM`으로 막히면 Story 3.1~3.3처럼 차단 조건과 대체 검증을 정확히 기록한다. 실행하지 못한 명령을 통과했다고 쓰지 않는다.

## Dev Notes

### Discovery Results

- `{epics_content}`: 단일 `_bmad-output/planning-artifacts/epics.md`에서 Epic 3 전체와 Story 3.4 AC를 로드했다.
- `{prd_content}`: `_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md`에서 UJ-3, FR-16~FR-19, TV 현황판 조회 전용 요구를 로드했다.
- `{architecture_content}`: 단일 `_bmad-output/planning-artifacts/architecture.md`에서 App Router, route/layout 경계, `rooms` DTO + polling, frontend/domain service boundary, TV fullscreen route 요구를 로드했다.
- `{ux_content}`: UX `DESIGN.md`, `EXPERIENCE.md`, `validation-report.md`, `review-accessibility.md`에서 TV typography ramp, 상태 token, 라벨+글리프, 종료확인/reduced-motion, stale state 요구를 로드했다.
- Persistent facts: `_bmad-output/project-context.md`를 로드했고 Story 3.1/3.2/3.3 확정 규칙이 포함되어 있다.

### Story Scope

- 이번 story는 `/tv` fullscreen 현황판이다. `/live` 첫 화면은 Story 3.2, `/rooms` 웨이터 객실 현황은 Story 3.3에서 완료됐다. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 3 Story 3.2~3.4]
- `/tv`는 카운터/매장 TV에 띄우는 조회 전용 화면이며, 입력/수정/콜 원장 편집 affordance를 포함하지 않는다. [Source: `_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md` - TV 현황판]
- `/tv`는 `RoomStatusDto`와 `listRoomStatuses()`를 재사용한다. 화면에서 활성 콜 선택, 남은분, 종료예정, `종료확인`을 다시 계산하지 않는다. [Source: `_bmad-output/project-context.md` - Story 3.1/3.2/3.3 rules]
- 이번 story에서 정산, 월마감, 대시보드, 콜 원장 mutation, 신규 Prisma 모델, 신규 외부 realtime infrastructure는 범위가 아니다.

### Current Source State: Files Read and Required Changes

- `src/app/(erp)/tv/page.tsx`는 현재 `ErpEmptyState` placeholder만 렌더링하고 `requireRouteAccess("/tv")`만 검증한다. `(erp)/layout.tsx`를 상속하므로 현재 위치에서 구현하면 sidebar/topbar가 남는다.
- `src/app/(erp)/layout.tsx`는 `erp-shell`, sidebar, topbar, account badge를 모든 `(erp)` route에 렌더링한다. `/tv` fullscreen AC와 충돌한다.
- `src/app/layout.tsx`는 root `<html lang="ko"><body>{children}</body></html>`만 제공한다. `/tv`를 `src/app/tv/page.tsx`로 옮기면 root layout만 상속해 fullscreen 구현이 가능하다.
- `src/app/(erp)/rooms/page.tsx`는 운영월 선택, 날짜 clamp, `listRoomStatuses()`, `RoomStatusCard`, `RoomStatusRefreshController`, 운영월 없음 fallback 패턴을 이미 구현했다. `/tv`는 이 data path를 재사용하되 일반 ERP form/chrome 밀도를 그대로 복제하지 않는다.
- `src/components/domain/room-status-card.tsx`는 `variant?: "default" | "tv"` prop을 이미 받지만 현재 tv variant는 `min-h-64 p-5` 정도만 적용한다. TV typography ramp와 grid density를 만족하려면 `variant="tv"`를 강화하거나 TV 전용 wrapper/card를 추가해야 한다.
- `src/components/domain/status-badge.tsx`는 상태 라벨+글리프+토큰을 제공한다. `/tv`는 이 원칙을 유지해야 한다.
- `src/components/domain/room-status-refresh-controller.tsx`는 `router.refresh()`, 15초 polling, 45초 stale 판단, `마지막 갱신`/`갱신 중`/`갱신 지연`/`새로고침` UI를 제공한다. `/tv`는 이를 재사용하거나 `variant="tv"`로 확장한다.
- `src/app/(erp)/rooms/loading.tsx`와 `src/app/(erp)/live/loading.tsx`는 11개 카드 skeleton 패턴을 제공한다. `/tv/loading.tsx`는 fullscreen 대형 카드 skeleton으로 별도 제공한다.
- `src/lib/authorization.ts`는 administrator와 read_only_viewer에게 `/tv` 접근을 허용한다. waiter는 `/rooms`만, counter는 `/live`, `/calls`, `/rooms`, `/dashboard/today`만 허용한다. 이 권한을 임의로 넓히지 않는다.
- `src/lib/navigation.ts`는 administrator/read_only_viewer에게 `TV 현황판` 메뉴를 보여준다. `/tv` route 자체는 fullscreen이어도 ERP sidebar에서 진입 링크가 유지되어야 한다.

### Data and Calculation Rules

- `listRoomStatuses({ operatingMonthId, serviceDate })`는 모든 active room을 `sortOrder` 순서로 반환하고, 활성 콜이 없으면 `displayStatus="빈방"` DTO를 만든다. [Source: `src/modules/rooms/room-status-service.ts`]
- 활성 객실 점유 상태는 `예약`/`RESERVED`, `사용중`/`IN_USE`/`USING`, `청소중`/`CLEANING`이다. `방문완료`/`VISIT_COMPLETE`, `노쇼`/`NO_SHOW`, `취소`/`CANCELED`는 객실을 점유하지 않는다. [Source: `src/modules/rooms/room-status-service.ts`]
- `사용중`의 남은분이 0이면 `displayStatus="종료확인"`으로 바꾸되 `sourceCallStatus`는 원본 상태를 보존한다. UI에서 다시 판단하지 않는다. [Source: `_bmad-output/implementation-artifacts/3-1-객실-상태-dto와-최신-활성-콜-계산.md`]
- TV card에서 코스 표시는 `course.tvDisplayName`을 우선하고 없으면 course code/name fallback을 쓴다. 기존 `RoomStatusCard`의 `courseLabel()` 패턴을 보존한다. [Source: `src/components/domain/room-status-card.tsx`]
- 담당자 표시는 therapist1, therapist2, earcare displayName을 DTO에서 받아 표시한다. 직원명은 표시값일 뿐 downstream key로 저장하지 않는다. [Source: `_bmad-output/project-context.md` - stable ID rules]

### Architecture Compliance

- `/tv/page.tsx`는 App Router Server Component로 domain query를 수행하고 `requireRouteAccess("/tv")`를 먼저 실행한다. Client Component는 browser-only refresh controller에만 둔다.
- Next.js route group은 URL path에 영향을 주지 않는다. 따라서 `(erp)/tv`와 `(fullscreen)/tv`를 동시에 둘 수 없다. fullscreen 구현은 기존 `(erp)/tv/page.tsx`를 제거/이동하는 구조 변경으로 처리한다. [Source: Next.js Route Groups docs, https://nextjs.org/docs/13/app/building-your-application/routing/route-groups]
- `router.refresh()`는 client router를 통해 현재 route의 Server Component payload를 갱신하는 기존 project pattern이다. `/tv` refresh는 새 dependency 없이 `RoomStatusRefreshController`를 우선 재사용한다. [Source: Next.js `useRouter` docs, https://nextjs.org/docs/app/api-reference/functions/use-router]
- `loading.tsx`는 route segment의 즉시 loading UI를 제공한다. `/tv/loading.tsx`는 fullscreen 11-card skeleton으로 blank screen을 피해야 한다. [Source: Next.js loading docs, https://nextjs.org/docs/14/app/api-reference/file-conventions/loading]
- 이번 story에서 React Query/SWR/WebSocket/SSE/Redis를 새로 도입하지 않는다. Architecture는 room/TV가 polling으로 시작하고 나중에 SSE/WebSocket으로 바꿀 수 있게 DTO와 query를 transport-independent하게 두라고 요구한다. [Source: `_bmad-output/planning-artifacts/architecture.md` - Room/TV refresh]

### UX and Accessibility Guardrails

- TV 현황판은 chrome/sidebar/input이 없는 fullscreen mode다. 11개 객실을 대형 카드 grid로 채우고 자동 갱신, 마지막 갱신 시각, 갱신 지연 상태를 제공한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md` - Responsive & Platform]
- TV typography ramp 기준은 객실명 40px/900, 상태 28px/900, 코스/담당/남은시간 22px/700이다. Tailwind class로 정확히 맞추거나 근접하게 구현하되, 작은 ERP card typography를 그대로 쓰지 않는다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md` - Typography]
- 상태는 색상만으로 전달하지 않는다. TV에서도 라벨과 글리프가 항상 보여야 한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md` - Accessibility Floor]
- `종료확인`은 TV에서도 강한 주의 상태여야 한다. pulse를 추가/유지한다면 `prefers-reduced-motion: reduce`에서 정적 ring + `⚠`로 대체하고 3Hz를 넘지 않는다. 현재 `globals.css`의 `status-attention`과 reduced-motion fallback을 재사용한다.
- TV mode는 같은 라이트 캔버스를 쓴다. 다크 캔버스를 새로 만들지 말고 큰 글자, locked status token, status block, glyph로 거리 가독성을 만든다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md` - TV mode]
- in-app 설명문으로 기능 사용법을 길게 설명하지 않는다. TV board 문구는 "마지막 갱신", "갱신 지연", "결제·확인 필요", "즉시 가능"처럼 짧은 상태/행동 라벨이어야 한다.

### Previous Story Intelligence

- Story 3.3 완료 커밋 `77b77de`는 `/rooms`, `RoomStatusRefreshController`, `RoomStatusCard` 재사용, `/rooms/loading.tsx`, Story 3.3 validator/E2E/docs sync를 완료했다. Story 3.4는 이 surface를 TV fullscreen으로 확장하는 작업이다.
- Story 3.3의 중요한 학습은 route-neutral refresh controller를 이미 `src/components/domain/room-status-refresh-controller.tsx`로 추출했다는 점이다. `/tv`에서 새 polling controller를 복제하면 drift가 생긴다.
- Story 3.3에서 `RoomStatusCard`는 `data-testid="room-status-card"`를 제공한다. Story 3.4 E2E는 11개 카드 count를 안정적으로 검증할 수 있다. 단, TV variant를 별도 component로 만들면 test id를 유지한다.
- Story 3.1~3.3은 구현 후 `_bmad-output/project-context.md`, `docs/modules/rooms.md`, `src/modules/rooms/README.md`, story-specific validator, E2E spec을 함께 갱신했다. Story 3.4도 같은 패턴을 따른다.
- Story 3.1~3.3 E2E는 dev server listen이 sandbox에서 `EPERM`으로 막힐 수 있음을 기록했다. 실행 불가 시 정확히 기록하고, 통과하지 않은 명령을 통과했다고 쓰지 않는다.

### Git Intelligence

- 최근 커밋 순서: `f2293c9 chore: stop story automator after story 3.3`, `77b77de feat(story-3.3)`, `91f79cd feat(story-3.2)`, `995779f feat(story-3.1)`, `52bdc2c feat(story-2.6)`.
- 현재 작업 전 `git status --short`에는 `_bmad-output/story-automator/orchestration-1-20260607-165702.md`의 unrelated local modification이 있었다. 이 story 생성/구현에서 해당 파일을 되돌리거나 수정하지 않는다.
- Story 3.x pattern은 source 변경 + docs/project-context sync + validator + E2E spec + lint chain 연결이다.

### Latest Technical Information

- Project-pinned versions: `next@16.2.7`, `react@19.2.7`, `react-dom@19.2.7`, `typescript@5.9.3`, `@prisma/client@7.8.0`, `prisma@7.8.0`, `@tanstack/react-table@8.21.3`, `@playwright/test@1.60.0`. 이번 story에서 dependency upgrade는 필요 없다. [Source: `package.json`]
- Next.js route group은 URL path에 포함되지 않으므로 같은 URL을 두 route group에서 정의하면 안 된다. `/tv` fullscreen은 `(erp)` shell route를 제거/이동하는 방식으로 해결해야 한다. [Source: https://nextjs.org/docs/13/app/building-your-application/routing/route-groups]
- Next.js App Router `useRouter`는 Client Component에서 import하며 `router.refresh()`로 현재 route를 새로고침할 수 있다. 기존 shared refresh controller와 일치한다. [Source: https://nextjs.org/docs/app/api-reference/functions/use-router]
- Next.js `loading.tsx`는 Suspense 기반 instant loading state를 제공하고 parameter를 받지 않는다. TV loading skeleton은 segment-local component로 둔다. [Source: https://nextjs.org/docs/14/app/api-reference/file-conventions/loading]
- Playwright는 user-facing locator와 web-first assertion을 권장한다. E2E는 role/text/test id 기반 locator를 사용하고 hardcoded wait를 피한다. [Source: https://playwright.dev/docs/locators; https://playwright.dev/docs/test-assertions]

### Testing Requirements

- Authorization and chrome tests:
  - read_only_viewer가 `/tv`에 접근 가능.
  - administrator가 `/tv`에 접근 가능.
  - waiter/counter/settlement_manager가 `/tv` 접근 시 역할 landing으로 redirect.
  - `/tv`에서 sidebar text `ERP 운영`, topbar text `역할별 ERP 업무`, account badge, 일반 ERP shell selector/chrome이 보이지 않음.
- TV board behavior tests:
  - 11개 `room-status-card` 또는 TV card test id 표시.
  - 각 상태가 라벨+글리프와 함께 표시: `예약`, `사용중`, `청소중`, `종료확인`, `빈방`.
  - 객실명, 상태, 코스, 담당자, 남은분/종료예정이 TV variant class/semantic structure로 표시.
  - `종료확인` 카드에 `결제·확인 필요` 또는 동등한 짧은 주의 문구 표시.
  - `빈방` 카드에 `즉시 가능` 또는 `-` 표시.
  - 카드 클릭/키보드 조작 후 edit modal, call ledger grid, autosave status, save button, daily expense/settlement/closing mutation UI가 나타나지 않음.
- Refresh/loading tests:
  - `src/app/tv/loading.tsx` skeleton 존재.
  - 마지막 갱신/갱신 중/갱신 지연/수동 새로고침 또는 TV 동등 affordance 표시.
  - `waitForTimeout()` 없이 Playwright web assertions 사용.
- Static validator checks:
  - `package.json` lint chain includes `validate-story-3-4.mjs`.
  - no `@tanstack/react-query`, SWR, WebSocket/SSE, Redis dependency added for this story.
  - no Server Action/write mutation added under `/tv`.

### File Structure Requirements

Expected updated files:

- `package.json`
- `src/components/domain/room-status-card.tsx` if strengthening `variant="tv"`
- `src/components/domain/room-status-refresh-controller.tsx` if adding `variant="tv"`
- `src/lib/authorization.ts` only if tests reveal missing route contract; do not broaden unauthorized roles
- `src/lib/navigation.ts` only if tests reveal missing menu contract
- `_bmad-output/project-context.md`
- `docs/modules/rooms.md`
- `src/modules/rooms/README.md`
- optionally `docs/modules/calls.md`

Expected moved/removed files:

- Move/replace `src/app/(erp)/tv/page.tsx` with fullscreen implementation outside `(erp)` shell.
- Remove `src/app/(erp)/tv/page.tsx` after moving so there is no duplicate `/tv` route.

Expected new files:

- `src/app/tv/page.tsx`
- `src/app/tv/loading.tsx`
- optionally `src/components/domain/tv-room-status-board.tsx` or `src/components/domain/tv-room-status-card.tsx` if `RoomStatusCard variant="tv"` would become too conditional
- `scripts/validate-story-3-4.mjs`
- `tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`

Avoid unless explicitly justified:

- Keeping `/tv` inside `src/app/(erp)` and hiding shell with page-level CSS while still rendering shell markup.
- Defining both `src/app/(erp)/tv/page.tsx` and another route-group `/tv/page.tsx`.
- New Prisma tables or migrations.
- New REST API/Route Handler for room status.
- New React Query/SWR/global state dependency.
- New WebSocket/SSE/Redis infrastructure.
- Any call ledger autosave/status mutation/daily expense/settlement/closing action inside `/tv`.

## Project Structure Notes

- Alignment: `/tv` should be a top-level fullscreen App Router page under `src/app/tv`, shared room status UI stays in `src/components/domain`, and room status reads stay in `src/modules/rooms`.
- Detected variance: architecture originally maps FR-16~FR-19 to `src/app/(erp)/tv`, but the actual `(erp)/layout.tsx` now hardcodes chrome. The fullscreen requirement overrides that mapping; moving `/tv` out of `(erp)` is the clean implementation path.
- Detected risk: `RoomStatusCard` has a `variant="tv"` prop but only small layout differences today. Do not assume the prop already satisfies DESIGN.md TV typography.
- Detected risk: `RoomStatusRefreshController` uses compact `text-xs` and a small button. TV mode may need a variant or wrapper so stale state is readable from distance.
- Existing dirty worktree note: `_bmad-output/story-automator/orchestration-1-20260607-165702.md` has unrelated local modifications. Do not revert or rewrite it for this story unless the user asks.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 3, Story 3.4, FR16-FR19
- `_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md` - UJ-3, TV 현황판, 객실 현황 source-of-truth
- `_bmad-output/planning-artifacts/architecture.md` - route layout, rooms DTO + polling, frontend/domain service boundary
- `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md` - TV typography ramp, locked status tokens, room-card variants
- `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md` - TV fullscreen surface, status badge, stale state, accessibility floor
- `_bmad-output/project-context.md` - Story 3.1/3.2/3.3 room status and read-only rules
- `_bmad-output/implementation-artifacts/3-1-객실-상태-dto와-최신-활성-콜-계산.md`
- `_bmad-output/implementation-artifacts/3-2-첫-화면-실시간-객실-콜-현황.md`
- `_bmad-output/implementation-artifacts/3-3-객실-현황-화면과-웨이터-안내-문구.md`
- `src/app/(erp)/tv/page.tsx`
- `src/app/(erp)/layout.tsx`
- `src/app/layout.tsx`
- `src/app/(erp)/rooms/page.tsx`
- `src/app/(erp)/rooms/loading.tsx`
- `src/components/domain/room-status-card.tsx`
- `src/components/domain/status-badge.tsx`
- `src/components/domain/room-status-refresh-controller.tsx`
- `src/modules/rooms/dtos.ts`
- `src/modules/rooms/room-status-service.ts`
- Next.js Route Groups: https://nextjs.org/docs/13/app/building-your-application/routing/route-groups
- Next.js `useRouter`: https://nextjs.org/docs/app/api-reference/functions/use-router
- Next.js `loading.tsx`: https://nextjs.org/docs/14/app/api-reference/file-conventions/loading
- Playwright locators/assertions: https://playwright.dev/docs/locators, https://playwright.dev/docs/test-assertions

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-09T21:46:40+0900: Story status and sprint status moved from `ready-for-dev` to `in-progress`; existing `baseline_commit: f2293c9` preserved.
- RED: `node scripts/validate-story-3-4.mjs` failed before implementation because `src/app/tv/page.tsx`, `src/app/tv/loading.tsx`, TV variants, docs sync, and lint chain were missing, and `src/app/(erp)/tv/page.tsx` still existed.
- GREEN: `node scripts/validate-story-3-4.mjs` passed after moving `/tv` to top-level fullscreen route and adding TV validator coverage.
- `npm run test:unit` passed with current repository script output: 3 tests, 3 pass.
- `npm run lint` passed all Story 1.1 through Story 3.4 validators.
- `npm run test:e2e -- tests/e2e/story-3-4-tv-fullscreen-board.spec.ts` attempted but Playwright webServer could not start in this sandbox: `listen EPERM: operation not permitted 127.0.0.1:3000`. E2E was not counted as passed.
- Supplemental `npx tsc --noEmit` was attempted and failed on generated stale `.next/types/validator.ts` reference to the removed `(erp)/tv` route plus existing unrelated TypeScript errors in prior story tests/services; this command is not part of the Story 3.4 required validation set.
- `git diff --check` passed with no whitespace errors.
- 2026-06-09T21:55:50+0900: Story status and sprint status moved to `review`.
- 2026-06-09: REVIEW: TV board grid breakpoint used `2xl:grid-cols-4`, so standard 1366/1440px TV widths could render only 2 columns. Fixed `/tv` page/loading to use `xl:grid-cols-4` and updated Story 3.4 validator.
- 2026-06-09: REVIEW: TV `갱신 지연` text used the foreground-on-orange token directly on the light page background. Fixed stale text to use `text-status-complete-check` and added validator coverage.
- 2026-06-09: REVIEW: E2E subtask was marked complete even though execution is sandbox-blocked by `listen EPERM 127.0.0.1:3000`. Fixed the story checklist to leave focused E2E unchecked and preserve the blocked execution note.
- 2026-06-09: REVIEW VERIFY: `node scripts/validate-story-3-4.mjs`, `npm run test:unit`, `npm run lint`, and `git diff --check` passed after fixes.
- 2026-06-09: REVIEW VERIFY: `npm run test:e2e -- tests/e2e/story-3-4-tv-fullscreen-board.spec.ts` remains blocked by sandbox dev server listen `EPERM` before Playwright tests run.
- 2026-06-09: REVIEW VERIFY: Supplemental `npm run build` is also blocked by the sandbox/Turbopack process bind restriction while processing `src/app/globals.css`; it was not counted as a required pass.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Implemented `/tv` as a top-level fullscreen App Router Server Component outside the ERP shell, preserving `requireRouteAccess("/tv")` and existing administrator/read_only_viewer authorization scope.
- Reused `listOperatingMonths()`, `selectedOperatingMonthFor()`, `clampDateToOperatingMonth()`, and `listRoomStatuses()` on the server so `/tv` consumes the same `RoomStatusDto` source of truth as `/rooms`.
- Strengthened `RoomStatusCard variant="tv"` with TV-sized typography, status label/glyph display, `종료확인` attention copy, and read-only card behavior without adding mutation affordances.
- Extended `RoomStatusRefreshController` with `variant="tv"` while keeping the shared 15초 polling, `router.refresh()`, last refresh time, `갱신 중`, and `갱신 지연` behavior.
- Added fullscreen loading skeleton, Story 3.4 static validator, E2E spec, and docs/project-context sync for `/tv` downstream read-only rules.
- Senior review auto-fixes adjusted TV grid responsiveness, stale-state contrast, Story 3.4 validator coverage, and blocked E2E task accuracy.

### File List

- `_bmad-output/implementation-artifacts/3-4-tv-현황판-fullscreen-route.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- `docs/modules/calls.md`
- `docs/modules/rooms.md`
- `package.json`
- `scripts/validate-story-1-2.mjs`
- `scripts/validate-story-3-4.mjs`
- `src/app/(erp)/tv/page.tsx` (deleted)
- `src/app/tv/loading.tsx`
- `src/app/tv/page.tsx`
- `src/components/domain/room-status-card.tsx`
- `src/components/domain/room-status-refresh-controller.tsx`
- `src/modules/rooms/README.md`
- `tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`

### Senior Developer Review (AI)

Reviewer: noah  
Date: 2026-06-09  
Outcome: Approved with sandbox-limited E2E

Findings:

- [HIGH] `/tv` and `/tv/loading` used `2xl:grid-cols-4`, so common 1366/1440px TV widths would keep the board at 2 columns and push the 11-room 현황판 into a long scroll, weakening the fullscreen board requirement. Fixed by changing the TV board and loading skeleton to `xl:grid-cols-4` and updating `scripts/validate-story-3-4.mjs`.
- [MEDIUM] `RoomStatusRefreshController variant="tv"` rendered stale `갱신 지연` text with `text-status-complete-check-foreground`, a white foreground token intended for orange backgrounds. On the light TV page this could make the stale warning hard to read. Fixed to `text-status-complete-check` and added validator coverage.
- [MEDIUM] Task 8 marked the focused Story 3.4 E2E command complete even though the recorded execution was blocked by sandbox `listen EPERM 127.0.0.1:3000`. Fixed by leaving that subtask unchecked and preserving the blocked validation note.

Review Fix Log:

- Updated `/tv` page and fullscreen loading grid breakpoints from `2xl:grid-cols-4` to `xl:grid-cols-4`.
- Updated TV stale-state color and strengthened the Story 3.4 validator for the responsive grid and readable stale warning token.
- Re-ran `node scripts/validate-story-3-4.mjs`, `npm run test:unit`, `npm run lint`, and `git diff --check`; all passed.
- Re-ran the focused Story 3.4 E2E command; it remains blocked before tests run by sandbox `listen EPERM: operation not permitted 127.0.0.1:3000`.
- Ran supplemental `npm run build`; it is blocked by the same sandbox process/bind restriction in Turbopack while processing `src/app/globals.css`, so it was recorded but not counted as required validation.

### Change Log

- 2026-06-09: Implemented Story 3.4 TV fullscreen route, TV room card/refresh variants, validator/E2E coverage, and documentation sync.
- 2026-06-09: Senior developer review auto-fixes applied for Story 3.4 TV grid responsiveness, stale-state contrast, validator guardrails, and blocked E2E record accuracy.
