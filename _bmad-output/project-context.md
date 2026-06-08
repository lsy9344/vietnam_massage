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
- 마사지사가 `마사지사1` 또는 `마사지사2` 어느 칸에 있어도 담당 콜로 인정되는지 검증한다.
- 출퇴근 시간이 자정을 넘는 경우 대기시간 계산과 8시간 이상 만근 인정 테스트를 포함한다.
- 정상 근무 귀케어사가 0명인 날의 귀케어 풀 처리는 정책 확정 전까지 지급액 `0` 또는 미확정 상태로 명시적으로 테스트한다.
- 월마감 확정 후에는 현재 설정 변경이 과거 지급 스냅샷을 바꾸지 않는 회귀 테스트를 둔다.
- 월간 집계는 Excel 행 범위가 아니라 운영월 날짜 조건으로 계산되는지 테스트한다.

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

Last Updated: 2026-06-08
