---
stepsCompleted: ['step-01-load-context', 'step-02-discover-tests', 'step-03-quality-evaluation', 'step-03f-aggregate-scores']
lastStep: 'step-03f-aggregate-scores'
lastSaved: '2026-06-11'
overallScore: 74
executionMode: 'sequential'
reviewScope: 'suite'
detectedStack: 'fullstack'
testFramework: 'Playwright (E2E) + node:test (unit)'
inputDocuments:
  - '_bmad-output/project-context.md'
  - '_bmad/tea/config.yaml'
  - 'playwright.config.ts'
  - 'package.json'
  - 'knowledge/test-quality.md'
  - 'knowledge/test-levels-framework.md'
  - 'knowledge/data-factories.md'
  - 'knowledge/selector-resilience.md'
---

# 테스트 품질 리뷰 — vietnam_massage

- **리뷰 범위(scope):** suite (전체 스위트, 우선순위 필터 없음)
- **리뷰어:** Master Test Architect (Murat)
- **언어:** Korean
- **대상 브랜치:** fix/e2e-lowercase-account-id
- **생성일:** 2026-06-11

---

## Step 1 — 컨텍스트 및 지식베이스

### 감지된 스택

- **Frontend:** Next.js 16 App Router + React 19 (`playwright.config.ts` 존재)
- **Backend:** Node.js + Prisma 7 + PostgreSQL (`@prisma/adapter-pg`)
- **분류:** `fullstack`

### 테스트 프레임워크

| 레벨 | 러너 | 스크립트 | 비고 |
| --- | --- | --- | --- |
| E2E | `@playwright/test@1.60.0` | `npm run test:e2e` | 실 DB 시딩, `fullyParallel: true` |
| Unit | `node:test` + `tsx` | `npm run test:unit` | in-memory Prisma 목 주입, 외부 의존성 없음 |
| Static | 커스텀 `validate-story-*.mjs` (×39) | `npm run lint` | 스토리별 정적 검증, Playwright/단위와 별개 |

> ⚠️ `tea_use_playwright_utils: true`로 설정돼 있으나 `playwright-utils` 패키지는 실제로 도입돼 있지 않음 (package.json 미존재). 설정과 실제 상태 불일치.

### 로드한 핵심 지식 fragment

- `test-quality.md` (Definition of Done: 결정성·격리·명시성·집중·속도)
- `test-levels-framework.md` (unit/integration/e2e 선택 기준, 중복 커버리지 가드)
- `data-factories.md` (override 가능한 factory, API-first setup)
- `selector-resilience.md` (data-testid > ARIA > text > CSS 우선순위)

### 컨텍스트 아티팩트

- `_bmad-output/project-context.md` — 도메인 규칙 52개 (지급액 영향 회귀, 상태값 보존, stable ID 원칙 등)
- 스토리별 acceptance criteria는 `project-context.md`에 압축돼 있고, 각 spec 파일명이 스토리에 1:1 매핑됨
- 커버리지 매핑/게이트는 본 워크플로우 범위 밖 → `trace`로 라우팅

---

## Step 2 — 테스트 발견 및 인벤토리

### 인벤토리 요약

- **E2E 스펙:** 38개 (`tests/e2e/*.spec.ts`), 총 ~11,200줄
- **단위 테스트:** 24개 (`src/**/*.test.ts`), 총 ~9,900줄
- **공유 fixture:** 2개 (`tests/fixtures/migration-calculation-{comparison,prisma}.ts`)

### 300줄 가이드라인 초과 파일

**E2E (16/38 초과):** story-6-2 (573), story-5-1 (516), story-3-5 (435), story-2-2 (422),
story-6-3 (416), story-3-3 (413), story-3-4 (390), story-4-5 (388), story-6-1 (380),
story-5-2 (366), story-2-3 (357), story-4-4 (356), story-1-6 (345), story-2-4 (343),
story-2-1 (340), story-5-5 (325).

**Unit (대형):** service-call-service (1631), monthly-closing-preview-service (861),
dashboard-query-service (837), monthly-closing-service (666), course-service (648),
therapist-attendance-service (638).

> 단, 길이의 상당 부분은 **테스트 본문 복잡도가 아니라 파일별 중복 시드/픽스처 보일러플레이트**임 (아래 Maintainability 참고). 단위 테스트의 길이는 대부분 `describe` 다수 + 인라인 픽스처 빌더이며 개별 `it` 블록은 작고 집중돼 있음.

### 메타데이터 패턴 (관찰)

- **E2E:** 실 PostgreSQL에 Prisma `upsert`로 시딩 → 로그인 → UI 단언. `expect.poll`로 eventual consistency 처리. `test.describe.configure({ mode: "serial" })`를 상태 변이 스펙에 사용.
- **Unit:** 도메인 서비스에 `prismaClient` 파라미터로 in-memory 목을 **의존성 주입**. `node:assert/strict` + `node:test`. 순수·결정적.
- **셀렉터:** `getByRole`, `getByLabel`, `getByText({ exact: true })` 위주 — 시맨틱 우선순위 양호. CSS 클래스 셀렉터 거의 없음.

### Anti-pattern 1차 스캔 결과 (근거 기반)

| 신호 | grep 결과 | 판정 |
| --- | --- | --- |
| `waitForTimeout` 하드 웨이트 | **0건** | ✅ 없음 |
| `setTimeout` | 2건 (story-5-1, 5-2) | ✅ 무해 — unique-constraint 재시도 백오프 헬퍼 |
| 테스트 본문 if/try/catch 흐름제어 | 0건 | ✅ — 모든 if/try/catch는 시드/setup 헬퍼 내부 |
| `.first()/.nth()/.last()` 인덱스 셀렉터 | 98건/26파일 | ⚠️ 검토 필요 (일부는 정당, 일부는 취약) |

---

## Step 3 — 품질 평가 (4개 차원)

> 실행 모드: **sequential** (`tea_execution_mode: auto` → 런타임 서브에이전트 콜드스타트 회피, 인라인 평가). 4개 차원: Determinism, Isolation, Maintainability, Performance. Coverage는 본 워크플로우 범위 밖.

### 차원 1 — Determinism (결정성) · 점수 92/100 🟢

테스트 스위트에서 가장 강한 차원입니다.

**강점**
- **하드 웨이트 0건.** `waitForTimeout`/임의 `sleep`이 전혀 없음.
- 비동기/eventual consistency는 `expect.poll(...)`로 처리 (story-2-2 autosave, 시드 후 DB 검증 등). 결정적 대기.
- 단위 테스트는 고정 시각(`new Date("2026-06-09...")`)과 in-memory 목으로 완전 결정적. `Math.random()` 기반 데이터 없음.
- 테스트 본문에 if/try/catch 흐름제어 없음 → 항상 동일 경로 실행.

**관찰/위험**
- `Date.now().toString(36)`로 메모 고유값 생성 (story-2-2 등). 충돌 방지엔 충분하나 factory/`crypto.randomUUID()` 대비 가독성·추적성 약간 낮음. (경미)
- `expect.poll` 미사용 채로 시드 직후 UI 단언을 하는 일부 read-only 스펙은 `router.refresh()` 15초 폴링 화면 특성상 타이밍 민감 가능 → 현재는 `expect(...).toBeVisible()` auto-retry로 흡수 중. (경미, 모니터링 권장)
- `setTimeout` 2건은 unique-constraint 재시도 백오프로 정당. 흐름제어 하드웨이트 아님.

---

### 차원 2 — Isolation (격리) · 점수 68/100 🟡

가장 큰 구조적 리스크가 여기 있습니다.

**전략 (의도적)**
- E2E는 **공유 단일 PostgreSQL**에 시딩. 충돌은 (a) `upsert` 멱등성, (b) **미래 날짜 네임스페이스**(monthKey `2032-03`, `2032-04` 등 실데이터와 분리), (c) 스토리별 sortOrder 오프셋(예: 92201)으로 회피.
- 상태 변이 스펙은 `test.describe.configure({ mode: "serial" })` (17개 파일)로 순서 의존성 차단.
- 일부 스펙은 `beforeAll`/시드 단계에서 자기 데이터 `deleteMany` 선청소(reset-before) 수행 (story-2-5).

**문제점**
1. **진짜 teardown이 없음.** 대부분의 `afterAll`은 `prisma.$disconnect()`만 호출 → **시드 데이터가 DB에 영구 잔류**. 반복 실행 시 DB가 계속 부풀고, 한 스펙이 만든 row가 다른 스펙 조회에 노출될 잠재 위험.
2. **권한 변이 후 복구가 try/finally가 아님** (story-2-2: `read_only_viewer`로 바꿨다가 본문 마지막에 `counter`로 되돌림). 본문 단언 실패 시 되돌림 코드에 도달 못 해 **계정 역할이 오염된 채 남음** → 후속 실행 오염. `afterAll`에서도 복구하긴 하나, 같은 파일 내 다른 테스트엔 이미 영향.
3. **`fullyParallel: true`인데 공유 가변 전역 상태**(`let seededData`)와 공유 계정(`administrator` 등 고정 accountId)을 여러 파일이 동시에 변이 → 서로 다른 spec 파일이 같은 `administrator` 계정/코드아이템을 동시 upsert/비활성화할 때 레이스 가능. (story-2-2가 `PAYMENT_METHOD 카드`를 비활성→활성 토글하는 동안 다른 스펙이 그 코드를 읽으면 깨질 수 있음.)
4. **단위 테스트는 격리 만점** — 의존성 주입 in-memory 목으로 완전 독립. 이 차원 감점은 전적으로 E2E 레이어.

**권고**
- 스펙별 고유 prefix를 강제하는 **공유 시드 헬퍼 + 추적 기반 teardown**(생성한 id를 배열에 모아 `afterAll`에서 삭제) 도입.
- 전역 공유 계정/코드 토글을 피하고 스펙 전용 계정·코드 네임스페이스 사용.
- 권한/코드 토글 복구는 반드시 `try/finally` 또는 `afterEach`로.

---

### 차원 3 — Maintainability (유지보수성) · 점수 60/100 🟡

**가장 임팩트 큰 개선 기회 = 인프라 보일러플레이트 중복.**

**핵심 발견 (근거)**

| 중복 항목 | 재정의한 파일 수 |
| --- | --- |
| 로컬 `login()` 헬퍼 | **35 / 38** |
| 하드코딩 `argon2idOptions` | **35 / 38** |
| 하드코딩 `DATABASE_URL` 폴백 문자열 | **35 / 38** |
| `seedAuthAccount()` 거의 동일 복붙 | **25 / 38** |

→ 인증 정책(argon2 파라미터, 로그인 폼 라벨, accountId 규칙)이 바뀌면 **30개 이상 파일을 동시 수정**해야 함. 이는 `data-factories.md`(override factory 재사용)와 `fixture-architecture.md`(setup 추출) 원칙의 정면 위반이며, 스위트 전체 회귀의 단일 최대 리스크.

**강점**
- 셀렉터 품질 우수: `getByRole`/`getByLabel`/`getByText({exact:true})` 시맨틱 우선순위 준수. CSS 클래스/XPath 셀렉터 거의 없음 (`selector-resilience.md` 부합).
- 단언이 테스트 본문에 명시적으로 노출 (헬퍼에 숨기지 않음).
- 한국어 도메인 상태값(`방문완료`, `예약` 등) 원문 보존 → `project-context.md` 규칙과 일치.
- 단위 테스트의 인라인 픽스처 빌더(`call()`, `policy()`, `rate()`)는 override factory 패턴을 잘 따름.

**문제점**
- 위 중복 외에, 16개 E2E 파일이 300줄 초과인데 대부분 시드 코드 때문 → 공유 헬퍼로 추출 시 본문이 절반 이하로 축소 가능.
- `(prisma as any)` 캐스팅이 전 파일에 만연 → 타입 안전성 상실. 생성된 Prisma 클라이언트 타입을 쓰면 시드 오타를 컴파일 타임에 잡을 수 있음.
- 일부 거대 단위 테스트(service-call-service 1631줄)는 단일 파일에 너무 많은 시나리오 → `describe`별 파일 분할 여지.

**권고 (우선순위 순)**
1. `tests/e2e/support/` 신설: `auth-fixtures.ts`(login, seedAuthAccount, argon2 옵션), `db.ts`(prisma 싱글턴 + DATABASE_URL), `factories.ts`(employee/course/call 빌더). Playwright `test.extend`로 fixture화.
2. `(prisma as any)` 제거 → 생성 타입 사용.
3. 300줄 초과 스펙은 공유 헬퍼 적용 후 자연 축소되는지 확인.

---

### 차원 4 — Performance (성능) · 점수 78/100 🟢

**강점**
- E2E 시드를 **UI가 아니라 Prisma 직접 호출**로 수행 (`test-quality.md`의 API-first setup 원칙 부합) → UI 회원가입/입력 우회로 빠름.
- `fullyParallel: true` + 로컬 `workers: undefined`(코어 수만큼) → 로컬 병렬 활용.
- 단위 테스트는 in-memory 목이라 밀리초 단위. 외부 DB/네트워크 없음.
- 단일 브라우저 프로젝트(chromium-desktop)로 매트릭스 과다 방지.

**문제점/위험**
1. **`mode: "serial"` 17개 파일** → 해당 파일 내부 테스트가 순차 실행. 격리를 직렬화로 사들인 것이므로 필요악이지만, 위 Isolation 개선(고유 네임스페이스)이 되면 일부는 parallel로 풀어 속도 회복 가능.
2. **CI `workers: 1`** (`playwright.config.ts`) → CI에서 38개 스펙 전체가 단일 워커 순차. 공유 DB 충돌 회피 목적이지만 CI 시간이 길어짐. Isolation 강화 후 샤딩/병렬 워커로 단축 여지.
3. 각 E2E 스펙의 `beforeAll` 시드가 무겁고(argon2 해시 × N 계정 + 수십 upsert) 파일마다 반복 → 공유 글로벌 셋업(`globalSetup` + `storageState`)으로 로그인·기본 시드를 1회화하면 누적 시간 절감.
4. 1.5분/테스트 한계 초과는 코드상 징후 없음(하드웨이트 0). 단 serial+무거운 시드 조합으로 일부 파일 총 실행시간은 길 수 있음 → 실측 권장.

---

## 종합 점수

| 차원 | 점수 | 가중치 | 신호 |
| --- | --- | --- | --- |
| Determinism | 92 | 30% | 🟢 |
| Isolation | 68 | 30% | 🟡 |
| Maintainability | 60 | 25% | 🟡 |
| Performance | 78 | 15% | 🟢 |
| **가중 종합** | **74 / 100** | — | 🟡 **양호, 구조 개선 필요** |

> 가중 종합 = 92×0.30 + 68×0.30 + 60×0.25 + 78×0.15 = **74.1**

---

## 발견사항 (심각도별)

### 🔴 High (회귀 리스크 큼 — 우선 처리)

- **H1. 인증/시드 인프라 보일러플레이트 30+파일 중복** (Maintainability). 단일 정책 변경이 30개 파일 동시 수정 유발. → 공유 `tests/e2e/support/` fixture로 추출.
- **H2. E2E teardown 부재 + 공유 계정/코드 토글** (Isolation). `fullyParallel`에서 공유 가변 상태 레이스 + 본문 실패 시 역할/코드 오염 잔류. → 추적 기반 teardown + `try/finally` 복구 + 스펙 전용 네임스페이스.

### 🟡 Medium (개선 권장)

- **M1. `(prisma as any)` 전면 사용** → 타입 안전성 상실. 생성 Prisma 타입 적용.
- **M2. CI `workers: 1` + serial 17파일** → CI 실행시간. Isolation 강화 후 병렬/샤딩 복원.
- **M3. 반복되는 무거운 `beforeAll` 시드** → `globalSetup` + `storageState`로 공통화.
- **M4. 16개 E2E 스펙 300줄 초과** → 대부분 H1 해결 시 자연 축소.

### 🟢 Low (경미)

- **L1.** 고유값 생성에 `Date.now().toString(36)` 대신 `crypto.randomUUID()`/factory 권장.
- **L2.** 거대 단위 테스트(service-call-service 1631줄) `describe`별 분할 여지.
- **L3.** `tea_use_playwright_utils: true` 설정과 실제 미도입 불일치 → 설정 정리 또는 실제 도입.

---

## Top 3 권고 (실행 우선순위)

1. **공유 E2E support 모듈 신설** — `auth-fixtures.ts` / `db.ts` / `factories.ts` 추출 후 Playwright `test.extend` fixture화. H1·M3·M4를 한 번에 해소하고 스위트 유지보수성을 가장 크게 끌어올림.
2. **격리 강화** — 생성 데이터 추적 후 `afterAll` 삭제, 권한/코드 토글은 `try/finally`, 스펙 전용 계정·코드 네임스페이스 도입. H2 해소 → 이후 병렬 복원의 전제.
3. **타입 안전 시드** — `(prisma as any)` 제거, 생성 Prisma 타입 사용으로 시드 오타를 컴파일 타임에 차단 (M1).

---

## 리메디에이션 로그

### H1 해소 — 인증/시드 인프라 보일러플레이트 추출 (2026-06-11 완료)

**신설 공유 모듈**
- `tests/e2e/support/db.ts` — 워커당 단일 Prisma 클라이언트 (`DATABASE_URL` 폴백 포함)
- `tests/e2e/support/auth.ts` — `argon2idOptions` + 공유 `login(page, accountId, password)` 헬퍼

**적용 결과 (검증)**
| 지표 | Before | After |
| --- | --- | --- |
| `argon2idOptions` 중복 정의 | 35 | **0** |
| `DATABASE_URL` 폴백 중복 | 35 | **0** |
| 공유 `login()` 중복 정의 | 35 | **1 (support 모듈)** |
| `support/db`·`support/auth` import | 0 | **35** |
| 잔존 로컬 `login` (스토리 전용 변형) | — | 8 (의도적 보존) |

- 변경 규모: 34개 스펙 수정, **순 −425줄** (134 insertions / 559 deletions) + support 모듈 2개 신설.
- 잔존 8개 로컬 `login`은 `login(page)` / `login(page, account: StoryAccount)` 등 시그니처가 다른 스토리 전용 변형 → 공유 헬퍼 비대상, 의도적 유지.
- **검증:** `npx tsc --noEmit` 통과(exit 0), 추출로 인한 unused `Page` import 0건. (기존 `(prisma as any)` no-explicit-any 경고는 M1 영역으로 본 작업 범위 밖.)

### H2 부분 해소 — 격리 try/finally 복구 + 공유 cleanup 헬퍼 (2026-06-11 완료)

**범위 결정:** 현재 환경에서 E2E 실측 검증 불가(DB/Docker 미기동) → 27개 스펙 blind teardown은 보류하고,
**실제 correctness 버그(본문 실패 시 상태 미복구)** 가 있는 고위험 스펙만 우선 수정 + 재사용 헬퍼 추출.

**신설 모듈**
- `tests/e2e/support/cleanup.ts` — `restoreUserAccount`, `setCodeItemActive`, `deleteOperatingMonthsByKey`, `deactivateEmployeesByPrefix` (story-4-1 패턴 추출, 스펙 전용 네임스페이스만 건드림)

**적용 (story-2-2)**
- "권한이 사라진 사용자" 테스트: role을 `read_only_viewer`로 변이 후 본문을 `try`로 감싸고 `finally`에서 `counter` 복구 → serial 후속 테스트 오염 차단.
- "autosave 실패 retry" 테스트: `카드` 결제수단 코드 비활성화 후 본문을 `try`로 감싸고 `finally`에서 재활성화.
- `afterAll`은 방어적 2차 복구로 유지하되 공유 헬퍼로 단순화.

**적용 (story-2-3, story-2-4)**
- 분석 결과 본문 내 토글이 없어(변이는 `afterAll` 방어용뿐) try/finally 불필요. `afterAll`의 `(prisma as any).userAccount.update` 중복을 `restoreUserAccount` 헬퍼로 치환 (M1 일부 감소).

**검증:** `npx tsc --noEmit` 통과(exit 0), try/finally balance 2:2, 4개 파일 unused import 0건.

### H2 2단계 — 기존 scoped cleanup을 afterAll에 연결 (2026-06-11 완료)

**발견:** 16개 스펙이 자기 전용 scoped cleanup 함수(`cleanupStoryData`/`cleanupStoryCalls`/`cleanupStoryAttendance`)를 이미 정의했지만 **pre-seed(reset-before)에서만 호출하고 afterAll에서는 호출하지 않아** 매 실행 데이터가 누적됨. story-4-1만 afterAll에 연결돼 있었음.

**적용:** 16개 스펙의 `afterAll`에 자기 스펙의 기존 cleanup 함수를 호출하도록 연결. 새 delete 로직을 만들지 않고 **이미 pre-seed에서 성공 실행되던 검증된 scoped 로직을 재사용** → 최소 리스크.

| 그룹 | 스펙 | cleanup 호출 |
| --- | --- | --- |
| 콜/지출 | 2-5, 2-6, 3-2, 3-3, 3-4, 3-5, 4-2 | `cleanupStory*(seededData.openMonthId)` (memo prefix scoped) |
| 출퇴근/정산 | 4-3, 4-4, 4-5, 4-6 | `cleanupStory*([운영월 IDs])` |
| 월마감/대시보드 | 5-1, 5-2, 6-1, 6-2, 6-3 | 운영월 IDs (+ 5-1/5-2는 워커별 `memoPrefix`를 `seededData`에 추가해 전달) |

- afterAll에서 cleanup 호출 스펙: **1 → 17**.
- 5-1/5-2는 worker-isolated `memoPrefix`를 `SeededData`에 추가(소규모 타입/return 확장)해 afterAll에서 정확히 자기 워커 데이터만 정리.
- **검증:** `npx tsc --noEmit` 통과(exit 0). 신규 unused import/warning 0건(기존 4건은 본 작업 무관).

### H2 의도적 미적용 (정직 보고)

다음 스펙은 분석 후 **의도적으로 손대지 않음**:

| 분류 | 스펙 | 사유 |
| --- | --- | --- |
| (a) 데이터 미축적 — 안전 | 1-2, 1-3, 7-1, 7-3 | 콜/운영월/마감 생성 0건. 멱등 upsert 계정/직원 + 정적 조회만 → 잔류 데이터 없음. `$disconnect`만으로 충분. |
| (b) 자체 reset-before | 5-4, 5-5 | `seedClosedMonth`가 시드 직전 자기 `MonthlyClosing` + scoped 감사 로그를 deleteMany로 정리(멱등). 잔류는 월당 1개로 매 실행 덮어씀. |
| (c) DB 검증 필요 — 고위험 | 2-1, 5-3, 5-6, 6-4 | 2-1은 **UI로 콜 생성**(memo prefix 보장 없음), 5-x/6-4는 마감 스냅샷 등 payout 민감 데이터. 안전한 scoped cleanup 작성에 **실 DB FK/동작 검증 필수**. DB 미기동 환경에서 blind 작성은 회귀 위험 → 보류. |

> **(c) 후속 권고:** 로컬 DB 기동 후 각 스펙의 실제 시드를 실행·관찰하며 scoped cleanup을 작성하고 E2E로 검증. story-4-1 `cleanupStorySeedData` + `support/cleanup.ts`가 참고 모델.

### 검증 실행 결과 (2026-06-11)

**단위 테스트: 198/198 통과** ✅ — H1/H2 리팩터링 후에도 unit 레이어 회귀 0. (DB 불필요)

**타입체크: `tsc --noEmit` exit 0** ✅ — 전 변경 컴파일 정상.

**E2E: 실행했으나 환경 차단으로 결론 미확정** ⚠️
- 로컬 Docker DB(`erp_fish_postgres`) 기동, 스키마 sync, 계정 seed 완료 후 `--workers=1` 실행.
- **거의 모든 login 의존 E2E가 동일하게 실패** — 페이지가 `/sign-in`에 머물고 `role="alert"` 오류 노출.
- **근본 원인 진단 (H1/H2와 무관 확정):**
  1. 계정 존재·active·미잠금·role 정상 (DB 직접 확인)
  2. `Story22!counter` 해시 `verify` → `true` (`@node-rs/argon2` 직접 확인)
  3. `authenticateAccount("story22_counter", ...)` 직접 호출 → 유효 계정 반환 (앱 로직 정상)
  4. NextAuth providers `callbackUrl` = `http://127.0.0.1:3000/...` (host 정상, `.env` NEXTAUTH_URL 일치)
  5. 그러나 브라우저 `signIn()`의 `POST /api/auth/callback/credentials`가 **서버 로그에 전혀 도달 안 함** → `signIn` !ok → alert → 로그인 실패
- 즉 **브라우저↔NextAuth HTTP 경계의 기존 환경 이슈**(memory `[[e2e-environment]]`의 `Failed to fetch RSC payload` 계열)로, **공유 `login()`은 원본과 byte-identical**이며 본 리팩터링이 유발한 실패가 아님.
- story-1-2에서 드러난 별개의 **pre-existing 테스트 버그**: `menu.getByText("월마감", {exact:true})`가 그룹 heading과 link 2개에 strict-mode 충돌(로그인 성공 후 발생) — 역시 리팩터링 무관.

**결론:** H1/H2 변경은 unit+typecheck로 회귀 없음 확인. E2E full-green 검증은 **기존 환경의 브라우저 로그인 차단**으로 미완료이며, 이는 본 작업 범위 밖의 별도 선결 과제. 환경 이슈 해소 후 재실행 권장.

### 후속 디버깅 — 로그인 차단 근본 원인 규명 및 수정 (2026-06-11)

**근본 원인 (확정):** 공유 `login()`이 `로그인` 클릭 직후 곧바로 반환하고, 호출부의 `page.goto(...)`가
in-flight `POST /api/auth/callback/credentials`를 `net::ERR_ABORTED`로 취소 → `signIn` !ok → `/sign-in` 잔류.
독립 브라우저로 클릭 후 충분히 대기하면 POST=200 + `/live` 랜딩 성공함을 트레이스로 확인. 즉 race가 진짜 원인.

**수정 (login fix):** `tests/e2e/support/auth.ts`의 `login()`이 `로그인` 클릭 후 `/api/auth/callback/credentials`
**POST 응답을 기다린 뒤 반환**하도록 변경(성공/실패 모두 응답 대기, 실패 검증 테스트도 동작). H1 중앙화 덕에 한 곳 수정으로 전 스펙 적용.
- 검증: story-1-2 admin/settlement 로그인 테스트가 **로그인 통과 + 사이드바 렌더**까지 진행(이전엔 `/sign-in` 잔류). 로그인 fix 작동 확정.

**story-1-2 셀렉터 버그 수정:** `menu.getByText("월마감", {exact:true})`가 `<h2>` 그룹 헤딩과 `<a>` 링크 둘 다
매칭(strict-mode violation) → `getByRole("heading", {name, exact})`로 변경. visibleGroups/hiddenGroups 단언에 적용.
- 검증: story-1-2 passed 4 → 6 (admin/settlement landing 테스트 green 전환).

**남은 E2E 실패 = 별도 pre-existing 데이터 버그 (본 작업 범위 밖):**
| 버그 | 증상 | 영향 |
| --- | --- | --- |
| `Course.code: "E2E22A"` 등 비 A~E 코드 | `listActiveCourses()`의 `assertCourseCode`가 `INVALID_COURSE_CODE` throw | `/calls` 등 코스 리스트 렌더 페이지 서버 에러 |
| `employeeGroup: "BACKOFFICE"` (8개 스펙) | `assertEmployeeGroup`이 `INVALID_EMPLOYEE_GROUP` throw | 직원 리스트 렌더 페이지 서버 에러 |

> 두 버그는 H1/H2/로그인 fix와 무관한 **시드 데이터가 도메인 제약 위반**. 코스 코드는 A~E, 직원 그룹은
> OPERATIONS/EARCARE/THERAPIST만 허용인데 5개+/8개 스펙이 위반 값을 시드. `/calls`·`/live` 등이 전체 리스트를
> 검증하다 throw. **후속 과제**로 시드 코드를 도메인 유효값으로 교체하면 E2E가 더 풀릴 것으로 예상.

---

## 강점 요약 (보존할 것)

- 하드 웨이트 0건, `expect.poll` 기반 결정적 대기 — 우수.
- 시맨틱 셀렉터(role/label/text) 일관 사용 — `selector-resilience` 모범.
- 단위 테스트의 의존성 주입 in-memory 목 — 격리·속도 양면에서 모범. 지급액 영향 도메인(정산/월마감/인센)에 대한 unit 커버리지 충실.
- 한국어 도메인 상태값 원문 보존로 `sheet.xlsx` 업무 규칙 회귀 방지.
- API-first 시드 (UI 우회) — 성능 모범.

