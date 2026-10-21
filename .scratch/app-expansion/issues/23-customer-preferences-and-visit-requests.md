# 23: 고객 공통 선호·주의사항과 방문별 요청

**What to build:** 고객에 "고객 공통 선호·주의사항" 칸을, 콜에 "방문별 요청" 칸을 새로 더한다. 고객 화면에서 공통 정보를 적고, 원장의 펼침 영역과 빠른 예약의 객실·메모 단계에서 방문별 요청을 적는다. 기존 고객 메모와 콜 비고는 지금 이름 그대로 두고 옮기거나 나누지 않는다. 고객/메모는 지금처럼 콜에 적힌 손님 표기다. (스펙 F06, ADR 0003, 스토리 74–75, 84–85, V09)

**Blocked by:** 19, 20

**Status:** done

- [x] 두 칸이 따로 저장되고 각 화면에서 구분되어 보인다.
- [x] 마이그레이션은 기존 메모와 비고를 옮기거나 추측으로 다시 분류하지 않는다.
- [x] 고객 프로필(이름, 연락처, 공통 선호·주의사항)은 운영월 잠금과 상관없이 지금 권한대로 수정되고, 과거 콜의 고객/메모를 덮어쓰지 않는다.
- [x] 방문별 요청은 콜 저장 규칙(운영월 잠금, 충돌 검사, 감사)을 따른다.
- [x] 콜 서비스 테스트와 뷰 테스트로 두 칸의 저장과 표시를 확인한다. 새 라벨은 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-23-customer-preferences-and-visit-requests`, 통합 브랜치 `integration/app-expansion` 83a280a — 19·20 포함 — 위에서 시작). main 병합·push는 하지 않았다.
- 마이그레이션 `20261016230000_add_customer_preference_and_visit_request`: `customers.preference_note`, `service_calls.visit_request` 두 nullable 칸만 더한다. `UPDATE`나 백필이 없어 기존 `memo`/`note`를 옮기거나 추측으로 다시 채우지 않는다(ADR 0003).
- 스키마/서비스: `Customer.preferenceNote`, `ServiceCall.visitRequest`를 `CustomerDto`/`ServiceCallRowDto`, `customerInputSchema`/`serviceCallInputSchema`(→ autosave·create 스키마가 그대로 물려받음), `createCustomer`/`updateCustomer`/`writeServiceCallRow`/`toRowDto`/`toCustomerAuditSnapshot`/`toAuditSnapshot`에 `note`/`memo`와 같은 자리에 나란히 더했다. `writeServiceCallRow`는 손대지 않아 운영월 잠금(`assertWritableDate`)·STALE_CALL 조건부 갱신(`updateServiceCallAtVersion`)·감사 스냅샷을 다른 모든 칸과 똑같이 받는다.
- 화면:
  - 고객 화면(`customer-forms.tsx`): `CustomerFields`에 "공통 선호·주의사항" 칸(textarea, 500자)을 메모 밑에 더했다. 등록·정정 폼 모두 같다. `actions.ts`의 `createCustomerAction`/`updateCustomerAction`도 `preferenceNote`를 FormData에서 읽는다.
  - 빠른 예약 "객실·메모" 단계(`quick-booking-panel.tsx` `RoomStep`): 비고(note) 밑에 "방문별 요청" textarea를 더했다. `QUICK_BOOKING_STEP_OF_FIELD.visitRequest = "room"`(티켓 20이 이미 이 자리를 예약해 뒀다).
  - 원장 표(`editable-call-grid.tsx`): "방문별 요청" 열을 비고 옆에 더하고, 비고·확인값과 같이 "수납·정산"·"전체" 보기에서만 보인다(티켓 19의 "드물게 쓰는 입력" 취급을 그대로 따름). `EDITABLE_CALL_FIELDS`에도 note 다음 confirmationCode 앞자리로 넣어 키보드 이동 순서에 들어간다.
  - 콜 상세 패널(`call-detail-panel.tsx`, 원장의 펼침 영역): 방문별 요청을 읽기 전용 `DetailRow`로 보여 준다(편집은 원장 칸이나 빠른 예약에서).
- 결정과 가정:
  - **원장에서 "방문별 요청"이 보이는 보기**: 티켓과 과제 설명의 "원장의 펼침 영역"을 티켓 19가 실제로 구현한 "드물게 쓰는 입력(비고, 확인값)은 보기에 따라 보인다" 방식과 같게 다뤘다. 비고와 똑같이 예약·현장 보기에는 없고 수납·정산·전체 보기에만 있다. 상시 보이는 자리가 필요했다면 다른 티켓이 말할 것이다.
  - **콜 상세 패널은 읽기 전용으로 추가**: 그 패널의 다른 칸(시간·객실·코스·Therapist 등)도 모두 `DetailRow`(읽기 전용)이고, 편집 가능한 하위 폼은 고객 연결 정정(전용 서버 액션)뿐이다. 방문별 요청을 패널 안에서 바로 고치는 별도 폼은 만들지 않고, 원장 칸 편집이나 빠른 예약과 같은 기존 저장 경로로만 고치게 했다.
  - **고객 화면 방문 이력 표는 그대로 둠**: `CustomerVisitHistoryRowDto`(방문 이력 표: 날짜·코스·Therapist·상태·고객메모)에 `visitRequest`를 더하지 않았다. 그 표는 지금도 비고를 보여주지 않아(콜의 "메모성" 칸을 넣지 않는 기존 관례) 방문별 요청도 넣지 않는 쪽이 일관되고, "최근 방문에서 코스·Therapist·방문별 요청을 보고 체크해 가져오기"는 티켓 24(다음 티켓, 고객 단계)의 몫이라 그 화면·DTO 확장은 넘긴다.
  - **고객 프로필 수정은 기존 권한 그대로**: `updateCustomer`는 운영월 검사를 전혀 하지 않는 기존 구조를 그대로 둬서, 공통 선호·주의사항도 잠금과 무관하게 지금 권한(`call:write`)대로 고쳐진다. 과거 콜의 `customerMemo`는 손대지 않는다(서버스 테스트로 확인).
- i18n: `calls.column.visitRequest`("방문별 요청"/"Yêu cầu riêng lần ghé"), `calls.customer.field.preferenceNote`("공통 선호·주의사항"/"Sở thích·lưu ý chung")를 ko/vi 모두에 더했다.
- 검증(전용 DB `vietnam_aesthetic_t23`, 포트 3123):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 822개 전부 통과. 새 테스트: 고객 공통 선호·주의사항 생성/정정(메모와 분리), 콜의 방문별 요청 생성/조회/수정(비고와 분리), STALE_CALL·운영월 잠금 거절, `row_changed` 감사 스냅샷에 방문별 요청이 전후로 남는지, 빠른 예약 RoomStep·원장 보기별 열 구성·고객 화면 패널 뷰 테스트.
  - `for f in scripts/validate-story-*.mjs; do node "$f" ...; done` → `validate-story-4-6`만 실패(기존 실패, 메모와 일치). **주의:** `npx prisma format`을 한 번 전체 스키마에 돌렸다가 Employee·UserAccount 등 내가 손대지 않은 모델들의 공백 정렬이 전부 바뀌어 1-7·2-2·4-1·4-3·5-3·5-5 검증 스크립트가 거짓 실패했다. 커밋 전 `git diff`로 스키마 변경이 Customer·ServiceCall 두 모델에만 있는지 확인하고 되돌려, 최종 diff는 그 두 모델뿐이다(재확인 결과 4-6만 실패).
  - `pnpm build` 성공.
  - E2E(운영 빌드, `vietnam_aesthetic_t23`·포트 3123): 새 스펙은 만들지 않았다(티켓 체크리스트가 콜 서비스·뷰 테스트만 요구). 고친 화면에 걸린 기존 스펙 8개(`2-1`, `2-2`, `2-3`, `ticket-13`, `ticket-19`, `ticket-20`, `ticket-22`, `ticket-25`) 32건 중 `2-1:285`("날짜별 빈 상태... stable ID") 1건만 실패, 나머지 28건 통과, 그 스펙의 나머지 3건은 serial이라 "did not run". `2-1:285`는 임시 워크트리로 기준 커밋 83a280a를 운영 빌드로 직접 재현해 티켓 23 이전부터 있던 문제(원장 빈 상태 문구가 전화카드 목록과 함께 DOM에 두 번 있어 `getByText` strict mode 위반)임을 확인했다. 병합 직전에 받은 통합 브랜치 끝(아래)에 이미 그 수정이 들어 있다.
- 넘기는 것: 티켓 24(새 고객+최근 방문 가져오기)가 고객 단계에서 쓸 "최근 방문" 표에 코스·Therapist·방문별 요청을 보여주고 체크해 가져오는 UI와 `CustomerVisitHistoryRowDto` 확장은 그대로 남겨 뒀다.
