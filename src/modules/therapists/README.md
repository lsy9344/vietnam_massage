# Therapists Module

Owns Therapist-side self-service (today's calls, clock-in, attendance, payout, requests, notices) and the
admin-side Therapist work (approvals inbox, notices, overview, internal memo). Screens and server actions are
thin adapters; this module assembles calculations by calling existing services (attendance, schedule, daily
settlement, payout confirmation, monthly closing preview, monthly statement, calls). It does not introduce new
payout math (spec M1).

## Includes (tickets 01–12, review fixes R20)

Access and profile:

- `therapist-access-service.ts`: `resolveTherapistAccess()` / `evaluateTherapistAccess()`, the pure M17 judgment
  (session active, role `therapist`, linked employee `employeeGroup === "THERAPIST"` and not
  `employmentStatus === "퇴사"`, password-change-required gate). It returns a verdict
  (`ok` / `sign-in` / `role-landing` / `password-change`) and never redirects — this module imports no app-router
  APIs. The app-side adapter `src/app/therapist/require-therapist-access.ts` turns that verdict into the actual
  `redirect()`, and is the single gate (spec M17) every Therapist screen and server action calls. On success it
  returns `{ accountId, employeeId }`; Therapist-side functions take that `employeeId` as input and never read it
  from a request body (spec M3).
- `therapist-profile-service.ts`: `getTherapistProfile(employeeId)`, the narrow read behind the "나" (me) menu's
  name/staff code/phone. Selects only those three columns — contact-adjacent fields that must not leak (other
  employees' info, 비고, etc.) are never in this query's `select` (spec M6).

Self-service (오늘, 출근 코드, 근태, 수당, 신청·공지):

- `therapist-today-view-service.ts`: `getTherapistTodayView(employeeId, now)`, 오늘·앞으로 7일의 내 콜, 오늘
  현황(다음 콜까지 남은 시간, 오늘 한 것, 오늘 예상 코스 수당), 오늘 출퇴근 상태(D10–D12).
- `therapist-today-rules.ts`: 오늘 보기가 쓰는 순수 규칙(정렬, 남은 시간, 손님 이름 고르기) — DB 없이
  테스트한다.
- `therapist-clock-code.ts` / `therapist-clock-code-service.ts`: 출근 코드 계산(순수, Web Crypto)과 서버 비밀값
  관리·검증(M11, D13–D14). 매장 화면·서버가 `therapist-clock-code.ts`의 같은 함수를 쓴다.
- `therapist-clock-in-service.ts`: `clockInWithCode()`, 출근 코드로 직접 찍기(D13–D16). 저장은
  `settlements/therapist-attendance-service.ts`의 `upsertTherapistAttendance`를 그대로 부른다.
- `therapist-attendance-judgment.ts`: 근태 판정(지각·결근·퇴근 미입력·예정 없는 출근, M12) — DB 없이
  테스트하는 순수 규칙. 근태 달력(06)과 관리자 현황(11)이 함께 쓴다.
- `therapist-attendance-calendar-service.ts`: `getTherapistAttendanceCalendar()`, 월 단위 근태 달력(D18).
- `therapist-payout-view-service.ts`: `getTherapistPayoutView()`, 현재 영업일의 본인 코스 수당만 조회한다
  (`.scratch/therapist-daily-only/spec.md` — 월 선택·지난 날짜 조회는 없다).
- `therapist-payout-status.ts`: 지급 확인 사건을 Therapist가 보는 세 상태(확인됨/아직/관리자 확인 중,
  M10)로 바꾸는 순수 함수.
- `therapist-request-service.ts`: 휴무 신청·정정 요청의 신청·취소·승인·거절과 승인함 목록(D22–D24, M24).
  한 표(`TherapistRequest`)에 두 종류를 담는다.
- `therapist-text-redaction.ts`: 숫자 가림(M13) — 전화번호는 가리고 천 단위 묶음 금액·ISO 날짜는 그대로
  둔다.
- `therapist-notice-service.ts`: 공지 보내기·내리기·읽음 기록과 Therapist용/관리자용 목록(D25).

Admin-side (현황, 내부 메모):

- `therapist-admin-overview-service.ts`: `getTherapistAdminTodayOverview()` /
  `getTherapistAdminMonthlyOverview()`, 오늘 출근 현황과 운영월 집계(지각·결근·퇴근 미입력·예정 없는
  출근·대리 입력 횟수, 완료 콜 수·순위, D26). 사람마다 조회를 부르지 않고 전체를 한 번에 읽어 나눈다(R7).
- `therapist-memo-service.ts` / `therapist-memo-schema.ts`: Therapist 내부 메모 추가·목록(D27) — 관리자만
  읽고 쓴다. 정산 담당·카운터·Therapist 본인은 이 서비스를 아예 부를 수 없다(권한은 화면·액션 쪽에서
  `therapist:manage`로 막는다).

## Upstream

`masters` (employee, account), `calls`/`settlements`/`closing` (출퇴근, 근무표, 일별 정산, 지급 확인, 월
마감 미리보기, 월 명세서, 콜) for the data this module assembles.

## Downstream

The Therapist route group `src/app/therapist/*` and its server actions, and the admin screens tickets 10–12 add
under `(erp)` (`masters/employees` panel for account issuance·메모, `settlements/notices`,
`settlements/requests`).

## Does Not Own

- Payout, attendance, schedule, or closing calculation rules — it reads them from their owning modules.
- The account issuance/reset/suspend screen (ticket 02 extends `linkUserAccountToEmployee`,
  `deactivateUserAccount`, `resetUserAccountLock` in `masters/account-service.ts`, not this module).
- `redirect()`/`next/navigation` — only the app-side adapters under `src/app/therapist/` call it (R20); this
  module returns pure verdicts.
