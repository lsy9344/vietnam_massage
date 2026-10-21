# Therapist 「수당」 탭 응답 지연 분석 (2026-10-20)

기준: Cloudflare 프리뷰 `app-expansion-vietnam-massage-erp.boothy-selectroom.workers.dev`(버전 `b7c11a6a`), 운영 DB = PlanetScale `ap-southeast-1`(싱가포르).
측정 대상: 직원 앱 하단 탭 「수당」(`/therapist/payout`).

---

## 1. 결론

| 항목 | 이전 | 이후(이번 작업) |
| --- | --- | --- |
| `/therapist/payout` (Worker 경유, 실측) | **74.2–76.6초** | **9.2–14.0초** (약 6–7배) |
| 같은 계산, Node → DB 직접 연결 | 17–40초 | **2.4–3.2초** |
| Prisma 쿼리 수 | **589개** | **47개** |
| 날짜별 근거 | 31일 × 그날 전체 Therapist 다시 계산 | 운영월 1회 일괄 계산 |
| 관리자 월 명세서 화면(`/settlements/statement`) | 3.5초 | 2.0초 |
| 월간 대시보드(`/dashboard/monthly`) | 3.4초 | 2.7초 |

버튼이 죽은 게 아니라 **요청이 느렸다**. 프리뷰 Worker 경유에서는 75초가 걸려서 화면이 멈춘 것처럼 보였다.

원인은 쿼리 내용 크기가 아니라 **왕복 횟수**다. 같은 DB에 `SELECT 1` 하나만 보내도 **66ms**가 걸린다
(한국→싱가포르 왕복 + PlanetScale 라우팅). 589번 왕복하면 39초가 순수 대기 시간으로 들어간다.

배포 후 실측(프리뷰 별칭 `app-expansion`, 버전 `8afb3f82`):

```
이전 버전 b7c11a6a : /therapist 8.5s · /therapist/payout 74.2s · /therapist/attendance 3.1s
신규 버전 8afb3f82 : /therapist 10.0s · /therapist/payout 9.2~14.0s · /therapist/attendance 3.9s
```

---

## 2. 측정 방법과 근거

- Prisma 클라이언트에 `log: [{ emit: "event", level: "query" }]`를 붙여 쿼리 수·쿼리별 소요시간을 세었다(`profile-queries.tmp.ts`).
- 동일 DB에 직접 붙은 Node 프로세스(tsx)로 서비스를 호출해 서비스 지연과 Worker 지연을 분리했다.
- 프리뷰는 인증 서명 세션으로 `/therapist/payout`를 실제로 GET 해 벽시계 시간을 잰다.

### 2.1 이전 경로의 쿼리 구성 (589개, 합 52.5초, 벽시계 19.7초)

| 쿼리 모양 | 횟수 | 합계 |
| --- | --- | --- |
| `employees` (활성 Therapist 목록) | 100 | 8.9초 |
| `operating_months` | 67 | 7.1초 |
| `service_call_assignments` | 63 | 7.5초 |
| `therapist_attendances` | 32 | 4.2초 |
| `payout_confirmation_events` | 52 | 3.4초 |
| `courses` / `course_policies` / `therapist_course_rates` / `service_calls` / `rooms` / `time_slots` | 각 32–39 | 각 2–3초 |

가장 느린 단일 쿼리도 549ms였고, 대부분 **한두 행을 읽는 쿼리**였다. 데이터 크기가 아니라 왕복 횟수가 문제다.

### 2.2 왜 Worker에서 더 느렸나, 그리고 왜 배치 고정은 효과가 없었다

- Cloudflare 문서: "If your Worker makes **multiple sequential queries** per request, use Placement to run your Worker close to your database. Each query adds round-trip latency: **20-30ms from a distant region, or 1-3ms when placed nearby**. Multiple queries compound this difference."
  (<https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/>)
- Hyperdrive는 **연결 설정 7회 -> 1회**로 줄여 줄 뿐, **쿼리 왕복은 그대로**다. 풀은 DB 가까운 곳에 있고 쿼리는 여전히 싱가포르까지 왕복한다.
  (<https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/>)
- 같은 계산이 직접 연결 22초 / Worker 75초인 것은 왕복마다 붙는 지연이 커진 결과다. **왕복 횟수를 줄이면 Worker 지연도 같이 줄어든다.**

#### 배치(`placement`) 실험 — 효과가 없었다

| 설정 | `/therapist` | `/therapist/payout` |
| --- | --- | --- |
| `mode: "smart"` (현재) | 7.9-10.0초 | 9.8-14.0초 |
| `mode: "targeted", host: "<DB>:5432"` | 10.2초 | 10.8초 |
| `mode: "targeted", region: "aws:ap-southeast-1"` | 7.9초 | 10.6초 |

세 설정이 사실상 같다. 원인은 두 가지로 보인다.

1. `host` 지정은 **TCP 배치**라 Worker가 옮겨 가는 게 아니라 그 호스트로의 연결 경로만 지정한다.
   `region` 지정도 프리뷰 버전에서는 측정할 만큼 이득이 없었다.
2. 더 중요한 것은 **쿼리 왕복보다 PlanetScale 왕복 비용이 크다**는 점이다. `SELECT 1` 하나가 66ms인 것은
   왕복 + PlanetScale 라우팅 비용이다. 쿼리 수를 47개로 줄인 뒤에도 10초가 남은 것은 남은 47회 왕복 비용이다.
   즉 **배치보다 쿼리 수가 더 큰 레버**였고, 실제로 쿼리 수를 줄여 75초 -> 10초를 만들었다.

운영 배포에 `placement`를 바꿀 필요성은 현재 없지만, 나중에 쿼리 수를 더 줄이고도 지연이 남으면 그때 검토할 항목이다.

---

## 3. 코드 경로

```
/therapist/payout
 └ getTherapistPayoutView                    src/modules/therapists/therapist-payout-view-service.ts
    ├ getMonthlyStatement                     src/modules/closing/monthly-statement-service.ts
    │   └ listMonthlyClosingPreview           (27쿼리, 1.9초) — 월 집계·만근·콜킹
    │   └ buildDraftDailyEntries              ← 병목
    │       └ 하루씩: listTherapistDailySettlements + listTherapistAttendanceForDate (31회)
    └ listMonthlyClosingPreview (두 번째 호출) — 콜킹 기준선만 얻으려고 다시 계산
```

### 3.1 병목 1: 한 직원의 명세서를 위해 그날 **전체** 직원을 다시 계산

`buildDraftDailyEntries`(monthly-statement-service.ts)는 운영월의 날짜를 하루씩 돌며
`listTherapistDailySettlements`와 `listTherapistAttendanceForDate`를 부른다. 두 함수 모두
**그날의 모든 활성 Therapist**를 계산해 돌려주고, 이 함수는 그중 한 명만 고른다.
즉 50명 중 1명의 명세서를 보면서 50명분을 31일치 다시 계산했다.

### 3.2 병목 2: 달 안에서 바뀌지 않는 값을 날짜마다 다시 읽음

`listTherapistDailySettlements`가 날짜마다 `operating_months`(1회)와 `employees`(1회)를 다시 읽는다.
31일 × 2 = 62번의 왕복이 달마다 반복된다.

### 3.3 병목 3: 같은 달의 마감 미리보기를 두 번 계산

`getMonthlyStatement`이 미리보기를 한 번 계산하고, `therapist-payout-view-service`가 콜킹 기준선
때문에 **같은 달을 다시** 계산한다(27쿼리).

### 3.4 곁 발견: 명세서가 빈 줄로 가득 찬다

`listTherapistAttendanceForDate`는 출퇴근 기록이 없어도 **활성 Therapist 전원을 행으로** 돌려준다.
그래서 `if (!settlement && !attendance) continue`가 사실상 동작하지 않아, 활동이 전혀 없는 Therapist도
31일치 빈 줄(금액 0)을 그대로 갖는다. 2026-10 화면에서도 콜이 한 번도 없는 계정이 31줄을 보였다.
계산 결과의 숫자는 문제가 없고, **아무 정보 없는 줄**이 많다는 뜻이다.

---

## 4. 이번에 고친 것 (구현 완료)

작업지시서(`.scratch/therapist-accounts/payout-speed-work-order.md`) 기준.

1. **Therapist 날짜별 근거를 운영월 1회 읽기로** (`monthly-statement-service.ts`)
   - `listTherapistDailySettlementsForOperatingMonth` + `listPayoutConfirmationHistoriesByDate` + 이 직원의 출퇴근 범위 조회.
   - 계산식·금액·근거 항목은 그대로. **근거가 있는 날만** 줄을 만든다(빈 31줄 사라짐).
   - 비활성 직원은 출퇴근 범위 조회를 부르지 않는다(그 조회는 비활성 직원에 거절한다).
2. **달 안에서 바뀌지 않는 값 재사용** (`therapist-daily-settlement-service.ts`)
   - `listTherapistDailySettlementsForOperatingMonth`가 운영월·Therapist 목록을 한 번만 읽고 날짜별로 넘긴다.
   - 대시보드·월마감 경로도 함께 빨라진다(같은 함수를 쓴다).
3. **콜킹 기준선을 명세서가 담아 오게** (`monthly-statement-service.ts` → `MonthlyStatementDto.rankBaseline`)
   - `getTherapistPayoutView`는 `statement.rankBaseline`만 쓴다. 두 번째 미리보기·스냅샷 호출이 사라졌다.
4. **기다리는 동안 화면 표시** (`src/app/therapist/payout/loading.tsx`)
   - Next.js App Router의 `loading.tsx`는 페이지를 Suspense로 감싸 계산 중 뼈대를 먼저 그린다.
     (<https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming>)

### 4.1 숫자가 같은지 확인한 방법

운영 DB(2026-10, Therapist 4명)를 **이전 방식과 새 방식으로 각각 계산**해 날짜별로 항목을 그대로 비교했다.

```
7777     oldEntries=31 newEntries= 0 mismatch=0 | old 17210ms -> new 2965ms
THR-001  oldEntries=31 newEntries=18 mismatch=0 | old 16906ms -> new 5406ms
THR-002  oldEntries=31 newEntries= 2 mismatch=0 | old 19676ms -> new 2449ms
THR-003  oldEntries=31 newEntries=10 mismatch=0 | old 17430ms -> new 2557ms

총 124개 날짜 비교, 불일치 0건
```

- 금액·콜 근거·적용 정책·지급 확인 상태가 모두 동일했다.
- 차이는 "이전 방식에만 있던 빈 줄"(금액 0, 근거 없음)뿐이다.

### 4.2 테스트

- `pnpm test:unit` 1225개 통과 / `npx tsc --noEmit` 오류 없음.
- 추가한 테스트: (a) Therapist 초안 경로가 날짜 단위 정산·출퇴근을 **0번** 부르고 월 단위를 **1번** 부른다,
  (b) 근거가 없는 날은 줄이 없다, (c) 수당 뷰가 미리보기·스냅샷을 다시 부르지 않는다.

---

## 5. 서버 쪽 검토 (아키텍처)

### 5.1 Cloudflare Workers 배치 — 가장 큰 남은 레버

- `placement: { mode: "smart" }` → `placement: { region: "aws:ap-southeast-1" }`로 바꾸면 쿼리 왕복이
  "20-30ms from a distant region" → "1-3ms when placed nearby"로 내려간다.
  (<https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/>)
- DB가 싱가포르(`aws-ap-southeast-1.pg.psdb.cloud`)이므로 같은 리전이다. **코드 변경 없이** 모든 화면의 DB 지연이 줄어든다.
- 남는 위험: 사용자가 한국에서 보면 Worker 실행 위치가 멀어진다. 하지만 지배적인 비용이 DB 왕복이므로 총합은 줄어든다.
  → 프리뷰에서 먼저 재서(§6) 보고 운영 반영 여부를 결정하는 게 맞다.

### 5.2 Prisma 클라이언트 수명

- 현재 `src/lib/prisma.ts`는 요청 컨텍스트(`ctx`)마다 클라이언트를 새로 만든다(Worker에서는 권장 방식과 일치).
  다만 `maxUses: 100`, `idleTimeoutMillis: 5s`는 "Worker 안에서 클라이언트를 모듈 스코프에 두지 말라"는 Cloudflare/OpenNext 권고와 어긋난다.
  (<https://developers.cloudflare.com/hyperdrive/concepts/connection-lifecycle/>)
- 이 설정은 왕복 횟수를 줄이지 않는다. **오래된 연결로 인한 하드 에러를 막는 안전장치**로만 볼 만하다.

### 5.3 Hyperdrive 쿼리 캐시는 이 경로에 도움이 안 된다

- Hyperdrive의 쿼리 캐시는 기본 켜짐(`max_age` 60초, `stale_while_revalidate` 15초)이지만,
  **PostgreSQL에서 IMMUTABLE 함수만 캐시 대상**이고 `NOW()`·`CURRENT_DATE` 등 STABLE 함수를 쓰면 캐시되지 않는다.
  (<https://developers.cloudflare.com/hyperdrive/concepts/query-caching/>)
- 월 정산 쿼리는 현재 시각·오늘 날짜를 쓰므로 캐시 적중률이 낮다. 또한 **쓰기 시 캐시 무효화가 없다**(max_age까지 낡은 값이 나올 수 있다).
  → 금액 화면에 캐시를 걸면 "오래된 금액"을 보여줄 위험이 있다. **쓰지 않는 쪽이 맞다.**
- 참고로 캐시를 끄는 방법이 필요하면 `--caching-disabled` 설정 두 개를 함께 쓰는 방식이 문서에 적혀 있다.

### 5.4 Next.js 캐시

- Next 16의 `"use cache"`는 서버리스에서 **인스턴스 메모리 캐시**라 "Cache entries typically don't persist across requests".
  사용자별 캐시는 지원하지 않는다(`use cache: private`는 브라우저 전용).
  (<https://nextjs.org/docs/app/api-reference/directives/use-cache>)
- Prisma 조회는 `fetch`가 아니라 Next의 캐시 범위에 들어가지 않는다. → 이 경로의 해법이 아니다.
- `cacheComponents` + PPR은 "기다리는 동안 뼈대"에는 도움이 되지만, 계산 자체를 줄이지는 못한다(§4.4의 `loading.tsx`로 충분).

### 5.5 배치와 쿼리 수

- Prisma `$transaction([...])`는 **한 커넥션에서 순차 실행**된다(원자성이 목적이지 지연이 아니다).
  Hyperdrive는 트랜잭션 모드 풀러라 여러 작업을 한 트랜잭션에 담으면 커넥션을 붙잡는다.
  (<https://developers.cloudflare.com/hyperdrive/concepts/connection-pooling/>)
- 실질적인 지연 해소는 **set-based SQL**(IN 절·집계 쿼리)이다. 지금도 이미 콜 원장·배정은 월 단위 `IN` 조회로 읽고 있다.
  (`listServiceCallsForOperatingMonth` 9쿼리)
- `$queryRaw`를 쓰려면 Hyperdrive가 지원하지 않는 `PREPARE`/`EXECUTE`를 쓰지 않도록 해야 한다.
  (<https://developers.cloudflare.com/hyperdrive/reference/supported-databases-and-features/>)

### 5.6 규모가 더 커질 때(집계 테이블 + 백그라운드 재계산)

지금 구조는 "요청이 오면 그 달을 다시 계산"이다. 콜이 늘어날수록 같은 비용이 반복된다.
정답이 아니라 **3단계 구조**다.

1. 요청 경로: 미리 계산된 집계 행 1~2개만 읽는다(수 ms).
2. 집계는 **마감·일 종료 시점**에 한 번 계산해 저장한다(집계 테이블 + 마이그레이션).
3. 재계산이 필요하면 백그라운드(Cron Trigger 15분, Queues, Workflows)로 돌리고, 요청은 마지막 완료 결과를 읽는다.
   (<https://developers.cloudflare.com/queues/>)

금액·만근·콜킹 계산식을 바꾸지 않으면서 **지연만** 제거하는 구조다. 다만 저장 스키마를 추가하고
"집계가 언제까지 최신인가"를 화면에 말할 규칙이 필요해진다. 지금 단계(월 1,387콜)에서는 과한 설계다.

### 5.7 읽기 복제본은 지금은 쓰지 않는다

PlanetScale의 read replica은 비동기 지연이 있어 "지금 계산 중(미확정)" 금액에 쓰면 어긋난다.
Hyperdrive를 경유한 복제본 경로도 공식 지원이 없다.
(<https://developers.cloudflare.com/hyperdrive/reference/faq/>)

---

## 6. 남은 느린 경로와 다음 순서

프리뷰에서 관리자 세션으로 실측(Worker 경유, 2026-10-20). "이전"은 perf 이전 버전 `b7c11a6a`, "이후"는 `8afb3f82`.

| 화면 | 이전 | 이후 |
| --- | --- | --- |
| `/therapist` (오늘) | 8.5초 | 10.0초 (변화 없음) |
| `/therapist/payout` (수당) | **74.2초** | **9.2-14.0초** |
| `/therapist/attendance` (근태) | 3.1초 | 3.9초 |
| `/settlements/statement` (월 명세서) | 3.5초 | 2.0초 |
| `/dashboard/monthly` | 3.4초 | 2.7초 |
| `/closing` | 7.4초 | 10.6초 (변화 없음, 측정 편차) |
| `/settlements/therapist-overview` (티켓 11) | 16.6초 | **15.2초** |

다음 순서 제안:

1. **Therapist 현황(티켓 11) 15.2초 — 지금 제일 느린 화면.** 그날 전체 Therapist의 출퇴근을 날짜마다 다시 읽는
   같은 패턴이 남아 있다. 직원 단위 범위 조회로 바꾸면 이번과 같은 방식으로 줄일 수 있다(4장).
2. **월 명세서의 운영팀(OPERATIONS) 분기** — 하루 루프(`listOpsDailyIncentives`)가 남아 있다. 이번 작업지시서 범위 밖.
3. **마감 미리보기 내부의 남은 반복 읽기** — 미리보기가 `employees`를 6번, `operating_months`를 4번 읽는다(27쿼리).
   미리보기와 날짜별 근거가 그 달의 콜 행을 공유하면(작업지시서의 "공유" 제안) 9쿼리 정도를 더 줄일 수 있다.
4. **집계 테이블 + 백그라운드 재계산**(5.6절) — 규모가 커질 때.


## 7. 판단이 필요한 지점

- **빈 줄 사라짐**: 명세서·수당 탭에서 "근거가 없는 날"의 빈 줄이 사라진다(31줄 → 활동 있는 날만).
  숫자는 그대로지만 화면에 보이는 줄 수가 바뀐다. 명세서 화면은 정산 담당이 근거를 대조하는 자리라,
  "그날 아무것도 없었다"는 사실 자체를 보고 싶으면 되돌리거나 되살리기 표시를 넣는 선택지도 있다.
- **배치 리전 고정**: `placement`를 리전 고정으로 바꾸면 운영 배포에도 영향이 있다(사용자 승인 필요).
- **집계 테이블**: 스키마를 더하는 작업이라 D29(운영 DB 적용은 사용자 확인 뒤)를 따른다.

---

## 8. 배포·작업 기록

- 프리뷰 배포: `wrangler versions upload --preview-alias app-expansion`
  - 버전 `7db840dd`(perf 적용), `54f7d47e`(배치 host 실험), `3e679c72`(배치 region 실험), **`8afb3f82`(최종, 태그 `therapist-perf-final`)**
  - 운영 트래픽은 `bff7cf91` 100% 그대로. main 병합·운영 배포·운영 DB 쓰기 없음.
- 숫자 동일성 재검증(현재 워킹트리 기준): 운영 DB 2026-10, Therapist 4명, 이전 방식과 새 방식의 날짜별 항목 비교 → **124개 날짜, 불일치 0건**.
  (`7777` 31줄→0줄, `THR-001` 31줄→18줄, `THR-002` 31줄→2줄, `THR-003` 31줄→10줄 / 각각 17-40초 → 2.4-3.2초)
- 테스트: `pnpm test:unit` 1228개 통과, `npx tsc --noEmit` 오류 없음.
- 이 워크트리의 같은 파일을 옆 세션도 같은 작업지시서로 작업 중이었다. 최종 워킹트리는 양쪽 내용이 합쳐진 상태이며,
  검증(단위 테스트·tsc·숫자 동일성)을 통과한 뒤 프리뷰에 올렸다. 작업 스냅샷은 `perf/payout-bulk-evidence-wip` 브랜치에 있다.
