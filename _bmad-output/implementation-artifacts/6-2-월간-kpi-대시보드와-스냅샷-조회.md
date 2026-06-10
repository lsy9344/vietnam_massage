---
baseline_commit: a263499
---

# Story 6.2: 월간 KPI 대시보드와 스냅샷 조회

Status: done

<!-- Note: Validation completed during create-story. -->

## Story

As a 주인/관리자,
I want 운영월 기준 월간 KPI와 마감 후 스냅샷 값을 확인하기를,
so that 월 전체 운영 흐름과 확정된 지급/매출 기준을 안정적으로 볼 수 있다.

## Acceptance Criteria

1. 주인 또는 관리자가 `/dashboard/monthly`에 접근해 운영월을 선택하면 해당 운영월 기준 월간 KPI가 조회된다. 운영월 선택값은 URL search params에 유지되어 새로고침/공유 링크에서도 같은 월을 다시 조회한다.
2. 월간 집계는 Excel 행 범위가 아니라 `OperatingMonth.startDate`~`endDate` 날짜 조건과 `operatingMonthId`를 기준으로 계산한다.
3. 월간 KPI는 월 방문완료 콜, 예약건수, 사용중, 청소중, 노쇼, 취소, 방문완료 매출을 표시한다. 매출/금액 지표는 `방문완료`/`VISIT_COMPLETE` 중 `calculationStatus === "calculated"`인 콜만 포함하고 비완료/정책누락/수당누락/D코스 검증 제외 row는 warning으로 드러낸다.
4. `작성중` 또는 `검토중` 운영월은 현재 콜 원장과 현재 정책 기준의 최신 집계로 표시하고, 화면에 `미확정 현재 기준`임을 명확히 표시한다.
5. `마감확정` 또는 `잠금` 운영월은 `getMonthlyClosingSnapshot()`의 latest `MonthlyClosing` snapshot을 지급/정산 기준 값의 우선 source로 사용하고, 화면에 `확정 스냅샷 기준`과 `closeVersion`, `confirmedAt`을 표시한다.
6. 마감확정/잠금 월에서 snapshot이 없거나 형식이 부족하면 현재 재계산값으로 조용히 fallback하지 않는다. 별도 `확정 스냅샷을 찾을 수 없습니다` 상태와 안전한 한국어 안내를 표시한다.
7. 재오픈되어 `검토중`으로 돌아온 운영월은 현재 editable truth를 `미확정 현재 기준`으로 표시한다. 이전 snapshot이 있더라도 현재 KPI source로 섞지 않고, 필요한 경우 `이전 확정 스냅샷` 참고 정보로만 분리한다.
8. 오늘 KPI와 월간 KPI가 같은 운영월에 있어도 계산 기준은 충돌하지 않는다. `/dashboard/today`는 조회날짜 기준이고 `/dashboard/monthly`는 운영월 전체 날짜 범위 기준이다.
9. `/dashboard/monthly`는 dashboard query DTO를 소비한다. route/page/UI component가 콜, 결제, 수당, 월마감 snapshot JSON parsing, 코스별 집계, therapist evidence 계산을 직접 재구현하지 않는다.
10. 월간 KPI loading 중에는 `src/app/(erp)/dashboard/monthly/loading.tsx` 또는 동등한 shadcn Skeleton 기반 UI가 레이아웃 윤곽을 유지하고 blank screen을 만들지 않는다.
11. 월간 KPI 조회 실패 시 raw server error를 노출하지 않고 안전한 한국어 오류 메시지, retry affordance, `role="alert"` 또는 동등한 live semantics를 제공한다.
12. 접근 권한은 대시보드 read-only 정책을 따른다. administrator는 접근 가능하고 waiter는 `/rooms`로 redirect된다. counter/settlement_manager/read_only_viewer 허용 여부는 현재 `/dashboard/today` 정책을 기준으로 명시적으로 결정해 `authorization.ts`, `navigation.ts`, E2E에 반영한다. mutation UI, Server Action, audit write는 추가하지 않는다.
13. unit/static/e2e 테스트는 운영월 URL 유지, 날짜 범위 집계, 방문완료 기준 매출, warning propagation, 미확정/current 표시, 확정 snapshot 표시, snapshot missing 상태, 재오픈 `검토중` source 분리, loading/error state, route access, UI 계산 재구현 금지를 검증한다.

## Tasks / Subtasks

- [x] 월간 dashboard query DTO를 추가한다 (AC: 1-9, 13)
  - [x] `src/modules/dashboard/dashboard-query-service.ts`에 `getMonthlyDashboardMetrics({ operatingMonthId, prismaClient? })`와 `MonthlyDashboardMetricsDto`를 추가한다.
  - [x] 입력은 Zod로 검증하고 `DashboardQueryDomainError`를 재사용/확장한다. 누락/잘못된 운영월은 안전한 한국어 domain error로 매핑한다.
  - [x] `OperatingMonth`를 조회해 `id`, `monthKey`, `startDate`, `endDate`, `status`를 DTO에 포함한다.
  - [x] DTO 권장 필드: `operatingMonth`, `sourceBasis`, `statusCounts`, `financials`, `courseCompletions`, `warningCounts`, `snapshot`, `emptyState`.
  - [x] `sourceBasis.kind`는 최소 `current_recalculation`, `closed_snapshot`, `snapshot_missing`을 구분한다. `마감확정`/`잠금`에서 snapshot 없이 current로 fallback하지 않는다.
  - [x] 월간 상태/매출 집계는 `listServiceCallsForOperatingMonth()` 또는 `getDailyCallLedgerSummary()` 날짜 범위 반복 중 하나를 dashboard service 내부에서 사용한다. UI route에서 직접 row를 읽거나 계산하지 않는다.
  - [x] 월간 `paymentTotal`/`discountTotal`/`courseCompletions`는 `calculationStatus === "calculated"` 완료 콜만 포함한다. 제외 row는 `warningCounts`로 누적한다.
  - [x] 지급/정산 summary는 `작성중`/`검토중`에서는 `listMonthlyClosingPreview()` current preview를 사용할 수 있고, `마감확정`/`잠금`에서는 `getMonthlyClosingSnapshot()` latest snapshot을 우선 사용한다.
  - [x] `MonthlyClosing.snapshotJson`은 route/page에서 직접 parse하지 않는다. snapshot mapping은 dashboard service 또는 closing adapter 내부에 둔다.
  - [x] 읽기 전용 service다. `ServiceCall`, `DailyExpense`, `MonthlyClosing`, `AuditLog`, `OperatingMonth`를 create/update/delete/upsert하지 않는다.

- [x] `/dashboard/monthly` route를 구현한다 (AC: 1, 4-12)
  - [x] `src/app/(erp)/dashboard/monthly/page.tsx`를 새로 추가한다.
  - [x] `requireRouteAccess("/dashboard/monthly")`를 사용하고, 선택 운영월은 `listOperatingMonths()` + `selectedOperatingMonthFor()` 패턴을 `/dashboard/today`처럼 재사용한다.
  - [x] 운영월 search param이 없거나 canonical id와 다르면 `redirect()`로 `/dashboard/monthly?operatingMonthId=...`를 정규화한다.
  - [x] 운영월이 없으면 administrator에게 `/masters/operating-months` link를, 다른 역할에는 관리자 요청 안내를 표시한다.
  - [x] 화면은 월간 상태 건수, 방문완료 매출/할인/정산 또는 지급 요약, A~E 코스별 완료, warning/empty/snapshot-missing 상태를 표시한다.
  - [x] `미확정 현재 기준`, `확정 스냅샷 기준`, `이전 확정 스냅샷` label을 sourceBasis에 따라 분리한다.
  - [x] `StatusBadge`/기존 status token 의미를 유지한다. 매출/정산 series 색상으로 객실 상태 색상을 임의 재사용하지 않는다.
  - [x] today page의 formatting/helper는 복사하더라도 계산 로직은 복사하지 않는다. 필요 시 formatting만 route-local helper로 둔다.

- [x] 권한과 navigation을 명시적으로 갱신한다 (AC: 12-13)
  - [x] `src/lib/authorization.ts`에 `/dashboard/monthly` 접근 정책을 추가한다.
  - [x] `src/lib/navigation.ts` 대시보드 그룹에 `월간 대시보드` 항목을 추가한다.
  - [x] 권한 결정은 payout/snapshot 민감도를 고려한다. 최소 administrator는 허용, waiter는 금지한다. counter/settlement_manager/read_only_viewer 허용 여부는 Story 6.1 today policy와 제품 의도를 맞춰 테스트에 고정한다.
  - [x] 권한 없는 그룹/항목은 disabled가 아니라 렌더링하지 않는다.

- [x] Loading, error, empty, snapshot-missing state를 구현한다 (AC: 6-7, 10-11, 13)
  - [x] `src/app/(erp)/dashboard/monthly/loading.tsx`를 추가하고 기존 `src/components/ui/skeleton.tsx`를 사용한다.
  - [x] `src/app/(erp)/dashboard/monthly/error.tsx` 또는 page-local error boundary를 추가해 raw `error.message`를 사용자에게 노출하지 않는다.
  - [x] empty state는 월 전체 콜이 없는 경우와 warning 때문에 금액/코스 집계가 제외된 경우를 구분한다.
  - [x] snapshot missing은 일반 empty/error와 분리해 `마감확정/잠금 상태이지만 확정 스냅샷을 찾을 수 없습니다` 의미를 전달한다.

- [x] Dashboard 문서와 프로젝트 컨텍스트를 갱신한다 (AC: 4-9, 12)
  - [x] `src/modules/dashboard/README.md`에 Story 6.2 월간 DTO, sourceBasis, snapshot 우선순위, fallback 금지 규칙을 추가한다.
  - [x] `docs/modules/dashboard.md`에 `/dashboard/monthly` handoff와 closed/reopened month semantics를 반영한다.
  - [x] `_bmad-output/project-context.md`에 Story 6.2 규칙을 추가한다: 월간 KPI는 dashboard query service가 소유하고, `마감확정`/`잠금` 지급/정산 값은 latest closing snapshot을 우선한다.

- [x] Unit/static/E2E 테스트를 추가한다 (AC: 1-13)
  - [x] `src/modules/dashboard/dashboard-query-service.test.ts`에 monthly tests를 추가하거나 `dashboard-monthly-query-service.test.ts`를 co-locate한다.
  - [x] Unit tests: date range aggregation, completed-only sales, warning accumulation, draft/current source, closed snapshot source, snapshot missing state, reopened `검토중` current source, invalid input.
  - [x] `tests/e2e/story-6-2-monthly-dashboard.spec.ts`를 추가한다. Story 6.1 E2E처럼 worker-local month/account/room/employee/course data와 idempotent upsert/retry pattern을 사용한다.
  - [x] E2E는 운영월 selection URL 유지, KPI values, sourceBasis labels, snapshot-missing UI, loading/error presence, allowed role access, waiter redirect를 검증한다.
  - [x] `scripts/validate-story-6-2.mjs`를 추가하고 `package.json` lint chain에서 `validate-story-6-1.mjs && node scripts/validate-story-6-2.mjs` 순서로 연결한다.
  - [x] Static validator는 required files, `getMonthlyDashboardMetrics` export, no route-level calculation, no direct snapshot JSON parsing in page, read-only service, route access/nav updates, loading/error files, docs/project-context updates, no chart dependency addition을 검사한다.

## Dev Notes

- Epic 6 목표는 주인이 오늘/월간 매출, 콜, 객실, 노쇼/취소, 마사지사 순위, 운영팀 인센 흐름을 한눈에 판단하는 것이다. Story 6.2는 월간 KPI와 마감 후 snapshot 기준 조회만 소유하며 그래프 리포트와 차트 색상/로딩 통합 규칙은 Stories 6.3-6.4 범위다. [Source: `_bmad-output/planning-artifacts/epics.md` Epic 6, Stories 6.2-6.4]
- Story 6.2 원문 AC는 운영월 기준 조회, Excel 행 범위 금지, 방문완료 매출, 미확정 current 기준, 확정/잠금 snapshot 기준, URL param 유지, loading/failure state, dashboard query service 계산을 요구한다. [Source: `_bmad-output/planning-artifacts/epics.md` Story 6.2]
- Architecture는 `dashboard`가 read-only KPI queries를 소유하고, `masters -> calls -> rooms -> settlements -> closing -> dashboard` 흐름으로 데이터를 읽어야 한다고 정의한다. [Source: `_bmad-output/planning-artifacts/architecture.md` Architectural Boundaries, Integration Points]
- Dashboard docs는 monthly completed calls, monthly reservations/no-shows/cancellations/sales, monthly close payout snapshot summaries를 dashboard 책임으로 정의한다. [Source: `docs/modules/dashboard.md`; Source: `src/modules/dashboard/README.md`]
- Project context 핵심 규칙: 대시보드 화면은 읽기 전용 조회 화면이며 정산/마감 계산을 화면 코드에서 재구현하지 않는다. `방문완료`가 아닌 상태를 매출/수당/콜인정에 포함하지 않는다. [Source: `_bmad-output/project-context.md`]
- Story 5.3/5.5 기준 `MonthlyClosing`은 versioned snapshot row를 보존한다. 최신 snapshot 조회는 `operatingMonthId + closeVersion desc` 기준이며 이전 snapshot을 update/delete하지 않는다. [Source: `_bmad-output/project-context.md`; Source: `src/modules/closing/monthly-closing-service.ts`]
- `getMonthlyClosingSnapshot()`은 latest `MonthlyClosing` record를 반환하고 snapshot이 없으면 `MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND`를 던진다. Story 6.2 dashboard service는 이 error를 `snapshot_missing` DTO 또는 안전한 dashboard domain error로 매핑해야 한다. [Source: `src/modules/closing/monthly-closing-service.ts`]
- `listMonthlyClosingPreview()`는 `MonthlyClosingPreviewDto`로 therapist/operations/earcare/totals/warning/evidence를 반환하며 `previewStatus`는 `draft_current` 또는 `closed_current`다. Story 6.2에서 closed/locked 화면의 지급/정산 기준값은 current preview가 아니라 latest snapshot을 우선해야 한다. [Source: `src/modules/closing/monthly-closing-preview-service.ts`]
- `listServiceCallsForOperatingMonth()`는 `operatingMonthId`, `startDate`, `endDate`로 월 범위 콜 row DTO를 조회한다. 월간 status count와 completed-only payment/course count는 이 DTO 또는 daily summary reuse를 dashboard service에서 집계한다. [Source: `src/modules/calls/service-call-service.ts`]
- `getDailyCallLedgerSummary()`는 `calculationStatus !== "calculated"` row를 금액/코스별 집계에서 제외하고 warning counts만 올린다. 월간 service가 daily summary 반복 방식을 선택한다면 이 제외/경고 semantics를 그대로 누적한다. [Source: `src/modules/calls/service-call-service.ts`]
- Story 6.1 기준 `getTodayDashboardMetrics()`는 dashboard DTO owner다. Story 6.2는 같은 파일/패턴을 확장하되 today DTO를 깨지 않아야 한다. [Source: `src/modules/dashboard/dashboard-query-service.ts`; Source: `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`]
- 현재 `/dashboard/monthly/page.tsx`는 존재하지 않는다. Story 6.2는 새 route를 생성해야 하며, today page를 변경해 월간 기능을 끼워 넣으면 안 된다. [Source: `find src/app -path '*dashboard*'`]
- 현재 `authorization.ts`와 `navigation.ts`는 `/dashboard/today`만 비관리자 dashboard 접근과 sidebar에 등록한다. Story 6.2는 `/dashboard/monthly`의 접근/노출 정책을 테스트로 고정해야 한다. [Source: `src/lib/authorization.ts`; Source: `src/lib/navigation.ts`]
- Current repo-pinned versions: Next.js `16.2.7`, React `19.2.7`, Prisma `7.8.0`, Zod `4.1.12`, Playwright `1.60.0`, shadcn `4.10.0`, Tailwind CSS `4.3.0`, TypeScript `5.9.3`. [Source: `package.json`]
- Next.js App Router `loading.tsx`는 route segment가 stream되는 동안 lightweight loading UI를 표시하는 file convention이다. Story 6.2 monthly loading은 이 패턴과 기존 local Skeleton component를 사용한다. [Source: `https://nextjs.org/docs/app/api-reference/file-conventions/loading`; Source: `src/components/ui/skeleton.tsx`]
- Next.js `redirect()`는 Server Component render 중 canonical search param redirect에 사용할 수 있다. Story 6.2는 today page와 같은 URL canonicalization 방식으로 선택 운영월을 고정한다. [Source: `https://nextjs.org/docs/app/api-reference/functions/redirect`; Source: `src/app/(erp)/dashboard/today/page.tsx`]
- shadcn Skeleton은 content loading 중 placeholder를 보여주는 기존 UI primitive다. Story 6.2에서 별도 skeleton dependency를 추가하지 않는다. [Source: `https://ui.shadcn.com/docs/components/skeleton`; Source: `src/components/ui/skeleton.tsx`]

### Current State of Files Likely to Change

- `src/modules/dashboard/dashboard-query-service.ts`: 현재 `getTodayDashboardMetrics()`만 있다. `getMonthlyDashboardMetrics()`와 monthly DTO/sourceBasis를 추가한다.
- `src/modules/dashboard/dashboard-query-service.test.ts`: 현재 today DTO tests만 있다. monthly tests를 추가하거나 separate monthly test file을 만든다.
- `src/app/(erp)/dashboard/monthly/page.tsx`: 현재 없음. 새 monthly page.
- `src/app/(erp)/dashboard/monthly/loading.tsx`: 현재 없음. monthly Skeleton loading UI.
- `src/app/(erp)/dashboard/monthly/error.tsx`: 현재 없음. 안전한 한국어 error/retry UI.
- `src/lib/authorization.ts`: `/dashboard/monthly` route prefix/role access 추가 필요.
- `src/lib/navigation.ts`: 대시보드 그룹에 `월간 대시보드` 항목 추가 필요.
- `src/modules/dashboard/README.md` 및 `docs/modules/dashboard.md`: monthly dashboard contract와 snapshot semantics 갱신.
- `_bmad-output/project-context.md`: Story 6.2 dashboard/monthly snapshot 규칙 추가.
- `tests/e2e/story-6-2-monthly-dashboard.spec.ts`: 새 Playwright spec.
- `scripts/validate-story-6-2.mjs`: 새 static validator.
- `package.json`: lint chain에 Story 6.2 validator 추가.

### Architecture Compliance

- `dashboard`는 read-only query orchestration만 소유한다. 결제/수당/할인/코스/담당자/월마감 확정 로직은 `calls`, `settlements`, `closing` services가 계속 소유한다.
- `/dashboard/monthly`는 Server Component 중심으로 구현하고 URL search params를 selection state로 사용한다. Redux/Zustand/TanStack Query를 새로 도입하지 않는다.
- 새 chart library를 추가하지 않는다. Story 6.2는 KPI cards, summary bands, compact tables로 충분하다. 차트/그래프 dependency 결정은 Story 6.3/6.4에서 다룬다.
- Stable identifiers는 `OperatingMonth.id`, `Employee.id`, `Course.code`/`Course.id`, `MonthlyClosing.id`/`closeVersion`을 사용한다. 직원명, 코스명, Excel row/cell을 downstream key로 쓰지 않는다.
- Dashboard는 mutation UI, Server Action, audit event 생성, monthly close snapshot 생성/수정, payout-impacting write를 만들지 않는다.
- `마감확정`/`잠금` month의 지급/정산 값은 latest snapshot을 우선하고 current recalculation과 섞지 않는다. Missing snapshot은 distinct state다.
- `shared`에 helper를 추가하려면 다중 caller가 실제로 있어야 한다. 단일 formatting/helper는 page/service local로 둔다.

### Previous Story / Git Intelligence

- Story 6.1은 `src/modules/dashboard/dashboard-query-service.ts`를 추가하고 `/dashboard/today`가 DTO를 소비하도록 구현했다. 6.2는 이 패턴을 확장하되 today route와 today tests를 회귀시키지 않는다. [Source: `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`; Source: `git log --oneline -5`]
- Story 6.1 senior review에서 URL search params canonicalization, raw server error 노출 금지, E2E assertion specificity, File List/test-summary drift가 수정되었다. Story 6.2는 처음부터 monthly canonical redirect, safe error copy, per-section E2E assertions, File List 정확성을 포함한다. [Source: `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md` Senior Developer Review]
- Story 6.1 E2E는 Playwright `fullyParallel` 환경에서 worker-local month/account/employee/room data와 sortOrder reservation을 사용했다. Story 6.2 E2E도 같은 패턴을 사용하고 shared fixed seed를 오염시키지 않는다. [Source: `tests/e2e/story-6-1-today-dashboard.spec.ts`]
- Story 6.1 validation caveat: full Playwright/browser execution은 Prisma `ECONNREFUSED`, build는 Turbopack port binding sandbox 이슈로 막힐 수 있다. Story 6.2 구현자는 unit/static/list validation을 먼저 통과시키고, DB/dev server 가능 환경에서 full E2E를 실행한다. [Source: `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md` Debug Log References]
- Current git HEAD before story creation: `a263499 feat(story-6.1): 오늘 KPI 대시보드`. Recent commits show Story 6.1, Epic 5 retrospective, Stories 5.6-5.4 sequence. [Source: `git log --oneline -5`]
- Current worktree has a pre-existing unrelated modified file `_bmad-output/story-automator/orchestration-1-20260607-165702.md`; do not touch or revert it. [Source: `git status --short`]

### Latest Technical Information

- Repo-pinned stack at story creation: Next.js `16.2.7`, React `19.2.7`, Prisma `7.8.0`, Zod `4.1.12`, Playwright `1.60.0`, shadcn `4.10.0`, Tailwind CSS `4.3.0`, TypeScript `5.9.3`. [Source: `package.json`]
- Next.js official docs list latest docs version `16.2.2` and confirm `loading.tsx`/`loading.js` is the App Router route segment convention for meaningful loading UI while route content streams. Use the repo-pinned `next@16.2.7`; do not upgrade during this story. [Source: `https://nextjs.org/docs/app/api-reference/file-conventions/loading`; Source: `package.json`]
- Next.js official docs state `redirect()` can be used during Server Component rendering and terminates the route segment. This matches the existing Story 6.1 canonical URL pattern. [Source: `https://nextjs.org/docs/app/api-reference/functions/redirect`; Source: `src/app/(erp)/dashboard/today/page.tsx`]
- shadcn Skeleton docs define Skeleton as a placeholder while content loads. The repo already has `src/components/ui/skeleton.tsx`; do not add another loading library. [Source: `https://ui.shadcn.com/docs/components/skeleton`; Source: `src/components/ui/skeleton.tsx`]

### Testing Standards Summary

- Unit tests use `node --import tsx --test src/**/*.test.ts`; run targeted dashboard monthly tests first, then the explicit `rg` test list if shell glob behavior is unreliable.
- E2E tests use Playwright under `tests/e2e/story-*.spec.ts`; seed must be worker-local/idempotent because project config can run tests fully parallel.
- Static validators are part of `npm run lint`; Story 6.2 validator should fail if UI calculates monthly KPI totals directly or parses `snapshotJson` directly in route components.
- Minimum validation commands:
  - `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts`
  - `node scripts/validate-story-6-2.mjs`
  - `npm run lint`
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-2-monthly-dashboard.spec.ts`
  - If DB/dev server is available: `npx playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts`

### References

- Story source: `_bmad-output/planning-artifacts/epics.md` Story 6.2
- Epic source: `_bmad-output/planning-artifacts/epics.md` Epic 6, Stories 6.1-6.4
- Architecture source: `_bmad-output/planning-artifacts/architecture.md` Frontend Architecture, Architectural Boundaries, Integration Points
- Dashboard module docs: `docs/modules/dashboard.md`, `src/modules/dashboard/README.md`
- Project context: `_bmad-output/project-context.md`
- Previous story: `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`
- Current code sources: `src/modules/dashboard/dashboard-query-service.ts`, `src/app/(erp)/dashboard/today/page.tsx`, `src/modules/calls/service-call-service.ts`, `src/modules/closing/monthly-closing-service.ts`, `src/modules/closing/monthly-closing-preview-service.ts`, `src/lib/authorization.ts`, `src/lib/navigation.ts`, `src/components/ui/skeleton.tsx`, `package.json`
- External docs checked: Next.js `loading.tsx`, Next.js `redirect`, shadcn Skeleton

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- Create-story workflow activation on 2026-06-10: `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-create-story --key workflow` failed because local Python lacks `tomllib`; customization resolved manually from `.agents/skills/bmad-create-story/customize.toml`.
- Activation customization: prepend/append steps were empty; persistent fact loaded from `_bmad-output/project-context.md`; `on_complete = ""`.
- Config resolved from `_bmad/bmm/config.yaml`: user `noah`, project `vietnam_massage`, communication/document language Korean, implementation artifacts `_bmad-output/implementation-artifacts`.
- Required skill files loaded in order: `.agents/skills/bmad-create-story/SKILL.md`, `.agents/skills/bmad-create-story/discover-inputs.md`, `.agents/skills/bmad-create-story/template.md`, `.agents/skills/bmad-create-story/checklist.md`.
- Discovery results: `{epics_content}` from `_bmad-output/planning-artifacts/epics.md`; `{architecture_content}` from `_bmad-output/planning-artifacts/architecture.md`; `{prd_content}` no separate PRD file found under current planning artifacts, relevant FR context was available in epics and architecture; `{ux_content}` no separate UX file found under current planning artifacts; persistent facts from `_bmad-output/project-context.md`.
- Story target: user explicitly requested Story 6.2. Sprint status key matched `6-2-월간-kpi-대시보드와-스냅샷-조회: backlog`.
- Epic transition: `epic-6` was already `in-progress`; no epic status change required.
- Previous story intelligence loaded from `_bmad-output/implementation-artifacts/6-1-오늘-kpi-대시보드.md`.
- Current code inspected: `src/modules/dashboard/dashboard-query-service.ts`, `src/modules/dashboard/dashboard-query-service.test.ts`, `src/app/(erp)/dashboard/today/page.tsx`, `src/modules/calls/service-call-service.ts`, `src/modules/closing/monthly-closing-service.ts`, `src/modules/closing/monthly-closing-preview-service.ts`, `src/lib/authorization.ts`, `src/lib/navigation.ts`, `src/modules/dashboard/README.md`, `docs/modules/dashboard.md`, `tests/e2e/story-6-1-today-dashboard.spec.ts`, `scripts/validate-story-6-1.mjs`, `package.json`.
- Git intelligence: latest commits are `a263499 feat(story-6.1): 오늘 KPI 대시보드`, `c02e46f docs: add epic 5 retrospective`, `3b48673 feat(story-5.6): 월마감 이중확인 모달과 접근성`, `49613cc feat(story-5.5): 관리자 사유 기반 재오픈`, `e7cfb91 feat(story-5.4): 잠금 상태와 지급 영향 데이터 수정 차단`.
- Web research: official Next.js `loading.tsx`, Next.js `redirect`, and shadcn Skeleton docs checked for current framework specifics.
- Validation checklist applied during create-story: source requirements, architecture guardrails, existing code read, code reuse opportunities, exact file locations, snapshot fallback risk, route access/nav gap, loading/error/empty state, E2E parallel fixture risk, latest official docs, and LLM-dev ambiguity prevention.
- Completion hook check: manual customization fallback showed no final hook.
- Dev-story activation on 2026-06-10: `python3 _bmad/scripts/resolve_customization.py --skill .agents/skills/bmad-dev-story --key workflow` failed because local Python lacks `tomllib`; customization resolved manually from `.agents/skills/bmad-dev-story/customize.toml`.
- Dev-story activation customization: prepend/append steps were empty; persistent fact loaded from `_bmad-output/project-context.md`; config resolved from `_bmad/bmm/config.yaml`.
- TDD RED: `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` failed as expected before implementation because `getMonthlyDashboardMetrics` was not exported.
- TDD GREEN: `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` passed after implementing monthly DTO/source handling.
- Static validation: `node scripts/validate-story-6-2.mjs` passed after documentation markers were aligned.
- Full static chain: `npm run lint` passed all validators through Story 6.2.
- Unit regression: `npm run test:unit` passed but shell glob only selected a subset; explicit `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` passed 156 tests.
- E2E list validation: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-2-monthly-dashboard.spec.ts` listed 9 Story 6.2 tests.
- Full Story 6.2 E2E execution attempted with `npx playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts`; blocked by sandbox/dev-server bind error `listen EPERM: operation not permitted 127.0.0.1:3000`.
- TypeScript full check attempted with `npx tsc --noEmit`; failed on pre-existing unrelated repository issues in older call-ledger/E2E/account-service files, with no Story 6.2 file errors reported before truncation.
- Senior review on 2026-06-10: loaded `.agents/skills/bmad-story-automator-review/SKILL.md`, `workflow.yaml`, `instructions.xml`, and `checklist.md`; reviewed Story 6.2 ACs/tasks against implementation files.
- Senior review validation: `node --import tsx --test src/modules/dashboard/dashboard-query-service.test.ts` passed 10 tests.
- Senior review validation: `node scripts/validate-story-6-2.mjs` passed.
- Senior review validation: `npm run lint` passed Story 1.1 through Story 6.2 static validators.
- Senior review validation: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-6-2-monthly-dashboard.spec.ts` listed 11 Story 6.2 tests.
- Senior review validation: `npx playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts` was attempted and blocked by sandbox server bind `listen EPERM: operation not permitted 127.0.0.1:3000`.
- Senior review validation: `npx tsc --noEmit --pretty false` failed on pre-existing unrelated call-ledger/E2E/account-service errors; no Story 6.2 file errors appeared in the output.
- Final orchestrator validation: `npx playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts` started the web server and then failed during worker seed setup because Prisma returned `code: "ECONNREFUSED"` for `Employee.findUnique`; a direct Prisma probe reproduced `ECONNREFUSED` with `meta.modelName: "Employee"`.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Story 6.2 is scoped as a read-only monthly KPI dashboard and snapshot lookup. It must not introduce chart libraries, mutation actions, audit writes, or monthly close state transitions.
- Main implementation risk: route/page code may parse `MonthlyClosing.snapshotJson` directly or silently fallback from missing closed snapshot to current recalculation. The story requires a dashboard query DTO and explicit `sourceBasis`.
- Secondary implementation risk: `/dashboard/monthly` route access/navigation is absent today. The story requires explicit authorization, sidebar, and E2E coverage.
- Story validation should make UI calculation reinvention, missing snapshot state, and mixed current/snapshot values hard to miss.
- Implemented `getMonthlyDashboardMetrics()` as read-only dashboard query orchestration with Zod input validation, operating month DTO, `sourceBasis` union, monthly status/financial/course accumulation via `getDailyCallLedgerSummary()` date range, current preview support, latest closing snapshot support, snapshot-missing state, and reopened-month previous snapshot reference.
- Added `/dashboard/monthly` route with canonical `operatingMonthId` URL params, role access guard, operating-month selector, monthly status/financial/payout/course sections, source labels, empty/warning/snapshot-missing states, and safe loading/error boundaries.
- Updated dashboard authorization/navigation so administrator/counter/settlement_manager/read_only_viewer can access monthly dashboard and waiter is redirected to `/rooms`.
- Added Story 6.2 unit tests, E2E spec, static validator, documentation, and project-context rules. Updated older Story 3.3/3.4 validators to allow the expanded read-only dashboard route list.
- Verification passed for targeted dashboard unit tests, all explicit source unit tests, static validators, lint chain, and E2E test listing. Full browser E2E remains environment-blocked: one review attempt hit dev-server bind `EPERM`, and final orchestrator retry hit PostgreSQL `ECONNREFUSED` during Prisma `Employee.findUnique` seed setup.

### Senior Developer Review (AI)

Reviewer: noah on 2026-06-10

Outcome: Approved after automatic documentation fix. No source-code defects remained after review.

Findings and fixes:

- [x] [AI-Review][Medium] `_bmad-output/implementation-artifacts/tests/test-summary.md` was modified for Story 6.2 but omitted from the story File List. Added it to File List so story claims match git reality.

Checklist notes:

- Acceptance Criteria 1-13 were cross-checked against `getMonthlyDashboardMetrics()`, `/dashboard/monthly`, authorization/navigation, loading/error UI, unit tests, static validator, and E2E spec.
- The route consumes dashboard DTOs and does not parse `snapshotJson`, call ledger rows, monthly closing previews, or closing snapshots directly.
- Snapshot missing remains a distinct state and does not populate the payout/settlement summary from current preview.
- waiter access is denied via `requireRouteAccess("/dashboard/monthly")`; administrator, counter, settlement_manager, and read_only_viewer are explicitly allowed.

### File List

- `_bmad-output/implementation-artifacts/6-2-월간-kpi-대시보드와-스냅샷-조회.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `_bmad-output/project-context.md`
- `docs/modules/dashboard.md`
- `package.json`
- `scripts/validate-story-3-3.mjs`
- `scripts/validate-story-3-4.mjs`
- `scripts/validate-story-6-2.mjs`
- `src/app/(erp)/dashboard/monthly/error.tsx`
- `src/app/(erp)/dashboard/monthly/loading.tsx`
- `src/app/(erp)/dashboard/monthly/page.tsx`
- `src/lib/authorization.ts`
- `src/lib/navigation.ts`
- `src/modules/dashboard/README.md`
- `src/modules/dashboard/dashboard-query-service.test.ts`
- `src/modules/dashboard/dashboard-query-service.ts`
- `tests/e2e/story-6-2-monthly-dashboard.spec.ts`

### Change Log

- 2026-06-10: Implemented Story 6.2 monthly KPI dashboard, sourceBasis snapshot/current semantics, route/access/navigation, loading/error/empty states, docs, validators, and tests.
- 2026-06-10: Senior review completed; fixed File List/test-summary tracking mismatch and approved Story 6.2.
