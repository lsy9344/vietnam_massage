# done_의뢰자 수정요청 적용 재검토 및 검증 보강 작업지시서

- 작성일: 2026-06-20
- 적용일: 2026-06-20
- 적용 상태: 적용 완료
- 기준 요청 문서: `docs/plans/2026-06-15-client-revision-work-order.md`
- 참조 산출물:
  - `docs/goal/done_2026-06-20-client-revision-implementation-audit.md`
  - `docs/goal/done_2026-06-20-client-revision-followup-work-order.md`
  - `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md`
- 검토 범위: 현재 작업트리의 Prisma schema/migration, 기능 코드, 단위 테스트, E2E 테스트 파일
- 검토 방식: 메인 에이전트 직접 코드/명령 검증 + 하위 에이전트 3개 병렬 감사

## 적용 완료 내역

이 작업지시서의 검증 보강 항목을 코드와 E2E에 적용했습니다.

- E2E DB 환경은 `.env` 우선 로딩과 `PLAYWRIGHT_PORT` 지원으로 복구했고, 로컬 `vietnam_aesthetic` DB에 migration을 적용해 브라우저 E2E가 seed 단계에서 중단되지 않게 했습니다.
- 객실 순서, `종료임박`, 콜원장 정산정보 숨김, 미배정 예약, 결제수단 요약, 오늘/월간 대시보드 금액 tone 검증을 브라우저 E2E로 보강했습니다.
- 미배정 예약 저장 후 객실 셀이 `미배정`으로 보이도록 콜원장 UI 표시를 수정했습니다.
- 범위 밖 조회날짜는 운영월 시작/종료 경계로 보정되도록 `clampDateToOperatingMonth`를 수정하고 단위 테스트를 갱신했습니다.
- `돈통 잔액` KPI와 `예약건수` 라벨 변경은 문서의 정책 결정 항목으로 남겼으며, 의뢰자 확정 전에는 별도 구현하지 않았습니다.

## 1. 재검토 결론

현재 기능 코드 기준으로 의뢰자 수정요청 `REQ-001`~`REQ-014`는 모두 구현되어 있습니다.

차단 수준의 기능 버그는 발견하지 못했습니다. 다만 아래 항목은 아직 배포 전 검증 보강 또는 의뢰자 정책 결정이 필요합니다.

1. Playwright E2E는 로컬 PostgreSQL `127.0.0.1:55434` 접속 실패로 기능 검증까지 도달하지 못했습니다.
2. 객실 순서, `종료임박`, 콜원장 정산정보 숨김, 미배정 예약 같은 화면 흐름은 단위/정적 테스트는 있으나 브라우저 E2E가 부족합니다.
3. `돈통 잔액`은 의뢰자 정책 미확정입니다. 현재는 결제수단별 합계만 구현되어 있습니다.

## 2. 최신 검증 결과

| 검증 | 결과 | 확인 내용 |
| --- | --- | --- |
| `npx prisma validate` | 통과 | Prisma schema 유효 |
| `pnpm lint` | 통과 | Story 1.1~7.3 정적 검증 전체 통과 |
| `pnpm test:unit` | 통과 | 34 suites, 244 tests 통과 |
| `pnpm build` | 통과 | Next build, TypeScript, static generation 통과 |
| 선별 Playwright E2E | 환경 차단 | `127.0.0.1:55434` DB 접속 실패로 seed 단계에서 중단 |

실행한 E2E 명령:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts tests/e2e/story-6-3-graph-report.spec.ts
```

주요 실패 원인:

- `PrismaClientKnownRequestError: Can't reach database server at 127.0.0.1:55434`
- 실패 위치는 각 E2E spec의 seed 단계입니다.
- 기능 화면 assertion까지 도달하지 못했습니다.

## 3. 요구사항별 판정

| 요구사항 | 판정 | 핵심 근거 |
| --- | --- | --- |
| REQ-001 주요 대제목 시인성 | 반영 | `PageHeader`, `page-header-band`, 주요 ERP 페이지 적용 |
| REQ-002 객실 층별 정렬 | 반영 | 기본 객실 `401,402,301,302,303,201,202,203,101,102,103`, `listRoomStatuses()` sortOrder 정렬, `/live` `/rooms` `/tv` 공통 DTO 사용 |
| REQ-003 종료임박 상태 | 반영 | `ENDING_SOON_THRESHOLD_MINUTES = 10`, `종료임박` DTO/배지/카드 스타일, 10분/11분 단위 테스트 |
| REQ-004 콜원장 정산 정보 숨김 | 반영 | `showSettlementColumns`, 일반 사용자 금액 redaction, 관리자/정산담당만 정산 열 표시 |
| REQ-005 할인 결제금액 표시 | 반영 | 정상가 취소선과 실제 결제금액 강조 표시, 정적 회귀 테스트 |
| REQ-006 객실 없는 예약 | 반영 | `ServiceCall.roomId` nullable, 예약 저장 허용, active/completed 상태 전환 시 객실 요구 |
| REQ-007 선결제 매출 반영 | 반영 | 결제수단 선택 기준 `recognizesRevenue`, 취소/노쇼 제외, 방문완료 전 정산 금액 분리 |
| REQ-008 결제수단별 집계 | 반영 | 현금/카드/계좌/기타 bucket 집계와 상단 요약 표시 |
| REQ-009 예약건수 기준 | 반영 | `reservationCount = rows.length`로 상태와 무관하게 전체 원장 행 수 집계 |
| REQ-010 지급완료 항목 | 반영 | 지급 상태, 지급시각, 처리자, 변경 이력 모델/DTO/UI/단위 테스트 |
| REQ-011 오늘 순이익 계산 | 반영 | 할인 재차감 없음, 일일인센/지출/마사지사/귀케어 비용 차감 |
| REQ-012 결제합계/순이익 강조 | 반영 | 오늘 대시보드 `strong` tone 적용 |
| REQ-013 월간 순이익 개념 | 반영 | 오늘과 같은 `netProfit()` 개념, 운영팀 월인센/만근/갯수왕 비용 반영 |
| REQ-014 일일비용/월간비용 구분 | 반영 | `dailyCostTotal`, `monthlyCostTotal` 분리 계산과 화면 표시 |

## 4. 하위 감사 요약

| 감사 범위 | 결론 | 후속 필요 |
| --- | --- | --- |
| REQ-001~REQ-003 | 구현 반영 | `/live`, `/rooms`, `/tv` 실제 DOM 순서와 `종료임박` E2E 보강 |
| REQ-004~REQ-009 | 구현 반영 | 카운터 역할 콜원장 redaction E2E, 미배정 예약 UI E2E, 좁은 화면 결제수단 요약 검증 |
| REQ-010~REQ-014 | 구현 반영 | 대시보드 비용/강조 항목의 브라우저 DOM class 검증 보강 |

## 5. 작업지시

### WO-VERIFY-001. E2E DB 실행 환경 복구 후 재검증

연결 요구사항:

- REQ-010
- REQ-013
- REQ-014

작업 내용:

1. `.env`의 `DATABASE_URL`이 가리키는 PostgreSQL을 `127.0.0.1:55434`에서 실행합니다.
2. 빈 DB라면 migration과 seed를 적용합니다.
3. 아래 선별 E2E를 다시 실행합니다.

검증 명령:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts tests/e2e/story-6-3-graph-report.spec.ts
```

완료 기준:

- DB 접속 실패 없이 seed가 완료됩니다.
- 지급완료 처리자/변경 이력, 월간 대시보드, 그래프 리포트 E2E가 통과합니다.
- 실패가 나오면 기능 오류와 테스트 데이터 오류를 분리해 후속 수정합니다.

### WO-VERIFY-002. 객실 순서와 종료임박 브라우저 E2E 보강

연결 요구사항:

- REQ-002
- REQ-003

작업 내용:

1. `/live`, `/rooms`, `/tv`의 객실 카드 DOM 순서를 검증합니다.
2. 기대 순서는 `401, 402, 301, 302, 303, 201, 202, 203, 101, 102, 103`입니다.
3. 10분 이하 남은 `사용중` 객실이 세 화면 모두에서 `종료임박`으로 표시되는지 검증합니다.
4. `종료임박` 카드가 배지, 안내 문구, attention class를 함께 갖는지 확인합니다.

완료 기준:

- 세 화면 모두 같은 층별 정렬을 브라우저에서 검증합니다.
- `종료임박`과 `종료확인`이 화면에서 혼동되지 않습니다.

### WO-VERIFY-003. 콜원장 정산 정보 숨김 역할 E2E 보강

연결 요구사항:

- REQ-004

작업 내용:

1. 카운터 계정으로 `/calls`에 접속합니다.
2. `마사지사1수당`, `마사지사2수당`, `귀케어풀`, `콜인정` 헤더와 금액 셀이 보이지 않는지 검증합니다.
3. 관리자 또는 정산담당 계정으로 같은 화면에 접속해 정산 열이 보이는지 검증합니다.
4. 일반 직원 화면에서 예약 등록, 결제수단 입력, 상태 변경이 계속 동작하는지 확인합니다.

완료 기준:

- 일반 직원에게 정산 금액 정보가 노출되지 않습니다.
- 운영자 성격 역할은 필요한 정산 정보를 볼 수 있습니다.
- 열 숨김이 입력/저장을 깨지 않습니다.

### WO-VERIFY-004. 미배정 예약 UI E2E 보강

연결 요구사항:

- REQ-006

작업 내용:

1. `/calls`에서 객실을 비운 예약 row를 저장합니다.
2. 저장 후 원장에 `미배정` 또는 동등한 빈 객실 상태가 표시되는지 확인합니다.
3. 같은 row에 나중에 객실을 배정하고 저장합니다.
4. 미배정 예약이 `/rooms`, `/live`, `/tv` 객실 점유 상태에 잘못 반영되지 않는지 확인합니다.

완료 기준:

- 객실 없이 예약 저장이 가능합니다.
- 이후 객실 배정이 가능합니다.
- 미배정 예약 때문에 객실 현황 계산이 오류를 내지 않습니다.

### WO-VERIFY-005. 결제수단 요약과 대시보드 시각 회귀 보강

연결 요구사항:

- REQ-008
- REQ-011
- REQ-012
- REQ-013
- REQ-014

작업 내용:

1. 좁은 화면에서 콜원장 상단 `현금`, `카드`, `계좌`, `기타` 요약이 읽을 수 있게 유지되는지 브라우저 검증을 추가합니다.
2. 오늘 대시보드에서 `결제합계`, `순이익`은 strong tone, 비용 항목은 cost tone인지 실제 DOM class 또는 screenshot으로 검증합니다.
3. 월간 대시보드에서 `일일비용 합계`, `월간비용 합계`, `운영팀 월인센`, `만근수당`, `갯수왕` 표시를 브라우저에서 검증합니다.

완료 기준:

- 결제수단별 요약이 모바일/좁은 폭에서도 읽기 어렵게 깨지지 않습니다.
- 대시보드 핵심 지표와 비용 항목의 시각 의미가 브라우저 렌더 기준으로 유지됩니다.

### WO-DECISION-001. 돈통 잔액 정책 확정

연결 요구사항:

- REQ-008

현재 상태:

- 결제수단별 합계는 구현되어 있습니다.
- `돈통 잔액` 별도 KPI는 구현하지 않았습니다.
- 원 요청 문서에서도 돈통 잔액은 확인 필요 항목입니다.

확인 질문:

1. 돈통 잔액을 별도 KPI로 표시할까요?
2. 표시한다면 계산식은 `현금 결제합계 - 현금 지출합계`가 맞나요?
3. 현재 `DailyExpense`에는 지출 결제수단이 없으므로, 현금 지출만 분리하려면 `DailyExpense.paymentMethodCode` 같은 필드 추가가 필요한데 허용할까요?

완료 기준:

- 의뢰자가 돈통 잔액 미표시를 선택하면 현재 구현으로 종료합니다.
- 표시를 원하면 DB 필드, 입력 UI, 집계, 테스트를 별도 작업으로 작성합니다.

### WO-DECISION-002. 예약건수 라벨 유지 여부 확인

연결 요구사항:

- REQ-009

현재 상태:

- 코드상 `예약건수`는 상태와 무관한 원장 전체 등록 건수입니다.
- 의뢰자 요청의 의미에는 맞지만, 사용자가 "예약 상태인 건수"로 오해할 수 있습니다.

확인 질문:

- 화면 라벨을 `예약건수`로 유지할까요?
- 아니면 `원장 등록건수` 또는 `전체 등록건수`로 바꿀까요?

완료 기준:

- 의뢰자 문구 결정에 따라 라벨을 유지하거나 변경합니다.

## 6. 권장 실행 순서

1. `WO-VERIFY-001`로 E2E DB 환경을 먼저 복구합니다.
2. `WO-VERIFY-002`~`WO-VERIFY-005`로 브라우저 검증 공백을 줄입니다.
3. `WO-DECISION-001`, `WO-DECISION-002`는 의뢰자 확인 후 별도 구현 여부를 결정합니다.

## 7. 배포 전 게이트

최소 게이트:

```bash
npx prisma validate
pnpm lint
pnpm test:unit
pnpm build
```

DB 준비 후 E2E 게이트:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts tests/e2e/story-6-3-graph-report.spec.ts
```

브라우저 보강 후 추가 권장:

```bash
pnpm exec playwright test tests/e2e/story-2-1-call-ledger-basic.spec.ts tests/e2e/story-3-2-live-status.spec.ts tests/e2e/story-3-3-rooms-waiter-guidance.spec.ts tests/e2e/story-3-4-tv-fullscreen-board.spec.ts tests/e2e/story-6-1-today-dashboard.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts
```
