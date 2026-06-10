---
baseline_commit: 1663c29
---

# Story 7.2: 핵심 계산 대조 검증 fixture와 테스트

Status: done

<!-- Note: Validation completed during create-story. -->

## Story

As a QA 담당자,
I want 샘플 또는 이관 데이터로 원본 엑셀과 ERP 계산 결과를 대조하기를,
so that 매출, 수당, 객실 상태, 월마감 계산이 원본 업무 규칙과 일치하는지 확인할 수 있다.

## Acceptance Criteria

1. 계산 대조 fixture는 원본 `sheet.xlsx` 또는 샘플 이관 데이터의 업무 의미를 반영하며 `방문완료`, `예약`, `사용중`, `청소중`, `노쇼`, `취소` 상태를 모두 포함한다. 각 상태가 매출, 수당, 귀케어 풀, 콜인정, 객실 점유에 미치는 차이를 테스트에서 확인할 수 있어야 한다.
2. 방문완료 콜 fixture의 결제 대조는 코스 기본판매가, 할인구분 고정 `100,000` VND 할인, 할인 없음 `0` VND, 최종 결제금액을 원본 엑셀 기대값과 비교한다.
3. 마사지사 대조는 `THERAPIST_1` 또는 `THERAPIST_2` 어느 칸에 배정돼도 담당 콜과 개인별 코스 수당이 일치함을 검증하고, 직원 식별은 표시명이 아니라 fixture의 stable `Employee.id`/`staffCode` mapping을 사용한다.
4. D코스 fixture는 마사지사2 누락 시 저장 또는 방문완료 차단 대상임을 검증하고, 마사지사1/2가 모두 있으면 각 담당 수당이 별도로 계산됨을 검증한다.
5. 객실 상태 fixture는 웨이터리스트와 TV현황판 기대값을 대조한다. `예약`, `사용중`, `청소중`은 활성 객실 상태로 쓰이고, `방문완료`, `노쇼`, `취소`는 객실 점유에 사용되지 않으며, 남은 시간 0 이하의 `사용중`은 `종료확인` 표시 기대값을 가진다.
6. 운영팀 인센 fixture는 일 총콜 30/40/50 기준과 월 총콜 1000/1100/1200/1300/1400/1500 기준을 대조하고, `정상` 상태 운영팀 직원만 지급 대상임을 검증한다.
7. 귀케어 일정산 fixture는 방문완료 귀케어 풀 합계, 정상 근무자 N분의1 분배, 정상근무자 0명 지급액 0원을 검증한다.
8. 마사지사 일정산과 월마감 fixture는 8시간 이상 만근 인정, 20일 이상 만근수당, 40콜 이상 갯수왕 1~3위 수당, 월마감 최종지급액을 포함한다.
9. fixture 기반 테스트 suite가 실행되면 모든 핵심 계산 대조가 통과하거나 불일치 항목을 `영역`, `fixture id`, `기대값`, `ERP 결과값`, `관련 story/FR`로 명확히 보고한다.
10. 모든 테스트와 fixture는 Excel 셀 좌표를 구현 기준으로 쓰지 않고, 업무 의미, 운영월, 날짜, 상태, stable ID 기준으로 작성한다. 셀 좌표와 workbook range는 source evidence 문자열에만 남긴다.

## Tasks / Subtasks

- [x] Story 7.2 공용 fixture source of truth를 추가한다 (AC: 1-10)
  - [x] `tests/fixtures/migration-calculation-comparison.ts`를 만들고 `MIGRATION_CALCULATION_FIXTURE`, `MIGRATION_EXPECTED_RESULTS`, `MIGRATION_SOURCE_REFERENCES`를 export한다.
  - [x] fixture는 `operatingMonth`, `rooms`, `courses`, `coursePolicies`, `therapistCourseRates`, `employees`, `timeSlots`, `serviceCalls`, `assignments`, `attendance`, `expenses`, `incentiveRules`, `expectedResults`처럼 도메인별 배열/객체로 분리한다.
  - [x] 모든 reference key는 `room-101`, `course-a`, `therapist-thr-001`, `ops-counter-001` 같은 stable ID를 사용한다. `마사지사1`, `1번방`, `A 누루60` 같은 표시명은 display/evidence 필드에만 둔다.
  - [x] fixture에는 최소 상태별 콜 6개를 포함한다: 방문완료, 예약, 사용중, 청소중, 노쇼, 취소.
  - [x] 방문완료 fixture에는 할인 있음, 할인 없음, A/B/D 코스, 마사지사1 only, 마사지사2 only, 마사지사1+2, D코스 마사지사2 누락 case를 포함한다.
  - [x] 객실 상태 fixture에는 최신 활성 콜 선택, 자정 넘김 또는 종료확인, 비점유 상태 제외를 포함한다.
  - [x] 운영팀/귀케어/마사지사/월마감 fixture는 30/40/50 일일 기준, 1000~1500 월 기준, 정상/비정상 근무상태, 0명 귀케어, 만근 20일 이상/미만, 갯수왕 40콜 이상/미만을 포함한다.
  - [x] source reference에는 `sheet_erp_design.md`와 `client_erp_specification.md`의 원본 근거를 문자열로 보존하되, 테스트 로직이 셀 좌표를 parse하거나 의존하지 않게 한다.

- [x] fixture를 기존 도메인 서비스에 주입할 수 있는 memory Prisma adapter를 만든다 (AC: 1-10)
  - [x] `tests/fixtures/migration-calculation-prisma.ts` 또는 같은 fixture 폴더에 `createMigrationCalculationPrisma()`를 추가한다.
  - [x] 기존 서비스 테스트들이 쓰는 `prismaClient` injection 패턴을 유지한다. 새 DB connection, seed reset, migration, browser-only setup을 요구하지 않는다.
  - [x] adapter는 기존 서비스가 호출하는 최소 Prisma model method만 구현한다: `operatingMonth`, `room`, `coursePolicy`, `therapistCourseRate`, `employee`, `codeItem`, `serviceCall`, `serviceCallAssignment`, `dailyExpense`, `opsAttendance`, `earcareAttendance`, `opsDailyIncentiveRule`, `opsMonthlyIncentiveRule` 등 실제 호출분.
  - [x] read-only 대조 테스트에서는 write method가 호출되면 실패하도록 한다. D코스 저장 차단 테스트처럼 write boundary 검증이 필요한 경우에는 해당 mutation의 무부작용을 별도로 assert한다.
  - [x] 날짜 비교는 ISO `YYYY-MM-DD` helper로 통일하고, 운영월 범위는 `OperatingMonth.startDate`~`endDate` 기준으로 처리한다.

- [x] 콜 계산 대조 테스트를 추가한다 (AC: 1-4, 9-10)
  - [x] `src/modules/migration/migration-calculation-comparison.test.ts` 또는 `tests/fixtures/migration-calculation-comparison.test.ts`를 추가한다. 위치는 import alias와 `npm run test:unit` 포함 여부를 고려해 선택한다.
  - [x] `completedServiceCallCalculationsFromRows()` 또는 `listCompletedServiceCallCalculationsForDate()`로 방문완료 계산을 대조한다. UI 컴포넌트에서 결제/할인/수당을 재계산하지 않는다.
  - [x] `getDailyCallLedgerSummary()`로 일별 결제합계, 할인합계, 귀케어풀, 마사지사정산, 콜인정/상태 count, 코스별 완료 count를 대조한다.
  - [x] `saveBasicServiceCallRow()` 또는 `autosaveServiceCallRow()`의 D코스 마사지사2 누락 차단을 검증하되, 성공 케이스는 기존 `calls` domain service가 수당 계산을 수행하게 한다.
  - [x] 비완료 상태와 invalid D row가 calculated aggregate에서 제외되는지 대조한다.

- [x] 객실/TV 상태 대조 테스트를 추가한다 (AC: 5, 9-10)
  - [x] `listRoomStatuses()`에 fixture adapter와 고정 `now`를 전달해 `빈방`, `예약`, `사용중`, `청소중`, `종료확인` 기대값을 대조한다.
  - [x] `방문완료`, `노쇼`, `취소`가 active room occupancy로 선택되지 않음을 검증한다.
  - [x] 상태 색상/표시값은 UI token 복제가 아니라 기존 `RoomStatusDto.displayStatus`와 `StatusBadge`/status token contract를 통해 검증한다. 새 색상 map을 migration fixture에 만들지 않는다.

- [x] 운영팀, 귀케어, 마사지사 정산 대조 테스트를 추가한다 (AC: 3, 6-7, 9-10)
  - [x] `listOpsDailyIncentives()`로 30/40/50 threshold, 정상 근무자만 지급, below threshold, missing policy warning을 대조한다.
  - [x] `listOpsMonthlyIncentivePreview()`로 1000~1500 threshold 중 최고 충족 기준, 팀장/카운터/웨이터 0.30/0.35/0.35 분배, integer remainder tie-breaker를 대조한다.
  - [x] `listEarcareDailySettlements()`로 방문완료 귀케어 풀 합계, 정상근무자 균등 분배, 정상근무자 0명 지급액 0원을 대조한다.
  - [x] `listTherapistDailySettlements()`로 마사지사1/2 담당콜, 같은 마사지사가 두 역할에 모두 배정된 경우, 수당 0 정책과 missing rate warning을 대조한다.

- [x] 월마감 최종지급액 대조 테스트를 추가한다 (AC: 8-10)
  - [x] `listMonthlyClosingPreview()`를 fixture 기반 upstream result로 실행하거나, 현재 서비스 테스트 패턴처럼 upstream service function dependency를 주입해 월 단위 preview를 대조한다.
  - [x] 만근 인정은 8시간 이상 대기시간, 만근수당은 20일 이상, 갯수왕은 40콜 이상 대상자 중 1~3위 5,000,000/3,000,000/1,000,000 VND를 검증한다.
  - [x] `finalPayoutAmount` 또는 동등한 최종지급액은 `monthlySettlement + attendanceBonus + rankingBonus` 기준으로 대조한다.
  - [x] 마감확정/잠금 snapshot 생성이나 상태 변경은 이 story의 필수 구현이 아니다. 월마감 preview 계산 대조가 중심이며, 실제 snapshot workflow는 기존 Story 5.3-5.6 서비스를 깨지 않아야 한다.

- [x] Story 7.2 정적 validator와 문서를 추가한다 (AC: 1-10)
  - [x] `scripts/validate-story-7-2.mjs`를 추가하고 `package.json`의 `lint` 체인에서 `validate-story-7-1.mjs` 직후 실행한다.
  - [x] validator는 fixture/test/doc/project-context/package markers를 검사한다: 상태 6종, `100000`, `THERAPIST_1`, `THERAPIST_2`, D코스 2인 검증, `RoomStatusDto`, 30/40/50, 1000/1100/1200/1300/1400/1500, 귀케어 0명, 8시간, 20일, 40콜, stable ID, 셀 좌표 비의존.
  - [x] `docs/modules/migration-verification.md`에 Story 7.2 계산 대조 fixture/test contract를 추가한다.
  - [x] `docs/modules/README.md`의 Migration verification 행 또는 설명을 Story 7.2까지 확장한다.
  - [x] `_bmad-output/project-context.md`에 Story 7.2 규칙을 추가한다: 공용 fixture source of truth, 기존 domain service 재사용, 계산 불일치 report shape, Excel 좌표 비의존.

- [x] 선택적 E2E/source guardrail을 추가한다 (AC: 9-10)
  - [x] 전체 계산 대조가 domain/unit 테스트로 충분히 보장되면 browser E2E를 새로 만들지 않아도 된다.
  - [x] E2E를 추가한다면 `tests/e2e/story-7-2-migration-calculation-comparison.spec.ts`는 source guardrail 중심으로 작성하고 DB-backed browser test 성공을 필수로 주장하지 않는다.
  - [x] Story 7.1의 Playwright source guardrail 패턴을 재사용한다.

## Dev Notes

- Epic 7의 목표는 원본 12개 시트와 숨김 `목록`의 기능 보존뿐 아니라 핵심 계산 결과가 원본 업무 규칙과 일치함을 출시 전 확인 가능하게 하는 것이다. Story 7.2는 리포트 UI가 아니라 fixture와 테스트 suite가 중심이다. [Source: `_bmad-output/planning-artifacts/epics.md` Epic 7, Story 7.2]
- PRD FR-37은 방문완료 결제/할인/콜인정/마사지사 수당/귀케어 풀, 객실/TV 상태, 운영팀 인센, 귀케어 N분의1, 마사지사 일정산, 만근수당, 갯수왕, 월마감 최종지급액 대조를 요구한다. [Source: `_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md` FR-37]
- Architecture는 FR-36~FR-37을 `docs/modules`, tests, migration fixtures, domain calculation tests로 지원하라고 명시한다. Fixture는 `tests/fixtures` 아래에 두는 구조가 설계되어 있다. [Source: `_bmad-output/planning-artifacts/architecture.md` Requirements to Structure Mapping; Test Organization]
- 원본 `실시간콜입력`의 대표 공식은 `방문완료`일 때만 결제금액, 마사지사수당, 귀케어풀, 콜인정을 계산하고, 할인구분이 있으면 고정 `100000`, 없으면 `0`이다. 이 공식은 fixture expected result의 핵심이다. [Source: `sheet_erp_design.md` §7.2]
- 원본 월간 요약 수식 일부는 실제 31일차 입력 슬롯 범위와 어긋난다. ERP 대조 테스트는 셀 범위가 아니라 운영월 날짜 조건으로 작성해야 한다. [Source: `sheet_erp_design.md` §7.2 Migration 검증 포인트; §11]
- 원본은 이름 문자열을 키처럼 사용하지만 ERP는 `Room.id`, `Employee.id`/`staffCode`, `Course.id`, `CodeItem.id`, `TimeSlot.value`를 stable reference로 사용한다. Fixture에서도 display label을 lookup key로 쓰면 안 된다. [Source: `_bmad-output/project-context.md`; Source: `docs/modules/migration-verification.md`]
- D코스 2인 필요는 원본 Excel에서 필수 입력으로 강제되지 않지만 ERP에서는 저장 또는 방문완료를 차단해야 한다. Story 7.2 테스트는 원본 차이를 “ERP 검증 강화”로 명확히 표시해야 하며, 누락 D코스를 정상 계산으로 통과시키면 안 된다. [Source: `sheet_erp_design.md` §11; Source: `client_erp_specification.md` §10]
- Story 7.1의 `src/modules/migration/sheet-feature-mapping.ts`는 source sheet coverage의 source of truth다. Story 7.2는 그 매핑을 대체하지 않고, 매핑의 `verificationItems`에 대응하는 계산 대조 fixture/test를 추가한다. [Source: `src/modules/migration/sheet-feature-mapping.ts`; Source: `_bmad-output/implementation-artifacts/7-1-원본-시트-기능-매핑표.md`]

### Existing Code to Reuse

- Calls calculation boundary:
  - `src/modules/calls/service-call-service.ts`
  - Key functions: `saveBasicServiceCallRow()`, `autosaveServiceCallRow()`, `getDailyCallLedgerSummary()`, `completedServiceCallCalculationsFromRows()`, `listCompletedServiceCallCalculationsForDate()`, `listCompletedServiceCallCalculationsForOperatingMonth()`.
  - Existing test file already covers completed-call payment, fixed discount, non-completed exclusion, D-course validation, invalid D aggregate exclusion, daily summary. Extend/reuse patterns instead of duplicating formulas. [Source: `src/modules/calls/service-call-service.test.ts`]
- Room/TV status boundary:
  - `src/modules/rooms/room-status-service.ts`
  - Key function: `listRoomStatuses()`.
  - Existing tests cover 11 active rooms, active status mapping, completed/no-show/canceled exclusion, latest active call tie-breaker, cross-midnight `종료확인`, read-only behavior. [Source: `src/modules/rooms/room-status-service.test.ts`]
- Settlements boundaries:
  - `src/modules/settlements/therapist-daily-settlement-service.ts` with `listTherapistDailySettlements()`.
  - `src/modules/settlements/earcare-daily-settlement-service.ts` with `listEarcareDailySettlements()`.
  - `src/modules/settlements/ops-daily-incentive-service.ts` with `listOpsDailyIncentives()`.
  - `src/modules/settlements/ops-monthly-incentive-service.ts` with `listOpsMonthlyIncentivePreview()`.
  - Existing tests use memory Prisma adapters and assert stable ID, warning, threshold, remainder tie-breaker behavior. Reuse those idioms. [Source: `src/modules/settlements/*.test.ts`]
- Closing boundary:
  - `src/modules/closing/monthly-closing-preview-service.ts` with `listMonthlyClosingPreview()`.
  - Existing tests use injected upstream service results for monthly preview, attendance bonus, count king, final totals, closed/locked current preview labels. Reuse dependency injection rather than hitting DB/browser. [Source: `src/modules/closing/monthly-closing-preview-service.test.ts`]
- Migration mapping:
  - `src/modules/migration/sheet-feature-mapping.ts` and `src/modules/migration/sheet-feature-mapping.test.ts`.
  - Story 7.2 may add calculation comparison artifacts under `src/modules/migration` only if they are test/reference evidence. Do not move domain business rules into migration.

### Fixture Design Contract

- Keep fixture data deterministic and small enough for unit tests. Do not import `sheet.xlsx` at test runtime unless a later story explicitly adds an Excel parser. Story 7.2 may cite workbook evidence but should run without Excel binary access.
- Use whole-number VND numbers only. Do not store formatted currency strings in expected results.
- Use ISO `YYYY-MM-DD` for service/attendance dates and timezone-aware ISO strings only for timestamps.
- Keep expected result groups explicit:
  - `callCalculation`: payment, discount, therapist commission, earcare pool, ops call credit, excluded rows.
  - `roomStatus`: room id, source call id, displayStatus, remainingMinutes, expectedEndAt, status token label.
  - `opsDaily` and `opsMonthly`: thresholds, eligible employees, distributed amount, warnings.
  - `earcareDaily`: pool total, normal worker count, per-person payouts, undistributed/zero-worker evidence.
  - `therapistDaily`: call count, commission amount, role evidence, missing/zero policy warnings.
  - `monthlyClosing`: monthly settlement, attendance bonus, ranking bonus, final payout, warning totals.
- If an expected value intentionally differs from raw Excel behavior because ERP adds stricter validation, mark it in fixture metadata as `erpStrengthenedRule` and reference D코스 2인 필수 validation. Do not hide it as a generic mismatch.
- The mismatch report shape should be serializable and stable:
  - `area`
  - `fixtureId`
  - `expected`
  - `actual`
  - `sourceReference`
  - `relatedRequirement`
  - `message`

### Anti-Reinvention Guardrails

- Do not implement a new calculation engine in `src/modules/migration`. It would drift from production services.
- Do not parse Excel formulas or cell ranges to compute expected values. Story 7.2 expected values are curated fixture evidence based on documented workbook rules.
- Do not add a new dependency for Excel parsing, table rendering, charts, snapshots, or deep equality unless an existing standard tool cannot cover it. Node `assert` and `node:test` are enough for fixture comparisons.
- Do not add a Prisma model, migration, DB seed reset, Server Action, audit write, route mutation, or UI report. Story 7.3 owns the report/tracking surface.
- Do not broaden `npm run lint` into DB/browser-required checks. Static validator and Node unit tests must run in a normal local dev environment.

### Project Structure Notes

- Preferred new files:
  - `tests/fixtures/migration-calculation-comparison.ts`
  - `tests/fixtures/migration-calculation-prisma.ts`
  - `src/modules/migration/migration-calculation-comparison.test.ts`
  - `scripts/validate-story-7-2.mjs`
  - Optional `tests/e2e/story-7-2-migration-calculation-comparison.spec.ts`
- Documentation updates:
  - `docs/modules/migration-verification.md`
  - `docs/modules/README.md`
  - `_bmad-output/project-context.md`
- Existing files likely to update:
  - `package.json` lint script, adding `node scripts/validate-story-7-2.mjs` immediately after Story 7.1 validator.
- Avoid placing reusable test fixture code inside a production route or UI component folder.
- Avoid adding the fixture helper under `src/shared`; it is test/migration evidence, not general runtime utility.

### Previous Story / Git Intelligence

- Story 7.1 introduced the migration mapping source of truth, read-only `/masters/sheet-mapping` route, validator, unit test, E2E source guardrail, docs, and project-context rules. Story 7.2 should follow the same pattern: static validator plus unit/source guardrails, but no mutation UI. [Source: `_bmad-output/implementation-artifacts/7-1-원본-시트-기능-매핑표.md`]
- Story 7.1 final verification found DB-backed browser tests can be blocked by local Prisma `ECONNREFUSED`; therefore Story 7.2 core acceptance must be covered by DB-free Node tests using memory adapters. [Source: `_bmad-output/implementation-artifacts/7-1-원본-시트-기능-매핑표.md` Debug Log References]
- Recent git baseline is `1663c29 feat(story-7.1): 원본 시트 기능 매핑표`. The only dirty file before this create-story run was `_bmad-output/story-automator/orchestration-1-20260607-165702.md`; do not touch or revert it. [Source: `git log --oneline -8`; Source: `git status --short`]

### Latest Technical Information

- Repo-pinned stack at story creation: Next.js `16.2.7`, React `19.2.7`, Prisma `7.8.0`, Zod `4.1.12`, Playwright `1.60.0`, TypeScript `5.9.3`, `tsx` `4.21.0`, Node test runner through `node --import tsx --test`. [Source: `package.json`]
- No new package is required for Story 7.2. Use Node `node:test` with `describe()`/`it()` aliases, which are part of the official Node test runner API, and existing `node:assert/strict`. [Source: Node.js Test Runner documentation, https://nodejs.org/api/test.html]
- Do not upgrade package versions as part of this story. If implementation unexpectedly requires a new test helper, verify and pin the exact version in `package.json`, then document why the existing Node test runner could not cover it.

### Testing Standards Summary

- Minimum validation commands:
  - `node scripts/validate-story-7-2.mjs`
  - `node --import tsx --test src/modules/migration/migration-calculation-comparison.test.ts`
  - `npm run lint`
  - `npm run test:unit`
- If an E2E/source guardrail is added:
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-7-2-migration-calculation-comparison.spec.ts`
  - `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-7-2-migration-calculation-comparison.spec.ts -g "source guardrails"`
- Do not claim DB-backed browser tests passed unless a real local DB/dev server run completed.
- Test names should expose the workbook rule being preserved, for example:
  - `Story 7.2 대조: 방문완료만 결제/수당/콜인정에 포함한다`
  - `Story 7.2 대조: D코스 마사지사2 누락은 ERP 강화 검증으로 차단된다`
  - `Story 7.2 대조: 객실 상태는 방문완료/노쇼/취소를 점유로 쓰지 않는다`

### References

- Story source: `_bmad-output/planning-artifacts/epics.md` Epic 7, Story 7.2
- PRD source: `_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md` FR-37
- Architecture source: `_bmad-output/planning-artifacts/architecture.md` Requirements to Structure Mapping, Test Organization, module boundaries
- UX navigation source: `_bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md`
- Workbook analysis: `sheet_erp_design.md` §7.2, §11
- Client ERP specification: `client_erp_specification.md` §10, §14
- Migration mapping source: `src/modules/migration/sheet-feature-mapping.ts`
- Project context: `_bmad-output/project-context.md`
- Existing domain services/tests: `src/modules/calls`, `src/modules/rooms`, `src/modules/settlements`, `src/modules/closing`, `src/modules/dashboard`

## Dev Agent Record

### Agent Model Used

GPT-5 Codex

### Debug Log References

- 2026-06-10: `node --import tsx --test src/modules/migration/migration-calculation-comparison.test.ts` passed (7 Story 7.2 comparison tests).
- 2026-06-10: `node scripts/validate-story-7-2.mjs` passed.
- 2026-06-10: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test --list tests/e2e/story-7-2-migration-calculation-comparison.spec.ts` passed (4 Story 7.2 source guardrail tests listed).
- 2026-06-10: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-7-2-migration-calculation-comparison.spec.ts -g "source guardrails"` passed (4 Story 7.2 source guardrail tests).
- 2026-06-10: `npm run lint` passed, including Story 7.2 static validator.
- 2026-06-10: `npm run test:unit` passed. Note: current npm glob output only enumerated existing matched tests, so the Story 7.2 migration test was also run directly with the explicit command above.
- 2026-06-10: Senior review auto-fix: `node scripts/validate-story-7-2.mjs` passed.
- 2026-06-10: Senior review auto-fix: `node --import tsx --test src/modules/migration/migration-calculation-comparison.test.ts src/modules/dashboard/dashboard-query-service.test.ts` passed (20 tests).
- 2026-06-10: Senior review auto-fix: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-7-2-migration-calculation-comparison.spec.ts -g "source guardrails"` passed (4 tests).
- 2026-06-10: Senior review auto-fix: `npm run lint` passed.
- 2026-06-10: Senior review auto-fix: `npm run test:unit` passed.
- 2026-06-10: Senior review note: `npx tsc --noEmit` still fails on pre-existing unrelated type issues in call-ledger keyboard tests, account-service Prisma enum usage, and older E2E typings; Story 7.2 introduced type fallout was fixed.
- 2026-06-10: Final verification: `git diff --check` passed.
- 2026-06-10: Final verification: `node scripts/validate-story-7-2.mjs` passed.
- 2026-06-10: Final verification: `node --import tsx --test src/modules/migration/migration-calculation-comparison.test.ts src/modules/dashboard/dashboard-query-service.test.ts` passed (20 tests).
- 2026-06-10: Final verification: `npm run lint` passed.
- 2026-06-10: Final verification: `PLAYWRIGHT_SKIP_WEBSERVER=1 npx playwright test tests/e2e/story-7-2-migration-calculation-comparison.spec.ts -g "source guardrails"` passed (4 tests).
- 2026-06-10: Final verification: `node --import tsx --test $(rg --files src | rg '\.test\.ts$')` passed (172 tests).
- 2026-06-10: Final verification: `npm run test:unit` passed (7 tests enumerated by the repo's current npm glob behavior).
- 2026-06-10: Final verification note: `npx tsc --noEmit --pretty false` still fails on the same pre-existing unrelated call-ledger keyboard, account-service enum, and older E2E typing issues; no Story 7.2-specific type failures were observed.

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created.
- Added Story 7.2 curated migration calculation fixture and read-only memory Prisma adapter using stable IDs and source references instead of Excel cell parsing.
- Added domain/unit comparison coverage for completed-call payment/discount/commission/earcare/ops credit, D-course second-therapist blocking, room/TV occupancy status, operations incentives, earcare split including zero normal workers, therapist daily settlement role handling, and monthly closing payout bonuses.
- Added Story 7.2 static validator and wired it into `npm run lint` after Story 7.1; the validator now also requires the Story 7.2 Playwright source guardrail.
- Added DB-independent Story 7.2 Playwright source guardrail coverage for fixture rules, read-only adapter, domain-service delegation, mismatch report shape, docs, and validator wiring.
- Documented the calculation comparison contract in migration module docs and project context. DB-backed browser E2E was intentionally not added because the domain/unit suite directly covers the critical calculation paths without DB/browser prerequisites.
- Senior review auto-fix exposed `basePrice` through the calls-domain completed calculation DTO so AC2 compares 코스 기본판매가 from production calculation output, not only fixture text.
- Senior review auto-fix changed Story 7.2 comparison assertions to emit the required mismatch report shape (`area`, `fixtureId`, `expected`, `actual`, `sourceReference`, `relatedRequirement`, `message`) on real assertion failures.
- Senior review auto-fix moved 월마감 upstream comparison data into the shared fixture so monthly closing tests remain fixture-based instead of relying on hardcoded test-only rows.

### File List

- `tests/fixtures/migration-calculation-comparison.ts`
- `tests/fixtures/migration-calculation-prisma.ts`
- `src/modules/calls/service-call-service.ts`
- `src/modules/migration/migration-calculation-comparison.test.ts`
- `src/modules/dashboard/dashboard-query-service.test.ts`
- `tests/e2e/story-7-2-migration-calculation-comparison.spec.ts`
- `scripts/validate-story-7-2.mjs`
- `package.json`
- `docs/modules/migration-verification.md`
- `docs/modules/README.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/tests/test-summary.md`
- `_bmad-output/implementation-artifacts/7-2-핵심-계산-대조-검증-fixture와-테스트.md`

### Senior Developer Review (AI)

Reviewer: GPT-5 Codex on 2026-06-10

Outcome: Approved after auto-fix. No CRITICAL issues remain.

Findings fixed:

- HIGH: AC2 stored expected `basePrice` but the production completed-calculation DTO did not expose it, so tests could not actually compare 코스 기본판매가 against ERP output. Fixed by adding `basePrice` to `ServiceCallRowDto` and `CompletedServiceCallCalculationDto`, sourced from `CoursePolicy.basePrice`.
- HIGH: AC9 mismatch report shape existed only as a helper/marker; failed comparisons would have produced generic assertion diffs rather than `area`, `fixtureId`, `expected`, `actual`, `sourceReference`, `relatedRequirement`, `message`. Fixed with `assertMigrationComparisonEqual()` and applied it to core call, room, D-course, daily summary, and monthly closing comparisons.
- MEDIUM: 월마감 fixture data for 8시간/20일/40콜 was partly hardcoded inside the test dependency instead of living in the shared fixture source of truth. Fixed by adding `monthlyClosingInputs` to `MIGRATION_CALCULATION_FIXTURE` and using it in the monthly closing preview dependency.
- MEDIUM: Adding `basePrice` to the completed-calculation DTO required updating an existing dashboard test double. Fixed by adding `basePrice` to the affected test fixtures.

Checklist summary:

- Story file loaded and status verified as reviewable.
- Acceptance Criteria 1-10 cross-checked against fixture, adapter, unit tests, source guardrails, docs, and validator.
- File List reconciled with review changes; added `src/modules/calls/service-call-service.ts` and `src/modules/dashboard/dashboard-query-service.test.ts`.
- Security/read-only review completed: fixture adapter still rejects writes; Story 7.2 E2E remains DB/browser independent.
- Verification run after fixes: Story 7.2 validator, focused unit tests, source guardrail, full static validator chain, and unit test script passed.

### Change Log

- 2026-06-10: Implemented Story 7.2 fixture, memory Prisma adapter, domain comparison tests, static validator, lint wiring, docs, and project-context rules. Status moved to review after validation.
- 2026-06-10: QA E2E workflow added Story 7.2 DB-independent Playwright source guardrails, updated static validation, and saved the test automation summary.
- 2026-06-10: Senior review auto-fixed base-price comparison coverage, structured mismatch assertion reporting, monthly closing fixture source data, and related test doubles. Status moved to done.
