---
project_name: 'vietnam_massage'
user_name: 'noah'
date: '2026-06-07'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'code_quality_rules', 'workflow_rules', 'critical_rules']
existing_patterns_found: 7
status: 'complete'
rule_count: 52
optimized_for_llm: true
---

# AI 에이전트를 위한 프로젝트 컨텍스트

_이 파일은 AI 에이전트가 이 프로젝트에서 코드를 구현할 때 반드시 따라야 할 핵심 규칙과 패턴을 담습니다. 일반적인 조언보다, 에이전트가 놓치기 쉬운 비명시적 구현 규칙에 집중합니다._

---

## 기술 스택 및 버전

- 현재 프로젝트는 ERP 전환 사양/설계 워크스페이스이며, 구현 기술스택이 2026-06-07에 확정되었다.
- 서버는 Next.js + Node.js를 사용한다.
- 데이터베이스는 PostgreSQL을 사용한다.
- ORM과 마이그레이션은 Prisma를 사용한다.
- 인증은 NextAuth/Auth.js를 사용한다.
- 직원 계정 로그인은 NextAuth v4 `next-auth@4.24.14` CredentialsProvider 기반이다. Public signup은 제공하지 않고, 직원 계정은 관리자/server-only provisioning 또는 local seed 스크립트로만 만든다.
- 비밀번호 저장은 `@node-rs/argon2@2.0.2` Argon2id hash만 사용한다. `passwordHash` 외 plaintext 또는 복호화 가능 비밀번호 재료를 DB/fixture/log에 저장하지 않는다.
- 로그인 실패 잠금 정책은 Story 1.2 기준 5회 실패 후 15분 잠금이다. 로그인 실패 문구는 계정 존재/잠금/비밀번호 오류를 구분하지 않는 한국어 문구로 통일한다.
- RBAC 역할은 `administrator`, `counter`, `waiter`, `settlement_manager`, `read_only_viewer` 다섯 가지다. 역할별 landing은 관리자 `/live`, 카운터 `/calls`, 정산 담당 `/settlements`, 웨이터 `/rooms`, 조회 전용 `/rooms`이다.
- Sidebar 그룹 순서는 운영 현황, 콜 원장, 정산, 월마감, 대시보드, 마스터 설정, 감사 로그로 고정한다. 권한 없는 그룹/항목은 disabled가 아니라 렌더링하지 않는다.
- 권한 없는 direct route 접근은 page/layout/server boundary에서 `requireRouteAccess()`로 차단한다. 지급액, 수당, 마감, 직원 정보 등 민감 action은 `requirePermission()`으로 DB에서 현재 계정 상태와 권한을 재조회해야 한다.
- 감사 로그는 `AuditLog` Prisma 모델과 `src/modules/audit/audit-service.ts`의 `recordAuditEvent()`/`listAuditLogs()`를 사용한다. DB table은 `audit_logs`, before/after snapshot은 Prisma `Json?`, action은 `service_call.status_changed` 같은 dot notation만 허용한다.
- 감사 로그 `beforeValue`/`afterValue`는 JSON 직렬화 가능한 값만 허용한다. `NaN`, 함수, class instance, `Date` 객체는 `recordAuditEvent()`에서 domain error로 거부되므로 날짜/시간은 ISO 문자열로 넘긴다.
- 감사 로그 조회 권한은 `audit:read`이며 관리자만 `/audit` 화면과 sidebar 감사 로그 그룹을 볼 수 있다. 화면/서버 경계는 `requirePermission("audit:read")`로 DB 재조회 기반 권한 검사를 수행한다.
- 감사 로그는 append-only 불변 이력이다. 일반 운영 경로에 update/delete helper, Server Action, UI를 만들지 않는다. 정정은 후속 감사 이벤트를 추가하는 방식으로만 표현한다.
- 운영월 기준 데이터는 Prisma `OperatingMonth` 모델(`operating_months`)이 소유한다. `monthKey`는 unique `YYYY-MM`, `startDate`/`endDate`는 DB `@db.Date`, 서비스 DTO는 ISO `YYYY-MM-DD` 문자열이다.
- 운영월 상태값은 한국어 원문 `작성중`, `검토중`, `마감확정`, `잠금` 네 값만 허용한다. Story 1.4의 직접 상태 변경은 `작성중 -> 검토중`만 지원하며, `마감확정`/`잠금`/재오픈은 월마감 stories가 소유한다.
- `getOperatingMonthDateRange()`는 `calls`, `settlements`, `dashboard`, `closing`이 Excel 행 범위 대신 운영월 날짜 조건을 재사용하기 위한 표준 handoff 함수다.
- 운영월 생성과 상태 변경은 `operating_month.created`, `operating_month.status_changed` 감사 이벤트를 기록하며, before/after snapshot 날짜는 ISO 문자열로 넘긴다.
- 객실 마스터는 Prisma `Room` 모델(`rooms`)이 소유한다. 운영 표준 표시명은 `101 호실`~`402 호실` 형식이고, 숨김 시트 이관 참조값 `1번방`~`11번방`은 `migrationReferenceName`으로만 보존한다.
- 콜 원장, 객실 현황, TV 현황판 등 downstream 객실 참조는 `displayName`이나 `1번방` 문자열이 아니라 안정 키인 `Room.id`를 사용해야 한다.
- 객실 표시 순서는 `Room.sortOrder`가 소유하며 중복 정렬값은 차단한다. 기본 sortOrder는 10 단위 간격으로 둔다.
- 객실 비활성 처리는 `Room.isActive=false`만 사용하고 일반 운영 경로에서 물리 삭제하지 않는다. 생성/표시명 변경/정렬 변경/비활성 처리는 `room.created`, `room.display_name_changed`, `room.sort_order_changed`, `room.deactivated` 감사 이벤트를 기록한다.
- 코드 마스터는 Prisma `CodeItem` 모델(`code_items`)이 소유한다. 기본 `codeType`은 `SERVICE_STATUS`, `PAYMENT_METHOD`, `DISCOUNT_TYPE`, `ATTENDANCE_STATUS`, `CONFIRMATION`이며 stable reference는 `CodeItem.id` 또는 `codeType + code`를 사용하고 mutable `displayName`을 downstream 저장 키로 쓰지 않는다.
- Story 1.6 기본 상태 코드는 `예약`, `사용중`, `청소중`, `방문완료`, `노쇼`, `취소`; 결제수단은 `현금`, `카드`, `계좌`, `기타`; 할인구분은 `일주일내방문`, `생일자`, `후기작성`; 근무상태는 `정상`, `휴무`, `지각`, `조퇴`, `결근`; 확인값은 `Y`, `N`이다. 빈 할인/확인값은 코드 row가 아니라 downstream `null` 선택 없음으로 표현한다.
- 시간 슬롯 마스터는 Prisma `TimeSlot` 모델(`time_slots`)이 소유한다. 기본 ERP 입력 슬롯은 `11:00`부터 `01:00`까지 30분 간격 29개이며 `01:30`, `02:00`, `02:30`은 Story 1.6 기본 seed에 포함하지 않는다. 자정 넘김 정렬은 `TimeSlot.value`가 아니라 `TimeSlot.sortOrder`가 소유한다.
- 코드와 시간 슬롯은 삭제 대신 `isActive=false` 비활성 처리를 사용한다. 생성/표시명 또는 값 변경/정렬 변경/비활성 처리는 `code_item.*`, `time_slot.*` 감사 이벤트를 기록하고 JSON snapshot에는 Date 객체 대신 문자열/숫자/boolean/plain object만 넣는다.
- 직원 마스터는 Prisma `Employee` 모델(`employees`)이 소유한다. 기본 업무 직원 seed는 운영팀 5명, 귀케어팀 4명, 마사지사 50명이며 stable group code는 `OPERATIONS`, `EARCARE`, `THERAPIST`다.
- 직원 stable reference는 `Employee.id`와 `staffCode`다. 표시명, 직책, 계정 ID, Excel 행 번호를 downstream 저장 키로 쓰지 않는다.
- 직원 필드는 `employeeGroup`, `position`, `shiftType`, VND whole-number `baseSalary`, `phone`, `birthday`, `hireDate`, `employmentStatus`, `sortOrder`, `isActive`를 포함한다. `birthday`/`hireDate` DTO는 ISO `YYYY-MM-DD` 문자열 또는 `null`로 다룬다.
- 직원 비활성 처리는 `Employee.isActive=false`만 사용하고 일반 운영 경로에서 물리 삭제하지 않는다. 퇴사/휴직 상태와 선택 목록 비활성 여부는 분리한다.
- `UserAccount`와 `Employee`는 분리된 모델이며 optional unique `UserAccount.employeeId`로만 1:1 연결한다. 계정 비활성/잠금/실패 횟수는 로그인 접근 상태이고 직원 정산 이력 상태를 자동 변경하지 않는다.
- 직원 생성/프로필 변경/정렬 변경/비활성 처리는 `employee.created`, `employee.profile_changed`, `employee.sort_order_changed`, `employee.deactivated` 감사 이벤트를 기록한다. 계정 연결/역할 변경/비활성/잠금 해제는 `user_account.linked_to_employee`, `user_account.role_changed`, `user_account.deactivated`, `user_account.lock_reset` 감사 이벤트를 기록한다.
- 코스 마스터는 Prisma `Course` 모델(`courses`)과 적용월 이력 `CoursePolicy` 모델(`course_policies`)이 소유한다. `Course.id`가 downstream 저장 키이고 `Course.code`는 A~E stable reference이며, 코스명/TV 표시명/가격/시간/귀케어 풀/마사지사2 필요 여부는 정책 이력 값이다.
- 기본 코스 seed는 A 60분 1,500,000 VND `A 누루60`, B 90분 1,800,000 VND `B 귀청소90`, C 90분 2,000,000 VND `C 때밀이90`, D 90분 3,200,000 VND `D 2:1 90`, E 120분 3,000,000 VND `E 풀코스120`이다. D코스만 `requiresSecondTherapist=true`다.
- D코스 2인 필수 검증은 코스명 문자열이 아니라 `Course.id`와 `CoursePolicy.requiresSecondTherapist`를 조회해서 판단해야 한다.
- 마사지사 개인별 코스 수당은 `TherapistCourseRate` 모델(`therapist_course_rates`)이 소유하며 `Employee.staffCode` `THR-001`~`THR-050` seed 기준으로 생성한 뒤 `Employee.id`와 `Course.id`를 저장한다. `THR-001`~`THR-004`는 A 700,000, B/C 900,000, D/E 0이고 `THR-005`~`THR-050`은 A~E 모두 명시적 0 VND다.
- 운영팀 일일 인센은 30/40/50콜 기준 개인 50,000/100,000/200,000 VND이고, 월 인센은 1000/1100/1200/1300/1400/1500콜 기준 전체 3,000,000/5,000,000/8,000,000/12,000,000/18,000,000/25,000,000 VND와 팀장/카운터팀/웨이터팀 0.30/0.35/0.35 분배율이다.
- 코스 정책, 마사지사 수당, 운영팀 인센 정책은 `YYYY-MM` 적용월 범위를 가지며 같은 course/therapist/threshold의 활성 범위는 겹치면 안 된다. 정책이 없을 때 downstream 계산은 조용히 0으로 가정하지 말고 domain error 또는 명시적 not-found 결과를 처리해야 한다.
- 코스/정책 변경 감사 이벤트는 `course.created`, `course.policy_changed`, `course.deactivated`, `therapist_course_rate.created`, `therapist_course_rate.changed`, `therapist_course_rate.ended`, `ops_daily_incentive_rule.created`, `ops_daily_incentive_rule.changed`, `ops_monthly_incentive_rule.created`, `ops_monthly_incentive_rule.changed`를 사용하며 snapshot은 plain JSON만 허용한다.
- 코스/수당/인센 정책 변경은 현재/미래 계산 기준을 바꾸지만 확정된 과거 월마감 스냅샷을 자동 재계산하지 않는다.
- Story 2.1 기준 콜 원장은 Prisma `ServiceCall`(`service_calls`)과 `ServiceCallAssignment`(`service_call_assignments`)가 소유한다. 날짜별 조회는 `operatingMonthId + serviceDate` 한 날짜만 렌더링하고, `serviceDate`는 DB `@db.Date`, DTO는 ISO `YYYY-MM-DD` 문자열이다.
- 콜 기본 입력은 날짜, 시간, 객실, 코스, 고객/메모, 마사지사1, 마사지사2, 귀케어 담당, 상태, 할인구분, 결제수단, 비고, 확인값을 다룬다. 결제금액, 수당, 귀케어풀, 콜인정은 Story 2.3 전까지 `null`/표시 placeholder로만 둔다.
- 콜 담당자는 화면에서 원본 A:S 컬럼처럼 보이지만 저장은 `ServiceCallAssignment.assignmentRole` `THERAPIST_1`, `THERAPIST_2`, `EARCARE`와 `Employee.id`를 사용한다.
- Story 2.2 기준 콜 행 자동저장은 기존 `ServiceCall.id`를 요구하는 row-level mutation이다. UI 저장 상태는 `idle`, `saving`, `saved`, `error`이며 화면 문구는 `저장중`, `저장됨`, `저장 보류`를 사용하고 실패 시 같은 draft payload로 inline retry를 제공한다.
- Story 2.2 상태 변경 이력은 Prisma `ServiceCallStatusHistory`(`service_call_status_histories`)가 소유한다. 상태가 실제로 바뀔 때만 이전 상태, 새 상태, 변경자 계정 ID, 변경 시각을 저장한다.
- Story 2.2 콜 autosave 감사 이벤트는 dot notation만 사용한다. 상태 변경은 `service_call.status_changed`, 결제수단/할인구분/담당자/확인값 등 민감 row 변경은 `service_call.row_changed`를 기록한다.
- Story 2.3 기준 콜 계산은 calls domain service가 소유한다. 완료 상태는 레거시 값 `방문완료`와 Story 1.6 stable code `VISIT_COMPLETE`를 모두 인식하되, 비완료 상태는 `not_completed`로 제외한다. 빈 할인은 0, 선택된 할인구분은 고정 `100,000` VND이며, source of truth는 `CoursePolicy.basePrice`, `CoursePolicy.earcarePoolAmount`, `CoursePolicy.opsCallCredit`, `TherapistCourseRate.amount`다. UI 계산 재구현은 금지하고, autosave 실패 draft는 마지막 성공 계산값을 새 계산처럼 표시하지 않는다. `ServiceCall`에는 월마감 전 derived amount columns를 추가하지 않는다. `listCompletedServiceCallCalculationsForDate()`는 후속 정산/대시보드가 사용할 완료 콜 계산 결과를 반환한다.
- Story 2.4 기준 D코스 마사지사2 필수 검증은 calls domain service에서 `CoursePolicy.requiresSecondTherapist`와 `therapist2Id`로 수행한다. 필수인데 마사지사2가 없으면 `D_COURSE_SECOND_THERAPIST_REQUIRED` / `D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다.`로 저장과 `방문완료`/`VISIT_COMPLETE` 전환을 차단하고, Server Action은 `fieldErrors.therapist2Id`로 매핑한다. Grid는 마사지사2 셀에 `aria-invalid`, `aria-describedby`, `role="alert"`, danger ring, `!` 아이콘, 텍스트 메시지를 제공한다. 기존 invalid completed D-row는 `second_therapist_required`로 표시하고 `listCompletedServiceCallCalculationsForDate()` 집계에서 제외한다.
- Story 2.5 기준 일별 지출은 calls domain의 Prisma `DailyExpense` 모델(`daily_expenses`)이 소유한다. `DailyExpense`는 `OperatingMonth.id`, `expenseDate @db.Date`, whole-number VND `amount`, `description`, stable `Employee.id` 담당자, `note`, `isActive`를 저장한다. 일반 운영 경로에서 물리 삭제하지 않고 `isActive=false` soft delete만 사용한다.
- Story 2.5 지출 mutation은 `createDailyExpense()`, `updateDailyExpense()`, `deactivateDailyExpense()`가 소유하고 `/calls` Server Action은 `requirePermission("call:write")` 후 호출한다. 지출 생성/수정/비활성 감사 이벤트는 `daily_expense.created`, `daily_expense.changed`, `daily_expense.deactivated`이며 snapshot은 plain JSON, `expenseDate: "YYYY-MM-DD"`, 금액 number, 담당자 employee ID만 포함한다.
- Story 2.5 일별 요약은 `getDailyCallLedgerSummary()`가 소유한다. 예약/노쇼/취소/완료 카운트는 날짜와 운영월 조건으로 계산하고, 결제합계/마사지사정산/귀케어풀/할인합계/코스별 요약은 `calculationStatus === "calculated"`인 완료 콜만 포함한다. `not_completed`, 정책/수당 누락, `second_therapist_required` row는 금액 및 코스별 요약에서 제외한다.
- Story 2.5 순매출 공식은 `netSales = paymentTotal - expenseTotal`이다. 지출합계는 active `DailyExpense`만 포함하고, 지출은 콜 결제금액/수당/귀케어풀/할인 자체를 바꾸지 않는다. 코스별 요약은 mutable label이 아니라 stable `Course.code` A~E 기준으로 묶는다.
- Story 2.6 기준 콜 원장은 `@tanstack/react-table`을 headless row/column model로만 사용하고 기존 semantic `<table>` 구조를 유지한다. 키보드 이동, edit/draft/autosave, type-ahead, D코스 오류, computed readonly 표시는 프로젝트 코드가 소유한다.
- Story 2.6 키보드 모델은 route-local `call-ledger-keyboard.ts`가 소유한다. `Tab`/`Shift+Tab`은 편집 가능 셀을 이동하고, `Enter`는 현재 row draft를 autosave한 뒤 아래 행 같은 field로 이동하며, 방향키는 인접 셀 이동을 수행하고, `Esc`는 마지막 server draft로 되돌리며 autosave를 호출하지 않는다.
- Story 2.6 type-ahead combobox는 시간, 객실, 코스, 마사지사1/2, 귀케어 담당, 상태, 할인구분, 결제수단, 확인값에 적용한다. 필터는 label과 stable value를 대상으로 하지만 저장 payload는 반드시 `Room.id`, `Course.id`, `Employee.id`, code value, `TimeSlot.value` 같은 stable value만 보낸다.
- Story 2.6 combobox 접근성은 visible/sr-only label, `aria-expanded`, `aria-controls`, `aria-activedescendant`, listbox/option role을 제공한다. Dropdown option은 swatch만으로 의미를 전달하지 않고 텍스트 라벨을 포함해야 한다.
- Story 2.6 computed readonly cell은 `bg-readonly`, tabular number, right alignment, read-only tint를 유지하고 UI에서 계산을 재구현하지 않는다. 저장 실패 draft에서는 `저장 보류 계산 대기` 의미를 유지한다.
- 콜 저장은 운영월 범위 밖 날짜를 `OPERATING_MONTH_DATE_OUT_OF_RANGE` / `운영월 범위를 벗어난 날짜입니다.`로 차단하고, 운영월 `잠금` 상태는 `OPERATING_MONTH_LOCKED`로 차단한다.
- `/calls`는 Server Action + domain service 경계로 구현한다. page는 `requireRouteAccess("/calls")`, action은 `requirePermission("call:write")`를 사용하고 `ActionResult<T>`를 반환한다.
- Story 2.1 그리드는 별도 dependency 없이 semantic HTML table로 구현했다. Story 2.6부터 TanStack Table은 정확히 `@tanstack/react-table@8.21.3`으로 도입하며 floating range를 쓰지 않는다.
- 배포/운영은 프로젝트 표준과 같은 배포 방식, 같은 env 규칙, 같은 migration 절차를 따른다.
- 패키지 매니저 baseline은 `package.json`에 `pnpm@10.12.1`로 기록했다. 현재 로컬에는 `pnpm`/`corepack`이 없어 npm 기반 동등 검증을 사용했다.
- App Router baseline은 `next@16.2.7`, `react@19.2.7`, `react-dom@19.2.7`, `typescript@5.9.3`이다.
- Tailwind/shadcn baseline은 `tailwindcss@4.3.0`, `@tailwindcss/postcss@4.3.0`, `shadcn@4.10.0`이다.
- Prisma 7 기준으로 DB URL은 `prisma.config.ts`에서 관리하고, runtime PrismaClient는 `@prisma/adapter-pg`의 `PrismaPg` adapter를 사용한다.
- lint/static validation baseline은 `eslint@9.39.1`, `eslint-config-next@16.2.7`과 story 1.1/1.2 정적 검증을 함께 실행하는 `npm run lint` 스크립트다.
- E2E 테스트 baseline은 Playwright `@playwright/test@1.60.0`이며, 실행 스크립트는 `npm run test:e2e`다.
- Story 1.2 E2E는 역할별 로그인, landing, sidebar 숨김, direct route 차단을 검증한다. 실행 전 `DATABASE_URL` 설정, Prisma migration/generate, `scripts/seed-dev-accounts.ts` 기반 local 계정 seed가 필요하다.
- 현재 산출물은 Markdown 문서, 원본 Excel 파일 `sheet.xlsx`, 설계 이미지 PNG, 도메인 모듈 README 스캐폴드로 구성된다.
- BMad 설정은 `6.8.0` installer 기반이며, 프로젝트명은 `vietnam_massage`, 문서 출력 언어는 Korean이다.
- 코드 구현을 시작하기 전에는 새로 선택한 기술 스택의 버전 제약, package/config/test 파일, lint/format 규칙을 이 문서에 먼저 반영해야 한다.
- 현재 모듈 구조는 `masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit`, `shared`를 기준으로 한다.

## 핵심 구현 규칙

### 언어별 규칙

- 현재 저장소에는 TypeScript, JavaScript, Python 등 특정 구현 언어의 앱 코드가 없다.
- 언어별 규칙을 추정해서 만들지 않는다. 프레임워크/언어 선택 전에는 `tsconfig`, lint, formatter, test runner 규칙을 임의로 추가하지 않는다.
- 구현 언어가 선택되면 첫 코드 작성 전에 strictness, module format, import/export 방식, formatter, lint, test file naming을 이 문서에 갱신한다.
- 계산 로직은 UI 이벤트 핸들러나 화면 컴포넌트에 흩뿌리지 않고 도메인 모듈 함수/서비스에 둔다.
- 금액, 날짜, 시간, 직원 ID, 객실 ID, 코스 ID처럼 도메인 의미가 있는 값은 가능한 한 원시 문자열 남용을 피하고 명시적 타입 또는 값 객체로 표현한다.
- Excel 셀 좌표와 행 번호를 구현 규칙으로 삼지 않는다. 날짜, 운영월, 상태, 고유 ID 기반 조건으로 계산한다.

### 프레임워크별 규칙

- v1 앱 프레임워크는 Next.js App Router다.
- `src/app`은 routes, layouts, page composition을 담당하고, 도메인 계산/업무 로직은 `src/modules/*`에 둔다.
- 어떤 프레임워크를 쓰더라도 도메인 경계는 `masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit` 기준을 유지한다.
- 화면은 Excel 시트 이름을 그대로 복제하지 말고, 문서화된 업무 흐름과 모듈 책임을 기준으로 구성한다.
- 대시보드와 TV/객실 현황 화면은 읽기 전용 조회 화면으로 두고, 정산/마감 계산을 화면 코드에서 재구현하지 않는다.
- 월마감, 수당 정책, 직원/객실/코스 설정 변경처럼 지급액에 영향을 주는 기능은 권한, 스냅샷, 감사 로그 설계를 함께 포함해야 한다.

### 테스트 규칙

- 구현 테스트의 1순위는 새 기능 수가 아니라 `sheet.xlsx`의 기존 업무 규칙 보존이다.
- 계산 로직은 UI 테스트보다 먼저 도메인 단위 테스트로 검증한다.
- 최소 테스트 케이스에는 `방문완료`와 비완료 상태의 매출/수당/콜인정 차이를 포함한다.
- 할인구분이 있으면 현재 정책상 고정 `100000` 할인으로 계산되는지 검증한다.
- D코스는 마사지사2 필수 검증 여부를 정책 확인 후 테스트에 반영한다.
- Story 2.4 회귀 테스트는 D코스 마사지사2 누락 신규 저장/자동저장/방문완료 차단, 무부작용(row/history/audit 미변경), ARIA 연결, 비D코스 허용, D코스 2인 정상 계산, invalid completed D-row 집계 제외를 포함한다.
- Story 2.5 회귀 테스트는 지출 생성/수정/비활성, active 지출만 요약 반영, `daily_expense.*` 감사 로그 plain JSON snapshot, 금액 입력 검증, 운영월 범위/잠금 차단 무부작용, 완료 calculated row만 금액/코스별 요약 반영, `netSales = paymentTotal - expenseTotal`, `Course.code` A~E 그룹핑을 포함한다.
- 마사지사가 `마사지사1` 또는 `마사지사2` 어느 칸에 있어도 담당 콜로 인정되는지 검증한다.
- 출퇴근 시간이 자정을 넘는 경우 대기시간 계산과 8시간 이상 만근 인정 테스트를 포함한다.
- 정상 근무 귀케어사가 0명인 날의 귀케어 풀 처리는 정책 확정 전까지 지급액 `0` 또는 미확정 상태로 명시적으로 테스트한다.
- 월마감 확정 후에는 현재 설정 변경이 과거 지급 스냅샷을 바꾸지 않는 회귀 테스트를 둔다.
- 월간 집계는 Excel 행 범위가 아니라 운영월 날짜 조건으로 계산되는지 테스트한다.
- Story 5.3 기준 월마감 확정은 Prisma `MonthlyClosing` 모델(`monthly_closings`)이 소유하며 운영월당 하나의 확정 스냅샷만 허용한다. `snapshotJson`은 확정 시점의 `listMonthlyClosingPreview()` 결과를 confirmation DTO로 정규화해 저장하고, 이후 현재 미리보기 재계산값과 섞지 않는다.
- Story 5.3 기준 closing domain service contract는 `startMonthlyCloseReview()`, `confirmMonthlyClose()`, `getMonthlyClosingSnapshot()`이다. 검토 시작은 `작성중 -> 검토중`과 `operating_month.status_changed`를 기록하고, 확정은 `검토중 -> 마감확정`, `MonthlyClosing.create`, `monthly_close.confirmed`를 하나의 transaction으로 처리한다.
- Story 5.3 기준 `monthly_close.confirmed` 감사 로그 `targetType`은 `monthly_close`이며 afterValue에는 operating month, before/after state, snapshot id, confirmedAt을 plain JSON으로 포함한다. 스냅샷 조회는 저장된 `snapshotJson`을 반환해야 하며 `listMonthlyClosingPreview()`를 다시 호출해 과거값처럼 보여주면 안 된다.

### 코드 품질 및 스타일 규칙

- 현재 formatter는 별도 확정하지 않았다. lint/static validation은 `eslint.config.mjs`와 `scripts/validate-story-1-1.mjs`를 기준으로 시작한다.
- 새 코드는 기존 모듈 경계 문서와 같은 도메인명을 사용한다: `masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit`.
- `shared`는 여러 모듈이 실제로 공유하는 상수, 타입, 순수 유틸리티에만 사용한다. 도메인 계산 규칙을 `shared`로 빼지 않는다.
- 화면, API, 서비스 이름은 Excel 시트명이 아니라 ERP 도메인 책임을 기준으로 짓는다.
- Excel 원문 용어가 업무 규칙의 증거일 때는 문서나 테스트명에 한국어 원문 상태값을 보존한다.
- 설계 문서의 미확정 항목은 코드에서 조용히 가정하지 말고 TODO/결정 로그/테스트 이름으로 드러낸다.
- 대량 리팩터링보다 요청된 기능과 직접 연결되는 작은 변경을 우선한다.

### 개발 워크플로우 규칙

- BMad 산출물은 `_bmad-output/` 아래에 두고, 프로젝트 지식 문서는 `docs/` 아래에 둔다.
- 현재 기획 산출물의 기준 위치는 `_bmad-output/planning-artifacts/briefs/brief-vietnam_massage-2026-06-07/`이다.
- 모듈 참조 문서는 `docs/modules/`, 소스 모듈 스캐폴드는 `src/modules/`와 `src/shared/`를 기준으로 한다.
- 구현 전 새 기술 스택을 도입하면 package/config/test 파일과 함께 `project-context.md`를 갱신한다.
- 주요 정책 결정은 관련 문서 또는 결정 로그에 남긴다. 특히 시간 슬롯, 할인 정책, D코스 2인 필수, 귀케어 0명 처리, 월마감 재오픈 정책은 임의 확정하지 않는다.
- CodeGraph는 현재 초기화되어 있지 않다. 구조 질의가 필요한 구현 단계에서는 `codegraph init -i` 후 사용하는 것이 좋다.

### 절대 놓치면 안 되는 규칙

- 1차 목표는 새 기능 확장이 아니라 기존 `sheet.xlsx` 기능의 누락 없는 ERP 이전이다.
- 원본 12개 시트와 숨김 시트 `목록`의 역할이 ERP 기능 또는 설정으로 매핑되어야 한다.
- `실시간콜입력`은 중심 원장이다. 예약, 방문, 결제, 할인, 담당자, 지출, 정산 기초 데이터는 이 원장 개념에서 출발한다.
- `방문완료`가 아닌 `예약`, `사용중`, `청소중`, `노쇼`, `취소` 상태를 매출/수당/콜인정에 잘못 포함하지 않는다.
- 직원명, 객실명, 코스명을 안정 키로 쓰지 않는다. 표시명 변경 이력과 고유 ID를 분리한다.
- 월마감은 “미리보기 → 검토 → 확정 → 잠금” 흐름과 확정 시점 스냅샷을 가져야 한다.
- 확정된 월마감 지급액은 이후 수당표, 직원명, 원장 변경으로 자동 재계산되어 흔들리면 안 된다.
- TV현황판과 객실 현황은 최신 활성 콜 상태를 조회하는 읽기 전용 화면이다.
- 상태별 색상/표시값은 `사용중`, `청소중`, `예약`, `종료확인`, `빈방` 기준을 보존한다.
- Story 3.1 기준 객실 현재 상태는 `src/modules/rooms/room-status-service.ts`의 `listRoomStatuses()`가 소유하고, 첫 화면/객실 현황/TV 현황판은 같은 `RoomStatusDto`를 재사용해야 한다. 활성 active call 상태는 `예약`/`RESERVED`, `사용중`/`IN_USE`/`USING`, `청소중`/`CLEANING`이고, `방문완료`/`VISIT_COMPLETE`, `노쇼`/`NO_SHOW`, `취소`/`CANCELED`는 객실을 점유하지 않는다.
- Story 3.1 객실 상태 계산은 조회 전용 read-only domain service다. 최신 활성 콜은 객실별 serviceDate, 자정 넘김 정규화 startTime, deterministic tie-breaker로 선택하고, `사용중` 남은분이 0이면 `displayStatus`만 `종료확인`으로 바꾸며 `sourceCallStatus`는 원본 상태를 보존한다.
- Story 3.2 기준 `/live` 첫 화면은 읽기 전용 운영 현황 route다. `RoomStatusDto`는 `listRoomStatuses()`에서만 받고, 오늘 상태/매출 KPI는 `getDailyCallLedgerSummary()`를 재사용한다. UI 계산 재구현 금지: `/live` component는 객실 상태, `inUseCount`, `cleaningCount`, 결제합계, 순매출, 코스별 방문완료 수를 다시 계산하지 않는다.
- Story 3.2 기준 `getDailyCallLedgerSummary()`는 `reservationCount`, `inUseCount`, `cleaningCount`, `completedCount`, `noShowCount`, `canceledCount`를 콜 원장 상태 기준으로 제공한다. `사용중`은 `사용중`/`IN_USE`/`USING`, `청소중`은 `청소중`/`CLEANING`을 포함한다.
- Story 3.2 기준 `/live`는 `router.refresh()` 기반 15초 자동 갱신과 수동 새로고침을 제공하며, 마지막 갱신 시각과 `갱신 지연` 상태를 표시해야 한다. 새 React Query dependency 없이 route-local Client Component에서 처리한다.
- Story 3.3 기준 `/rooms`는 웨이터와 조회 전용 사용자의 객실 현황 landing이며 읽기 전용 화면이다. `requireRouteAccess("/rooms")`를 유지하고 웨이터는 `/rooms` 외 route에 접근하면 `/rooms`로 redirect한다.
- Story 3.3 기준 `/rooms`는 `listRoomStatuses()`의 `RoomStatusDto`와 `RoomStatusCard`를 그대로 재사용한다. 화면에서 활성 콜, `remainingMinutes`, `expectedEndAt`, `종료확인`, 안내 문구를 다시 계산하지 않는다.
- Story 3.3 기준 상태별 안내 문구 source of truth는 `src/modules/rooms/room-status-service.ts`의 `ROOM_STATUS_GUIDANCE_TEXT`다. `/rooms`에서 문구를 별도 상수로 복제하지 않는다.
- Story 3.3 기준 `/rooms`는 콜 원장 grid, autosave, 지출, 정산, 월마감 mutation UI를 포함하지 않는다. 운영월/조회날짜 form은 read-only 조회 조건 변경만 수행한다.
- Story 3.3 기준 `/rooms`는 공용 `RoomStatusRefreshController`로 15초 `router.refresh()` 자동 갱신, 수동 새로고침, 마지막 갱신 시각, `갱신 중`, `갱신 지연`을 표시한다. 새 React Query dependency 없이 직전 렌더 값을 유지한다.
- Story 3.4 기준 `/tv`는 `src/app/tv/page.tsx`의 fullscreen route이며 ERP chrome 없음, sidebar/topbar 없음, 입력/수정 affordance 없음 상태로 렌더링한다.
- Story 3.4 기준 `/tv`는 조회 전용/읽기 전용 downstream 화면이다. `requireRouteAccess("/tv")`를 유지하고 administrator/read_only_viewer만 접근하며 waiter/counter/settlement_manager 권한을 넓히지 않는다.
- Story 3.4 기준 `/tv`는 `listRoomStatuses()`의 `RoomStatusDto`와 `RoomStatusCard variant="tv"`를 재사용한다. 화면에서 활성 콜, 남은 시간, 종료예정, `종료확인`, 코스/담당자 표시를 다시 계산하지 않는다. UI 계산 재구현 금지.
- Story 3.4 기준 `/tv`는 공유 `RoomStatusRefreshController variant="tv"`로 15초 polling, 수동 새로고침, 마지막 갱신, `갱신 중`, `갱신 지연`을 표시하고 갱신 중/지연 시 직전 렌더 값을 유지한다.
- Story 3.4 기준 TV 카드는 상태별 색상과 텍스트 라벨과 글리프를 함께 표시하며, `종료확인`은 `결제·확인 필요` 같은 짧은 주의 문구를 보여준다.
- Story 3.5 기준 객실 상태 presentation의 status token source of truth는 `src/app/globals.css`와 `src/components/domain/status-badge.tsx`다. `/live`, `/rooms`, `/tv`는 `RoomStatusCard`/`StatusBadge`를 재사용하고 화면별 inline status color map을 만들지 않는다.
- Story 3.5 기준 상태 의미는 항상 색상, 텍스트 라벨, 글리프를 함께 사용해 전달한다. 글리프는 사용중 `●`, 예약 `◷`, 청소중 `◐`, 종료확인 `⚠`, 빈방 `○`로 고정한다.
- Story 3.5 기준 `청소중` badge는 `bg-status-cleaning text-status-cleaning-foreground`만 사용한다. gold fill 위 white foreground와 brand gold body text는 금지한다.
- Story 3.5 기준 `빈방` badge/card는 `border-status-empty bg-surface text-status-empty-foreground` 계열의 outline/ghost 표현을 사용하고 filled bronze badge로 표시하지 않는다.
- Story 3.5 기준 `종료확인` 텍스트 badge는 dark orange `status-complete-check`를 사용하고 bright orange `status-complete-check-glow`는 card ring/accent 전용이다. Badge 자체에는 attention animation을 적용하지 않는다.
- Story 3.5 기준 `.status-attention` motion은 text-bearing content가 아니라 non-text ring pseudo-element에만 2초 opacity breathe 수준의 느린 pulse를 적용한다. `prefers-reduced-motion: reduce`에서는 animation을 끄고 정적 ring과 `⚠` 라벨로 주의 상태를 전달한다.
- Story 3.5 기준 TV typography는 객실명 `text-[40px]`, status badge `text-[28px]`, meta `text-[22px]` 이상 ramp를 유지하고 작은 swatch 단독으로 상태 의미를 전달하지 않는다.
- Story 3.5 기준 상태 presentation polish는 UI 계산 재구현 금지 원칙을 유지한다. `종료확인` 판단, 남은분, 종료예정, course/assignee 표시는 `RoomStatusDto`와 rooms domain service가 소유한다.
- 신규 CRM, 마케팅 자동화, 회계 연동, 모바일 앱, 멤버십은 1차 범위가 아니다.
- 지급액에 영향을 주는 상태 변경, 결제/할인 변경, 담당자 변경, 출퇴근 변경, 수당표 변경, 직원 변경, 월마감 확정/취소/재오픈은 감사 로그 대상이다.

---

## 사용 지침

**AI 에이전트용**

- 구현 작업 전에 이 파일을 먼저 읽는다.
- 모든 규칙을 프로젝트 제약으로 취급한다.
- 미확정 항목은 임의 확정하지 않고 문서나 결정 로그에 남긴다.
- 새 기술 스택, 테스트 패턴, 도메인 규칙이 확정되면 이 파일을 함께 갱신한다.

**사람용**

- 이 파일은 에이전트가 놓치기 쉬운 규칙만 남긴다.
- 기술 스택이나 구현 패턴이 바뀌면 갱신한다.
- 오래되었거나 당연해진 규칙은 정리해 LLM 컨텍스트 비용을 낮춘다.

Last Updated: 2026-06-09
