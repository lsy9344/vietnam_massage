# 05: 출근 코드와 직접 출퇴근

**What to build:** 매장 화면에 1분마다 바뀌는 4자리 출근 코드를 띄운다. Therapist는 "오늘" 탭에서 그 코드를 넣어 직접 출근·퇴근을 찍고, 그 기록은 "직접" 방식으로 남는다. 틀린 코드를 계속 넣으면 잠긴다. (스펙 D13–D15, D28, D29, M4, M11, M23, ADR 0009. 나누기 전 티켓 03에서 방식 칸을 뺀 나머지)

**Blocked by:** 03, 04

**Status:** done

- [ ] 출근 코드는 서버 비밀값과 시각에서 계산하는 4자리 숫자이고, 1분마다 바뀐다(M11).
  - 그날 키는 `NEXTAUTH_SECRET`에서 용도 이름을 붙여 끌어낸다. 새 환경 변수는 두지 않는다.
  - "그날"은 매장 시간대의 달력 날짜다.
  - 서버와 매장 화면이 같은 계산 함수를 쓴다(Web Crypto).
- [ ] 코드를 띄우는 화면에는 오늘과 다음 날의 키만 내려 주고, 화면이 시각으로 코드를 계산한다. 코드를 띄우려고 서버나 DB를 주기적으로 부르지 않는다. 자정을 넘기면 다음 날 키로 넘어간다.
- [ ] TV 현황판 구석에는 출근 코드가 영업시간 밖에도 항상 보인다. 카운터와 관리자는 "출근 코드" 버튼으로 크게 띄울 수 있다.
- [ ] Therapist는 "오늘" 맨 위의 출근·퇴근 버튼(03이 둔 자리)을 누르고 코드를 넣는다.
  - 서버는 지금 분과 직전 분의 코드를 받는다. 직전 분이 전날이면 전날 키로 계산한다.
  - 틀리면 남은 횟수가 보인다.
- [ ] 틀린 코드를 5번 넣으면 그 Therapist는 15분 동안 코드를 넣을 수 없고, 풀리는 시각이 보인다.
  - 계정에 출근 코드 실패 횟수와 잠금 해제 시각 칸을 더한다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
  - 맞게 넣으면 실패 횟수가 0이 된다.
- [ ] 출근과 퇴근은 운영일마다 한 번씩이다. 이미 찍었으면 버튼이 "이미 찍음 — 정정 요청" 안내로 바뀐다. 요청으로 이어지는 링크는 09가 단다.
- [ ] 저장은 04로 넓힌 출퇴근 서비스를 "직접" 방식으로 부른다. 밤샘 퇴근, 잠긴 운영월 거절, 만근 판정이 그대로 돈다.
- [ ] 휴무인 날이나 근무 예정이 입력되지 않은 날에도 찍힌다. 그 기록은 예정 없는 출근으로 알아볼 수 있다.
- [ ] 직접 찍기가 감사에 남는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - 코드 계산(순수 함수): 분 경계, 직전 1분 허용, 그 전 분 거절, 자정을 넘긴 직전 분, 다른 날 키 거절
  - Therapist 모듈 서비스(메모리 Prisma): 5번 실패 잠금과 15분 뒤 풀림, 성공 때 실패 횟수 0, 이미 찍음, 잠긴 운영월, 예정 없는 출근, "직접" 방식, 감사
  - E2E 흐름: TV에 보인 코드로 출근 → 퇴근하고, 틀린 코드 5번 뒤 잠기는지 본다.
  - E2E 요청 없음: Playwright 시계로 분을 넘겨 코드가 바뀌는 동안 서버 요청이 없는지 본다.

## Comments

**만든 것**

- 순수 모듈(Web Crypto, Node 전용 API 금지) `src/modules/therapists/therapist-clock-code.ts`: `deriveClockCodeDaySecretHex(secret, calendarDate)`(HMAC-SHA256, "therapist-clock-code:날짜" 메시지로 용도 이름을 끌어냄), `computeClockInCode(daySecretHex, minuteOfDay)`(4자리 zero-pad), `clockCodeMinuteNow(now?)`, `previousClockCodeMinute(minute)`(자정이면 전날 1439분). `@/lib/operating-date`의 `businessTodayIsoDate`/`businessClockString`/`addDaysToIsoDate`만 쓴다(둘 다 Intl만 써서 안전). hex 인코딩은 `call-request-id.ts`의 `newRequestId` 모양을 그대로 썼다.
- 서버 쪽 `src/modules/therapists/therapist-clock-code-service.ts`: `getTherapistClockCodeSecret()`(`NEXTAUTH_SECRET` 읽기, 새 환경 변수 없음), `getTherapistClockCodeDisplayKeys({now?, secret?})` → 오늘·다음 날 날짜 키만(비밀값 자체는 안 내림), `verifyTherapistClockInCode({now?, submittedCode, secret?})`(지금 분·직전 분 코드 둘 다 계산해 비교).
- 조립 서비스 `src/modules/therapists/therapist-clock-in-service.ts`: `clockInWithCode({employeeId, accountId, action, code, now?, secret?, prismaClient?})`. 순서는 (1) 운영일·운영월 찾기 → (2) 이미 찍음 판정(코드 검증 전에 봐서 실패 횟수를 안 씀) → (3) 계정 잠금 확인 → (4) 코드 검증(틀리면 실패 횟수 올리고 5번째면 잠금, `LOGIN_LOCKOUT_THRESHOLD`/`MINUTES`를 `account-service.ts`에서 import만 해서 "로그인 잠금과 같은 기준"을 지킴, account-service.ts는 건드리지 않음) → (5) 성공하면 실패 횟수 0 → (6) `upsertTherapistAttendance({..., method:"직접"})` 호출(밤샘·잠긴 운영월·만근 판정은 그 서비스가 그대로 함). `TherapistClockInDomainError`(code: CLOCK_CODE_INVALID·CLOCK_CODE_LOCKED·ALREADY_CLOCKED_IN·ALREADY_CLOCKED_OUT·CHECK_IN_REQUIRED_BEFORE_CHECK_OUT·OPERATING_MONTH_NOT_FOUND)를 던진다. `TherapistAttendanceDomainError`(잠긴 운영월 등)는 그대로 샌다.
- 스키마: `UserAccount`에 `clockInCodeFailedCount`(기본 0)·`clockInCodeLockedUntil`(nullable) 더함. 마이그레이션 `prisma/migrations/20261020120500_add_therapist_clock_in_code_lockout`(ADD COLUMN만, 운영 DB 미적용).
- 화면 자리: `TherapistAttendanceActionsSlot({attendanceStatus})`(03이 둔 자리를 채움, `page.tsx`는 이 prop 한 줄만 더함) — 출근 가능/퇴근 가능이면 버튼, 둘 다 찍음이면 "이미 찍음 — 정정 요청" 글자만(링크는 09가 단다). 버튼은 `TherapistClockCodeDialog`(숫자 키패드 3×4, 각 키 `min-h-16 text-3xl`, 입력판 `text-5xl`)를 연다. 서버 액션 `src/app/therapist/clock-in-actions.ts`의 `submitTherapistClockInCodeAction`은 `requireTherapistAccess()`로만 직원 id를 얻고(M3), 구조화된 결과(남은 횟수/잠금 시각/DOMAIN_ERROR)를 돌려준다.
- `TherapistTodayViewDto.today`에 `attendanceStatus`("check_in_available"|"check_out_available"|"both_recorded") 필드만 더했다(M4). `getTherapistTodayView`가 그날 운영월을 `monthKey`로 찾아 출퇴근 한 줄만 좁게 조회한다 — 운영월이 없으면(드문 경우) 출근 가능으로 본다.
- 매장 화면: `src/components/domain/clock-code-display.tsx`의 `ClockCodeDisplay({keys, locale, size})`("use client", LocaleProvider 밖에서도 쓸 수 있게 명시적 locale prop). 분마다 `setInterval(1000ms)`로 분이 바뀌었는지만 보고 바뀌면 Web Crypto로 다시 계산한다 — 네트워크 요청 없음. TV(`src/app/tv/page.tsx`) 머리말 오른쪽(운영월 있음/없음 두 분기 모두)과 새 화면 `src/app/clock-code/page.tsx`("출근 코드" 버튼으로 크게 띄움, `/rooms` 도구줄의 `OpenClockCodeLink`로 연다)가 같은 컴포넌트를 쓴다. 새 라우트 `/clock-code`(`src/lib/routes.ts`, roles: administrator·counter, notATab).
- i18n: `shell.tab.clockCode`·`shell.openClockCode`·`nav.item.clockCode`·`therapist.attendance.*`(9개)·`clockCode.*`(3개) ko·vi 모두.

**새로 한 가정**

- 날짜 키 HMAC은 2단계(비밀값→용도 비밀값→날짜 키) 대신 1단계로 뒀다: `HMAC(NEXTAUTH_SECRET, "therapist-clock-code:날짜")`. 용도 이름이 HMAC 메시지에 이미 들어가 있어 날짜 키가 새도 다른 용도·다른 날짜 키를 복원할 수 없다(M11의 "용도 이름을 붙여 끌어낸다"는 요건은 만족, 다만 선례가 없어 가정으로 적는다).
- "출근 코드" 버튼은 `/rooms` 도구줄 하나에만 달았다(카운터·관리자 모두 이 화면에 들어간다). `/live`(관리자 전용)에는 안 달았다 — 중복 진입점을 늘리지 않으려는 선택이다.
- "이미 찍음" 판정은 코드 검증·잠금 확인보다 먼저 본다 — 어차피 할 수 없는 동작에 실패 횟수를 쓰지 않으려는 선택이다.
- 틀린 코드 잠금 동안 감사 기록은 남기지 않는다(로그인 실패가 `recordAuditEvent`를 안 쓰는 것과 같은 모양 — `LoginAttempt` 같은 시도 기록 표도 새로 만들지 않았다, 스펙·티켓 어디에도 요구되지 않음).
- D28 "직접 찍기가 감사에 남는다"는 04가 이미 만든 출퇴근 감사 기록(`therapist_attendance.created`/`.changed`, actorId=Therapist 계정, 스냅샷에 방식 "직접" 포함)으로 충분하다고 보고 별도 action을 더 만들지 않았다(코드베이스 지도 6절의 질문에 대한 답).

**검증**

- `pnpm test:unit`: 1117 passed, 0 failed(새 테스트 25개: `therapist-clock-code.test.ts` 8, `therapist-clock-code-service.test.ts` 8, `therapist-clock-in-service.test.ts` 10, `therapist-today-view-service.test.ts`에 3개 추가, `prisma-migrations.test.ts`에 1개 추가).
- `npx tsc --noEmit`: 에러 없음.
- `for f in scripts/validate-story-*.mjs; ...`: `validate-story-4-6.mjs`만 실패(기존 실패).
- 운영 빌드 E2E(DB `vietnam_aesthetic_th05`, 포트 3205, 직렬, `--timeout=180000` — 이 스펙은 화면 조작이 많아 기본 30초를 넘는다, 메모리 e2e-prod-known-failures의 "--timeout=180000이면 통과" 패턴과 같음):
  - 새 스펙 `story-ticket-05-clock-in-code.spec.ts` 3/3 통과(코드로 출근→퇴근 + 틀린 코드 5번 잠금 + 잠긴 동안 거절 + 운영팀/Therapist 교차 거절 + 자정 넘김·요청 없음).
  - 직접 관련 기존 스펙: `story-3-4-tv-fullscreen-board`(TV 건드림) 2/2, `story-ticket-04-floor-screens`(/rooms 도구줄 건드림) 4/4, `story-shell-workflow-dock`(라우트·도크) 18/18, `story-ticket-03-today-my-calls`(오늘 탭 DTO·자리 건드림) 3/3, `story-ticket-01-therapist-role-shell` 7/7. 전부 34/34 통과, 새 실패 없음.
- 통합 브랜치 tip(082b3e4, 티켓 07 병합 포함)을 병합했다(아래 병합 결과 참고).
