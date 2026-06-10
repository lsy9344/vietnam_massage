# Migration Verification Module

Story 7.1 defines the source of truth for validating that the original Excel workbook has been moved into ERP features without functional omissions.
Story 7.2 adds 계산 대조 fixture and tests so the core workbook business rules can be compared against ERP domain service results.
Story 7.3 adds a report DTO and persisted QA tracking so sheet coverage, calculation comparison, missing items, mismatches, and release risks can be reviewed together.

## Scope

- The workbook inventory is 12개 sheets: 11 visible sheets plus hidden `목록`.
- 숨김 `목록` is not optional. It carries dropdown/reference values and must be checked with the same strictness as visible sheets.
- The target is 기능 보존율 100%.
- The executable source of truth is `src/modules/migration/sheet-feature-mapping.ts`.
- The read-only review screen is `/masters/sheet-mapping`.
- The static validator is `scripts/validate-story-7-1.mjs`.
- The Story 7.2 calculation fixture is `tests/fixtures/migration-calculation-comparison.ts`, the memory adapter is `tests/fixtures/migration-calculation-prisma.ts`, and the static validator is `scripts/validate-story-7-2.mjs`.
- The Story 7.3 report contract is `src/modules/migration/migration-verification-report.ts`, the persisted QA tracking tables are `MigrationVerificationIssue` and `MigrationVerificationIssueHistory`, and the static validator is `scripts/validate-story-7-3.mjs`.

## Sheet Coverage

| Source sheet | ERP responsibility |
| --- | --- |
| `오늘대시보드` | Today/monthly/report dashboard KPI queries |
| `실시간콜입력` | Call ledger, A:S input/calculation fields, U:X daily expense and summary fields |
| `웨이터리스트` | `/rooms` waiter room-status board |
| `TV현황판` | `/tv` fullscreen read-only board |
| `운영팀근무인센` | Operations attendance, daily incentives, monthly incentives |
| `귀케어일정산` | Earcare attendance and daily pool split |
| `마사지사일정산` | Therapist daily settlement and course-rate calculations |
| `월마감` | Monthly close preview, confirmation, lock, reopen, versioned snapshots |
| `직원DB` | Employee and user-account master separation |
| `TV설정` | Room, status, time slot, and TV display settings |
| `설정_코스수당` | Operating month, courses, policies, rates, incentive rules |
| hidden `목록` | Dropdown values for status, payment, discount, confirmation, attendance, time, room, course, therapist, earcare references |

## Verification Rules

Every mapping row must include workbook evidence, ERP surfaces, settings, calculation engines, verification items, preserved rules, and source references. A row cannot pass with a vague description such as only "이관됨".

`실시간콜입력` must explicitly distinguish A:S from U:X. Settlement, dashboard, and closing mappings must state that sales, payout, earcare pool, and call credit use the `방문완료` calculated-call rule.

Master and dropdown mappings must state the stable ID rule. Excel display labels and 셀 좌표 are evidence, not implementation keys. Downstream references use stable ID values such as `Room.id`, `Employee.id`/`staffCode`, `Course.id`, `CodeItem.id` or `codeType + code`, and `TimeSlot.value`/`sortOrder`.

## Story 7.2 Calculation Comparison

The calculation comparison fixture is a DB-free source of truth for release verification. It includes `방문완료`, `예약`, `사용중`, `청소중`, `노쇼`, `취소`, fixed `100000` VND discount evidence, `THERAPIST_1` and `THERAPIST_2` role evidence, D코스 마사지사2 필수 validation, `RoomStatusDto` room status expectations, 30/40/50 daily operations thresholds, 1000/1100/1200/1300/1400/1500 monthly operations thresholds, 귀케어 0명 payout evidence, 8시간 full-attendance recognition, 20일 full-attendance allowance, and 40콜 count-king ranking.

The tests must call existing domain service boundaries: calls calculation, `listRoomStatuses()`, therapist/earcare/operations settlement services, and monthly closing preview. Migration verification must not introduce a parallel calculation engine. Browser E2E is not required for Story 7.2 because the critical assertions are domain/unit comparisons using a read-only memory Prisma adapter.

Mismatch output must be serializable and stable with `area`, `fixtureId`, `expected`, `actual`, `sourceReference`, `relatedRequirement`, and `message`. Source references may preserve workbook ranges such as A:S or U:X, but test logic must not parse Excel cells or depend on 셀 좌표.

## Story 7.3 Report and Tracking

The Story 7.3 report DTO contains `summary`, `sheetRows`, `calculationRows`, `openIssueRows`, `filters`, and `generatedAt`. It consumes Story 7.1 mapping data and Story 7.2 `MigrationMismatchReport` shape; the UI renders the DTO and must not reimplement preservation or calculation rules.

`summary.preservationRate` is calculated against the 12 expected sheets, with hidden `목록` weighted the same as visible sheets. 숨김 목록 is a required 100% gate: if hidden `목록` or any source sheet is missing, the report must not show 100% preservation.

`calculationRows` cover 방문완료 결제/할인/콜인정, D코스 2인 검증, 객실/TV 상태, 운영팀 일/월 인센, 귀케어 0명 N분의1, 마사지사 역할별 정산, and 월마감 최종지급액. Injected mismatches preserve `area`, `fixtureId`, `expected`, `actual`, `sourceReference`, `relatedRequirement`, and `message`.

Persisted QA tracking uses `MigrationVerificationIssue` and `MigrationVerificationIssueHistory`, not audit logs. Deterministic item keys use shapes such as `sheet:목록`, `calculation:calls.payment:call-complete-a-discount`, or `fr:FR-37`. Status values are exactly `미확인`, `수정중`, `재검증 필요`, and `통과`; notes are trimmed and stored within 500 characters. This is persisted QA tracking for release verification, not operational audit evidence.

Filters are URL-backed and bounded by sheet, FR, story, status, and kind. They must help QA isolate remaining risk without including v1 exclusions such as CRM, marketing automation, accounting integration, mobile app, or membership in success metrics.

Story 7.3 keeps no runtime Excel parsing. Workbook ranges and cell coordinates remain source evidence strings only; report generation must not parse `sheet.xlsx`, workbook ranges, or formulas at request time.

## Access Boundary

`/masters/sheet-mapping` remains the exact QA/reference route for administrator and `read_only_viewer`. The `read_only_viewer` role has read-only viewer exact access to `/masters/sheet-mapping` only and must not receive the whole `/masters` prefix.

Administrator can update migration verification issue status through the route-local Server Action guarded by `migration:write`. `read_only_viewer` and `waiter` must not see mutation affordances. Story 7.3 does not add audit writes, seed resets, policy writes, or payout-impacting behavior.
