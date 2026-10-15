# 31: 귀케어와 운영팀 지급 확인

**What to build:** 30의 지급 확인을 귀케어 일별 정산 행, 운영팀 일일 인센티브 행, 운영팀 월 인센티브 행에도 붙인다. 각 단위는 직군, 운영월, 날짜(월 인센티브는 운영월), 직원으로 구분한다. (스펙 F05, ADR 0004, 스토리 110, 123, V08)

**Blocked by:** 30

**Status:** done

- [x] 귀케어와 운영팀의 계산 결과가 이 작업 전과 같다.
- [x] 세 단위 모두 확인, 재확인, 해제, 지급 재확인 필요가 30과 같은 규칙으로 동작한다.
- [x] 마감확정이나 잠금 운영월에서는 쓸 수 없다.
- [x] 지급 확인 서비스 테스트와 각 정산 화면 E2E로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-31-payout-confirmation-earcare-and-operations`, `integration/app-expansion` bf565d0 위, 끝에 `integration/app-expansion`을 한 번 더 병합해 티켓 16·19·35 후속분까지 받았다).
- 그대로 재사용: `src/modules/settlements/payout-confirmation-service.ts`(변경 없음 — `unitType`에 `EARCARE_DAILY`/`OPS_DAILY`/`OPS_MONTHLY`가 이미 있었고 `OPS_MONTHLY`의 "날짜 없음" 규칙도 이미 구현돼 있었다). `payout-confirmation-form.tsx`의 `ConfirmPayoutButton`/`ReasonPayoutForm`은 `PayoutConfirmationActionState<T>`로 제네릭화해서 네 단위의 서로 다른 결과 DTO를 그대로 받게만 바꿨다(동작은 그대로).
- 새로 둔 공용 뷰: `payout-confirmation-panel.tsx`(`PayoutStatusIndicator`, `PayoutConfirmationPanel<T>`). 티켓 30이 `therapist-settlement-view.tsx`에 직접 그렸던 지급 확인 구역(상태/현재금액/마지막확인금액/차이, 확인·재확인·해제 폼, 이력 5건)을 그대로 옮겨 제네릭화한 것이다. Therapist 쪽은 이미 검증된 코드라 손대지 않았고, 새로 붙이는 세 화면(귀케어·운영팀 일일·운영팀 월)만 이 공용 컴포넌트를 쓴다.
- 세 서비스에 각각 더한 것(모두 같은 모양): `payoutConfirmation: PayoutConfirmationDto` 필드를 행 DTO에 추가, `attachPayoutConfirmations`(메모리 Prisma에 `payoutConfirmationEvent`가 없으면 전부 미확인으로 두는 방어 포함, 티켓 30과 같은 패턴), `confirm/reconfirm/release*Payout` 3개 서버 함수(활성+직군 일치 직원 확인 → 그 단위의 현재 계산값으로 generic 서비스 호출).
  - `earcare-daily-settlement-service.ts`: `confirmEarcareDailySettlementPayout` 등. 단위 (운영월, 날짜, 귀케어사).
  - `ops-daily-incentive-service.ts`: `confirmOpsDailyIncentivePayout` 등. 단위 (운영월, 날짜, 운영팀 직원).
  - `ops-monthly-incentive-service.ts`: `confirmOpsMonthlyIncentivePayout` 등. 단위 (운영월, 운영팀 직원), 날짜 없음(`serviceDate: null`로 generic 서비스에 넘긴다). 폼의 hidden `serviceDate` 자리는 빈 문자열을 넣고 액션이 읽지 않는다.
- 새 Prisma 마이그레이션 없음: 티켓 30의 `payout_confirmation_events` 표가 `unitType`을 평문 String 컬럼으로 두어 이미 네 단위 모두를 받는다.
- 결정과 가정:
  - **"담당 콜 없는 직원은 확인 거절"(티켓 30의 therapist 규칙)을 귀케어·운영팀에는 그대로 옮기지 않았다.** Therapist는 그날 배정된 콜이 없으면 행 자체가 없어서 "정산 대상 콜 없음"이 자연스러운 거절 이유였다. 귀케어·운영팀 일일/월은 활성 직원이면 근무상태와 무관하게 항상 행이 있고(제외 사유가 있는 0원도 유효한 계산 결과), 그 행에 지급 확인을 거는 것을 막을 스펙상 근거가 없었다. 그래서 확인/재확인 가드는 "활성이고 해당 직군"만 확인하고, 행이 없는 경우(이론상 거의 불가능 — 방어용)에만 "해당 날짜/월의 … 정산 대상을 찾을 수 없습니다"로 거절한다.
  - **지급 확인의 "현재 계산 금액"은 항상 그 단위의 계산값을 그대로 보인다** — 정책 없음 등으로 "근거 없음"을 보여야 하는 표/패널의 금액 표시(SettlementAmount, `근거 없음`)와는 다른 영역이다(ADR 0004·티켓 30의 기존 설계 그대로). 그래서 정책이 없어 지급액이 0인 상태에서도 지급 확인 구역에는 "현재 계산 금액: 0 VND"가 보인다. 기존 story-4-5 E2E의 "0 VND가 전혀 없어야 한다" 단언은 표/일일 인센 근거 구역까지만 보도록 범위를 좁혔다(지급 확인 구역 앞부분만 검사).
  - **운영팀 월 인센의 통합 쿼리 요청(티켓 32·33 대비)**: `listEarcareDailyPayoutConfirmationsForMonth`/`listOpsDailyPayoutConfirmationsForMonth`를 새로 두어, 운영월의 모든 날짜를 돌며 날짜·직원별 지급 확인 상태를 모아 돌려준다(월 명세서·마감 점검의 "지급 재확인 미처리" 집계용). 운영팀 월 인센은 단위 자체가 이미 운영월이라 `listOpsMonthlyIncentivePreview`의 행이 같은 역할을 한다. **Therapist 쪽 동급 함수는 만들지 않았다** — `therapist-daily-settlement-service.ts`는 티켓 30의 파일이고 이미 통합 브랜치에 병합되어 있어, 이번 티켓(귀케어·운영팀) 범위를 벗어난다고 판단했다. 티켓 32나 33을 시작하는 쪽이 같은 패턴(`listTherapistDailyPayoutConfirmationsForMonth`)으로 추가해야 한다.
  - 재확인은 상태가 "확인됨"(금액 재확정 포함)/"지급 재확인 필요"/"확인 금액 미기록"일 때 허용하고, 해제도 같은 조건(활성 확인이 있을 때만)으로 허용한다 — 티켓 30과 동일 규칙.
- 영향받지 않게 지킨 것: 세 서비스의 계산 로직(풀 분배, 인센 threshold, 팀 분배)은 한 줄도 바꾸지 않았다(새 필드 추가와 행 생성 뒤 확인 상태를 붙이는 한 단계만 추가). `monthly-closing-preview-service.ts`/`dashboard-query-service.ts`/migration 대조 테스트(`migration-calculation-comparison.test.ts`)가 쓰는 메모리 Prisma는 `payoutConfirmationEvent`가 없어도(모두 `as any`로 타입을 비켜가거나 방어 분기로) 그대로 통과한다.
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 730개 전부 통과(새 테스트: 귀케어/운영팀 일일/운영팀 월 각각 확인·재확인·해제 테스트 + 월 단위 조회 함수 테스트 4건 + 뷰 테스트 수정 1건).
  - `pnpm lint`는 `&&` 사슬이라 기존 실패 4-6에서 멈추므로, `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`로 전부 개별 실행했다 — `validate-story-4-6.mjs`만 기존 실패(`service-call-service.ts`의 `serviceDate: {` 요구, 이 티켓과 무관, 메모에도 있는 기존 문제)이고 나머지는 전부 통과(4-4·4-5도 이제 지급 확인 버튼이 생겼지만, 그 금지는 actions.ts/service 파일의 특정 문자열만 보는 것이라 걸리지 않았다).
  - `pnpm build` 통과.
  - E2E는 전용 DB `vietnam_aesthetic_t31`·포트 3131(컨테이너 `vietnam-shell-02-e2e`)에서, 바뀐 화면에 걸린 스펙만 돌렸다: `story-4-2`(therapist, 공용 폼 제네릭화 회귀 확인용) · `story-4-3`(귀케어 근무상태, 영향 없음 확인) · `story-4-4`(귀케어 일일정산) · `story-4-5`(운영팀 일일 인센) · `story-4-6`(운영팀 월인센) · `story-ticket-05-settlement-screens`. `--workers=2`에서 therapist 스펙의 시드 정리(`cleanupStoryCalls`)가 FK 위반으로 한 번 흔들렸는데(메모의 "병렬에서 흔들리고 직렬에서 통과" 기존 패턴과 일치, 내 변경과 무관한 공유 DB 레이스), `--workers=1` 직렬 재실행에서 34건 전부 통과했다.
  - 기존 story-4-4/4-5 E2E에 "지급 버튼이 전혀 없어야 한다"는 옛 단언(정산 전용 화면 시절 것)이 있어 내 변경으로 당연히 실패했다 — 그 줄을 지우고, story-4-2가 이미 가진 "확인→재확인→해제, 이력·처리자 확인" 테스트를 귀케어·운영팀 일일·운영팀 월(새로 추가) 세 스펙에 같은 모양으로 추가했다. 세 스펙의 시드 정리 함수에 `payoutConfirmationEvent.deleteMany`도 더했다(운영월이 고정 monthKey로 upsert돼 재실행 때 이전 사건이 남으면 "미확인" 전제가 깨지기 때문).
- 범위 밖(다음 티켓에 넘김): Therapist의 월 단위 지급 확인 조회 함수(위 설명), 월 명세서 자체(티켓 32), 마감 점검의 "지급 재확인 미처리" 집계 화면(티켓 33).
