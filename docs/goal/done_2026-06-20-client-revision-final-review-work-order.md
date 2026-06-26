# done_2026-06-20 의뢰자 수정요청 최종 검토 및 작업지시서

- 작성일: 2026-06-20
- 적용일: 2026-06-20
- 적용 상태: 적용 완료
- 적용 내용: `WO-FINAL-002` E2E cleanup 방어와 `WO-FINAL-004` 선택 시각 회귀 테스트를 반영했습니다. `WO-FINAL-001`은 로컬 PostgreSQL `127.0.0.1:55434` 실행 후 재검증이 필요하고, `WO-FINAL-003`은 돈통 잔액 운영 정책 미확정으로 별도 결정 항목입니다.
- 기준 요청 문서: `docs/plans/2026-06-15-client-revision-work-order.md`
- 기준 설계 변경: `_bmad-output/project-context.md`
- 검토 대상: 현재 작업트리의 Prisma schema/migration, 기능 코드, 단위 테스트, E2E 테스트 파일
- 최신 판정: 기능 코드 기준 `REQ-001`~`REQ-014`는 모두 반영됨

## 1. 검토 결론

의뢰자 수정요청 14개는 현재 코드 기준으로 모두 구현되어 있습니다.

초기 검토 당시 부분 반영으로 보였던 `REQ-010 지급완료`도 후속 구현에서 처리자 표시, 변경 이력 조회, 지급/해제 이력 저장, action 오류 처리, 단위 테스트와 E2E 시나리오가 추가되어 업무 화면 기준 반영으로 봅니다.

다만 Playwright E2E는 기능 실패가 아니라 로컬 DB `127.0.0.1:55434` 접속 실패 때문에 실행 단계에서 막혔습니다. 배포 전에는 DB를 띄운 뒤 E2E를 다시 실행해야 합니다.

## 2. 검증 결과

| 검증 | 결과 | 메모 |
| --- | --- | --- |
| `npx prisma validate` | 통과 | Prisma schema 유효 |
| `pnpm lint` | 통과 | Story 1.1~7.3 정적 검증 전체 통과 |
| `pnpm test:unit` | 통과 | 34 suites, 244 tests 통과 |
| `pnpm build` | 통과 | Next build, TypeScript, static page generation 통과 |
| Playwright 선별 E2E | 환경 차단 | `127.0.0.1:55434` DB 접속 실패로 seed 단계에서 중단. cleanup 2차 `TypeError`는 재현되지 않음 |

실행한 E2E 명령:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts tests/e2e/story-6-3-graph-report.spec.ts
```

주요 실패 원인:

- `PrismaClientKnownRequestError: Can't reach database server at 127.0.0.1:55434`
- 기존에는 일부 spec의 `afterAll` cleanup이 seed 실패 후 `seededData`가 없어 추가 `TypeError`를 냈습니다. 현재는 guard를 추가해 이 2차 오류를 제거했습니다.

## 3. 요구사항별 최종 판정

| 요구사항 | 최종 판정 | 확인 근거 |
| --- | --- | --- |
| REQ-001 주요 대제목 시인성 강화 | 반영 | `PageHeader`, `page-header-band` 적용 |
| REQ-002 객실 층별 정렬 | 반영 | 기본 객실 sortOrder, `/live`, `/rooms`, `/tv` 층별 렌더링 |
| REQ-003 종료임박 상태 | 반영 | `종료임박` DTO/계산/카드 스타일, 10분/11분 단위 테스트 |
| REQ-004 콜원장 정산 정보 숨김 | 반영 | settlement-only column 필터, 일반 사용자 redaction |
| REQ-005 할인 결제금액 표시 | 반영 | 정상가 취소선과 실제 결제금액 분리 표시 |
| REQ-006 객실 없는 예약 | 반영 | `ServiceCall.roomId` nullable, 저장/조회 테스트 |
| REQ-007 선결제 매출 반영 | 반영 | 결제수단 선택 기준 `recognizesRevenue`, 취소/노쇼 제외 |
| REQ-008 결제수단별 집계 | 반영 | 현금/카드/계좌/기타 bucket 집계와 요약 표시 |
| REQ-009 예약건수 기준 | 반영 | 상태가 아니라 원장 전체 row 수 기준 |
| REQ-010 지급완료 항목 | 반영 | 지급 상태, 지급시각, 처리자, 변경 이력, 화면 표시 |
| REQ-011 오늘 순이익 계산 | 반영 | 할인 재차감 없음, 일일 비용 차감 |
| REQ-012 결제합계/순이익 강조 | 반영 | strong KPI tone 적용 |
| REQ-013 월간 순이익 개념 | 반영 | 오늘과 같은 `netProfit` 개념, 월간 비용 포함 |
| REQ-014 일일비용/월간비용 구분 | 반영 | 대시보드/월마감 preview/snapshot 분리 |

## 4. 남은 작업지시

### WO-FINAL-001. E2E 실행 환경 복구 후 재검증

작업 내용:

1. `.env`의 `DATABASE_URL`이 가리키는 PostgreSQL을 `127.0.0.1:55434`에서 실행합니다.
2. 빈 DB 기준이면 `pnpm prisma migrate deploy` 또는 로컬 표준 migration 절차를 실행합니다.
3. 필요한 seed 계정을 준비한 뒤 아래 E2E를 다시 실행합니다.

검증 명령:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts
pnpm exec playwright test tests/e2e/story-6-2-monthly-dashboard.spec.ts
pnpm exec playwright test tests/e2e/story-6-3-graph-report.spec.ts
```

완료 기준:

- DB 접속 실패 없이 E2E seed가 완료됩니다.
- 지급완료 처리자/변경 이력, 월간 대시보드, 그래프 리포트 E2E가 통과합니다.
- 실패가 나오면 기능 오류인지 테스트 데이터 오류인지 분리해 후속 수정합니다.

### WO-FINAL-002. E2E cleanup 방어 보강

적용 결과:

- `tests/e2e/story-6-2-monthly-dashboard.spec.ts`의 `afterAll`에서 `seededData`가 없으면 cleanup을 건너뛰고 Prisma 연결만 닫도록 적용했습니다.
- `tests/e2e/story-6-3-graph-report.spec.ts`도 같은 방식으로 적용했습니다.
- `src/app/(erp)/dashboard/e2e-cleanup-guards.test.ts`를 추가해 두 E2E spec의 cleanup guard를 회귀 테스트로 고정했습니다.
- DB가 꺼진 상태에서 선별 E2E를 실행했을 때 DB 접속 실패는 남지만 `Cannot read properties of undefined` 2차 오류는 출력되지 않음을 확인했습니다.

작업 내용:

1. `tests/e2e/story-6-2-monthly-dashboard.spec.ts`의 `afterAll`에서 `seededData`가 없으면 cleanup을 건너뜁니다.
2. `tests/e2e/story-6-3-graph-report.spec.ts`도 같은 방식으로 seed 실패 후 cleanup `TypeError`를 막습니다.

완료 기준:

- DB가 꺼져 있어도 실패 원인이 DB 접속 실패 하나로 명확히 남습니다.
- `Cannot read properties of undefined` 같은 2차 오류가 사라집니다.

### WO-FINAL-003. 돈통 잔액 정책 확정

연결 요구사항:

- REQ-008

현재 상태:

- 결제수단별 현금/카드/계좌/기타 합계는 구현되어 있습니다.
- `돈통 잔액` 별도 KPI는 아직 정책 미확정입니다.
- 현재 `DailyExpense`에는 지출 결제수단 필드가 없어 `현금 지출합계`를 정확히 분리할 수 없습니다.

확인 질문:

- 돈통 잔액을 별도 표시할지 확인합니다.
- 표시한다면 계산식을 `현금 결제합계 - 현금 지출합계`로 할지 확정합니다.
- 현금 지출만 분리해야 하면 `DailyExpense.paymentMethodCode` 같은 데이터 모델 변경을 별도 작업으로 분리합니다.

완료 기준:

- 의뢰자가 돈통 잔액 미표시를 선택하면 현재 구현으로 종료합니다.
- 의뢰자가 표시를 원하면 DB 필드, 입력 UI, 집계, 테스트를 별도 작업으로 작성합니다.

### WO-FINAL-004. 선택 시각 회귀 테스트 추가

적용 결과:

- `src/app/(erp)/client-revision-visual-regression.test.ts`를 추가했습니다.
- 주요 대제목 강조는 `PageHeader` DOM class와 `globals.css` class 존재를 검증합니다.
- 할인 결제금액은 정상가 취소선과 실제 결제금액 강조 표시 계약을 검증합니다.
- 오늘/월간 대시보드의 결제합계/순이익 `strong` tone과 일일비용/월간비용 `cost` tone을 검증합니다.

작업 내용:

1. 주요 대제목 강조(`REQ-001`) 스크린샷 또는 DOM class 검증을 추가합니다.
2. 할인 결제금액 취소선(`REQ-005`) 컴포넌트/E2E 검증을 추가합니다.
3. 오늘/월간 대시보드 strong/cost tone(`REQ-011`~`REQ-014`) 검증을 추가합니다.

완료 기준:

- 스타일 회귀가 발생하면 테스트가 실패합니다.
- 기능 계산 테스트와 시각 표시 테스트가 분리되어 유지됩니다.

## 5. 배포 전 권장 게이트

최소 게이트:

```bash
npx prisma validate
pnpm lint
pnpm test:unit
pnpm build
```

DB 준비 후 게이트:

```bash
pnpm exec playwright test tests/e2e/story-4-2-therapist-daily-settlement.spec.ts tests/e2e/story-6-2-monthly-dashboard.spec.ts tests/e2e/story-6-3-graph-report.spec.ts
```

## 6. 최종 메모

기능 코드와 단위 검증 기준으로는 의뢰자 수정요청이 반영되어 있습니다. 이번 적용으로 E2E cleanup 2차 오류와 선택 시각 회귀 테스트 공백을 보강했습니다. 현재 남은 리스크는 E2E 실행 환경과 미확정 운영 정책(`돈통 잔액`)입니다.
