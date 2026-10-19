# 03: 오늘 탭 — 내 콜과 오늘 현황

**What to build:** "오늘" 탭에 오늘 운영일과 앞으로 7일의 내 콜을 보이고, 맨 위에 오늘 현황(다음 콜까지 남은 시간, 오늘 한 것)을 둔다. 손님 연락처와 비고는 서버가 보내지 않는다. 보기만 한다. (스펙 D10–D12, M4, M6, M7, M13. 나누기 전 티켓 02)

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 내가 첫 번째 또는 두 번째 Therapist로 배정된 콜만 나온다. 미지명 콜과 다른 Therapist의 콜은 나오지 않는다. 서버는 01의 Therapist 검사가 돌려준 직원 id로 거른다. 요청에서 직원 id를 받지 않는다.
- [ ] 범위는 오늘 운영일과 앞으로 7일이고, 날짜별로 묶는다.
  - 각 콜에는 예약시각, 끝 시각, 코스, 객실, 상태가 나온다. 끝 시각은 실제 종료가 있으면 실제 종료, 없으면 표시 종료다.
  - 2인 코스면 함께하는 Therapist 이름도 나온다.
- [ ] 취소와 노쇼는 흐리게 남는다.
- [ ] 손님 정보는 이렇게 다룬다.
  - 연락처와 비고는 질의에서 아예 고르지 않는다(M6). 원장의 콜 행 DTO를 재사용하지 않는다.
  - 고객/메모나 예약자명은 보이되, 7자리 이상 이어진 숫자(공백·하이픈·점을 사이에 둔 것 포함)는 가린다(M13).
  - 방문별 요청과 고객 공통 선호·주의사항은 나온다.
- [ ] 맨 위 오늘 현황에는 다음 콜까지 남은 시간과 오늘 한 것 N이 나온다.
  - 한 것은 사용중·청소중·방문완료다. 원장 Therapist 현황 줄과 같은 판정으로 세고, 상태 목록을 따로 적지 않는다(M7).
  - 출근·퇴근 버튼(05), 퇴근 미입력 안내(06), 오늘 예상 코스 수당(07)이 들어갈 자리를 둔다.
- [ ] 상태를 바꾸는 버튼이나 링크는 없다.
- [ ] 01의 새로고침 공통 조각을 쓴다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - 숫자 가림 규칙: 붙은 번호, 공백·하이픈·점이 끼인 번호, 국가 번호. 6자리 이하 숫자는 그대로다.
  - Therapist 모듈 서비스(메모리 Prisma): 응답 전체를 문자열로 만들어 다른 Therapist의 콜, 연락처, 비고가 없는지 본다. 같은 DB에서 오늘 한 것이 원장 Therapist 현황 줄의 숫자와 같은지 본다.
  - E2E: 다른 Therapist의 콜, 연락처, 비고가 화면에 없는지 확인한다.

## Comments

**만든 것**

- `src/modules/therapists/therapist-today-view-service.ts`: `getTherapistTodayView({ employeeId, now?, prismaClient? })` → `TherapistTodayViewDto`(아래 "자리와 응답 타입" 참고). 좁은 select로 내 콜만 읽고(M6, 연락처·비고·금액·다른 Therapist 정보는 질의에서 아예 안 고름), `roomFloorFactsForDate`로 표시 종료를 구한다.
- `src/modules/therapists/therapist-today-rules.ts`: 순수 함수 `businessMinuteOf`, `sortByBusinessStartTime`, `minutesUntilNextCall`, `callGuestName`(DB 없음).
- `src/modules/therapists/therapist-text-redaction.ts`: 순수 함수 `redactLongDigitSequences`(M13 숫자 가림, DB 없음).
- `src/modules/calls/service-call-service.ts`: `isDoneServiceCallStatus` export. 원장 Therapist 현황 줄 루프(callCounts)가 이 함수를 그대로 쓰도록 내부 호출만 바꿨다(동작은 그대로, 단위테스트 1066→1078 전부 통과로 확인).
- 화면: `src/app/therapist/page.tsx`(오늘 탭) + `src/components/therapist/therapist-today-status.tsx`(오늘 현황 카드), `therapist-today-call-list.tsx`(날짜별 콜 카드 목록).
- i18n: `src/lib/i18n/messages/{ko,vi}.ts`에 `therapist.today.*` 키 9개.
- 테스트: `therapist-today-view-service.test.ts`(메모리 Prisma, `listTherapistAvailability`와 "오늘 한 것" 비교 포함), `therapist-today-rules.test.ts`, `therapist-text-redaction.test.ts`. E2E `tests/e2e/story-ticket-03-today-my-calls.spec.ts`.

**05·06·07이 끼워 넣을 자리와 응답 타입(요청대로 적음)**

- 응답 타입 이름은 `TherapistTodayViewDto`(`src/modules/therapists/therapist-today-view-service.ts`). 일반 객체 타입이라 필드를 더해도 기존 필드는 그대로다. M4가 정의하는 나머지 조각(오늘 출퇴근 상태, 퇴근 미입력 안내 여부, 오늘 예상 코스 수당)의 모양은 미리 추측해 넣지 않았다 — 값을 만들 티켓이 그 모듈의 반환값을 보고 필드를 더하면 된다.
- 05(출근·퇴근 버튼): `src/components/therapist/therapist-attendance-actions-slot.tsx`의 `TherapistAttendanceActionsSlot`(지금은 `null`만 반환). `page.tsx`에서 오늘 현황 카드 바로 위, 새로고침 컨트롤 바로 아래에 이미 자리를 잡아 뒀다. `page.tsx`를 건드리지 않고 이 컴포넌트 안만 채우면 된다.
- 06(퇴근 미입력 안내): `src/components/therapist/therapist-clock-out-notice-slot.tsx`의 `TherapistClockOutNoticeSlot`(지금은 `null`). `page.tsx`에서 오늘 현황 카드 바로 아래, 콜 목록 위에 자리를 잡아 뒀다.
- 07(오늘 예상 코스 수당): `src/components/therapist/therapist-today-status.tsx`의 `TherapistTodayStatus`가 받는 `children` prop. 지금은 "다음 콜까지"·"오늘 한 것" 두 카드만 그리고, 07이 `<SummaryCard .../>`를 children으로 넣으면 같은 줄(600px 미만은 한 열)에 세 번째 카드로 들어간다.

**새로 한 가정**

- "다음 콜까지 남은 시간"은 아직 시작 시각이 지나지 않은, 취소·노쇼가 아닌 콜 중 가장 이른 것까지로 봤다(지금 진행 중인 콜은 "다음"이 아님).
- 코스 표시는 `CoursePolicy.name`(월별 유효기간)이 아니라 `Course.code`만 보인다 — 원장의 `courseLabel`(코드+정책명) 재사용은 M6가 금지한 DTO 재사용에 닿아, 더 단순한 코드만 선택했다.
- 숫자 가림 표시는 원래 자릿수와 무관하게 고정된 문자열("•••••••")이다. 길이를 남기면 그만큼 정보가 샌다고 봤다.
- 숫자 가림은 D11 문장이 손님 이름에만 쓴 것처럼 보이지만, M13의 일반 규칙과 D11의 전체 취지(연락처 유출 방지)를 따라 방문별 요청·고객 공통 선호·주의사항에도 같은 가림을 적용했다.
- 날짜별 묶음은 그날 내 콜이 없어도 날짜 자체는 들어간다(8일 모두 보임).

**검증**

- `pnpm test:unit`: 1078 passed, 0 failed(병합 전 1066, 티켓 12 병합으로 12개 늘어남 — 모두 통과).
- `npx tsc --noEmit`: 에러 없음.
- `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`: `validate-story-4-6.mjs`만 실패(기존 실패, 메모리 `e2e-prod-known-failures.md`와 동일).
- 운영 빌드 E2E(DB `vietnam_aesthetic_th03`, 포트 3203): 새 스펙 `story-ticket-03-today-my-calls.spec.ts` 3/3 통과. 직접 관련 기존 스펙 `story-ticket-01-therapist-role-shell.spec.ts` 7/7 통과(오늘 탭이 더는 비어 있지 않아 "준비 중" 단언 한 줄을 "오늘 한 것" 카드로 바꿨다), `story-1-2-auth-rbac`·`story-i18n-default-vi`·`story-i18n-switch-ko`·`story-i18n-vi-screens` 21/21 통과.
- `story-1018-04-header-cards-therapist-strip.spec.ts`·`story-ledger-therapist-call-counts.spec.ts`를 같은 DB로 돌려보니 각 1건이 `chk_therapist_attendances_check_out_method_consistent` 제약 위반으로 실패했다 — 이 스펙들의 `checkIn` 헬퍼가 04가 더한 `checkOutMethod` 칸 없이 출퇴근 행을 직접 만들어서다. 04의 스키마 변경이 낸 기존 실패로 보고(03의 변경과 무관, `isDoneServiceCallStatus` 리팩터는 `listTherapistAvailability` 단위테스트로 행동 보존을 확인했다) 고치지 않았다.
- 통합 브랜치 tip(c1f012a, 티켓 12 포함)을 병합했다. 충돌 없음(i18n 파일만 자동 병합). 병합 뒤 단위테스트·tsc 재확인 완료.
