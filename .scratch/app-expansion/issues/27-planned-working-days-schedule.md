# 27: 근무표 기본

**What to build:** 정산 영역에 근무표를 새로 둔다. 세 직군의 활성 직원을 직군별로 묶어 월요일에 시작하는 주 단위로 보여 주고, 칸마다 근무 예정, 휴무, 미입력을 설정한다. 기록이 없는 칸은 미입력이다. 변경은 감사 기록(직원, 날짜, 이전 값, 새 값, 처리자)을 남긴다. 편집은 관리자와 정산 담당만 한다. 지난주 복사와 휴무 영향 콜은 28에서 더한다. (스펙 F04, 스토리 99–100, 103, 105–106, V07 일부)

**Blocked by:** 02

**Status:** done

- [x] 미입력을 휴무로 취급하지 않는다.
- [x] 운영월 경계를 넘는 주도 날짜 기준으로 그대로 읽고 쓰며, 운영월 잠금과 무관하다.
- [x] 근무표가 출퇴근 기록, 만근, 수당을 만들거나 바꾸지 않고 예약 저장을 막지 않는다.
- [x] 카운터 등 다른 역할이 편집 서버 액션을 직접 호출하면 거절된다.
- [x] 시간대별 교대와 분할 근무는 없다.
- [x] 근무표 서비스 테스트(메모리 Prisma), 화면 E2E, 두 언어 문구를 확인한다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-27-planned-working-days-schedule`, `integration/app-expansion`(b322927) 위). 막는 티켓 02는 이미 integration에 들어 있다. main 병합·push는 하지 않았다.
- 새 Prisma 모델 `PlannedWorkingDay`(`employeeId`, `workDate` DATE, `planStatus`)를 두었다. unique `[employeeId, workDate]`. DB CHECK로 `planStatus`를 `'근무 예정'`/`'휴무'`만 허용하고, 미입력은 행이 없는 상태로만 표현한다(마이그레이션 `20261016270000_add_planned_working_days`).
- 서비스는 `src/modules/settlements/schedule-service.ts`(정산 영역 zone과 묶어 기존 `settlements` 모듈에 둠, README에 경계 설명 추가):
  - `listPlannedWorkingDaysForWeek({ date })` — 받은 날짜를 월요일로 스냅(순수 날짜 계산, 운영월 조회 없음)해 그 주 7일을 돌려주고, 세 직군(`employeeGroups` 선언 순서: 운영팀 → 귀케어팀 → 마사지사)의 활성 직원을 묶는다.
  - `setPlannedWorkingDay({ employeeId, date, status, actorId })` — 칸 하나를 근무 예정/휴무/미입력으로 설정한다. 미입력으로 설정하면 행을 지운다. 실제로 값이 바뀔 때만 `planned_working_day.created`/`.changed`/`.cleared` 감사 기록(직원, 날짜, 이전 값, 새 값은 before/afterValue, 처리자는 actorId)을 남긴다.
  - `listPlannedWorkingDayStatusesForDate({ employeeIds, date })` — 28(휴무 영향 콜)·29(가능 후보 표시)가 재사용할 직원별·날짜별 조회. 요청한 직원 중 기록이 없으면 미입력을 채운다.
  - 운영월 조회·잠금 검사가 전혀 없다. `ServiceCall`, `TherapistAttendance`류 테이블을 참조·수정하지 않으므로 출퇴근·만근·수당·예약 저장과 구조적으로 무관하다.
- 화면 `/settlements/schedule`(`src/app/(erp)/settlements/schedule/`): `page.tsx`(서버, 운영월 없이 날짜만으로 조회), `schedule-view.tsx`(직군별 `EmployeeWorkspace` 표 + 선택한 직원의 요일별 편집 패널), `schedule-cell-form.tsx`(요일 한 줄의 상태 select+저장, 기존 `EarcareAttendanceForm` 패턴 재사용), `schedule-week-nav.tsx`(이전주/다음주/오늘, 운영월이 없어 `DateContextControls` 대신 새로 둠), `actions.ts`(`requirePermission("payout:write")`로 관리자·정산 담당만 허용), `schedule-view-model.ts`(서버·클라가 같이 쓰는 순수 값; 클라이언트 번들에 prisma가 딸려 오지 않도록 상태 목록·직군 라벨 key·요일 key를 여기 둔다).
- 라우트는 `src/lib/routes.ts`의 `settlements` zone 끝에 추가했다(`dateContext` 없음). design.md의 "주기 순서(근무표 → 일별 → 월별)" 제안과 달리 끝에 둔 것은 가정이다: 앞에 두면 `getZoneHref`가 돌려주는 정산 구역 첫 진입 화면이 Therapist 정산에서 근무표로 바뀌어 기존 셸 테스트(`routes.test.ts`, `screen-toolbar.test.tsx`)의 "정산 담당 로그인 뒤 dock 진입 첫 화면" 전제를 건드린다. 역할별 로그인 첫 화면(`roleLandingPath`)은 그대로 Therapist 정산이라 범위 밖이지만, dock으로 들어갈 때의 첫 탭까지 바꾸는 결정은 이 티켓 혼자 내리지 않았다. 탭 순서를 design.md대로 맞추려면 별도 확인이 필요하다.
- `scheduleStatusLabel(locale, status)`를 `src/lib/i18n/codes.ts`에 두었다(`operatingMonthStatusLabel`과 같은 모양, key `scheduleStatus.*`). 29의 가능 후보 근무 예정 표시가 그대로 재사용할 수 있다.
- 결정과 가정:
  - 세 직군 묶음 순서는 시안(마사지사 → 귀케어 → 운영팀)과 달리 `employeeGroups` 선언 순서(운영팀 → 귀케어팀 → 마사지사)를 따랐다. 시안의 예시 순서는 업무 규칙을 대신하지 않는다(design.md 0절)는 원칙에 따라 코드의 기존 상수를 기준으로 삼았다.
  - 칸 편집 UI는 직원을 고르면 비모달 패널에 그 직원의 요일 7개를 한 번에 보여주고, 각 요일은 독립된 작은 폼(select+저장)이다. 마우스오버 격자 칸 자체를 바로 편집하는 방식 대신 기존 `EmployeeWorkspace`(직원 선택+패널) 컴포넌트를 그대로 재사용했다. 선택은 `EMPLOYEE_PARAM`으로 주소에 남지만, 패널 안에서 어느 요일을 보는지는 주소에 남기지 않는다(패널이 7일을 한 번에 다 보여주므로 별도 상태가 필요 없다).
  - `setPlannedWorkingDay`가 값이 그대로면 감사 기록을 남기지 않는 것은 `setTherapistDailySettlementPayment`의 선례를 따른 가정이다.
  - 휴무로 바꿀 때 배정된 콜 경고(28)와 지난주 복사(28)는 이 티켓 범위가 아니라 구현하지 않았다. 패널의 안내 문구("근무 예정은 특정 시각까지...")만 미리 넣어 두었다.
- 함정: 클라이언트 컴포넌트(`schedule-view.tsx`, `schedule-cell-form.tsx`)가 `schedule-service.ts`에서 `workPlanStatuses` 같은 값을 직접 import하면 그 파일의 `prisma` 의존까지 클라이언트 번들에 끌려와 `pnpm build`가 `net`/`tls` 모듈을 찾지 못해 실패했다(use-client-constant-pitfall과 같은 종류지만 반대 방향: 클라 파일이 서버 전용 파일의 "값"을 끌어오는 경우). `schedule-view-model.ts`(순수 파일, 타입만 import)에 상태 목록을 따로 둬서 고쳤다. `tsc`와 단위 테스트는 이 문제를 못 잡고 `pnpm build`에서만 드러났다.
- 검증(운영 빌드, 전용 DB `vietnam_aesthetic_t27`·포트 3127, 컨테이너 `vietnam-shell-02-e2e`):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 659개 전부 통과(새 `schedule-service.test.ts` 11건, `schedule-view.test.tsx` 5건 포함). 근무표 라우트 추가로 `routes.test.ts`·`screen-toolbar.test.tsx`의 정산 탭 목록 기대값을 갱신했다.
  - `pnpm lint`는 기존 실패인 4-6만 실패(다른 전부 통과).
  - `pnpm build` 성공(처음에는 위의 클라이언트 번들 함정으로 실패했다가 고친 뒤 통과).
  - 새 E2E `story-ticket-27-schedule.spec.ts`(5건): 미입력→근무 예정 설정과 감사 기록, 근무 예정→휴무 변경과 감사 기록·출퇴근/콜 테이블 불변, 카운터의 라우트 접근 거절, 정산 담당 세션 중 역할이 카운터로 바뀌면 저장 서버 액션이 거절(직접 호출 거절의 대리 검증, story-2-2 선례와 같은 방식), 베트남어 화면 문구. 5건 모두 통과.
  - 공유 셸 테스트 회귀 확인으로 `story-shell-workflow-dock.spec.ts`(16건) 전체 통과. 다른 기존 스펙은 메모리·시간 제약으로 돌리지 않았다(새 스펙과 고친 공용 파일(`routes.ts`, 셸 테스트)에 걸린 범위만 확인).
- 뒤 티켓에 넘길 것: 28은 `listPlannedWorkingDayStatusesForDate`를 휴무 영향 콜 조회에 재사용할 수 있고, 지난주 복사는 `setPlannedWorkingDay`를 셀마다 호출하되 미입력 칸만 채우는 규칙을 새로 더해야 한다(현재 서비스는 "덮어쓰기 vs 미입력만 채우기" 선택지를 받지 않는다). 29는 `listPlannedWorkingDayStatusesForDate`와 `scheduleStatusLabel`을 그대로 가능 코스 행에 붙일 수 있다. 근무표 탭 순서(design.md의 "주기 순서" 제안을 지금은 안 따름)는 필요하면 별도로 정리한다.
