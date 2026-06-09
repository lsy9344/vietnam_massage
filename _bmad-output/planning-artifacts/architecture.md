---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - _bmad-output/planning-artifacts/briefs/brief-vietnam_massage-2026-06-07/.decision-log.md
  - _bmad-output/planning-artifacts/briefs/brief-vietnam_massage-2026-06-07/addendum.md
  - _bmad-output/planning-artifacts/briefs/brief-vietnam_massage-2026-06-07/brief.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/.decision-log.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/addendum.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/reconcile-brief.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/reconcile-client-spec.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/reconcile-modules.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/reconcile-sheet-design.md
  - _bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/review-rubric.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/.decision-log.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/EXPERIENCE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/review-accessibility.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/review-rubric.md
  - _bmad-output/planning-artifacts/ux-designs/ux-vietnam_massage-2026-06-07/validation-report.md
  - docs/modules/README.md
  - docs/modules/audit.md
  - docs/modules/calls.md
  - docs/modules/closing.md
  - docs/modules/dashboard.md
  - docs/modules/masters.md
  - docs/modules/rooms.md
  - docs/modules/settlements.md
  - docs/plans/2026-06-07-module-structure-design.md
  - docs/plans/2026-06-07-module-structure.md
  - _bmad-output/project-context.md
workflowType: 'architecture'
project_name: 'vietnam_massage'
user_name: 'noah'
date: '2026-06-07'
lastStep: 8
status: 'complete'
completedAt: '2026-06-07'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## 프로젝트 컨텍스트 분석

### 요구사항 개요

**기능 요구사항:**

PRD는 37개 기능 요구사항을 정의한다. 범주는 실시간 객실/콜 현황, 마스터 설정, 예약/콜 원장, 객실 현황과 TV 현황판, 일정산, 월마감, 대시보드와 리포트, 권한/감사 로그, 데이터 이관과 검증이다.

아키텍처상 중심은 `실시간콜입력`을 대체하는 서비스 콜 원장이다. `masters`의 운영월, 객실, 직원, 코스, 코드, 수당/인센 정책이 `calls`로 공급되고, `calls`는 객실/TV 현황, 정산, 월마감, 대시보드의 기준 데이터가 된다. 화면은 엑셀 시트명을 복제하지 않고 `masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit` 도메인 경계를 따라 구성해야 한다.

가장 중요한 계산 규칙은 `방문완료` 상태만 매출, 수당, 귀케어 풀, 콜인정에 반영한다는 점이다. 할인은 v1에서 할인구분이 있으면 고정 100,000원이며, D코스는 마사지사2 입력을 필수로 검증한다. 월마감은 미리보기, 검토, 확정, 잠금, 재오픈 흐름을 가지며 확정 시점의 지급 근거를 스냅샷으로 보존해야 한다.

**비기능 요구사항:**

정확성이 최우선이다. ERP 계산 결과는 원본 엑셀의 업무 규칙과 일치해야 하며, 행 번호나 셀 좌표가 아니라 운영월, 날짜, 상태, 고유 ID 기준으로 계산해야 한다.

실시간 객실/콜 현황과 TV 현황판은 빠르게 갱신되어야 한다. TV 갱신 방식은 아직 자동 새로고침과 웹소켓 중 확정되지 않았으므로, 아키텍처 결정 단계에서 명시해야 한다. 정산과 월마감 계산은 화면을 멈추는 클라이언트 수식 방식이 아니라 서버 계산 또는 집계로 처리해야 한다.

보안은 NextAuth/Auth.js 기반 인증과 역할별 권한 제어가 필요하다. 지급액, 수당, 마감, 직원 정보에 영향을 주는 기능은 화면 접근뿐 아니라 실행 시점 권한 검사도 통과해야 한다.

감사성과 불변성이 핵심 NFR이다. 콜 상태, 결제/할인, 담당자, 출퇴근, 수당표, 직원, 월마감 확정/취소/재오픈 변경은 감사 로그 대상이며, 월마감 확정 스냅샷은 이후 설정 변경으로 자동 재계산되면 안 된다.

UX 측면에서는 데스크톱 웹이 1차 표면이고, TV 현황판 풀스크린 모드가 2차 표면이다. 콜 원장은 엑셀 입력 속도를 보존해야 하므로 키보드 그리드, type-ahead 드롭다운, blur 시 행 단위 autosave, 읽기 전용 계산 셀을 지원해야 한다. 접근성 기준으로 상태는 색상만으로 전달하지 않고 라벨과 글리프를 함께 사용해야 하며, D코스 오류는 `aria-invalid`, `aria-describedby`, `role="alert"` 같은 프로그램적 연결이 필요하다.

**규모와 복잡도:**

- Primary domain: 데스크톱 웹 기반 풀스택 운영 ERP
- Complexity level: 높음
- Estimated architectural components: 8개 도메인 모듈(`masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit`, `shared`) + 인증/권한 + 데이터 이관/검증 흐름
- Complexity drivers: 엑셀 기능 보존, 계산 정확성, 마감 스냅샷 불변성, 감사 로그, 권한 게이트, 빠른 그리드 입력, TV/객실 현황 갱신, 정산/월마감 서버 계산

### 기술 제약과 의존성

- 서버와 앱 프레임워크는 Next.js + Node.js를 사용한다.
- 데이터베이스는 PostgreSQL을 사용한다.
- ORM과 마이그레이션은 Prisma를 사용한다.
- 인증은 NextAuth/Auth.js를 사용한다.
- UI 기반은 Tailwind CSS v4 + shadcn/ui를 사용한다.
- v1은 한국어 전용, 라이트 모드 전용, 데스크톱 웹 중심이다.
- 네이티브 모바일/태블릿, 다크 모드, i18n, CRM, 마케팅 자동화, 회계 연동, 멤버십, 외부 POS/PG 연동은 v1 범위가 아니다.
- 패키지 매니저, 테스트 러너, lint/format 설정은 구현 착수 전 확정해야 한다.
- 원본 `sheet.xlsx`의 실제 운영 데이터 이관 범위와 기간은 구현 계획 전 확정해야 한다.

### 식별된 교차 관심사

- 계산 정확성: `방문완료` 기준, 할인, D코스, 귀케어 0명, 만근, 갯수왕, 운영팀 인센을 도메인 테스트로 검증해야 한다.
- 마감 불변성: 확정 월마감은 정책, 직원명, 원장 변경으로 흔들리지 않는 스냅샷을 가져야 한다.
- 감사 로그: 지급액이나 운영 상태에 영향을 주는 변경은 불변 이력으로 남아야 한다.
- 권한 제어: 화면 접근과 실행 권한을 모두 분리해야 한다.
- 실시간성/갱신: 첫 화면, 객실 현황, TV 현황판은 같은 상태 계산 결과를 공유해야 하며 갱신 지연 상태를 표시해야 한다.
- 키보드 중심 입력: 콜 원장 그리드는 빠른 입력, autosave, 계산 셀 갱신, 오류 보류 상태를 지원해야 한다.
- 접근성: 상태 토큰, 글리프, 라벨, 모션 안전, 오류 알림, 월마감 모달 포커스 관리를 구현 기준으로 유지해야 한다.
- 정책 이력: 객실/직원/코스명은 안정 키가 아니며, 수당/인센/가격 정책은 적용월과 이력을 가져야 한다.
- 데이터 이관 검증: 원본 12개 시트와 숨김 시트 `목록`을 기능/설정/검증 항목으로 모두 매핑해야 한다.

## Starter Template Evaluation

### Primary Technology Domain

데스크톱 웹 중심의 full-stack Next.js ERP다. v1은 한국어 전용, 라이트 모드 전용, 모바일/네이티브 앱 없음.

### Starter Options Considered

1. Official `create-next-app`

- 장점: Next.js 공식 starter, TypeScript/App Router/Tailwind/ESLint/src-dir/import alias를 명시적으로 선택 가능.
- 단점: Prisma, Auth.js, shadcn/ui, 테스트 러너는 별도 추가 필요.
- 판단: 선택. 고정 스택을 가장 덜 왜곡하고, ERP 도메인 구조를 직접 얹기 쉽다.

2. `shadcn@latest init -t next`

- 장점: shadcn/ui 기반 Next.js 앱을 빠르게 구성.
- 단점: DB/Auth/도메인 구조 결정은 여전히 별도이며, 현재 워크스페이스가 비어 있지 않다.
- 판단: 단독 starter보다는 `create-next-app` 이후 shadcn 초기화로 사용.

3. Create T3 App

- 장점: Next.js, Tailwind, Prisma, NextAuth 옵션 제공. CLI flags도 제공된다.
- 단점: tRPC 등 v1 ERP에 필요 없는 선택을 끌어들이기 쉽고 shadcn/ui는 기본 목적이 아니다.
- 판단: 이번 프로젝트에는 과하다.

4. Prisma Auth.js guide / auth starter

- 장점: Prisma + Auth.js + Next.js 통합 기준으로 유용.
- 단점: ERP starter라기보다 인증/DB 통합 레퍼런스다.
- 판단: starter가 아니라 구현 참고 문서로 사용.

### Selected Starter: Official Next.js App Router Starter

**Rationale for Selection:**

공식 `create-next-app` 기반으로 시작하고, 이후 shadcn/ui, Prisma, Auth.js를 명시적으로 추가한다. 이 방식은 엑셀 기능 보존 ERP라는 프로젝트 성격에 맞게 불필요한 SaaS/CRM/결제/마케팅 구조를 피하고, `masters`, `calls`, `rooms`, `settlements`, `closing`, `dashboard`, `audit` 도메인 경계를 직접 설계할 수 있다.

패키지 매니저는 `pnpm`을 starter 기준으로 채택한다.

**Initialization Command:**

```bash
pnpm create next-app@latest vietnam_massage_app \
  --ts \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --use-pnpm \
  --disable-git
```

현재 프로젝트 루트는 비어 있지 않으므로 구현 스토리에서는 새 임시 앱을 만든 뒤 생성된 `package.json`, config, `src/app`, Tailwind/Next 설정을 기존 문서와 `src/modules` 구조를 보존하며 병합한다.

**Follow-up Setup Commands:**

```bash
pnpm dlx shadcn@latest init
pnpm add @prisma/client @prisma/adapter-pg dotenv pg zod
pnpm add -D prisma tsx @types/pg
pnpm add @auth/prisma-adapter next-auth@beta
```

### Architectural Decisions Provided by Starter

**Language & Runtime:**
TypeScript + Next.js App Router + Node.js runtime.

**Styling Solution:**
Tailwind CSS v4 foundation, then shadcn/ui components and project-specific status/design tokens.

**Build Tooling:**
Next.js official build/dev tooling. Turbopack may be used through current Next defaults, but production behavior should be verified during implementation.

**Testing Framework:**
Not provided by the selected starter. Test runner must be chosen in the architecture decisions step, with priority on domain calculation tests before UI tests.

**Code Organization:**
Use `src/app` for routes/screens and preserve domain modules under `src/modules/*`. Screens call domain services; calculation rules do not live in UI components.

**Development Experience:**
Official Next dev server, TypeScript, ESLint, Tailwind, shadcn component CLI, Prisma migrations/client generation, Auth.js route/middleware setup.

**Version Verification:**
2026-06-07 npm registry check observed: `next` 16.2.7, `react` 19.2.7, `tailwindcss` 4.3.0, `shadcn` 4.10.0, `prisma`/`@prisma/client` 7.8.0, `next-auth@beta` 5.0.0-beta.31. Implementation should rely on `@latest` during scaffolding and record resolved versions in `package.json`.

**Reference Sources:**

- Next.js `create-next-app` CLI: https://nextjs.org/docs/app/api-reference/cli/create-next-app
- shadcn/ui Next.js installation: https://ui.shadcn.com/docs/installation/next
- Prisma + Auth.js + Next.js guide: https://www.prisma.io/docs/guides/authentication/authjs/nextjs
- Create T3 App installation: https://create.t3.gg/en/installation

**Note:**
Project initialization using this selected starter should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**

- Data architecture: decided.
- Authentication and security: decided.
- API and communication patterns: decided.
- Frontend architecture: decided.
- Infrastructure and deployment: decided.

**Important Decisions (Shape Architecture):**

- Testing stack and implementation sequencing: deferred to implementation patterns and story planning.
- Observability and audit event implementation: audit is architecturally required; external APM remains deployment-standard dependent.

**Deferred Decisions (Post-MVP):**

- CRM, marketing automation, accounting integration, customer mobile app, membership, and external POS/PG integrations remain outside v1 scope.

### Data Architecture

**Decision:** Use PostgreSQL as the production database, targeting PostgreSQL 18 current where available and allowing supported PostgreSQL 17 or 16 if the deployment environment constrains the available version.

**ORM and migrations:** Use Prisma 7.x as the schema, query, and migration layer. Manage schema changes through `prisma migrate`; do not hand-edit production schema drift.

**Validation:** Use Zod 4.x for server-side input validation at Server Action/API boundaries before writing to domain services.

**Modeling approach:** Model business rules around ERP concepts rather than Excel cell coordinates. Use stable IDs for employees, rooms, courses, calls, operating months, policy records, and monthly close snapshots. Names remain display values and can change without rewriting historical settlements.

**Policy and snapshot strategy:** Use effective-month policy/history records for course prices, therapist course rates, operation-team incentives, status/code values, and display names when they affect calculations. On monthly close confirmation, persist payout snapshots and calculation evidence so later master/policy changes do not recalculate historical payout results.

**Caching strategy:** Do not introduce Redis or a separate cache service in v1. Start with PostgreSQL indexes, query shaping, Prisma query discipline, and Next.js-level cache/revalidation where appropriate. Revisit external caching only if measured latency in live room/TV/dashboard queries requires it.

**Real-time data stance:** Design room/TV status queries so they can support polling/auto-refresh first and websocket/SSE later without changing domain calculations. The exact communication pattern is decided under API and communication patterns.

**Rationale:** This preserves the confirmed stack, keeps the first implementation path boring, and puts the risk where it belongs: calculation correctness, historical immutability, and migration verification rather than infrastructure novelty.

### Authentication & Security

**Decision:** Use Auth.js/NextAuth as the authentication framework. At implementation time, use Auth.js/NextAuth v5 if it is stable; if v5 remains beta or integration risk is high, use the latest stable NextAuth v4 and document the version choice in `package.json` and project context.

**Current version check:** 2026-06-07 registry check observed `next-auth@beta` 5.0.0-beta.31, stable `next-auth` 4.24.14, and `@auth/prisma-adapter` 2.11.2.

**Login model:** Use administrator-provisioned staff accounts with password login. Do not provide public signup in v1. This matches the ERP context where users are employees or operational viewers, not public customers.

**Password storage:** Store password hashes using Argon2id, with `@node-rs/argon2` as the preferred implementation package. Never store plaintext passwords or reversible password material.

**User and employee separation:** Keep login identity separate from employee display data. Model a `UserAccount` linked to `Employee` so employee name, role, display status, and settlement history can change without corrupting authentication records or historical payout snapshots.

**Authorization model:** Use RBAC for administrator, counter, waiter, settlement manager, and read-only viewer roles. Sidebar visibility and landing screens follow role rules, but UI hiding is not security.

**Execution-time enforcement:** Re-check authorization in Server Actions, route handlers, and domain services before any operation that affects calls, payment, discounts, staff assignments, shifts, rate policies, employee data, monthly close state, reopen actions, or audit-visible records.

**Session strategy:** Keep session payloads minimal: user/account ID and role hints only. For sensitive actions, reload current user/account status and permission from the database to avoid stale authorization.

**Account safety:** Support inactive account blocking, login failure tracking, and account lockout or administrator reset for repeated failures. No self-service public account recovery is required for v1 unless the operator explicitly asks for it later.

**Audit boundary:** Audit logs prioritize domain changes that affect payout or operational state: service-call status, payment/discount, therapist/earcare assignment, shift time, rate/incentive policy, employee data, monthly close confirmation, cancelation, and reopen. Authentication events may be logged for admin visibility later, but they do not replace domain audit logs.

**Data security baseline:** Use environment-managed secrets, HTTPS in deployed environments, secure session cookies, server-side authorization checks, and immutable-by-default monthly close snapshots/audit records. General operational flows must not delete audit history or confirmed close snapshots.

**Rationale:** This keeps authentication inside the confirmed stack while matching the real operating model of a small staff ERP. The main security risk is not public signup; it is unauthorized mutation of payout-affecting data, so authorization and audit are enforced at action boundaries.

### API & Communication Patterns

**Decision:** Use Next.js App Router Server Actions for internal UI mutations and Route Handlers only for framework-required or special endpoints.

**Internal mutations:** Prefer Server Actions for ERP UI actions such as service-call row autosave, status changes, daily expense updates, shift updates, settlement preview triggers, monthly close state transitions, master data changes, and reopen requests.

**Route Handlers:** Use `app/**/route.ts` for Auth.js routes, export/download endpoints, health checks, and any future webhook or integration surface. Do not create a broad REST API for internal screens unless an external client is actually required.

**Domain service boundary:** Keep business logic in `src/modules/*` services. Server Actions and Route Handlers are thin adapters that authenticate, authorize, validate, call domain services, and map results to UI/API response shapes.

**Validation:** Treat Server Actions and Route Handlers as untrusted public entrypoints. Validate all inputs with Zod before invoking domain services.

**Error response shape:** Use structured action results with `fieldErrors`, `formError`, and `domainErrorCode` for user-visible failures. Domain services should return or throw explicit domain errors rather than leaking Prisma or infrastructure errors into UI code.

**Call ledger autosave:** Implement call-ledger editing as row-level Server Actions. On success, return saved row state, computed read-only fields, and row save status so the grid can update without duplicating calculation logic in the client.

**Room/TV refresh:** Use polling/auto-refresh for v1 live room and TV status. The implemented shared controller uses a 15-second polling interval with a refresh-delay state, and always displays last updated time or refresh delay state so stale boards are visible.

**Realtime extension path:** Defer WebSocket/SSE for the first implementation. Keep room/TV query and DTO design independent from transport so polling can be replaced or supplemented with SSE/websocket later if measured latency or operator feedback requires it.

**Rate limiting:** Avoid introducing Redis in v1. Apply DB-backed throttling or lockout for login and sensitive mutations such as monthly close/reopen if needed. Revisit centralized rate limiting only when external API exposure or traffic volume justifies it.

**API documentation:** Do not introduce OpenAPI for internal-only Server Actions. Preserve contracts through TypeScript types, Zod schemas, domain service tests, and this architecture document. Add OpenAPI only if an external integration surface enters scope.

**Rationale:** This fits a single Next.js ERP, avoids unnecessary API surface, and keeps the implementation focused on correctness, authorization, and fast operational UI feedback.

### Frontend Architecture

**Decision:** Use Next.js App Router with Server Components by default and Client Components only for interaction-heavy surfaces.

**Component system:** Use shadcn/ui base components plus domain-specific components: `RoomStatusCard`, `EditableCallGrid`, `MonthCloseStepper`, `SettlementEvidenceBlock`, `StatusBadge`, `CallStateChip`, and role-aware sidebar navigation.

**Call ledger grid:** Build the call ledger on `@tanstack/react-table` as a headless table foundation, but implement the keyboard navigation, editable cells, type-ahead dropdown cells, autosave states, computed read-only cells, and D-course validation UI as project-specific behavior. Do not treat a generic data table as sufficient for the Excel-speed call-entry workflow.

**Server state:** Start with Server Components and Server Actions as the primary data flow. Use TanStack Query only where client-managed polling, refresh state, or optimistic interaction is genuinely useful, especially room/TV status refresh and possibly the call ledger grid.

**Forms:** Use React Hook Form with Zod resolver for conventional forms such as employee, room, course, rate, incentive, and code settings. The call ledger grid is not a conventional form and should use its own row/cell editing model.

**Global state:** Do not introduce Redux, Zustand, or another global state store in v1. Use URL params for operating month/date/view selection, server data for persisted state, and local component state for transient UI editing state.

**Design tokens:** Implement the locked status tokens and brand layer from `DESIGN.md` in the Tailwind/shadcn theme layer. Status colors must remain consistent across first screen, room status, TV board, dashboard chips, and grid dropdowns.

**Accessibility:** Preserve the UX spine requirements: status indicators always include color, text label, and glyph; D-course errors use `aria-invalid`, `aria-describedby`, and alert semantics; monthly close confirmation uses shadcn Dialog with focus trap, non-destructive initial focus, `Esc` cancel, focus return, and `role="alertdialog"`.

**TV mode:** Implement TV board as a dedicated fullscreen route using the same room-status DTO as the regular room-status screen. Hide chrome/sidebar/input controls, poll for updates, and show last-updated or refresh-delay state.

**Charts:** Defer chart library lock-in until dashboard implementation. Prefer a lightweight React chart library such as Recharts only if KPI cards and simple CSS/table visualizations are insufficient. Dashboard visuals must not slow the call-entry grid.

**Performance:** Query and render the call ledger by selected date within an operating month. Do not render the full monthly 31-day x 100-slot input volume as one editable grid. Use date navigation and summary queries for monthly views.

**Rationale:** This keeps the UI close to the UX spec: dense, keyboard-first, and operational, while avoiding speculative state-management complexity.

### Infrastructure & Deployment

**Decision:** Design for a Next.js Node server deployment. Do not use static export because the ERP requires authentication, Server Actions, Route Handlers, Prisma/PostgreSQL access, dynamic dashboards, and monthly close mutations.

**Hosting stance:** Support either managed Next.js hosting or self-hosted Node deployment according to the project standard. If self-hosted, place a reverse proxy such as nginx in front of the Next.js server for HTTPS termination, request size limits, slow-request protection, and basic traffic controls.

**Database environments:** Keep production, staging, and local development databases separate. Production/staging use PostgreSQL managed service or operations-managed PostgreSQL according to the project standard.

**Migration procedure:** Use `prisma migrate deploy` in CI/CD or release phase for staging and production. Never use `prisma migrate dev` against production. Commit Prisma schema and migration history to source control.

**Environment variables:** Do not commit `.env*` files. Keep `DATABASE_URL`, `AUTH_SECRET`, OAuth credentials, SMTP credentials, and other secrets server-only. Do not prefix secrets with `NEXT_PUBLIC_`. Public runtime values must be intentionally exposed and documented.

**CI/CD baseline:** Run dependency install, typecheck, lint, domain/unit tests, build, and then production migration deployment in the release path. Migration approval and rollback procedures must be aligned with the project standard before implementation cutover.

**Monitoring/logging:** Start with application logs, migration logs, domain audit logs, and database-level operational logs. External APM or log aggregation can be added if the deployment standard already includes it or if production operation reveals the need.

**Backup and restore:** PostgreSQL backup and restore procedures are mandatory because monthly close snapshots and audit logs are business-critical records. Define backup retention, restore testing, and point-in-time recovery expectations before production cutover.

**Operational confirmations before implementation:** Confirm hosting provider, domain/HTTPS setup, database hosting, backup retention, migration approval flow, and deployment environment naming.

**Reference Sources:**

- Next.js self-hosting: https://nextjs.org/docs/app/guides/self-hosting
- Next.js environment variables: https://nextjs.org/docs/app/guides/environment-variables
- Prisma `migrate deploy`: https://docs.prisma.io/docs/cli/migrate/deploy

**Rationale:** The ERP depends on dynamic server behavior and durable database records. The deployment architecture should keep runtime and migration operations boring, observable, and recoverable.

### Decision Impact Analysis

**Implementation Sequence:**

1. Initialize and merge the official Next.js App Router starter while preserving existing documents and `src/modules` scaffolding.
2. Add shadcn/ui, Tailwind theme tokens, Prisma, Auth.js/NextAuth, Zod, and the selected table/form utilities.
3. Implement PostgreSQL/Prisma schema around stable IDs, effective-month policies, service-call ledger, settlements, monthly close snapshots, and audit logs.
4. Build authentication, staff account provisioning, RBAC checks, and server-side authorization helpers before payout-affecting mutations.
5. Implement domain services and tests for completed-call calculations, discounts, D-course validation, shifts crossing midnight, earcare zero-normal-staff payout, monthly close bonuses, and snapshot immutability.
6. Build Server Actions and thin Route Handlers around those domain services.
7. Build frontend surfaces in UX-priority order: live room/call status, call ledger grid, room/TV status, daily settlements, monthly close, dashboards, masters, audit log.
8. Add migration/deployment pipeline and backup/restore checks before production cutover.

**Cross-Component Dependencies:**

- `masters` feeds policy, room, employee, course, code, and time-slot data into all other modules.
- `calls` is the source ledger for room status, settlements, dashboard metrics, and monthly close.
- `rooms` and TV routes must read the same room-status DTO and never recalculate settlement logic.
- `settlements` depends on completed calls and effective policies, then feeds monthly close.
- `closing` depends on settlements and calls, then freezes payout snapshots for historical dashboard reads.
- `audit` observes sensitive mutations across `masters`, `calls`, `settlements`, and `closing` but does not own domain calculations.
- Frontend Server Actions and Route Handlers depend on shared auth, authorization, validation, and domain error conventions.

**Deferred or Watch Decisions:**

- TV/room refresh can start with polling and later move to SSE/websocket if measured operational latency requires it.
- External caching is deferred until query/index tuning and Next-level cache/revalidation are insufficient.
- Chart library is deferred until dashboard implementation proves CSS/simple visualizations insufficient.
- Auth.js v5 vs stable v4 must be rechecked at implementation time because v5 was still beta during this architecture run.
- Hosting provider details, backup retention, and migration approval flow remain project-standard confirmations before implementation.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:**
AI 에이전트가 다르게 구현하기 쉬운 충돌 지점은 데이터베이스 명명, 파일 구조, Server Action 응답 형식, 도메인 오류, 날짜/금액 포맷, 권한 검사 위치, 로딩/저장 상태, 감사 이벤트 명명이다.

### Naming Patterns

**Database Naming Conventions:**

- Prisma model은 PascalCase 단수형: `ServiceCall`, `MonthlyClosing`, `AuditLog`
- DB table은 snake_case 복수형으로 map: `service_calls`, `monthly_closings`, `audit_logs`
- DB column은 snake_case: `employee_id`, `operating_month_id`, `created_at`
- 코드 필드는 camelCase: `employeeId`, `operatingMonthId`, `createdAt`
- foreign key는 `{entity}_id` 형식
- index/unique 이름은 `idx_{table}_{columns}`, `uq_{table}_{columns}` 형식

**API/Action Naming Conventions:**

- Server Action 파일은 도메인 route 근처 또는 module adapter에 두되 이름은 동사형: `saveServiceCallRow`, `confirmMonthlyClose`
- Route Handler 경로는 kebab-case 복수형: `/api/exports/monthly-close`
- query param은 camelCase: `operatingMonthId`, `serviceDate`

**Code Naming Conventions:**

- React component는 PascalCase: `EditableCallGrid`
- component 파일은 kebab-case: `editable-call-grid.tsx`
- domain service 파일은 kebab-case: `service-call-service.ts`
- 함수/변수는 camelCase
- 도메인 상태 원문은 한국어 값을 보존: `방문완료`, `사용중`, `종료확인`

### Structure Patterns

**Project Organization:**

- `src/app`: routes, layouts, page composition
- `src/components/ui`: shadcn/ui generated components
- `src/components/domain`: cross-route domain UI components
- `src/modules/{domain}`: domain services, schemas, DTOs, repository helpers, tests
- `src/shared`: only truly shared constants, types, and pure utilities
- `prisma`: schema and migrations

**Test Placement:**

- domain calculation tests are co-located in module folders as `*.test.ts`
- UI/e2e tests can live under `tests/` once framework is selected
- calculation rules must be tested before UI-dependent workflows

### Format Patterns

**Action Response Format:**

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      fieldErrors?: Record<string, string[]>;
      formError?: string;
      domainErrorCode?: string;
    };
```

**Data Exchange Formats:**

- JSON field names use camelCase
- dates use ISO `YYYY-MM-DD` for service dates
- date-times use ISO strings with timezone-aware server handling
- money values are integer minor units or whole VND number fields, not formatted strings
- formatted display strings are generated in UI, not stored as calculation values

### Communication Patterns

**Audit Event Patterns:**

- event/action names use dot notation: `service_call.status_changed`, `monthly_close.confirmed`
- audit payload includes actor ID, target type, target ID, before, after, timestamp, and reason when required
- audit observes domain changes but does not calculate domain rules

**State Management Patterns:**

- persisted state comes from server/domain services
- selected operating month/date is stored in URL params
- transient editing state stays local to the component
- no Redux/Zustand in v1

### Process Patterns

**Error Handling Patterns:**

- validate input with Zod at action/route boundary
- domain services raise explicit domain errors
- UI displays user-safe Korean messages
- Prisma/infrastructure errors are logged server-side and mapped to safe user errors

**Loading and Saving Patterns:**

- dashboard and KPI loading uses shadcn Skeleton
- call grid row autosave states: `idle`, `saving`, `saved`, `error`
- autosave failure preserves input and shows inline retry
- TV/room stale state shows last updated time and refresh delay

### Enforcement Guidelines

**All AI Agents MUST:**

- keep calculation logic out of React components
- preserve `방문완료` as the only sales/settlement-recognized state
- validate and authorize every Server Action and Route Handler
- use stable IDs, not employee/room/course display names, as keys
- preserve monthly close snapshots after confirmation
- write domain tests for payout-affecting rules before UI implementation

**Pattern Enforcement:**

- pattern violations should be recorded in the architecture document or project-context update
- new shared abstractions require at least two real callers or an established local pattern
- any new technology/library must update `project-context.md` before implementation proceeds

### Pattern Examples

**Good Examples:**

- `ServiceCall` model mapped to `service_calls`
- `saveServiceCallRow()` validates with Zod, checks permission, calls `calls` service, returns `ActionResult<SavedCallRowDto>`
- `RoomStatusCard` receives a `RoomStatusDto`; it does not query settlements or recalculate payout
- `monthly_close.confirmed` audit event includes actor, target month, before/after state, and snapshot ID

**Anti-Patterns:**

- using employee name as a settlement key
- recalculating monthly payout inside a dashboard component
- returning raw Prisma errors to the browser
- creating a generic REST API for every screen without an external client need
- rendering all 31 days x 100 slots as one editable grid

## Project Structure & Boundaries

### Complete Project Directory Structure

```text
vietnam_massage/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json
├── .env.example
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
│   └── assets/
├── src/
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── (auth)/
│   │   │   └── sign-in/
│   │   │       └── page.tsx
│   │   ├── (erp)/
│   │   │   ├── layout.tsx
│   │   │   ├── live/
│   │   │   │   └── page.tsx
│   │   │   ├── calls/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── rooms/
│   │   │   │   └── page.tsx
│   │   │   ├── tv/
│   │   │   │   └── page.tsx
│   │   │   ├── settlements/
│   │   │   │   ├── therapists/page.tsx
│   │   │   │   ├── earcare/page.tsx
│   │   │   │   └── operations/page.tsx
│   │   │   ├── closing/
│   │   │   │   ├── page.tsx
│   │   │   │   └── actions.ts
│   │   │   ├── dashboard/
│   │   │   │   ├── today/page.tsx
│   │   │   │   ├── monthly/page.tsx
│   │   │   │   └── reports/page.tsx
│   │   │   ├── masters/
│   │   │   │   ├── operating-months/page.tsx
│   │   │   │   ├── rooms/page.tsx
│   │   │   │   ├── employees/page.tsx
│   │   │   │   ├── courses/page.tsx
│   │   │   │   ├── rates/page.tsx
│   │   │   │   └── codes/page.tsx
│   │   │   └── audit/
│   │   │       └── page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── health/route.ts
│   │       └── exports/
│   │           └── monthly-close/route.ts
│   ├── components/
│   │   ├── ui/
│   │   └── domain/
│   │       ├── editable-call-grid.tsx
│   │       ├── room-status-card.tsx
│   │       ├── status-badge.tsx
│   │       ├── call-state-chip.tsx
│   │       ├── month-close-stepper.tsx
│   │       └── settlement-evidence-block.tsx
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── prisma.ts
│   │   ├── action-result.ts
│   │   ├── authorization.ts
│   │   └── utils.ts
│   ├── modules/
│   │   ├── masters/
│   │   │   ├── README.md
│   │   │   ├── schemas.ts
│   │   │   ├── dtos.ts
│   │   │   ├── masters-service.ts
│   │   │   └── masters-service.test.ts
│   │   ├── calls/
│   │   │   ├── README.md
│   │   │   ├── schemas.ts
│   │   │   ├── dtos.ts
│   │   │   ├── service-call-service.ts
│   │   │   └── service-call-service.test.ts
│   │   ├── rooms/
│   │   │   ├── README.md
│   │   │   ├── dtos.ts
│   │   │   ├── room-status-service.ts
│   │   │   └── room-status-service.test.ts
│   │   ├── settlements/
│   │   │   ├── README.md
│   │   │   ├── schemas.ts
│   │   │   ├── dtos.ts
│   │   │   ├── settlement-service.ts
│   │   │   └── settlement-service.test.ts
│   │   ├── closing/
│   │   │   ├── README.md
│   │   │   ├── schemas.ts
│   │   │   ├── dtos.ts
│   │   │   ├── monthly-closing-service.ts
│   │   │   └── monthly-closing-service.test.ts
│   │   ├── dashboard/
│   │   │   ├── README.md
│   │   │   ├── dtos.ts
│   │   │   ├── dashboard-query-service.ts
│   │   │   └── dashboard-query-service.test.ts
│   │   └── audit/
│   │       ├── README.md
│   │       ├── audit-event.ts
│   │       ├── audit-service.ts
│   │       └── audit-service.test.ts
│   └── shared/
│       ├── README.md
│       ├── constants/
│       │   ├── README.md
│       │   └── domain-status.ts
│       ├── types/
│       │   ├── README.md
│       │   └── ids.ts
│       └── utils/
│           ├── README.md
│           ├── money.ts
│           └── operating-date.ts
├── tests/
│   ├── e2e/
│   └── fixtures/
├── docs/
│   ├── modules/
│   └── plans/
└── _bmad-output/
    └── planning-artifacts/
```

### Architectural Boundaries

**API Boundaries:**

- Server Actions are the default mutation boundary for ERP UI.
- Route Handlers are limited to Auth.js, health, exports, and future external integrations.
- No broad internal REST API is created without an external client requirement.

**Component Boundaries:**

- `src/app` composes pages and route layouts.
- `src/components/ui` contains shadcn-generated primitives only.
- `src/components/domain` contains reusable ERP UI that receives DTOs and callbacks.
- Components do not own settlement, close, or payout calculations.

**Service Boundaries:**

- `masters` owns operating months, rooms, employees, courses, codes, rates, and incentives.
- `calls` owns service-call ledger, assignments, status history, daily expenses, completed-call calculations.
- `rooms` owns room-status/TV display DTOs only.
- `settlements` owns daily therapist, earcare, and operations-team calculations.
- `closing` owns monthly close workflow, payout snapshots, locks, and reopen.
- `dashboard` owns read-only KPI queries.
- `audit` owns immutable change history and observes sensitive mutations.

**Data Boundaries:**

- Prisma schema is the source of database structure.
- Domain services read/write through Prisma helpers, not UI components.
- Monthly close snapshots are historical records and must not be overwritten by current policy changes.

### Requirements to Structure Mapping

**FR Category Mapping:**

- FR-1 to FR-3: `src/app/(erp)/live`, `src/modules/rooms`, `src/modules/dashboard`
- FR-4 to FR-9: `src/app/(erp)/masters`, `src/modules/masters`
- FR-10 to FR-15: `src/app/(erp)/calls`, `src/modules/calls`
- FR-16 to FR-19: `src/app/(erp)/rooms`, `src/app/(erp)/tv`, `src/modules/rooms`
- FR-20 to FR-25: `src/app/(erp)/settlements`, `src/modules/settlements`
- FR-26 to FR-30: `src/app/(erp)/closing`, `src/modules/closing`
- FR-31 to FR-33: `src/app/(erp)/dashboard`, `src/modules/dashboard`
- FR-34: `src/lib/auth.ts`, `src/lib/authorization.ts`, route layouts/actions
- FR-35: `src/modules/audit`
- FR-36 to FR-37: `docs/modules`, tests, migration fixtures, domain calculation tests

### Integration Points

**Internal Communication:**

- Pages call Server Components and Server Actions.
- Server Actions validate, authorize, call domain services, and return `ActionResult<T>`.
- Domain services call other domain services only through explicit service functions, not through UI.

**External Integrations:**

- Auth.js/NextAuth for authentication.
- PostgreSQL through Prisma.
- No external payment, CRM, accounting, marketing, POS, or customer app integration in v1.

**Data Flow:**
`masters -> calls -> rooms -> settlements -> closing -> dashboard`, with `audit` observing sensitive changes across `masters`, `calls`, `settlements`, and `closing`.

### File Organization Patterns

**Configuration Files:**

- root config: `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`
- env sample: `.env.example`
- DB config: `prisma/schema.prisma`, `prisma/migrations`

**Source Organization:**

- route composition in `src/app`
- domain business rules in `src/modules`
- reusable UI in `src/components/domain`
- shadcn primitives in `src/components/ui`
- cross-cutting helpers in `src/lib`
- truly shared pure utilities in `src/shared`

**Test Organization:**

- domain tests co-located with services
- e2e tests under `tests/e2e`
- fixtures under `tests/fixtures`
- calculation tests must precede UI-heavy implementation

**Asset Organization:**

- static assets under `public/assets`
- generated design/planning artifacts stay under `_bmad-output` or `design-artifacts`, not app runtime folders

### Development Workflow Integration

**Development Server Structure:**

- `pnpm dev` runs Next.js.
- `src/app/(erp)` is the authenticated ERP shell.
- `src/app/(auth)` is authentication UI.
- TV route is a fullscreen app route, not a separate app.

**Build Process Structure:**

- `pnpm build` runs Next.js production build.
- Prisma generate and migrations are handled in setup/CI, not by UI routes.
- Typecheck/lint/test run before build in CI.

**Deployment Structure:**

- Node runtime deployment only.
- `prisma migrate deploy` runs in release/CI.
- `.env` values are supplied by deployment environment.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
기술 선택은 서로 호환된다. Next.js App Router, TypeScript, Tailwind CSS v4, shadcn/ui, PostgreSQL, Prisma, Auth.js/NextAuth, Zod, Server Actions, Route Handlers는 단일 full-stack ERP 구조 안에서 충돌하지 않는다. Static export를 금지하고 Node runtime을 기준으로 한 점도 Server Actions, Auth.js, Prisma 사용과 일관된다.

**Pattern Consistency:**
명명 규칙, ActionResult 응답 형식, domain service boundary, Zod 검증, RBAC, audit event dot notation, URL param 기반 상태 관리가 Step 4의 결정과 잘 맞는다. `방문완료` 기준 계산, stable ID 사용, 월마감 스냅샷 불변성은 프로젝트 컨텍스트의 핵심 규칙과도 일치한다.

**Structure Alignment:**
제안된 `src/app`, `src/components`, `src/lib`, `src/modules`, `src/shared`, `prisma`, `tests` 구조는 App Router와 도메인 모듈 경계를 함께 지원한다. 기존 `src/modules` README 스캐폴드도 새 앱 구조에 자연스럽게 흡수된다.

### Requirements Coverage Validation ✅

**Feature Coverage:**
Epics/Stories는 별도 산출물이 없으므로 PRD의 FR 범주 기준으로 검증했다. FR-1~FR-37은 각각 `live`, `masters`, `calls`, `rooms`, `tv`, `settlements`, `closing`, `dashboard`, `audit`, 테스트/문서 구조에 매핑되어 있다.

**Functional Requirements Coverage:**

- 실시간 현황/객실/TV: `rooms` DTO + polling route 구조로 지원
- 마스터/정책: `masters` + effective-month policy 구조로 지원
- 콜 원장: `calls` + editable grid + row autosave로 지원
- 정산: `settlements` domain service와 co-located tests로 지원
- 월마감: `closing` + snapshots/locks/reopen audit로 지원
- 권한/감사: `auth`, `authorization`, `audit` 경계로 지원
- 이관/검증: docs/modules, fixtures, domain calculation tests로 지원

**Non-Functional Requirements Coverage:**
정확성은 도메인 테스트와 스냅샷 설계로 다뤘다. 보안은 Auth.js/NextAuth, RBAC, server-side authorization, password hashing, env secret rule로 다뤘다. 감사성과 불변성은 audit module과 monthly close snapshot으로 다뤘다. 성능/실시간성은 daily query, polling, stale-state 표시, DB/index-first 전략으로 다뤘다. UX/접근성은 shadcn/Dialog, status label+glyph, D-course ARIA error, reduced-motion/pulse constraints로 다뤘다.

### Implementation Readiness Validation ✅

**Decision Completeness:**
핵심 결정은 모두 문서화되었다: starter, DB/ORM, validation, auth/security, API/communication, frontend, deployment. 주요 버전도 2026-06-07 기준으로 확인되어 있다.

**Structure Completeness:**
구현 목표 트리가 충분히 구체적이며, route/page/action/service/test 위치가 정의되어 있다. 구현 에이전트가 어디에 무엇을 둘지 판단할 수 있다.

**Pattern Completeness:**
AI 에이전트 충돌 가능성이 높은 명명, 응답 형식, 상태 관리, 감사 이벤트, 오류/로딩 처리, 테스트 위치, shared 사용 규칙이 정의되어 있다.

### Gap Analysis Results

**Critical Gaps:**
없음. 현재 아키텍처는 PRD/UX 기준 구현을 시작할 수 있다.

**Important Gaps:**

- 패키지 매니저는 `pnpm`으로 결정했지만 실제 `package.json`과 lockfile은 아직 생성되지 않았다.
- test runner는 도메인 테스트 우선 원칙만 정했고, Vitest/Playwright 같은 구체 도구는 구현 스토리에서 확정해야 한다.
- Auth.js v5가 구현 시점에도 beta이면 stable v4 fallback 결정을 적용해야 한다.
- hosting provider, DB hosting, backup retention, migration approval flow는 프로젝트 표준 확인이 필요하다.
- TV/room refresh는 polling으로 시작하되, 운영 피드백 후 SSE/WebSocket 전환 가능성을 남겼다.

**Nice-to-Have Gaps:**

- dashboard chart library는 대시보드 구현 시 확정한다.
- external APM/log aggregation은 배포 표준 또는 운영 필요가 생기면 추가한다.
- source Excel migration range/period는 데이터 이관 스토리에서 확정한다.

### Validation Issues Addressed

검증 중 발견한 주요 위험은 “구현 전 결정되지 않은 세부 도구를 아키텍처에서 과도하게 확정하는 것”이었다. 이를 피하기 위해 test runner, chart library, external cache, realtime transport, APM은 구현/운영 근거가 생길 때 확정하도록 watch/deferred decision으로 남겼다.

### Architecture Completeness Checklist

**Requirements Analysis**

- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**

- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**

- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**

- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS

**Confidence Level:** high

**Key Strengths:**

- Excel 기능 보존과 도메인 계산 정확성을 architecture 중심에 둔다.
- 월마감 스냅샷 불변성과 감사 로그가 초기에 설계되어 있다.
- UI가 화려한 대시보드보다 콜 원장 입력 속도와 운영 현황 가독성을 우선한다.
- Server Actions, domain services, Zod, RBAC, audit 경계가 일관적이다.
- 구현 에이전트용 명명/구조/응답/오류 패턴이 구체적이다.

**Areas for Future Enhancement:**

- 구현 착수 시 test runner와 e2e framework 확정
- 운영 환경 확정 후 backup/restore, migration approval, monitoring 세부화
- TV/room polling 성능 측정 후 SSE/WebSocket 필요성 판단
- 대시보드 구현 중 chart library 확정

### Implementation Handoff

**AI Agent Guidelines:**

- Follow all architectural decisions exactly as documented.
- Use implementation patterns consistently across all components.
- Respect project structure and module boundaries.
- Keep calculation logic in domain services, not UI.
- Use stable IDs and preserve Korean source status terms.
- Add domain tests before implementing payout-affecting UI.

**First Implementation Priority:**
Initialize and merge the official Next.js App Router starter while preserving existing docs and `src/modules` scaffolding, then add shadcn/ui, Prisma, Auth.js/NextAuth, Zod, and domain test tooling.
