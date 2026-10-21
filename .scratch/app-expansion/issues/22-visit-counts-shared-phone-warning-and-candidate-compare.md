# 22: 고객 방문 건수, 같은 연락처 경고, 후보 비교

**What to build:** 고객 화면에서 열린 방문 이력 위에 방문완료, 노쇼, 취소 건수를 0건까지 포함해 보여 준다. 검색 후보 중 둘 이상의 연락처가 숫자만 비교했을 때 같으면 "같은 연락처의 고객이 여러 명입니다"를 보이고, 이름·연락처·최근 방문일·방문완료 건수를 나란히 비교해 직접 고르게 한다. (스펙 B09, ADR 0003, 스토리 76–80, V01·V09 일부)

**Blocked by:** 03

**Status:** done

- [x] 예약, 사용중, 청소중 콜은 세 건수에 들어가지 않지만 이력 표에는 남는다.
- [x] 연락처가 비어 있는 고객은 비교 대상이 아니다. 국가번호는 해석하지 않는다.
- [x] 자동 연결이나 병합이 없다. 고르기 전에는 어떤 고객에게도 콜이 붙지 않고, 검색이 저장을 막지 않는다.
- [x] 콜 서비스 테스트로 건수와 경고 반환값을, 뷰 테스트로 그 값을 그리는지 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-22-visit-counts-shared-phone-warning-and-candidate-compare`, `integration/app-expansion` b322927 위). 막는 티켓 03은 이미 통합 브랜치에 들어 있어 그 위에서 바로 시작했다. 스키마 변경이 없어 새 Prisma 마이그레이션은 만들지 않았다.
- 서비스(`src/modules/calls/service-call-service.ts`): `CustomerVisitCandidateDto`에 `completedVisitCount`(그 후보의 방문완료 건수)와 `sharedPhone`(다른 후보와 연락처가 숫자만 비교해 같으면 true)을 추가했다. `searchCustomerVisitCandidates`가 **이번 검색이 돌려준 후보들 사이에서만** 연락처를 `phoneDigits()`(숫자 외 문자 제거)로 묶어 그룹 크기가 2 이상이면 그 그룹 전체에 `sharedPhone: true`를 단다. 즉 "경고"는 전체 고객 데이터가 아니라 그 검색 결과 안에서의 중복이다 — 같은 번호를 쓰는 두 고객이 있어도 한쪽만 걸리는 검색어라면 혼자 나와 경고가 없다(가정, 스펙 문구 "검색 후보 중"을 그대로 따름). 연락처가 빈 문자열/없음이면 비교하지 않는다(`phoneDigits`가 빈 문자열이면 그룹에 넣지 않음). 국가번호는 해석하지 않는다 — 숫자만 비교하므로 "+84…"와 "0…"은 자리수가 달라 같은 사람이어도 다르게 본다(의도된 동작, 단위 테스트로 고정).
  `listCustomerVisitHistory`가 주는 행에서 건수만 뽑는 새 함수 `customerVisitCountsFromRows(rows): CustomerVisitCountsDto({completedCount, noShowCount, canceledCount})`를 추가했다(기존 `ledgerStatusCountsFromRows`와 같은 모양). DB를 다시 읽지 않고 화면이 이미 받은 이력 배열로 센다.
- 화면: 새 재사용 컴포넌트 두 개를 `src/components/domain/`에 뒀다(고객 화면뿐 아니라 24의 빠른 예약 고객 단계, 25의 고객 연결 정정도 같은 콜 서비스 검색 결과를 그대로 넘겨 재사용하도록).
  - `customer-visit-counts.tsx`의 `CustomerVisitCounts`: `ledger-status-counts.tsx`와 같은 칩 한 줄로 방문완료·노쇼·취소를 0건 포함해 보인다. 같은 i18n 키(`calls.summary.completed/noShow/canceled`, `calls.summary.countSuffix`)를 재사용해 새 라벨 번역을 늘리지 않았다.
  - `customer-candidate-compare.tsx`의 `CustomerCandidateCompare`와 `isCustomerCandidateChosen`: 경고(`ScreenState kind="warning"`, role="alert") 아래에 이름·연락처·최근 방문일·방문완료 건수 표를 그린다. 이름 칸의 버튼이 기존 후보 목록과 같은 `role="option"`/`id="customer-option-{index}"`라, 방향키·Enter 선택 로직(`customer-screen.tsx`)을 전혀 바꾸지 않고 뷰만 갈아 끼웠다.
  - `customer-screen-view.tsx`는 `candidates.some(c => c.sharedPhone)`일 때만 비교 표로 바뀌고, 그 전까지는 기존 후보 목록(카드형 `<ul>`) 그대로다. 열린 방문 이력 위에는 `visitCounts`(page.tsx가 `customerVisitCountsFromRows(history)`로 만들어 내려줌, 고른 고객/메모가 없으면 null)가 있을 때만 `CustomerVisitCounts`를 그 이력 표 바로 위에 둔다.
- 결정과 가정:
  - "연락처가 비어 있는 고객은 비교 대상이 아니다"를 "검색 결과 중 유효한 연락처가 둘 이상 겹칠 때만 경고"로 구현했다. 후보 하나만 연락처가 있어도 다른 후보가 없으면 경고가 없다(당연한 결과).
  - 비교 표는 경고가 뜨는 둘 이상 후보뿐 아니라 **그 검색의 모든 후보**를 보여준다(연락처가 겹치지 않는 후보도 포함). 일부만 추려 숨기면 "검색이 선택을 막는다"는 인상을 줄 수 있어, 표/목록 전환만 하고 후보 집합은 그대로 뒀다(가정).
  - 자동 연결·병합 기능 자체를 만들지 않았다(병합 UI나 서비스 작업이 없다) — 티켓 문구가 "없다"를 요구하므로 아무것도 추가하지 않는 것이 구현이다.
- 범위 밖(다음 티켓에 넘김): 24(빠른 예약 고객 단계의 최근 방문 가져오기, 새 고객 함께 저장)와 25(콜 상세의 고객 연결 정정 서비스·액션)는 손대지 않았다. 둘 다 이번에 만든 `CustomerVisitCounts`/`CustomerCandidateCompare`/`isCustomerCandidateChosen`과 `completedVisitCount`/`sharedPhone` 필드를 그대로 재사용할 수 있다.
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 통과(655개 전부, 신규/수정 테스트 포함: `service-call-service.test.ts`의 고객 후보·건수 테스트, `customer-screen.test.tsx`, 새 `customer-visit-counts.test.tsx`·`customer-candidate-compare.test.tsx`).
  - `pnpm lint`: `validate-story-4-6`만 기존 실패(메모·브랜치 선례와 일치, 이번 변경과 무관).
  - `pnpm build` 통과.
  - E2E는 운영 빌드로 컨테이너 `vietnam-shell-02-e2e`에 전용 DB `vietnam_aesthetic_t22`·포트 3122를 올려 확인했다. 새 스펙(`story-ticket-22-visit-counts-and-candidate-compare.spec.ts`, 2건: 연락처 공유 경고+비교 표+고르기 전 미연결+0건 포함 건수, 겹치지 않는 검색의 평상 목록) 통과. 고객/원장 화면을 같이 건드리는 기존 스펙 `story-ticket-03-ledger-split.spec.ts`(10건) 회귀 없이 통과. 서버 PID만 종료했고 main·다른 워크트리는 건드리지 않았다.
