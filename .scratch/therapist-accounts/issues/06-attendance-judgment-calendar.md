# 06: 근태 판정과 근태 달력 — 지각, 결근, 퇴근 미입력, 예정 없는 출근

**What to build:** 근태 판정(지각, 결근, 퇴근 미입력, 예정 없는 출근)을 순수 함수 하나로 두고, "근태" 탭에 월 달력으로 보인다. 운영일이 끝난 뒤에도 퇴근 미입력이면 "오늘" 탭과 근태 탭에 안내가 뜬다. 같은 판정을 11의 관리자 현황이 쓴다. (스펙 D15–D18, M4, M12. 나누기 전 티켓 04)

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] 판정 규칙은 `CONTEXT.md`와 같다(M12).
  - 지각은 출근 예정 시각보다 1분이라도 늦은 출근이고, 늦은 분 수를 같이 낸다. 출근 예정 시각이 비어 있으면 판정하지 않는다.
  - 결근은 근무 예정인 날 운영일이 끝날 때까지 출근 기록이 없는 것이다. 휴무나 미입력인 날은 결근이 아니다.
  - 퇴근 미입력은 출근만 있고 퇴근이 없는 상태다.
  - 예정 없는 출근은 휴무이거나 근무 예정이 입력되지 않은 날의 출근이다.
- [ ] 출근 예정 시각과 출근 시각의 비교는 기존 출퇴근 서비스의 밤샘 분 표현을 따른다. 운영일이 끝났는지는 기존 출퇴근·원장의 운영일 기준을 그대로 쓴다. 오늘 운영일은 아직 결근으로 판정하지 않는다.
- [ ] 판정은 수당 계산에 들어가지 않는다.
- [ ] 근태 탭은 월 단위 달력이고, 지난 달로 넘길 수 있다. 날마다 아래 내용이 보인다.
  - 근무 예정·휴무·미입력 중 무엇인지와 출근 예정 시각
  - 출퇴근 시각과 찍힌 방식(04)
  - 지각 n분, 결근, 퇴근 미입력, 예정 없는 출근, 만근 인정 여부
  - 그날 휴무 신청이나 정정 요청의 상태(08, 09가 채운다)
- [ ] 운영일이 끝난 뒤에도 퇴근 미입력이면 "오늘" 탭(03이 둔 자리)과 근태 탭에 "퇴근 미입력 — 정정 요청" 안내가 뜬다. 요청 버튼은 09가 단다.
- [ ] 서버는 01의 Therapist 검사가 돌려준 직원 id로만 읽는다. 01의 새로고침 공통 조각을 쓴다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - 판정 규칙(순수 함수): 예정 시각과 같은 분(지각 아님)과 1분 늦음, 예정 시각 없음, 휴무 날 출근, 미입력 날 출근, 밤샘 근무, 오늘 운영일(결근 아님), 끝난 운영일의 퇴근 미입력
  - Therapist 모듈 서비스(메모리 Prisma): 근태 달력의 한 달 결과와 방식 표시
  - E2E: 근태 달력이 보이고, 퇴근 미입력 안내가 뜬다.

## Comments

**판정 순수 함수(11도 그대로 쓴다):** `judgeTherapistAttendanceDay(input: TherapistAttendanceDayJudgmentInput): TherapistAttendanceDayJudgment`
(`src/modules/therapists/therapist-attendance-judgment.ts`).
- 입력: `{ planStatus: PlannedWorkingDayCellStatus, plannedStartTime: string|null, checkInTime: string|null, checkOutTime: string|null, dayStart: string, isOperatingDayEnded: boolean }`.
- 출력: `{ lateMinutes: number|null, isAbsent: boolean, isClockOutMissing: boolean, isUnscheduledAttendance: boolean }`.
- 지각 비교는 밤샘용 `computeStandbyMinutes`류(+1440, 퇴근<출근일 때만 보정)를 쓰지 않는다. 대신 03이 이미 만들어 둔 `businessMinuteOf(clock, dayStart)`(`therapist-today-rules.ts`)로 예정 시각·출근 시각을 **각자** 영업일 분으로 바꿔 비교한다 — 서로를 비교해 보정하면 밤샘 근무에서 일찍 온 출근이 큰 지각으로 오판된다(단위 테스트 "without the +1440 standby bug"로 고정). `isAbsent`·`isClockOutMissing`은 `isOperatingDayEnded`가 true일 때만 켜진다(오늘 운영일은 결근·퇴근미입력 모두 아니다).
- `isOperatingDayEnded`는 함수가 계산하지 않는다. 호출하는 쪽이 `날짜 < businessTodayServiceDate(...)`로 정한다(코드베이스 지도 규칙 그대로).

**좁은 DB 조회(새로 더함, toDto·minuteToTime 변환을 다시 쓴다):**
- `listTherapistAttendanceForEmployeeInRange({ employeeId, startDate, endDate, prismaClient? })` → `TherapistAttendanceDto[]` (`src/modules/settlements/therapist-attendance-service.ts`). 직원 하나·기간 하나. `listTherapistAttendanceForDate`를 날짜마다 부르면 31×전원이 되는 것을 피한다. 비활성 줄은 뺀다. (가정) 이 파일의 다른 export와 달리, 쓰기 메서드가 있는 전체 클라이언트 타입을 요구하지 않는 읽기 전용 좁은 타입(`TherapistAttendanceRangeReadClient`)을 새로 둔다 — service-call-service.ts의 `DisplayEndReadClient` 선례와 같은 방식.
- `listPlannedWorkingDayStatusesForEmployeeInRange({ employeeId, startDate, endDate, prismaClient? })` → `PlannedWorkingDayDayStatusDto[]`(`src/modules/masters/planned-working-day-query.ts`). 행 없는 날은 미입력으로 채운다.

**근태 달력 합치기(11도 쓸 수 있게 공개):** `getTherapistAttendanceCalendar({ employeeId, monthKey?, now?, prismaClient? })` → `TherapistAttendanceCalendarMonthDto`(`src/modules/therapists/therapist-attendance-calendar-service.ts`). `monthKey` 없으면 오늘이 속한 달. 달 경계는 DB 없이 `calculateOperatingMonthRange`(순수)로만 정해, 운영월 레코드가 아직 없는 지난 달도 빈 달력으로 열린다. 날마다 `requestStatus: TherapistAttendanceDayRequestStatus`(`{kind:"day_off"|"correction", status:"pending"|"approved"|"rejected"|"canceled"|"expired", rejectionReason}|null`) 자리를 두고 06은 항상 `null`을 돌린다 — 08·09는 이 타입에 맞춰 실제 값을 채우면 된다(모양만 정해 둠).

**퇴근 미입력 안내(오늘 탭·근태 탭 공용):** `listTherapistClockOutMissingDates({ employeeId, now?, prismaClient? })` → `string[]`(같은 파일). (가정) 운영월 경계와 무관하게 최근 31일만 돌아본다. `TherapistTodayViewDto.today`에 `clockOutMissingDates: string[]` 필드를 더했다(05·07이 넓히는 것과 별개로 이 필드만). `TherapistClockOutNoticeSlot`(03이 둔 자리)을 채워 오늘 탭·근태 탭 양쪽에서 쓴다. 요청 버튼은 비워 두고 09가 `action` prop으로 더하면 된다.

**화면(가정, 선례 없음):** 월 달력은 월요일 시작 7열 그리드이고, 칸은 날짜 숫자 + 가장 급한 배지 기호 하나만 보인다. 누르면 `ModalPanel`(600px 미만 전체 화면 시트)에 근무표·출퇴근·방식·판정·신청 자리를 `DetailRow`로 모두 보인다 — 390px 칸에 모든 정보를 바로 적으면 못 읽기 때문. 달 이동은 `?month=YYYY-MM` 서버 Link(자바스크립트 없이 동작). 근무표 상태 라벨은 기존 `scheduleStatusLabel`/`scheduleStatusTone`(`src/lib/i18n/codes.ts`, 27·29와 공유)를 그대로 쓴다. 출퇴근 방식 라벨은 새로 만든 `therapistAttendanceMethodLabel`(같은 파일, `attendanceMethod.*` 키)을 09·11도 재사용할 수 있다.

**검증:** `pnpm test:unit` 1124 passed / 0 failed. `npx tsc --noEmit` 에러 없음. `pnpm lint`(검증 스크립트 전체)는 `validate-story-4-6.mjs`만 실패(기존 실패, README 확인). 운영 빌드 E2E(DB `vietnam_aesthetic_th06`, 포트 3206): 새 스펙(`story-ticket-06-attendance-judgment-calendar.spec.ts`) 4/4 통과 + 직접 관련 기존 스펙(`story-ticket-03-today-my-calls`, `story-ticket-27-schedule`, `story-4-1-therapist-attendance`, `story-i18n-default-vi`, `story-i18n-switch-ko`, `story-i18n-vi-screens`) 18/18 통과, 새 실패 없음.
