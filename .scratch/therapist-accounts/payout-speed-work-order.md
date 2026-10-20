# 직원 「수당」 탭 조회를 월 1회로 줄이는 작업지시서

상태: 구현 요청. 커밋·푸시·배포·운영 DB 쓰기는 하지 않는다.

## 작업 위치

- 저장소: `/home/noah/Desktop/project/dev_busi/vietnam_massage-preview-therapist`
- 브랜치: `preview/therapist-accounts` (HEAD `46bebd6`에서 시작)
- 이 워크트리에서만 고친다. `/home/noah/Desktop/project/dev_busi/vietnam_massage` 본 체크아웃은 고치지 않는다.
- 워크트리에 이미 있는 미추적 파일 `profile-queries.tmp.ts`, `prototype-fastpath.tmp.ts`는 그대로 둔다.

## 배경

직원 앱 하단 탭 「수당」(`/therapist/payout`)은 `getTherapistPayoutView`가 `getMonthlyStatement`를 부르고, 열린 달(작성중·검토중)에서 월마감 미리보기를 한 번 더 부른다.

2026-10 운영 원장(상태 `검토중`, 콜 560건, 활성 Therapist 51명)을 이 코드로 직접 재면 약 21초, Prisma 조회 373번이었다. 구간은 다음과 같다.

- `listMonthlyClosingPreview` 1회: 약 1.7초, 조회 약 20번
- `buildDraftDailyEntries`가 31일을 하루씩 `listTherapistDailySettlements`와 `listTherapistAttendanceForDate`로 다시 읽음: 약 17.2초, 조회 약 330번
- 콜킹 기준선만 얻으려고 `listMonthlyClosingPreview`를 다시 호출: 약 1.5초

화면 금액 식은 바꾸지 않는다. 이미 있는 월 단위 조회의 결과를 한 번만 쓴다. 집계 테이블, 마이그레이션, Hyperdrive 캐시, 미리보기에서 운영팀·현금·그래프를 빼는 작업은 이번 범위가 아니다.

## 1. Therapist 날짜별 근거를 월 1회로

파일: `src/modules/closing/monthly-statement-service.ts`의 `buildDraftDailyEntries`.

THERAPIST 분기만 바꾼다. OPERATIONS 분기의 `listOpsDailyIncentives` 하루 루프는 그대로 둔다.

지금 THERAPIST 분기는 운영월의 날짜마다 다음을 부른다.

- `listTherapistDailySettlements` (그 직원 행만 고르기 전에 그날 콜 원장 전체를 읽음)
- `listTherapistAttendanceForDate` (활성 Therapist 전원과 사용중 콜을 읽음. 수당 탭은 출퇴근 문구를 그리지 않지만, 월 명세서 화면은 `attendanceSummary`를 쓴다)

바꿀 조회는 운영월당 각 1회다.

1. `listTherapistDailySettlementsForOperatingMonth` (`src/modules/settlements/therapist-daily-settlement-service.ts`). 이 함수는 `skipPayoutReads: true`라 완료 콜이 없는 지급 확인 행을 만들지 않는다.
2. `listPayoutConfirmationHistoriesByDate` (`src/modules/settlements/payout-confirmation-service.ts`), `unitType: "THERAPIST_DAILY"`, 같은 운영월·날짜 범위.
3. 이 직원의 `therapistAttendance`를 날짜 범위로 `findMany` 한 번. `listTherapistAttendanceForDate`를 날짜마다 부르지 않는다. `listTherapistAttendanceForEmployeeInRange`는 비활성 Therapist에게 `THERAPIST_EMPLOYEE_NOT_FOUND`를 던지므로 그대로 쓰지 않는다. 출퇴근이 없으면 예외 없이 빈 결과다.

날짜 항목을 만드는 규칙은 지금 루프와 같게 유지한다.

- 날짜는 오름차순이다.
- 이 직원의 정산 행도 없고, 출근 시각이 있는 출퇴근 행도 없고, 해제되지 않은 지급 확인 이력도 없으면 그 날은 넣지 않는다.
- 금액은 정산 행의 `totalCommissionAmount`다. 정산 행이 없으면 0이다.
- `calls`와 `appliedPolicies`는 정산 행의 `assignmentEvidence`다. 없으면 빈 배열이다.
- `attendanceSummary`는 기존 `therapistAttendanceSummary`와 같다. 출근 시각이 있을 때만 `시작–종료`이고, 퇴근이 없으면 `퇴근 미기록`이다. 출근이 없으면 null이다.
- 지급 확인은 `derivePayoutConfirmationStatus(이력, 금액, 운영월 상태)`다. `listTherapistDailyPayoutConfirmationsForMonth`가 정산 행과 이력을 합치는 방식과 같다. 완료 콜이 없어도 해제되지 않은 확인 이력이 있으면 금액 0인 항목을 남긴다. 최신이 `release`이고 정산 행과 출근이 없으면 그 날은 빠진다. 출근만 있는 날의 `payoutConfirmation`은 null이다.
- 다른 직원의 행은 명세서에 넣지 않는다.

`MonthlyStatementDependencies`에 월 단위 함수를 추가하고 기본값은 실제 함수로 둔다. 기존 하루 단위 의존성은 운영팀 분기가 쓰면 남긴다. THERAPIST 초안 경로에서는 하루 단위 정산·출퇴근 함수를 부르지 않는다.

`getMonthlyStatement`가 이미 `listMonthlyClosingPreview` 안에서 한 달 콜을 읽는다. 날짜별 근거용 월 정산을 그 미리보기와 콜 행을 공유하도록 이어도 된다. 미리보기가 돌려주는 금액, 순위, 만근, 콜킹은 바꾸지 않는다. 공유가 의존성 주입이나 테스트를 흐리면 월 정산을 따로 한 번 더 부르는 쪽으로 둔다. 31번으로 되돌리지 않는다.

## 2. 콜킹 기준선을 이미 읽은 행에서 꺼내기

`getMonthlyStatement`는 초안이면 `listMonthlyClosingPreview`, 마감 버전이면 `getMonthlyClosingSnapshotByVersion`의 Therapist 행을 이미 갖고 있다. 그 행으로 기준선을 만들어 `MonthlyStatementDto`에 담는다.

```ts
rankBaseline: Array<{ rank: 1 | 2 | 3; callCount: number }>
```

규칙은 `therapist-payout-view-service.ts`의 `rankBaselineOf`와 같다. `countKingRank`가 1·2·3인 행만, 순위 오름차순, `{ rank, callCount: totalCallCount }`. 다른 직원의 이름, staff code, employee id, 금액은 넣지 않는다.

`getTherapistPayoutView`는 `statement.rankBaseline`만 쓴다. `therapistRankingRows`와 그 안의 두 번째 `listMonthlyClosingPreview`, 두 번째 `getMonthlyClosingSnapshotByVersion` 호출은 제거한다. 수당 DTO의 다른 필드는 그대로다. 함께한 Therapist 이름을 `calls`에 넣지 않는 기존 동작도 그대로다.

## 테스트

운영 DB에는 붙지 않는다. 워크트리에서 다음만 실행한다.

```bash
cd /home/noah/Desktop/project/dev_busi/vietnam_massage-preview-therapist
pnpm exec node --import tsx --test \
  src/modules/closing/monthly-statement-service.test.ts \
  src/modules/therapists/therapist-payout-view-service.test.ts
```

맞춰야 하는 기존 결과:

- 초안 Therapist 명세서: 2026-06-01 한 줄, `attendanceSummary` `09:00–18:00`, 콜 `call-a`, 지급 확인 `confirmed`, `finalAmount` 3600000. 날짜마다 정산·출퇴근을 부르지 않고도 이 값이 나와야 한다.
- 작성중·검토중은 버전이 있어도 미확정 지금 계산이 기본이다.
- 마감확정·잠금은 스냅샷이 없으면 `MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND`다.
- 수당 뷰의 미확정·마감·기준선 없음 결과는 지금 테스트와 같다. 기준선은 명세서의 `rankBaseline`에서 오고, 미리보기·스냅샷 조회 함수는 호출 횟수 0이다. 응답 JSON에 다른 Therapist 이름과 employee id가 없다.

추가한다.

- 운영월이 여러 날이어도 Therapist 초안 경로는 월 정산 조회를 1회만 부르고, `listTherapistDailySettlements`와 `listTherapistAttendanceForDate`는 0회다.
- 완료 콜 없이 해제되지 않은 지급 확인만 있는 날은 금액 0으로 남고, 출근만 있는 날은 금액 0·콜 빈 배열·지급 확인 null이다.

## 완료 보고

구현이 끝나면 아래 대상으로 결과만 보낸다.

```bash
herdr agent prompt wQ:p25 "<보고>"
```

보고에 넣을 것: 고친 파일, 테스트 명령과 통과·실패, 월 1회로 바꾸지 못한 조회가 있으면 그 이유. 커밋 해시는 만들지 않았으므로 적지 않는다.

## 하지 말 것

- 커밋, 푸시, 배포, 프리뷰 업로드, 운영 DB 조회·수정, 시드
- 만근·콜킹·코스 수당 계산식 변경
- 운영팀 하루 루프 변경
- 월마감 미리보기에서 운영팀·현금·그래프를 빼는 일
- 집계 테이블이나 마이그레이션
- 본 체크아웃 `vietnam_massage` 수정
- 기존 미추적 tmp 파일 삭제
