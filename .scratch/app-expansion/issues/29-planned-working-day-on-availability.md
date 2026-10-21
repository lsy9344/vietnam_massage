# 29: 가능 후보에 근무 예정 표시

**What to build:** 빠른 예약의 가능 코스 행마다 그날의 근무 예정, 휴무, 근무 미입력을 근무표에서 읽어 보여 주고, "당일 근무 예정"이 특정 시각까지 근무한다는 보장이 아니라는 안내를 함께 둔다. 두 명 코스에서 고르는 두 Therapist 각각에도 보인다. (스펙 F02, 스토리 12–13, 60, 104, V07)

**Blocked by:** 21, 27

**Status:** done

- [x] 휴무여도 코스 버튼이 꺼지지 않고 예약 저장이 막히지 않는다.
- [x] 카운터는 근무표를 읽기만 한다.
- [x] 근무 예정과 실제 출근 상태가 서로 다른 표시로 구분된다.
- [x] 콜 서비스 테스트로 가능 코스 행의 근무 예정 값을 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-29-planned-working-day-on-availability`). 막는 티켓 중 27은 `integration/app-expansion`에 이미 있었지만 21은 지정된 작업 시점에 아직 없어, `integration/app-expansion` 대신 `feat/ticket-21-quick-booking-two-therapists-and-override-path`(7563b95, integration 최신 b896b1a 포함) 위에서 분기했다(지시에 따른 예외). 보고 직전 `git merge integration/app-expansion`으로 끝을 합쳤다.
- `TherapistAvailabilityRowDto`(calls/service-call-service.ts)에 `plannedWorkingDayStatus: PlannedWorkingDayCellStatus`(근무 예정/휴무/미입력)를 더했다. `listTherapistAvailability`가 활성 Therapist id 목록과 조회 날짜로 27의 `listPlannedWorkingDayStatusesForDate`를 한 번 호출해 채운다. `available`/`courses[].verdict`/저장 경로(`createQuickBookingServiceCall`, `saveBasicServiceCallRow`)는 전혀 건드리지 않아 휴무가 코스 버튼이나 저장을 막지 않는다(체크리스트 1). 카운터가 호출하는 쪽은 읽기 전용 조회 하나뿐이라 "근무표는 읽기만 한다"(체크리스트 2)는 이 설계로 구조적으로 성립한다(별도 권한 검사를 추가하지 않았다 — 쓰기 경로는 27의 `setPlannedWorkingDay`뿐이고 이 티켓은 건드리지 않았다).
- `listPlannedWorkingDayStatusesForDate`(settlements/schedule-service.ts)의 `prismaClient` 파라미터 타입을 전체 `ScheduleServicePrismaClient`에서 `plannedWorkingDay.findMany`만 요구하는 좁은 `PlannedWorkingDayReadClient`로 좁혔다. calls 쪽 `listAssignedServiceCallsForEmployeeOnDate`의 `AssignedCallReadClient`(28이 반대 방향에 쓴 선례)와 같은 방식이라, `service-call-service.ts`의 `ServiceCallPrismaClient`에 같은 모양의 `plannedWorkingDay` 필드만 추가하면 캐스트 없이 그대로 넘길 수 있었다. 이로써 calls↔settlements 모듈 사이에 양방향 import(28: settlements→calls, 29: calls→settlements)가 생기는데, `tsc --noEmit`·`pnpm test:unit`·`pnpm build`(Turbopack) 모두 통과해 순환 import가 문제되지 않음을 확인했다(가정: 함수만 나중에 호출되는 순환은 이 번들러·런타임에서 안전하다).
- 화면: `TherapistAvailabilityView`(therapist-availability-view.tsx, 콜 원장 가능 코스와 빠른 예약 Therapist·코스 단계의 첫 Therapist 표에서 공유)에 "근무표" 칸을 "출근" 칸 바로 앞에 새로 더해 근무 예정/휴무/미입력을 `scheduleStatusLabel`(27)로 보여 준다(체크리스트 3: 출근과 다른 칸·다른 값으로 구분). 패널이 펼쳐지면 늘 "근무표의 근무 예정은 그 시각까지 근무한다는 보장이 아닙니다. 실제 출근 여부는 출근 칸을 확인하세요." 안내를 띄운다. 두 명 코스의 두 번째 Therapist 후보 목록(`TherapistStep`, quick-booking-panel.tsx)은 `TherapistAvailabilityView`를 쓰지 않는 별도 렌더라 거기도 같은 `scheduleStatusLabel`을 후보 이름 옆(출근 문구 앞)에 더했다. 새 i18n key `calls.availability.column.schedule`·`calls.availability.scheduleNote`를 ko/vi에 추가했고, 상태 글자 자체는 27이 만든 `scheduleStatus.*`를 그대로 재사용했다.
- 확인했지만 손대지 않은 것: `therapist-availability-panel.tsx`(`TherapistAvailabilityPanel`)는 티켓 20이 원장 위 상시 패널 자리를 없앤 뒤로 아무 데서도 쓰이지 않는 죽은 코드다(정의 외 호출부 없음, grep으로 확인). 이 티켓 범위가 아니라 그대로 두었다 — 정리하려면 별도 작업으로.
- 검증(운영 빌드, 전용 DB `vietnam_aesthetic_t29`·포트 3129, 컨테이너 `vietnam-shell-02-e2e`):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 830개 전부 통과. 새로 더한 것: `service-call-service.test.ts`에 `describe("therapist availability planned working day")` 3건(미입력 기본값, 직원·날짜별 근무 예정/휴무 분리 읽기, 휴무여도 가능 판정·코스 버튼·`createQuickBookingServiceCall` 저장이 그대로인지), `therapist-availability.test.tsx`에 근무표 칸·안내 문구(두 언어) 1건, `quick-booking-panel.test.tsx`의 두 번째 Therapist 후보 목록 테스트에 근무 예정/휴무 표시 단언 추가.
  - `for f in scripts/validate-story-*.mjs; ...`: 기존 실패인 4-6만 실패, 나머지 전부 통과.
  - `pnpm build` 성공(위의 양방향 import 포함).
  - 새 E2E `story-ticket-29-planned-working-day-on-availability.spec.ts`(2건): 빠른 예약에서 휴무인 첫 Therapist도 코스 버튼이 보이고 근무 예정인 두 번째 Therapist 후보에도 상태가 함께 보이며 둘 다 배정해도 저장이 되는지, 베트남어 화면에서 칸 제목·상태·안내 문구가 번역되는지. 둘 다 반복 실행(`--repeat-each=2`, `--workers=2`)에서도 안정적으로 통과.
  - 회귀 확인: 20·21·27·28 E2E(16건)를 함께 돌렸다. `--workers=2`에서 20·21의 저장 테스트 2건이 실패했지만, 메모의 기존 증상(운영 빌드에서 서버 액션은 200으로 오는데 화면이 pending에 남는 문제, e2e-prod-known-failures.md)과 같은 모양이었고 `--workers=1`로 다시 돌리니 그 7건(20·21 전체) 모두 통과했다 — 이 티켓의 회귀가 아니라 기존 환경 흔들림으로 판단. 27·28의 12건은 워커 2개에서도 전부 통과했다.
- 뒤 티켓에 넘길 것: 이 티켓을 막던 뒤 티켓은 없다. `TherapistAvailabilityPanel` 죽은 코드 정리는 필요하면 별도로.
