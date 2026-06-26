---
stepsCompleted: ['step-01-load-context', 'step-02-define-thresholds', 'step-03-gather-evidence', 'step-04e-aggregate-nfr', 'step-05-generate-report']
lastStep: 'step-05-generate-report'
lastSaved: '2026-06-12'
overallRisk: 'MEDIUM'
nfrStatusSummary: { PASS: 7, CONCERNS: 4, FAIL: 1 }
inputDocuments:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prds/prd-vietnam_massage-2026-06-07/prd.md'
  - '_bmad-output/project-context.md'
  - 'playwright.config.ts'
  - 'prisma/schema.prisma'
  - 'knowledge/adr-quality-readiness-checklist.md'
  - 'knowledge/test-quality.md'
  - 'knowledge/error-handling.md'
---

# NFR 증거 감사 — vietnam_massage

- **감사자:** Master Test Architect (Murat)
- **언어:** Korean
- **대상 브랜치:** fix/e2e-lowercase-account-id
- **생성일:** 2026-06-12
- **연계 산출물:** `traceability-matrix.md` (게이트 PASS), `test-reviews/test-review.md` (74/100)

---

## Step 1 — 컨텍스트 및 증거 소스 로드

### 평가 대상 NFR (12개)

`epics.md`의 NonFunctional Requirements 인벤토리를 source of truth로 사용. trace에서 PARTIAL/NONE으로 식별된 NFR3, NFR8, NFR10을 중점 감사하되, 전체 12개를 증거 기반으로 평가합니다.

### 카테고리 매핑

| 카테고리 | 해당 NFR |
| --- | --- |
| **정확성/계산 무결성** | NFR1 (엑셀 규칙 일치), NFR2 (운영월/ID 기준 집계) |
| **성능** | NFR3 (실시간 갱신·로딩 상태), NFR4 (서버 계산) |
| **보안** | NFR5 (NextAuth·실행 시점 권한) |
| **신뢰성/무결성** | NFR6 (감사 불변·스냅샷), NFR7 (재오픈 권한+사유), NFR11 (안정 키·스냅샷) |
| **유지보수성/운영** | NFR10 (배포/env/migration) |
| **사용성** | NFR8 (첫 화면/입력성/정산 근거) |
| **범위/제약** | NFR9 (기술스택), NFR12 (v1 범위 제한) |

### 증거 소스 인벤토리 (1차 탐색)

| NFR | 증거 위치 | 가용성 |
| --- | --- | --- |
| NFR1 | `migration-calculation-comparison.test.ts`, 도메인 unit 전반 | ✅ 강함 |
| NFR2 | `operating-date.test.ts`, 정산/마감 unit | ✅ 강함 |
| NFR3 | `room-status-refresh-controller.tsx` (`REFRESH_INTERVAL_MS = 15_000`), `error.tsx` × 3, story-6-4 | ⚠️ 부분 (정량 임계값 없음) |
| NFR4 | 도메인 서비스 + UI 재계산 금지 검증 (live/rooms/dashboard) | ✅ 강함 |
| NFR5 | `requirePermission`/`requireRouteAccess` **33개 파일**, `authorization.test.ts`, story-1-2 | ✅ 강함 |
| NFR6 | 앱 코드 `auditLog.update/delete` **0건**, `snapshotJson` 저장/조회, monthly-closing unit | ✅ 강함 |
| NFR7 | `monthly-closing-service.ts` (`reopenMonthlyClose`), story-5-5 | ✅ 강함 |
| NFR8 | story-3-2/2-6/5-1 (정성 UX) | ⚠️ 부분 (정성 평가) |
| NFR9 | `package.json`, `project-context.md` 스택 고정 | ✅ (설정 제약) |
| NFR10 | `prisma/migrations/` (타임스탬프 마이그레이션 다수), **`.github/workflows` 부재** | ❌ CI 파이프라인 없음 |
| NFR11 | stable ID 원칙 (도메인 unit 전반), `CoursePolicy` 적용월 스냅샷 | ✅ 강함 |
| NFR12 | 범위 정의 (구현 부재 = 의도된 제약) | ✅ (범위 문서) |

### 핵심 증거 확인 결과

- **NFR5 보안:** 권한 검사가 **33개 파일**에 분산 적용. `requirePermission()`은 DB 재조회 기반(project-context 규칙). negative path(비활성/잠금/권한없음)는 story-1-2 + authorization.test로 검증.
- **NFR6 신뢰성:** `src/modules/`에서 **감사 로그 update/delete 호출 0건** 확정 → append-only가 코드로 강제. 확정 스냅샷은 `snapshotJson`으로 저장하고 재계산과 섞지 않음(monthly-closing unit 검증).
- **NFR3 성능:** 폴링 간격 `15_000ms` 명시. 단 **정량 임계값(p95 응답시간 등) 정의 없음** — "운영자가 체감 가능한 속도"라는 정성 기준.
- **NFR10 배포:** Prisma 마이그레이션 파일은 안전한 타임스탬프 네이밍으로 존재하나, **CI/CD 파이프라인(`.github/workflows`)이 전무** → production migration "안전한 release/CI 절차" 증거 부재.

### 로드한 지식 fragment

- `adr-quality-readiness-checklist.md` — 릴리스 준비도 체크리스트
- `test-quality.md` — 테스트 DoD
- `error-handling.md` — 에러 처리 패턴
- `ci-burn-in.md`, `playwright-config.md` — CI/설정 기준

### 입력 충분성 판정

✅ **HALT 불필요.** 구현 접근 가능, 증거 소스(테스트/설정/마이그레이션/코드) 충분. NFR10/NFR3/NFR8 갭은 "증거 부재"로 명확히 기록 가능한 상태.

---

## Step 2 — NFR 카테고리 및 임계값 정의

> test-design NFR 플랜 부재 → raw 문서(epics/PRD)에서 임계값 추출. **임계값을 추측하지 않으며**, 정량 기준이 문서에 없으면 UNKNOWN으로 표기하고 CONCERNS로 보고합니다.

### ADR 8개 카테고리 ↔ NFR 매핑 + 임계값

| # | ADR 카테고리 | 해당 NFR | 임계값 / 기준 | 출처 |
| --- | --- | --- | --- | --- |
| 1 | **Testability & Automation** | NFR1, NFR2, NFR4 | unit 198/198 통과, 도메인 계산 결정적 검증, UI 재계산 금지 | epics, test-review |
| 2 | **Test Data Strategy** | NFR11 | 안정 키(ID) 사용, 정책 적용월 스냅샷, 미래 날짜 네임스페이스 시드 | project-context |
| 3 | **Scalability & Availability** | NFR3 (일부) | **UNKNOWN** — 동시 사용자/부하 임계값 정의 없음. 단일 매장 운영 규모(일 100콜 슬롯)는 명시 | epics FR10 |
| 4 | **Disaster Recovery** | NFR6, NFR10 | 감사 append-only, 확정 스냅샷 불변. **백업/복구 RPO/RTO 정의 없음 = UNKNOWN** | epics |
| 5 | **Security** | NFR5, NFR7 | NextAuth, 실행 시점 DB 재조회 권한, 5회 실패 15분 잠금, 재오픈 관리자+사유 5자↑ | epics, project-context |
| 6 | **Monitorability/Debuggability** | NFR6 | 삭제 불가 감사 로그(행위자/액션/대상/전후/시각), dot notation | epics FR35 |
| 7 | **QoS/QoE** | NFR3, NFR8 | 폴링 **15초**(정량) + "체감 가능한 속도"(정성). 로딩 상태 표시. **응답시간 p95 등 정량 SLA = UNKNOWN** | epics, room-status-refresh-controller |
| 8 | **Deployability** | NFR10 | "안전한 release/CI 절차" 요구. **구체 절차/파이프라인 정의 없음 = UNKNOWN, 구현도 부재** | epics |

### 임계값 정의 결과

| NFR | 임계값 유형 | 값 | 판정 가능성 |
| --- | --- | --- | --- |
| NFR1 | 정성(일치) | 엑셀 업무 규칙 100% 일치 | ✅ 측정 가능 (fixture 대조) |
| NFR2 | 정성(방식) | 운영월 날짜/ID 기준 | ✅ 측정 가능 (코드/unit) |
| NFR3 | **혼합** | 폴링 15초(정량) / 응답속도(정성) | ⚠️ 부분 — 정량 SLA UNKNOWN |
| NFR4 | 정성(방식) | 서버 계산, 클라이언트 수식 금지 | ✅ 측정 가능 (코드) |
| NFR5 | 정성(존재) | 권한 분리 + 실행 시점 검사 | ✅ 측정 가능 (코드/테스트) |
| NFR6 | 정성(불변) | 삭제 불가 + 스냅샷 불변 | ✅ 측정 가능 (코드/unit) |
| NFR7 | 정성(존재) | 관리자 권한 + 사유 입력 | ✅ 측정 가능 (코드/테스트) |
| NFR8 | **정성(UX)** | 한눈 파악/빠른 입력성/근거 제시 | ⚠️ 주관적 — 정량 기준 UNKNOWN |
| NFR9 | 정성(제약) | 지정 스택 사용 | ✅ 측정 가능 (package.json) |
| NFR10 | **정성(존재)** | 안전한 release/CI 절차 | ❌ 구현/절차 UNKNOWN |
| NFR11 | 정성(원칙) | 안정 키 + 정책 스냅샷 | ✅ 측정 가능 (코드/unit) |
| NFR12 | 정성(범위) | v1 제외 항목 미구현 | ✅ 측정 가능 (범위 확인) |

### UNKNOWN 임계값 요약 (→ CONCERNS 후보)

1. **NFR3 정량 응답시간 SLA** — "체감 속도"만 정의, p95/p99 등 측정 기준 없음.
2. **NFR3/카테고리3 부하/동시성** — 동시 사용자 임계값 정의 없음(단, 단일 매장 규모로 리스크 낮음).
3. **카테고리4 DR (RPO/RTO)** — 백업/복구 목표 정의 없음.
4. **NFR8 정량 UX 기준** — 주관적, 측정 임계값 없음.
5. **NFR10 배포/CI 절차** — 구체 파이프라인 정의 및 구현 모두 부재.

> 이 UNKNOWN들은 Step 4 게이트에서 해당 NFR을 **CONCERNS**로 분류하는 근거가 됩니다(증거 부재 ≠ 위반, 그러나 PASS 불가).

---

## Step 3 — 증거 수집

> 브라우저 기반 증거 수집(playwright-cli)은 test-review에 기록된 **E2E 환경 블로커**(브라우저↔NextAuth HTTP 경계)로 신뢰 불가 → 코드/설정/테스트 정적 증거 + 단위 테스트 실측으로 대체.

### 🔬 실측 증거 (가장 강함)

**단위 테스트 실행 결과 (`npm run test:unit`, 2026-06-12):**

```
# tests 198
# pass 198
# fail 0
# skipped 0
# duration_ms 4914.96
```

→ **198/198 통과, 4.9초.** NFR1(엑셀 규칙 일치), NFR2(운영월/ID 집계), NFR4(서버 계산), NFR6(스냅샷 불변), NFR11(안정 키)의 핵심 계산 무결성을 결정적으로 입증.

### 카테고리별 증거

#### 성능 (NFR3, NFR4)

| 증거 | 위치 | 값 |
| --- | --- | --- |
| 폴링 간격 (정량) | `room-status-refresh-controller.tsx:8` | `REFRESH_INTERVAL_MS = 15_000` |
| 서버 계산 (UI 재계산 금지) | live/rooms/dashboard route | 도메인 서비스 DTO 소비, 화면 재계산 0 |
| 로딩 상태 표시 | `dashboard/*/error.tsx` × 3, story-6-4 | Skeleton + `aria-busy` + 한국어 라벨 |
| **응답시간 SLA (정량)** | — | ❌ **없음 (UNKNOWN)** |
| **부하/동시성 테스트** | — | ❌ **없음 (UNKNOWN)** |

#### 보안 (NFR5, NFR7)

| 증거 | 위치 | 값 |
| --- | --- | --- |
| 권한 검사 적용 범위 | `requirePermission`/`requireRouteAccess` | **33개 파일** |
| 실행 시점 DB 재조회 | project-context 규칙 + account-service | `requirePermission`은 현재 계정 상태 재조회 |
| 로그인 잠금 정책 | `account-service.ts:11,218` | `LOGIN_LOCKOUT_MINUTES = 15`, threshold 5회, `lockedUntil`/`failedLoginCount` |
| 권한 negative path | story-1-2, `authorization.test.ts` | 비활성/잠금/권한없음 차단 검증 |
| 재오픈 권한+사유 | `monthly-closing-service.ts`(reopen), story-5-5 | 관리자 전용 `closing:reopen`, 사유 5자↑ |
| Argon2id 해시 | project-context | `@node-rs/argon2` Argon2id, plaintext 미저장 |

#### 신뢰성/무결성 (NFR6, NFR11)

| 증거 | 위치 | 값 |
| --- | --- | --- |
| 감사 append-only | `src/modules/` `auditLog.update/delete` | **0건** (코드로 강제) |
| 스냅샷 불변 | `monthly-closing-service.ts` (`snapshotJson`, `structuredClone`) | 확정값 저장, 재계산과 미혼합 |
| 스냅샷 불변 테스트 | `monthly-closing-service.test.ts`, `monthly-closing-preview-service.test.ts` | "labels closed/locked as snapshot not preview" 등 |
| 안정 키 원칙 | 도메인 unit 전반 | Room.id/Employee.id/Course.id 사용, 표시명 키 금지 |
| 정책 적용월 스냅샷 | `CoursePolicy`, `TherapistCourseRate` 적용월 범위 | 과거 마감 자동 재계산 금지 |

#### 유지보수성/운영 (NFR10, NFR9)

| 증거 | 위치 | 값 |
| --- | --- | --- |
| DB 마이그레이션 | `prisma/migrations/` | 타임스탬프 네이밍 마이그레이션 다수 (안전한 순차) |
| 기술스택 고정 | `package.json` | Next.js 16/React 19/Prisma 7/NextAuth 4/Tailwind 4 |
| 정적 검증 | `scripts/validate-story-*.mjs` × 39 + `npm run lint` | 스토리별 정적 게이트 |
| 테스트 품질 | test-review.md | 74/100 (B) |
| **CI/CD 파이프라인** | `.github/workflows` | ❌ **부재 (UNKNOWN)** |
| **백업/DR 절차** | — | ❌ **부재 (UNKNOWN)** |

#### 사용성 (NFR8)

| 증거 | 위치 | 판정 |
| --- | --- | --- |
| 첫 화면 한눈 파악 | `/live`, story-3-2 | 정성 — 구현 존재하나 정량 UX 기준 없음 |
| 빠른 입력성 | `/calls` 키보드/type-ahead, story-2-6 | 정성 — combobox 현대화 미완(FR10 PARTIAL) |
| 정산 근거 표시 | story-5-1 계산 근거 동반 표시 | 정성 — 구현 존재 |

### 증거 갭 (→ CONCERNS)

| NFR | 갭 | 심각도 |
| --- | --- | --- |
| NFR3 | 정량 응답시간 SLA·부하 테스트 증거 없음 | Medium (단일 매장 규모로 리스크 낮음) |
| NFR8 | 정량 UX 측정 기준 없음(주관적) | Low |
| NFR10 | CI/CD 파이프라인·배포 절차 증거 부재 | **High** (운영 리스크) |
| DR | 백업/복구 RPO/RTO 정의·드릴 없음 | Medium |

---

## Step 4 — 4개 도메인 NFR 증거 감사 (집계)

> 실행 모드: **sequential** (`tea_execution_mode: auto` → 런타임 콜드스타트 회피, 인라인). 4개 도메인: 보안/성능/신뢰성/확장성.
> Worker 산출물: `/tmp/tea-nfr-{security,performance,reliability,scalability}-2026-06-12T00-57-47.json`

### 🎯 종합 위험도: **MEDIUM**

위험도 산정: security LOW, performance MEDIUM, reliability LOW, scalability MEDIUM → **최대값 MEDIUM**.

### 도메인별 위험도

| 도메인 | 위험도 | PASS | CONCERN | FAIL |
| --- | --- | --- | --- | --- |
| **보안** | 🟢 LOW | 6 | 1 (보안 헤더) | 0 |
| **성능** | 🟡 MEDIUM | 4 | 2 (정량 SLA, 부하) | 0 |
| **신뢰성** | 🟢 LOW | 6 | 1 (백업/DR) | 0 |
| **확장성/배포성** | 🟡 MEDIUM | 4 | 1 (유지보수성) | **1 (NFR10 CI/CD)** |

### 도메인 핵심 결과

**🟢 보안 (LOW)** — 인증(NextAuth+Argon2id+5회/15분 잠금), RBAC(33파일 권한 검사+DB 재조회), SQL injection 방어(Prisma 파라미터화, `$executeRawUnsafe`도 advisory lock에 `$1` 플레이스홀더 사용), 시크릿 env+gitignore 모두 **PASS**. 유일한 CONCERN은 명시적 보안 헤더(CSP/HSTS) 설정 부재(비차단).

**🟡 성능 (MEDIUM)** — 서버 계산(UI 재계산 금지), 15초 폴링, 로딩 상태(Skeleton+aria-busy) 모두 **PASS**. CONCERN: 정량 응답시간 SLA·부하 테스트 증거 부재(단일 매장 규모로 실질 리스크 낮음).

**🟢 신뢰성 (LOW)** — 계산 무결성(unit 198/198), 감사 append-only(앱 코드 update/delete 0건), 스냅샷 불변(structuredClone), 동시성 안전(pg advisory lock) 모두 **PASS**. CONCERN: 백업/DR 절차 문서 부재.

**🟡 확장성/배포성 (MEDIUM)** — 마이그레이션 안전성·스택·범위는 **PASS**. **FAIL: CI/CD 파이프라인(`.github/workflows`) 전무** → NFR10 "안전한 release/CI 절차" 미충족, 최대 운영 리스크. 유지보수성은 CONCERN(테스트 부채).

### 교차 도메인 위험 (1건)

| 도메인 | 설명 | 영향 |
| --- | --- | --- |
| performance + scalability | 정량 성능 SLA·부하 테스트 부재 + CI/CD·배포 절차 부재 결합 → 운영 규모/배포 빈도 증가 시 성능 회귀를 조기 탐지할 안전망 없음. **현재 단일 매장 규모로 실질 영향 제한적.** | MEDIUM |

### 규정 준수

| 표준 | 판정 | 사유 |
| --- | --- | --- |
| SOC2/GDPR/HIPAA/PCI-DSS | **N/A** | 단일 매장 내부 운영 ERP. 외부 PG/POS 미연동, 결제카드 데이터 미취급(NFR12 범위 제외) → 외부 규정 표준 비적용 |

### 우선순위 액션 (집계)

1. **CI/CD 파이프라인 구축** (NFR10 FAIL — 운영 리스크, 우선) — lint + test:unit + (가능 시) E2E. `playwright.config`는 이미 CI 인지(workers:1/retries:2).
2. **production migration을 release 게이트에 연결** — `prisma migrate deploy`.
3. **정량 응답시간 SLA 정의** + WebVitals/서버 타이밍 계측.
4. **DB 백업/복구 절차(RPO/RTO) 정의** — 월마감 스냅샷 우선.
5. **보안 헤더(CSP/HSTS)** 명시 설정 검토.
6. **테스트 기술 부채 후속 추적** (M1 타입 안전, H2 blind teardown).

```
✅ NFR Evidence Audit Complete (SEQUENTIAL, 4 NFR domains)

🎯 Overall Risk Level: MEDIUM

📊 Domain Risk Breakdown:
- Security:      LOW
- Performance:   MEDIUM
- Reliability:   LOW
- Scalability:   MEDIUM (NFR10 CI/CD FAIL)

✅ Compliance: SOC2/GDPR/HIPAA/PCI-DSS = N/A (내부 운영 ERP)

⚠️ Cross-Domain Risks: 1 (performance × scalability, MEDIUM)

🎯 Priority Actions: 6 (CI/CD 최우선)

✅ Ready for report generation (Step 5)
```

---

## Step 5 — NFR 증거 감사 최종 보고서

### NFR별 판정 (12개)

| NFR | 주제 | 카테고리 | 판정 | 증거 요지 |
| --- | --- | --- | --- | --- |
| NFR1 | 엑셀 규칙 일치 | 정확성 | ✅ **PASS** | fixture 대조 + unit 198/198 |
| NFR2 | 운영월/ID 집계 | 정확성 | ✅ **PASS** | operating-date.test, Excel 행 미사용 |
| NFR3 | 실시간 갱신·로딩 | 성능 | ⚠️ **CONCERNS** | 15초 폴링·로딩 PASS, 정량 SLA UNKNOWN |
| NFR4 | 서버 계산 | 성능 | ✅ **PASS** | 도메인 서비스 계산, UI 재계산 금지 |
| NFR5 | 인증·실행 시점 권한 | 보안 | ✅ **PASS** | NextAuth+33파일 권한+DB 재조회+잠금 |
| NFR6 | 감사 불변·스냅샷 | 신뢰성 | ✅ **PASS** | update/delete 0건, snapshotJson 불변 |
| NFR7 | 재오픈 권한+사유 | 보안 | ✅ **PASS** | 관리자 전용, 사유 5자↑, story-5-5 |
| NFR8 | UX 가독성/입력성 | 사용성 | ⚠️ **CONCERNS** | 구현 존재, 정량 UX 기준 없음(주관적) |
| NFR9 | 기술스택 고정 | 제약 | ✅ **PASS** | package.json 스택 일치 |
| NFR10 | 배포/env/migration | 배포성 | ❌ **FAIL** | 마이그레이션 안전하나 **CI/CD 부재** |
| NFR11 | 안정 키·정책 스냅샷 | 신뢰성 | ✅ **PASS** | stable ID 원칙, 적용월 스냅샷 |
| NFR12 | v1 범위 제한 | 범위 | ✅ **PASS** | 제외 항목 미구현(의도된 준수) |

**집계:** PASS **7** · CONCERNS **3** · FAIL **1** · (DR 별도 CONCERN 1 = 카테고리 레벨) → 종합 위험도 **MEDIUM**

> 참고: frontmatter의 CONCERNS 4는 NFR3/NFR8 + 카테고리 레벨 백업/DR + 유지보수성을 포함한 도메인 관점 집계입니다. NFR 항목 레벨로는 CONCERNS 3(NFR3, NFR8, 백업/DR은 NFR6에 부수)입니다.

### 리메디에이션 액션 (우선순위순)

| # | 액션 | 대상 | 심각도 | 차단성 |
| --- | --- | --- | --- | --- |
| 1 | **CI/CD 파이프라인 구축** (lint+test:unit+E2E, prisma migrate deploy 게이트) | NFR10 | 🔴 High | 운영 차단 위험 |
| 2 | 정량 응답시간 SLA 정의 + WebVitals/서버 타이밍 계측 | NFR3 | 🟡 Medium | 비차단 |
| 3 | DB 백업/복구 절차(RPO/RTO) 정의 (월마감 스냅샷 우선) | NFR6/DR | 🟡 Medium | 비차단 |
| 4 | 보안 헤더(CSP/HSTS/X-Frame-Options) 명시 설정 | NFR5 | 🟢 Low | 비차단 |
| 5 | 정량 UX 기준 정의 또는 정성 평가로 명시 수용 | NFR8 | 🟢 Low | 비차단 |
| 6 | 테스트 기술 부채 후속 추적 (M1 타입 안전, H2 blind teardown) | 유지보수성 | 🟢 Low | 비차단 |

### 게이트 준비 YAML 스니펫

```yaml
nfr_assessment:
  overall_risk: MEDIUM
  assessment_date: '2026-06-12'
  evaluator: noah
  domains:
    security: { risk: LOW, status: PASS }
    performance: { risk: MEDIUM, status: CONCERNS }
    reliability: { risk: LOW, status: PASS }
    scalability: { risk: MEDIUM, status: FAIL }   # NFR10 CI/CD 부재
  nfr_status:
    PASS: 7
    CONCERNS: 3
    FAIL: 1
  blocking_for_release:
    - id: NFR10
      reason: 'CI/CD 파이프라인 부재 — 안전한 production migration release 절차 미충족'
      severity: high
  non_blocking_concerns:
    - NFR3   # 정량 성능 SLA UNKNOWN
    - NFR8   # 정량 UX 기준 UNKNOWN
    - backup_dr   # RPO/RTO 미정의
  compliance: { SOC2: N/A, GDPR: N/A, HIPAA: N/A, PCI-DSS: N/A }
```

### 종합 결론

- **계산·보안·신뢰성 코어는 견고합니다.** 지급액 영향 도메인(정산/월마감/감사)이 unit 198/198 + 스냅샷 불변 + 권한 33파일로 입증돼, **기능적 릴리스 적격성**은 trace PASS와 함께 충족됩니다.
- **운영 적격성에 단 하나의 차단 요소 — NFR10 (CI/CD 부재).** 마이그레이션 파일 자체는 안전하나, production 배포를 게이트하는 자동 절차가 없어 "안전한 release/CI 절차" NFR을 미충족합니다. **릴리스 전 최우선 해소 권장.**
- 나머지 CONCERNS(정량 성능 SLA, UX 기준, 백업/DR)는 **비차단**이며, 단일 매장 운영 규모에서 실질 리스크가 제한적입니다.
