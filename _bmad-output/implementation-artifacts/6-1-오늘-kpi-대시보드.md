---
baseline_commit: c02e46f
---

# Story 6.1: 오늘 KPI 대시보드

Status: done

<!-- Note: Validation completed during create-story. -->

## Story

As a 주인/관리자,
I want 조회날짜 기준 오늘 운영 KPI를 확인하기를,
so that 당일 예약, 방문완료, 매출, 정산 흐름을 빠르게 판단할 수 있다.

## Acceptance Criteria

1. 주인 또는 관리자가 `/dashboard/today`에 접근해 운영월과 조회날짜를 선택하면 해당 날짜 기준 오늘 KPI가 조회된다. 조회날짜 변경 시 URL search params와 server data 기준으로 KPI가 다시 계산된다.
2. KPI는 예약건수, 방문완료 콜, 노쇼, 취소를 표시하며 각 상태 수는 선택 날짜의 콜 원장 상태 기준으로 계산한다.
3. 결제합계, 순매출, 할인합계, 지출합계, 귀케어 풀, 마사지사 정산 합계는 `방문완료`/`VISIT_COMPLETE` 중 `calculationStatus === "calculated"`인 콜만 금액 집계에 포함한다. 예약, 사용중, 청소중, 노쇼, 취소는 매출/정산 KPI 금액에 포함하지 않는다.
4. 마사지사 담당콜과 마사지사 정산 합계가 표시된다. `THERAPIST_1`과 `THERAPIST_2` 담당 콜을 모두 반영하고, 같은 마사지사가 두 역할에 모두 있으면 기존 일일정산 규칙처럼 두 담당 건으로 계산한다.
5. A~E 코스별 방문완료 수가 표시된다. 비완료 콜, 정책 누락, 수당 누락, D코스 마사지사2 누락으로 계산 제외된 row는 코스별 완료 수에 포함하지 않고 warning으로 드러낸다.
6. 원본 `오늘대시보드`의 ERP 보존 항목은 최소 오늘 예약, 방문완료, 노쇼, 취소, 결제합계, 마사지사 담당콜/정산, 코스별 방문완료 요약으로 포함한다. 원본 엑셀에 없는 CRM, 고객 세그먼트, 마케팅 성과 지표는 추가하지 않는다.
7. `/dashboard/today` 화면은 `src/modules/dashboard/dashboard-query-service.ts`의 read-only DTO를 소비한다. route component나 UI component가 콜/정산/코스 계산을 재구현하지 않는다.
8. 데이터 로딩 중에는 `src/app/(erp)/dashboard/today/loading.tsx` 또는 동등한 shadcn Skeleton 기반 loading UI가 layout outline을 유지하며 blank screen을 만들지 않는다.
9. KPI 조회 실패 시 안전한 한국어 오류 메시지, retry affordance, `role="alert"` 또는 동등한 live semantics를 제공한다. 구현 구조상 마지막 성공 값 유지가 가능한 client boundary를 쓰는 경우 stale 표시와 함께 유지하고, 불가능하면 이전 값과 새 기준값이 섞이지 않게 명확한 실패 상태를 표시한다.
10. 데이터가 없는 날짜는 임의의 0값 그래프처럼 꾸미지 않고 "이 날짜의 콜이 없습니다" 또는 동등한 빈 상태와 날짜 변경/콜 원장 이동 affordance를 표시한다.
11. `/dashboard/today`는 기존 route access 정책을 유지한다. administrator, counter, settlement_manager, read_only_viewer는 접근 가능하고 waiter는 `/rooms`로 redirect된다. write permission이나 mutation UI를 추가하지 않는다.
12. unit/static/e2e 테스트는 날짜 변경, 상태별 건수, 방문완료 기준 매출/정산, 마사지사1/2 담당콜, 코스별 방문완료, warning/empty/loading/error state, route access, UI 계산 재구현 금지를 검증한다.

## Tasks / Subtasks

- [x] Dashboard query service와 DTO를 추가한다 (AC: 1-7, 12)
  - [x] `src/modules/dashboard/dashboard-query-service.ts`를 추가하고 `getTodayDashboardMetrics({ operatingMonthId, serviceDate, prismaClient? })`를 export한다.
  - [x] 입력은 Zod로 검증한다. `operatingMonthId` 누락, `serviceDate` 형식 오류, 운영월 없음, 운영월 범위 밖 날짜는 한국어 domain error 또는 명시 결과로 매핑한다.
  - [x] 반환 DTO 권장 필드: `operatingMonth`, `serviceDate`, `statusCounts`, `financials`, `therapistSummary`, `courseCompletions`, `warningCounts`, `emptyState`, `sourceBasis`.
  - [x] `getDailyCallLedgerSummary()`를 재사용해 상태 수, 결제합계, 순매출, 지출, 할인, 귀케어 풀, 코스별 완료, warning counts를 가져온다.
  - [x] `listTherapistDailySettlements()`를 재사용해 마사지사 담당콜과 정산 합계를 가져온다. 정산 계산, 수당 정책 조회, 역할별 evidence를 dashboard service에서 재구현하지 않는다.
  - [x] 읽기 전용 service다. `ServiceCall`, `DailyExpense`, `MonthlyClosing`, audit log, 운영월 상태를 생성/수정/삭제하지 않는다.

- [x] `/dashboard/today` placeholder를 실제 KPI 화면으로 교체한다 (AC: 1-7, 10-11)
  - [x] `src/app/(erp)/dashboard/today/page.tsx`의 `ErpEmptyState`를 운영월 selector, 조회날짜 selector, KPI summary band, 코스별 완료 요약, 마사지사 정산 요약, warning/empty state를 가진 Server Component page로 교체한다.
  - [x] `listOperatingMonths()`, `selectedOperatingMonthFor()`, `clampDateToOperatingMonth()` 패턴을 `/live`와 `/calls`처럼 재사용한다.
  - [x] 운영월이 없으면 administrator에게 `/masters/operating-months` 이동 link를 표시하고, 다른 역할에는 생성 요청 안내만 표시한다.
  - [x] 금액은 정수 VND source 값을 한국어 천 단위 + `VND`로 표시한다. DTO 내부 source 값은 formatted string이 아니라 number를 유지한다.
  - [x] status/KPI chip은 기존 status token 의미를 보존한다. `사용중`, `예약`, `청소중`, `종료확인`, `빈방` 색상을 임의 매출/정산 series 색상으로 재사용하지 않는다.

- [x] Loading, error, empty state를 구현한다 (AC: 8-10, 12)
  - [x] `src/app/(erp)/dashboard/today/loading.tsx`를 추가하고 `src/components/ui/skeleton.tsx`를 사용해 KPI 카드, selector area, course summary, therapist summary의 윤곽을 유지한다.
  - [x] 조회 실패를 blank screen으로 두지 않는다. `src/app/(erp)/dashboard/today/error.tsx` 또는 page-local safe error boundary를 추가해 한국어 오류와 같은 query 재시도 affordance를 제공한다.
  - [x] empty state는 콜 데이터가 없는 날짜와 warning 때문에 금액 집계가 제외된 날짜를 구분한다. 전자는 데이터 없음, 후자는 정책/수당/D코스 검증 warning으로 표시한다.
  - [x] 기준 변경 중 이전 운영월/조회날짜 값과 새 기준값이 혼동되지 않게 loading copy 또는 Skeleton 영역을 사용한다.

- [x] Dashboard module 문서를 갱신한다 (AC: 6-7, 10)
  - [x] `src/modules/dashboard/README.md`에 Story 6.1 today dashboard query service contract, upstream reuse, read-only boundary, warning/empty state 규칙을 추가한다.
  - [x] `docs/modules/dashboard.md`에 구현된 DTO/화면 handoff를 반영한다.
  - [x] `_bmad-output/project-context.md`에 Story 6.1 규칙을 추가한다: today KPI는 dashboard query service가 소유하고 UI는 calls/settlements 계산을 재구현하지 않는다.

- [x] Unit tests를 추가한다 (AC: 2-7, 12)
  - [x] `src/modules/dashboard/dashboard-query-service.test.ts`를 추가한다.
  - [x] 테스트 fixture는 `getDailyCallLedgerSummary()`와 `listTherapistDailySettlements()`가 이미 검증한 세부 계산을 복제하기보다 dashboard DTO orchestration을 검증한다.
  - [x] 최소 unit cases: 예약/방문완료/노쇼/취소 counts, 비완료 금액 제외, 계산 가능한 방문완료만 금액 포함, 마사지사1/2 담당콜 합산, 같은 마사지사 양 역할 두 건 처리, A~E course completion, warning counts propagation, 날짜 범위 오류.

- [x] E2E와 static validator를 추가한다 (AC: 1, 8-12)
  - [x] `tests/e2e/story-6-1-today-dashboard.spec.ts`를 추가한다. 기존 Story 5.1 이후 E2E처럼 worker-local seed, unique sortOrder reservation, idempotent upsert/retry pattern을 사용한다.
  - [x] E2E는 administrator/counter/settlement_manager/read_only_viewer 접근과 waiter redirect를 검증한다.
  - [x] E2E는 운영월/날짜 선택, KPI 카드 값, 코스별 완료, 마사지사 정산 요약, empty state, retry/error affordance, loading UI presence를 검증한다.
  - [x] `scripts/validate-story-6-1.mjs`를 추가하고 `package.json` lint chain에서 `validate-story-5-6.mjs && node scripts/validate-story-6-1.mjs` 순서로 연결한다.
  - [x] validator는 required files, dashboard service export, `getDailyCallLedgerSummary`/`listTherapistDailySettlements` reuse, no direct Prisma mutation/audit, `/dashboard/today` route guard, loading/error files, E2E spec, docs/project-context updates, no chart dependency addition을 정적 검사한다.

## Dev Notes

- Epic 6의 목표는 주인이 오늘/월간 매출, 콜, 객실, 노쇼/취소, 마사지사 순위, 운영팀 인센 흐름을 한눈에 판단하는 것이다. Story 6.1은 그중 조회날짜 기준 today KPI만 소유하며 월간 KPI, 확정 스냅샷 조회, 그래프 리포트는 Stories 6.2-6.4 범위다. [Source: `_bmad-output/planning-artifacts/epics.md` Epic 6, Stories 6.1-6.4]
- Story 6.1 원문 AC는 조회날짜 기준 KPI, 상태별 건수, 방문완료 기준 매출, 마사지사1/2 담당콜과 정산 합계, A~E 코스별 방문완료, 원본 `오늘대시보드` 보존, loading/failure state, dashboard query service 계산을 요구한다. [Source: `_bmad-output/planning-artifacts/epics.md` Story 6.1]
- PRD FR-31은 오늘 KPI가 조회날짜 기준이며 예약건수, 방문완료 콜, 노쇼/취소, 결제합계, 마사지사 담당콜/정산 합계, 코스별 방문완료를 포함해야 한다고 정의한다. [Source: `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md` FR-31]
- Dashboard module contract는 today reservation count, completed calls, no-shows, cancellations, payment total, therapist call/settlement summary, completed calls by course를 책임진다. Dashboard는 read-only이며 core calculation은 `calls`, `settlements`, `closing`이 소유한다. [Source: `docs/modules/dashboard.md`; Source: `src/modules/dashboard/README.md`]
- Architecture는 `dashboard`가 read-only KPI queries를 소유하고, `masters -> calls -> rooms -> settlements -> closing -> dashboard` 흐름으로 데이터를 읽어야 한다고 정의한다. Dashboard route component가 `MonthlyClosing.snapshotJson`이나 call rows를 ad hoc parsing하지 않고 dashboard query DTO를 소비해야 한다. [Source: `_bmad-output/planning-artifacts/architecture.md` Architectural Boundaries, Integration Points]
- Project context 핵심 규칙: 대시보드와 TV/객실 현황 화면은 읽기 전용 조회 화면이며 정산/마감 계산을 화면 코드에서 재구현하지 않는다. `방문완료`가 아닌 상태를 매출/수당/콜인정에 포함하지 않는다. [Source: `_bmad-output/project-context.md`]
- `getDailyCallLedgerSummary()`는 이미 예약/사용중/청소중/방문완료/노쇼/취소 count, `paymentTotal`, `therapistCommissionTotal`, `earcarePoolTotal`, `discountTotal`, `expenseTotal`, `netSales`, A~E `courseSummaries`, warning counts를 반환한다. Story 6.1은 이 결과를 dashboard DTO로 감싸고 추가 정산 요약을 결합한다. [Source: `src/modules/calls/service-call-service.ts`]
- `getDailyCallLedgerSummary()`는 `calculationStatus !== "calculated"` row를 금액/코스별 집계에서 제외하고 warning counts만 올린다. 이 excludes behavior를 UI에서 바꾸거나 별도 계산으로 우회하지 않는다. [Source: `src/modules/calls/service-call-service.ts`]
- `listTherapistDailySettlements()`는 `THERAPIST_1`/`THERAPIST_2` 역할을 모두 순회하고 employee ID 기준으로 담당콜과 정산액을 집계한다. Story 6.1의 마사지사 담당콜/정산 summary는 이 service를 재사용해야 한다. [Source: `src/modules/settlements/therapist-daily-settlement-service.ts`]
- 현재 `/live`는 `getDailyCallLedgerSummary()`를 직접 호출해 오늘 상태 요약과 결제합계/순매출/코스별 완료를 표시한다. `/dashboard/today`는 이 live page의 화면 계산을 복사하지 말고 `dashboard-query-service` 뒤로 이동한 명확한 owner-facing KPI surface를 만든다. [Source: `src/app/(erp)/live/page.tsx`]
- 현재 `/dashboard/today/page.tsx`는 `requireRouteAccess("/dashboard/today")` 후 `ErpEmptyState`만 렌더링한다. Story 6.1의 핵심 변경은 이 placeholder를 실제 dashboard page로 교체하는 것이다. [Source: `src/app/(erp)/dashboard/today/page.tsx`]
- Route access는 이미 administrator, counter, settlement_manager, read_only_viewer에게 `/dashboard/today`를 허용하고 waiter에게는 허용하지 않는다. 이 story에서 read-only dashboard 접근 권한을 넓히거나 waiter sidebar 숨김 정책을 깨지 않는다. [Source: `src/lib/authorization.ts`; Source: `src/lib/navigation.ts`]
- UX design은 대시보드/KPI loading에 shadcn Skeleton을 사용하고 blank screen을 만들지 말아야 한다고 요구한다. 상태 토큰은 dashboard chips에서도 같은 hex와 의미를 유지해야 하며 색상만으로 의미를 전달하면 안 된다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md`; Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/DESIGN.md`]
- UX 접근성 리뷰는 muted/gold text contrast 이슈를 지적했다. KPI 금액의 brand gold는 큰 굵은 수치에서만 사용하고, 본문/작은 라벨은 기존 `text-muted` 또는 더 안전한 token을 사용한다. [Source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/review-accessibility.md`; Source: `src/app/globals.css`]
- Next.js App Router `loading.tsx`는 route segment가 stream되는 동안 의미 있는 loading UI를 표시하는 공식 file convention이다. Story 6.1 loading state는 이 패턴과 기존 local `Skeleton` component를 사용한다. [Source: `https://nextjs.org/docs/app/api-reference/file-conventions/loading`; Source: `https://ui.shadcn.com/docs/components/skeleton`]
- Next.js `redirect()`는 Server Component render 중 route access redirect에 사용할 수 있다. Existing `requireRouteAccess()` already depends on this behavior; Story 6.1 should keep the same authorization boundary. [Source: `https://nextjs.org/docs/app/api-reference/functions/redirect`; Source: `src/lib/authorization.ts`]

### Current State of Files Likely to Change

- `src/app/(erp)/dashboard/today/page.tsx`: 현재 empty state만 렌더링한다. 실제 KPI page로 교체한다.
- `src/app/(erp)/dashboard/today/loading.tsx`: 현재 없음. KPI Skeleton loading UI를 추가한다.
- `src/app/(erp)/dashboard/today/error.tsx`: 현재 없음. 조회 실패 retry/error state를 추가한다.
- `src/modules/dashboard/dashboard-query-service.ts`: 현재 없음. Story 6.1의 read-only DTO owner로 새로 추가한다.
- `src/modules/dashboard/dashboard-query-service.test.ts`: 새 co-located unit test.
- `src/modules/dashboard/README.md` 및 `docs/modules/dashboard.md`: today KPI 구현 contract와 boundary를 갱신한다.
- `_bmad-output/project-context.md`: Story 6.1 dashboard query service 규칙을 추가한다.
- `tests/e2e/story-6-1-today-dashboard.spec.ts`: 새 Playwright spec.
- `scripts/validate-story-6-1.mjs`: 새 static validator.
- `package.json`: lint chain에 Story 6.1 validator를 추가한다.

### Architecture Compliance

- `dashboard`는 read-only query orchestration만 소유한다. 결제/수당/할인/코스/담당자 계산 규칙은 `calls`와 `settlements` services가 계속 소유한다.
- `/dashboard/today`는 Server Component 중심으로 구현하고 URL search params를 selection state로 사용한다. Redux/Zustand/TanStack Query를 새로 도입하지 않는다.
- 새 chart library를 추가하지 않는다. Story 6.1은 KPI cards, summary bands, compact tables로 충분하다. 차트/그래프 dependency 결정은 Story 6.3/6.4에서 다룬다.
- Stable identifiers는 `OperatingMonth.id`, `Employee.id`, `Course.code`/`Course.id`를 사용한다. 직원명, 코스명, Excel row/cell을 downstream key로 쓰지 않는다.
- Dashboard는 mutation UI, Server Action, audit event 생성, monthly close snapshot 생성/수정, payout-impacting write를 만들지 않는다.
- `shared`에 helper를 추가하려면 다중 caller가 실제로 있어야 한다. 단일 formatting/helper는 page/service local로 둔다.

### Previous Story / Git Intelligence

- Epic 6의 첫 story이므로 같은 epic의 이전 story artifact는 없다. create-story 단계에서 `epic-6`은 `backlog`에서 `in-progress`로 전환된다.
- Story 5.6 완료 후 최신 retrospective commit `c02e46f`가 dashboard docs와 project context를 갱신했다. Story 6.1은 이 최신 dashboard module boundary를 기준으로 진행한다. [Source: `git log --oneline -5`; Source: `docs/modules/dashboard.md`]
- Story 5.1 이후 E2E fixture는 Playwright `fullyParallel: true`에서 worker-local data와 sortOrder reservation을 사용해야 한다는 학습이 있다. Story 6.1 E2E도 고정 account/month/employee/code/room sortOrder를 공유하지 않는다. [Source: `_bmad-output/implementation-artifacts/5-1-월마감-미리보기-집계.md` Senior Developer Review]
- Story 5.6 최종 검증에서 project-wide `npx tsc --noEmit`은 기존 call-ledger keyboard tests, Prisma ambient enum, older E2E typing 문제로 깨질 수 있음이 기록되어 있다. Story 6.1 구현자는 새 dashboard 파일에 TypeScript diagnostic을 추가하지 않도록 targeted check를 병행한다. [Source: `_bmad-output/implementation-artifacts/5-6-월마감-이중확인-모달과-접근성.md` Debug Log References]
- 현재 worktree에는 pre-existing unrelated 변경 `_bmad-output/story-automator/orchestration-1-20260607-165702.md`가 있다. Story 6.1 구현자는 이 파일을 만지거나 되돌리지 않는다. [Source: `git status --short`]

### Latest Technical Information

- Repo-pinned versions at story creation: Next.js `16.2.7`, React `19.2.7`, Prisma `7.8.0`, Zod `4.1.12`, Playwright `1.60.0`, shadcn `4.10.0`, Tailwind CSS `4.3.0`, TypeScript `5.9.3`. [Source: `package.json`]
- Next.js `loading.tsx` is the current App Router convention for route-segment loading UI and can render lightweight Skeletons while server content streams. [Source: `https://nextjs.org/docs/app/api-reference/file-conventions/loading`]
- shadcn Skeleton is the existing component pattern for placeholder UI while content loads; the repo already has `src/components/ui/skeleton.tsx`, so do not add another skeleton dependency. [Source: `https://ui.shadcn.com/docs/components/skeleton`; Source: `src/components/ui/skeleton.tsx`]
- Next.js `redirect()` is valid during Server Component rendering and underpins the existing `requireRouteAccess()` redirect behavior. [Source: `https://nextjs.org/docs/app/api-reference/functions/redirect`]

### Testing Standards Summary

- Unit tests use `node --import tsx --test src/**/*.test.ts`; run targeted dashboard service tests and then the full explicit `rg` test list if shell glob behavior is unreliable.
- E2E tests use Playwright under `tests/e2e/story-*.spec.ts`; seed must be worker-local/idempotent because project config can run tests fully parallel.
- Static validators are part of `npm run lint`; Story 6.1 validator should fail if UI calculates KPI totals directly instead of consuming dashboard DTO.
- Minimum validation commands:
  - `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts`
  - `node scripts/validate-story-6-1.mjs`
  - `npm run lint`
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-1-today-dashboard.spec.ts`
  - If DB/dev server is available: `npx playwright test tests/e2e/story-6-1-today-dashboard.spec.ts`

### References

- Story source: `_bmad-output/planning-artifacts/epics.md` Story 6.1
- Epic source: `_bmad-output/planning-artifacts/epics.md` Epic 6, Stories 6.1-6.4
- PRD source: `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md` FR-3, FR-31, NFR3, SM-6, SM-C2
- UX source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md`, `DESIGN.md`, `review-accessibility.md`, `validation-report.md`
- Architecture source: `_bmad-output/planning-artifacts/architecture.md` Frontend Architecture, Architectural Boundaries, Integration Points
- Dashboard module docs: `docs/modules/dashboard.md`, `src/modules/dashboard/README.md`
- Project context: `_bmad-output/project-context.md`
- Current code sources: `src/app/(erp)/dashboard/today/page.tsx`, `src/app/(erp)/live/page.tsx`, `src/modules/calls/service-call-service.ts`, `src/modules/settlements/therapist-daily-settlement-service.ts`, `src/lib/authorization.ts`, `src/lib/navigation.ts`, `src/components/ui/skeleton.tsx`, `src/app/globals.css`, `package.json`
- External docs checked: Next.js `loading.tsx`, Next.js `redirect`, shadcn Skeleton

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Create-story workflow activation on 2026-06-10: `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow` failed because local Python lacks `tomllib`; customization resolved manually from `.agents/skills/bmad-create-story/customize.toml`.
- Activation customization: prepend/append steps were empty; persistent fact loaded from `_bmad-output/project-context.md`; `on_complete = ""`.
- Config resolved from `_bmad/bmm/config.yaml`: user `noah`, project `vietnam_aesthetic`, communication/document language Korean, implementation artifacts `_bmad-output/implementation-artifacts`.
- Required skill files loaded in order: `.agents/skills/bmad-create-story/SKILL.md`, `.agents/skills/bmad-create-story/discover-inputs.md`, `.agents/skills/bmad-create-story/template.md`, `.agents/skills/bmad-create-story/checklist.md`.
- Discovery results: `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`; `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`; `{prd_content}` from `_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md` and related PRD shards found by dashboard/KPI search; `{ux_content}` from `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_aesthetic-2026-06-07/EXPERIENCE.md`, `DESIGN.md`, `review-accessibility.md`, `validation-report.md` search hits; persistent facts from `_bmad-output/project-context.md`.
- Story target: user explicitly requested Story 6.1. Sprint status key matched `6-1-오늘-kpi-대시보드: backlog`.
- Epic transition: Story 6.1 is the first story in Epic 6; `epic-6` moved from `backlog` to `in-progress`.
- Previous story intelligence: no previous story exists in Epic 6. Relevant previous implementation learnings were taken from Story 5.1 E2E parallel-fixture review and Story 5.6 validation notes.
- Current code inspected: `src/app/(erp)/dashboard/today/page.tsx`, `src/app/(erp)/live/page.tsx`, `src/app/(erp)/calls/page.tsx`, `src/modules/dashboard/README.md`, `docs/modules/dashboard.md`, `src/modules/calls/service-call-service.ts`, `src/modules/settlements/therapist-daily-settlement-service.ts`, `src/lib/authorization.ts`, `src/lib/navigation.ts`, `src/components/domain/status-badge.tsx`, `src/components/ui/skeleton.tsx`, `src/app/globals.css`, `prisma/schema.prisma`, `package.json`.
- Git intelligence: latest commits show Epic 5 retrospective/docs (`c02e46f`), Story 5.6, Story 5.5, Story 5.4, Story 5.3 sequence; dashboard docs changed in the latest commit.
- Web research: official Next.js `loading.tsx`, Next.js `redirect`, and shadcn Skeleton docs checked for current framework specifics.
- Validation checklist applied during create-story: source requirements, architecture guardrails, existing code read, code reuse opportunities, exact file locations, route access, loading/error/empty state, E2E parallel fixture risk, latest official docs, and LLM-dev ambiguity prevention.
- Completion hook check: manual customization fallback showed no final hook.
- Dev-story activation on 2026-06-10: `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-dev-story --key workflow` failed because local Python lacks `tomllib`; customization resolved manually from `.agents/skills/bmad-dev-story/customize.toml`. Prepend/append steps were empty; persistent fact loaded from `_bmad-output/project-context.md`; config loaded from `_bmad/bmm/config.yaml`.
- Story marked in-progress in story file and sprint status at `2026-06-10T16:43:34+0900`; existing `baseline_commit: c02e46f` preserved.
- TDD RED: `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` failed with `Cannot find module '@/modules/dashboard/dashboard-query-service'` before service implementation.
- TDD GREEN: `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` passed after adding `getTodayDashboardMetrics()` and correcting fixture expectations to existing discount/settlement contracts.
- Static validation: `node scripts/validate-story-6-1.mjs` passed.
- Lint chain: `npm run lint` passed all Story 1.1 through Story 6.1 validators.
- Unit validation: `npm run test:unit` passed the shell-expanded subset; explicit `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` passed 151 tests / 20 suites.
- E2E static/list validation: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-1-today-dashboard.spec.ts` listed 9 tests successfully.
- Full E2E attempt: `npx playwright test tests/e2e/story-6-1-today-dashboard.spec.ts` started the webServer but was blocked in seed setup by Prisma `ECONNREFUSED` on `Employee`; a direct Prisma probe against `DATABASE_URL` reproduced `code: "ECONNREFUSED"` for `employee.findUnique()`/`employee.findFirst()`.
- Build attempt: `npm run build` was blocked by Turbopack sandbox failure while processing `src/app/globals.css`, also caused by `binding to a port - Operation not permitted`.
- TypeScript diagnostic: `npx tsc --noEmit --pretty false` still fails on pre-existing call-ledger keyboard test typing, Prisma ambient const enum, and older E2E `getByDisplayValue` issues; no Story 6.1 file path remains in the output after switching the new E2E spec to numeric Argon2id option.
- Whitespace validation: `git diff --check` passed.
- Senior developer review on 2026-06-10: loaded story-automator review workflow/checklist, story file, config, project context, planning references, changed-file inventory, and Story 6.1 source/test files.
- Review doc fallback: official Next.js `loading.tsx`, Next.js `redirect`, and shadcn Skeleton docs rechecked during senior review.
- Review fixes: canonical `/dashboard/today` search params redirect, safe Korean error message without raw `error.message`, per-course accessible E2E assertions, Story File List/test count documentation.
- Review validation: `git diff --check`, `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts`, `node scripts/validate-story-6-1.mjs`, `npm run lint`, `node --import tsx --test $(rg --files src | rg '\.test\.ts$')`, and `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-1-today-dashboard.spec.ts` passed.
- Final full E2E attempt after review fixes: `npx playwright test tests/e2e/story-6-1-today-dashboard.spec.ts` remains blocked by Prisma `ECONNREFUSED` on `Employee` during seed setup, matching the direct Prisma connectivity probe.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 6.1 is scoped as a read-only today KPI dashboard. It must not introduce chart libraries, mutation actions, audit writes, or monthly snapshot logic.
- The main implementation risk is duplicating `/live` or `calls` calculations in `/dashboard/today`; this story requires a `dashboard-query-service` DTO and explicit reuse of `getDailyCallLedgerSummary()` plus `listTherapistDailySettlements()`.
- The existing `/dashboard/today` route is a placeholder, so the story names the exact files needed for service, page, loading/error states, docs, tests, and validator.
- Story validation should make UI calculation reinvention and missing loading/error/empty states hard to miss.
- Implemented read-only `getTodayDashboardMetrics()` DTO orchestration with Zod input validation and Korean `DashboardQueryDomainError` mappings for invalid query, missing operating month, and date range violations.
- Replaced `/dashboard/today` placeholder with Server Component UI using operating month/date search params, KPI bands, A-E course completion summary, therapist assigned-call/settlement table, warning state, and no-call empty state.
- Added route segment `loading.tsx` Skeleton layout and client `error.tsx` retry affordance with `role="alert"`.
- Added Story 6.1 unit test, Playwright E2E spec, static validator, lint chain entry, dashboard docs, and project-context rules.
- Senior developer review auto-fixed URL/server-data canonicalization, safe error copy, course-summary E2E specificity, and File List/test-summary drift.
- Validation caveat: actual Playwright/browser execution and Next build could not complete in this sandbox because local server/process binding is denied with `EPERM`; static/list/unit/lint validation passed.

### File List

- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `docs/modules/dashboard.md`
- `package.json`
- `scripts/validate-story-6-1.mjs`
- `src/app/(erp)/dashboard/today/error.tsx`
- `src/app/(erp)/dashboard/today/loading.tsx`
- `src/app/(erp)/dashboard/today/page.tsx`
- `src/modules/dashboard/README.md`
- `src/modules/dashboard/dashboard-query-service.test.ts`
- `src/modules/dashboard/dashboard-query-service.ts`
- `tests/e2e/story-6-1-today-dashboard.spec.ts`

### Senior Developer Review (AI)

Reviewer: GPT-5 Codex on 2026-06-10

Outcome: Changes Requested initially; all confirmed HIGH/MEDIUM review issues were auto-fixed. No CRITICAL issues remain.

Findings fixed:

- [HIGH][AC 1] `/dashboard/today` could compute server data from a clamped/default operating month or service date while leaving stale or missing URL search params visible. Fixed by redirecting to canonical `operatingMonthId` and `serviceDate` before loading metrics.
- [HIGH][AC 9] `error.tsx` rendered raw `error.message`, which could expose non-Korean/internal server errors instead of a safe Korean failure message. Fixed by showing only safe Korean copy with retry/refresh affordances.
- [MEDIUM][AC 12] The E2E course-summary assertion searched the whole course region for `담당 2건`, so it could pass against the wrong course tile. Fixed by adding per-course accessible labels and asserting B/D course tiles directly.
- [MEDIUM] Git changed `_bmad-output/implementation-artifacts/tests/test-summary.md`, but the story File List did not document it; the story also recorded 8 listed E2E tests while the spec has 9. Fixed the File List and debug log.

Review validation checklist:

- [x] Story file loaded from `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`
- [x] Story Status verified as reviewable (`review`)
- [x] Epic and Story IDs resolved (`6.1`)
- [x] Story context and architecture/standards references loaded from story Dev Notes and project context
- [x] Tech stack detected from `package.json`
- [x] External references checked via web fallback: official Next.js `loading.tsx`, Next.js `redirect`, shadcn Skeleton
- [x] Acceptance Criteria cross-checked against implementation
- [x] File List reviewed and corrected for completeness
- [x] Tests identified and mapped to ACs; assertion specificity gap fixed
- [x] Code quality and security review performed on changed source files
- [x] Outcome decided: auto-fixed and ready for done after validation

## Change Log

- 2026-06-10: Implemented Story 6.1 today KPI dashboard, read-only dashboard query DTO, loading/error/empty states, tests, static validator, and dashboard documentation.
- 2026-06-10: Senior developer review auto-fixed URL canonicalization, safe error messaging, course E2E targeting, and story File List drift.
