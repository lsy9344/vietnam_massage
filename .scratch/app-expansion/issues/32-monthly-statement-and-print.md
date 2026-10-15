# 32: 월 명세서와 인쇄

**What to build:** 정산 영역에서 직원 한 명과 운영월 하나의 월 명세서를 본다. 마감 전에는 "미확정" 표시와 함께 현재 계산 결과와 근거(출근일, 해당 콜 목록, 적용 정책, 일별·월별 금액, 지급 확인 상태)를 보여 준다. 마감 후에는 가장 최근 마감 버전 스냅샷에 담긴 그 직원의 행과 근거, 그리고 "마감 버전 N"을 보여 준다. 이전 마감 버전도 골라서 본다. 인쇄와 브라우저 PDF 저장을 할 수 있다. (스펙 F05, 스토리 118–121, V08·V11)

**Blocked by:** 31

**Status:** done

- [x] 스냅샷에 없는 근거는 만들어 내지 않고 "이 마감 버전에는 해당 근거가 저장되지 않았습니다"라고 적는다.
- [x] Therapist의 만근 수당과 콜킹 보너스는 근거와 함께 나오지만 별도의 지급 확인 단위는 아니다.
- [x] 인쇄물에 직원, 운영월, 미확정 여부 또는 마감 버전, 금액 근거, 출력 시각이 찍힌다. 인쇄용 스타일로 처리한다.
- [x] 재오픈과 재확정을 거친 뒤에도 이전 버전의 명세서를 볼 수 있다.
- [x] 세 직군 직원 모두 명세서를 볼 수 있고, 관리자와 정산 담당만 연다.
- [x] 지급 확인 서비스 테스트와 인쇄 화면 E2E로 확인한다. 화면과 인쇄 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-32-monthly-statement-and-print`, `integration/app-expansion` d792663 위에서 시작).
- 새 서비스 `src/modules/settlements/monthly-statement-service.ts`(`getMonthlyStatement`): 직원·운영월 하나의 명세서를 직군(Therapist/귀케어/운영팀) 공통으로 돌려준다.
  - 마감 버전이 없으면(또는 명시적으로 고르지 않았는데 아직 한 번도 마감 안 했으면) "지금 계산"(미확정)을 돌려준다. 금액 집계는 `listMonthlyClosingPreview`를 그대로 불러 쓰고(직군별 월 집계 행이 미리보기와 마감 스냅샷에서 모양이 완전히 같다는 점을 이용 — `Pick<MonthlyClosingPreviewDto, "therapists"|"operations"|"earcare">`), 날짜별 근거(출근·콜 목록·그날 금액·그날 지급 확인)는 하루씩 돌며 각 직군 서비스(`listTherapistDailySettlements`+`listTherapistAttendanceForDate`, `listEarcareDailySettlements`, `listOpsDailyIncentives`)를 다시 불러 모은다(귀케어·운영팀은 출퇴근이 이미 그 행에 `statusDisplayName`으로 들어 있어 별도 출퇴근 조회가 필요 없었다).
  - 마감 버전이 있으면(기본은 최신, 또는 명시적으로 고른 버전) `getMonthlyClosingSnapshotByVersion`의 스냅샷에서 그 직원의 월 집계 행만 꺼내 보여주고, 날짜별 근거 자리에는 고정 문구 `"이 마감 버전에는 해당 근거가 저장되지 않았습니다."`만 둔다. 스냅샷은 월 집계만 담고(ticket 05 시절 설계) 날짜별 항목은 담지 않으므로, 다시 계산해서 채우면 "확정 당시 그대로 보존" 원칙(ADR 0004/F07)을 어기게 된다 — 그래서 티켓이 요구한 문구를 그대로 쓰고 다시 계산하지 않았다.
  - 지급 확인 상태(`payoutUnits`)는 마감 버전을 보는 중이어도 **항상 지금(live) 상태**를 보여준다. 지급 확인 사건은 스냅샷의 일부가 아니라 독립된 사건 기록(ADR 0004)이고, 마감확정·잠금 운영월은 그 사건에 "쓰기"만 막으므로 읽기는 과거 버전을 보는 중에도 최신이 맞다는 가정이다. 이를 위해 티켓 31의 `listEarcareDailyPayoutConfirmationsForMonth`/`listOpsDailyPayoutConfirmationsForMonth`와 같은 패턴으로 `listTherapistDailyPayoutConfirmationsForMonth`를 `therapist-daily-settlement-service.ts`에 새로 추가했다(브리핑이 예고한 겹침). 운영팀은 월 인센 단위(`listOpsMonthlyIncentivePreview`의 그 직원 행)도 payoutUnits에 더한다.
  - `monthly-closing-service.ts`에 `listMonthlyClosingVersions`(최신순 버전 목록, 스냅샷 본문 제외)과 `getMonthlyClosingSnapshotByVersion`(특정 버전의 스냅샷)을 추가했다. 기존 `getMonthlyClosingSnapshot`(항상 최신)은 그대로 두고 손대지 않았다.
  - 금액 구성(`summary`)은 직군별 discriminated union(`THERAPIST`/`OPERATIONS`/`EARCARE`)으로 raw 숫자만 돌려주고, 한국어 문장을 서비스에서 미리 조립하지 않았다(두 언어 요구사항 때문 — closing/page.tsx의 `fullAttendanceBasisText`/`countKingBasisText`처럼 화면이 구조화된 값으로 직접 번역 문구를 만든다). earcare·운영팀의 `calculationBasis`/`monthlyCalculationBasis`는 기존 `settlementBasisText`(표시 직전 번역기)로 그대로 번역해 재사용했다.
- 화면: `src/app/(erp)/settlements/statement/page.tsx`(직원·운영월·마감 버전 고르는 GET 폼) + `monthly-statement-view.tsx`("use client", 인쇄 버튼·print:hidden·beforeprint로 출력 시각 갱신). 라우트 `/settlements/statement`는 `routes.ts`에 `notATab: true`로 추가(TV와 같은 이유 — 탭이 아니라 각 정산 화면 직원 패널의 "월 명세서 보기" 링크로 연다). 그 링크는 `therapist-settlement-view.tsx`·`earcare-settlement-view.tsx`·`ops-daily-view.tsx`·`ops-monthly-view.tsx` 네 패널 모두에 더했다(공용 `StatementLink`/`monthlyStatementHref`, `settlement-parts.tsx`/`settlement-view-model.ts`). `WorkflowDock`에도 `print:hidden`을 더해 인쇄 화면에서 하단 도크가 찍히지 않게 했다(전체 화면 공통, 이 화면 때문에 필요).
- 인쇄: 별도 `@media print` CSS를 추가하지 않고 Tailwind `print:` variant(`print:hidden`)만 썼다 — 도구줄·고르기 폼·인쇄 버튼·도크를 인쇄 시 숨기고, 명세서 카드는 그대로 둔다. "출력 시각"은 `beforeprint` 이벤트에서 그 순간 시각으로 갱신해 실제 인쇄 시점을 찍는다(단순 페이지 렌더 시각이 아니다). PDF 저장은 별도 버튼 없이 같은 "인쇄 / PDF 저장" 버튼이 여는 브라우저 인쇄 대화상자의 "PDF로 저장" 대상을 쓴다(스펙이 요구한 그대로).
- 결정과 가정:
  - **마감 버전이 있으면(재오픈으로 상태가 "검토중"으로 돌아가도) 기본으로 그 최신 버전을 계속 보여준다** — "지금 계산"으로 자동 전환하지 않는다. `operations/monthly/page.tsx`의 기존 관례(재오픈 뒤에도 "이전" 라벨로 마지막 확정 스냅샷을 계속 보여줌)를 그대로 따른 것이다. 사용자가 명시적으로 다른 버전을 고르면 그 버전을 보여준다. 이 덕분에 "재오픈·재확정을 거친 뒤에도 이전 버전을 볼 수 있다"는 서비스 로직이 특별 분기 없이 자연스럽게 성립한다(한 번 마감된 운영월은 다시 "작성중"으로 못 돌아가므로, 버전이 있으면 항상 "closed" 모드).
  - **귀케어·운영팀의 "해당 콜 목록"은 그 날의 풀/일일인센 산출 콜 전체**다(직원별로 귀속되지 않는 공유 풀이라 — 기존 일일 화면도 같은 모양으로 보여준다). Therapist만 그 직원이 실제 담당한 콜로 좁힌다.
  - **마감 스냅샷에 그 직원의 행이 없으면**(예: 그 버전보다 나중에 생긴 직원) 금액 0과 `summary: null`을 그대로 보여주고 만들어 내지 않는다.
  - 월 명세서 조회 자체에는 새 `SensitivePermission`을 만들지 않았다 — 읍기 전용 화면이라 기존 라우트 접근 검사(`requireRouteAccess`, roles: administrator·settlement_manager)로 충분하다(다른 정산 조회 화면과 같은 패턴).
- 영향받지 않게 지킨 것: 세 직군의 계산 서비스(계산식)는 한 줄도 바꾸지 않았다. 기존 지급 확인 폼·패널(`PayoutConfirmationPanel` 등)과 네 정산 화면의 지급 확인 흐름도 그대로다(링크 한 줄만 추가).
- 범위 밖(다른 티켓): 마감 점검 화면의 "지급 재확인 미처리" 집계(33)는 이 티켓이 추가한 `listTherapistDailyPayoutConfirmationsForMonth`를 그대로 재사용할 수 있다. 33이 이 서비스 파일을 건드리면 머지 충돌이 날 수 있다(브리핑이 예고한 겹침).
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 785개 전부 통과(새 테스트: `monthly-statement-service.test.ts` 9건, `monthly-statement-view.test.tsx` 5건, `therapist-daily-settlement-service.test.ts`에 `listTherapistDailyPayoutConfirmationsForMonth` 2건, `monthly-closing-service.test.ts`에 버전 목록·버전별 스냅샷 5건, 기존 settlement 뷰 테스트들은 새 `canOpenStatement` prop만 추가해 그대로 통과).
  - `pnpm build` 통과(`/settlements/statement` 라우트 생성 확인).
  - `for f in scripts/validate-story-*.mjs; do node "$f" ...; done` — 기존 실패 `validate-story-4-6.mjs`(이 티켓과 무관, 메모의 기존 문제)만 남고 나머지 통과.
  - E2E는 전용 DB `vietnam_aesthetic_t32`·포트 3132(컨테이너 `vietnam-shell-02-e2e`)에서 새 스펙 `tests/e2e/story-ticket-32-monthly-statement.spec.ts`(5건: 미확정 명세서의 출근·콜 목록·금액·지급 확인·인쇄 버튼, 운영팀 직원도 지원, 카운터 접근 거절, 마감 버전의 "저장되지 않았습니다" 안내, `media: print`에서 도구줄·고르기 폼이 숨고 본문은 남음)과, 내가 고친 기존 화면에 걸린 `story-4-2`·`story-4-4`·`story-4-5`·`story-4-6`을 돌렸다. 새 스펙 5건 전부 통과(재실행으로 안정성도 확인). 기존 스펙은 `story-4-4`의 "confirm payout, reconfirm, and release" 테스트가 재확인 단계에서 "재확인 처리중" 멈춤으로 실패했는데, **커밋 d792663(내 변경 전, 완전히 새 DB·새 서버)에서 그대로 재현돼 기존 문제로 확인했다**(메모의 "서버 액션 응답은 200으로 오지만 화면이 pending 고착" 범주와 일치). 나머지 24건은 모두 통과.
- 뒤 티켓에 넘길 것: 33(마감 점검)이 Therapist 월 단위 지급 재확인 집계가 필요하면 이 티켓이 추가한 `listTherapistDailyPayoutConfirmationsForMonth`를 그대로 쓸 수 있다.
