# 통합 브랜치 코드 리뷰 결과 (integration/app-expansion 325a186, main 260a0c1 대비)

> 2026-10-16 후속 처리: S1–S12·T1–T8과 티켓 37–39를 모두 처리하고 통합했다. 아래는 당시 지적과 대기 목록의 원본이다. 현재 결정·검증·남은 기존 실패는 [후속 결과](../validation/REVIEW-2026-10-16.md)에 있다.

리뷰어가 파일·줄을 적었다. 줄 번호는 325a186 기준이다. 고치기 전에 지적이 맞는지 코드로 먼저 확인하고, 틀렸으면 고치지 말고 보고에 적는다.

## 꼭 고칠 것 (Spec)

S1. `src/modules/calls/service-call-service.ts:2147-2161` `autosaveServiceCallRow`의 `data`에 `visitRequest`가 없다(`writeServiceCallRow` 2040-2053에는 있다). 기존 행의 방문별 요청이 "저장됨"으로 보이면서 사라지고, 티켓 17 비교의 "내 값 쓰기"도 이 필드만 반영되지 않는다. 자동저장 경로 테스트를 더한다. 같은 종류의 누락(원장 필드 표 4벌 중 하나를 놓침)이 다른 필드에도 있는지 확인한다.
S2. 충돌 비교(`call-conflict-compare.tsx:315-324`)가 `ModalPanel`(포커스 가둠, 배경 aria-hidden)이라 한 행이 STALE_CALL이 되면 원장 전체가 막힌다. 스펙 321줄은 비교를 "콜 상세 패널의 충돌 상태"에, design.md 231-232는 SidePanel=비모달 작업면, ModalPanel=생성 흐름으로 나눈다 → 콜 상세 패널(SidePanel) 안의 충돌 구역으로 옮긴다. 티켓 17이 `tests/e2e/story-ticket-15-stale-save.spec.ts`에 끼워 넣은 "비교 닫기" 단계는 되돌린다.
S3. 빠른 예약 패널: 키보드만으로 끝까지 쓰기와 닫은 뒤 원장 원래 자리로 포커스 복귀(스토리 70)를 E2E로 확인한다. 특히 ConfirmDialog 확인 → 패널 닫힘(`quick-booking-panel.tsx:1106-1112`) 경로.
S4. 원장 보기(`editable-call-grid.tsx:94-127`): 스펙 F02 "예약시각, 고객/메모, 상태 열은 모든 보기에서 왼쪽에 고정한다" — 전체 보기에서도 이 세 열을 같은 순서로 맨 앞에 둔다(가로 sticky는 이 저장소에 전례가 없으므로 순서 고정으로 충분한지 design.md를 확인). 수납·정산 보기에 "할인"(`calls.column.discount`) 열을 넣는다. "드물게 쓰는 입력(확인 코드, 비고, 방문별 요청)과 경고 상세는 펼쳐서 본다"(스토리 97)를 구현한다 — 방문별 요청을 수납·정산 상시 열로 둔 것은 이 규칙에 맞춘다.
S5. 고객을 고른 상태(고객 화면 `visitCustomer=` 직접 진입, 빠른 예약 고객 선택 후)에서도 같은 연락처 경고가 보인다(스펙 F08·F01 단계 1). 지금은 검색 결과 안에서만 `sharedPhone`을 계산한다(`service-call-service.ts:2665-2678`).
S6. 최근 방문 선택(`service-call-service.ts:2541-2549`)이 `${serviceDate}T${startTime}` 문자열 비교라 자정 넘은 01:00 콜을 이전으로 본다 → 시간 슬롯 정렬 순서(`compareVisitHistory`와 같은 기준)를 쓴다. 이를 고정한 테스트(`service-call-service.test.ts:4712-4717`)를 고친다.
S7. 지급 확인 단위가 사라짐(ADR 0004): `therapist-daily-settlement-service.ts:399-430`은 그날 방문완료 콜이 있는 활성 Therapist만 행으로 만들고, 월 조회(533-539)도 그 행에서 파생한다. 확인 뒤 콜이 모두 취소/노쇼로 정정되거나 직원이 비활성되면 단위가 사라져 차이가 안 보이고 마감 점검(`monthly-closing-checklist-service.ts`)도 막지 않는다. 확인 사건이 있는 단위는 계산 행이 없어도 현재 금액 0으로 남아 "지급 재확인 필요"가 되게 한다. 귀케어·운영팀 단위도 같은 구조인지 확인한다.
S8. 근무표: `schedule-cell-form.tsx`의 비제어 `<select defaultValue>`가 지난주 복사 뒤 갱신되지 않아(`schedule-view.tsx:72` key가 날짜뿐) 그 줄을 저장하면 복사한 칸이 지워진다 → 고친다. 지난주 복사(`schedule-service.ts:429-436`)가 `impactedCalls`를 버린다 → 휴무가 된 칸의 영향 콜을 돌려주고 보여 준다. 같은 곳의 칸마다 순차 트랜잭션(최대 413회, 부분 실패 가능)을 한 트랜잭션으로 묶는다.
S9. 월 명세서(`monthly-statement-service.ts:466-478`, `statement/page.tsx:105`): 운영월 상태를 읽어 — 작성중·검토중(재오픈 포함)은 "미확정"과 현재 계산을 기본으로 보이고, 이전 마감 버전도 고를 수 있다. 마감확정·잠금인데 스냅샷이 없으면 현재 계산으로 내려가지 말고 `_bmad-output/project-context.md:190`대로 "확정 스냅샷을 찾을 수 없습니다"를 낸다. Therapist 명세서에 "적용 정책" 근거(코스 수당·0원 정책, V08)를 더한다. 화면의 계산 기준 재구현(`monthly-statement-view.tsx:33,47`의 40건·20일)을 서비스 결과로 바꾼다.
S10. 직원 비활성(`masters/employee-service.ts` `findFutureCalls`)의 "오늘"이 달력날(`businessTodayIsoDate`)이다. 스펙 226줄 "오늘은 지금이 들어 있는 영업일의 서비스 날짜다 … 00:30에도 전날 서비스 날짜가 오늘이다"에 맞춘다(테스트 `employee-service.test.ts:585` 수정). 같은 곳이 `serviceCall.findMany`로 원장을 직접 읽고 `NON_BLOCKING_CALL_STATUSES`를 복제한다(`src/modules/README.md` 방향 위반) → 콜 서비스의 질의 함수로 옮긴다.
S11. 베트남어: `monthly-statement-service.ts:229` "이 마감 버전에는 해당 근거가 저장되지 않았습니다."가 `src/lib/i18n/errors.ts`의 번역 맵에 없어 인쇄물에 한국어로 나온다. 마감 거절 code 4개(`MONTHLY_CLOSE_CALCULATION_ERRORS_PENDING` 등)가 `DOMAIN_ERROR_VI`에 없다.
S12. 마감 점검의 지급 재확인 항목 링크에 `serviceDate`가 없다(`closing/page.tsx:767`) → 정산 담당이 그 날짜로 가게 한다.

## 꼭 고칠 것 (Standards)

T1. 재오픈 문서: `src/modules/closing/README.md:76,78`, `docs/modules/closing.md:41`, `_bmad-output/project-context.md:137`이 아직 "잠금에서만 재오픈"이다 → 티켓 35 규칙으로 고친다.
T2. ADR 0004·0005를 코드가 25곳에서 인용하는데 브랜치에 없다 → 메인 폴더의 untracked 원본 `/home/noah/Desktop/project/dev_busi/vietnam_massage/docs/adr/0004-payout-confirmation-preserves-confirmed-amount.md`, `.../0005-close-unfinished-calls-with-recorded-reason.md`를 내용 그대로 브랜치에 더한다(메인 폴더 원본은 건드리지 않는다).
T3. 모듈 순환: `calls/service-call-service.ts:12` ↔ `settlements/schedule-service.ts:5`, `monthly-statement-service.ts` → closing → settlements. `src/modules/README.md`의 단방향 흐름에 맞게 끊는다(예: 근무 예정 조회를 의존 방향이 맞는 쪽으로 옮기거나 호출자가 넘기게). 큰 재구성이 필요하면 가장 작은 방법을 고르고 보고에 적는다.
T4. E2E 격리(`tests/e2e/support/README.md`): `story-ticket-27-schedule.spec.ts:126,151`의 `where` 없는 전역 `count()` 기준선, `:80,84`의 공용 `THR-001` 대상 조건 없는 `deleteMany`를 고친다. 이번 확장의 새 스펙들이 만든 직원을 끝나면 비활성화하는지 보고, 안 하면 더한다.
T5. 디자인 토큰(design.md): `payout-confirmation-form.tsx:80`, `closing-action-panel.tsx:287,299`(입력칸 `border-border`·`bg-background`·`outline-none`·`h-4 w-4`), `quick-booking-panel.tsx:125,131,161`(`bg-brand/10`, `text-[11px]`, `bg-danger/5` → `ScreenState` 등 공용 부품).
T6. 접근성: `customer-candidate-compare.tsx:48` listbox가 `<table>`을 감싸 option을 소유하지 못한다, 소비자 `call-customer-link-correction.tsx:171`에 `aria-activedescendant`가 없다(`project-context.md:78`), 같은 파일 :202 행 카드 포커스 링 누락.
T7. 문서: `payout-confirmation-service.ts`·`monthly-statement-service.ts`를 `src/modules/settlements/README.md`에, 티켓 17–34의 콜 쪽 변경을 `src/modules/calls/README.md`에 적는다. `src/components/domain/room-status-card.tsx:8`의 `@/app/(erp)/calls/ledger-address` 역참조를 끊는다(주소 함수를 공용 위치로). `ko.ts:364` "시간 겹침"은 CONTEXT.md가 피하라는 말이다 → 용어집의 말로.
T8. 중복: 네 정산 서비스에 똑같이 복제된 지급 확인 배선(`therapist-…:279`, `earcare-…:182`, `ops-daily-…:229`, `ops-monthly-…:384`)을 하나로 모으고, Therapist 화면(`therapist-settlement-view.tsx:290`)도 공용 `payout-confirmation-panel.tsx`를 쓰게 한다. `earcare/actions.ts:31-88` ≡ `operations/actions.ts:31-88`도 정리한다. (동작 변화 없이)

## 같이 처리할 후속 티켓

- `.scratch/app-expansion/issues/38-quick-booking-duplicate-save-notice-not-shown.md`
- `.scratch/app-expansion/issues/39-closing-action-buttons-below-44px.md`
각 티켓의 체크박스를 채우고 `**Status:** done`, `## Comments`를 남긴다.

## 고치지 않을 것 (사용자 결정 대기 또는 의도)

- 티켓 37(원장 "고객" 칸이 사유 없이 연결을 바꿈) — needs-triage, 그대로 둔다.
- 날짜·운영월 이동에도 거는 떠나기 전 안내(티켓 18), "지금"이 Therapist 단계로 자동 전진(티켓 20), 근무표 탭이 정산 구역 맨 끝(티켓 27) — 사용자에게 묻는다.
- `PAYOUT_CONFIRMATION_ALREADY_CONFIRMED`/`NOT_CONFIRMED` 전이 가드 — 그대로 둔다.
- `editable-call-grid.tsx` 1900줄 분할 — 이번에는 하지 않는다(S1·S4에서 필드 표 중복이 버그를 낳는 곳만 줄인다).
