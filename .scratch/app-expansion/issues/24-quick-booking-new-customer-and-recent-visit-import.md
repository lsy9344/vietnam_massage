# 24: 빠른 예약: 새 고객 함께 저장과 최근 방문 가져오기

**What to build:** 빠른 예약의 고객 단계에서 새 고객(이름, 연락처, 고객 공통 선호·주의사항)을 만들어 콜과 한 트랜잭션에 저장한다. 기존 고객을 고르면 방문완료·노쇼·취소 건수, 같은 연락처 경고, 최근 방문(날짜, 코스, 담당 Therapist, 방문별 요청)을 보여 주고, 코스·Therapist·방문별 요청 중 체크한 항목만 새 예약에 가져온다. (스펙 F01·F06, ADR 0003, 스토리 57, 68, 71–73, 91, V03·V09)

**Blocked by:** 22, 23

**Status:** done

- [x] 새 고객과 콜을 같은 요청 id로 두 번 보내도 고객과 콜이 하나씩만 생긴다. 고객만 만들어지고 콜이 없는 부분 성공이 남지 않는다.
- [x] 자동 복사가 없고 체크한 항목만 초안에 들어간다.
- [x] 가져온 코스나 Therapist가 지금 비활성이거나 유효하지 않으면 가져올 수 없음으로 보이고, 현재 기준의 검사를 우회하지 않는다.
- [x] 패널에서 고객 화면으로 바로 갈 수 있다.
- [x] 콜 서비스 테스트로 재시도 때 중복이 없음을, E2E로 새 고객 예약 흐름을 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-24-quick-booking-new-customer-and-recent-visit-import`, `integration/app-expansion` 0041bab — 23까지 포함 — 위에서 시작). 스키마 변경이 없어(기존 콜럼만 재사용) 새 Prisma 마이그레이션은 만들지 않았다.
- 서비스(`src/modules/calls/service-call-service.ts`):
  - `serviceCallCreateInputSchema`(`service-call-schema.ts`)에 `newCustomer: customerInputSchema.nullable().optional()`을 더하고, `customerId`와 동시에 오면 거절하는 `.refine`을 달았다(세 갈래 중 하나). `customerInputSchema` 정의를 그 앞으로 옮겼다(쓰려면 먼저 선언돼야 한다).
  - `createServiceCallRow`가 `newCustomer`를 받으면, 같은 요청 id의 콜이 아직 없을 때만(멱등 조회가 먼저) 같은 트랜잭션 안에서 고객을 만들고(새 함수 `createCustomerRecord`, `createCustomer`와 감사 로직을 공유) 그 id를 `customerId`로 써서 `writeServiceCallRow`를 부른다. 콜 생성이 그 트랜잭션 안에서 실패하면(동시 같은 요청 id의 유일성 위반 등) Prisma `$transaction` 롤백으로 방금 만든 고객도 함께 사라져, 고객만 남는 부분 성공이 생기지 않는다. 재시도(같은 요청 id)는 멱등 조회가 먼저 걸려 고객 생성 코드 자체를 타지 않는다. `createQuickBookingServiceCall`은 그대로 위임하므로 빠른 예약도 같은 경로를 쓴다.
  - `CustomerVisitHistoryRowDto`에 `courseId`·`therapist1Id`·`therapist2Id`·`visitRequest`를 더했다(이름표만 있던 기존 칸과 나란히). 새 순수 함수 `mostRecentCustomerVisit(rows)`: 상태별 우선순위가 아니라 날짜·예약시각만으로 가장 최근 방문 하나를 고른다(고객 화면의 전체 이력 정렬인 `compareVisitHistory`와는 다른 기준이라 분리했다).
  - 새 서버 액션 `loadCustomerVisitSummaryAction(customerId)`(`actions.ts`, `requireRouteAccess("/calls")`만 검사, `loadTherapistAvailabilityAction`과 같은 수준): `listCustomerVisitHistory`로 읽어 `{counts, recentVisit}`을 돌려준다. 고객 단계의 검색은 22가 만든 `searchCustomerLinkCandidatesAction`(`call:write`)을 그대로 재사용했다(새 액션을 만들지 않음).
- 화면(`quick-booking-panel.tsx`의 `CustomerStep`):
  - 검색을 `customers` prop의 로컬 필터에서 22의 `searchCustomerVisitCandidates`(서버 액션, 디바운스) 기반으로 바꿔 `CustomerCandidateCompare`/같은 연락처 경고를 그대로 받는다(티켓 25의 `CallCustomerLinkCorrection`과 같은 패턴). `kind: "memo"` 후보는 연결할 id가 없어 미리 뺀다.
  - 검색 디바운스 상태(`candidates`/`query`)와 방문 요약(`visitSummary`, `customerId`가 바뀔 때마다 다시 불러옴)은 `TherapistStep`의 가능 코스 로딩과 같은 자리(`QuickBookingPanel`)에 두고 `CustomerStep`에는 props로 내려, 기존 "정적 렌더" 단위 테스트 방식을 그대로 쓸 수 있게 했다.
  - "새 고객 만들기" 버튼은 `draft.newCustomer`를 빈 값으로 채워 모드를 켜고(이름·연락처·공통 선호만, memo는 비워 둠 — 티켓 문구가 이 셋만 요구), "검색으로 돌아가기"는 `null`로 끈다. 고른 고객·새 고객·검색/메모만, 세 모드는 서로 배타적이다.
  - 최근 방문 가져오기(`RecentVisitImport`): 체크박스 세 개(코스·Therapist·방문별 요청). 체크 여부는 "지금 초안 값이 그 방문의 값과 같은가"로만 판단한다(별도 플래그 없음) — 자동 복사가 없다는 요구를 그대로 만족한다. 비활성·유효하지 않은 값(`options.courses`/`options.therapists`에 없음)은 체크박스를 비활성화하고 "가져올 수 없음"을 보인다. 실제 거절은 그대로 서비스(`assertActiveCourse`/`assertActiveEmployee`, 손대지 않음)가 하므로 화면이 막아도 검사를 우회하지 않는다.
  - "고객 화면으로 이동" 링크(스토리 91)는 티켓 25가 만든 `customerScreenHref`를 그대로 재사용해 고객 단계 맨 위에 항상 보인다(고른 고객/메모/빈 검색에 따라 대상이 바뀐다).
- i18n: `calls.quickBooking.customer.{createNew,backToSearch,recentVisitTitle,cannotImport,importCourse,importTherapist,importVisitRequest}` 7개를 ko/vi에 추가했다. 그 밖에는 기존 키(`calls.detail.customerLink.goToCustomerScreen`, `calls.customer.field.*`, `calls.search.label`, `customers.visitCounts.aria`, `customers.duplicatePhone.*`)를 재사용해 같은 문구의 중복 키를 만들지 않았다(티켓 20의 선례).
- 결정과 가정:
  - "새 고객"에 고객 메모(Customer.memo)는 받지 않는다 — 티켓 문구가 "이름, 연락처, 고객 공통 선호·주의사항"만 꼽아서다. 콜의 고객/메모(customerMemo)는 그대로 독립된 자유 입력 칸으로 둔다(바뀌지 않음).
  - "최근 방문"은 하나만 보인다(복수 이력이 아니라 가장 최근 것). 상태 우선순위가 아니라 순수하게 날짜·시각 기준 최신을 고른다 — 고객 화면의 "완료가 먼저" 정렬과는 다른 질문("새 예약에 무엇을 다시 쓸까")이라 섞지 않았다.
  - Therapist 가져오기는 한 체크박스로 therapist1Id·therapist2Id를 함께 다룬다(그 방문이 두 명이었으면 둘 다, 한 명이었으면 하나만). 부분적으로(둘 중 하나만) 가져오는 UI는 만들지 않았다.
  - 가져온 코스·Therapist는 Therapist·코스 단계에 courseId/therapist1Id로 그대로 들어가, 그 단계의 기존 "선택 해제" 버튼과 가능 코스 목록이 평소(가능 버튼으로 고른 것)와 똑같이 다룬다 — 이 단계·방문별 요청 칸(RoomStep)에 새 코드를 더하지 않았다.
  - `customerId`+`newCustomer` 동시 지정을 막는 `.refine`은 방어선이다(화면 UI로는 만들 수 없는 조합, 서버 액션 직접 호출 대비).
- 범위 밖(건드리지 않음): 티켓 29(근무 예정 표시)가 같은 `quick-booking-panel.tsx`/`therapist-availability-view.tsx`를 동시에 고치고 있어, Therapist·코스 단계 자체와 가능 코스 판정에는 손대지 않았다. 원장 그리드(`editable-call-grid.tsx`)의 직접 입력 경로도 그대로 둔다(새 고객 만들기는 빠른 예약 고객 단계에만 UI가 있다).
- 검증(전용 DB `vietnam_aesthetic_t24`, 포트 3124):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 851개 전부 통과. 새/수정 테스트: 서비스 레이어(새 고객+콜 한 트랜잭션 생성, 재시도 시 고객·콜 모두 하나, customerId+newCustomer 동시 지정 거절, `mostRecentCustomerVisit` 상태무관 최신 선택, `listCustomerVisitHistory`의 새 필드), 패널 정적 렌더(고객 화면 이동 링크, 새 고객 만들기 모드 전환과 필드 오류, 최근 방문 가져오기의 체크 상태·비활성 표시).
  - `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done` → `validate-story-4-6`만 실패(기존 실패, 메모와 일치).
  - `pnpm build` 성공.
  - E2E(운영 빌드, `vietnam_aesthetic_t24`·포트 3124): 새 스펙(`story-ticket-24-quick-booking-new-customer-and-recent-visit-import.spec.ts`, 3건: 새 고객+콜 생성, 기존 고객의 건수·최근 방문·체크한 것만 가져오기, 패널에서 고객 화면 이동) 2회 반복 모두 통과. 관련 기존 스펙(2-1·2-2·2-3·2-6, i18n 3종, ticket-13·18·19·20·21·22·25·26) 50건 중 ticket-20의 "PC 폭" 저장 뒤 원장 행 표시 1건만 한 번 실패했으나, 그 스펙만 단독 재실행하고 ticket-24와 함께 다시 돌리니 모두 통과했다 — 메모의 "서버를 막 띄운 직후 첫 실행에서 자동 갱신이 늦었다"(ticket16 기록)와 같은 콜드스타트 증상으로 판단했다. 서버 PID만 종료했고 main·다른 워크트리는 건드리지 않았다.
- 넘기는 것: 없음(브리핑이 지정한 범위를 모두 끝냈다). 티켓 29가 같은 파일을 동시에 고치고 있어 병합 담당이 두 변경을 합칠 때 `quick-booking-panel.tsx`/`.test.tsx`의 충돌 가능성이 있다(이 티켓은 `CustomerStep`, 29는 `TherapistStep`/가능 코스 쪽이라 겹치는 줄은 적을 것으로 보인다).
