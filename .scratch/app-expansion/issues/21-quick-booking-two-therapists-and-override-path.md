# 21: 빠른 예약: 두 명 코스와 경고 확인 후 배정

**What to build:** 두 명이 필요한 코스에서는 패널에서 서로 다른 Therapist 두 명을 직접 고르고, 각자의 가능 여부와 출근 상태를 본다. 필수인 두 번째 Therapist를 비우거나 같은 사람을 두 번 고르면 저장 오류다. 시간이 겹치거나 수당이 없는 배정은 가능 버튼과 확실히 다른 "경고 확인 후 배정" 경로로만 받고, 그 경로에서 경고 문장을 먼저 보여 준 뒤 저장한다. (스펙 F01, 스토리 60–62, V03)

**Blocked by:** 11, 20

**Status:** done

- [x] 두 번째 Therapist 누락과 같은 사람 중복은 저장 오류다. 이 두 검사는 빠른 예약에만 적용하고, 원장 직접 입력과 과거 데이터에는 소급하지 않는다.
- [x] 겹치거나 수당이 없는 배정도 서버는 저장한다. 경고는 저장을 막지 않는다.
- [x] 경고 확인 경로는 가능 버튼과 모양과 문구가 달라 가능을 보장하는 것처럼 보이지 않는다.
- [x] 콜 서비스 테스트로 두 저장 오류와 경고가 있는 저장을, E2E로 두 명 선택 흐름을 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현(브랜치 `feat/ticket-21-quick-booking-two-therapists-and-override-path`, `integration/app-expansion` 7f96b4b 위에서 시작했다. 이 커밋에는 티켓 20까지 들어 있다). main 병합·push는 하지 않았다.
- 범위를 티켓 20의 `TherapistStep`(`quick-booking-panel.tsx`)과 경고 확인 후 배정 경로로 좁혔다. 티켓 23(방문별 요청)·29(근무 예정 표시)로 보이는 일은 하지 않았다.
- 서비스(`service-call-service.ts`):
  - `TherapistAvailabilityCourseDto`에 `requiresSecondTherapist: boolean`을 더했다(ticket 11의 코스 정책 값을 그대로 노출). 빠른 예약 패널이 두 번째 Therapist 영역을 보일지 이 값으로 정한다.
  - 같은 사람을 Therapist 1·2로 두 번 고르는 것은 **새** 검사(`assertDistinctTherapists`, 코드 `D_QUICK_BOOKING_DUPLICATE_THERAPIST`)로, 새 `createQuickBookingServiceCall`(→ 기존 `createServiceCallRow` 그대로 위임) 안에서만 돈다. 필수인 두 번째 Therapist 누락 검사(`assertSecondTherapistRequirement`)는 이미 `createServiceCallRow`/`saveBasicServiceCallRow`/`autosaveServiceCallRow` 모두에 있던 기존 공용 검사라 손대지 않았다.
  - 겹침·수당 없음 자체는 서버가 검사하지 않는다(`listTherapistAvailability`의 가능 코스 판정과 분리된 읽기 전용 정보라, 저장 경로는 그대로 therapist1Id/therapist2Id를 받아 쓴다) — 그래서 "경고는 저장을 막지 않는다"가 코드 변경 없이 성립한다.
- 가정과 결정:
  - "이 두 검사는 빠른 예약에만 적용하고, 원장 직접 입력과 과거 데이터에는 소급하지 않는다"는 이미 모든 저장 경로에 있던 두 번째 Therapist 필수 검사까지 없애라는 뜻으로 읽지 않았다(그러면 기존 동작이 깨진다). 새로 추가하는 **중복 Therapist** 검사만 빠른 예약 전용 `createQuickBookingServiceCall`에 두고, 원장 표의 새 행 직접 입력(`AddRowForm` → `createServiceCallRowAction` → `createServiceCallRow`)과 기존 행 저장(`saveBasicServiceCallRow`/`autosaveServiceCallRow`)은 그대로 둬 이 검사를 받지 않는다. 티켓 20의 Comments("서버의 assertSecondTherapistRequirement는 기존 저장 경로에 이미 있어 … 소급하지 않는다")도 같은 읽기였다.
  - 빠른 예약 패널의 두 번째 Therapist 후보 목록은 이미 고른 첫 번째 Therapist를 화면에서 미리 뺀다(저장 오류로 가기 전에 뻔한 중복을 막는 사용성 선택). 그래서 이 패널의 UI로는 중복을 실제로 만들 수 없고, 중복 검사는 콜 서비스 테스트로 직접 `createQuickBookingServiceCall`을 불러 확인했다(E2E 대상 아님, 체크박스의 "두 저장 오류"는 서비스 테스트로 본다는 티켓 문장과 맞다).
  - 두 번째 Therapist 후보는 "코스별 판정이 possible인 둘을 짝지으면 실제로도 유효한 짝"이라는 ticket 11의 판정식을 근거로 각 후보의 **개별** 행 판정만 본다(courseId로 고정한 그 코스의 verdict). `possible`이면 "가능" 버튼, `time_short`/`rate_missing`이면 "경고 확인 후 배정" 버튼이다 — 첫 번째 Therapist 쪽 가능 코스 표에도 같은 override 버튼을 더했다(한 명 코스에서도, 또는 두 명 코스의 첫 번째 선택에서도 경고 확인 후 배정을 쓸 수 있어야 스펙 문장("시간이 겹치거나 수당이 없는 배정" 일반)과 맞는다).
  - `TherapistAvailabilityView`(티켓 10–12)에 `onOverride?` 선택 prop을 더했다(주지 않으면 기존처럼 흐린 글자만 보여 하위 호환). 쓰이지 않는 `TherapistAvailabilityPanel`(티켓 20이 이미 원장에서 뺐지만 파일은 남겨둠)은 이 prop을 넘기지 않아 그대로다.
  - 경고 확인 버튼은 "가능" 버튼과 문구(코드·분·판정 문장 + " · 경고 확인 후 배정")와 색(테두리·글자가 `warning` 토큰)이 다르다. 클릭하면 바로 배정하지 않고 `ConfirmDialog`로 그 Therapist 이름과 구체적 경고 문장(시간 부족/수당 없음)을 먼저 보이고, 확인해야 `onChoose`/`onChooseSecond`를 부른다(취소하면 아무것도 바뀌지 않는다).
  - 코스·첫 번째 Therapist를 다시 고르면(가능 또는 경고 확인 후 배정) 두 번째 Therapist는 함께 비운다 — 다른 코스·배정이면 기존 짝이 맞지 않을 수 있어서다.
- 넘긴 것(뒤 티켓): 23(방문별 요청 칸)·29(근무 예정 표시)는 각각 "객실·메모" 단계와 가능 코스 행에 더한다. 이 둘 모두 이번 변경으로 건드린 파일(`quick-booking-panel.tsx`, `therapist-availability-view.tsx`)에 필드만 더하면 된다.
- 검증(전용 DB `vietnam_aesthetic_t21`, 포트 3121):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 805개 전부 통과(새 테스트: 서비스 레이어 6개 — 중복 거절·필수 누락 거절·정상 저장과 재시도 멱등·겹침/수당없음도 저장·원장 직접 입력은 중복을 막지 않음(소급 안 함)·가능 코스 DTO의 `requiresSecondTherapist`; `therapist-availability-view.test.tsx` 1개 — `onOverride` 유무에 따른 버튼 차이; `quick-booking-panel.test.tsx` 1개 — 두 번째 Therapist 영역·후보 제외·경고 확인 버튼 문구).
  - `for f in scripts/validate-story-*.mjs; ...`: `validate-story-4-6`만 실패(기존 실패).
  - `pnpm build` 성공.
  - E2E(운영 빌드): 새 스펙 2건(두 Therapist를 모두 "가능"으로 배정해 저장; 수당 없는 두 번째 Therapist를 "경고 확인 후 배정"으로, 취소 시 미배정·확인해야 배정) 모두 통과, 두 번 반복해 안정성 확인. 관련 기존 스펙(ticket-18·19·20·26, 2-4 D코스 마사지사2 필수) 16건 모두 통과.
  - 돌다가 발견한 기존 문제: 없음(이번 범위에서 새로 드러난 회귀 없음).
