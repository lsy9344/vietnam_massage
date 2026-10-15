# 33: 마감 점검 목록과 확정 차단

**What to build:** 월마감 화면을 01의 골격과 마감 시안을 기준으로 마감 전 점검 → 문제 원본 확인 → 확정의 순서로 다시 구성한다. 점검은 네 가지를 나눠 보여 준다: 계산 오류(방문완료 콜 중 코스 정책 없음, Therapist 수당 없음, 두 번째 Therapist 필요), 지급 재확인 미처리, 마감 확인 대상 콜(예약·사용중·청소중), 금액 확인(결제수단별 합계, 지출, 현금 잔액, 계좌 잔액, 순매출). 계산 오류나 지급 재확인 미처리가 남아 있으면 서비스가 확정을 거절한다. 이 티켓에서 마감 확인 대상 콜은 목록으로만 보여 주며, 확인과 사유를 요구하는 것은 34에서 붙인다. (스펙 F07, ADR 0002, 스토리 124–126, 129, 132, V10 일부)

**Blocked by:** 31

**Status:** done

- [x] 서비스는 확정 트랜잭션 안에서 점검을 다시 계산하고, 계산 오류나 지급 재확인 미처리가 있으면 거절한다.
- [x] 기존 미리보기 경고(0원 정책, 만근 근거 없음, 운영팀 정책 없음 등)는 지금처럼 경고로 보이고 확정을 막지 않는다.
- [x] 금액은 콜 서비스의 기존 계산을 쓰고, 현금 잔액과 계좌 잔액이 순매출과 따로 나온다.
- [x] 방문완료, 취소, 노쇼 콜은 마감 확인 대상 목록에 나오지 않는다.
- [x] 점검 항목에서 원본으로 가는 동작은 역할을 따른다. 관리자는 원장의 콜 상세나 정산 화면으로 간다. 정산 담당은 콜 항목을 그 자리의 요약(날짜, 예약시각, 코스, Therapist, 상태, 계산 오류)으로 보고, 지급 항목은 정산 화면으로 간다.
- [x] 정산 담당에게 콜 쓰기 권한이나 원장 라우트가 생기지 않는다.
- [x] 월마감 서비스 테스트(시계 주입)와 E2E로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-33-closing-checklist-and-confirm-blocking`, `integration/app-expansion` d7cfe9f 위).
- 새 서비스 `src/modules/closing/monthly-closing-checklist-service.ts`(`listMonthlyClosingChecklist`): `monthly-closing-preview-service.ts`와 별개의 읽기 전용 서비스로 두었다. 미리보기 DTO를 확장하지 않은 이유는 그 DTO가 그대로 마감 스냅샷(`MonthlyClosingSnapshotDto`)에 저장되는 값이라, 점검 전용 필드를 섞으면 스냅샷 의미가 흐려지기 때문이다. `confirmMonthlyClose`가 트랜잭션 안에서 `listMonthlyClosingPreview`와 `listMonthlyClosingChecklist`를 둘 다 부르므로 하루당 질의가 두 배가 되지만(콜·지급 확인 재조회), 정확성을 우선했다.
  - `calculationErrorCalls`: `listServiceCallsForOperatingMonth`로 운영월 전체 행을 한 번 읽고, `방문완료`(또는 `VISIT_COMPLETE`) 상태이면서 `calculationStatus`가 코스 정책 없음·수당 없음·두 번째 Therapist 필요인 행만 추린다. 같은 계산 오류라도 결제수단을 먼저 고른 예약·사용중 콜(선결제)은 빠진다 — 스펙 문구("방문완료 콜 중")를 그대로 지켰다.
  - `payoutReconfirmationUnits`: 네 단위(`THERAPIST_DAILY`/`EARCARE_DAILY`/`OPS_DAILY`/`OPS_MONTHLY`) 각각에서 `payoutConfirmation.requiresReconfirmation`인 것만 모은다. 직원 표시 이름은 넣지 않았다(기존 "ForMonth" DTO들도 `employeeId`만 주므로, 명세도 "지급 항목은 정산 화면으로 연결한다"만 요구하고 항목별 이름 표시를 요구하지 않는다 — 가정).
  - `pendingCloseCalls`: 예약·사용중·청소중 상태만, 목록으로만(확인 체크박스·사유 입력 없음 — 34에서 붙인다).
  - `financials`: `getDailyCallLedgerSummary`를 날짜별로 불러 결제수단별 합계·지출·순매출을 합산하고, 현금/계좌 잔액은 `till.month`가 조회 날짜와 무관하게 운영월 전체 누적이라(`monthTillFor`) 날짜 하나에 `includeMonthTill: true`로 한 번만 더 불러 얻는다.
- `src/modules/settlements/therapist-daily-settlement-service.ts`에 `listTherapistDailyPayoutConfirmationsForMonth`를 새로 추가했다 — 티켓 31이 귀케어·운영팀 일일에 만들어 둔 "ForMonth" 함수와 같은 모양이다(31의 Comments가 "Therapist 쪽은 32·33이 추가해야 한다"고 남겨 둔 바로 그 함수). 이 파일의 기존 관례(plain `Error`, 전용 Domain error 클래스 없음)를 그대로 따랐다.
- `monthly-closing-service.ts`의 `confirmMonthlyClose`: `검토중` 상태·미리보기 확인 뒤, 트랜잭션 안에서 체크리스트를 다시 계산해 계산 오류나 지급 재확인 미처리가 있으면 각각 `MONTHLY_CLOSE_CALCULATION_ERRORS_PENDING`/`MONTHLY_CLOSE_PAYOUT_RECONFIRMATION_PENDING`으로 거절한다(스냅샷 생성·상태 변경·감사 기록 전에 검사하므로 거절 시 아무것도 쓰지 않는다). 마감 확인 대상 콜(`pendingCloseCalls`)은 이 티켓에서는 확정을 막지 않는다 — 34가 "확인 목록 + 사유" 요구를 더할 자리다. 두 새 code는 기존 `MONTHLY_CLOSE_*` code들과 같은 관례로 `DOMAIN_ERROR_VI`에 넣지 않고 한국어 fallback만 둔다(그 맵의 주석대로 마감/정산 전용 code는 의도적으로 vi 번역을 생략한다).
  - `MonthlyClosingDependencies`에 `listMonthlyClosingChecklist`를 추가하면서 `input.dependencies ?? defaultDependencies`를 `{ ...defaultDependencies, ...input.dependencies }`로 고쳤다 — 기존 코드는 `dependencies`를 하나라도 주면 통째로 교체해서, 새 의존성 하나를 추가하는 순간 기존 테스트들이 `listMonthlyClosingChecklist`를 못 찾아 깨졌을 것이다. `monthly-closing-preview-service.ts`는 이미 spread 방식이라 그쪽에 맞췄다.
- 화면(`src/app/(erp)/closing/`): `page.tsx`에 "마감 전 점검" 구역을 `ClosingStepper`/`ClosingActionPanel` 바로 아래, 기존 Snapshot/Summary/Therapist/Operations/Earcare 표(→ "문제 원본 확인" 상세) 위에 추가해 순서를 지켰다. 네 항목을 모두 보여 주되, 시안(`14-closing.png`)의 픽셀 단위 재구성은 하지 않았다 — 체크리스트 우선순위(점검 → 원본 확인 → 확정)만 지키고 기존 표·패널 스타일(`PanelSection`, `StatusIndicator`, `EvidenceCallItem`)을 그대로 재사용했다. 콜 항목은 `settlementEvidenceCall`의 DTO 모양(serviceCallId/operatingMonthId/serviceDate/startTime/courseCode/therapistNames/status)에 `calculationStatus`만 얹어서, 기존 `EvidenceCallItem`을 코드 수정 없이 그대로 썼다(관리자=원장 링크, 정산 담당=그 자리 요약은 이미 그 컴포넌트가 하던 일). 지급 재확인 항목은 단위 타입별로 묶어 건수+정산 화면 링크만 보여준다(직원별 행까지는 펼치지 않음 — 위 가정과 같은 이유).
  - `ClosingActionPanel`에 `checklistBlocked` prop을 추가해 `canConfirm`을 더 좁히고(계산 오류·지급 재확인 미처리가 있으면 버튼 disabled), 안내 문구로 `closing.checklist.blockedNotice`를 재사용했다. 실제 차단은 서버(`confirmMonthlyClose`)가 하므로 이 UI 비활성화는 사용자 안내일 뿐이다(V12처럼 서버 액션을 직접 불러도 서버가 막는다).
  - 새 ko/vi 메시지 키 20개(`closing.checklist.*`)를 추가했다. 금액 관련 라벨(결제수단별 합계/현금/카드/계좌/기타/지출합계/현금 잔액/계좌 잔액/순매출)은 이미 있는 `calls.cashbook.paymentMethods`/`calls.summary.*` 키를 그대로 재사용했다(중복 문구를 새로 만들지 않음).
- 영향받지 않게 지킨 것: `listMonthlyClosingPreview`, 기존 지급 확인 서비스들의 계산 로직, `confirmMonthlyClose`의 기존 전이·스냅샷·감사 규칙은 한 줄도 바꾸지 않았다. 새 permission이나 라우트는 추가하지 않았다(정산 담당은 여전히 `closing:write`만, 콜 쓰기·원장 라우트 없음).
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 775개 전부 통과(새 테스트: `monthly-closing-checklist-service.test.ts` 7건, `monthly-closing-service.test.ts`에 차단 테스트 3건 추가, `therapist-daily-settlement-service.test.ts`에 `listTherapistDailyPayoutConfirmationsForMonth` 테스트 2건 추가).
  - `for f in scripts/validate-story-*.mjs; do node "$f" ...; done` 전부 통과, 기존 실패 `validate-story-4-6.mjs`만 그대로(이 티켓과 무관).
  - `pnpm build` 통과.
  - E2E는 전용 DB `vietnam_aesthetic_t33`·포트 3133(컨테이너 `vietnam-shell-02-e2e`)에서 돌렸다. 기존 스펙 `story-5-1-monthly-closing-preview`(4건 통과) · `story-5-2-monthly-closing-bonuses`(1건은 메모의 상시 기존 실패 `story-5-2:300` — 다른 staffCode의 콜왕 행 두 개가 같은 필터에 걸리는 strict-mode 위반, 이 티켓과 무관, 재시도 안 함. 나머지 통과). 새 스펙 `story-ticket-33-closing-checklist.spec.ts`(3건) 작성·통과: 정산 담당은 계산 오류 콜을 링크 없는 요약으로 보고 확정 버튼이 disabled, 관리자는 같은 항목을 원장 링크로 봄, 예약 콜만 있는 달은 확정이 정상적으로 성공(서버는 200·DB는 `마감확정`으로 반영되지만, 운영 빌드에서 가끔 화면 revalidate가 늦게 보이는 기존 환경 문제 때문에 이 확인은 DB 폴링으로 했다 — e2e-prod-known-failures 메모의 5-3/5-5/5-6과 같은 증상, 이 티켓의 버그가 아니다).
  - E2E 서버 PID만 띄우고 끔(`ss -ltnp`로 PID 확인 후 `kill`), 자기 DB(`vietnam_aesthetic_t33`)에만 DROP/CREATE했다.
- 넘기는 것:
  - 34: `pendingCloseCalls` 목록에 체크박스(확인 대상 id 목록)와 사유 입력을 붙이고, `confirmMonthlyClose`가 "다시 계산한 목록이 확인한 목록과 다르면 거절"까지 검사하게 한다. 이 티켓은 목록만 돌려준다.
  - 32: 월 명세서는 `listTherapistDailyPayoutConfirmationsForMonth`를 그대로 쓸 수 있다(이번에 만든 함수).
  - 마감 시안(`14-closing.png`)의 "확인했습니다" 체크박스·사유 입력·우측 고정 합계 박스 같은 시각적 재구성은 손대지 않았다 — 기능 순서만 맞췄다.
