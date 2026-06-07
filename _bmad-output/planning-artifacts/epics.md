---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md
  - _bmad-output/planning-artifacts/architecture.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/review-accessibility.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/validation-report.md
---

# vietnam_massage - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for vietnam_massage, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: 로그인 후 첫 화면은 실시간 객실/콜 현황이어야 하며 11개 객실 상태, 오늘 예약/사용중/청소중/방문완료/노쇼/취소 요약, 오늘 결제합계/순매출/코스별 방문완료 수를 보여준다.

FR2: 각 객실은 카드 형태로 표시되어야 하며 상태별 잠긴 색상 토큰, 코스, 담당자, 시작시간, 남은분, 종료예정을 보여주고, `사용중` 남은분 0이면 `종료확인`으로 표시하며 객실 현황과 TV 현황판은 같은 상태 계산을 사용한다.

FR3: 주인용 화면은 일별 매출 추이, 코스별 콜/매출 비중, 마사지사 콜/정산 순위, 객실 상태 분포, 노쇼/취소 추이, 운영팀 인센 달성률을 `방문완료` 기준 집계로 시각화한다.

FR4: 관리자는 운영월을 `YYYY-MM` 기준 월 시작일/종료일과 함께 생성하고 작성중, 검토중, 마감확정, 잠금 상태로 관리하며 날짜 목록과 월간 집계는 운영월 날짜 조건으로 계산된다.

FR5: 관리자는 11개 객실 마스터를 관리할 수 있어야 하며 기본 객실 표시명은 `101 호실`~`402 호실` 표준을 사용하고 객실 고유 ID와 표시명을 분리한다.

FR6: 관리자는 운영팀 5명, 귀케어팀 4명, 마사지사 50명의 직원 정보를 고유 ID, 이름, 역할, 주/야간, 기본급, 연락처, 생일, 입사일, 재직상태로 관리하고 삭제 대신 비활성을 지원한다.

FR7: 관리자는 A~E 코스의 이름, 시간, 기본판매가, 운영팀 콜인정, 귀케어 풀/콜, 마사지사2 필요 여부, TV 표시명을 관리하며 D코스는 마사지사2 필요 코스로 관리한다.

FR8: 관리자는 마사지사 개인별 코스 수당, 운영팀 일일 인센, 운영팀 월 인센 기준을 적용월/이력과 함께 관리하고 원본 수당/인센 기준을 초기 이관값으로 보존한다.

FR9: 관리자는 상태, 결제수단, 할인구분, 확인값, 근무상태, 시간 슬롯 코드를 관리하며 상태/결제/할인 기본값과 `11:00`~`01:00` 30분 단위 입력 슬롯을 제공한다.

FR10: 카운터는 날짜, 시간, 객실, 코스, 고객/메모, 마사지사1, 마사지사2, 귀케어 담당, 상태, 할인구분, 결제수단, 비고, 확인값을 입력할 수 있고 원본 `실시간콜입력` A:S 업무 의미와 일자별 100개 슬롯 입력량을 보존한다.

FR11: 카운터는 서비스 콜 상태를 `예약`, `사용중`, `청소중`, `방문완료`, `노쇼`, `취소`로 변경할 수 있고 상태 변경 이력과 감사 로그가 저장되며 `방문완료` 외 상태는 매출/수당/귀케어 풀/콜인정에 포함되지 않는다.

FR12: 시스템은 상태가 `방문완료`일 때만 결제금액, 마사지사1수당, 마사지사2수당, 귀케어 풀, 콜인정을 계산하고 그 외 상태에서는 해당 계산값을 0으로 처리한다.

FR13: 시스템은 할인구분이 비어 있으면 할인금액 0, `일주일내방문`, `생일자`, `후기작성` 중 하나이면 원본 엑셀처럼 고정 100,000원을 할인한다.

FR14: 시스템은 D코스 서비스 콜에서 마사지사2 입력을 필수로 검증하고 마사지사2가 없으면 저장 또는 방문완료 처리를 막으며, 마사지사1/2가 모두 있으면 각 담당자 수당을 별도로 계산한다.

FR15: 카운터 또는 관리자 권한 사용자는 일자별 지출금액, 내용, 담당자, 비고를 입력할 수 있고 시스템은 일별 지출합계, 순매출, 예약/방문완료/노쇼/취소, 결제합계, 정산/귀케어/할인/코스별 요약을 계산한다.

FR16: 시스템은 객실별 최신 `사용중`, `청소중`, `예약` 서비스 콜을 찾아 객실 상태를 계산하고 활성 콜이 없으면 `빈방`으로 표시하며 이 계산은 정산/월마감 데이터를 변경하지 않는다.

FR17: 시스템은 코스 시간과 시작시간을 기준으로 남은분과 종료예정을 계산하고, 자정 넘김 흐름에서도 올바르게 계산하며 `사용중` 남은분 0이면 `종료확인`으로 표시하고 남은분은 음수로 표시하지 않는다.

FR18: 시스템은 `사용중`, `청소중`, `예약`, `종료확인`, `빈방`별 웨이터 안내 문구를 구분해 표시하고 안내 문구는 설정 또는 코드로 관리할 수 있으며 TV 현황판에는 핵심 문구만 노출한다.

FR19: 시스템은 11개 객실을 대형 카드 형태로 보여주는 조회 전용 TV 현황판을 제공하고 입력 기능 없이 자동 새로고침 또는 실시간 갱신을 지원하며 상태 색상/표시값은 객실 현황과 일치한다.

FR20: 정산 담당자는 마사지사 50명의 일별 출근시간과 퇴근시간을 입력할 수 있고 퇴근시간이 출근시간보다 빠르면 자정 이후 퇴근으로 계산하며 대기시간 8시간 이상이면 만근으로 인정한다.

FR21: 시스템은 마사지사가 마사지사1 또는 마사지사2 어느 칸에 배정되어도 담당 콜로 인정하고 `방문완료` 콜만 기준으로 코스별 담당 콜 수와 당일 수당 합계를 계산한다.

FR22: 정산 담당자는 귀케어사 4명의 일별 근무상태를 `정상`, `휴무`, `지각`, `조퇴`, `결근`으로 입력할 수 있고 정상 상태만 귀케어 지급 대상이며 변경은 감사 로그 대상이다.

FR23: 시스템은 방문완료 콜의 귀케어 풀을 해당일 정상 근무 귀케어사에게 균등 분배하고 정상근무자수가 0명이면 지급액을 0원으로 처리한다.

FR24: 정산 담당자는 운영팀 5명의 일별 근무상태를 입력하고 시스템은 일 총콜 30/40/50 이상일 때 정상 상태 운영팀 직원에게 개인별 50,000/100,000/200,000 일일 인센을 계산한다.

FR25: 시스템은 운영월 총콜 1000/1100/1200/1300/1400/1500 이상 구간별 운영팀 월 인센을 계산해 미리 보여주고 팀장 30%, 카운터팀 35%, 웨이터팀 35% 분배율과 내부 인원별 분배를 표시한다.

FR26: 정산 담당자는 운영월의 마사지사, 운영팀, 귀케어 지급액을 월마감 미리보기로 확인할 수 있으며 마사지사별 월 총콜, 월 정산액, 만근 인정일, 만근수당, 갯수왕 순위/수당, 최종지급액과 운영팀/귀케어 합계를 보여준다.

FR27: 시스템은 마사지사 만근 인정일이 20일 이상이면 만근수당 2,000,000을 지급하고 19일 이하이면 0으로 계산한다.

FR28: 시스템은 월 총콜 40콜 이상 마사지사를 대상으로 갯수왕 1~3위 수당 5,000,000/3,000,000/1,000,000을 계산하고 순위와 수당 산출 근거를 월마감 화면에 표시한다.

FR29: 관리자 또는 정산 담당 권한 사용자는 월마감을 미리보기, 검토, 확정, 잠금 단계로 처리할 수 있고 확정 시 마감 스냅샷이 저장되며 잠금 상태는 일반 사용자의 지급 영향 데이터 수정을 막고 확정/잠금은 감사 로그 대상이다.

FR30: 관리자는 사유 입력 후 잠긴 월마감을 재오픈할 수 있으며 재오픈은 관리자 권한에서만 가능하고 전후 상태와 행위자가 감사 로그에 기록된다.

FR31: 시스템은 조회날짜 기준 오늘 예약건수, 방문완료 콜, 노쇼, 취소, 결제합계, 마사지사 담당콜, 마사지사 정산, 코스별 방문완료를 보여주며 매출과 정산은 `방문완료` 기준으로 계산한다.

FR32: 시스템은 운영월 기준 월 방문완료 콜, 예약건수, 노쇼, 취소, 방문완료 매출을 보여주고 월마감 확정 후에는 확정 스냅샷 기준 값을 조회할 수 있다.

FR33: 시스템은 일별 매출 추이, 코스별 콜/매출 비중, 마사지사 콜 순위, 마사지사 정산 순위, 객실 상태 분포, 노쇼/취소 추이를 원본 엑셀에서 계산 가능한 데이터만 사용해 웹 ERP 화면에서 그래프로 제공한다.

FR34: 시스템은 관리자, 카운터, 웨이터, 정산 담당, 조회 전용 권한을 지원하고 각 권한별 화면 접근과 기능 실행 범위를 분리한다.

FR35: 시스템은 콜 상태, 결제/할인, 담당자, 출퇴근, 수당표, 직원, 월마감 확정/취소/재오픈 등 민감한 변경의 행위자, 액션, 대상, 변경 전후 상태, 시각을 삭제 불가능한 감사 로그로 기록한다.

FR36: 시스템 또는 산출물은 원본 12개 시트와 숨김 시트 `목록`이 어떤 ERP 화면, 설정, 계산 엔진, 검증 항목으로 이전됐는지 매핑표를 제공한다.

FR37: 시스템은 샘플 데이터 또는 이관 데이터 기준으로 원본 엑셀과 ERP 계산 결과를 대조할 수 있어야 하며 방문완료 계산, 객실/TV 상태, 운영팀/귀케어/마사지사 정산, 월마감 최종지급액을 검증한다.

### NonFunctional Requirements

NFR1: ERP 계산 결과는 원본 엑셀의 업무 규칙과 일치해야 하며 행 번호, 셀 좌표, 숨김 행 구조는 구현 기준이 아니라 검증 근거로만 사용한다.

NFR2: 월간 집계, 정산, 마감 계산은 운영월 날짜 조건과 상태/고유 ID 기준으로 수행되어야 한다.

NFR3: 실시간 객실/콜 현황과 TV 현황판은 운영자가 체감할 수 있을 만큼 빠르게 갱신되어야 하며 대시보드 그래프는 조회날짜 또는 운영월 변경 시 이해 가능한 로딩 상태와 함께 갱신되어야 한다.

NFR4: 정산과 월마감 계산은 화면을 멈추는 클라이언트 수식 방식이 아니라 서버 계산 또는 집계로 처리되어야 한다.

NFR5: 인증은 NextAuth/Auth.js를 사용하고 권한별 화면 접근과 기능 실행 범위를 분리하며 지급액, 수당, 마감, 직원 정보에 영향을 주는 기능은 실행 시점 권한 검사를 통과해야 한다.

NFR6: 감사 로그는 일반 운영 기능으로 삭제할 수 없고 월마감 확정 스냅샷은 이후 설정 변경으로 자동 재계산되어 흔들리면 안 된다.

NFR7: 재오픈은 관리자 권한과 사유 입력을 요구해야 한다.

NFR8: 실시간 객실/콜 현황은 첫 화면에서 주인이 매장 상태를 한눈에 파악할 수 있어야 하고, 카운터 입력 화면은 엑셀의 빠른 입력성을 잃지 않아야 하며, 정산 화면은 계산 결과와 산출 근거를 함께 보여줘야 한다.

NFR9: 구현 기술스택은 Next.js + Node.js, PostgreSQL, Prisma, NextAuth/Auth.js를 사용하고 UI/UX 기반 기술스택은 Tailwind CSS v4와 shadcn/ui를 사용한다.

NFR10: 배포, env, migration 절차는 프로젝트 표준과 동일하게 따라야 하며 production migration은 안전한 release/CI 절차로 처리해야 한다.

NFR11: 직원명, 객실명, 코스명 같은 표시명은 안정 키로 사용하지 않고 고유 ID를 사용해야 하며 수당/인센/가격 정책은 적용월과 스냅샷을 가져야 한다.

NFR12: v1은 원본 엑셀 기능 보존이 목표이며 신규 CRM, 마케팅 자동화, 회계 연동, 고객용 모바일 앱, 멤버십, 복잡한 할인 금액 다양화, 원본에 없는 고객 세그먼트 분석, 외부 POS/PG 연동은 범위에서 제외한다.

### Additional Requirements

- 첫 구현 스토리는 공식 Next.js App Router starter를 `pnpm create next-app@latest vietnam_massage_app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --disable-git` 기준으로 초기화한 뒤 기존 문서와 `src/modules` 스캐폴드를 보존하며 병합해야 한다.
- Starter 이후 shadcn/ui, Tailwind 테마 토큰, Prisma, Auth.js/NextAuth, Zod, 도메인 테스트 도구를 명시적으로 추가해야 한다.
- PostgreSQL은 production DB로 사용하고 가능한 최신 PostgreSQL 18을 목표로 하되 환경 제약 시 지원되는 PostgreSQL 17 또는 16을 허용한다.
- Prisma 7.x를 schema/query/migration layer로 사용하고 schema와 migration history를 source control에 보존하며 production에는 `prisma migrate deploy`를 사용한다.
- Server Action/API boundary에서 Zod 4.x로 입력을 검증하고 domain service 호출 전 권한과 유효성을 확인한다.
- 비즈니스 모델은 Excel 셀 좌표가 아니라 `ServiceCall`, `OperatingMonth`, `Employee`, `Room`, `Course`, policy record, monthly close snapshot 등 ERP 개념과 stable ID 중심으로 설계한다.
- 코스 가격, 마사지사 수당, 운영팀 인센, 코드/상태, 지급 계산에 영향을 주는 표시명은 effective-month policy/history를 가져야 하고 월마감 확정 시 payout snapshot과 calculation evidence를 저장해야 한다.
- v1에서는 Redis나 별도 cache service를 도입하지 않고 PostgreSQL index, query shaping, Prisma query discipline, Next.js cache/revalidation으로 시작한다.
- staff account는 관리자가 provisioning하며 public signup은 제공하지 않는다.
- 비밀번호는 Argon2id로 hash하고 plaintext 또는 reversible password material을 저장하지 않는다.
- 로그인 identity와 직원 display data를 분리해 `UserAccount`를 `Employee`와 연결하고 직원명/역할/표시 상태 변경이 인증 기록이나 과거 정산 스냅샷을 깨지 않게 한다.
- RBAC는 administrator, counter, waiter, settlement manager, read-only viewer 역할을 지원하고 sidebar visibility뿐 아니라 Server Action, Route Handler, domain service에서 실행 권한을 재검사해야 한다.
- session payload는 최소화하고 민감 action에서는 현재 계정 상태와 permission을 DB에서 다시 확인해야 한다.
- inactive account blocking, login failure tracking, 반복 실패 lockout 또는 admin reset을 지원해야 한다.
- 내부 UI mutation은 Next.js App Router Server Actions를 기본으로 사용하고 Route Handlers는 Auth.js, export/download, health check, future webhook/integration 등 특별 endpoint로 제한한다.
- broad internal REST API 또는 OpenAPI는 외부 client 요구가 없으면 만들지 않는다.
- Server Action/Route Handler는 authenticate, authorize, validate, domain service 호출, UI/API response mapping만 담당하는 thin adapter여야 한다.
- action result는 `{ ok: true; data }` 또는 `{ ok: false; fieldErrors?, formError?, domainErrorCode? }` 구조를 사용한다.
- call ledger autosave는 row-level Server Action으로 구현하고 성공 시 saved row state, computed read-only fields, row save status를 반환해 client가 계산 로직을 중복하지 않게 한다.
- room/TV refresh는 v1에서 polling/auto-refresh로 시작하고 5~10초 수준의 운영 적정 interval과 last updated/refresh delay 표시를 제공하며 DTO와 query는 추후 SSE/WebSocket 전환 가능성을 유지한다.
- Frontend는 Server Components를 기본으로 하고 interaction-heavy surfaces만 Client Components로 구현한다.
- domain-specific UI component는 `RoomStatusCard`, `EditableCallGrid`, `MonthCloseStepper`, `SettlementEvidenceBlock`, `StatusBadge`, `CallStateChip`, role-aware sidebar navigation을 포함한다.
- call ledger grid는 `@tanstack/react-table` headless table 기반을 사용하되 keyboard navigation, editable cells, type-ahead dropdown, autosave states, computed read-only cells, D-course validation은 프로젝트 특화 behavior로 구현한다.
- conventional forms는 React Hook Form + Zod resolver를 사용하고 call ledger grid는 별도 row/cell editing model을 사용한다.
- Redux, Zustand 등 global state store는 v1에 도입하지 않고 operating month/date/view는 URL params, persisted state는 server/domain service, transient editing은 local component state를 사용한다.
- TanStack Query는 room/TV polling, refresh state, optimistic interaction처럼 client-managed refresh가 실제로 필요한 경우에만 사용한다.
- TV board는 일반 room-status screen과 같은 DTO를 쓰는 dedicated fullscreen route로 구현하고 chrome/sidebar/input controls를 숨긴다.
- chart library는 dashboard 구현 때 확정하되 KPI card와 단순 CSS/table visualization으로 충분하지 않을 때 lightweight React chart library를 선호하며 dashboard visual은 call-entry grid를 느리게 만들면 안 된다.
- call ledger는 운영월 내 선택 날짜 단위로 query/render하고 전체 31일 x 100 슬롯을 한 editable grid로 렌더링하지 않는다.
- Node server deployment를 기준으로 설계하고 static export는 금지한다.
- production/staging/local DB는 분리하고 `.env*`를 commit하지 않으며 server secret은 `NEXT_PUBLIC_`로 노출하지 않는다.
- CI/CD baseline은 install, typecheck, lint, domain/unit tests, build, production migration deployment 순서를 포함해야 한다.
- PostgreSQL backup/restore 절차는 월마감 스냅샷과 감사 로그 보호를 위해 필수이며 production cutover 전 backup retention, restore test, PITR 기대치를 정의해야 한다.
- source organization은 `src/app`, `src/components/ui`, `src/components/domain`, `src/lib`, `src/modules/{domain}`, `src/shared`, `prisma`, `tests` 경계를 따른다.
- domain service는 계산 로직을 소유하고 React component는 settlement, close, payout calculation을 소유하지 않는다.
- domain tests는 module folder에 `*.test.ts`로 co-locate하고 payout-affecting UI 구현 전 계산 테스트를 먼저 작성해야 한다.
- audit event/action 이름은 `service_call.status_changed`, `monthly_close.confirmed` 같은 dot notation을 사용하고 payload는 actor ID, target type, target ID, before, after, timestamp, 필요한 reason을 포함한다.
- date는 service date에 ISO `YYYY-MM-DD`, date-time은 timezone-aware ISO string, money는 formatted string이 아니라 integer minor unit 또는 whole VND number field를 사용한다.
- 구현 착수 시 package manager는 `pnpm`으로 결정되어 있으나 실제 `package.json`/lockfile 생성이 필요하고 test runner, e2e framework, Auth.js v5 vs stable v4, hosting provider, DB hosting, backup retention, migration approval flow는 구현 스토리에서 재확인/확정해야 한다.

### UX Design Requirements

UX-DR1: shadcn/ui + Tailwind CSS v4 기본값을 상속하고 Royal Gold 브랜드 레이어, warm cream background/surface, border/text/muted/danger/readonly tint 토큰을 Tailwind/shadcn theme layer에 구현한다.

UX-DR2: `사용중`, `예약`, `청소중`, `종료확인`, `빈방` 상태 토큰은 첫화면 카드, 객실 현황, TV 현황판, dashboard chips, grid dropdowns에서 동일 hex와 의미로 잠가 사용한다.

UX-DR3: status badge는 항상 색상, 텍스트 라벨, 상태별 글리프를 함께 표시해야 하며 글리프는 사용중 `●`, 예약 `◷`, 청소중 `◐`, 종료확인 `⚠`, 빈방 `○`를 사용한다.

UX-DR4: contrast target은 일반 텍스트 4.5:1, 대형 텍스트 및 UI component 3:1을 기준으로 검증하고 brand gold는 body text에 쓰지 않으며 small gold text가 필요하면 더 짙은 gold를 사용한다.

UX-DR5: `종료확인`은 텍스트 배지용 어두운 orange와 glow ring/accent용 밝은 orange를 분리하고, pulse는 `prefers-reduced-motion: reduce`에서 정적 ring + `⚠` 라벨로 대체하며 3Hz를 넘지 않는 느린 opacity breathe로 제한한다.

UX-DR6: `빈방`은 filled bronze badge가 아니라 surface 배경, bronze border, 짙은 텍스트의 outline/ghost style로 구현한다.

UX-DR7: room status card는 객실명, status badge, 코스, 담당, 시작시간, 남은시간/종료예정, 상태별 안내 문구를 표시하고 종료확인 변형은 glow/ring과 "결제·확인 필요" 라벨을 제공한다.

UX-DR8: 첫화면 layout은 룸 카드 4열 grid를 최상단에 두고 KPI row와 하단 코스별 콜/남은시간 알림을 배치해 룸 상태가 항상 최우선으로 스캔되게 한다.

UX-DR9: 좌측 고정 sidebar는 운영 현황, 콜 원장, 정산, 월마감, 대시보드, 마스터 설정, 감사 로그 도메인 그룹 순서를 사용하고 권한 없는 그룹은 비활성이 아니라 숨긴다.

UX-DR10: 역할별 landing은 주인/관리자 첫화면 실시간 현황, 카운터 콜/예약 입력 원장, 정산 담당 정산 화면, 웨이터 객실 현황, 조회 전용 객실 현황으로 설정한다.

UX-DR11: editable call grid는 `Tab`/`Shift+Tab`, `Enter`, arrow keys, `Esc`를 지원하고 code field는 type-ahead dropdown을 사용하며 고객/메모/비고는 자유 텍스트를 지원한다.

UX-DR12: call grid는 cell blur 시 row-level autosave를 수행하고 상태는 `idle`, `saving`, `saved`, `error`로 표시하며 autosave 실패는 입력 유지, 인라인 retry, `저장 보류` 표시를 제공하고 조용히 드롭하지 않는다.

UX-DR13: computed cells(결제금액, 수당, 귀케어풀, 콜인정)는 readonly tint로 입력 셀과 구분하고 client UI가 calculation logic을 재구현하지 않는다.

UX-DR14: D코스 마사지사2 검증 오류는 danger ring, `!` 아이콘, 텍스트 메시지, `aria-invalid="true"`, `aria-describedby`, 차단 시 `role="alert"` 또는 `aria-live="assertive"`를 사용해 색상만으로 전달하지 않는다.

UX-DR15: type-ahead dropdown open state는 arrow-key option traversal, Enter select, Esc close without leaving the cell, roving focus 또는 `aria-activedescendant`, `aria-expanded`를 지원하고 keyboard trap을 만들지 않는다.

UX-DR16: monthly close stepper는 `작성중 → 검토중 → 마감확정 → 잠금` 수평 스테퍼로 표시하고 active 단계와 역할/상태 gate를 명확히 보여준다.

UX-DR17: 월마감 확정은 지급 총액, 대상 인원/구성 요약, 스냅샷 불변 경고를 보여주는 이중확인 flow를 사용하고 shadcn Dialog 기반 `role="alertdialog"`, focus trap, safe initial focus, Esc cancel, focus return을 구현한다.

UX-DR18: settlement evidence block은 계산 결과와 산출 근거(만근 인정일, 콜 수, 적용 수당 정책, 순위)를 항상 함께 표시하고 맨숫자만 보여주지 않는다.

UX-DR19: TV 현황판은 chrome/sidebar/input이 없는 fullscreen route로 구현하고 11개 객실을 대형 카드 grid로 표시하며 자동 갱신, 마지막 갱신 시각, 갱신 지연 상태를 제공한다.

UX-DR20: TV mode는 distance legibility를 위해 객실명 40px/900, status 28px/900, meta 22px 수준의 대형 typography ramp와 상태 글리프/라벨을 사용한다.

UX-DR21: dashboard/KPI loading은 shadcn Skeleton으로 layout outline을 유지하고 조회 실패는 retry affordance와 last value 유지 또는 명확한 failure state를 보여주며 blank screen을 만들지 않는다.

UX-DR22: empty states는 "이 날짜의 콜이 없습니다" 같은 한 문장과 다음 행동(콜 추가/날짜 변경)을 제공한다.

UX-DR23: v1 platform은 desktop web을 1차 표면으로 하고 최소 폭 1280px 수준의 조밀 ERP layout을 기준으로 하며 native mobile/tablet, dark mode, i18n은 제공하지 않는다.

UX-DR24: 화면 문구는 운영자가 바로 행동할 수 있는 짧은 한국어 라벨을 우선하고 status 값(`사용중`, `예약`, `청소중`, `종료확인`, `빈방`)과 call state(`방문완료`, `노쇼`, `취소`)는 원문 그대로 보존한다.

UX-DR25: chart/dashboard visual은 원본 엑셀에서 산출 가능한 지표만 표현하고 status colors를 임의 chart series color로 재사용해 잠긴 의미를 흐리지 않으며 call grid 입력 속도를 해치지 않는다.

UX-DR26: accessibility review의 blocking 항목인 contrast, reduced motion, D코스 ARIA error, 월마감 modal focus contract, status glyph reinforcement는 구현과 QA에서 회귀 검증 대상으로 유지한다.

### FR Coverage Map

FR1: Epic 3 - 실시간 객실/콜 첫 화면에서 오늘 운영 상태 요약을 제공한다.

FR2: Epic 3 - 객실 카드를 상태 토큰, 남은 시간, 종료확인 기준으로 시각화하고 객실/TV 화면이 같은 계산을 사용한다.

FR3: Epic 6 - 주인용 화면에서 매출, 콜, 객실, 노쇼/취소, 정산 순위를 시각화한다.

FR4: Epic 1 - 운영월 생성과 작성중/검토중/마감확정/잠금 상태 관리를 제공한다.

FR5: Epic 1 - 11개 객실 마스터와 고유 ID/표시명 분리를 제공한다.

FR6: Epic 1 - 운영팀, 귀케어팀, 마사지사 직원 마스터와 비활성 처리를 제공한다.

FR7: Epic 1 - A~E 코스 마스터와 D코스 마사지사2 필요 설정을 제공한다.

FR8: Epic 1 - 마사지사 수당과 운영팀 일/월 인센 정책 관리를 제공한다.

FR9: Epic 1 - 상태, 결제수단, 할인구분, 근무상태, 시간 슬롯 코드 관리를 제공한다.

FR10: Epic 2 - 카운터가 서비스 콜 원장의 핵심 입력 필드를 빠르게 입력할 수 있게 한다.

FR11: Epic 2 - 서비스 콜 상태 변경, 상태 이력, 방문완료 외 계산 제외, 감사 로그를 제공한다.

FR12: Epic 2 - 방문완료 기준 결제금액, 수당, 귀케어 풀, 콜인정 계산을 제공한다.

FR13: Epic 2 - 할인구분 기반 고정 100,000원 할인 계산을 제공한다.

FR14: Epic 2 - D코스 마사지사2 필수 검증과 담당자별 수당 계산을 제공한다.

FR15: Epic 2 - 일별 지출 입력과 일별/코스별 콜 요약을 제공한다.

FR16: Epic 3 - 객실별 최신 활성 콜 기준 상태 계산을 제공한다.

FR17: Epic 3 - 코스 시간과 시작시간 기준 남은분, 종료예정, 종료확인 표시를 제공한다.

FR18: Epic 3 - 상태별 웨이터 안내 문구와 TV 핵심 문구 노출을 제공한다.

FR19: Epic 3 - 조회 전용 TV 현황판과 자동 갱신을 제공한다.

FR20: Epic 4 - 마사지사 일별 출퇴근 입력, 자정 넘김 계산, 만근 인정 기초를 제공한다.

FR21: Epic 4 - 마사지사1/2 배정 콜을 모두 인정하는 마사지사 일일정산을 제공한다.

FR22: Epic 4 - 귀케어사 일별 근무상태 입력과 지급 대상 판정을 제공한다.

FR23: Epic 4 - 귀케어 풀 균등 분배와 정상근무자 0명 지급액 0원 처리를 제공한다.

FR24: Epic 4 - 운영팀 근무상태와 일 총콜 기준 일일 인센 계산을 제공한다.

FR25: Epic 4 - 운영월 총콜 기준 운영팀 월 인센 미리보기를 제공한다.

FR26: Epic 5 - 운영월 마사지사, 운영팀, 귀케어 지급액 월마감 미리보기를 제공한다.

FR27: Epic 5 - 만근 인정일 20일 이상 만근수당 계산을 제공한다.

FR28: Epic 5 - 월 총콜 40콜 이상 갯수왕 1~3위 수당 계산과 근거 표시를 제공한다.

FR29: Epic 5 - 월마감 미리보기, 검토, 확정, 잠금과 마감 스냅샷을 제공한다.

FR30: Epic 5 - 관리자 사유 기반 월마감 재오픈과 감사 로그를 제공한다.

FR31: Epic 6 - 조회날짜 기준 오늘 KPI 대시보드를 제공한다.

FR32: Epic 6 - 운영월 기준 월간 KPI와 확정 스냅샷 기준 조회를 제공한다.

FR33: Epic 6 - 원본 엑셀에서 산출 가능한 주인용 그래프 리포트를 제공한다.

FR34: Epic 1 - 관리자, 카운터, 웨이터, 정산 담당, 조회 전용 권한을 제공한다.

FR35: Epic 1 - 민감 변경의 삭제 불가능한 감사 로그 기반을 제공한다.

FR36: Epic 7 - 원본 12개 시트와 숨김 시트 `목록`의 ERP 기능 매핑표를 제공한다.

FR37: Epic 7 - 샘플/이관 데이터 기준 원본 엑셀과 ERP 핵심 계산 대조 검증을 제공한다.

## Epic List

### Epic 1: ERP 운영 기준과 접근 통제

관리자가 ERP를 시작하고 로그인, 권한, 운영월, 객실, 직원, 코스, 수당/인센, 코드/시간 슬롯을 설정하며 변경 이력을 남길 수 있다.

**FRs covered:** FR4, FR5, FR6, FR7, FR8, FR9, FR34, FR35

### Epic 2: 콜 원장 입력과 방문완료 계산

카운터가 엑셀처럼 빠르게 예약/콜을 입력하고 상태, 결제, 할인, 담당자, 지출을 관리하며 `방문완료` 기준 계산을 즉시 확인할 수 있다.

**FRs covered:** FR10, FR11, FR12, FR13, FR14, FR15

### Epic 3: 실시간 객실 현황과 TV 현황판

주인, 웨이터, 조회 전용 사용자가 11개 객실의 현재 상태, 남은 시간, 종료확인, 안내 문구를 같은 계산 기준으로 확인할 수 있다.

**FRs covered:** FR1, FR2, FR16, FR17, FR18, FR19

### Epic 4: 일정산과 운영팀 인센

정산 담당자가 마사지사, 귀케어, 운영팀의 일별 근무상태와 지급액을 검토하고 산출 근거와 함께 확인할 수 있다.

**FRs covered:** FR20, FR21, FR22, FR23, FR24, FR25

### Epic 5: 월마감 확정, 잠금, 재오픈

정산 담당자와 관리자가 월 지급액을 미리보기, 검토, 확정, 잠금, 재오픈 흐름으로 안전하게 처리하고 확정 스냅샷을 보존할 수 있다.

**FRs covered:** FR26, FR27, FR28, FR29, FR30

### Epic 6: 주인용 KPI와 시각화 대시보드

주인이 오늘/월간 매출, 콜, 객실, 노쇼/취소, 마사지사 순위, 운영팀 인센 흐름을 한눈에 판단할 수 있다.

**FRs covered:** FR3, FR31, FR32, FR33

### Epic 7: 엑셀 기능 매핑과 계산 대조 검증

운영자와 개발/QA가 원본 12개 시트와 숨김 시트 `목록`이 ERP로 누락 없이 이전됐는지 확인하고 핵심 계산 결과를 대조할 수 있다.

**FRs covered:** FR36, FR37

## Epic 1: ERP 운영 기준과 접근 통제

관리자가 ERP를 시작하고 로그인, 권한, 운영월, 객실, 직원, 코스, 수당/인센, 코드/시간 슬롯을 설정하며 변경 이력을 남길 수 있다.

### Story 1.1: Next.js ERP 앱 쉘과 디자인 토큰 기반 구축

As a 관리자,
I want ERP의 기본 앱 쉘과 디자인 시스템 기반이 준비되기를,
So that 이후 운영월, 마스터, 콜 원장, 객실 현황, 정산 화면을 같은 구조와 시각 규칙 위에서 구현할 수 있다.

**Acceptance Criteria:**

**Given** 기존 문서와 `src/modules` 스캐폴드가 있는 프로젝트 루트가 있다
**When** 공식 Next.js App Router starter를 초기화/병합한다
**Then** `package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `src/app` 기본 구조가 생성된다
**And** 기존 `_bmad-output`, `docs`, `src/modules` 문서는 삭제되거나 덮어써지지 않는다.

**Given** 앱이 Tailwind CSS v4와 shadcn/ui를 사용한다
**When** 전역 스타일과 shadcn 설정을 구성한다
**Then** Royal Gold 브랜드 토큰, background/surface/text/border/muted/danger/readonly tint, 잠긴 status 토큰이 theme layer에 정의된다
**And** `사용중`, `예약`, `청소중`, `종료확인`, `빈방` 토큰은 이후 화면에서 재사용 가능한 이름으로 노출된다.

**Given** 사용자가 ERP 웹앱에 접근한다
**When** 루트 페이지가 렌더링된다
**Then** 기본 ERP shell은 좌측 sidebar, topbar, content 영역을 가진다
**And** sidebar 도메인 그룹은 운영 현황, 콜 원장, 정산, 월마감, 대시보드, 마스터 설정, 감사 로그 순서를 따른다.

**Given** v1 플랫폼 제약이 적용된다
**When** 앱 shell layout을 구성한다
**Then** 1차 표면은 최소 폭 1280px 수준의 데스크톱 웹 ERP로 설계된다
**And** native mobile/tablet, dark mode, i18n은 v1 범위에 포함하지 않는다.

**Given** 아직 실제 인증과 데이터가 연결되지 않은 상태다
**When** 앱 shell을 확인한다
**Then** 화면은 한국어 운영 라벨을 사용한다
**And** dummy/placeholder UI는 향후 실제 기능과 혼동되지 않도록 최소화한다.

**Given** 상태 badge 또는 token preview가 구현된다
**When** 상태가 표시된다
**Then** 색상만으로 의미를 전달하지 않고 텍스트 라벨과 글리프를 함께 표시한다
**And** 글리프는 사용중 `●`, 예약 `◷`, 청소중 `◐`, 종료확인 `⚠`, 빈방 `○` 규칙을 따른다.

**Given** 앱이 로딩 또는 빈 상태를 표시해야 한다
**When** shell 수준의 placeholder 상태가 필요하다
**Then** shadcn Skeleton 또는 명확한 빈 상태 문구를 사용한다
**And** blank screen으로 보이지 않는다.

**Given** 개발자가 앱을 검증한다
**When** `pnpm lint` 또는 초기 프로젝트에서 제공되는 동등한 정적 검사를 실행한다
**Then** 앱 쉘과 스타일 설정은 오류 없이 통과한다
**And** 확정된 패키지/도구 버전은 `package.json`에 기록된다.

### Story 1.2: 직원 계정 로그인과 역할별 랜딩/사이드바

As a 직원 사용자,
I want 내 계정으로 로그인하면 역할에 맞는 첫 화면과 메뉴만 보이기를,
So that 각 사용자 역할이 허용된 ERP 업무만 안전하게 수행할 수 있다.

**Acceptance Criteria:**

**Given** 관리자에 의해 생성된 직원 계정이 있다
**When** 직원이 이메일 또는 계정 ID와 비밀번호로 로그인한다
**Then** 인증은 Auth.js/NextAuth 기반으로 처리된다
**And** public signup은 제공되지 않는다.

**Given** 직원 계정의 비밀번호가 저장된다
**When** 계정이 생성되거나 비밀번호가 변경된다
**Then** 비밀번호는 Argon2id hash로 저장된다
**And** plaintext 또는 reversible password material은 저장되지 않는다.

**Given** 로그인 사용자가 관리자, 카운터, 웨이터, 정산 담당, 조회 전용 중 하나의 역할을 가진다
**When** 로그인 후 ERP에 진입한다
**Then** 사용자는 역할별 landing 화면으로 이동한다
**And** 관리자/주인은 첫화면 실시간 현황, 카운터는 콜/예약 입력 원장, 정산 담당은 정산 화면, 웨이터와 조회 전용은 객실 현황으로 이동한다.

**Given** 사용자가 sidebar를 본다
**When** 사용자의 역할에 허용되지 않은 도메인 그룹이 있다
**Then** 해당 그룹은 비활성 표시가 아니라 숨겨진다
**And** 허용된 그룹은 운영 현황, 콜 원장, 정산, 월마감, 대시보드, 마스터 설정, 감사 로그의 고정 순서를 유지한다.

**Given** 사용자가 권한이 없는 route에 직접 접근한다
**When** 서버에서 요청을 처리한다
**Then** route/layout 또는 server boundary에서 접근을 차단한다
**And** UI에서 메뉴를 숨기는 것만으로 보안을 대신하지 않는다.

**Given** 사용자가 지급액, 수당, 마감, 직원 정보에 영향을 주는 작업을 요청한다
**When** Server Action 또는 Route Handler가 실행된다
**Then** 현재 계정 상태와 권한을 서버에서 다시 확인한다
**And** session payload의 role hint만 신뢰하지 않는다.

**Given** 직원 계정이 비활성 상태이거나 반복 로그인 실패로 잠겼다
**When** 해당 계정으로 로그인하려 한다
**Then** 로그인은 거부된다
**And** 사용자에게 안전한 한국어 오류 메시지가 표시된다.

**Given** 개발자가 인증/권한 기능을 검증한다
**When** 역할별 route 접근과 sidebar 노출을 테스트한다
**Then** 각 역할은 허용된 landing과 메뉴만 볼 수 있다
**And** 권한 없는 민감 action은 서버에서 실패한다.

### Story 1.3: 감사 로그 기반과 조회 화면

As a 관리자,
I want 지급액이나 운영 상태에 영향을 주는 변경 이력을 감사 로그로 남기고 조회하기를,
So that 엑셀 전환 후 누가 무엇을 바꿨는지 추적하고 과거 정산의 신뢰성을 지킬 수 있다.

**Acceptance Criteria:**

**Given** 감사 로그가 필요한 도메인 변경이 발생한다
**When** domain service 또는 Server Action이 변경을 저장한다
**Then** 감사 로그는 actor ID, action name, target type, target ID, before value, after value, timestamp를 기록한다
**And** 필요한 경우 reason을 함께 기록할 수 있다.

**Given** 감사 이벤트 이름이 기록된다
**When** 이벤트가 저장된다
**Then** action name은 `service_call.status_changed`, `monthly_close.confirmed` 같은 dot notation을 사용한다
**And** 이벤트 이름은 도메인 계산을 대신하지 않고 변경 이력만 설명한다.

**Given** 일반 운영 사용자가 감사 로그를 삭제하려 한다
**When** 삭제 요청이 발생한다
**Then** 일반 운영 경로에서는 감사 로그 삭제가 허용되지 않는다
**And** 감사 로그는 불변 이력으로 보존된다.

**Given** 관리자가 감사 로그 화면에 접근한다
**When** 감사 로그 목록을 조회한다
**Then** 행위자, 액션, 대상, 변경 전후값, 시각이 표시된다
**And** 지급액 영향 변경을 빠르게 찾을 수 있도록 대상 유형 또는 기간 기준 조회를 지원한다.

**Given** 권한이 없는 사용자가 감사 로그 화면에 접근한다
**When** route 또는 Server Action이 요청을 처리한다
**Then** 접근은 서버에서 차단된다
**And** sidebar에서 감사 로그 그룹은 허용 역할에게만 표시된다.

**Given** 이후 마스터, 콜 원장, 정산, 월마감 story가 변경 이력을 남겨야 한다
**When** 해당 story가 감사 로그 서비스를 호출한다
**Then** 공통 감사 로그 서비스와 payload 형식을 재사용할 수 있다
**And** 각 story는 자체 도메인 변경 전후값만 제공하면 된다.

**Given** 개발자가 감사 로그 기반을 검증한다
**When** 감사 이벤트 생성, 조회, 권한 차단, 삭제 불가 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 후속 story에서 감사 로그 기록을 미래 의존 없이 사용할 수 있다.

### Story 1.4: 운영월 관리

As a 관리자,
I want 운영월을 생성하고 상태를 관리하기를,
So that 모든 콜 입력, 정산, 대시보드, 월마감이 같은 운영월 기준으로 계산될 수 있다.

**Acceptance Criteria:**

**Given** 관리자가 마스터 설정의 운영월 화면에 접근한다
**When** 새 운영월을 생성한다
**Then** 운영월은 `YYYY-MM`, 월 시작일, 월 종료일을 가진다
**And** 기본 상태는 `작성중`으로 저장된다.

**Given** 같은 `YYYY-MM` 운영월이 이미 존재한다
**When** 관리자가 동일한 운영월을 다시 생성하려 한다
**Then** 저장은 차단된다
**And** 중복 운영월 오류가 한국어로 표시된다.

**Given** 운영월 목록이 있다
**When** 관리자가 운영월 화면을 조회한다
**Then** 운영월, 시작일, 종료일, 현재 상태, 생성/수정 시각이 표시된다
**And** 최신 운영월 또는 현재 날짜가 속한 운영월을 쉽게 선택할 수 있다.

**Given** 운영월 상태가 `작성중`이다
**When** 관리자가 상태를 `검토중`으로 변경한다
**Then** 상태 변경이 저장된다
**And** 이후 콜/정산 화면은 변경된 운영월 상태를 조회할 수 있다.

**Given** 운영월 상태가 `마감확정` 또는 `잠금`이다
**When** 일반 사용자가 지급 영향 데이터 변경을 시도한다
**Then** 이후 story에서 구현될 데이터 변경 흐름이 이 상태를 권한/잠금 기준으로 사용할 수 있도록 상태값이 명확히 제공된다
**And** 이 story에서는 월마감 계산이나 재오픈 자체를 구현하지 않는다.

**Given** 운영월이 생성되거나 상태가 변경된다
**When** 저장이 완료된다
**Then** 행위자, 대상 운영월, 변경 전후 상태, 시각이 감사 로그로 기록된다
**And** 감사 로그는 일반 운영 경로에서 삭제할 수 없다.

**Given** 운영월 날짜 조건이 필요하다
**When** 도메인 서비스가 운영월을 조회한다
**Then** 월간 집계가 Excel 행 범위가 아니라 운영월 시작일/종료일로 계산될 수 있도록 날짜 범위를 반환한다
**And** 날짜는 ISO `YYYY-MM-DD` 형식을 사용한다.

**Given** 개발자가 운영월 기능을 검증한다
**When** 생성, 중복 생성 차단, 상태 변경, 감사 로그 기록 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 운영월 상태값은 월마감 story에서 재사용할 수 있다.

### Story 1.5: 객실 마스터 관리

As a 관리자,
I want 11개 객실을 고유 ID와 표준 표시명으로 관리하기를,
So that 콜 원장, 객실 현황, TV 현황판이 객실명을 안정적으로 참조하고 표시할 수 있다.

**Acceptance Criteria:**

**Given** 관리자가 객실 마스터 화면에 접근한다
**When** 초기 객실 목록을 조회한다
**Then** 기본 객실 `101 호실`, `102 호실`, `103 호실`, `201 호실`, `202 호실`, `203 호실`, `301 호실`, `302 호실`, `303 호실`, `401 호실`, `402 호실`이 표시된다
**And** 각 객실은 표시명과 별도의 고유 ID를 가진다.

**Given** 관리자가 객실 표시명을 수정한다
**When** 저장한다
**Then** 표시명 변경은 저장된다
**And** 객실 고유 ID는 변경되지 않는다.

**Given** 숨김 시트 `목록`의 `1번방` 형식 이관 참조값이 있다
**When** 객실 마스터가 표시된다
**Then** 운영 표준 표시명은 `101 호실` 형식을 사용한다
**And** `1번방` 형식은 이관/검증 참조값으로만 보존된다.

**Given** 객실이 콜 원장 또는 객실 현황에서 참조될 수 있다
**When** 관리자가 객실을 삭제하려 한다
**Then** 물리 삭제 대신 비활성 처리를 사용한다
**And** 과거 콜/정산/현황 이력의 객실 참조는 깨지지 않는다.

**Given** 객실 순서가 TV 현황판과 객실 현황에 필요하다
**When** 관리자가 객실 표시 순서를 확인하거나 수정한다
**Then** 객실은 정렬 순서를 가진다
**And** 이후 객실 카드/TV 화면은 이 순서를 사용할 수 있다.

**Given** 객실 정보가 생성, 수정, 비활성 처리된다
**When** 저장이 완료된다
**Then** 행위자, 대상 객실, 변경 전후값, 시각이 감사 로그로 기록된다
**And** 감사 로그는 객실 상태 계산을 대신하지 않고 변경 이력만 보존한다.

**Given** 개발자가 객실 마스터를 검증한다
**When** 기본 11개 객실 seed, 표시명 수정, 비활성 처리, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 객실 식별은 표시명이 아니라 고유 ID 기준임이 검증된다.

### Story 1.6: 코드와 시간 슬롯 관리

As a 관리자,
I want 상태, 결제수단, 할인구분, 근무상태, 시간 슬롯 코드를 관리하기를,
So that 콜 원장과 정산 화면이 원본 엑셀의 드롭다운 값을 누락 없이 사용할 수 있다.

**Acceptance Criteria:**

**Given** 관리자가 코드 관리 화면에 접근한다
**When** 상태 코드 목록을 조회한다
**Then** `예약`, `사용중`, `청소중`, `방문완료`, `노쇼`, `취소`가 포함된다
**And** 상태 표시값은 한국어 원문 그대로 보존된다.

**Given** 관리자가 결제수단 코드 목록을 조회한다
**When** 목록이 표시된다
**Then** `현금`, `카드`, `계좌`, `기타`가 포함된다
**And** 비활성 처리는 가능하지만 과거 콜 참조값은 깨지지 않는다.

**Given** 관리자가 할인구분 코드 목록을 조회한다
**When** 목록이 표시된다
**Then** `일주일내방문`, `생일자`, `후기작성`이 포함된다
**And** 할인금액 다양화는 v1 범위에 포함하지 않는다.

**Given** 관리자가 근무상태 코드 목록을 조회한다
**When** 목록이 표시된다
**Then** `정상`, `휴무`, `지각`, `조퇴`, `결근`이 포함된다
**And** 정산 story에서 정상 상태만 지급 대상 판정에 사용할 수 있다.

**Given** 관리자가 시간 슬롯 목록을 조회한다
**When** 입력 시간 슬롯이 표시된다
**Then** `11:00`부터 `01:00`까지 30분 단위 슬롯이 제공된다
**And** 자정을 넘는 `00:00`, `00:30`, `01:00` 슬롯도 포함된다.

**Given** 코드 또는 시간 슬롯이 콜 원장, 정산, 객실 현황에서 참조될 수 있다
**When** 관리자가 값을 삭제하려 한다
**Then** 물리 삭제 대신 비활성 처리를 사용한다
**And** 과거 데이터의 코드 참조는 유지된다.

**Given** 코드 값이나 시간 슬롯이 생성, 수정, 비활성 처리된다
**When** 저장이 완료된다
**Then** 행위자, 코드 유형, 변경 전후값, 시각이 감사 로그로 기록된다
**And** 감사 로그는 코드 의미를 대신 계산하지 않고 변경 이력만 보존한다.

**Given** 개발자가 코드 관리 기능을 검증한다
**When** 기본 코드 seed, 시간 슬롯 생성, 비활성 처리, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 콜 원장 story에서 type-ahead dropdown 값으로 재사용할 수 있다.

### Story 1.7: 직원 마스터와 계정 연결

As a 관리자,
I want 직원 정보를 안정적인 고유 ID로 관리하고 필요 시 로그인 계정과 연결하기를,
So that 직원 표시명 변경이나 계정 상태 변경이 콜 입력, 정산, 과거 스냅샷을 깨지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 관리자가 직원 마스터 화면에 접근한다
**When** 초기 직원 그룹을 조회한다
**Then** 운영팀 5명, 귀케어팀 4명, 마사지사 50명을 관리할 수 있는 구조가 제공된다
**And** 각 직원은 표시명과 별도의 고유 ID를 가진다.

**Given** 관리자가 직원 정보를 생성하거나 수정한다
**When** 저장한다
**Then** 직원은 이름, 역할, 주/야간, 기본급, 연락처, 생일, 입사일, 재직상태를 가진다
**And** 필수값 누락은 한국어 오류 메시지로 차단된다.

**Given** 직원 이름이 변경된다
**When** 관리자가 새 이름을 저장한다
**Then** 현재 표시명은 변경된다
**And** 과거 콜, 정산, 월마감 스냅샷은 직원 고유 ID 기준으로 유지된다.

**Given** 직원이 퇴사했거나 더 이상 선택 대상이 아니다
**When** 관리자가 직원을 삭제하려 한다
**Then** 물리 삭제 대신 비활성 처리한다
**And** 과거 기록과 감사 로그의 직원 참조는 유지된다.

**Given** 직원이 ERP에 로그인해야 한다
**When** 관리자가 직원에게 로그인 계정을 연결한다
**Then** `UserAccount`와 `Employee`는 분리된 모델로 연결된다
**And** 계정 비활성/잠금 상태 변경은 직원 마스터의 정산 이력을 변경하지 않는다.

**Given** 직원 역할이 관리자, 카운터, 웨이터, 정산 담당, 조회 전용 중 하나로 지정된다
**When** 계정이 연결된 직원이 로그인한다
**Then** Story 1.2의 역할별 랜딩과 권한 규칙을 사용할 수 있다
**And** UI 권한과 서버 실행 권한은 같은 역할 기준을 사용한다.

**Given** 직원 정보 또는 계정 연결이 생성, 수정, 비활성 처리된다
**When** 저장이 완료된다
**Then** 행위자, 대상 직원 또는 계정, 변경 전후값, 시각이 감사 로그로 기록된다
**And** 지급액에 영향을 줄 수 있는 변경은 감사 로그 대상임이 명확하다.

**Given** 개발자가 직원 마스터 기능을 검증한다
**When** 직원 생성, 이름 변경, 비활성 처리, 계정 연결, 역할별 접근, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 직원 식별은 이름 문자열이 아니라 고유 ID 기준임이 검증된다.

### Story 1.8: 코스 마스터와 수당/인센 정책 관리

As a 관리자,
I want 코스, 마사지사 수당, 운영팀 인센 정책을 적용월 이력으로 관리하기를,
So that 콜 계산과 정산이 현재 정책을 쓰면서도 과거 지급액은 흔들리지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 관리자가 코스 마스터 화면에 접근한다
**When** 기본 코스 목록을 조회한다
**Then** A 60분, B 90분, C 90분, D 90분 2:1, E 120분 코스가 표시된다
**And** 각 코스는 고유 ID, 이름, 시간, 기본판매가, 운영팀 콜인정, 귀케어 풀/콜, 마사지사2 필요 여부, TV 표시명을 가진다.

**Given** 관리자가 D코스를 조회한다
**When** 코스 상세가 표시된다
**Then** D코스는 `마사지사2 필요`가 Y로 관리된다
**And** 이 설정은 콜 원장 D코스 검증 story에서 사용할 수 있다.

**Given** 관리자가 코스 가격 또는 표시 정보를 변경한다
**When** 저장한다
**Then** 변경값은 적용 시작월과 적용 종료월을 가진 정책 이력으로 저장된다
**And** 표시명 변경은 코스 고유 ID를 변경하지 않는다.

**Given** 관리자가 마사지사 개인별 코스 수당을 관리한다
**When** 마사지사, 코스, 금액, 적용 시작월, 적용 종료월을 저장한다
**Then** 수당 정책은 해당 적용월 범위에서만 사용된다
**And** 원본 엑셀의 마사지사5~50 수당 0원은 초기 이관값으로 보존하고 수정 가능하다.

**Given** 관리자가 운영팀 일일 인센 정책을 조회한다
**When** 정책이 표시된다
**Then** 일 총콜 30/40/50 기준과 개인별 50,000/100,000/200,000 지급액이 보존된다
**And** 정책은 적용월 이력을 가진다.

**Given** 관리자가 운영팀 월 인센 정책을 조회한다
**When** 정책이 표시된다
**Then** 월 총콜 1000/1100/1200/1300/1400/1500 구간과 팀장 30%, 카운터팀 35%, 웨이터팀 35% 분배율이 보존된다
**And** 정책은 적용월 이력을 가진다.

**Given** 코스, 수당, 인센 정책이 과거 월마감 스냅샷에 영향을 줄 수 있다
**When** 관리자가 정책을 변경한다
**Then** 현재/미래 계산에 사용할 새 정책 이력이 생성되거나 종료월이 조정된다
**And** 확정된 과거 월마감 스냅샷은 자동 재계산되지 않는다.

**Given** 코스, 수당, 인센 정책이 생성, 수정, 비활성 처리된다
**When** 저장이 완료된다
**Then** 행위자, 대상 정책, 변경 전후값, 적용월, 시각이 감사 로그로 기록된다
**And** 지급액에 영향을 주는 변경으로 분류된다.

**Given** 개발자가 정책 관리 기능을 검증한다
**When** 기본 코스 seed, D코스 2인 설정, 수당 0원 초기값, 일/월 인센 정책, 적용월 이력, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 콜 계산과 정산 story에서 정책 조회 서비스를 재사용할 수 있다.

## Epic 2: 콜 원장 입력과 방문완료 계산

카운터가 엑셀처럼 빠르게 예약/콜을 입력하고 상태, 결제, 할인, 담당자, 지출을 관리하며 `방문완료` 기준 계산을 즉시 확인할 수 있다.

### Story 2.1: 날짜별 콜 원장 그리드 조회와 기본 입력

As a 카운터,
I want 운영월과 날짜별로 콜 원장을 조회하고 기본 콜 정보를 입력하기를,
So that 예약과 방문 흐름을 원본 `실시간콜입력`처럼 빠르게 기록할 수 있다.

**Acceptance Criteria:**

**Given** 카운터가 콜/예약 입력 원장 화면에 접근한다
**When** 운영월과 조회날짜를 선택한다
**Then** 해당 날짜의 콜 원장 그리드가 표시된다
**And** 월 최대 31일 범위 안에서 날짜별로 조회할 수 있다.

**Given** 선택한 날짜의 콜 원장이 비어 있다
**When** 화면이 표시된다
**Then** "이 날짜의 콜이 없습니다" 빈 상태와 `새 콜 행 추가` 행동이 표시된다
**And** blank screen으로 보이지 않는다.

**Given** 카운터가 새 콜 행을 추가한다
**When** 기본 입력 필드를 작성한다
**Then** 날짜, 시간, 객실, 코스, 고객/메모, 마사지사1, 마사지사2, 귀케어 담당, 상태, 할인구분, 결제수단, 비고, 확인값을 입력할 수 있다
**And** 입력 필드는 원본 `실시간콜입력` A:S의 업무 의미를 보존한다.

**Given** 카운터가 객실, 코스, 상태, 할인구분, 결제수단, 확인값을 입력한다
**When** 선택 목록이 표시된다
**Then** 값은 Epic 1의 마스터/코드/시간 슬롯 기준으로 제공된다
**And** 표시명은 보여주되 저장 참조는 고유 ID 또는 안정 코드 기준을 사용한다.

**Given** 카운터가 운영월 날짜 범위를 벗어난 날짜로 콜을 입력하려 한다
**When** 저장을 시도한다
**Then** 저장은 차단된다
**And** 운영월 범위를 벗어났다는 한국어 오류가 표시된다.

**Given** 운영월이 `잠금` 상태다
**When** 카운터가 해당 운영월의 콜을 새로 추가하거나 수정하려 한다
**Then** 입력은 read-only 또는 서버 권한 오류로 차단된다
**And** 잠긴 운영월이라는 한국어 안내가 표시된다.

**Given** 콜 원장 그리드가 데이터를 조회한다
**When** 로딩 중이다
**Then** 행 스켈레톤 또는 명확한 로딩 상태가 표시된다
**And** 데이터가 없는 상태와 로딩 상태가 구분된다.

**Given** 개발자가 콜 원장 기본 입력을 검증한다
**When** 날짜별 조회, 새 행 추가, 필드 입력, 운영월 범위 차단, 잠금 차단 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 이 story는 결제/수당 계산 없이도 기본 콜 원장 입력 기능으로 동작한다.

### Story 2.2: 콜 행 자동저장과 상태 변경 이력

As a 카운터,
I want 콜 행을 수정하면 행 단위로 자동저장되고 상태 변경 이력이 남기를,
So that 엑셀처럼 빠르게 입력하면서도 누가 어떤 운영 상태를 바꿨는지 추적할 수 있다.

**Acceptance Criteria:**

**Given** 카운터가 콜 원장 그리드의 입력 셀을 수정한다
**When** 셀에서 blur되거나 행 commit 동작이 발생한다
**Then** 해당 행은 row-level Server Action으로 자동저장된다
**And** 전체 월 그리드가 아니라 수정된 행만 저장 요청 대상이 된다.

**Given** 행 자동저장이 진행 중이다
**When** 저장 요청이 처리된다
**Then** 행 상태는 `저장중`으로 표시된다
**And** 저장 성공 후 `저장됨` 상태와 최신 저장 시각 또는 시각적 확인이 표시된다.

**Given** 자동저장이 실패한다
**When** 서버 오류, 검증 오류, 네트워크 오류가 발생한다
**Then** 입력값은 화면에 유지된다
**And** 행 상태는 `저장 보류` 또는 `error`로 표시되고 인라인 retry 동작이 제공된다.

**Given** 카운터가 콜 상태를 `예약`, `사용중`, `청소중`, `방문완료`, `노쇼`, `취소` 중 하나로 변경한다
**When** 행이 저장된다
**Then** 상태 변경 이력이 저장된다
**And** 이전 상태, 새 상태, 변경자, 변경 시각이 남는다.

**Given** 카운터가 결제수단, 할인구분, 담당자, 확인값처럼 지급 또는 운영 상태에 영향을 줄 수 있는 값을 수정한다
**When** 저장이 완료된다
**Then** 감사 로그가 행위자, 대상 콜, 변경 전후값, 시각을 기록한다
**And** 감사 로그는 도메인 계산을 대신하지 않고 변경 이력만 보존한다.

**Given** 운영월이 `잠금` 상태이거나 사용자가 수정 권한이 없다
**When** 자동저장 Server Action이 실행된다
**Then** 서버에서 저장을 차단한다
**And** UI에는 안전한 한국어 오류 메시지가 표시된다.

**Given** Server Action이 저장 결과를 반환한다
**When** 저장이 성공한다
**Then** 응답은 `ActionResult<T>` 형태로 반환된다
**And** 저장된 행 상태와 표시용 DTO를 포함한다.

**Given** 개발자가 자동저장과 상태 변경 이력을 검증한다
**When** 성공 저장, 실패 보류, retry, 상태 변경 이력, 감사 로그, 잠금/권한 차단 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 이 story는 방문완료 계산이 아직 없어도 행 저장과 이력 추적으로 동작한다.

### Story 2.3: 방문완료 기준 결제/수당/콜인정 계산

As a 카운터,
I want 콜 상태가 `방문완료`일 때 결제금액과 정산 기초값이 자동 계산되기를,
So that 엑셀 수식처럼 즉시 결과를 확인하면서도 계산 기준은 서버 도메인 로직으로 보존할 수 있다.

**Acceptance Criteria:**

**Given** 서비스 콜 상태가 `방문완료`가 아니다
**When** 콜 행이 저장되거나 조회된다
**Then** 결제금액, 마사지사1수당, 마사지사2수당, 귀케어 풀, 콜인정은 0 또는 `—`로 표시된다
**And** 해당 콜은 매출, 수당, 귀케어 풀, 콜인정 집계에 포함되지 않는다.

**Given** 서비스 콜 상태가 `방문완료`이다
**When** 콜 행이 저장된다
**Then** 결제금액은 코스 기본판매가에서 할인금액을 차감해 계산된다
**And** 콜인정은 1로 계산된다.

**Given** 할인구분이 비어 있다
**When** `방문완료` 콜을 계산한다
**Then** 할인금액은 0이다
**And** 결제금액은 코스 기본판매가와 같다.

**Given** 할인구분이 `일주일내방문`, `생일자`, `후기작성` 중 하나다
**When** `방문완료` 콜을 계산한다
**Then** 할인금액은 원본 엑셀 규칙처럼 100,000이다
**And** 복잡한 할인 금액 다양화는 적용하지 않는다.

**Given** 마사지사1이 배정되어 있고 적용월에 해당하는 코스 수당 정책이 있다
**When** `방문완료` 콜을 계산한다
**Then** 마사지사1수당은 해당 마사지사/코스/적용월 정책 금액으로 계산된다
**And** 직원명 문자열이 아니라 직원 고유 ID로 정책을 조회한다.

**Given** 마사지사2가 배정되어 있고 적용월에 해당하는 코스 수당 정책이 있다
**When** `방문완료` 콜을 계산한다
**Then** 마사지사2수당은 마사지사1과 별도로 계산된다
**And** 마사지사2 담당 콜도 이후 정산 총콜에 포함될 수 있는 계산 결과를 제공한다.

**Given** 코스에 귀케어 풀/콜 금액이 설정되어 있다
**When** `방문완료` 콜을 계산한다
**Then** 귀케어 풀은 코스 정책의 귀케어 풀/콜 값으로 계산된다
**And** 귀케어 일일정산 story에서 이 값을 사용할 수 있다.

**Given** 계산 결과가 콜 원장 그리드에 표시된다
**When** 행 저장 또는 조회가 완료된다
**Then** 결제금액, 수당, 귀케어 풀, 콜인정은 computed readonly cell로 표시된다
**And** client UI는 계산 로직을 재구현하지 않는다.

**Given** 개발자가 방문완료 계산을 검증한다
**When** 방문완료/비완료 상태, 할인 없음/있음, 마사지사1/2 수당, 귀케어 풀, 콜인정 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 domain service에서 수행된다.

### Story 2.4: D코스 마사지사2 필수 검증

As a 카운터,
I want D코스에서 마사지사2가 없으면 저장 또는 방문완료 처리가 차단되기를,
So that 2:1 코스의 담당자 누락으로 수당과 콜 인정이 틀어지지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 코스 마스터에서 D코스가 `마사지사2 필요`로 설정되어 있다
**When** 카운터가 D코스 콜 행을 입력한다
**Then** 시스템은 해당 코스가 마사지사2 필수 대상임을 인식한다
**And** 코스명 문자열이 아니라 코스 고유 ID와 정책 설정 기준으로 판단한다.

**Given** D코스 콜 행에 마사지사2가 비어 있다
**When** 카운터가 행을 저장하려 한다
**Then** 저장은 차단된다
**And** 마사지사2 필수 오류가 한국어로 표시된다.

**Given** D코스 콜 행에 마사지사2가 비어 있다
**When** 카운터가 상태를 `방문완료`로 변경하려 한다
**Then** 방문완료 처리는 차단된다
**And** 결제금액, 수당, 귀케어 풀, 콜인정 계산은 완료 처리되지 않는다.

**Given** D코스 콜 행에 마사지사2 오류가 표시된다
**When** 오류 UI가 렌더링된다
**Then** 마사지사2 셀에는 danger ring과 `!` 아이콘, 텍스트 메시지가 함께 표시된다
**And** 색상만으로 오류 의미를 전달하지 않는다.

**Given** D코스 마사지사2 오류가 발생한다
**When** 사용자가 키보드 또는 스크린리더로 셀에 접근한다
**Then** 마사지사2 셀은 `aria-invalid="true"`를 가진다
**And** 오류 메시지는 `aria-describedby`로 셀에 연결된다.

**Given** 카운터가 저장 또는 방문완료 차단을 트리거한다
**When** 오류 메시지가 나타난다
**Then** 오류 메시지는 `role="alert"` 또는 `aria-live="assertive"`로 알림된다
**And** 사용자는 어떤 필드를 수정해야 하는지 알 수 있다.

**Given** A, B, C, E 코스 콜 행이 있다
**When** 마사지사2가 비어 있는 상태로 저장한다
**Then** 저장은 허용된다
**And** 마사지사2 수당은 0 또는 `—`로 표시된다.

**Given** D코스 콜 행에 마사지사1과 마사지사2가 모두 배정되어 있다
**When** 저장 또는 방문완료 처리를 한다
**Then** 저장이 허용된다
**And** 각 담당자 수당은 Story 2.3 계산 규칙에 따라 별도로 계산된다.

**Given** 개발자가 D코스 검증을 테스트한다
**When** D코스 마사지사2 누락 저장 차단, 방문완료 차단, ARIA 연결, 비D코스 허용, D코스 정상 저장 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 검증은 UI 표시뿐 아니라 서버 domain service에서도 수행된다.

### Story 2.5: 일별 지출 입력과 요약 계산

As a 카운터 또는 관리자,
I want 일별 지출을 입력하고 날짜별 콜/매출/정산 요약을 확인하기를,
So that 원본 `실시간콜입력` U:X 영역의 운영 요약을 ERP에서 같은 기준으로 볼 수 있다.

**Acceptance Criteria:**

**Given** 카운터 또는 관리자가 콜 원장 화면의 일별 지출 영역에 접근한다
**When** 지출 항목을 추가한다
**Then** 지출은 일자, 운영월, 지출금액, 내용, 담당자, 비고를 가진다
**And** 운영월 날짜 범위를 벗어난 지출은 저장할 수 없다.

**Given** 지출금액이 입력된다
**When** 저장한다
**Then** 지출금액은 숫자 금액으로 저장된다
**And** 표시용 통화 문자열은 UI에서 포맷된다.

**Given** 지출 항목이 수정되거나 비활성 처리된다
**When** 저장이 완료된다
**Then** 일별 지출합계가 갱신된다
**And** 행위자, 대상 지출, 변경 전후값, 시각이 감사 로그로 기록된다.

**Given** 선택 날짜에 콜과 지출 데이터가 있다
**When** 일별 요약을 조회한다
**Then** 예약건수, 방문완료, 노쇼/취소, 결제합계, 마사지사정산, 귀케어풀, 할인합계, 지출합계, 순매출이 표시된다
**And** 매출과 정산 관련 수치는 `방문완료` 콜만 기준으로 계산된다.

**Given** 선택 날짜에 A~E 코스별 방문완료 콜이 있다
**When** 코스별 요약을 조회한다
**Then** A~E 코스별 방문완료 수, 할인건수, 마사지사 담당 수가 표시된다
**And** 비완료 상태의 콜은 코스별 매출/정산 요약에 포함되지 않는다.

**Given** 지출합계가 존재한다
**When** 순매출을 계산한다
**Then** 순매출은 방문완료 기준 결제합계에서 지출합계를 반영한 값으로 표시된다
**And** 계산 기준은 domain service에 위치한다.

**Given** 요약 데이터가 로딩 중이다
**When** 날짜 또는 운영월이 변경된다
**Then** shadcn Skeleton 또는 명확한 로딩 상태가 표시된다
**And** 이전 날짜 요약과 새 날짜 요약이 혼동되지 않는다.

**Given** 개발자가 일별 지출과 요약을 검증한다
**When** 지출 입력/수정/비활성, 감사 로그, 방문완료 기준 요약, 비완료 제외, 순매출, 코스별 요약 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 요약 계산은 Excel 행 범위가 아니라 날짜와 운영월 조건으로 수행된다.

### Story 2.6: 콜 원장 키보드 입력성과 type-ahead 완성

As a 카운터,
I want 콜 원장을 키보드 중심으로 빠르게 입력하고 선택값을 type-ahead로 고르기를,
So that 엑셀의 입력 속도를 잃지 않고 예약/방문 처리를 할 수 있다.

**Acceptance Criteria:**

**Given** 카운터가 콜 원장 그리드의 편집 가능한 셀에 포커스한다
**When** `Tab`을 누른다
**Then** 포커스는 다음 편집 가능한 셀로 이동한다
**And** `Shift+Tab`은 이전 편집 가능한 셀로 이동한다.

**Given** 카운터가 편집 가능한 셀에서 값을 입력한다
**When** `Enter`를 누른다
**Then** 현재 셀 값은 commit된다
**And** 포커스는 아래 행의 대응 셀로 이동한다.

**Given** 카운터가 그리드에서 방향키를 사용한다
**When** 위/아래/좌/우 방향키를 누른다
**Then** 포커스는 그리드 안의 인접 셀로 이동한다
**And** 읽기전용 computed cell은 편집 모드로 열리지 않는다.

**Given** 카운터가 편집 중인 셀에서 `Esc`를 누른다
**When** 아직 저장되지 않은 셀 편집값이 있다
**Then** 편집은 취소되고 이전 값으로 돌아간다
**And** 자동저장 요청은 발생하지 않는다.

**Given** 상태, 코스, 객실, 결제수단, 할인구분, 확인값 같은 코드 셀에 포커스가 있다
**When** 사용자가 글자를 입력한다
**Then** type-ahead dropdown이 필터링되어 표시된다
**And** dropdown option은 색상 swatch만이 아니라 텍스트 라벨을 포함한다.

**Given** type-ahead dropdown이 열려 있다
**When** 사용자가 방향키를 누른다
**Then** option focus가 이동한다
**And** `Enter`는 선택, `Esc`는 dropdown을 닫고 셀 포커스로 돌아간다.

**Given** type-ahead dropdown이 접근성 속성을 가진다
**When** dropdown이 열리고 option이 이동한다
**Then** 셀 또는 combobox는 `aria-expanded`와 현재 option 연결을 제공한다
**And** roving focus 또는 `aria-activedescendant` 패턴을 사용한다.

**Given** computed readonly cell이 표시된다
**When** 결제금액, 수당, 귀케어 풀, 콜인정 셀이 렌더링된다
**Then** 입력 셀과 다른 readonly tint로 표시된다
**And** 사용자는 해당 셀이 자동 계산값임을 시각적으로 구분할 수 있다.

**Given** 콜 원장 화면에 화려한 대시보드 시각화가 추가될 수 있다
**When** 카운터가 입력 업무를 수행한다
**Then** 무거운 애니메이션이나 장식은 입력 흐름을 방해하지 않는다
**And** 입력 성능과 키보드 이동이 우선된다.

**Given** 개발자가 키보드 입력성을 검증한다
**When** Tab/Shift+Tab, Enter, 방향키, Esc, type-ahead 필터, dropdown 선택/닫기, ARIA 연결, computed cell 비편집 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 콜 원장은 마우스 없이 주요 입력 흐름을 수행할 수 있다.

## Epic 3: 실시간 객실 현황과 TV 현황판

주인, 웨이터, 조회 전용 사용자가 11개 객실의 현재 상태, 남은 시간, 종료확인, 안내 문구를 같은 계산 기준으로 확인할 수 있다.

### Story 3.1: 객실 상태 DTO와 최신 활성 콜 계산

As a 운영 사용자,
I want 객실별 현재 상태가 콜 원장 기준으로 일관되게 계산되기를,
So that 첫 화면, 객실 현황, TV 현황판이 서로 다른 상태를 보여주지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 객실 마스터에 11개 객실이 있고 콜 원장에 서비스 콜이 있다
**When** 객실 상태 서비스를 조회한다
**Then** 각 객실별 `RoomStatusDto`가 반환된다
**And** DTO는 객실 ID, 객실 표시명, 표시 순서, 표시 상태, 원본 콜 상태, 코스, 담당자, 시작시간, 종료예정, 남은분, 안내 문구에 필요한 필드를 포함한다.

**Given** 객실에 `사용중`, `청소중`, `예약` 상태의 활성 콜이 있다
**When** 객실 상태를 계산한다
**Then** 최신 활성 콜은 객실, 상태, 시작시간 기준으로 결정된다
**And** `방문완료`, `노쇼`, `취소` 콜은 현재 객실 상태의 활성 콜로 사용하지 않는다.

**Given** 객실에 활성 콜이 없다
**When** 객실 상태를 계산한다
**Then** 표시 상태는 `빈방`이다
**And** 남은분과 종료예정은 `—` 또는 비어 있음으로 표시 가능한 값을 반환한다.

**Given** 활성 콜 상태가 `사용중`이고 코스 시간과 시작시간이 있다
**When** 현재 시간이 종료예정 전이다
**Then** 남은분은 0 이상 정수로 계산된다
**And** 종료예정은 timezone-aware 기준으로 일관되게 계산된다.

**Given** 활성 콜 상태가 `사용중`이고 남은분이 0 이하로 계산된다
**When** 객실 상태를 반환한다
**Then** 표시 상태는 `종료확인`으로 반환된다
**And** 남은분은 음수로 표시되지 않는다.

**Given** 시작시간과 종료예정이 자정을 넘는다
**When** 남은분과 종료예정을 계산한다
**Then** 자정 넘김 운영 흐름이 올바르게 반영된다
**And** 날짜 경계 때문에 남은분이 잘못 음수 처리되지 않는다.

**Given** 객실 상태 계산이 실행된다
**When** DTO를 생성한다
**Then** 정산, 월마감, 지급 스냅샷 데이터는 변경하지 않는다
**And** 객실 상태는 조회 전용 계산 결과로만 제공된다.

**Given** 첫 화면, 객실 현황, TV 현황판이 객실 상태를 필요로 한다
**When** 각 화면이 데이터를 조회한다
**Then** 모두 같은 `RoomStatusDto`와 같은 계산 서비스를 재사용할 수 있다
**And** 화면별로 상태 계산을 중복 구현하지 않는다.

**Given** 개발자가 객실 상태 계산을 검증한다
**When** 활성 콜 없음, 예약, 청소중, 사용중, 종료확인, 방문완료 제외, 노쇼/취소 제외, 자정 넘김 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 객실 상태 계산은 UI component가 아니라 domain service에서 수행된다.

### Story 3.2: 첫 화면 실시간 객실/콜 현황

As a 주인/관리자,
I want 로그인 후 첫 화면에서 객실 상태와 오늘 콜/매출 요약을 한눈에 보기를,
So that 별도 엑셀 시트를 이동하지 않고 매장 운영 상태를 즉시 판단할 수 있다.

**Acceptance Criteria:**

**Given** 주인 또는 관리자가 로그인한다
**When** ERP에 진입한다
**Then** 첫 화면은 실시간 객실/콜 현황으로 표시된다
**And** 11개 객실 카드가 화면 최상단의 4열 그리드로 표시된다.

**Given** 첫 화면 객실 카드가 렌더링된다
**When** 객실 상태 데이터가 조회된다
**Then** 각 카드는 Story 3.1의 `RoomStatusDto`를 사용한다
**And** 화면 component는 객실 상태 계산을 직접 재구현하지 않는다.

**Given** 객실 카드가 표시된다
**When** 각 객실 상태가 `사용중`, `청소중`, `예약`, `종료확인`, `빈방` 중 하나다
**Then** 카드에는 상태별 색상, 텍스트 라벨, 글리프가 함께 표시된다
**And** 코스, 담당자, 시작시간, 남은분, 종료예정이 가능한 범위에서 표시된다.

**Given** 표시 상태가 `종료확인`인 객실이 있다
**When** 첫 화면이 렌더링된다
**Then** 해당 객실은 주의 상태로 구분되어 보인다
**And** "결제·확인 필요" 또는 동등한 짧은 한국어 행동 라벨이 표시된다.

**Given** 오늘 콜 원장 데이터가 있다
**When** 첫 화면 요약이 조회된다
**Then** 오늘 예약, 사용중, 청소중, 방문완료, 노쇼, 취소 수가 표시된다
**And** 매출/정산 관련 지표는 `방문완료` 기준만 포함한다.

**Given** 오늘 결제와 코스 데이터가 있다
**When** KPI 영역이 렌더링된다
**Then** 오늘 결제합계, 순매출, 코스별 방문완료 수가 표시된다
**And** 지출이 있는 경우 순매출은 일별 지출 요약 기준을 반영한다.

**Given** 첫 화면 데이터가 로딩 중이다
**When** 사용자가 화면에 진입한다
**Then** shadcn Skeleton 또는 명확한 로딩 상태가 표시된다
**And** blank screen으로 보이지 않는다.

**Given** 첫 화면 데이터 갱신이 지연된다
**When** 마지막 갱신 이후 지연이 감지된다
**Then** 마지막 갱신 시각 또는 갱신 지연 상태가 표시된다
**And** 사용자가 오래된 상태를 최신 상태로 오해하지 않게 한다.

**Given** 개발자가 첫 화면을 검증한다
**When** 11개 객실 카드, 오늘 상태 요약, 방문완료 기준 KPI, 종료확인 카드, 로딩/지연 상태 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 첫 화면은 콜 원장 입력 기능 없이 조회 중심 화면으로 동작한다.

### Story 3.3: 객실 현황 화면과 웨이터 안내 문구

As a 웨이터,
I want 객실별 상태, 남은 시간, 종료확인, 안내 문구를 읽기 전용으로 확인하기를,
So that 원장을 수정하지 않고도 청소, 입실 안내, 대기 판단을 빠르게 할 수 있다.

**Acceptance Criteria:**

**Given** 웨이터가 로그인한다
**When** ERP에 진입한다
**Then** 역할별 landing은 객실 현황 화면이다
**And** 콜 원장, 정산, 마스터 설정 메뉴는 표시되지 않는다.

**Given** 웨이터 또는 조회 전용 사용자가 객실 현황 화면에 접근한다
**When** 화면이 렌더링된다
**Then** 11개 객실 상태 카드가 표시된다
**And** 각 카드는 Story 3.1의 `RoomStatusDto`를 사용한다.

**Given** 객실 상태 카드가 표시된다
**When** 객실 상태가 `사용중`, `청소중`, `예약`, `종료확인`, `빈방` 중 하나다
**Then** 상태별 안내 문구가 함께 표시된다
**And** 안내 문구는 상태별로 구분된다.

**Given** 표시 상태가 `사용중`이다
**When** 카드가 표시된다
**Then** 남은분과 종료예정이 표시된다
**And** 남은분은 음수로 표시되지 않는다.

**Given** 표시 상태가 `종료확인`이다
**When** 카드가 표시된다
**Then** 웨이터가 행동할 수 있는 짧은 안내 문구가 표시된다
**And** 상태는 색상만이 아니라 라벨과 글리프로도 구분된다.

**Given** 활성 콜이 없는 객실이다
**When** 카드가 표시된다
**Then** 상태는 `빈방`으로 표시된다
**And** 즉시 안내 가능함을 알 수 있는 간결한 문구 또는 `—` 값이 표시된다.

**Given** 사용자가 객실 현황 화면에서 입력을 시도한다
**When** 객실 카드 또는 상태 정보를 클릭한다
**Then** 콜 원장 수정 기능은 제공되지 않는다
**And** 객실 현황은 읽기 전용 조회 화면으로 유지된다.

**Given** 객실 현황 데이터 갱신이 지연된다
**When** 마지막 갱신 이후 지연이 감지된다
**Then** 마지막 갱신 시각 또는 갱신 지연 상태가 표시된다
**And** 웨이터가 오래된 상태를 최신 상태로 오해하지 않게 한다.

**Given** 개발자가 객실 현황 화면을 검증한다
**When** 역할별 landing, 읽기 전용 권한, 안내 문구, 종료확인, 빈방, 지연 상태 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 객실 현황은 콜 원장이나 정산 데이터를 변경하지 않는다.

### Story 3.4: TV 현황판 fullscreen route

As a 조회 전용 사용자,
I want TV에서 입력 없는 전체화면 객실 현황판을 보기를,
So that 매장 안에서 멀리서도 객실 상태와 종료확인을 빠르게 파악할 수 있다.

**Acceptance Criteria:**

**Given** 조회 전용 사용자 또는 허용된 운영 사용자가 TV 현황판 route에 접근한다
**When** route가 렌더링된다
**Then** sidebar, topbar, 일반 ERP chrome은 숨겨진다
**And** 입력 버튼, 수정 기능, 콜 원장 편집 기능은 제공되지 않는다.

**Given** TV 현황판이 데이터를 조회한다
**When** 화면이 표시된다
**Then** 11개 객실이 대형 카드 grid로 표시된다
**And** 각 카드는 Story 3.1의 `RoomStatusDto`를 사용한다.

**Given** TV 현황판의 객실 카드가 표시된다
**When** 객실 상태가 표시된다
**Then** 객실명, 상태, 남은 시간, 코스, 담당자가 멀리서 읽을 수 있는 크기로 표시된다
**And** 상태는 색상, 텍스트 라벨, 글리프를 함께 사용한다.

**Given** 표시 상태가 `종료확인`인 객실이 있다
**When** TV 현황판이 렌더링된다
**Then** 해당 카드는 TV에서도 명확한 주의 상태로 표시된다
**And** "결제·확인 필요" 또는 TV에 적합한 짧은 문구가 표시된다.

**Given** TV 현황판이 열려 있다
**When** 자동 갱신 interval이 도래한다
**Then** 객실 상태 데이터가 주기적으로 갱신된다
**And** v1 기본 방식은 polling/auto-refresh로 시작한다.

**Given** 데이터가 정상 갱신된다
**When** 화면이 최신 데이터를 표시한다
**Then** 마지막 갱신 시각이 표시된다
**And** 사용자는 현황판이 살아 있는지 확인할 수 있다.

**Given** 데이터 갱신이 실패하거나 지연된다
**When** refresh delay가 감지된다
**Then** `갱신 지연` 또는 동등한 한국어 상태가 표시된다
**And** 기존 값을 유지하되 오래된 상태임을 알 수 있게 한다.

**Given** TV 현황판이 사용된다
**When** 사용자가 마우스나 키보드로 카드를 조작하려 한다
**Then** 상태 변경이나 입력 action은 실행되지 않는다
**And** TV 현황판은 조회 전용 화면으로 유지된다.

**Given** 개발자가 TV 현황판을 검증한다
**When** fullscreen chrome 숨김, 11개 카드, 자동 갱신, 마지막 갱신 시각, 갱신 지연, 읽기 전용 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** TV 현황판은 객실 현황 화면과 같은 상태 계산 결과를 표시한다.

### Story 3.5: 상태 badge, 종료확인 주의 표현, 접근성 polish

As a 운영 사용자,
I want 모든 객실 상태가 같은 색상, 라벨, 글리프, 모션 규칙으로 표시되기를,
So that 첫 화면, 객실 현황, TV 현황판 어디서나 상태 의미를 빠르고 안전하게 이해할 수 있다.

**Acceptance Criteria:**

**Given** 객실 상태가 첫 화면, 객실 현황, TV 현황판 중 어느 표면에 표시된다
**When** 상태 badge가 렌더링된다
**Then** `사용중`, `예약`, `청소중`, `종료확인`, `빈방`은 DESIGN.md의 잠긴 status 토큰을 사용한다
**And** 화면별로 임의 색상 변형을 만들지 않는다.

**Given** 상태 badge가 표시된다
**When** 상태 의미를 전달한다
**Then** 색상, 텍스트 라벨, 글리프가 항상 함께 표시된다
**And** 글리프는 사용중 `●`, 예약 `◷`, 청소중 `◐`, 종료확인 `⚠`, 빈방 `○` 규칙을 따른다.

**Given** `청소중` badge가 표시된다
**When** 텍스트 foreground가 적용된다
**Then** gold fill 위에는 짙은 텍스트를 사용한다
**And** white foreground를 사용하지 않는다.

**Given** `빈방` badge 또는 카드가 표시된다
**When** 상태를 표현한다
**Then** surface 배경, bronze border, 짙은 텍스트의 outline/ghost style을 사용한다
**And** white-on-bronze filled badge를 사용하지 않는다.

**Given** `종료확인` 상태가 표시된다
**When** 텍스트가 올라가는 badge를 렌더링한다
**Then** 텍스트 배지용 어두운 orange 토큰을 사용한다
**And** 밝은 orange는 glow ring/accent 같은 비텍스트 장식에만 사용한다.

**Given** `종료확인` 카드에 pulse가 적용된다
**When** 사용자의 시스템 설정이 `prefers-reduced-motion: reduce`이다
**Then** pulse animation은 비활성화된다
**And** 정적 고대비 ring과 `⚠` 라벨로 주의 상태를 전달한다.

**Given** `종료확인` pulse가 활성화된다
**When** animation이 재생된다
**Then** 느린 opacity breathe 방식으로 동작한다
**And** 초당 3회 이상 flash하지 않는다.

**Given** 상태 텍스트 또는 badge foreground가 적용된다
**When** 접근성 검증을 수행한다
**Then** 일반 텍스트는 4.5:1, 대형 텍스트/UI component는 3:1 contrast target을 충족한다
**And** brand gold는 body text로 사용하지 않는다.

**Given** 상태 표시가 TV 현황판에 표시된다
**When** 10~15ft 거리에서 읽는 사용자를 고려한다
**Then** TV 전용 대형 typography ramp가 적용된다
**And** 작은 color swatch만으로 상태를 전달하지 않는다.

**Given** 개발자가 상태 표현을 검증한다
**When** 모든 표면의 status token 일관성, 글리프/라벨 동반, 빈방 outline, 종료확인 reduced-motion, contrast, TV 거리 가독성 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 상태 의미는 색상만으로 전달되지 않는다.

## Epic 4: 일정산과 운영팀 인센

정산 담당자가 마사지사, 귀케어, 운영팀의 일별 근무상태와 지급액을 검토하고 산출 근거와 함께 확인할 수 있다.

### Story 4.1: 마사지사 출퇴근 입력과 만근 인정 기초

As a 정산 담당,
I want 마사지사별 일일 출퇴근 시간을 입력하고 대기시간과 만근 인정 여부를 계산하기를,
So that 마사지사 일일정산과 월마감 만근수당의 기초 데이터를 정확히 만들 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 마사지사 일정산 화면에 접근한다
**When** 운영월과 날짜를 선택한다
**Then** 마사지사 50명의 일별 출퇴근 입력 목록이 표시된다
**And** 직원 식별은 마사지사 이름이 아니라 직원 고유 ID 기준으로 처리된다.

**Given** 정산 담당자가 마사지사 출근시간과 퇴근시간을 입력한다
**When** 저장한다
**Then** 출근시간, 퇴근시간, 근무일자, 운영월, 마사지사 ID가 저장된다
**And** 시간은 표시 문자열이 아니라 계산 가능한 시간 값으로 보존된다.

**Given** 퇴근시간이 출근시간보다 빠르다
**When** 대기시간을 계산한다
**Then** 퇴근시간은 자정 이후 퇴근으로 계산된다
**And** 자정 넘김 때문에 대기시간이 음수로 계산되지 않는다.

**Given** 대기시간이 8시간 이상이다
**When** 만근 인정 여부를 계산한다
**Then** 해당 일자는 만근 인정으로 표시된다
**And** 대기시간이 8시간 미만이면 만근 인정으로 표시되지 않는다.

**Given** 출퇴근 입력값이 누락되었거나 형식이 잘못되었다
**When** 정산 담당자가 저장한다
**Then** 저장은 차단되거나 미완료 상태로 표시된다
**And** 안전한 한국어 오류 메시지가 표시된다.

**Given** 운영월이 `잠금` 상태다
**When** 정산 담당자가 출퇴근 시간을 수정하려 한다
**Then** 서버에서 수정이 차단된다
**And** 잠긴 운영월이라는 안내가 표시된다.

**Given** 출퇴근 시간이 생성, 수정, 삭제 또는 비활성 처리된다
**When** 저장이 완료된다
**Then** 행위자, 대상 마사지사, 변경 전후값, 날짜, 시각이 감사 로그로 기록된다
**And** 출퇴근 변경은 지급액에 영향을 줄 수 있는 변경으로 분류된다.

**Given** 개발자가 출퇴근/만근 기초 기능을 검증한다
**When** 50명 목록, 출퇴근 저장, 자정 넘김, 8시간 이상/미만 만근 인정, 잠금 차단, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 월마감 만근수당 story에서 이 만근 인정 데이터를 재사용할 수 있다.

### Story 4.2: 마사지사 일일정산

As a 정산 담당,
I want 방문완료 콜 기준으로 마사지사별 일일 담당 콜과 수당을 계산하기를,
So that 마사지사1과 마사지사2 모두 빠짐없이 당일 정산에 반영할 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 마사지사 일정산 화면에서 운영월과 날짜를 선택한다
**When** 일일정산을 조회한다
**Then** 선택 날짜의 마사지사별 담당 콜 수와 당일정산 합계가 표시된다
**And** 마사지사 식별은 직원 고유 ID 기준으로 처리된다.

**Given** 선택 날짜에 `방문완료` 콜이 있다
**When** 마사지사 담당 콜을 집계한다
**Then** 마사지사1에 배정된 콜이 담당 콜로 집계된다
**And** 해당 코스/마사지사/적용월 수당이 당일정산에 반영된다.

**Given** 선택 날짜에 마사지사2가 배정된 `방문완료` 콜이 있다
**When** 마사지사 담당 콜을 집계한다
**Then** 마사지사2에 배정된 콜도 담당 콜로 집계된다
**And** 마사지사2 수당도 당일정산에 별도로 반영된다.

**Given** 선택 날짜에 `예약`, `사용중`, `청소중`, `노쇼`, `취소` 콜이 있다
**When** 마사지사 일일정산을 계산한다
**Then** 해당 콜은 담당 콜 수와 수당 합계에 포함되지 않는다
**And** `방문완료`만 정산 기준으로 인정된다.

**Given** 코스별 담당 콜 수가 필요하다
**When** 일일정산 상세를 표시한다
**Then** A~E 코스별 담당 콜 수가 표시된다
**And** 마사지사1/2 배정 위치와 관계없이 해당 마사지사의 코스별 콜로 집계된다.

**Given** 적용월에 수당 정책이 없거나 금액이 0원이다
**When** 일일정산을 계산한다
**Then** 수당은 0원으로 표시된다
**And** 산출 근거에 정책 없음 또는 0원 정책임을 구분해 표시한다.

**Given** 정산 결과가 표시된다
**When** 마사지사별 당일정산을 본다
**Then** 계산 결과와 산출 근거(콜 수, 코스, 적용 수당 정책)가 함께 표시된다
**And** 맨숫자 금액만 단독으로 보여주지 않는다.

**Given** 개발자가 마사지사 일일정산을 검증한다
**When** 방문완료/비완료 제외, 마사지사1/2 담당 인정, 코스별 담당 콜, 수당 0원, 정책 누락, 산출 근거 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 settlement domain service에서 수행된다.

### Story 4.3: 귀케어 근무상태 입력

As a 정산 담당,
I want 귀케어사별 일일 근무상태를 입력하기를,
So that 귀케어 일일정산에서 정상 근무자만 지급 대상으로 삼을 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 귀케어 일정산 화면에 접근한다
**When** 운영월과 날짜를 선택한다
**Then** 귀케어사 4명의 일별 근무상태 입력 목록이 표시된다
**And** 귀케어사 식별은 이름 문자열이 아니라 직원 고유 ID 기준으로 처리된다.

**Given** 정산 담당자가 귀케어사 근무상태를 선택한다
**When** 선택 목록이 표시된다
**Then** `정상`, `휴무`, `지각`, `조퇴`, `결근` 상태를 선택할 수 있다
**And** 상태값은 Epic 1의 코드 관리 기준을 사용한다.

**Given** 귀케어사 근무상태가 `정상`이다
**When** 귀케어 지급 대상 여부를 판단한다
**Then** 해당 귀케어사는 지급 대상이다
**And** 이후 귀케어 일일정산에서 균등 분배 대상에 포함될 수 있다.

**Given** 귀케어사 근무상태가 `휴무`, `지각`, `조퇴`, `결근` 중 하나다
**When** 귀케어 지급 대상 여부를 판단한다
**Then** 해당 귀케어사는 지급 대상이 아니다
**And** 지급 대상 제외 사유가 근무상태로 표시된다.

**Given** 운영월이 `잠금` 상태다
**When** 정산 담당자가 귀케어 근무상태를 수정하려 한다
**Then** 서버에서 수정이 차단된다
**And** 잠긴 운영월이라는 안내가 표시된다.

**Given** 귀케어 근무상태가 생성 또는 수정된다
**When** 저장이 완료된다
**Then** 행위자, 대상 귀케어사, 변경 전후 상태, 날짜, 시각이 감사 로그로 기록된다
**And** 근무상태 변경은 지급액에 영향을 줄 수 있는 변경으로 분류된다.

**Given** 귀케어 근무상태 입력 화면이 로딩 중이다
**When** 운영월 또는 날짜가 변경된다
**Then** 명확한 로딩 상태가 표시된다
**And** 이전 날짜의 근무상태와 새 날짜의 근무상태가 혼동되지 않는다.

**Given** 개발자가 귀케어 근무상태 입력을 검증한다
**When** 4명 목록, 상태 선택, 정상 지급 대상 판정, 비정상 제외, 잠금 차단, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 귀케어 일일정산 story에서 지급 대상 목록을 재사용할 수 있다.

### Story 4.4: 귀케어 일일정산

As a 정산 담당,
I want 방문완료 콜의 귀케어 풀을 정상 근무 귀케어사에게 균등 분배하기를,
So that 귀케어 지급액을 원본 엑셀 규칙과 같은 기준으로 계산할 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 귀케어 일정산 화면에서 운영월과 날짜를 선택한다
**When** 일일정산을 조회한다
**Then** 해당 날짜의 귀케어 풀 합계와 귀케어사별 지급액이 표시된다
**And** 계산 결과와 산출 근거가 함께 표시된다.

**Given** 선택 날짜에 귀케어 풀 금액이 있는 `방문완료` 콜이 있다
**When** 귀케어 풀 합계를 계산한다
**Then** 당일 귀케어 풀은 방문완료 서비스 콜의 귀케어 풀 합계다
**And** 예약, 사용중, 청소중, 노쇼, 취소 콜은 귀케어 풀에 포함되지 않는다.

**Given** 해당 날짜에 정상 근무 귀케어사가 1명 이상 있다
**When** 귀케어 지급액을 계산한다
**Then** 귀케어 풀은 정상 근무 귀케어사에게 균등 분배된다
**And** 정상 상태가 아닌 귀케어사는 지급액이 0원이다.

**Given** 해당 날짜에 정상 근무 귀케어사가 0명이다
**When** 귀케어 지급액을 계산한다
**Then** 개인 지급액은 모두 0원으로 처리된다
**And** 정상 근무자 0명으로 인한 0원 처리 근거가 표시된다.

**Given** 귀케어 지급액이 소수 또는 나누어떨어지지 않는 금액이 될 수 있다
**When** 균등 분배를 계산한다
**Then** 금액 처리/반올림 규칙이 domain service에 명시된다
**And** 표시 금액과 저장/계산 금액이 일관된다.

**Given** 귀케어 근무상태가 변경된다
**When** 일일정산을 다시 조회한다
**Then** 지급 대상과 지급액이 새 근무상태 기준으로 갱신된다
**And** 변경 이력은 Story 4.3 감사 로그로 추적된다.

**Given** 운영월이 `잠금` 상태다
**When** 정산 담당자가 귀케어 지급액 계산 결과를 수정하려 한다
**Then** 계산 결과 직접 수정은 허용되지 않는다
**And** 지급액은 콜 원장과 근무상태 기준으로만 산출된다.

**Given** 개발자가 귀케어 일일정산을 검증한다
**When** 방문완료 기준 풀 합계, 비완료 제외, 정상 근무자 균등 분배, 정상근무자 0명 지급액 0원, 근무상태 변경 반영, 반올림 규칙 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 settlement domain service에서 수행된다.

### Story 4.5: 운영팀 근무상태와 일일 인센

As a 정산 담당,
I want 운영팀의 일별 근무상태와 일 총콜 기준 일일 인센을 계산하기를,
So that 정상 근무한 운영팀 직원에게만 원본 기준의 일일 인센을 지급할 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 운영팀 근무/인센 화면에 접근한다
**When** 운영월과 날짜를 선택한다
**Then** 팀장, 카운터1, 카운터2, 웨이터1, 웨이터2 대상자의 일별 근무상태가 표시된다
**And** 직원 식별은 표시명이 아니라 직원 고유 ID 기준으로 처리된다.

**Given** 정산 담당자가 운영팀 근무상태를 선택한다
**When** 선택 목록이 표시된다
**Then** `정상`, `휴무`, `지각`, `조퇴`, `결근` 상태를 선택할 수 있다
**And** 상태값은 Epic 1의 코드 관리 기준을 사용한다.

**Given** 선택 날짜의 방문완료 콜 데이터가 있다
**When** 일 총콜을 계산한다
**Then** 일 총콜은 `방문완료` 콜 기준으로 계산된다
**And** 예약, 사용중, 청소중, 노쇼, 취소 콜은 인센 기준 콜 수에 포함되지 않는다.

**Given** 일 총콜이 30 이상 40 미만이다
**When** 일일 인센을 계산한다
**Then** 정상 상태 운영팀 직원에게 개인별 50,000이 지급된다
**And** 정상 상태가 아닌 직원은 지급 대상이 아니다.

**Given** 일 총콜이 40 이상 50 미만이다
**When** 일일 인센을 계산한다
**Then** 정상 상태 운영팀 직원에게 개인별 100,000이 지급된다
**And** 정상 상태가 아닌 직원은 지급 대상이 아니다.

**Given** 일 총콜이 50 이상이다
**When** 일일 인센을 계산한다
**Then** 정상 상태 운영팀 직원에게 개인별 200,000이 지급된다
**And** 정상 상태가 아닌 직원은 지급 대상이 아니다.

**Given** 일 총콜이 30 미만이다
**When** 일일 인센을 계산한다
**Then** 일일 인센은 0원으로 표시된다
**And** 30콜 미만이라는 산출 근거가 표시된다.

**Given** 운영팀 근무상태가 생성 또는 수정된다
**When** 저장이 완료된다
**Then** 행위자, 대상 운영팀 직원, 변경 전후 상태, 날짜, 시각이 감사 로그로 기록된다
**And** 근무상태 변경은 지급액에 영향을 줄 수 있는 변경으로 분류된다.

**Given** 개발자가 운영팀 일일 인센을 검증한다
**When** 대상자 5명, 근무상태 선택, 방문완료 기준 일 총콜, 30/40/50 구간, 30 미만 0원, 정상 직원만 지급, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 settlement domain service에서 수행된다.

### Story 4.6: 운영팀 월 인센 미리보기

As a 정산 담당,
I want 운영월 총콜 기준 운영팀 월 인센을 미리 계산해 보기를,
So that 월마감 전에 운영팀 지급 예상액과 분배 근거를 검토할 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 운영팀 월 인센 미리보기 화면에 접근한다
**When** 운영월을 선택한다
**Then** 해당 운영월의 총콜 기준 월 인센 미리보기가 표시된다
**And** 월 총콜은 운영월 날짜 범위의 `방문완료` 콜 기준으로 계산된다.

**Given** 월 총콜이 1000, 1100, 1200, 1300, 1400, 1500 이상 구간 중 하나에 해당한다
**When** 월 인센을 계산한다
**Then** 해당 구간별 전체 월인센 기준이 적용된다
**And** 구간 미달이면 월 인센은 0원 또는 해당 없음으로 표시된다.

**Given** 전체 월인센 금액이 계산된다
**When** 팀별 분배를 계산한다
**Then** 팀장 30%, 카운터팀 35%, 웨이터팀 35% 분배율이 적용된다
**And** 분배율과 금액이 산출 근거로 함께 표시된다.

**Given** 카운터팀 또는 웨이터팀 내부 인원이 있다
**When** 팀 내부 분배를 표시한다
**Then** 카운터팀과 웨이터팀 내부 인원별 분배 금액이 표시된다
**And** 직원 식별은 직원 고유 ID 기준으로 처리된다.

**Given** 운영월이 아직 마감 확정되지 않았다
**When** 월 인센 미리보기를 조회한다
**Then** 현재 콜 원장과 현재 정책 기준의 예상값으로 표시된다
**And** 미확정 미리보기임을 구분해 표시한다.

**Given** 운영월이 월마감 확정 또는 잠금 상태다
**When** 월 인센 미리보기를 조회한다
**Then** 확정 스냅샷 기준 값과 현재 미리보기 값을 혼동하지 않도록 표시한다
**And** 확정 스냅샷은 자동 재계산되지 않는다.

**Given** 운영팀 월 인센 정책이 적용월 이력으로 관리된다
**When** 월 인센을 계산한다
**Then** 선택 운영월에 적용되는 정책을 사용한다
**And** 정책 적용월이 산출 근거에 표시된다.

**Given** 개발자가 운영팀 월 인센을 검증한다
**When** 월 총콜 방문완료 기준, 1000~1500 구간, 구간 미달, 30/35/35 분배, 내부 인원별 분배, 적용월 정책, 미확정/확정 표시 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 settlement domain service에서 수행된다.

## Epic 5: 월마감 확정, 잠금, 재오픈

정산 담당자와 관리자가 월 지급액을 미리보기, 검토, 확정, 잠금, 재오픈 흐름으로 안전하게 처리하고 확정 스냅샷을 보존할 수 있다.

### Story 5.1: 월마감 미리보기 집계

As a 정산 담당,
I want 운영월의 마사지사, 운영팀, 귀케어 지급액을 미리보기로 확인하기를,
So that 월마감 확정 전에 지급 대상과 산출 근거를 검토할 수 있다.

**Acceptance Criteria:**

**Given** 정산 담당자가 월마감 화면에 접근한다
**When** 운영월을 선택한다
**Then** 해당 운영월의 월마감 미리보기가 표시된다
**And** 운영월 날짜 범위 기준으로 집계된다.

**Given** 운영월에 마사지사 일일정산 데이터가 있다
**When** 월마감 미리보기를 계산한다
**Then** 마사지사별 월 총콜, 월 정산액, 만근 인정일, 최종지급액 기초값이 표시된다
**And** 마사지사 식별은 직원 고유 ID 기준으로 처리된다.

**Given** 운영월에 운영팀 일일 인센과 월 인센 미리보기 데이터가 있다
**When** 월마감 미리보기를 계산한다
**Then** 운영팀 월 총콜, 월인센 전체, 일일인센 합계가 표시된다
**And** 산출 근거가 함께 표시된다.

**Given** 운영월에 귀케어 일일정산 데이터가 있다
**When** 월마감 미리보기를 계산한다
**Then** 귀케어 지급 합계가 표시된다
**And** 정상근무자 0명 처리 같은 특이 근거가 있으면 확인할 수 있다.

**Given** 운영월에 마사지사 지급액이 있다
**When** 미리보기 요약이 표시된다
**Then** 마사지사 최종 지급 합계가 표시된다
**And** 개별 지급액과 전체 합계가 서로 일치한다.

**Given** 월마감 미리보기 화면이 표시된다
**When** 사용자가 지급 결과를 확인한다
**Then** 계산 결과와 산출 근거가 함께 표시된다
**And** 맨숫자 금액만 단독으로 보여주지 않는다.

**Given** 운영월이 아직 확정되지 않았다
**When** 미리보기를 조회한다
**Then** 현재 콜 원장, 정산, 정책 기준의 미확정 값으로 표시된다
**And** 확정 스냅샷 값과 혼동되지 않도록 표시한다.

**Given** 월마감 미리보기 데이터가 로딩 중이다
**When** 운영월이 변경된다
**Then** 명확한 로딩 상태가 표시된다
**And** 이전 운영월의 미리보기와 새 운영월의 미리보기가 혼동되지 않는다.

**Given** 개발자가 월마감 미리보기를 검증한다
**When** 마사지사 월 총콜/정산액, 운영팀 월/일 인센, 귀케어 합계, 전체 지급 합계, 산출 근거, 미확정 표시 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 closing/settlement domain service에서 수행된다.

### Story 5.2: 만근수당과 갯수왕 수당 계산

As a 정산 담당,
I want 월마감에서 마사지사 만근수당과 갯수왕 수당을 계산하기를,
So that 월 최종지급액에 보너스성 지급액을 원본 기준대로 반영할 수 있다.

**Acceptance Criteria:**

**Given** 운영월에 마사지사별 만근 인정일 데이터가 있다
**When** 월마감 보너스 계산을 실행한다
**Then** 마사지사별 만근 인정일 수가 표시된다
**And** 만근 인정일은 Story 4.1의 일별 대기시간 8시간 이상 인정 결과를 기준으로 한다.

**Given** 마사지사의 만근 인정일이 19일이다
**When** 만근수당을 계산한다
**Then** 만근수당은 0원이다
**And** 20일 미만이라는 산출 근거가 표시된다.

**Given** 마사지사의 만근 인정일이 20일 이상이다
**When** 만근수당을 계산한다
**Then** 만근수당은 2,000,000이다
**And** 만근 인정일 수와 지급 기준이 산출 근거로 표시된다.

**Given** 운영월에 마사지사별 월 총콜 데이터가 있다
**When** 갯수왕 대상자를 계산한다
**Then** 월 총콜 40콜 이상 마사지사만 순위 수당 대상이 된다
**And** 40콜 미만 마사지사는 대상 제외 근거가 표시된다.

**Given** 갯수왕 대상 마사지사가 있다
**When** 순위를 계산한다
**Then** 1위는 5,000,000, 2위는 3,000,000, 3위는 1,000,000 수당이 적용된다
**And** 순위와 월 총콜 수가 함께 표시된다.

**Given** 갯수왕 대상자가 3명보다 적다
**When** 순위 수당을 계산한다
**Then** 존재하는 대상자에게만 해당 순위 수당을 적용한다
**And** 없는 순위에는 수당을 생성하지 않는다.

**Given** 마사지사 최종지급액을 계산한다
**When** 월 정산액, 만근수당, 갯수왕 수당이 있다
**Then** 최종지급액에 각 항목이 반영된다
**And** 항목별 금액과 산출 근거가 함께 표시된다.

**Given** 개발자가 월마감 보너스 계산을 검증한다
**When** 만근 19일/20일 이상, 월 총콜 40콜 미만/이상, 1~3위 수당, 대상자 3명 미만, 최종지급액 반영 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 계산은 UI component가 아니라 closing/settlement domain service에서 수행된다.

### Story 5.3: 월마감 검토와 확정 스냅샷

As a 정산 담당,
I want 월마감을 검토 후 확정하고 확정 시점의 계산 근거를 스냅샷으로 저장하기를,
So that 이후 정책이나 원장 변경으로 과거 지급액이 흔들리지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 운영월 상태가 `작성중`이다
**When** 정산 담당자가 월마감 검토를 시작한다
**Then** 운영월 상태를 `검토중`으로 변경할 수 있다
**And** 상태 변경은 감사 로그에 기록된다.

**Given** 월마감 화면이 표시된다
**When** 운영월 상태를 확인한다
**Then** `작성중 → 검토중 → 마감확정 → 잠금` 수평 스테퍼가 표시된다
**And** active 단계와 현재 상태에서 가능한 action이 역할과 상태 기준으로 구분된다.

**Given** 운영월 상태가 `검토중`이다
**When** 정산 담당자 또는 관리자 권한 사용자가 마감 확정을 요청한다
**Then** 월마감 확정 처리가 시작된다
**And** 권한이 없는 사용자의 확정 요청은 서버에서 차단된다.

**Given** 월마감 확정이 실행된다
**When** 스냅샷을 생성한다
**Then** 확정 시점의 콜 원장 집계, 적용 정책, 마사지사/운영팀/귀케어 지급 계산 근거가 저장된다
**And** 스냅샷은 현재 표시명 변경이나 정책 변경에 의존하지 않는 값을 포함한다.

**Given** 확정 스냅샷이 저장된다
**When** 월마감 확정이 완료된다
**Then** 운영월 상태는 `마감확정`으로 변경된다
**And** 확정 시각, 확정자, 스냅샷 ID가 보존된다.

**Given** 월마감이 이미 `마감확정` 또는 `잠금` 상태다
**When** 사용자가 다시 확정을 요청한다
**Then** 중복 확정은 차단된다
**And** 현재 상태에서 확정할 수 없다는 한국어 오류가 표시된다.

**Given** 확정 이후 마스터 정책, 직원명, 콜 원장이 변경된다
**When** 확정 스냅샷을 조회한다
**Then** 스냅샷 지급액과 계산 근거는 자동 재계산되지 않는다
**And** 현재 기준 미리보기와 확정 스냅샷은 구분되어 표시된다.

**Given** 월마감 확정이 완료된다
**When** 감사 로그를 확인한다
**Then** `monthly_close.confirmed` 또는 동등한 dot notation 이벤트가 기록된다
**And** actor, target operating month, before/after state, snapshot ID, timestamp가 포함된다.

**Given** 개발자가 월마감 확정 스냅샷을 검증한다
**When** 작성중→검토중, 검토중→마감확정, 권한 차단, 중복 확정 차단, 스냅샷 불변성, 감사 로그 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 확정 처리는 UI component가 아니라 closing domain service에서 수행된다.

### Story 5.4: 잠금 상태와 지급 영향 데이터 수정 차단

As a 관리자 또는 정산 담당,
I want 월마감 확정 후 운영월을 잠그고 지급 영향 데이터 수정을 차단하기를,
So that 확정된 월 지급액이 이후 일반 수정으로 흔들리지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 운영월 상태가 `마감확정`이다
**When** 관리자 또는 정산 담당 권한 사용자가 운영월 잠금을 실행한다
**Then** 운영월 상태는 `잠금`으로 변경된다
**And** 잠금 시각과 행위자가 저장된다.

**Given** 운영월 상태가 `잠금`이다
**When** 일반 사용자가 콜 상태, 결제/할인, 담당자, 출퇴근, 근무상태, 수당표, 직원 정보처럼 지급액에 영향을 줄 수 있는 데이터를 수정하려 한다
**Then** 서버에서 수정이 차단된다
**And** 잠긴 운영월이라는 한국어 오류가 표시된다.

**Given** 운영월 상태가 `잠금`이다
**When** 조회 화면이 해당 운영월 데이터를 표시한다
**Then** 지급 영향 데이터는 read-only 상태로 표시된다
**And** 사용자는 잠금 상태임을 화면에서 알 수 있다.

**Given** 운영월 상태가 `잠금`이다
**When** 월간 KPI 또는 월마감 화면이 지급액을 조회한다
**Then** 확정 스냅샷 기준 값이 표시된다
**And** 현재 정책이나 현재 표시명 변경으로 자동 재계산되지 않는다.

**Given** 운영월이 아직 `작성중` 또는 `검토중`이다
**When** 사용자가 잠금을 요청한다
**Then** 확정 전 잠금은 차단된다
**And** 먼저 마감확정이 필요하다는 오류가 표시된다.

**Given** 잠금 처리가 실행된다
**When** 상태 변경이 완료된다
**Then** `monthly_close.locked` 또는 동등한 dot notation 이벤트가 감사 로그에 기록된다
**And** actor, target operating month, before/after state, timestamp가 포함된다.

**Given** 관리자가 아닌 사용자가 잠금 또는 잠금 해제를 시도한다
**When** Server Action이 실행된다
**Then** 권한 검사가 서버에서 실패한다
**And** UI에서 버튼을 숨기는 것만으로 보안을 대신하지 않는다.

**Given** 개발자가 잠금 상태를 검증한다
**When** 확정 후 잠금, 확정 전 잠금 차단, 지급 영향 데이터 수정 차단, read-only 표시, 스냅샷 기준 조회, 감사 로그, 권한 차단 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 잠금 규칙은 각 화면 UI가 아니라 domain/service boundary에서 재사용된다.

### Story 5.5: 관리자 사유 기반 재오픈

As a 관리자,
I want 잠긴 월마감을 사유 입력 후 재오픈하기를,
So that 잘못 확정된 운영월을 통제된 절차로 수정 가능 상태로 되돌릴 수 있다.

**Acceptance Criteria:**

**Given** 운영월 상태가 `잠금`이다
**When** 관리자가 재오픈을 요청한다
**Then** 재오픈 사유 입력이 요구된다
**And** 사유가 비어 있으면 재오픈은 차단된다.

**Given** 관리자가 유효한 재오픈 사유를 입력한다
**When** 재오픈을 확정한다
**Then** 운영월 상태는 수정 가능한 상태로 변경된다
**And** 어떤 상태로 되돌아가는지는 domain rule로 명확히 정의된다.

**Given** 관리자가 아닌 사용자가 재오픈을 요청한다
**When** Server Action이 실행된다
**Then** 서버 권한 검사에서 차단된다
**And** 정산 담당 또는 일반 사용자에게는 재오픈이 실행되지 않는다.

**Given** 재오픈이 완료된다
**When** 감사 로그를 확인한다
**Then** `monthly_close.reopened` 또는 동등한 dot notation 이벤트가 기록된다
**And** actor, target operating month, before/after state, reason, timestamp가 포함된다.

**Given** 재오픈된 운영월이 다시 수정 가능 상태가 된다
**When** 지급 영향 데이터가 변경된다
**Then** 변경 사항은 기존 감사 로그 정책에 따라 기록된다
**And** 기존 확정 스냅샷은 삭제되지 않고 재오픈 이력과 구분된다.

**Given** 운영월 상태가 `작성중`, `검토중`, 또는 아직 `마감확정`만 된 상태다
**When** 관리자가 재오픈을 요청한다
**Then** 잠금 상태가 아니면 재오픈은 차단된다
**And** 현재 상태에서 재오픈할 수 없다는 한국어 오류가 표시된다.

**Given** 재오픈 후 다시 월마감 확정을 진행한다
**When** 새 확정 스냅샷이 생성된다
**Then** 이전 스냅샷과 새 스냅샷은 구분 가능해야 한다
**And** 감사 로그로 재오픈과 재확정 흐름을 추적할 수 있다.

**Given** 개발자가 재오픈 기능을 검증한다
**When** 관리자 재오픈, 사유 필수, 비관리자 차단, 비잠금 상태 차단, 감사 로그 reason 기록, 기존 스냅샷 보존, 재확정 스냅샷 구분 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 재오픈 처리는 UI component가 아니라 closing domain service에서 수행된다.

### Story 5.6: 월마감 이중확인 모달과 접근성

As a 정산 담당,
I want 월마감 확정 전에 지급 총액과 스냅샷 불변 경고를 이중확인하기를,
So that 실수로 확정해 과거 지급액을 잠그는 위험을 줄일 수 있다.

**Acceptance Criteria:**

**Given** 운영월 상태가 `검토중`이고 월마감 미리보기가 준비되어 있다
**When** 정산 담당자가 `마감 확정`을 누른다
**Then** 이중확인 모달이 열린다
**And** 즉시 확정 처리가 실행되지 않는다.

**Given** 이중확인 모달이 열린다
**When** 모달 내용이 표시된다
**Then** 지급 총액, 대상 인원/구성 요약, 주요 지급 항목이 표시된다
**And** 사용자는 확정할 운영월을 명확히 확인할 수 있다.

**Given** 이중확인 모달이 열린다
**When** 경고 문구가 표시된다
**Then** "확정 시 스냅샷이 고정되어 이후 설정 변경으로 재계산되지 않습니다" 또는 동등한 불변성 경고가 표시된다
**And** 경고는 짧고 행동 가능한 한국어로 작성된다.

**Given** 사용자가 모달에서 취소한다
**When** 취소 버튼 또는 `Esc`를 누른다
**Then** 모달은 닫힌다
**And** 월마감 확정은 실행되지 않는다.

**Given** 사용자가 두 번째 확인을 완료한다
**When** 확정 action을 실행한다
**Then** Story 5.3의 월마감 확정 domain service가 호출된다
**And** 성공 후 운영월 상태와 스냅샷 정보가 갱신된다.

**Given** 이중확인 모달이 렌더링된다
**When** 접근성 속성이 적용된다
**Then** shadcn Dialog 기반 `role="alertdialog"`를 사용한다
**And** 경고 제목/설명이 screen reader에 연결된다.

**Given** 이중확인 모달이 열린다
**When** 포커스가 이동한다
**Then** 초기 포커스는 제목 또는 취소 같은 안전한 컨트롤에 놓인다
**And** destructive 확정 버튼에 초기 포커스를 두지 않는다.

**Given** 모달이 열려 있다
**When** 사용자가 키보드로 탐색한다
**Then** 포커스는 모달 내부에 trap된다
**And** 모달이 닫히면 포커스는 `마감 확정` 트리거로 돌아간다.

**Given** 확정 요청이 실패한다
**When** 서버 권한, 상태, 스냅샷 생성 오류가 발생한다
**Then** 모달 또는 화면에 안전한 한국어 오류 메시지가 표시된다
**And** 사용자는 확정이 완료되지 않았음을 알 수 있다.

**Given** 개발자가 이중확인 모달을 검증한다
**When** 모달 열림, 지급 요약 표시, 불변성 경고, Esc 취소, focus trap, safe initial focus, focus return, alertdialog labeling, 확정 성공/실패 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 모달은 월마감 domain logic을 직접 구현하지 않고 확정 action만 호출한다.

## Epic 6: 주인용 KPI와 시각화 대시보드

주인이 오늘/월간 매출, 콜, 객실, 노쇼/취소, 마사지사 순위, 운영팀 인센 흐름을 한눈에 판단할 수 있다.

### Story 6.1: 오늘 KPI 대시보드

As a 주인/관리자,
I want 조회날짜 기준 오늘 운영 KPI를 확인하기를,
So that 당일 예약, 방문완료, 매출, 정산 흐름을 빠르게 판단할 수 있다.

**Acceptance Criteria:**

**Given** 주인 또는 관리자가 오늘 KPI 대시보드에 접근한다
**When** 조회날짜를 선택한다
**Then** 해당 날짜 기준 KPI가 조회된다
**And** 조회날짜 변경 시 KPI가 다시 계산된다.

**Given** 선택 날짜에 콜 원장 데이터가 있다
**When** 오늘 KPI가 표시된다
**Then** 예약건수, 방문완료 콜, 노쇼, 취소가 표시된다
**And** 각 상태 수는 해당 날짜의 콜 원장 상태 기준으로 계산된다.

**Given** 선택 날짜에 방문완료 콜이 있다
**When** 매출 KPI가 계산된다
**Then** 결제합계는 `방문완료` 콜만 기준으로 계산된다
**And** 예약, 사용중, 청소중, 노쇼, 취소는 매출 KPI에 포함되지 않는다.

**Given** 선택 날짜에 마사지사 배정과 수당 계산값이 있다
**When** 정산 KPI가 계산된다
**Then** 마사지사 담당콜과 마사지사 정산 합계가 표시된다
**And** 마사지사1과 마사지사2 담당 콜이 모두 반영된다.

**Given** 선택 날짜에 A~E 코스별 방문완료 콜이 있다
**When** 코스별 KPI가 표시된다
**Then** A~E 코스별 방문완료 수가 표시된다
**And** 비완료 콜은 코스별 방문완료 수에 포함되지 않는다.

**Given** 원본 `오늘대시보드`의 표시 항목이 있다
**When** 오늘 KPI 대시보드가 렌더링된다
**Then** 원본 표시 항목이 ERP 화면의 KPI 또는 요약으로 포함된다
**And** 원본 엑셀에 없는 CRM/고객 세그먼트 지표는 추가하지 않는다.

**Given** KPI 데이터가 로딩 중이다
**When** 화면이 렌더링된다
**Then** shadcn Skeleton 또는 명확한 로딩 상태가 표시된다
**And** blank screen으로 보이지 않는다.

**Given** KPI 조회가 실패한다
**When** 서버 또는 집계 오류가 발생한다
**Then** 안전한 한국어 오류 메시지와 retry affordance가 표시된다
**And** 가능한 경우 마지막 성공 값을 오래된 값임을 표시한 채 유지한다.

**Given** 개발자가 오늘 KPI 대시보드를 검증한다
**When** 날짜 변경, 상태별 건수, 방문완료 기준 매출, 마사지사 담당콜/정산, 코스별 방문완료, 로딩/실패 상태 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** KPI 계산은 UI component가 아니라 dashboard query service에서 수행된다.

### Story 6.2: 월간 KPI 대시보드와 스냅샷 조회

As a 주인/관리자,
I want 운영월 기준 월간 KPI와 마감 후 스냅샷 값을 확인하기를,
So that 월 전체 운영 흐름과 확정된 지급/매출 기준을 안정적으로 볼 수 있다.

**Acceptance Criteria:**

**Given** 주인 또는 관리자가 월간 KPI 대시보드에 접근한다
**When** 운영월을 선택한다
**Then** 해당 운영월 기준 월간 KPI가 조회된다
**And** 월간 집계는 Excel 행 범위가 아니라 운영월 시작일/종료일 날짜 조건으로 계산된다.

**Given** 운영월에 콜 원장 데이터가 있다
**When** 월간 KPI가 표시된다
**Then** 월 방문완료 콜, 예약건수, 노쇼, 취소, 방문완료 매출이 표시된다
**And** 매출은 `방문완료` 콜만 기준으로 계산된다.

**Given** 운영월이 아직 마감 확정되지 않았다
**When** 월간 KPI를 조회한다
**Then** 현재 콜 원장과 정책 기준의 최신 집계가 표시된다
**And** 화면은 이 값이 미확정 기준임을 구분해 표시한다.

**Given** 운영월이 월마감 확정 또는 잠금 상태다
**When** 월간 KPI를 조회한다
**Then** 확정 스냅샷 기준 값을 조회할 수 있다
**And** 이후 수당표, 직원명, 원장 변경이 과거 스냅샷 KPI를 자동 변경하지 않는다.

**Given** 오늘 KPI와 월간 KPI가 같은 날짜/운영월 범위에 있다
**When** 두 화면의 계산 기준을 비교한다
**Then** 오늘 KPI는 조회날짜 기준, 월간 KPI는 운영월 날짜 범위 기준을 사용한다
**And** 두 계산 기준은 충돌하지 않는다.

**Given** 운영월 선택값이 URL params에 있다
**When** 사용자가 페이지를 새로고침하거나 링크를 공유한다
**Then** 같은 운영월 기준의 월간 KPI가 다시 조회된다
**And** 선택 상태는 전역 store가 아니라 URL/server data 기준으로 유지된다.

**Given** 월간 KPI 데이터가 로딩 중이다
**When** 운영월이 변경된다
**Then** shadcn Skeleton 또는 명확한 로딩 상태가 표시된다
**And** 이전 운영월 값과 새 운영월 값이 혼동되지 않는다.

**Given** 월간 KPI 조회가 실패한다
**When** 서버 또는 집계 오류가 발생한다
**Then** 안전한 한국어 오류 메시지와 retry affordance가 표시된다
**And** 가능한 경우 마지막 성공 값을 오래된 값임을 표시한 채 유지한다.

**Given** 개발자가 월간 KPI를 검증한다
**When** 운영월 날짜 조건, 방문완료 기준 매출, 미확정 최신 집계, 확정 스냅샷 조회, URL param 유지, 로딩/실패 상태 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 월간 KPI 계산은 dashboard query service에서 수행된다.

### Story 6.3: 주인용 그래프 리포트

As a 주인/관리자,
I want 매출, 코스, 마사지사, 객실, 노쇼/취소 흐름을 그래프로 보기를,
So that 숫자 표만 보지 않고 운영 추세와 위험 신호를 빠르게 판단할 수 있다.

**Acceptance Criteria:**

**Given** 주인 또는 관리자가 주인용 그래프 리포트 화면에 접근한다
**When** 조회날짜 또는 운영월을 선택한다
**Then** 그래프 데이터는 선택 기준에 맞게 조회된다
**And** 집계 기준은 dashboard query service에서 계산된다.

**Given** 운영월에 방문완료 매출 데이터가 있다
**When** 일별 매출 추이 그래프가 표시된다
**Then** 각 날짜의 매출은 `방문완료` 콜 기준으로 계산된다
**And** 비완료 상태 콜은 매출 추이에 포함되지 않는다.

**Given** 운영월에 A~E 코스별 방문완료 콜과 매출 데이터가 있다
**When** 코스별 콜/매출 비중 그래프가 표시된다
**Then** A~E 코스별 콜 수와 매출 비중이 표시된다
**And** 원본 엑셀에서 산출 가능한 데이터만 사용한다.

**Given** 운영월에 마사지사 담당 콜 데이터가 있다
**When** 마사지사 콜 순위 그래프가 표시된다
**Then** 마사지사1과 마사지사2 담당 콜이 모두 반영된다
**And** 직원명 문자열이 아니라 직원 고유 ID 기준으로 집계된다.

**Given** 운영월에 마사지사 정산 계산값이 있다
**When** 마사지사 정산 순위 그래프가 표시된다
**Then** 정산 순위와 금액이 표시된다
**And** 계산 근거는 정산 domain service 결과를 기반으로 한다.

**Given** 현재 객실 상태 데이터가 있다
**When** 객실 상태 분포 그래프가 표시된다
**Then** `사용중`, `청소중`, `예약`, `종료확인`, `빈방` 분포가 표시된다
**And** 상태 의미가 chart color 때문에 혼동되지 않도록 라벨을 함께 표시한다.

**Given** 운영월에 노쇼와 취소 데이터가 있다
**When** 노쇼/취소 추이 그래프가 표시된다
**Then** 날짜별 노쇼와 취소 추이가 표시된다
**And** CRM, 고객 세그먼트, 마케팅 성과 같은 v1 제외 지표는 추가하지 않는다.

**Given** 운영팀 인센 달성률 또는 월마감 지급 구성 그래프가 표시된다
**When** 선택한 운영월에 운영팀 인센 데이터가 없거나 월마감 확정 스냅샷이 아직 없다
**Then** 데이터 없음 또는 미확정 상태를 명확하게 표시한다
**And** 존재하지 않는 데이터를 임의로 꾸며 표시하거나 완료된 지표처럼 취급하지 않는다.

**Given** 개발자가 그래프 리포트를 검증한다
**When** 일별 매출, 코스별 비중, 마사지사 콜 순위, 마사지사 정산 순위, 객실 상태 분포, 노쇼/취소 추이 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 그래프는 원본 엑셀 기능에서 산출 가능한 데이터만 사용한다.

### Story 6.4: 대시보드 로딩/실패/차트 색상 규칙

As a 주인/관리자,
I want 대시보드가 로딩, 실패, 빈 상태와 차트 색상 의미를 일관되게 처리하기를,
So that 시각화가 운영 판단을 돕고 콜 입력이나 상태 의미를 방해하지 않게 할 수 있다.

**Acceptance Criteria:**

**Given** 대시보드 KPI 또는 그래프 데이터가 로딩 중이다
**When** 화면이 렌더링된다
**Then** shadcn Skeleton 또는 layout을 유지하는 로딩 상태가 표시된다
**And** blank screen으로 보이지 않는다.

**Given** 사용자가 조회날짜 또는 운영월을 변경한다
**When** 새 데이터가 로딩된다
**Then** 이전 기준값과 새 기준값이 혼동되지 않도록 로딩 상태가 표시된다
**And** 선택 기준은 URL params 또는 서버 조회 기준과 일치한다.

**Given** 대시보드 조회가 실패한다
**When** 서버 또는 집계 오류가 발생한다
**Then** 안전한 한국어 오류 메시지와 retry affordance가 표시된다
**And** 가능한 경우 마지막 성공 값을 오래된 값임을 표시한 채 유지한다.

**Given** 조회 기준에 데이터가 없다
**When** KPI 또는 그래프를 렌더링한다
**Then** "이 기간의 데이터가 없습니다" 같은 명확한 빈 상태가 표시된다
**And** 임의의 0값 그래프를 꾸며 보여주지 않는다.

**Given** chart series 색상이 필요하다
**When** 그래프를 렌더링한다
**Then** `사용중`, `예약`, `청소중`, `종료확인`, `빈방` status color는 해당 상태 의미를 표시할 때만 사용한다
**And** 임의 매출/순위 series 색상으로 재사용해 의미를 흐리지 않는다.

**Given** chart legend 또는 tooltip이 표시된다
**When** 사용자가 그래프 값을 확인한다
**Then** 색상만이 아니라 텍스트 라벨과 숫자가 함께 표시된다
**And** 색상만으로 차트 의미를 전달하지 않는다.

**Given** 대시보드가 콜 원장 입력 화면과 같은 앱 안에 있다
**When** 대시보드 그래프가 렌더링된다
**Then** 무거운 애니메이션이나 불필요한 client state가 콜 원장 입력 성능에 영향을 주지 않도록 한다
**And** chart library는 구현 시 필요한 최소 범위로 선택한다.

**Given** 개발자가 대시보드 상태 처리를 검증한다
**When** 로딩, 기준 변경, 실패, 빈 상태, status color 의미 보존, legend/tooltip 라벨, 성능 회귀 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 대시보드는 원본 엑셀 기능에서 산출 가능한 지표만 안정적으로 표시한다.

## Epic 7: 엑셀 기능 매핑과 계산 대조 검증

운영자와 개발/QA가 원본 12개 시트와 숨김 시트 `목록`이 ERP로 누락 없이 이전됐는지 확인하고 핵심 계산 결과를 대조할 수 있다.

### Story 7.1: 원본 시트 기능 매핑표

As a 운영자 또는 QA 담당자,
I want 원본 엑셀의 모든 시트가 ERP 기능으로 어떻게 이전됐는지 확인하기를,
So that v1에서 기능 누락 없이 엑셀 업무가 보존됐는지 검증할 수 있다.

**Acceptance Criteria:**

**Given** 사용자가 시트 기능 매핑표를 조회한다
**When** 매핑표가 표시된다
**Then** 원본 `오늘대시보드`, `실시간콜입력`, `웨이터리스트`, `TV현황판`, `운영팀근무인센`, `귀케어일정산`, `마사지사일정산`, `월마감`, `직원DB`, `TV설정`, `설정_코스수당`, 숨김 시트 `목록`이 모두 포함된다
**And** 누락된 시트가 있으면 검증 실패로 표시된다.

**Given** 원본 시트가 매핑표에 포함된다
**When** 각 행을 확인한다
**Then** 각 시트는 ERP 화면, 설정, 계산 엔진, 검증 항목 중 하나 이상에 연결된다
**And** 단순히 "이관됨" 같은 모호한 설명만 표시하지 않는다.

**Given** 숨김 시트 `목록`의 드롭다운 값이 있다
**When** 매핑표를 확인한다
**Then** 상태, 결제수단, 할인구분, 근무상태, 시간 슬롯 등 코드/설정 매핑이 표시된다
**And** 숨김 시트 값도 누락 없이 반영됐는지 확인할 수 있다.

**Given** `실시간콜입력` 시트가 매핑된다
**When** 매핑표를 확인한다
**Then** 콜 원장 입력, 방문완료 계산, 일별 지출, 일별 요약, 코스별 요약과 연결된다
**And** A:S 입력/계산 구조와 U:X 지출/요약 구조가 구분되어 설명된다.

**Given** `웨이터리스트`와 `TV현황판` 시트가 매핑된다
**When** 매핑표를 확인한다
**Then** 객실 상태 계산, 남은 시간, 종료확인, 상태 색상/표시값, TV fullscreen 화면과 연결된다
**And** 두 화면이 같은 상태 계산을 사용한다는 점이 표시된다.

**Given** 정산 관련 시트가 매핑된다
**When** `운영팀근무인센`, `귀케어일정산`, `마사지사일정산`, `월마감` 행을 확인한다
**Then** 각 시트는 일정산, 운영팀 인센, 월마감 스냅샷, 계산 대조 항목과 연결된다
**And** `방문완료` 기준 계산 규칙이 명시된다.

**Given** 마스터 관련 시트가 매핑된다
**When** `직원DB`, `TV설정`, `설정_코스수당`, `목록` 행을 확인한다
**Then** 직원, 객실, 코스, 수당/인센 정책, 코드/시간 슬롯 마스터와 연결된다
**And** 표시명과 고유 ID 분리 원칙이 표시된다.

**Given** 개발자 또는 QA가 매핑표를 검증한다
**When** 12개 시트와 숨김 시트 포함 여부, ERP 기능 연결, 코드값 반영, 계산 대조 항목 연결 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 기능 보존율 100% 검증의 기준 문서로 사용할 수 있다.

### Story 7.2: 핵심 계산 대조 검증 fixture와 테스트

As a QA 담당자,
I want 샘플 또는 이관 데이터로 원본 엑셀과 ERP 계산 결과를 대조하기를,
So that 매출, 수당, 객실 상태, 월마감 계산이 원본 업무 규칙과 일치하는지 확인할 수 있다.

**Acceptance Criteria:**

**Given** 원본 `sheet.xlsx` 또는 샘플 이관 데이터가 준비되어 있다
**When** 계산 대조 fixture를 구성한다
**Then** 방문완료, 예약/사용중/청소중, 노쇼, 취소 상태가 포함된다
**And** 각 상태가 매출/수당/콜인정에 미치는 차이를 검증할 수 있다.

**Given** 방문완료 콜 fixture가 있다
**When** 결제금액과 할인 계산을 대조한다
**Then** 코스 기본판매가, 할인구분 고정 100,000원, 결제금액이 원본 엑셀 결과와 일치한다
**And** 할인구분 없음은 할인금액 0으로 대조된다.

**Given** 마사지사1 또는 마사지사2가 배정된 방문완료 콜 fixture가 있다
**When** 마사지사 수당과 담당 콜을 대조한다
**Then** 마사지사1/2 어느 칸에 있어도 담당 콜과 수당이 원본 기준과 일치한다
**And** 직원 식별은 표시명이 아니라 fixture의 stable mapping 기준으로 처리된다.

**Given** D코스 fixture가 있다
**When** 마사지사2 필수 검증을 대조한다
**Then** 마사지사2 누락 D코스는 저장 또는 방문완료 차단 대상으로 검증된다
**And** 마사지사1/2가 모두 있으면 각 담당 수당이 계산된다.

**Given** 객실 상태 fixture가 있다
**When** 웨이터리스트와 TV현황판 계산을 대조한다
**Then** 객실 상태, 남은 시간, 종료확인, 상태 색상/표시값이 ERP 결과와 원본 기대값에 맞는다
**And** `방문완료`, `노쇼`, `취소`는 활성 객실 상태로 사용되지 않는다.

**Given** 운영팀 인센 fixture가 있다
**When** 일 총콜과 월 총콜 인센을 대조한다
**Then** 일일 30/40/50콜 기준과 월 1000~1500콜 기준이 원본 기준과 일치한다
**And** 정상 상태 직원만 지급 대상임을 검증한다.

**Given** 귀케어 일정산 fixture가 있다
**When** 귀케어 N분의1 정산을 대조한다
**Then** 방문완료 귀케어 풀 합계와 정상 근무자 균등 분배가 원본 기준과 일치한다
**And** 정상근무자 0명은 지급액 0원으로 검증된다.

**Given** 마사지사 일정산과 월마감 fixture가 있다
**When** 만근수당, 갯수왕 수당, 최종지급액을 대조한다
**Then** 8시간 이상 만근 인정, 20일 이상 만근수당, 40콜 이상 갯수왕 1~3위 수당이 원본 기준과 일치한다
**And** 월마감 최종지급액이 대조 결과에 포함된다.

**Given** 개발자 또는 QA가 계산 대조 테스트를 실행한다
**When** fixture 기반 테스트 suite가 실행된다
**Then** 모든 핵심 계산 대조가 통과하거나 불일치 항목이 명확히 보고된다
**And** 테스트는 Excel 셀 좌표가 아니라 업무 의미, 날짜, 운영월, 상태, 고유 ID 기준으로 작성된다.

### Story 7.3: 이관 검증 리포트와 누락 추적

As a 운영자 또는 QA 담당자,
I want 엑셀 기능 매핑과 계산 대조 결과를 리포트로 확인하고 누락/불일치를 추적하기를,
So that v1 기능 보존율 100%와 핵심 계산 일치를 출시 전까지 관리할 수 있다.

**Acceptance Criteria:**

**Given** 시트 기능 매핑표와 계산 대조 테스트 결과가 있다
**When** 이관 검증 리포트를 생성한다
**Then** 시트별 매핑 상태, 계산 대조 상태, 누락 항목, 불일치 항목이 표시된다
**And** 전체 기능 보존율이 계산된다.

**Given** 원본 12개 시트와 숨김 시트 `목록` 중 매핑되지 않은 항목이 있다
**When** 리포트가 생성된다
**Then** 해당 항목은 누락으로 표시된다
**And** 기능 보존율 100% 목표가 미달성으로 표시된다.

**Given** 계산 대조 테스트에서 불일치가 발생한다
**When** 리포트가 생성된다
**Then** 불일치 항목, 기대값, ERP 결과값, 관련 FR 또는 story가 표시된다
**And** QA/개발자가 수정 대상을 추적할 수 있다.

**Given** 계산 대조 테스트가 모두 통과한다
**When** 리포트가 생성된다
**Then** 핵심 계산 일치 상태가 통과로 표시된다
**And** 방문완료 매출, 할인, 콜인정, 수당, 귀케어 풀, 운영팀 인센, 마사지사 정산, 월마감 최종지급액 대조가 포함된다.

**Given** 누락 또는 불일치 항목이 있다
**When** 담당자가 상태를 업데이트한다
**Then** 항목 상태는 미확인, 수정중, 재검증 필요, 통과 같은 추적 가능한 값으로 관리된다
**And** 상태 변경 이력 또는 담당자 메모가 남는다.

**Given** 운영자가 리포트를 조회한다
**When** 특정 시트, FR, epic/story 기준으로 필터링한다
**Then** 관련 매핑과 대조 결과가 표시된다
**And** 출시 전 남은 위험을 빠르게 확인할 수 있다.

**Given** 리포트가 기능 보존율 100%를 표시한다
**When** 숨김 시트 `목록`의 드롭다운 값 또는 시트별 계산 항목이 누락되어 있다
**Then** 100%로 표시되지 않는다
**And** 숨김 시트도 동일한 검증 대상으로 취급된다.

**Given** 개발자 또는 QA가 이관 검증 리포트를 검증한다
**When** 매핑 완료, 누락 항목, 계산 불일치, 전체 통과, 필터링, 상태 추적 테스트를 실행한다
**Then** 모든 테스트가 통과한다
**And** 리포트는 신규 CRM/마케팅/멤버십 같은 v1 제외 범위를 성공 기준에 포함하지 않는다.
