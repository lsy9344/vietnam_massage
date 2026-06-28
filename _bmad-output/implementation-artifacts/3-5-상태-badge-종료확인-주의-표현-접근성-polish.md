---
baseline_commit: 8b2039a02ac410e12eaf7f388f56ebd17ae15581
---

# Story 3.5: 상태 badge, 종료확인 주의 표현, 접근성 polish

Status: done

## Story

As a 운영 사용자,
I want 모든 객실 상태가 같은 색상, 라벨, 글리프, 모션 규칙으로 표시되기를,
so that 첫 화면, 객실 현황, TV 현황판 어디서나 상태 의미를 빠르고 안전하게 이해할 수 있다.

## Acceptance Criteria

1. **Given** 객실 상태가 첫 화면, 객실 현황, TV 현황판 중 어느 표면에 표시된다  
   **When** 상태 badge가 렌더링된다  
   **Then** `사용중`, `예약`, `청소중`, `종료확인`, `빈방`은 DESIGN.md의 잠긴 status 토큰을 사용한다  
   **And** 화면별로 임의 색상 변형을 만들지 않는다.
2. **Given** 상태 badge가 표시된다  
   **When** 상태 의미를 전달한다  
   **Then** 색상, 텍스트 라벨, 글리프가 항상 함께 표시된다  
   **And** 글리프는 사용중 `●`, 예약 `◷`, 청소중 `◐`, 종료확인 `⚠`, 빈방 `○` 규칙을 따른다.
3. **Given** `청소중` badge가 표시된다  
   **When** 텍스트 foreground가 적용된다  
   **Then** gold fill 위에는 짙은 텍스트를 사용한다  
   **And** white foreground를 사용하지 않는다.
4. **Given** `빈방` badge 또는 카드가 표시된다  
   **When** 상태를 표현한다  
   **Then** surface 배경, bronze border, 짙은 텍스트의 outline/ghost style을 사용한다  
   **And** white-on-bronze filled badge를 사용하지 않는다.
5. **Given** `종료확인` 상태가 표시된다  
   **When** 텍스트가 올라가는 badge를 렌더링한다  
   **Then** 텍스트 배지용 어두운 orange 토큰을 사용한다  
   **And** 밝은 orange는 glow ring/accent 같은 비텍스트 장식에만 사용한다.
6. **Given** `종료확인` 카드에 pulse가 적용된다  
   **When** 사용자의 시스템 설정이 `prefers-reduced-motion: reduce`이다  
   **Then** pulse animation은 비활성화된다  
   **And** 정적 고대비 ring과 `⚠` 라벨로 주의 상태를 전달한다.
7. **Given** `종료확인` pulse가 활성화된다  
   **When** animation이 재생된다  
   **Then** 느린 opacity breathe 방식으로 동작한다  
   **And** 초당 3회 이상 flash하지 않는다.
8. **Given** 상태 텍스트 또는 badge foreground가 적용된다  
   **When** 접근성 검증을 수행한다  
   **Then** 일반 텍스트는 4.5:1, 대형 텍스트/UI component는 3:1 contrast target을 충족한다  
   **And** brand gold는 body text로 사용하지 않는다.
9. **Given** 상태 표시가 TV 현황판에 표시된다  
   **When** 10~15ft 거리에서 읽는 사용자를 고려한다  
   **Then** TV 전용 대형 typography ramp가 적용된다  
   **And** 작은 color swatch만으로 상태를 전달하지 않는다.
10. **Given** 개발자가 상태 표현을 검증한다  
    **When** 모든 표면의 status token 일관성, 글리프/라벨 동반, 빈방 outline, 종료확인 reduced-motion, contrast, TV 거리 가독성 테스트를 실행한다  
    **Then** 모든 테스트가 통과한다  
    **And** 상태 의미는 색상만으로 전달되지 않는다.

## Tasks / Subtasks

- [x] Task 1: 공유 status token과 `StatusBadge` 계약을 고정한다 (AC: 1, 2, 3, 4, 5, 8)
  - [x] `src/app/globals.css`의 status CSS 변수 값이 DESIGN.md와 일치하는지 검증하고 필요 시 보정한다: `--status-active #0E7549`, `--status-reserved #2F6FD0`, `--status-cleaning #D9A526`, `--status-cleaning-foreground #3D3115`, `--status-complete-check #D2440E`, `--status-complete-check-glow #F25C1F`, `--status-empty #B3A37D`, `--status-empty-foreground #3D3115`.
  - [x] `src/components/domain/status-badge.tsx`를 source of truth로 유지한다. 첫 화면, 객실 현황, TV 현황판에서 별도 badge component나 inline status color map을 만들지 않는다.
  - [x] `StatusBadge`가 `색상 + 텍스트 라벨 + 글리프`를 항상 렌더링하는지 명시적으로 테스트한다. 상태별 glyph는 `●`, `◷`, `◐`, `⚠`, `○` 그대로 유지한다.
  - [x] DESIGN.md의 badge radius 계약에 맞춰 `StatusBadge`는 pill/full radius를 사용한다. 현재 `rounded-md`가 남아 있으면 `rounded-full`로 교체하고 validator에 회귀 검사를 둔다.
  - [x] `청소중`은 `bg-status-cleaning text-status-cleaning-foreground` 조합만 허용한다. `text-white`, `text-status-cleaning-foreground` 외 임의 foreground, inline style을 금지한다.
  - [x] `빈방`은 filled bronze badge가 아니라 `border border-status-empty bg-surface text-status-empty-foreground` outline/ghost 조합을 유지한다.
  - [x] `종료확인` 텍스트 badge는 `bg-status-complete-check text-status-complete-check-foreground`를 쓰고, `bg-status-complete-check-glow` 또는 `#F25C1F` 위에 텍스트를 올리지 않는다.
- [x] Task 2: `RoomStatusCard`의 종료확인/빈방 표현을 접근성 기준으로 polish한다 (AC: 4, 5, 6, 7, 8, 9)
  - [x] `src/components/domain/room-status-card.tsx`에서 `status.displayStatus`만 사용한다. `remainingMinutes`를 다시 판단해 `종료확인`을 재계산하지 않는다.
  - [x] `종료확인` 카드는 밝은 orange glow/accent를 비텍스트 장식으로만 사용하고, 텍스트는 어두운 `status-complete-check` 배지 또는 기본 foreground 위에 둔다.
  - [x] `종료확인` 문구는 첫 화면/객실 현황/TV에서 `결제·확인 필요` 또는 같은 의미의 짧은 한국어 action label로 유지한다.
  - [x] `빈방` 카드는 surface/background + dashed/outline border + 짙은 텍스트를 유지한다. 객실명, 안내 문구, badge 텍스트에 bronze-on-cream 저대비 텍스트를 쓰지 않는다.
  - [x] TV variant는 기존 `text-[40px]`, `text-[28px]`, `text-[22px]` ramp를 유지하거나 DESIGN.md 기준 이상으로 맞춘다. TV mode에서 status label/glyph가 작은 swatch로 축소되지 않게 한다.
  - [x] 카드 hover/click/focus affordance가 편집 가능 UI처럼 보이지 않게 한다. Story 3.x 표면은 계속 읽기 전용이다.
- [x] Task 3: 종료확인 motion safety를 실제 CSS와 테스트로 잠근다 (AC: 6, 7, 10)
  - [x] `src/app/globals.css`의 `.status-attention`에 pulse animation을 추가한다면 느린 opacity breathe만 사용한다. 주기는 1.5~2초 이상으로 두고 hard blink, scale jump, color flash를 사용하지 않는다.
  - [x] pulse를 추가하지 않는 경우에도 정적 glow ring은 유지하고, validator/E2E가 `prefers-reduced-motion` contract를 확인하도록 한다.
  - [x] `@media (prefers-reduced-motion: reduce)`에서 `.status-attention` animation을 제거하고 정적 ring으로 대체한다. 현재 전역 reduced-motion rule을 삭제하거나 약화하지 않는다.
  - [x] CSS 또는 validator에 `animation-duration`/keyframes 기준을 확인하는 정적 검사를 추가해 초당 3회 이상 flash하지 않는다는 계약을 회귀 테스트로 만든다.
- [x] Task 4: 첫 화면, 객실 현황, TV 현황판의 status 표현 중복과 drift를 차단한다 (AC: 1, 2, 8, 9, 10)
  - [x] `src/app/(erp)/live/page.tsx`, `src/app/(erp)/rooms/page.tsx`, `src/app/tv/page.tsx`가 모두 `RoomStatusCard`를 사용하고 별도 status token/class map을 두지 않는지 검증한다.
  - [x] `src/components/domain/erp-empty-state.tsx`의 상태 토큰 예시도 `StatusBadge`만 사용하도록 유지한다.
  - [x] `rg` 또는 validator로 `bg-status-*`, `text-status-*`, `status-attention`, `#D2440E`, `#F25C1F`, `#D9A526`, `#B3A37D` 사용처를 점검한다. 허용 위치는 token/theme, `StatusBadge`, `RoomStatusCard`, refresh stale text처럼 명확한 status 의미가 있는 곳으로 제한한다.
  - [x] 콜 원장 dropdown swatch나 dashboard chip이 이 story에서 함께 조정된다면, swatch 단독 의미 전달을 금지하고 label+glyph를 같이 둔다. 단, dashboard/콜 원장 신규 화면 확장은 이 story의 필수 범위가 아니다.
- [x] Task 5: Story 3.5 validator를 추가하고 lint chain에 연결한다 (AC: 1-10)
  - [x] `scripts/validate-story-3-5.mjs`를 추가한다.
  - [x] `package.json`의 `npm run lint` validator chain에 `node scripts/validate-story-3-5.mjs`를 `validate-story-3-4.mjs` 뒤에 연결한다.
  - [x] validator는 `globals.css`, `status-badge.tsx`, `room-status-card.tsx`, live/rooms/tv pages, Story 3.5 E2E spec, docs sync를 확인한다.
  - [x] validator는 forbidden checks를 포함한다: `text-white` on cleaning, filled `bg-status-empty` badge, text on `status-complete-check-glow`, 화면별 inline status color map, `waitForTimeout(`, status meaning without glyph/label.
  - [x] contrast guard는 최소한 token 값과 foreground pairing을 정적으로 검증한다. 수치 계산 helper를 넣을 수 있으면 WCAG ratio 계산을 validator 안에서 수행한다.
- [x] Task 6: E2E 접근성 회귀 테스트를 추가한다 (AC: 1-10)
  - [x] `tests/e2e/story-3-5-status-badge-accessibility.spec.ts`를 추가한다. fixture prefix는 `story35_*` 또는 `E2E35-*`를 사용해 기존 3.2~3.4 fixture와 충돌하지 않게 한다.
  - [x] seed data는 최소 5개 상태가 모두 나타나게 구성한다: `예약`, `사용중`, `청소중`, `종료확인`, `빈방`.
  - [x] `/live`, `/rooms`, `/tv`에서 `상태: 예약`, `상태: 사용중`, `상태: 청소중`, `상태: 종료확인`, `상태: 빈방` aria label과 visible glyph/text를 검증한다.
  - [x] `청소중` badge가 `text-status-cleaning-foreground` 또는 computed dark foreground를 쓰고 `text-white`/white foreground가 아닌지 검증한다.
  - [x] `빈방` badge/card가 outline/ghost style인지, `bg-status-empty` filled badge가 아닌지 class 또는 computed style로 검증한다.
  - [x] `종료확인` badge fill과 glow/accent가 분리되는지 검증한다. 텍스트 배지는 dark orange, glow/ring은 bright orange를 사용해야 한다.
  - [x] Playwright `page.emulateMedia({ reducedMotion: "reduce" })` 또는 equivalent를 사용해 reduced-motion 상태에서 animation이 제거되고 `⚠` 라벨/정적 ring이 남는지 검증한다.
  - [x] TV route에서 `room-status-card` 객실명/status/meta typography ramp가 거리 가독성 기준을 유지하는지 class 또는 computed style로 검증한다.
  - [x] Playwright는 locator와 web assertion을 사용한다. `waitForTimeout()`은 사용하지 않는다.
- [x] Task 7: 문서와 project context를 동기화한다 (AC: 1-10)
  - [x] `_bmad-output/project-context.md`에 Story 3.5 확정 규칙을 추가한다: status token source of truth, label+glyph requirement, 청소중 dark foreground, 빈방 outline, 종료확인 dark badge/bright glow split, reduced-motion static ring, TV typography, UI 계산 재구현 금지.
  - [x] `docs/modules/rooms.md`와 `src/modules/rooms/README.md`에 status presentation contract를 추가한다.
  - [x] 필요하면 `docs/modules/calls.md`에는 status token이 콜 원장 dropdown/chip에 적용될 때 swatch 단독 표시를 금지한다는 점만 짧게 남긴다.
- [x] Task 8: 검증을 실행하고 결과를 기록한다 (AC: 10)
  - [x] `node scripts/validate-story-3-5.mjs`
  - [x] `npm run lint`
  - [x] `npm run test:unit`
  - [x] `npm run test:e2e -- tests/e2e/story-3-5-status-badge-accessibility.spec.ts`
  - [x] dev server listen이 sandbox에서 `EPERM`으로 막히면 Story 3.1~3.4처럼 차단 조건과 대체 검증을 정확히 기록한다. 실행하지 못한 명령을 통과했다고 쓰지 않는다.

## Dev Notes

### Discovery Results

- `{epics_content}`: 단일 `_bmad-output/planning-artifacts/epics.md`에서 Epic 3 전체와 Story 3.5 AC를 로드했다.
- `{prd_content}`: `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md`에서 UJ-3, FR-2, FR-16~FR-19의 객실/TV 상태 표시 요구를 확인했다.
- `{architecture_content}`: 단일 `_bmad-output/planning-artifacts/architecture.md`에서 App Router, domain service boundary, `RoomStatusDto` 공유, 접근성, TV refresh/읽기 전용 표면 요구를 확인했다.
- `{ux_content}`: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md`, `EXPERIENCE.md`, `review-accessibility.md`, `validation-report.md`를 사용했다. 핵심은 잠긴 status token, label+glyph rule, contrast correction, reduced-motion, TV typography ramp다.
- Persistent facts: `_bmad-output/project-context.md`를 로드했고 Story 3.1~3.4 확정 규칙이 포함되어 있다.

### Story Scope

- 이번 story는 새 객실 상태 계산이 아니다. `listRoomStatuses()`와 `RoomStatusDto`는 Story 3.1에서 소유하며, `/live`, `/rooms`, `/tv`는 그 DTO를 소비한다. UI에서 `종료확인`, 남은분, 종료예정, 코스/담당자 표시를 다시 계산하지 않는다. [Source: `_bmad-output/project-context.md` - Story 3.1~3.4 rules]
- 이번 story는 status presentation hardening이다. 주요 surface는 `StatusBadge`, `RoomStatusCard`, `globals.css`, `/live`, `/rooms`, `/tv`, validator/E2E/docs다. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.5]
- 신규 Prisma 모델, migration, Server Action, Route Handler, React Query/SWR/WebSocket/SSE/Redis, 권한 확장은 범위가 아니다.
- 콜 원장과 dashboard의 status chip/dropdown 전체 polish는 후속 story에서 확장될 수 있다. 다만 이 story에서 status token을 건드리면 dashboard/grid가 같은 token을 상속하도록 drift 방지 검사를 둔다.

### Current Source State: Files Read and Required Changes

- `src/components/domain/status-badge.tsx`는 현재 `statusBadgeStates`, glyph map, token class map을 가진 공유 badge다. 이미 `청소중`은 dark foreground, `종료확인`은 dark orange fill + `status-attention`, `빈방`은 outline badge를 사용한다. 이 파일을 source of truth로 더 강하게 검증한다.
- `src/components/domain/room-status-card.tsx`는 `RoomStatusDto`와 `StatusBadge`를 받고, `variant="tv"`에서 `text-[40px]`, `text-[28px]`, `text-[22px]` ramp를 적용한다. `종료확인`과 `빈방` 표현을 여기에서 polish하되 계산은 추가하지 않는다.
- `src/app/globals.css`는 DESIGN.md 보정값과 같은 status token을 이미 가진다: active `#0E7549`, cleaning foreground `#3D3115`, complete-check `#D2440E`, complete-check-glow `#F25C1F`, empty foreground `#3D3115`. reduced-motion block도 존재한다. Story 3.5는 이 값과 motion contract를 validator로 고정해야 한다.
- `src/app/(erp)/live/page.tsx`, `src/app/(erp)/rooms/page.tsx`, `src/app/tv/page.tsx`는 모두 `RoomStatusCard`를 사용한다. 화면별 status badge를 만들지 않는 현재 구조를 유지한다.
- `src/components/domain/room-status-refresh-controller.tsx`는 TV stale text에 `text-status-complete-check`를 쓴다. 이 orange 사용은 status meaning이 있는 stale/attention text로 허용 가능하지만 contrast를 확인한다.
- `src/components/domain/erp-empty-state.tsx`의 토큰 예시는 `StatusBadge`만 사용한다. Story 3.5 validator에 포함해 예시 UI drift를 막는다.
- 현재 `git status --short`에는 `_bmad-output/story-automator/orchestration-1-20260607-165702.md`의 unrelated local modification이 있다. 이 story 구현에서 되돌리거나 수정하지 않는다.

### Data and Calculation Rules

- `RoomStatusDto.displayStatus`의 가능한 값은 `사용중`, `예약`, `청소중`, `종료확인`, `빈방`이다. UI는 이 값을 그대로 표시한다. [Source: `src/modules/rooms/dtos.ts`, `src/components/domain/status-badge.tsx`]
- `종료확인`은 `사용중` 남은분 0일 때 domain service가 반환하는 display status다. UI는 `remainingMinutes <= 0`으로 display status를 다시 결정하지 않는다. [Source: `_bmad-output/implementation-artifacts/3-1-객실-상태-dto와-최신-활성-콜-계산.md`]
- `빈방`은 활성 콜이 없는 상태이며 후퇴/outline 표현이다. filled bronze + white text는 금지한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - room-card-빈방/status-badge]
- `종료확인` bright orange `#F25C1F`는 glow/accent 전용이고 텍스트 배지 fill은 dark orange `#D2440E`다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - status token table]
- Brand gold `#B57E12`는 body text로 사용하지 않는다. fill, 대형 굵은 수치, icon/accent 중심으로 쓴다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - Colors]

### Architecture Compliance

- App Router page는 domain query를 서버에서 실행하고, `RoomStatusCard`는 DTO를 렌더링하는 presentation component로 유지한다.
- `src/app` route code는 status color map을 소유하지 않는다. 상태 색상/라벨/glyph는 `src/components/domain/status-badge.tsx`와 `globals.css` theme token이 소유한다.
- `src/modules/rooms/room-status-service.ts`는 read-only domain service다. 이 story에서 service logic을 변경할 필요가 생기면 scope creep이다.
- 새 dependency는 필요 없다. `@tanstack/react-table`은 call ledger용이고, 이 story에서 React Query/SWR/accessibility library를 추가하지 않는다.
- E2E는 기존 Playwright pattern을 따른다. DB seed는 기존 story 3.2~3.4처럼 Prisma client + `story35_*` 계정/fixture를 사용한다.

### UX and Accessibility Guardrails

- STATUS 토큰은 모든 표면에서 동일 hex로 유지한다. 화면별로 `예약` blue를 연하게 하거나 TV에서 `종료확인` orange를 바꾸는 식의 변형은 금지다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - Hard Rules]
- 상태 badge는 색상만으로 의미를 전달하지 않는다. 텍스트 라벨과 glyph가 항상 같이 있어야 한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` - Accessibility Floor]
- `청소중` gold fill 위 white text는 contrast fail이다. 반드시 `#3D3115` 계열 foreground를 사용한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/review-accessibility.md` - Contrast ledger]
- `종료확인` motion은 소리 없는 느린 opacity breathe만 허용하며, `prefers-reduced-motion: reduce`에서는 animation을 끄고 정적 ring + `⚠` label로 전달한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` - State Patterns]
- 일반 텍스트 contrast target은 4.5:1이고 대형 텍스트/UI component는 3:1이다. 현 token에서는 body/text/surface, muted, cleaning, complete-check pairing이 보정되어 있다. 임의 색상을 추가하면 이 수치를 다시 계산해야 한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` and `review-accessibility.md`]

### Previous Story Intelligence

- Story 3.4 완료 커밋 `8b2039a`는 `/tv` fullscreen route, `RoomStatusCard variant="tv"`, `RoomStatusRefreshController variant="tv"`, TV loading skeleton, Story 3.4 validator/E2E/docs sync를 완료했다.
- Story 3.4의 중요한 학습은 TV 전용 surface도 shared `RoomStatusCard`를 재사용하게 만든 점이다. Story 3.5에서 TV-only badge를 새로 만들면 3.4의 재사용 의도를 깨뜨린다.
- Story 3.2~3.4 E2E는 DB seed helper가 반복된다. Story 3.5는 기존 fixture를 복사하되 account IDs, staffCodes, customerMemo prefix를 `story35`/`E2E35`로 분리한다.
- Story 3.x pattern은 source 변경 + docs/project-context sync + validator + E2E spec + lint chain 연결이다. Story 3.5도 같은 완료 기준을 따른다.
- Story 3.1~3.4에서 Playwright dev server listen이 sandbox에서 `EPERM`으로 막힐 수 있었다. 실행 불가 시 정확히 기록하고, 통과하지 않은 E2E를 통과했다고 쓰지 않는다.

### Git Intelligence

- 최근 커밋 순서: `8b2039a feat(story-3.4): TV 현황판 fullscreen route`, `f2293c9 chore: stop story automator after story 3.3`, `77b77de feat(story-3.3): 객실 현황 화면과 웨이터 안내`, `91f79cd feat(story-3.2): 첫 화면 실시간 객실/콜 현황`, `995779f feat(story-3.1): 객실 상태 DTO와 최신 활성 콜 계산`.
- Story 3.4 stat에서 status UI 관련 파일이 이미 변경됐다: `src/components/domain/room-status-card.tsx`, `src/components/domain/room-status-refresh-controller.tsx`, `src/app/tv/page.tsx`, `src/app/tv/loading.tsx`, `tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`.
- 현재 unrelated dirty file: `_bmad-output/story-automator/orchestration-1-20260607-165702.md`. 이 story 구현 범위 밖이다.

### Latest Technical Information

- Project-pinned versions: `next@16.2.7`, `react@19.2.7`, `react-dom@19.2.7`, `typescript@5.9.3`, `tailwindcss@4.3.0`, `@playwright/test@1.60.0`. 이번 story에서 dependency upgrade는 필요 없다. [Source: `package.json`]
- CSS `prefers-reduced-motion`는 이미 전역 stylesheet에서 쓰고 있다. 이 story는 새 browser API나 package보다 기존 CSS media query contract를 강화한다. [Source: `src/app/globals.css`]
- Playwright는 이미 project E2E runner다. `page.emulateMedia({ reducedMotion: "reduce" })`, locator, web assertion 중심으로 작성하고 `waitForTimeout()`을 금지한다. [Source: existing `tests/e2e/story-3-2-live-status.spec.ts`, `tests/e2e/story-3-4-tv-fullscreen-board.spec.ts`]

### Testing Requirements

- Static validator checks:
  - `globals.css` contains locked status token values and foreground pairings.
  - `status-badge.tsx` contains all five labels/glyphs and uses token classes, not inline style.
  - `StatusBadge` uses pill/full radius, not `rounded-md`.
  - `청소중` does not use white foreground.
  - `빈방` badge does not use filled bronze with white text.
  - `종료확인` text badge does not use glow token as text background.
  - `@media (prefers-reduced-motion: reduce)` preserves static attention ring and suppresses animation.
  - `/live`, `/rooms`, `/tv` use `RoomStatusCard` and do not define separate status color maps.
  - Story 3.5 E2E exists, uses no `waitForTimeout(`, and covers all five state labels/glyphs.
- E2E behavior checks:
  - `/live`, `/rooms`, `/tv` show the five statuses through `StatusBadge` aria labels and visible glyph/text.
  - TV cards retain large typography ramp.
  - Reduced-motion mode disables attention animation while preserving `⚠` and `결제·확인 필요`.
  - No edit/autosave/mutation affordance appears because status polish must not turn read-only surfaces into controls.
- Manual/a11y checks:
  - Review computed styles for foreground/background pairs if class-only checks are insufficient.
  - Confirm brand gold is not used as normal body text on new status/UI labels.

### File Structure Requirements

Expected updated files:

- `package.json`
- `src/app/globals.css`
- `src/components/domain/status-badge.tsx`
- `src/components/domain/room-status-card.tsx`
- `_bmad-output/project-context.md`
- `docs/modules/rooms.md`
- `src/modules/rooms/README.md`
- optionally `docs/modules/calls.md`

Expected new files:

- `scripts/validate-story-3-5.mjs`
- `tests/e2e/story-3-5-status-badge-accessibility.spec.ts`

Expected unchanged unless tests reveal a real drift:

- `src/app/(erp)/live/page.tsx`
- `src/app/(erp)/rooms/page.tsx`
- `src/app/tv/page.tsx`
- `src/modules/rooms/room-status-service.ts`
- `src/lib/authorization.ts`
- `src/lib/navigation.ts`

Avoid unless explicitly justified:

- New status badge component per route.
- Inline hex colors in route files.
- `#F25C1F` as text-bearing badge fill.
- `text-white` on `청소중`.
- `bg-status-empty text-white` or equivalent filled `빈방` badge.
- Client-side recalculation of `종료확인`.
- New Prisma migration, Server Action, Route Handler, realtime infrastructure, or global state library.

### Project Structure Notes

- Alignment: status presentation belongs in `src/components/domain/status-badge.tsx`, `src/components/domain/room-status-card.tsx`, and `src/app/globals.css`. Routes consume shared components.
- Detected risk: `StatusBadge` currently uses `rounded-md` even though DESIGN.md says status badge radius is full/pill. Story 3.5 should change it to `rounded-full` and add a validator/E2E guard so the badge shape does not drift.
- Detected risk: `.status-attention` currently has a static glow ring but no pulse. The AC says "pulse가 적용된다" 조건부로 reduced-motion을 요구한다. The implementation may choose static ring only, but if pulse is added it must be slow and reduced-motion safe.
- Detected risk: validator string checks can overfit. Prefer small parser/helpers or computed Playwright checks for contrast and class semantics where feasible.
- Existing dirty worktree note: `_bmad-output/story-automator/orchestration-1-20260607-165702.md` has unrelated local modifications. Do not revert or rewrite it for this story unless the user asks.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 3 Story 3.5]
- [Source: `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md` - UJ-3, FR-2, FR-16~FR-19]
- [Source: `_bmad-output/planning-artifacts/architecture.md` - Frontend Architecture, Accessibility, Domain Service Boundary]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - Colors, Status Badge, TV Typography, Hard Rules]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` - State Patterns, Accessibility Floor, TV Fullscreen]
- [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/review-accessibility.md` - Contrast Ledger, Priority Order]
- [Source: `_bmad-output/project-context.md` - Story 3.1~3.4 rules]
- [Source: `src/app/globals.css` - status token variables and reduced-motion rule]
- [Source: `src/components/domain/status-badge.tsx` - shared status badge source of truth]
- [Source: `src/components/domain/room-status-card.tsx` - shared room card and TV variant]
- [Source: `_bmad-output/implementation-artifacts/3-4-tv-현황판-fullscreen-route.md` - previous story intelligence]

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- `node scripts/validate-story-3-5.mjs` - PASS (`Story 3.5 validation passed.`)
- `npm run lint` - PASS (Story 1.1~3.5 validators all passed)
- `npm run test:unit` - PASS (3 tests, 1 suite passed; command currently executes the existing `operating-date` test subset through the project script)
- `npm run test:e2e -- tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - BLOCKED by sandbox listen permission before browser tests ran: `listen EPERM: operation not permitted 127.0.0.1:3000`
- `npx tsc --noEmit` - exploratory check failed on pre-existing project-wide type errors in call-ledger/calls/audit and older E2E files; after replacing the new Story 3.5 `Algorithm` const enum usage, no Story 3.5 file remained in the reported errors.
- Review auto-fix `node scripts/validate-story-3-5.mjs` - PASS (`Story 3.5 validation passed.`)
- Review auto-fix `npm run lint` - PASS (Story 1.1~3.5 validators all passed)
- Review auto-fix `npm run test:unit` - PASS (3 tests, 1 suite passed)
- Review auto-fix `npm run test:e2e -- tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - BLOCKED by sandbox listen permission before browser tests ran: `listen EPERM: operation not permitted 127.0.0.1:3000`

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Locked `StatusBadge` to pill/full radius while keeping shared label+glyph+token rendering for all five room states.
- Added slow `.status-attention` opacity breathe with reduced-motion `animation: none` and static ring fallback.
- Polished empty room cards to use dashed `border-status-empty` + `bg-surface` outline treatment and kept `종료확인` text on dark orange badge tokens.
- Added Story 3.5 static validator with locked token, contrast, forbidden class/map, motion, route drift, E2E, and docs checks; connected it to `npm run lint`.
- Added Story 3.5 Playwright spec covering `/live`, `/rooms`, `/tv`, label+glyph status meaning, token pairings, reduced motion, and TV typography ramp. The spec could not run in this sandbox because the Playwright web server cannot listen on `127.0.0.1:3000`.
- Synchronized Story 3.5 presentation rules into project context and rooms/calls module docs.
- Review auto-fix moved `.status-attention` animation from text-bearing badge/card content opacity to the card ring pseudo-element, so the pulse no longer dims badge or card text contrast.
- Review auto-fix removed `status-attention` from `StatusBadge` for `종료확인`; the badge now stays dark-orange text-bearing token only, while bright orange is limited to the non-text card ring/accent.
- Review auto-fix strengthened Story 3.5 validator and E2E assertions so nested/whole-element attention animation cannot regress.

### File List

- `_bmad-output/implementation-artifacts/3-5-상태-badge-종료확인-주의-표현-접근성-polish.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- `docs/modules/calls.md`
- `docs/modules/rooms.md`
- `package.json`
- `scripts/validate-story-3-5.mjs`
- `src/app/globals.css`
- `src/components/domain/room-status-card.tsx`
- `src/components/domain/status-badge.tsx`
- `src/modules/rooms/README.md`
- `tests/e2e/story-3-5-status-badge-accessibility.spec.ts`

### Senior Developer Review (AI)

Reviewer: GPT-5 Codex  
Date: 2026-06-09  
Outcome: Approved after automatic fixes. No critical issues remain.

Findings fixed automatically:

- HIGH: `StatusBadge` applied `status-attention` to the `종료확인` badge while `RoomStatusCard` also applied `status-attention` to the card. This created nested opacity animation on text-bearing content and could reduce perceived text contrast during the pulse. Fixed by removing `status-attention` from the badge and keeping badge text on `bg-status-complete-check text-status-complete-check-foreground`.
- HIGH: `.status-attention` animated the whole element opacity, so card text and badge text dimmed during attention pulse. Fixed by moving the opacity breathe to `.status-attention::after`, a non-text ring pseudo-element, while the card content remains fully opaque.
- MEDIUM: Story 3.5 validator required the unsafe badge-level `status-attention` class and did not guard against whole-card opacity animation. Fixed validator to require pseudo-element ring animation, forbid `status-attention` in `status-badge.tsx`, and keep reduced-motion static ring coverage.
- MEDIUM: E2E checked the attention card ring but did not assert the termination badge itself was not animated. Added assertions that `종료확인` badge has no `status-attention` class and no animation, while the card ring owns `status-attention-breathe`.

Validation after fixes:

- `node scripts/validate-story-3-5.mjs` - PASS
- `npm run lint` - PASS
- `npm run test:unit` - PASS
- `npm run test:e2e -- tests/e2e/story-3-5-status-badge-accessibility.spec.ts` - BLOCKED before browser tests by sandbox `listen EPERM: operation not permitted 127.0.0.1:3000`

### Change Log

- 2026-06-09: Story 3.5 status presentation polish implemented; shared badge/card tokens, motion safety, validator, E2E coverage, and documentation sync completed. E2E execution blocked by sandbox `listen EPERM` and recorded without claiming pass.
- 2026-06-09: Senior review auto-fixes applied; attention pulse now animates only the non-text card ring pseudo-element, `종료확인` badge no longer animates, validator/E2E guards were strengthened, and story/sprint status moved to done.
