# 07: 수당 탭 — 날짜별, 이번 달, 확정 월 명세서

**What to build:** "수당" 탭에 날짜별 코스 수당과 지급 확인 상태를 보인다. 이번 달 계산 중 합계와 만근·콜킹 진행도 보인다. 마감된 달은 그 마감 버전의 확정 월 명세서를 보인다. "오늘" 탭 현황에는 오늘 예상 코스 수당을 더한다. 계산식은 바꾸지 않고 기존 서비스 결과를 쓴다. (스펙 D19–D21, M4, M8–M10, ADR 0004, ADR 0010. 나누기 전 티켓 05)

**Blocked by:** 03

**Status:** done

- [ ] 수당은 기존 월 명세서 서비스를 세션의 직원 id로, 마감 버전을 고르지 않고 부른다(M8).
  - 마감확정·잠금이면 최신 마감 버전이고, 작성중·검토중(재오픈 포함)이면 지금 계산이다.
  - Therapist는 마감 버전을 고르지 않는다.
- [ ] 날짜별: 그날 코스 수당 합계와 콜별 코스·금액이 보인다. 코스 수당이 없어 계산하지 못한 콜은 "금액 확인 중"이다.
- [ ] 날짜별 지급 확인 상태는 "확인됨", "아직", "지급 뒤 금액이 바뀌어 관리자 확인 중" 셋 중 하나다(M10).
  - 확인 금액 미기록은 재확인 필요로 세는 운영월이면 "관리자 확인 중", 아니면 "확인됨"이다.
  - 지급 확인이 송금처럼 보이지 않는다.
- [ ] 이번 달에는 아래 내용이 보인다.
  - 계산 중 합계
  - 만근 인정 일수(예: 14/20일)와 만근수당 예상
  - 내 완료 콜 수(방문완료, 콜킹 기준)와 내 순위
  - 콜킹 기준선(최소 콜 수, 지금 1–3위의 콜 수)과 콜킹 보너스 예상
  - 순위와 기준선은 월 마감 미리보기의 Therapist 행에서 서버가 계산하고, 기준값은 마감 기준값 모듈에서 읽는다(M9).
- [ ] 다른 Therapist의 이름과 금액은 응답에도 화면에도 없다. 순위와 기준선은 숫자만 내려 준다.
- [ ] 마감 전에는 "계산 중(미확정)", 마감 뒤에는 그 마감 버전의 확정 금액이 보이고, 둘이 분명히 나뉜다. 지난 달들도 고를 수 있다.
- [ ] "오늘" 탭 현황(03이 둔 자리)에 오늘 예상 코스 수당이 보인다. 일별 정산 서비스의 그날 결과에서 내 줄만 쓴다. "오늘 한 것"과 "이번 달 완료 N콜(콜킹 기준)"은 이름이 다르다.
- [ ] 서버는 01의 Therapist 검사가 돌려준 직원 id로만 읽는다. 01의 새로고침 공통 조각을 쓴다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma), 같은 DB에서 비교: 계산 중 금액이 정산 화면의 그 Therapist 금액과 같고, 마감 뒤에는 그 마감 버전 금액이 나온다.
  - 응답 전체를 문자열로 만들어 다른 Therapist의 이름과 금액이 없는지 본다.
  - 지급 확인 상태를 세 상태로 바꾸는 규칙(순수 함수)
  - E2E: 다른 Therapist의 금액이 보이지 않는다.

## Comments

**만든 것**

- `src/modules/therapists/therapist-payout-status.ts`: 순수 함수 `therapistPayoutStatusOf(confirmation)` — `PayoutConfirmationDto`의 네 내부 상태를 Therapist가 보는 세 상태(`confirmed`/`unconfirmed`/`needsReview`)로 좁힌다(M10). `status`와 `requiresReconfirmation`만 보고, 운영월 상태 분기는 새로 하지 않는다(`derivePayoutConfirmationStatus`가 이미 반영해 둔 값을 그대로 쓴다).
- `src/modules/therapists/therapist-payout-view-service.ts`: `getTherapistPayoutView({ employeeId, operatingMonthId, prismaClient?, dependencies? })` — `getMonthlyStatement`(마감 버전 없이)와 `listMonthlyClosingPreview`/`getMonthlyClosingSnapshotByVersion`(statement.closeVersion과 같은 버전)를 불러 이 Therapist의 행만 좁은 DTO(`TherapistPayoutViewDto`)로 옮긴다. 계산은 새로 하지 않는다 — 날짜별 금액은 `evidence.dailyEntries`(미확정) 또는 `payoutUnits`(마감, 콜 근거 없음)에서, 순위·기준선은 월마감 미리보기/스냅샷의 `therapists.rows`에서 그대로 옮긴다. `appliedPolicies[].call`·`calls[]`는 `therapistNames`를 포함하지만 그 필드는 아예 읽지 않는다(M6). `expectedPayoutAmountForDate({ employeeId, operatingMonthId, serviceDate, prismaClient? })`도 이 파일에 있다 — `listTherapistDailySettlements`의 그날 내 행 `totalCommissionAmount`만 꺼낸다(03의 "오늘" 탭 자리에 씀).
- `src/modules/therapists/therapist-today-view-service.ts`: `TherapistTodayViewDto.today`에 `expectedPayoutAmount: number`를 더했다(03이 비워 둔 자리, M8). 오늘 담당 콜이 있으면(= `todayRecords[0].operatingMonthId`가 있으면) `expectedPayoutAmountForDate`를 부르고, 없으면 0으로 둔다(일별 정산을 다시 부르지 않는다).
- 화면: `src/app/therapist/payout/page.tsx`(운영월 고르기 GET 폼 + 조회, 마감 버전은 고르지 않음, M8), `src/components/therapist/therapist-payout-month-picker.tsx`, `src/components/therapist/therapist-payout-view.tsx`(이번 달 요약 카드 3장 + 날짜별 코스 수당 목록). `src/app/therapist/page.tsx`의 `TherapistTodayStatus` children 자리에 오늘 예상 코스 수당 `SummaryCard`를 끼워 넣었다(03이 둔 자리, `page.tsx`의 다른 부분은 건드리지 않음).
- i18n: `src/lib/i18n/messages/{ko,vi}.ts`에 `therapist.payout.*` 키 24개, `therapist.today.expectedPayoutLabel`·`expectedPayoutNote` 2개. "지급 확인이 송금처럼 보이지 않게" 하려고 송금 문구(지급완료 등)를 쓰지 않고 스펙의 "확인됨"/"아직"/"관리자 확인 중" 그대로 썼고, 기존 `settlements.statement.disclaimer`("이 문서는 수당 명세이며 송금 영수증이 아닙니다")를 재사용했다. 상태 칩은 작은 `StatusIndicator`(기호+글자) 하나뿐이고 금액을 체크 아이콘·굵은 초록 글자로 강조하지 않았다.

**새로 한 가정**

- (가정) D20 "콜킹 기준선(최소 콜 수, 지금 1–3위의 콜 수)"은 월마감 미리보기/스냅샷의 `therapists.rows` 중 `countKingRank`가 있는 행(최대 3개)에서 `{rank, callCount}`만 뽑는다. 내가 그 1–3위에 들어도(예: 2위) 내 콜 수가 기준선 목록에도 그대로 보인다 — 숫자일 뿐이라 M6 위반이 아니라고 봤다(코드베이스 지도 18절 결정과 일치).
- (가정) 09 정정 승인과 지급 재확인의 관계(코드베이스 지도 18절 질문)는 이 티켓에서 직접 코드로 확인했다: 날짜별 지급 확인 금액(`currentAmount`)은 `listTherapistDailySettlementsForOperatingMonth`로 그날 코스 수당을 다시 계산한 값이고, 출퇴근 시각과는 무관하다(코스 수당 계산에 출퇴근 칸을 읽지 않는다). 따라서 정정 승인이 그 금액을 바꾸는 경우는 없고, ADR 0004 규칙은 계산으로 자동 적용된다.
- "오늘" 탭의 오늘 예상 코스 수당은 "계산 중(미확정)"으로 표시한다 — 그날이 끝나기 전엔 지급 확인 자체가 생기지 않아 항상 미확정이라고 봤다.

**검증**

- `pnpm test:unit`: 병합 전 1097 passed(새 테스트 `therapist-payout-status.test.ts` 5개, `therapist-payout-view-service.test.ts` 4개, `therapist-today-view-service.test.ts`에 1개 추가·기존 2곳 수정 포함), 통합 브랜치(02 포함) 병합 뒤 1113 passed, 0 failed.
- `npx tsc --noEmit`: 병합 전·후 모두 에러 없음.
- `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`: `validate-story-4-6.mjs`만 실패(기존 실패).
- 운영 빌드 E2E(DB `vietnam_aesthetic_th07`, 포트 3207): 새 스펙 `story-ticket-07-therapist-payout.spec.ts` 4/4 통과(미확정 날짜별 코스 수당·금액 확인 중·짝꿍·다른 Therapist 이름 비노출, 확인/재확인 필요 전환, 마감확정 달의 확정 금액·순위·기준선 숫자만·1·3위 이름 비노출, 390px). 직접 관련 기존 스펙도 같은 DB로 돌려 회귀가 없는지 봤다: `story-ticket-03-today-my-calls.spec.ts` 3/3(오늘 탭에 내 수당 카드가 더해졌지만 기존 단언은 그대로 통과), `story-ticket-01-therapist-role-shell.spec.ts` 7/7, `story-ticket-10-therapist-notices.spec.ts` 3/3. 끝나고 서버 종료, DB 삭제.
- 통합 브랜치 tip(47cfa27, 티켓 02 포함)을 병합했다. 충돌 없음(i18n 두 파일만 자동 병합). 병합 뒤 단위 테스트·tsc 재확인 완료.

- 2026-10-20 (오케스트레이터): 이 티켓의 월 수당 열람 범위(D19–D21)는 사용자 확정 스펙 `.scratch/therapist-daily-only/spec.md`(93df843)로 대체됐다. Therapist 수당 탭은 현재 영업일의 본인 코스 수당만 보인다. done은 그 대체 범위 기준이다.

### 2026-10-20 수당 탭 지연 개선(작업지시서 `payout-speed-work-order.md`)

- 원인: 수당 탭이 한 직원의 명세서를 만들면서 **모든** Therapist의 일일 정산을 31일치 다시 계산했다(쿼리 589개, 직접 연결 22초 / 프리뷰 Worker 75초). `listTherapistAttendanceForDate`는 출퇴근 기록이 없어도 활성 Therapist 전원을 행으로 돌려줘서, 활동이 없는 직원도 31일치 빈 줄을 갖게 된다.
- 고친 것: ① Therapist 날짜별 근거를 운영월 1회 일괄 읽기(`listTherapistDailySettlementsForOperatingMonth` + `listPayoutConfirmationHistoriesByDate` + 이 직원의 출퇴근 범위 조회)로 바꾼다. ② 달 안에서 바뀌지 않는 운영월·직원 목록을 날짜마다 다시 읽지 않게 한다. ③ 콜킹 기준선을 `MonthlyStatementDto.rankBaseline`으로 옮겨 미리보기·스냅샷을 두 번째로 계산하지 않는다. ④ `src/app/therapist/payout/loading.tsx`로 계산 중 표시를 넣는다.
- 숫자 동일성: 운영 DB 2026-10, Therapist 4명을 이전 방식과 새 방식으로 각각 계산해 날짜별 항목(금액·콜 근거·적용 정책·지급 확인 상태)을 비교했다. 124개 날짜 불일치 0건. 달라진 것은 "근거가 없는 날의 빈 줄"뿐이다(31줄 → 활동 있는 날만).
- 측정: 직접 연결 18–22초·589쿼리 → 2.4–3.1초·47쿼리. 분석 문서는 `docs/research/2026-10-20-payout-latency-analysis.md`.
- 테스트: `pnpm test:unit` 1225개 통과, `npx tsc --noEmit` 오류 없음. 추가 테스트는 날짜 단위 함수를 0번·월 단위를 1번 부르는지, 근거 없는 날이 줄을 만들지 않는지, 수당 뷰가 미리보기·스냅샷을 다시 부르지 않는지를 확인한다.
