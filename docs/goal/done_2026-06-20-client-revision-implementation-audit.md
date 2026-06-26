# done_2026-06-15 의뢰자 수정요청 반영 검토 보고서

- 검토일: 2026-06-20
- 기준 문서: `docs/plans/2026-06-15-client-revision-work-order.md`
- 검토 범위: 현재 작업트리의 코드, Prisma schema/migration, 단위/E2E 테스트 파일
- 검토 방식: 메인 에이전트 직접 코드 확인 + 하위 에이전트 3개 병렬 감사

## 1. 요약 결론

| 구분 | 개수 |
| --- | ---: |
| 구현 완료 | 13 |
| 부분 반영 | 1 |
| 미반영 | 0 |
| 확인 불가 | 0 |

전체적으로 의뢰자 수정요청 14개 중 `REQ-010. 일일정산 지급완료 항목`만 부분 반영으로 봅니다. 지급완료 상태, 지급시각, 처리자 저장, 변경 이력 기록은 구현되어 있지만, 화면에서 처리자와 변경 이력 목록을 확인하는 UI가 없습니다.

나머지 항목은 코드 기준으로 반영되어 있습니다. 다만 여러 항목은 단위 테스트는 있으나 실제 화면 E2E 또는 시각 스타일 검증이 부족합니다.

## 2. 하위 에이전트 활용 내역

| 에이전트 | 담당 범위 | 결과 |
| --- | --- | --- |
| Volta | REQ-001~REQ-003: 화면 제목, 객실 정렬, 종료임박 | 3개 모두 구현 완료 |
| Maxwell | REQ-004~REQ-009: 콜원장, 예약, 선결제, 요약 집계 | 6개 모두 구현 완료 |
| Kuhn | REQ-010~REQ-014: 정산, 오늘/월간 대시보드 | REQ-010 부분 반영, REQ-011~014 구현 완료 |

하위 에이전트가 보고한 검증:

- `src/modules/rooms/room-status-service.test.ts` 통과
- `src/modules/calls/service-call-service.test.ts`, `src/app/(erp)/calls/daily-summary-strip.test.tsx`, `src/modules/dashboard/dashboard-query-service.test.ts` 통과 보고
- 정산/대시보드 관련 9개 suite, 70개 test 통과 보고

## 3. 요구사항별 판정

### REQ-001. 주요 대제목 시인성 강화

판정: 구현 완료

근거:

- 공통 대제목 컴포넌트가 `page-header-band`와 강조 `h1`을 사용합니다: `src/components/domain/page-header.tsx:17`, `src/components/domain/page-header.tsx:25`, `src/components/domain/page-header.tsx:29`
- 전역 CSS가 좌측 강조선, 테두리, 배경 밴드, eyebrow 배지를 정의합니다: `src/app/globals.css:98`, `src/app/globals.css:102`, `src/app/globals.css:108`
- 주요 ERP 화면이 `PageHeader`를 사용합니다: `src/app/(erp)/live/page.tsx:105`, `src/app/(erp)/calls/page.tsx:64`, `src/app/(erp)/closing/page.tsx:412`, `src/app/(erp)/dashboard/today/page.tsx:135`, `src/app/(erp)/masters/rooms/page.tsx:13`, `src/app/(erp)/audit/page.tsx:89`

남은 갭:

- `page-header-band`의 실제 시각 구분을 검증하는 E2E 또는 스크린샷 테스트는 없습니다.
- `/tv`는 fullscreen 전용 헤더를 별도로 사용합니다. 요구서의 "그 외 같은 수준의 대제목"을 엄격히 적용하면 TV 헤더도 별도 점검이 필요합니다.

### REQ-002. 객실 표시 순서를 층별 구조로 변경

판정: 구현 완료

근거:

- 기본 객실 순서가 `401, 402, 301, 302, 303, 201, 202, 203, 101, 102, 103`입니다: `src/modules/masters/room-schema.ts:3`
- 객실 상태 조회는 활성 객실을 `sortOrder asc`, `createdAt asc`로 정렬합니다: `src/modules/rooms/room-status-service.ts:337`
- `/live`, `/rooms`, `/tv` 모두 같은 `listRoomStatuses()` 결과를 사용합니다: `src/app/(erp)/live/page.tsx:85`, `src/app/(erp)/rooms/page.tsx:67`, `src/app/tv/page.tsx:64`
- 세 화면 모두 층 그룹으로 카드를 렌더링합니다: `src/app/(erp)/live/page.tsx:155`, `src/app/(erp)/rooms/page.tsx:122`, `src/app/tv/page.tsx:80`
- 기존 DB 기본 객실 정렬 보정 migration이 있습니다: `prisma/migrations/20260615121000_reorder_default_rooms_top_down/migration.sql:1`

남은 갭:

- 세 화면에서 실제 DOM 카드 순서가 같은지 확인하는 E2E가 없습니다.
- 객실 마스터에서 운영자가 `sortOrder`를 임의 변경하면 요구 순서가 깨질 수 있습니다.

### REQ-003. 종료 10분 전 `종료임박` 상태 추가

판정: 구현 완료

근거:

- `종료임박` 표시 상태가 DTO 타입에 포함되어 있습니다: `src/modules/rooms/dtos.ts:1`
- 기준 시간이 10분으로 정의되어 있습니다: `src/modules/rooms/room-status-service.ts:6`
- 상태 흐름은 `사용중 -> 종료임박 -> 종료확인`입니다. 남은 시간이 `<= 0`이면 `종료확인`, `<= 10`이면 `종료임박`입니다: `src/modules/rooms/room-status-service.ts:182`
- 남은 시간과 표시 상태를 같은 서비스에서 계산합니다: `src/modules/rooms/room-status-service.ts:300`, `src/modules/rooms/room-status-service.ts:304`
- 공통 카드가 `종료임박`에 attention 스타일을 적용합니다: `src/components/domain/room-status-card.tsx:33`, `src/components/domain/room-status-card.tsx:44`
- 전역 CSS에 attention animation이 있습니다: `src/app/globals.css:121`
- 정확히 10분 남은 객실을 `종료임박`으로 보는 단위 테스트가 있습니다: `src/modules/rooms/room-status-service.test.ts:408`

남은 갭:

- `/live`, `/rooms`, `/tv`에서 `종료임박`이 실제로 보이는지 확인하는 E2E가 없습니다.
- 11분 남았을 때 `사용중`을 유지하는 경계값 테스트가 없습니다.

### REQ-004. 콜/예약 입력 원장에서 정산 관련 정보 숨김

판정: 구현 완료

근거:

- 정산 관련 열에 `settlement: true`가 붙어 있습니다: `src/app/(erp)/calls/editable-call-grid.tsx:52`
- `showSettlementColumns`가 false면 정산 열을 필터링합니다: `src/app/(erp)/calls/editable-call-grid.tsx:59`
- `/calls`는 `administrator`, `settlement_manager`에게만 정산 금액 표시 권한을 줍니다: `src/app/(erp)/calls/page.tsx:59`
- 일반 사용자에게 넘기는 row는 수당, 귀케어풀, 콜인정을 0으로 redaction합니다: `src/app/(erp)/calls/page.tsx:60`, `src/modules/calls/service-call-service.ts:1504`
- 일별 요약에서도 일반 사용자는 `마사지사정산`, `귀케어풀`이 보이지 않습니다: `src/app/(erp)/calls/daily-summary-strip.tsx:34`

남은 갭:

- 일반 직원 role로 `/calls`에 접속했을 때 정산 열이 보이지 않는지 직접 검증하는 E2E가 없습니다.
- 별도 `owner` role은 없고, 현재 역할 체계에서는 `administrator`와 `settlement_manager`가 운영자 성격입니다.

### REQ-005. 할인 적용 시 결제금액 표시 방식 개선

판정: 구현 완료

근거:

- 할인 적용 시 정상가 `basePrice`를 `line-through`로 표시합니다: `src/app/(erp)/calls/editable-call-grid.tsx:759`
- 실제 결제금액은 별도 굵은 텍스트로 표시합니다: `src/app/(erp)/calls/editable-call-grid.tsx:762`
- 결제금액 계산은 할인 후 금액입니다: `src/modules/calls/service-call-service.ts:518`

남은 갭:

- `line-through`와 실제 결제금액 강조 표시를 검증하는 React/E2E 테스트가 없습니다.

### REQ-006. 객실 선택 없이 예약 등록 가능

판정: 구현 완료

근거:

- `ServiceCall.roomId`가 nullable입니다: `prisma/schema.prisma:226`
- migration에서 `room_id`의 NOT NULL 제약을 제거합니다: `prisma/migrations/20260615120000_allow_unassigned_service_call_rooms/migration.sql:1`
- 입력 스키마의 `roomId`가 optional nullable입니다: `src/modules/calls/service-call-schema.ts:28`
- 신규 행과 기존 행의 객실 선택 UI에 `required`가 없습니다: `src/app/(erp)/calls/editable-call-grid.tsx:543`, `src/app/(erp)/calls/editable-call-grid.tsx:943`
- 서버 저장 시 `roomId`를 `null`로 저장할 수 있습니다: `src/modules/calls/service-call-service.ts:1021`
- 객실 없는 예약 저장과 `미배정` 표시를 단위 테스트가 검증합니다: `src/modules/calls/service-call-service.test.ts:627`

주의:

- `사용중`, `청소중`, `방문완료` 상태는 객실이 필요합니다: `src/modules/calls/service-call-service.ts:700`
- 이 제한은 예약 시점에는 객실이 없어도 되고, 실제 사용/완료 시점에는 객실 배정이 필요하다는 운영 흐름과 맞습니다.

### REQ-007. 선결제 시스템 반영

판정: 구현 완료

근거:

- 매출 인식 기준이 결제수단 선택 시점으로 구현되어 있습니다: `src/modules/calls/service-call-service.ts:382`
- 취소/노쇼는 결제수단이 있어도 매출에서 제외합니다: `src/modules/calls/service-call-service.ts:387`
- 결제수단이 없으면 `사용중`이어도 매출에 포함하지 않습니다: `src/modules/calls/service-call-service.ts:391`
- 결제수단이 있으면 방문완료 전에도 결제금액을 계산하되, 정산 수당은 방문완료 전까지 0입니다: `src/modules/calls/service-call-service.ts:535`
- 일별 집계는 `recognizesRevenue(row)`일 때만 결제합계와 결제수단별 합계에 더합니다: `src/modules/calls/service-call-service.ts:1427`
- 선결제, 취소 제외, 중복 방지 기준을 단위 테스트가 검증합니다: `src/modules/calls/service-call-service.test.ts:1754`

남은 갭:

- 카드, 계좌, 기타 버킷 매핑을 각각 검증하는 테스트는 부족합니다.
- 코스 정책 누락 등으로 계산 상태가 `calculated`가 아니면 결제수단이 있어도 집계에서 제외됩니다: `src/modules/calls/service-call-service.ts:1423`

### REQ-008. 상단 요약 정보 유지 및 결제수단별 집계 추가

판정: 구현 완료

근거:

- 요약 DTO에 `paymentMethodTotals`가 있습니다: `src/modules/calls/service-call-service.ts:288`
- cash/card/bank/other가 0으로 초기화됩니다: `src/modules/calls/service-call-service.ts:1401`
- 기존 상태 요약과 금액 요약이 유지됩니다: `src/app/(erp)/calls/daily-summary-strip.tsx:24`
- 현금, 카드, 계좌, 기타 결제수단별 집계가 표시됩니다: `src/app/(erp)/calls/daily-summary-strip.tsx:41`
- 결제수단별 집계도 `recognizesRevenue` 기준을 공유합니다: `src/modules/calls/service-call-service.ts:1427`

남은 갭:

- 현금, 카드, 계좌, 기타 표시를 직접 assert하는 UI 테스트가 없습니다.
- "돈통 잔액"은 구현되어 있지 않습니다. 원문 문서에서도 미결정 항목으로 남아 있습니다.

### REQ-009. 예약건수 집계 기준 수정

판정: 구현 완료

근거:

- 일별 예약건수는 상태 필터가 아니라 `rows.length`입니다: `src/modules/calls/service-call-service.ts:1450`
- 오늘 대시보드는 `callSummary.reservationCount`를 그대로 사용합니다: `src/modules/dashboard/dashboard-query-service.ts:742`
- 월간 대시보드는 날짜별 `reservationCount`를 누적합니다: `src/modules/dashboard/dashboard-query-service.ts:853`
- 예약, 사용중, 방문완료, 취소 포함 전체 행 수를 예약건수로 보는 단위 테스트가 있습니다: `src/modules/calls/service-call-service.test.ts:1808`

남은 갭:

- 화면 라벨은 여전히 `예약건수`입니다. 실제 의미는 "선택 날짜 원장 전체 등록 건수"이므로 사용자 오해 가능성이 있습니다.

### REQ-010. 일일정산 화면에 `지급완료` 항목 추가

판정: 부분 반영

구현된 부분:

- Prisma schema에 지급완료 상태, 지급시각, 처리자, 변경 이력 모델이 있습니다: `prisma/schema.prisma:357`, `prisma/schema.prisma:379`
- 일일정산 DTO가 `isPaid`, `paidAt`, `paidByAccountId`를 반환합니다: `src/modules/settlements/therapist-daily-settlement-service.ts:122`
- 지급/해제 저장 시 `paidAt`, `paidByAccountId`가 저장됩니다: `src/modules/settlements/therapist-daily-settlement-service.ts:626`
- 실제 상태 변경 시 변경 이력이 기록됩니다: `src/modules/settlements/therapist-daily-settlement-service.ts:650`
- 화면에 지급완료 요약, 컬럼, 상태, 지급시각, 변경 버튼이 있습니다: `src/app/(erp)/settlements/page.tsx:226`, `src/app/(erp)/settlements/page.tsx:252`, `src/app/(erp)/settlements/page.tsx:278`
- 서버 액션은 `payout:write` 권한을 확인하고 actor id를 넘깁니다: `src/app/(erp)/settlements/actions.ts:136`

부족한 부분:

- 화면에 지급 처리자(`paidByAccountId`)가 표시되지 않습니다.
- 화면에서 지급완료 변경 이력 목록을 볼 수 없습니다.
- 지급완료 UI를 고정하는 컴포넌트/E2E 테스트가 부족합니다.

판정 이유:

저장 모델과 서버 로직은 요구보다 강하게 구현되어 있습니다. 그러나 의뢰자가 실제 화면에서 `누가 언제 지급완료 처리했는지`, `언제 해제했는지`를 확인할 수 없으므로 업무 관점에서는 완전 반영으로 보기 어렵습니다.

### REQ-011. 오늘 대시보드 순이익 계산 기준 수정

판정: 구현 완료

근거:

- 순이익 함수는 `paymentTotal - expense - therapist - earcare - opsDaily - opsMonthly`이며 `discountTotal`을 다시 차감하지 않습니다: `src/modules/dashboard/dashboard-query-service.ts:423`
- 오늘 대시보드 지표에 운영팀 일일인센과 귀케어 지급액이 포함됩니다: `src/modules/dashboard/dashboard-query-service.ts:752`
- 오늘 대시보드 financials에 일일 비용 항목이 들어갑니다: `src/modules/dashboard/dashboard-query-service.ts:760`
- 화면에서 일일인센, 지출, 마사지사 정산, 귀케어 정산이 비용 톤으로 표시됩니다: `src/app/(erp)/dashboard/today/page.tsx:195`
- 비용 톤은 `text-danger`입니다: `src/app/(erp)/dashboard/today/page.tsx:31`

남은 갭:

- 빨간색 비용 표시를 브라우저에서 확인하는 시각 회귀 테스트는 없습니다.

### REQ-012. 결제합계와 순이익 강조 표시

판정: 구현 완료

근거:

- 오늘 대시보드의 `결제합계`와 `순이익`은 `tone="strong"`입니다: `src/app/(erp)/dashboard/today/page.tsx:192`
- strong 톤은 더 두꺼운 테두리, 큰 글자, 브랜드 색상을 사용합니다: `src/app/(erp)/dashboard/today/page.tsx:25`

남은 갭:

- 강조 표시 자체를 검증하는 E2E 또는 스크린샷 테스트는 없습니다.

### REQ-013. 월간 대시보드도 오늘 대시보드와 같은 순이익 개념 적용

판정: 구현 완료

근거:

- 오늘/월간 모두 같은 `netProfit()` 계산 함수를 사용합니다: `src/modules/dashboard/dashboard-query-service.ts:423`
- 월간 계산은 운영팀 월인센, 만근수당, 갯수왕 금액을 정산 요약에서 분리해 가져옵니다: `src/modules/dashboard/dashboard-query-service.ts:443`, `src/modules/dashboard/dashboard-query-service.ts:991`
- 월마감 preview에서 마사지사 최종 지급액은 기본 정산, 만근수당, 갯수왕을 합친 값입니다: `src/modules/closing/monthly-closing-preview-service.ts:523`
- 월간 화면에 운영팀 월인센, 만근수당, 갯수왕이 표시됩니다: `src/app/(erp)/dashboard/monthly/page.tsx:158`

주의:

- `therapistPayoutTotal`은 기본 마사지사 정산만이 아니라 만근수당과 갯수왕까지 포함한 최종 지급액입니다. 계산은 맞지만 이름만 보면 오해할 수 있습니다.

### REQ-014. 일일비용과 월간비용 구분 적용

판정: 구현 완료

근거:

- 월간 대시보드는 일일비용과 월간비용을 별도로 산출합니다: `src/modules/dashboard/dashboard-query-service.ts:997`
- 화면에 `일일비용 합계`, `월간비용 합계`가 분리 표시됩니다: `src/app/(erp)/dashboard/monthly/page.tsx:156`
- 월마감 preview도 같은 분리 계산을 사용합니다: `src/modules/closing/monthly-closing-preview-service.ts:729`
- 월마감 확정 스냅샷에 `dashboardFinancials`가 저장되어 마감 이후 현재 재계산값과 섞이지 않게 되어 있습니다: `src/modules/closing/monthly-closing-service.ts:272`

주의:

- `settlementPayoutTotal`은 지출을 포함하지 않는 정산/인센 지급 합계입니다. 화면 라벨은 `전체 지급 합계`이므로 계산상 문제는 없습니다.

## 4. 종합 리스크

1. `REQ-010`은 저장 이력은 있지만 화면 조회가 부족합니다.
2. 여러 UI 반영 항목은 코드로 구현되어 있으나 E2E/시각 검증이 부족합니다.
3. `예약건수` 라벨은 변경된 의미를 사용자에게 충분히 설명하지 못할 수 있습니다.
4. `돈통 잔액`은 아직 미결정입니다. 현재는 현금 결제합계와 지출합계만 볼 수 있습니다.
5. 객실 정렬은 master sortOrder에 의존하므로 운영자가 값을 바꾸면 요구 순서가 깨질 수 있습니다.

## 5. 권장 후속 조치

후속 작업은 별도 작업지시서 `docs/goal/done_2026-06-20-client-revision-followup-work-order.md`에 정리했고 적용했습니다.

## 6. 적용 완료 기록

- 적용일: 2026-06-20
- 적용 상태: 본 검토 보고서의 후속 조치 지시에 따라 코드와 테스트를 적용했습니다.
- 주요 적용 내용:
  - `REQ-010` 지급완료 처리자 표시와 변경 이력 조회/화면 표시를 추가했습니다.
  - 지급완료/해제 이력 조회 DTO와 단위 테스트를 추가했습니다.
  - 결제수단별 집계, 일별 요약 표시, 종료임박 11분 경계 테스트를 보강했습니다.
  - 지급완료 처리자/이력 E2E 검증 시나리오를 추가했습니다.
- 확인 필요로 남긴 항목:
  - `예약건수` 라벨 변경 여부는 의뢰자 확인 후 적용합니다.
  - `돈통 잔액`은 지출 결제수단 데이터 모델 결정이 필요해 별도 의뢰자 확인 항목으로 유지합니다.
