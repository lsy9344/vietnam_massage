# 30: 지급 확인 기반과 Therapist 일별 행

**What to build:** 새 지급 확인 서비스를 두고, 확인·재확인·해제를 금액·처리자·시각·사유가 있는 사건으로 쌓는다. 현재 상태(미확인, 확인됨, 지급 재확인 필요, 확인 금액 미기록)는 사건과 현재 계산 금액에서 도출한다. 현재 계산 금액은 기존 계산 서비스의 결과를 그대로 쓰고 계산식은 바꾸지 않는다. Therapist 일별 정산 행의 지급완료 표시를 이 지급 확인으로 바꾸고, 기존 지급완료 기록과 이력은 금액 없는 확인 사건으로 옮긴다. 귀케어와 운영팀은 31에서 붙인다. (스펙 F05, ADR 0004, 스토리 110–117, 122–123, V08)

**Blocked by:** 05

**Status:** done

- [x] Therapist 일별 계산 결과가 이 작업 전과 같다.
- [x] 확인 당시의 금액, 시각, 처리자가 기록된다.
- [x] 확인 뒤 출퇴근이나 완료 콜이 정정되어 금액이 달라지면 지급 재확인 필요와 함께 이전 금액, 현재 금액, 차이가 나온다.
- [x] 사유를 적고 재확인하면 현재 금액이 새 기준이 되고 표시가 사라지며, 이전 확인 기록은 남는다. 이후 금액이 또 바뀌면 다시 지급 재확인 필요가 된다.
- [x] 재확인과 해제에는 사유가 필수다.
- [x] 옮겨진 기존 지급완료는 "확인 금액 미기록"으로 보이고, 운영월이 작성중이나 검토중이면 지급 재확인 필요로 센다. 과거 확인 금액을 현재 계산값으로 채우지 않는다. 마이그레이션 전후 건수를 기록한다.
- [x] 마감확정이나 잠금 운영월에서는 사건을 쓸 수 없다. 기존 지급 잠금 검사를 쓴다.
- [x] 각 행에 계산 금액, 확인 상태, 마지막 확인 금액, 차이, 확인 이력 보기가 있다. 지급 확인이 송금처럼 보이지 않는다.
- [x] 관리자와 정산 담당만 쓸 수 있고, 다른 역할이 서버 액션을 직접 호출하면 거절된다.
- [x] 지급 확인 서비스 테스트(메모리 Prisma)와 E2E로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-30-payout-confirmation-foundation-therapist-rows`, `integration/app-expansion` b322927 위). 막는 티켓 05는 이미 통합 브랜치에 들어 있어 그대로 땄다.
- 서비스 경계(재사용 가능한 인터페이스, 티켓 31이 그대로 쓴다): `src/modules/settlements/payout-confirmation-service.ts`. `unitType`(`THERAPIST_DAILY`|`EARCARE_DAILY`|`OPS_DAILY`|`OPS_MONTHLY`, 월 단위는 `serviceDate: null`), `operatingMonthId`, `serviceDate`, `employeeId`로 단위를 가리킨다. 사건 종류는 `confirm`/`reconfirm`/`release`이고 각각 금액(월 미기록이면 null)·처리자·시각·사유를 가진다. `derivePayoutConfirmationStatus(history, currentAmount, operatingMonthStatus)`는 순수 함수로 상태(미확인/확인됨/지급 재확인 필요/확인 금액 미기록), 마지막 확인 금액, 차이, "지급 재확인 필요로 셀지"(`requiresReconfirmation`)를 돌려준다. `confirmPayoutConfirmation`/`reconfirmPayoutConfirmation`/`releasePayoutConfirmation`은 트랜잭션(Serializable, 재시도 3회) 안에서 운영월 잠금(`assertOperatingMonthPayoutWritable` 재사용)·날짜 범위·전이 규칙(미확인에만 confirm, 확인된 사건이 있어야 reconfirm/release)을 다시 확인하고 사건을 쌓는다. `listPayoutConfirmations`는 같은 단위의 여러 직원을 한 번에 읽는다(목록 화면 N+1 방지).
- 현재 계산 금액은 호출하는 쪽(직군별 계산 서비스)이 넘긴다. 이 서비스는 계산하지 않는다(ADR 0004). `therapist-daily-settlement-service.ts`는 `listTherapistDailySettlements`가 계산한 `totalCommissionAmount`를 그대로 넘기고, `TherapistDailySettlementDto.paymentStatus`를 지우고 `payoutConfirmation: PayoutConfirmationDto`로 바꿨다. 계산 필드(totalCallCount, totalCommissionAmount, courseBreakdown, assignmentEvidence, warningCounts)는 손대지 않았다(기존 계산 테스트 3건 그대로 통과).
- Therapist 쪽 새 서버 함수 3개(`confirmTherapistDailySettlementPayout`/`reconfirmTherapistDailySettlementPayout`/`releaseTherapistDailySettlementPayout`)가 옛 `setTherapistDailySettlementPayment`를 대체한다. 확인·재확인은 활성 THERAPIST인지, 그날 담당 콜(정산 대상)이 있는지 확인한 뒤 그 금액으로 사건을 쓴다. 해제는 담당 콜 여부와 무관하게 허용한다(잘못 이관된 확인을 정리할 수 있어야 해서, 옛 지급완료 해제와 같은 정책).
- 화면: `therapist-settlement-view.tsx`의 지급 섹션을 지급 확인 섹션으로 바꿨다. 네 상태 칩, 현재 계산 금액, 마지막 확인 금액, 차이(0이 아닐 때만), 확인/재확인/해제 폼(`payout-confirmation-form.tsx`, 재사용 가능한 공용 컴포넌트), 확인 이력(최대 5건, 토글 없이 항상 보임 — 옛 지급완료 패널과 같은 방식)을 보인다. "지급완료"/"지급" 대신 "지급 확인"/"확인"/"재확인"/"해제" 문구만 쓴다(design.md의 "지급확인≠송금" 금지선).
- 마이그레이션(`prisma/migrations/20261016300000_add_payout_confirmation_events/migration.sql`): 새 `payout_confirmation_events` 표를 만들고, 기존 `therapist_daily_settlement_payment_histories`의 각 변경(처리자·시각 그대로, 금액 null)을 `new_is_paid=true→confirm`/`false→release`로 옮긴다. 이력이 없는 지급완료 행(이력 표 도입 전 데이터)은 결제 row 자체에서 보완 confirm 사건 하나를 만든다. 옛 두 표는 과거 기록 보존을 위해 그대로 둔다(드롭하지 않음, "보존"을 문자 그대로 지켰다). `DO $$...RAISE NOTICE$$`로 이전/이후 건수를 Postgres 로그에 남긴다.
  - 마이그레이션 전후 건수 확인(별도 스크래치 DB에 기존 payment+history 데이터를 수동으로 넣고 검증): payments_before=2, histories_before=3(한 명은 확인→해제→확인 3단계 이력, 한 명은 이력 없이 지급완료만), events_before=0 → events_after=4(이력에서 3건 + payment 보완 1건). 결과 행의 event_type·amount(모두 null)·actor_account_id·occurred_at이 원본과 일치함을 직접 쿼리로 확인했다.
  - 실제 운영 전환 때는 이 마이그레이션이 운영 DB에 적용되며 같은 로그가 남는다. 이번 작업에서는 빈 DB(`vietnam_aesthetic_t30`)에 적용해 스키마만 확인했고(0→0), 실제 레거시 데이터가 있는 DB에서의 건수는 적용 시점에 Postgres 로그의 RAISE NOTICE로 남는다.
- 결정과 가정:
  - "지급 재확인 필요로 센다"는 행의 상태 라벨 자체가 아니라 별도 `requiresReconfirmation` 불리언으로 뒀다. 확인 금액 미기록 행은 상태 라벨이 항상 "확인 금액 미기록"이고, `requiresReconfirmation`만 운영월이 작성중/검토중일 때 true다(마감확정·잠금에서는 false — 더 손댈 수 없으니 재확인 필요로 셀 의미가 없다고 판단). 이 불리언은 이번 티켓에서 화면에 직접 쓰지 않았고(나중 마감 점검 티켓 33이 집계에 쓸 자리), 서비스 테스트로만 확인했다.
  - 재확인은 상태가 "확인됨"/"지급 재확인 필요"/"확인 금액 미기록"일 때(즉 활성 확인이 있을 때) 허용했다. "확인됨"에서도 재확인을 허용한 것은 사유를 적고 금액을 다시 확정하고 싶은 경우(예: 확인 금액 미기록을 금액 있는 확인으로 바꾸는 경우도 이 경로)를 위해서다. 해제도 같은 조건(활성 확인이 있을 때만)으로 허용했다.
  - 해제 뒤에는 바로 미확인으로 돌아간다(이전 확인 금액을 보이지 않음). 다시 확인하면 그 시점 계산 금액이 새 사건이 된다.
  - 재확인/해제 사유는 "필수"만 강제했고(trim 뒤 비어있지 않음, 500자 이하) 월마감 재오픈의 5자 이상 같은 별도 최소 길이는 두지 않았다(스펙에 없음).
  - 트랜잭션은 therapist 특화 검사(활성 THERAPIST, 담당 콜 존재)와 생성형 서비스의 잠금·전이 검사를 하나로 묶지 않았다(모듈 경계를 지키려 generic 서비스는 ServiceCall을 모른다). 그 사이 극히 짧은 창에서 레이스가 이론상 가능하지만(예: confirm 직전 콜이 취소됨), 기존 지급완료 코드도 같은 특성이었고 이번 티켓 범위를 넘는 완전한 단일 트랜잭션화는 하지 않았다.
  - 옛 `therapist_daily_settlement_payment`/`...History` 표와 그 쓰기 경로(서비스 함수, 서버 액션, 폼, i18n 키)는 모두 지웠다(지급완료 UI를 지급 확인으로 "대체"하라는 요구와 일치). 표 자체(과거 데이터)는 보존 요구에 따라 남겨 뒀다.
  - 티켓 31(귀케어·운영팀)은 `unitType`만 바꿔 같은 `payout-confirmation-service.ts`를 쓰면 된다. `payout-confirmation-form.tsx`(`ConfirmPayoutButton`/`ReasonPayoutForm`)도 재사용 가능한 공용 컴포넌트로 뒀다.
- 범위 밖(다음 티켓): 월 명세서(미확정/마감 버전, 인쇄)는 F05의 다른 절반이고 이 티켓에 없다. 마감 점검의 "지급 재확인 미처리" 집계(33)와 귀케어·운영팀 적용(31)도 범위 밖이다.
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 653개 전부 통과(새 `payout-confirmation-service.test.ts` 18건, `therapist-daily-settlement-service.test.ts` 재작성 포함).
  - `pnpm lint`는 `validate-story-4-2.mjs`를 새 파일/함수 이름에 맞춰 고쳤고, `validate-story-4-6`만 기존 실패(이 티켓과 무관, `service-call-service.ts`의 "serviceDate: {" 요구 — 메모에도 있는 기존 문제).
  - `pnpm build` 통과.
  - 마이그레이션은 전용 스크래치 DB에서 레거시 데이터로 데이터 이전 로직을 직접 검증했다(위 "마이그레이션 전후 건수" 참고).
  - E2E는 전용 DB `vietnam_aesthetic_t30`·포트 3130(컨테이너 `vietnam-shell-02-e2e`)에서, 바뀐 화면에 걸린 두 스펙만 돌렸다: `story-4-2-therapist-daily-settlement.spec.ts`(확인→재확인→해제 새 흐름 포함 4건), `story-ticket-05-settlement-screens.spec.ts`(4건). `--workers=2`로는 "정책 warning / 제외 콜 1건 / 1건" 1건이 흔들렸으나 `--workers=1` 직렬 재실행에서 두 스펙 8건 모두 통과했다(메모의 "병렬 실행에서 흔들리고 직렬에서는 통과" 기존 패턴과 일치, 이 티켓과 무관). 검증 뒤 서버 PID와 DB를 정리했다.
