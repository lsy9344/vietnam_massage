---
baseline_commit: 52bdc2c908b7b36dc6900b262cf7561147b5a7ad
---

# Story 3.1: 객실 상태 DTO와 최신 활성 콜 계산

Status: done

## Story

As a 운영 사용자,
I want 객실별 현재 상태가 콜 원장 기준으로 일관되게 계산되기를,
so that 첫 화면, 객실 현황, TV 현황판이 서로 다른 상태를 보여주지 않게 할 수 있다.

## Acceptance Criteria

1. **Given** 객실 마스터에 11개 객실이 있고 콜 원장에 서비스 콜이 있다  
   **When** 객실 상태 서비스를 조회한다  
   **Then** 각 객실별 `RoomStatusDto`가 반환된다  
   **And** DTO는 객실 ID, 객실 표시명, 표시 순서, 표시 상태, 원본 콜 상태, 코스, 담당자, 시작시간, 종료예정, 남은분, 안내 문구에 필요한 필드를 포함한다.
2. **Given** 객실에 `사용중`, `청소중`, `예약` 상태의 활성 콜이 있다  
   **When** 객실 상태를 계산한다  
   **Then** 최신 활성 콜은 객실, 상태, 시작시간 기준으로 결정된다  
   **And** `방문완료`, `노쇼`, `취소` 콜은 현재 객실 상태의 활성 콜로 사용하지 않는다.
3. **Given** 객실에 활성 콜이 없다  
   **When** 객실 상태를 계산한다  
   **Then** 표시 상태는 `빈방`이다  
   **And** 남은분과 종료예정은 `-` 또는 비어 있음으로 표시 가능한 값을 반환한다.
4. **Given** 활성 콜 상태가 `사용중`이고 코스 시간과 시작시간이 있다  
   **When** 현재 시간이 종료예정 전이다  
   **Then** 남은분은 0 이상 정수로 계산된다  
   **And** 종료예정은 timezone-aware 기준으로 일관되게 계산된다.
5. **Given** 활성 콜 상태가 `사용중`이고 남은분이 0 이하로 계산된다  
   **When** 객실 상태를 반환한다  
   **Then** 표시 상태는 `종료확인`으로 반환된다  
   **And** 남은분은 음수로 표시되지 않는다.
6. **Given** 시작시간과 종료예정이 자정을 넘는다  
   **When** 남은분과 종료예정을 계산한다  
   **Then** 자정 넘김 운영 흐름이 올바르게 반영된다  
   **And** 날짜 경계 때문에 남은분이 잘못 음수 처리되지 않는다.
7. **Given** 객실 상태 계산이 실행된다  
   **When** DTO를 생성한다  
   **Then** 정산, 월마감, 지급 스냅샷 데이터는 변경하지 않는다  
   **And** 객실 상태는 조회 전용 계산 결과로만 제공된다.
8. **Given** 첫 화면, 객실 현황, TV 현황판이 객실 상태를 필요로 한다  
   **When** 각 화면이 데이터를 조회한다  
   **Then** 모두 같은 `RoomStatusDto`와 같은 계산 서비스를 재사용할 수 있다  
   **And** 화면별로 상태 계산을 중복 구현하지 않는다.
9. **Given** 개발자가 객실 상태 계산을 검증한다  
   **When** 활성 콜 없음, 예약, 청소중, 사용중, 종료확인, 방문완료 제외, 노쇼/취소 제외, 자정 넘김 테스트를 실행한다  
   **Then** 모든 테스트가 통과한다  
   **And** 객실 상태 계산은 UI component가 아니라 domain service에서 수행된다.

## Tasks / Subtasks

- [x] Task 1: `rooms` 도메인 DTO 계약을 추가한다 (AC: 1, 8)
  - [x] `src/modules/rooms/dtos.ts`를 새로 만들고 `RoomDisplayStatus = "사용중" | "예약" | "청소중" | "종료확인" | "빈방"` 타입을 정의한다.
  - [x] `RoomStatusDto`에 `roomId`, `roomDisplayName`, `roomSortOrder`, `displayStatus`, `sourceCallStatus`, `activeCallId`, `serviceDate`, `startTime`, `expectedEndAt`, `remainingMinutes`, `course`, `therapist1`, `therapist2`, `earcare`, `guidanceText`, `updatedAt`를 포함한다.
  - [x] `expectedEndAt`, `remainingMinutes`, `course`, 담당자 필드는 활성 콜/정책이 없을 때 `null`로 표현할 수 있게 한다.
- [x] Task 2: 최신 활성 콜 조회와 선택 규칙을 구현한다 (AC: 1, 2, 3, 7)
  - [x] `src/modules/rooms/room-status-service.ts`를 새로 만들고 `listRoomStatuses({ operatingMonthId, serviceDate, now?, prismaClient? })`를 구현한다.
  - [x] 활성 상태는 `예약`/`RESERVED`, `사용중`/필요 시 stable code 변형, `청소중`/필요 시 stable code 변형만 포함한다.
  - [x] 제외 상태는 `방문완료`/`VISIT_COMPLETE`, `노쇼`/`NO_SHOW`, `취소`/`CANCELED`이며, 이 상태들은 객실 현재 상태를 점유하지 않는다.
  - [x] 모든 active `Room`을 `sortOrder` 오름차순으로 반환하고, 활성 콜이 없는 객실은 `빈방` DTO를 반환한다.
  - [x] 최신 활성 콜 선택은 같은 객실 안에서 `serviceDate`, 운영일 기준 정규화된 시작시각, `createdAt` 또는 `updatedAt` tie-breaker를 deterministic하게 적용한다.
  - [x] 서비스는 read-only query만 수행한다. `serviceCall`, `statusHistory`, `assignment`, `settlement`, `closing`, `auditLog`를 생성/수정/삭제하지 않는다.
- [x] Task 3: 시간/남은분/종료확인 계산을 구현한다 (AC: 4, 5, 6)
  - [x] `ServiceCall.startTime`과 `CoursePolicy.durationMinutes`로 종료예정을 계산한다.
  - [x] 운영일 자정 넘김을 반영한다. `11:00`~`01:00` 슬롯 구조에서 `00:xx`/`01:xx` 시작은 같은 `serviceDate`의 다음 calendar day로 정규화한다.
  - [x] `now`를 주입 가능하게 해 단위 테스트에서 고정 시각을 사용할 수 있게 한다.
  - [x] `remainingMinutes`는 `Math.max(0, ceil(diffMinutes))` 또는 동등 규칙으로 음수를 반환하지 않는다.
  - [x] 원본 콜 상태가 `사용중`이고 계산상 남은분이 0이면 `displayStatus`만 `종료확인`으로 바꾸고 `sourceCallStatus`는 원본 상태를 보존한다.
- [x] Task 4: 코스/담당자/안내 문구 mapping을 추가한다 (AC: 1, 3, 8)
  - [x] 코스는 `Course.id`, `Course.code`, 현재 운영월에 유효한 `CoursePolicy.name`, `CoursePolicy.tvDisplayName`, `CoursePolicy.durationMinutes`를 DTO에 담는다.
  - [x] 담당자는 active `ServiceCallAssignment`만 읽고 `THERAPIST_1`, `THERAPIST_2`, `EARCARE`를 분리한다. 표시명은 화면용이며 저장/비교 키로 쓰지 않는다.
  - [x] `guidanceText` 기본값을 상태별로 제공한다: `예약`, `사용중`, `청소중`, `종료확인`, `빈방`. Story 3.3에서 문구 정책이 확장될 수 있도록 함수/상수로 분리한다.
  - [x] 정책 누락 시 전체 DTO 생성을 실패시키지 말고 해당 active call의 시간 계산 필드를 `null`로 두며 테스트에서 명시한다.
- [x] Task 5: Story 3.1 단위 테스트를 추가한다 (AC: 1-9)
  - [x] `src/modules/rooms/room-status-service.test.ts`를 추가하고 in-memory Prisma client 패턴을 사용한다.
  - [x] 테스트 케이스: 11개 active room 정렬, 활성 콜 없음=`빈방`, `예약`, `청소중`, `사용중`, `종료확인`, `방문완료` 제외, `노쇼` 제외, `취소` 제외, 최신 시작시각 선택, 자정 넘김 종료예정, 정책 누락 fallback.
  - [x] read-only 보장을 위해 memory client의 create/update/delete 계열 호출이 없음을 검증하거나 해당 method를 제공하지 않는다.
- [x] Task 6: 정적 검증과 문서 동기화를 추가한다 (AC: 7, 8, 9)
  - [x] `scripts/validate-story-3-1.mjs`를 추가하고 `package.json`의 `npm run lint` 뒤에 연결한다.
  - [x] validator는 `src/modules/rooms/dtos.ts`, `src/modules/rooms/room-status-service.ts`, `src/modules/rooms/room-status-service.test.ts`, docs/project-context 갱신, 활성/제외 상태, 자정 넘김, `종료확인`, read-only guardrail을 확인한다.
  - [x] `src/modules/rooms/README.md`와 `docs/modules/rooms.md`에 Story 3.1 DTO/service 계약을 추가한다.
  - [x] `_bmad-output/project-context.md`에 Story 3.1 확정 규칙을 추가한다.
- [x] Task 7: 검증을 실행하고 결과를 기록한다 (AC: 9)
  - [x] `node scripts/validate-story-3-1.mjs`를 실행한다.
  - [x] `npm run test:unit -- src/modules/rooms/room-status-service.test.ts`를 실행한다.
  - [x] `npm run lint`를 실행해 Story 1.1~3.1 validator 체인이 통과하는지 확인한다.
  - [x] 실행 불가 시 누락된 환경 조건과 대체 검증 결과를 Story File List/Completion Notes에 정확히 기록한다.

## Dev Notes

### Story Scope

- 이번 story의 중심은 `rooms` 도메인 DTO와 조회 전용 상태 계산이다. `/live`, `/rooms`, `/tv` 화면 구현, 카드 grid, polling UI, fullscreen TV chrome 숨김은 Story 3.2~3.4 범위다. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 3, Story 3.1~3.4]
- 화면별 상태 계산 중복을 막기 위해 첫 화면, 객실 현황, TV 현황판이 모두 같은 `RoomStatusDto`와 `listRoomStatuses()`를 쓰도록 계약을 만든다. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.1 AC 8]
- `rooms`는 room-status/TV display DTO만 소유한다. `calls` mutation, settlement calculation, monthly close snapshot은 소유하지 않는다. [Source: `_bmad-output/planning-artifacts/architecture.md` - Service Boundaries; `src/modules/rooms/README.md`]

### Current Source State

- `src/modules/rooms/README.md`와 `docs/modules/rooms.md`는 scaffold 상태이며, 실제 `dtos.ts`, `room-status-service.ts`, 테스트 파일은 아직 없다. [Source: `src/modules/rooms/README.md`; `docs/modules/rooms.md`]
- `/live`, `/rooms`, `/tv` page는 현재 `ErpEmptyState` placeholder이고 route access만 검증한다. Story 3.1은 이 page들을 대규모로 바꾸지 않는다. [Source: `src/app/(erp)/live/page.tsx`; `src/app/(erp)/rooms/page.tsx`; `src/app/(erp)/tv/page.tsx`]
- `StatusBadge`와 Tailwind 토큰은 이미 `사용중`, `예약`, `청소중`, `종료확인`, `빈방`을 지원한다. DTO의 `displayStatus`는 이 컴포넌트가 받을 수 있는 한국어 상태값과 맞아야 한다. [Source: `src/components/domain/status-badge.tsx`; `src/app/globals.css`]
- 현재 `prisma/schema.prisma`에는 Story 3.1에 필요한 `Room`, `ServiceCall`, `Course`, `CoursePolicy`, `ServiceCallAssignment`, `Employee`, `OperatingMonth` 모델이 있다. 새 DB table은 필요하지 않다. [Source: `prisma/schema.prisma`]

### Data Contract

권장 DTO shape:

```ts
export type RoomDisplayStatus = "사용중" | "예약" | "청소중" | "종료확인" | "빈방";

export type RoomStatusDto = {
  roomId: string;
  roomDisplayName: string;
  roomSortOrder: number;
  displayStatus: RoomDisplayStatus;
  sourceCallStatus: string | null;
  activeCallId: string | null;
  serviceDate: string;
  startTime: string | null;
  expectedEndAt: string | null;
  remainingMinutes: number | null;
  course: {
    id: string;
    code: string;
    name: string;
    tvDisplayName: string;
    durationMinutes: number;
  } | null;
  therapist1: RoomStatusAssigneeDto | null;
  therapist2: RoomStatusAssigneeDto | null;
  earcare: RoomStatusAssigneeDto | null;
  guidanceText: string;
  updatedAt: string;
};
```

- `roomId`, `activeCallId`, `course.id`, 담당자 `id`는 stable ID다. 표시명은 화면용으로만 사용한다. [Source: `_bmad-output/project-context.md` - stable ID rules]
- `sourceCallStatus`는 원본 콜 상태를 보존한다. `사용중`이 시간 초과되어 `displayStatus="종료확인"`이 되어도 `sourceCallStatus`는 `사용중` 그대로여야 한다. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.1 AC 5]
- `expectedEndAt`은 timezone-aware ISO string이어야 한다. 단위 테스트에서는 `now`를 주입하고, 운영일 자정 넘김을 고정 fixture로 검증한다. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.1 AC 4, 6]

### Query and Calculation Rules

- Query input은 `operatingMonthId`, `serviceDate`, optional `now`, optional `prismaClient`로 시작한다. 후속 polling/Route Handler가 붙어도 이 도메인 함수 계약은 transport와 독립적이어야 한다. [Source: `_bmad-output/planning-artifacts/architecture.md` - Realtime extension path]
- 모든 active room을 먼저 읽고, 같은 `operatingMonthId + serviceDate`의 활성 call을 room별로 group한다. 객실이 비활성인 경우 room-status 화면에는 표시하지 않는다. [Source: `_bmad-output/project-context.md` - Room rules; `src/modules/masters/room-service.ts`]
- 최신 활성 call은 mutable 표시명이 아니라 `roomId`, `status`, `serviceDate`, 정규화된 `startTime`, deterministic tie-breaker로 선택한다. 단순 문자열 정렬만 쓰면 `01:00`이 `23:30`보다 앞서는 자정 넘김 버그가 생긴다. [Source: `_bmad-output/project-context.md` - TimeSlot sortOrder and cross-midnight rules]
- 코스 시간은 현재 운영월에 유효한 `CoursePolicy.durationMinutes`에서 가져온다. 코스명이나 TV 표시명을 duration source로 쓰지 않는다. [Source: `_bmad-output/project-context.md` - CoursePolicy rules]
- `사용중`이 아닌 `예약`/`청소중`은 원본 상태를 표시 상태로 반환한다. 종료확인 전환은 `사용중`에만 적용한다. [Source: `_bmad-output/planning-artifacts/epics.md` - Story 3.1 AC 4, 5]
- `remainingMinutes`는 절대 음수로 반환하지 않는다. UI가 음수 clamp를 다시 구현하게 만들지 않는다. [Source: `_bmad-output/planning-artifacts/epics.md` - FR17, Story 3.1 AC 5]

### Architecture Compliance

- Domain logic은 `src/modules/rooms/room-status-service.ts`에 둔다. React component, page, Server Action이 남은분/종료확인 계산을 직접 구현하지 않는다. [Source: `_bmad-output/project-context.md` - framework rules]
- Server Action/Route Handler가 나중에 추가되면 authenticate/authorize/validate/service-call/response mapping만 담당한다. 이번 story에서 broad internal REST API를 만들 필요는 없다. [Source: `_bmad-output/planning-artifacts/architecture.md` - Domain service boundary]
- Story 3.1은 조회 전용이다. 감사 로그는 콜 변경 이력을 보존할 뿐 객실 상태 계산을 대신하지 않는다. [Source: `_bmad-output/planning-artifacts/epics.md` - Epic 2/3 context]
- Prisma migration은 기본적으로 필요 없다. 단, dev agent가 실제 쿼리 성능상 index가 필요하다고 판단하면 그 근거와 migration을 Story File List에 기록해야 한다. 현재 schema에는 `idx_service_calls_month_date`, `idx_service_calls_room_date`, `idx_service_calls_status_date`가 있다. [Source: `prisma/schema.prisma`]

### UX and Accessibility Guardrails

- DTO의 `displayStatus`는 status badge의 잠긴 상태값과 일치해야 한다: `사용중`, `예약`, `청소중`, `종료확인`, `빈방`. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - Status Tokens]
- 상태 의미는 색상만으로 전달하지 않는다. 후속 UI는 라벨과 글리프를 함께 표시해야 하므로 DTO는 화면이 라벨을 안정적으로 선택할 수 있는 상태값을 제공해야 한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` - Accessibility Floor]
- `종료확인`의 밝은 glow 토큰은 비텍스트 장식 전용이고, 텍스트 배지는 어두운 `status-종료확인` 토큰을 쓴다. Story 3.1은 토큰을 바꾸지 않되 downstream UI가 상태를 오판하지 않게 DTO 상태를 정확히 반환한다. [Source: `src/app/globals.css`; `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md`]

### Previous Story Intelligence

- Story 2.6 completed at commit `52bdc2c` and introduced the pattern of focused static validators, route-local behavior tests, docs sync, and project-context updates. Story 3.1 should follow that pattern with `scripts/validate-story-3-1.mjs`. [Source: `git log --oneline -5`; `_bmad-output/implementation-artifacts/2-6-콜-원장-키보드-입력성과-type-ahead-완성.md`]
- Story 2.6 review found that missing validator/E2E/docs wiring caused false readiness in earlier cycles. Do not mark Story 3.1 complete unless source files, tests, validator, docs, and project-context are all synchronized. [Source: `_bmad-output/implementation-artifacts/2-6-콜-원장-키보드-입력성과-type-ahead-완성.md` - Review/Completion Notes]
- Story 2.5 and 2.6 E2E specs seed isolated `story*` data and URL-scope the tested date/month. If Story 3.1 later gets E2E or integration tests, use isolated `story31_*` data and do not depend on global seed state. [Source: `tests/e2e/story-2-5-daily-expense-summary.spec.ts`; `tests/e2e/story-2-6-call-ledger-keyboard-typeahead.spec.ts`]
- Story 2.4 D-course validation established a useful pattern: domain service enforces business rules, Server Action maps errors, UI only renders. Story 3.1 should keep 종료확인/remaining-time logic in the domain service. [Source: `_bmad-output/project-context.md` - Story 2.4 and Story 2.6 rules]

### Latest Technical Information

- Repo-pinned versions are already current project constraints for this story: `next@16.2.7`, `react@19.2.7`, `@prisma/client@7.8.0`, `prisma@7.8.0`, `zod@4.1.12`, `@tanstack/react-table@8.21.3`, Playwright `1.60.0`. Do not upgrade dependencies in this story. [Source: `package.json`]
- Prisma official docs support relation `include`, nested reads, filtering, and `orderBy`; use Prisma query shaping rather than manual post-query DB lookups for every room/call when relations can be included cleanly. [Source: https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries]
- Next.js App Router pages can fetch data in async Server Components; keep Story 3.1 service usable from Server Components without requiring a broad internal REST layer. [Source: https://nextjs.org/docs/app/getting-started/fetching-data]
- TanStack Query polling is relevant for Story 3.2~3.4 client refresh, not required for this domain service story. Keep `listRoomStatuses()` transport-neutral so polling can call the same contract later. [Source: https://tanstack.com/query/latest/docs/react/guides/polling]

### Testing Requirements

- Unit tests are required before UI use because this story controls shared room status semantics for three surfaces. [Source: `_bmad-output/project-context.md` - testing rules]
- Test the exact active/excluded status set. Include both Korean legacy values and stable code variants already used in previous stories where they exist: `RESERVED`, `VISIT_COMPLETE`, `NO_SHOW`, `CANCELED`. [Source: `src/modules/calls/service-call-service.ts`; `tests/e2e/story-2-6-call-ledger-keyboard-typeahead.spec.ts`]
- Test 자정 넘김 with fixed `now`; example: `serviceDate=2034-06-05`, `startTime=23:30`, duration 120, `now=2034-06-06T00:15:00+09:00` should still show positive remaining minutes.
- Test `사용중` duration elapsed: remaining returns `0`, `displayStatus="종료확인"`, `sourceCallStatus="사용중"`.
- Test policy missing fallback: active call still occupies the room, but `expectedEndAt` and `remainingMinutes` can be `null` with safe DTO output. Do not silently mark the room as `빈방`.

### File Structure Requirements

Expected new files:

- `src/modules/rooms/dtos.ts`
- `src/modules/rooms/room-status-service.ts`
- `src/modules/rooms/room-status-service.test.ts`
- `scripts/validate-story-3-1.mjs`

Expected updated files:

- `package.json`
- `src/modules/rooms/README.md`
- `docs/modules/rooms.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/3-1-객실-상태-dto와-최신-활성-콜-계산.md`

Avoid unless explicitly justified:

- `prisma/schema.prisma` and migrations, because required models and indexes already exist.
- `/live`, `/rooms`, `/tv` UI rewrites, because those are later Epic 3 stories.
- New global state library or broad REST API.

## Project Structure Notes

- Alignment: Story 3.1 fits the existing `src/modules/{domain}` service/test convention and the validator chain used by Stories 1.1~2.6.
- Detected variance: `rooms` docs mention `RoomStatusView`/`RoomStatusSnapshot` names, while architecture suggests `RoomStatusDto`. Use `RoomStatusDto` for implementation and update docs to retire ambiguous names.
- Existing dirty worktree note: `_bmad-output/story-automator/orchestration-1-20260607-165702.md` has unrelated local modifications. Do not revert or rewrite it for this story unless the user asks.

### References

- `_bmad-output/planning-artifacts/epics.md` - Epic 3, Story 3.1, FR16-FR19
- `_bmad-output/planning-artifacts/architecture.md` - Domain service boundary, Room/TV refresh, Service Boundaries, Project Organization
- `_bmad-output/project-context.md` - stable ID, calls, room, time slot, course policy, testing rules
- `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md` - UJ-1, UJ-3, FR1, FR2, FR16-FR19
- `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md` - status tokens, room card, TV typography
- `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md` - waiter flow, TV flow, accessibility floor
- `docs/modules/rooms.md`
- `src/modules/rooms/README.md`
- `prisma/schema.prisma`
- `src/modules/calls/service-call-service.ts`
- `src/components/domain/status-badge.tsx`
- `src/app/globals.css`
- `_bmad-output/implementation-artifacts/2-6-콜-원장-키보드-입력성과-type-ahead-완성.md`
- Prisma relation queries: https://www.prisma.io/docs/orm/prisma-client/queries/relation-queries
- Next.js App Router data fetching: https://nextjs.org/docs/app/getting-started/fetching-data
- TanStack Query polling: https://tanstack.com/query/latest/docs/react/guides/polling

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-09: `node scripts/validate-story-3-1.mjs` 통과.
- 2026-06-09: `node --import tsx --test src/modules/rooms/room-status-service.test.ts` 통과, 7 tests pass.
- 2026-06-09: `npm run test:unit -- src/modules/rooms/room-status-service.test.ts`는 npm script 특성상 전체 `src/**/*.test.ts`도 함께 실행함. 초기 전체 unit suite 실패 원인은 기존 in-memory test fixture의 timestamp/DTO 필드 불일치와 course policy overlap fixture 불일치였고, test fixture를 보정한 뒤 전체 suite 통과.
- 2026-06-09: `npm run test:unit` 통과, 77 tests pass.
- 2026-06-09: `npm run lint` 통과, Story 1.1~3.1 validator chain pass.
- 2026-06-09: QA generate E2E workflow로 `tests/e2e/story-3-1-room-status-service.spec.ts` 추가.
- 2026-06-09: `PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e -- tests/e2e/story-3-1-room-status-service.spec.ts` 통과, 1 test pass.
- 2026-06-09: `npm run test:e2e -- tests/e2e/story-3-1-room-status-service.spec.ts`는 현재 sandbox에서 Next dev server의 `127.0.0.1:3000` listen이 `EPERM`으로 차단되어 실행 불가. Story 3.1 spec은 page/browser surface를 사용하지 않아 `PLAYWRIGHT_SKIP_WEBSERVER=1`로 동일 Playwright runner 검증을 수행.
- 2026-06-09: `node scripts/validate-story-3-1.mjs` 통과.
- 2026-06-09: `npm run lint` 통과, Story 1.1~3.1 validator chain pass.
- 2026-06-09: Review auto-fix: `serviceDate` 실제 calendar date 검증과 `startTime` 시간 범위 검증을 추가.
- 2026-06-09: Review auto-fix: `.env`, `.next`, Playwright/tsx 산출물, npm lockfile 혼입을 `.gitignore`에 추가해 Story 3.1 git 현실과 File List 노이즈를 정리.
- 2026-06-09: Review verification: `node --import tsx --test src/modules/rooms/room-status-service.test.ts` 통과, 8 tests pass.
- 2026-06-09: Review verification: `node scripts/validate-story-3-1.mjs` 통과.
- 2026-06-09: Review verification: `npm run test:unit` 통과, 78 tests pass.
- 2026-06-09: Review verification: `npm run lint` 통과, Story 1.1~3.1 validator chain pass.
- 2026-06-09: Review verification: `PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e -- tests/e2e/story-3-1-room-status-service.spec.ts` 통과, 1 test pass.

### Completion Notes List

- Create-story workflow completed on 2026-06-09.
- Ultimate context engine analysis completed - comprehensive developer guide created.
- `RoomStatusDto`와 `RoomDisplayStatus` 계약을 추가해 첫 화면/객실 현황/TV 현황판이 같은 DTO를 재사용할 수 있게 했다.
- `listRoomStatuses()`를 조회 전용 rooms 도메인 서비스로 구현했고, active room 정렬, 활성/제외 상태 필터, 최신 활성 콜 선택, 자정 넘김 시작시각 정규화, 종료예정/남은분/종료확인 계산을 포함했다.
- 코스 정책과 active 담당자 mapping을 DTO에 연결했고, 정책 누락 시 room occupancy는 유지하되 course/expectedEndAt/remainingMinutes를 `null`로 반환하도록 했다.
- Story 3.1 validator, rooms 문서, project-context를 동기화했고, 전체 unit suite 통과를 위해 기존 test fixture의 Date/DTO shape와 course policy overlap setup을 실제 서비스 계약에 맞게 보정했다.
- QA generate E2E workflow에서 Story 3.1 전용 Playwright spec을 추가해 `listRoomStatuses()`의 transport-neutral DTO workflow를 자동화했다.
- `/live`, `/rooms`, `/tv`는 현재 placeholder이므로 UI interaction E2E는 Story 3.2~3.4 구현 시 추가한다. 이번 spec은 injected `prismaClient` fixture로 활성/제외 상태, 최신 활성 콜, 자정 넘김, 정책 누락, 담당자 mapping, read-only guard를 검증한다.
- Review auto-fix에서 잘못된 `serviceDate`가 다음 달 날짜로 rollover되는 문제와 `24:00` 같은 불가능한 시작시간이 계산으로 들어가는 문제를 차단했다.
- Review auto-fix에서 로컬 민감/생성 산출물과 pnpm 프로젝트의 accidental `package-lock.json`이 git 상태에 노출되지 않도록 `.gitignore`를 보강했다.

### File List

- `.gitignore`
- `_bmad-output/implementation-artifacts/3-1-객실-상태-dto와-최신-활성-콜-계산.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/project-context.md`
- `docs/modules/rooms.md`
- `package.json`
- `playwright.config.ts`
- `scripts/validate-story-3-1.mjs`
- `src/modules/rooms/README.md`
- `src/modules/rooms/dtos.ts`
- `src/modules/rooms/room-status-service.ts`
- `src/modules/rooms/room-status-service.test.ts`
- `tests/e2e/story-3-1-room-status-service.spec.ts`
- `src/modules/calls/service-call-service.test.ts`
- `src/modules/masters/course-service.test.ts`
- `src/modules/masters/employee-service.test.ts`

### Change Log

- 2026-06-09: Story 3.1 객실 상태 DTO/service, 단위 테스트, validator, 문서 동기화를 완료하고 상태를 review로 전환.
- 2026-06-09: QA generate E2E workflow로 Story 3.1 Playwright service workflow spec, validator gap check, test summary를 추가.
- 2026-06-09: Senior Developer Review auto-fix로 입력 검증, 회귀 테스트, validator marker, gitignore를 보강하고 상태를 done으로 전환.

## Senior Developer Review (AI)

### Review Findings

- [MEDIUM][FIXED] `serviceDate` 검증이 실제 calendar date를 확인하지 않아 `2034-02-31` 같은 값이 JavaScript Date rollover로 `2034-03-03` 조회처럼 처리될 수 있었다. `parseDateParts()`에서 `YYYY-MM-DD` 형식과 round-trip 날짜 일치를 검증하도록 수정했다. [`src/modules/rooms/room-status-service.ts`]
- [MEDIUM][FIXED] `ServiceCall.startTime` 검증이 `HH:mm` 문자열만 확인해 `24:00`/`99:99` 같은 불가능한 시간이 종료예정/남은분 계산에 들어갈 수 있었다. `parseStartTime()`에서 hour/minute 범위를 차단했다. [`src/modules/rooms/room-status-service.ts`]
- [MEDIUM][FIXED] 로컬 산출물과 민감 파일(`.env`, `.next`, `playwright-report`, `test-results`, `tsconfig.tsbuildinfo`) 및 pnpm 프로젝트의 accidental `package-lock.json`이 untracked 상태로 노출되어 Story File List 검증과 보안 위생을 흐릴 수 있었다. `.gitignore`를 보강했다. [`.gitignore`]
- [LOW][FIXED] Story 3.1 validator가 새 입력 검증 회귀 테스트를 확인하지 않아 같은 문제가 재발해도 정적 검증이 통과할 수 있었다. validator marker에 `INVALID_SERVICE_DATE`/`INVALID_START_TIME` 테스트 확인을 추가했다. [`scripts/validate-story-3-1.mjs`]

### Acceptance Criteria Audit

- AC 1-3: `RoomStatusDto`, active room 정렬, 활성/제외 상태, 빈방 fallback을 코드와 테스트로 확인.
- AC 4-6: timezone-aware ISO 종료예정, 남은분 clamp, 종료확인 전환, 자정 넘김 계산을 코드와 테스트로 확인.
- AC 7-8: service는 read-only query만 수행하고 shared `listRoomStatuses()` 계약으로 `/live`, `/rooms`, `/tv` 후속 화면이 재사용 가능함을 확인.
- AC 9: unit, static validator, Playwright service workflow spec으로 핵심 상태 케이스를 확인.

### Review Verification

- `node --import tsx --test src/modules/rooms/room-status-service.test.ts`: passed, 8 tests.
- `node scripts/validate-story-3-1.mjs`: passed.
- `npm run test:unit`: passed, 78 tests.
- `npm run lint`: passed.
- `PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e -- tests/e2e/story-3-1-room-status-service.spec.ts`: passed, 1 test.
