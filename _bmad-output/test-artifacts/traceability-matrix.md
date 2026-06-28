---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-map-criteria', 'step-04-analyze-gaps', 'step-05-gate-decision']
lastStep: 'step-05-gate-decision'
lastSaved: '2026-06-12'
tempCoverageMatrixPath: '/tmp/tea-trace-coverage-matrix-2026-06-12T00-44-04.json'
gateDecision: 'PASS'
gateBasis: 'priority_thresholds'
coverageBasis: 'acceptance_criteria'
oracleConfidence: 'high'
oracleResolutionMode: 'formal_requirements'
oracleSources:
  - '_bmad-output/planning-artifacts/epics.md'
  - '_bmad-output/planning-artifacts/prds/prd-vietnam_aesthetic-2026-06-07/prd.md'
  - '_bmad-output/project-context.md'
externalPointerStatus: 'not_used'
---

# 커버리지 추적 매트릭스 — vietnam_aesthetic

- **리뷰어:** Master Test Architect (Murat)
- **언어:** Korean
- **대상 브랜치:** fix/e2e-lowercase-account-id
- **생성일:** 2026-06-12
- **워크플로우:** Coverage Traceability & Quality Gate (Phase 1 매핑 + Phase 2 게이트)

---

## Step 1 — 커버리지 오라클 해석

### 해석 결과

| 키 | 값 |
| --- | --- |
| `coverageBasis` | `acceptance_criteria` |
| `oracleResolutionMode` | `formal_requirements` |
| `oracleConfidence` | **high** |
| `externalPointerStatus` | `not_used` |

### 선택 근거

`epics.md`에 **명시적 요구사항 인벤토리**(FR1~FR37, NFR1~NFR12)가 존재하고, 각 FR이 Epic에 1:1로 귀속되며, Epic→Story→spec 파일이 깔끔하게 대응합니다. 형식 요구사항이 최상위 오라클(1순위)이므로 synthetic 추론 없이 **high confidence**로 채택했습니다.

### 오라클 인벤토리 규모

- **기능 요구사항(FR):** 37개 (FR1~FR37)
- **비기능 요구사항(NFR):** 12개 (NFR1~NFR12)
- **Epic:** 7개, **Story:** 38개

### Epic ↔ FR 귀속

| Epic | FR | 주제 |
| --- | --- | --- |
| Epic 1 (운영 기준·접근 통제) | FR4, FR5, FR6, FR7, FR8, FR9, FR34, FR35 | 운영월, 마스터(객실/직원/코스/코드), RBAC, 감사 로그 |
| Epic 2 (콜 원장·방문완료 계산) | FR10, FR11, FR12, FR13, FR14, FR15 | 콜 입력, 상태/이력, 결제·수당 계산, 할인, D코스, 지출 |
| Epic 3 (실시간 현황·TV) | FR1, FR2, FR16, FR17, FR18, FR19 | 첫 화면, 객실 상태, 남은분/종료확인, 안내 문구, TV |
| Epic 4 (일정산·운영팀 인센) | FR20, FR21, FR22, FR23, FR24, FR25 | 출퇴근, 마사지사/귀케어/운영팀 일정산·인센 |
| Epic 5 (월마감·잠금·재오픈) | FR26, FR27, FR28, FR29, FR30 | 월마감 미리보기, 만근/갯수왕, 확정/잠금/재오픈 |
| Epic 6 (KPI·대시보드) | FR3, FR31, FR32, FR33 | 오늘/월간 KPI, 그래프 리포트 |
| Epic 7 (엑셀 매핑·계산 대조) | FR36, FR37 | 시트 기능 매핑표, 계산 대조 검증 |

### 로드한 지식 fragment

- `test-priorities-matrix.md` — P0/P1/P2/P3 우선순위 분류 기준
- `risk-governance.md` — 게이트 결정(PASS/CONCERNS/FAIL/WAIVED) 기준
- `probability-impact.md` — 리스크 점수화
- `test-quality.md` — 테스트 DoD
- `selective-testing.md` — 레벨 선택(unit > integration > e2e)

---

## Step 2 — 테스트 발견 및 분류

### 레벨별 인벤토리

| 레벨 | 개수 | 위치 | 비고 |
| --- | --- | --- | --- |
| **E2E** | 38 spec | `tests/e2e/story-*.spec.ts` | story 파일명 1:1 매핑. 실 PostgreSQL 시딩 + 로그인 + UI 단언 |
| **Unit** | 24 test | `src/**/*.test.ts` | 도메인 서비스에 in-memory Prisma 목 의존성 주입. 결정적 |
| **Component** | 0 | — | 별도 컴포넌트 레벨 없음. UI는 E2E로 커버 |
| **API** | 0 (전용) | — | 전용 API 테스트 레이어 없음. Server Action은 도메인 서비스 unit + E2E로 커버 |
| **Static** | 39 validator | `scripts/validate-story-*.mjs` | 스토리별 정적 검증, `npm run lint` |

### 도메인 서비스 unit 테스트 매핑 (지급액 영향 핵심)

| Unit 테스트 | 도메인 | 주 검증 FR |
| --- | --- | --- |
| `service-call-service.test.ts` (1631줄) | calls | FR11, FR12, FR13, FR14 |
| `course-service.test.ts` | masters | FR7, FR8 |
| `employee-service.test.ts` | masters | FR6 |
| `room-service.test.ts` | masters | FR5 |
| `operating-month-service.test.ts` | masters | FR4 |
| `code-service.test.ts` | masters | FR9 |
| `room-status-service.test.ts` | rooms | FR16, FR17, FR2 |
| `therapist-attendance-service.test.ts` | settlements | FR20 |
| `therapist-daily-settlement-service.test.ts` | settlements | FR21 |
| `earcare-attendance-service.test.ts` | settlements | FR22 |
| `earcare-daily-settlement-service.test.ts` | settlements | FR23 |
| `ops-attendance-service.test.ts` | settlements | FR24 |
| `ops-daily-incentive-service.test.ts` | settlements | FR24 |
| `ops-monthly-incentive-service.test.ts` | settlements | FR25 |
| `monthly-closing-preview-service.test.ts` (861줄) | closing | FR26, FR27, FR28 |
| `monthly-closing-service.test.ts` | closing | FR29, FR30 |
| `month-lock-guard.test.ts` | closing | FR29 (잠금 가드) |
| `dashboard-query-service.test.ts` (837줄) | dashboard | FR3, FR31, FR32, FR33 |
| `migration-calculation-comparison.test.ts` | migration | FR37 |
| `migration-verification-report.test.ts` | migration | FR37 |
| `sheet-feature-mapping.test.ts` | migration | FR36 |
| `authorization.test.ts` | lib | FR34 (RBAC) |
| `operating-date.test.ts` | lib | NFR2 (운영월 날짜 계산) |
| `call-ledger-keyboard.test.ts` | calls UI | FR10 (키보드 입력성) |

### 커버리지 휴리스틱 인벤토리 (`coverage_heuristics`)

Phase 1에서 사각지대 탐지에 사용:

- **인증/권한 커버리지:** `story-1-2-auth-rbac.spec.ts`가 역할별 로그인/landing/sidebar 숨김/direct route 차단(negative path)을 검증. `authorization.test.ts`가 권한 매트릭스를 unit으로 검증. → 양호.
- **에러/검증 경로:** D코스 마사지사2 누락 차단(story-2-4), 운영월 범위/잠금 차단(story-2-5, 5-4), autosave 실패 retry(story-2-2), `snapshot_missing` 상태(story-6-2/6-4) 등 negative/edge path 다수 존재.
- **UI 상태 커버리지:** loading/error/empty 상태가 story-6-4에 명시적으로 다뤄짐. 객실 상태 색상/글리프 접근성은 story-3-5.
- **지급액 회귀 가드:** 확정 스냅샷 불변성(FR29/NFR6), 정상근무자 0명 처리(FR23), 만근/갯수왕 경계(FR27/FR28)가 unit으로 결정적 검증.

### 사각지대 1차 신호 (Phase 1에서 정밀 평가)

- **NFR 커버리지:** NFR은 FR과 달리 spec 1:1 매핑이 없음 → 횡단 관심사. Phase 1에서 NFR별 증거 위치를 별도 추적 필요(특히 NFR3 성능, NFR6 스냅샷 불변성, NFR10 배포/migration).
- **Story 2.6(키보드/type-ahead) ↔ FR10:** combobox 현대화 미완으로 일부 E2E가 옛 `<select>` 동작 의존(test-review M5). 기능 커버리지는 있으나 실행 그린은 별도 이슈.
- **FR37(계산 대조):** Story 7.2 fixture 기반 unit 검증은 강하나, E2E 레벨 대조는 read-only 조회뿐.

---

## Step 3 — 요구사항 ↔ 테스트 추적 매트릭스 (Phase 1)

### 커버리지 상태 범례

- **FULL** — E2E + unit(또는 적절한 레벨 조합)로 핵심 경로 + 주요 실패/대안 상태 검증
- **PARTIAL** — 일부 경로만 검증, 일부 상태/엣지 누락
- **UNIT-ONLY** — 도메인 unit은 충실하나 E2E 경로 미검증
- **NONE** — 직접 테스트 없음
- **P0** 지급액/인증/파괴적 변경 · **P1** 주요 사용자 경로 · **P2** 보조 워크플로우 · **P3** polish

### 기능 요구사항 (FR1~FR37)

| FR | 주제 | 우선순위 | E2E spec | Unit | 상태 | 비고 |
| --- | --- | --- | --- | --- | --- | --- |
| FR1 | 첫 화면 실시간 현황·오늘 요약 | P1 | story-3-2 | room-status, dashboard-query | **FULL** | KPI 재계산 금지 검증 포함 |
| FR2 | 객실 카드 상태 토큰·종료확인 | P1 | story-3-1, 3-5 | room-status | **FULL** | 색상+글리프+텍스트 접근성 |
| FR3 | 주인용 그래프 시각화 | P2 | story-6-3 | dashboard-query | **FULL** | 차트 fallback/접근성 검증 |
| FR4 | 운영월 생성·상태 관리 | P1 | story-1-4 | operating-month | **FULL** | 작성중→검토중 전이 |
| FR5 | 객실 마스터·ID/표시명 분리 | P1 | story-1-5 | room-service | **FULL** | sortOrder 중복 차단 |
| FR6 | 직원 마스터·비활성 | P1 | story-1-7 | employee-service | **FULL** | 계정 연결 1:1 |
| FR7 | 코스 마스터·D코스 설정 | P1 | story-1-8 | course-service | **FULL** | requiresSecondTherapist |
| FR8 | 수당/인센 정책·적용월 이력 | **P0** | story-1-8 | course-service, ops-*-incentive | **FULL** | 정책 범위 겹침 차단 |
| FR9 | 코드·시간 슬롯 관리 | P2 | story-1-6 | code-service | **FULL** | 29개 슬롯, 자정 넘김 정렬 |
| FR10 | 콜 원장 핵심 입력 | P1 | story-2-1, 2-6 | call-ledger-keyboard | **PARTIAL** | combobox 현대화 미완(M5) → 일부 E2E 옛 select 의존 |
| FR11 | 콜 상태 변경·이력·감사 | **P0** | story-2-2 | service-call-service | **FULL** | 방문완료 외 계산 제외 |
| FR12 | 방문완료 기준 계산 | **P0** | story-2-3 | service-call-service | **FULL** | 비완료 0 처리, 정책 없음 상태 |
| FR13 | 고정 100,000 할인 | **P0** | story-2-3 | service-call-service | **FULL** | 빈 할인 0, 선택 시 고정 |
| FR14 | D코스 마사지사2 필수 | **P0** | story-2-4 | service-call-service | **FULL** | 저장/완료 차단, ARIA, 무부작용 |
| FR15 | 일별 지출·요약 | P1 | story-2-5 | service-call-service | **FULL** | netSales, active 지출만 |
| FR16 | 객실 최신 활성 콜 상태 | P1 | story-3-1 | room-status | **FULL** | 방문완료/노쇼/취소 제외 |
| FR17 | 남은분·종료예정·종료확인 | P1 | story-3-1 | room-status | **FULL** | 자정 넘김, 음수 클램프 |
| FR18 | 상태별 안내 문구 | P2 | story-3-3 | room-status (ROOM_STATUS_GUIDANCE_TEXT) | **FULL** | TV 핵심 문구 |
| FR19 | 조회 전용 TV 현황판 | P2 | story-3-4 | room-status | **FULL** | fullscreen, 자동 갱신 |
| FR20 | 마사지사 출퇴근·만근 기초 | **P0** | story-4-1 | therapist-attendance | **FULL** | 자정 넘김, 8시간 만근 |
| FR21 | 마사지사1/2 콜 인정·일정산 | **P0** | story-4-2 | therapist-daily-settlement | **FULL** | 양 칸 인정, 방문완료만 |
| FR22 | 귀케어 근무상태 입력 | P1 | story-4-3 | earcare-attendance | **FULL** | 정상만 지급 대상, 감사 |
| FR23 | 귀케어 풀 균등 분배·0명 0원 | **P0** | story-4-4 | earcare-daily-settlement | **FULL** | 0명→0원·미분배, tie-breaker |
| FR24 | 운영팀 근무상태·일일 인센 | **P0** | story-4-5 | ops-attendance, ops-daily-incentive | **FULL** | 30/40/50 경계 |
| FR25 | 운영팀 월 인센 미리보기 | **P0** | story-4-6 | ops-monthly-incentive | **FULL** | 1000~1500 구간, 분배율 |
| FR26 | 월마감 미리보기 집계 | **P0** | story-5-1 | monthly-closing-preview | **FULL** | 마사지사/운영팀/귀케어 합계 |
| FR27 | 만근수당 20일 경계 | **P0** | story-5-2 | monthly-closing-preview | **FULL** | 20일↑ 2M, 19일↓ 0 (경계 unit) |
| FR28 | 갯수왕 40콜·1~3위 수당 | **P0** | story-5-2 | monthly-closing-preview | **FULL** | 3명 미만 자격자 처리 포함 |
| FR29 | 월마감 확정/잠금·스냅샷 | **P0** | story-5-3, 5-4, 5-6 | monthly-closing-service, month-lock-guard | **FULL** | 스냅샷 불변, 이중확인 모달 |
| FR30 | 관리자 사유 기반 재오픈 | **P0** | story-5-5 | monthly-closing-service | **FULL** | 관리자 전용, 사유 5자↑ |
| FR31 | 오늘 KPI 대시보드 | P1 | story-6-1 | dashboard-query | **FULL** | 방문완료 기준, empty 상태 구분 |
| FR32 | 월간 KPI·확정 스냅샷 조회 | P1 | story-6-2 | dashboard-query | **FULL** | sourceBasis 3종 구분 |
| FR33 | 주인용 그래프 리포트 | P2 | story-6-3 | dashboard-query | **FULL** | snapshot_missing fallback 금지 |
| FR34 | RBAC 5역할 접근 분리 | **P0** | story-1-2 | authorization | **FULL** | landing/sidebar/direct route 차단 |
| FR35 | 삭제 불가 감사 로그 | **P0** | story-1-3 | (감사는 각 도메인 unit에 분산) | **FULL** | append-only, dot notation |
| FR36 | 엑셀 시트 기능 매핑표 | P2 | story-7-1 | sheet-feature-mapping | **FULL** | 숨김 `목록` 포함 100% gate |
| FR37 | 계산 대조 검증 | P1 | story-7-2, 7-3 | migration-calculation-comparison, migration-verification-report | **FULL** | fixture 기반 결정적 대조 |

### 비기능 요구사항 (NFR1~NFR12) — 횡단 관심사

| NFR | 주제 | 증거 위치 | 상태 | 비고 |
| --- | --- | --- | --- | --- |
| NFR1 | 엑셀 업무 규칙 일치 | story-7-2 fixture, 도메인 unit 전반 | **FULL** | 셀 좌표는 검증 근거로만 |
| NFR2 | 운영월 날짜/ID 기준 집계 | operating-date.test, 각 정산 unit | **FULL** | Excel 행 범위 미사용 |
| NFR3 | 실시간 갱신·로딩 상태 | story-3-2/3-4 (15초 폴링), story-6-4 (loading/aria-busy) | **PARTIAL** | 성능 실측 없음(코드 신호만) → NFR 워크플로우 권장 |
| NFR4 | 서버 계산(클라이언트 수식 금지) | 도메인 서비스 전반, UI 재계산 금지 검증 | **FULL** | dashboard/live/rooms 재계산 금지 |
| NFR5 | NextAuth·실행 시점 권한 검사 | story-1-2, authorization.test, requirePermission | **FULL** | DB 재조회 기반 |
| NFR6 | 감사 불변·스냅샷 흔들림 금지 | monthly-closing-preview/service unit, story-5-x | **FULL** | 확정 후 자동 재계산 금지 회귀 |
| NFR7 | 재오픈 관리자+사유 | story-5-5, monthly-closing-service | **FULL** | settlement_manager 거부 검증 |
| NFR8 | 첫 화면/입력성/정산 근거 가독성 | story-3-2, 2-6, 5-1 | **PARTIAL** | UX 정성 평가는 trace 범위 밖 |
| NFR9 | 기술스택 고정 | project-context, package.json | **N/A** | 빌드/설정 제약(테스트 대상 아님) |
| NFR10 | 배포/env/migration 절차 | — | **NONE** | CI/배포 파이프라인 테스트 부재 → CI 워크플로우 권장 |
| NFR11 | 안정 키(ID) 사용·정책 스냅샷 | 도메인 unit 전반 (stable ID 원칙) | **FULL** | 표시명 다운스트림 키 금지 |
| NFR12 | v1 범위 제한 | — | **N/A** | 범위 정의(테스트 대상 아님) |

### 커버리지 로직 검증

- ✅ **모든 P0 항목에 커버리지 존재** — 지급액 영향 FR(8,11,12,13,14,20,21,23,24,25,26,27,28,29,30,34,35)이 전부 FULL. unit(결정적) + E2E(통합) 조합.
- ✅ **인증/권한 negative path 존재** — story-1-2가 비활성/잠금/권한없음 direct route 차단을 검증. authorization.test가 권한 매트릭스 unit 검증.
- ✅ **에러/대안 상태 검증** — D코스 차단, 운영월 범위/잠금, 정책 없음, snapshot_missing, 정상근무자 0명 등 happy-path-only 아님.
- ✅ **레벨 중복 정당화** — 지급액 계산은 unit(경계/결정성) + E2E(통합 흐름)로 의도적 이중 커버. test-levels-framework 부합.
- ⚠️ **FR10 PARTIAL** — combobox 현대화 미완으로 일부 E2E 실행 그린이 막힘(기능 누락 아닌 테스트 현대화 이슈). test-review M5와 연동.
- ⚠️ **NFR3/NFR8/NFR10 갭** — 성능 실측·UX 정성·배포 파이프라인은 trace 범위 밖. 각각 NFR/CI 워크플로우로 라우팅.

---

## Step 4 — 갭 분석 및 커버리지 통계 (Phase 1 완료)

> 실행 모드: **sequential** (`tea_execution_mode: auto` → 런타임 콜드스타트 회피, 인라인 평가).
> 머신리더블 매트릭스: `/tmp/tea-trace-coverage-matrix-2026-06-12T00-44-04.json`

### 커버리지 통계 (FR 기준, 37개)

| 지표 | 값 |
| --- | --- |
| 전체 요구사항 | 37 |
| FULL | **36 (97%)** |
| PARTIAL | 1 (FR10) |
| NONE | **0** |

### 우선순위별 커버리지

| 우선순위 | 충족/전체 | % | 판정 |
| --- | --- | --- | --- |
| **P0** (지급액/인증/파괴적) | 17 / 17 | **100%** | 🟢 |
| **P1** (주요 경로) | 11 / 12 | 92% | 🟡 (FR10 PARTIAL) |
| **P2** (보조) | 8 / 8 | 100% | 🟢 |
| P3 | 0 / 0 | — | — |

### 갭 분류 (리스크순)

| 심각도 | 개수 | 항목 |
| --- | --- | --- |
| **Critical (P0 NONE)** | **0** | — |
| **High (P1 NONE)** | **0** | — |
| **Medium (PARTIAL)** | 1 | FR10 (combobox 현대화 미완 — 기능 누락 아님) |
| **Low** | 0 | — |

### 커버리지 휴리스틱 (사각지대 스캔)

| 휴리스틱 | 갭 수 | 비고 |
| --- | --- | --- |
| 미커버 엔드포인트 | 0 | 전용 API 레이어 없음 (Server Action = domain unit + E2E) |
| 인증 negative path 누락 | 0 | story-1-2: 비활성/잠금/권한없음 차단 검증 |
| happy-path-only 기준 | 0 | D코스 차단, 운영월 범위/잠금, 정책 없음, 0명 처리 등 |
| E2E 없는 UI journey | 0 | 38 story 1:1 매핑 |
| UI 상태 누락 | 0 | loading/empty/error는 story-6-4 |

### NFR 커버리지 (횡단)

| 판정 | 개수 | NFR |
| --- | --- | --- |
| FULL | 7 | NFR1, 2, 4, 5, 6, 7, 11 |
| PARTIAL | 2 | NFR3 (성능 실측 없음), NFR8 (UX 정성) |
| NONE | 1 | NFR10 (배포/migration 파이프라인) |
| N/A | 2 | NFR9 (스택 고정), NFR12 (범위 정의) |

### 권고 (Phase 2 입력)

1. **MEDIUM** — FR10 combobox 현대화로 PARTIAL → FULL (그리드 셀 `selectGridCombobox` 전환).
2. **MEDIUM** — NFR3/NFR8: `NR` (NFR Evidence Audit) 실행 권장 (성능·UX 증거).
3. **MEDIUM** — NFR10: `CI` 워크플로우 실행 권장 (배포/migration 파이프라인).
4. **LOW** — 환경 선결: stale dev 서버 정리 후 E2E full-green 재실행.
5. **LOW** — test-review 완료(74/100). H2 잔여 blind teardown 4스펙 후속 추적.

### Phase 1 요약

```
✅ Phase 1 Complete: Coverage Matrix Generated

📊 Coverage Statistics (FR):
- Total Requirements: 37
- Fully Covered: 36 (97%)
- Partially Covered: 1 (FR10)
- Uncovered: 0

🎯 Priority Coverage:
- P0: 17/17 (100%)  ← 지급액 영향 전부 충족
- P1: 11/12 (92%)
- P2: 8/8 (100%)

⚠️ Gaps Identified:
- Critical (P0): 0
- High (P1): 0
- Medium (P2/PARTIAL): 1 (FR10)
- Low: 0

🔍 Coverage Heuristics: 모든 사각지대 0건

📝 Recommendations: 5

🔄 Phase 2: Gate decision (next step)
```

---

## Step 5 — 품질 게이트 결정 (Phase 2)

### 🚨 게이트 결정: **PASS** ✅

> **근거:** P0 coverage 100%, P1 coverage 92% (목표 90%), 전체 coverage 97% (최소 80%). 결정적 임계값 규칙(Rule 4)에 따라 무조건 PASS.

### 게이트 적격성

| 항목 | 값 |
| --- | --- |
| `allow_gate` | true |
| `collection_status` | COLLECTED |
| **gate_eligible** | **true** |
| 오라클 신뢰도 | high (formal_requirements, non-synthetic) → 오버레이 없음 |

### 게이트 기준 충족 현황

| 기준 | 요구 | 실제 | 판정 |
| --- | --- | --- | --- |
| P0 커버리지 | 100% | **100%** | ✅ MET |
| P1 커버리지 | 목표 90% / 최소 80% | **92%** | ✅ MET |
| 전체 커버리지 | 최소 80% | **97%** | ✅ MET |
| Critical 갭 | 0 | **0** | ✅ |

### 결정 트리 적용 경로

1. Rule 1 (P0 < 100% → FAIL): **미해당** (P0 = 100%)
2. Rule 2 (overall < 80% → FAIL): **미해당** (97%)
3. Rule 3 (P1 < 80% → FAIL): **미해당** (92%)
4. **Rule 4 (P1 ≥ 90% + overall ≥ 80% + P0 = 100% → PASS): 적용** ✅
5. 오라클 오버레이: non-synthetic + high confidence → **변경 없음**

### 미해소 항목 (PASS를 막지 않음)

| 항목 | 심각도 | 성격 |
| --- | --- | --- |
| FR10 PARTIAL | Medium | combobox 현대화 미완 — **기능 누락 아님**, 테스트 실행 그린 이슈 |
| NFR3/NFR8 | Medium | 성능 실측·UX 정성 — **trace 범위 밖** (NFR 워크플로우 소관) |
| NFR10 | — | 배포/migration 파이프라인 — **trace 범위 밖** (CI 워크플로우 소관) |
| E2E 환경 블로커 | High | 브라우저↔NextAuth HTTP 경계 — **테스트 로직 무관**, 환경 선결 과제 |

> ⚠️ **중요한 단서:** 게이트는 **요구사항↔테스트 매핑 커버리지**가 PASS임을 의미합니다. 이는 "모든 E2E가 그린"을 뜻하지 **않습니다.** test-review에 기록된 E2E 환경 블로커(브라우저 로그인 race는 수정됨, 잔여 환경 이슈는 별도)는 커버리지 게이트와 독립적인 **실행 신뢰성** 영역입니다. 릴리스 전 실 환경에서 E2E full-green 재확인을 권장합니다.

### 머신리더블 산출물

- `_bmad-output/test-artifacts/traceability/e2e-trace-summary.json` — CI/대시보드/에이전트 소비용 전체 요약
- `_bmad-output/test-artifacts/traceability/gate-decision.json` — 게이트 신호만 필요한 파이프라인용 슬림 산출물

### 다음 권고 액션 (Top 3)

1. **MEDIUM** — FR10 combobox 현대화로 PARTIAL → FULL.
2. **MEDIUM** — `NR` (NFR Evidence Audit): NFR3(성능)·NFR8(UX) 증거 평가.
3. **MEDIUM** — `CI` 워크플로우: NFR10 배포/migration 파이프라인 게이트.

---

```
🚨 GATE DECISION: PASS

📊 Coverage Analysis:
- P0 Coverage: 100% (Required: 100%) → MET
- P1 Coverage: 92% (PASS target: 90%, minimum: 80%) → MET
- Overall Coverage: 97% (Minimum: 80%) → MET

✅ Decision Rationale:
P0 coverage is 100%, P1 coverage is 92% (target: 90%), overall 97% (min 80%).

⚠️ Critical Gaps: 0

📂 Full Report: _bmad-output/test-artifacts/traceability-matrix.md

✅ GATE: PASS - Release approved, coverage meets standards
   (단, 커버리지 기준 PASS이며 E2E full-green 실행 검증은 별도 선결)
```
