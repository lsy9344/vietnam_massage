---
stepsCompleted: ['step-01-preflight', 'step-02-generate-pipeline', 'step-03-configure-quality-gates', 'step-04-validate-and-summary']
lastStep: 'step-04-validate-and-summary'
lastSaved: '2026-06-12'
status: 'complete'
pipelineFile: '.github/workflows/test.yml'
ciPlatform: 'github-actions'
testStackType: 'fullstack'
packageManager: 'pnpm@10.12.1'
e2eStrategy: 'separate-job-non-blocking'
---

# CI/CD 파이프라인 설정 — vietnam_massage

- **설정자:** Master Test Architect (Murat)
- **언어:** Korean
- **대상 브랜치:** fix/e2e-lowercase-account-id
- **생성일:** 2026-06-12
- **동기:** NFR 감사의 **NFR10 FAIL (CI/CD 파이프라인 부재)** 해소

---

## Step 1 — 사전 점검 (Preflight)

### 1. Git 저장소 ✅

- `.git/` 존재
- 원격: `https://github.com/lsy9344/vietnam_massage.git` (origin)

### 2. 테스트 스택 ✅

- **분류:** `fullstack` (Next.js 16 App Router + Prisma 7 + PostgreSQL)
- Frontend: `next.config.ts`, `playwright.config.ts`, `src/app/`
- Backend: `prisma.config.ts`, 도메인 서비스 `src/modules/`

### 3. 테스트 프레임워크 ✅

| 레벨 | 러너 | 스크립트 | DB 필요 |
| --- | --- | --- | --- |
| Unit | `node:test` + `tsx` | `npm run test:unit` | ❌ (Prisma generate만, in-memory 목) |
| E2E | `@playwright/test@1.60.0` | `npm run test:e2e` | ✅ PostgreSQL |
| Static | 커스텀 validator × 39 | `npm run lint` | ❌ |
| Build | `next build` | `npm run build` | ❌ (`prebuild`로 prisma generate) |

### 4. 로컬 테스트 통과 ✅

- **단위 테스트 198/198 통과** (NFR 감사에서 실측, 4.9초) → HALT 불필요.
- `tsc --noEmit` exit 0 (test-review 기록).

### 5. CI 플랫폼 ✅

- 기존 CI 설정 파일 **없음** (`.github/workflows` 부재 = NFR10 FAIL 원인).
- git 원격이 github.com → **`github-actions`** 채택.

### 6. 환경 컨텍스트

| 항목 | 값 |
| --- | --- |
| 패키지 매니저 | **pnpm@10.12.1** (`package.json` packageManager) |
| Node 버전 | local v22.16.0 (`.nvmrc` 없음 → CI는 Node 22 LTS 고정) |
| Prisma | 7 + `@prisma/adapter-pg`, `prisma generate`는 `predev`/`prebuild`/`pretest:*`에 연결 |
| E2E DB URL | `postgresql://postgres:postgres@localhost:5432/vietnam_massage` (support/db.ts 폴백) |

### 7. E2E 전략 결정 (사용자)

**별도 job, 비차단** 선택:

- **quality job (차단 게이트):** lint + test:unit(198/198) + build — 모두 DB-free, 빠르고 결정적.
- **e2e job (비차단, `continue-on-error`):** Postgres service container + `prisma migrate deploy` + seed + `playwright test`.
  - test-review에 기록된 **브라우저↔NextAuth 환경 블로커**가 머지를 막지 않도록 비차단.
  - 신호는 수집(아티팩트 업로드)하여 안정화 추적. 안정화 후 차단으로 전환.

### 사전 점검 종합

✅ **모든 전제 충족, HALT 없음.** github-actions 파이프라인을 quality(차단) + e2e(비차단) 2-job 구조로 생성합니다. NFR10의 "안전한 release/CI 절차"를 위해 `prisma migrate deploy` 게이트와 build 검증을 포함합니다.

---

## Step 2 — 파이프라인 생성

> 실행 모드: **sequential** (인라인). 출력: `.github/workflows/test.yml` (github-actions).

### 생성된 파이프라인 구조

| Job | 게이트 | 스테이지 | DB |
| --- | --- | --- | --- |
| **quality** | 🔴 BLOCKING | install → prisma generate → lint(39 validator) → `tsc --noEmit` → test:unit(198) → build | ❌ (build는 dummy URL) |
| **e2e** | 🟡 non-blocking | install → generate → **migrate deploy** → drift guard → seed → browser → playwright → artifact | ✅ Postgres 16 service |
| **report** | — | always() 실행, GITHUB_STEP_SUMMARY에 결과 집계 | — |

### 트리거

- `push` → main
- `pull_request` → main
- `concurrency` 그룹으로 ref별 진행 중 run 취소(cancel-in-progress)

### 프로젝트 적응 사항 (템플릿 대비)

| 항목 | 템플릿 기본 | 적응 |
| --- | --- | --- |
| 패키지 매니저 | npm ci | **pnpm@10.12.1** + `pnpm/action-setup@v4` + `cache: pnpm` |
| E2E 샤딩 | 4-shard matrix | **제거** — 공유 DB + serial 모드라 샤딩 부적합(test-review) → 단일 job |
| DB | 없음 | **Postgres 16 service container** + health check |
| 마이그레이션 | 없음 | `prisma migrate deploy` (clean DB → **P3005 미발생**) + drift guard |
| seed | 없음 | `tsx scripts/seed-dev-accounts.ts` |
| burn-in | 별도 job | **제외** — E2E 환경 블로커 미해소 상태라 burn-in 무의미. 안정화 후 추가 |
| build | 없음 | **추가** — NFR10 "안전한 release 절차" |

### 함정 회피 (메모리 `[[e2e-environment]]` 기반)

1. **NEXTAUTH_URL 호스트 일치 (CRITICAL):** `NEXTAUTH_URL: http://127.0.0.1:3000`으로 Playwright baseURL과 일치 → RSC fetch 실패 회피.
2. **P3005:** CI는 빈 Postgres에 처음부터 migrate deploy → P3005(기존 스키마 baseline 부재) **미발생**. `migrate deploy`가 올바른 선택.
3. **schema drift guard:** `prisma migrate diff --exit-code`로 schema.prisma와 커밋된 마이그레이션 불일치를 조기 탐지(비차단 warning).
4. **E2E 비차단:** 브라우저 로그인 race는 수정됐으나 잔여 개별 실패(autosave blur, KPI 기대값)가 있어 `continue-on-error: true` 유지. 안정화 후 `false`로 전환.

### 보안 (스크립트 인젝션 방어)

- `${{ github.event.* }}`/`inputs.*` 직접 보간 **없음**. 모든 `run:` 블록은 고정 명령 + 안전 컨텍스트(`needs.*.result`, `runner.os`, `hashFiles`)만 사용.
- 시크릿 placeholder는 CI 빌드/E2E 전용 더미값(prod 무관). 실제 운영 시 `secrets.*`로 주입 권장.

### 검증

- ✅ 핵심 마커 9개 매칭(jobs/quality/e2e/report, continue-on-error, postgres:16, migrate deploy, seed).
- ✅ 탭 들여쓰기 없음(스페이스 일관).
- ⚠️ actionlint 미설치 환경 → 정적 lint 미실행. 첫 CI run에서 실제 검증됨.

---

## Step 3 — 품질 게이트 및 알림

### Burn-in (flaky 탐지)

| 항목 | 판정 |
| --- | --- |
| 스택 | fullstack → 기본 활성 대상 |
| **현재 결정** | **보류 (제외)** |
| 사유 | E2E 환경 블로커(브라우저↔NextAuth, 잔여 개별 실패) 미해소 상태에서 burn-in 10회는 무의미. E2E가 안정적으로 그린이 된 후 추가해야 신호가 유효. |
| 후속 | E2E `continue-on-error: false` 전환 시점에 burn-in job 추가(주간 schedule cron 또는 PR 트리거) |

### 품질 게이트 정책

| 게이트 | 임계값 | 적용 | 차단성 |
| --- | --- | --- | --- |
| **lint (정적 validator)** | 39개 전부 통과 | quality job | 🔴 차단 |
| **type check** | `tsc --noEmit` exit 0 | quality job | 🔴 차단 |
| **unit 테스트** | 198/198 (100%) | quality job | 🔴 차단 |
| **build** | `next build` 성공 | quality job | 🔴 차단 |
| **E2E** | (안정화 전) 신호 수집만 | e2e job | 🟡 비차단 |

**trace 게이트와의 정합:**
- trace Phase 2 게이트: P0 100%, 전체 97% PASS.
- CI unit 게이트(198/198 = P0 계산 무결성 100%)가 trace의 P0 커버리지를 **매 PR마다 자동 재검증**.
- `test-priorities-matrix` 기준 P0=100%/P1≥95% 정책을 단위 레이어에서 강제(E2E 안정화 후 E2E로 확장).

**Contract testing 게이트:** `tea_use_pactjs_utils: false` → **N/A** (Pact 미사용, 외부 서비스 계약 없음).

### 릴리스 게이트 연계 (권장)

- 릴리스 전 `traceability-matrix.md`(PASS) + `nfr-assessment.md`(NFR10 해소 확인)를 수동 게이트로 참조.
- production migration은 `prisma migrate deploy`를 **별도 배포 워크플로우**(이 PR 범위 밖)에서 release 승인 후 실행 권장 — 본 test.yml은 CI 검증용.

### 알림

| 채널 | 현재 | 권장 |
| --- | --- | --- |
| GitHub Step Summary | ✅ report job이 quality/e2e 결과 집계 | 유지 |
| PR 체크 상태 | ✅ quality 실패 시 머지 차단(branch protection 필요) | **GitHub branch protection rule에 `quality` job required 설정** |
| Slack/email | ❌ 미설정 | 필요 시 `8398a7/action-slack` 등으로 실패 알림 추가(시크릿 `SLACK_WEBHOOK` 필요) |

> **수동 후속 설정 (코드 외):** GitHub repo Settings → Branches → `main` branch protection → "Require status checks"에 **`Quality (lint + unit + build)`** 추가해야 quality job이 실제 머지 차단 게이트로 작동합니다.

---

## Step 4 — 검증 및 완료 요약

### 체크리스트 검증

| 항목 | 결과 |
| --- | --- |
| config 파일 생성 | ✅ `.github/workflows/test.yml` (194줄) |
| 스테이지 구성 | ✅ quality(L28) / e2e(L74) / report(L167) 3-job |
| 아티팩트 | ✅ playwright-report + test-results 업로드 (retention 30일) |
| 시크릿/env 문서화 | ✅ env 7개 참조 + branch protection 수동 안내 |
| 보안(스크립트 인젝션) | ✅ 직접 보간 0, 안전 컨텍스트만 사용 |
| 들여쓰기 일관성 | ✅ 2-space, 탭 없음 |

### 완료 요약

| 항목 | 값 |
| --- | --- |
| **CI 플랫폼** | GitHub Actions |
| **파일** | `.github/workflows/test.yml` |
| **차단 게이트** | quality (lint 39 + tsc + unit 198 + build) |
| **비차단** | e2e (Postgres + migrate deploy + seed + playwright) |
| **NFR10 해소** | ✅ "안전한 release/CI 절차" 증거 생성 (FAIL → 충족) |

### 다음 단계 (사용자 액션)

1. **커밋 & 푸시** — `.github/workflows/test.yml`을 커밋해 main에 PR 시 첫 CI run 트리거. (현재 미커밋, 사용자 승인 필요)
2. **branch protection** — Settings → Branches → `main` → "Require status checks" → `Quality (lint + unit + build)` 추가.
3. **첫 run 관찰** — quality job 그린 확인. build의 dummy DATABASE_URL 통과 여부 첫 실측(force-dynamic 미지정 페이지가 빌드 시 DB 호출하면 여기서 드러남 → 필요 시 해당 page에 `export const dynamic = "force-dynamic"` 추가).
4. **E2E 안정화 후** — `continue-on-error: true` → `false` 전환 + burn-in job 추가.

### 알려진 리스크 (첫 run에서 검증될 항목)

- **build + dummy DB:** ERP 페이지에 `force-dynamic` 미지정. Next.js가 세션 의존(`requireRouteAccess`)으로 자동 동적 처리할 가능성이 높으나, 일부 페이지가 빌드 시 prerender되며 DB 연결을 시도하면 build 실패 가능 → 첫 CI run에서 확인. 실패 시 해당 page에 `force-dynamic` 추가로 해결.
- **schema drift:** drift guard가 warning으로 조기 탐지(비차단). schema.prisma가 커밋 마이그레이션보다 앞서면 알림.
- **E2E:** 환경 블로커 잔여로 비차단 유지가 의도적. quality 게이트가 실질 품질 방어선.
