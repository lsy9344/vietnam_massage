# 04: 출퇴근 기록에 찍힌 방식 남기기 (선행 정리)

**What to build:** 출퇴근 기록마다 출근과 퇴근이 어떤 방식으로 남았는지 저장한다. 방식은 직접, 대리 입력, 정정 승인, 이전 기록이다. 이 티켓에서는 기존 출퇴근 화면의 저장이 "대리 입력"이 되고, 이 칸이 생기기 전 기록은 "이전 기록"이 된다. "직접"은 05가, "정정 승인"은 09가 쓴다. 방식은 06의 근태 달력과 11의 현황이 보인다. 이 티켓에서는 화면이 바뀌지 않는다. (스펙 D16, D28, D29, M23. 나누기 전 티켓 03의 방식 칸 부분)

**Blocked by:** 없음 (바로 시작)

**Status:** done

- [ ] 출퇴근 기록에 출근 방식과 퇴근 방식 칸을 더한다. 값은 코드 문자열이다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
  - 기존 줄의 출근 방식은 "이전 기록"이다.
  - 기존 줄 중 퇴근이 있는 줄의 퇴근 방식은 "이전 기록"이고, 퇴근이 없으면 비어 있다.
- [ ] 출퇴근 서비스의 저장이 출근 방식과 퇴근 방식을 받는다(M23).
  - 바뀐 쪽만 방식이 바뀐다. 출근 시각만 고치면 퇴근 방식은 그대로다.
  - 퇴근을 지우면 퇴근 방식도 비운다.
  - 밤샘 퇴근, 잠긴 운영월 거절, 만근 판정은 지금과 똑같이 돈다.
- [ ] 기존 출퇴근 화면에서 운영팀이 저장한 시각은 "대리 입력"이 된다.
- [ ] 출퇴근 조회 결과에 출근 방식과 퇴근 방식이 들어간다.
- [ ] 출퇴근 저장은 이미 감사에 남는다. 이 감사 기록에 방식도 같이 남는다.
- [ ] 기존 출퇴근 화면의 모양과 동작은 바뀌지 않는다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - 단위 테스트(기존 출퇴근 서비스 테스트에 더한다): 방식 저장, 바뀐 쪽만 바뀜, 퇴근 지우면 비움, 감사에 방식이 남음
  - 마이그레이션 테스트: 기존 줄 값이 위 규칙대로 채워진다.
  - 기존 출퇴근 서비스 테스트와 출퇴근 화면 E2E(story-4-1)가 그대로 통과한다.

## Comments

- 방식 코드 값·타입의 한 곳: `src/modules/settlements/therapist-attendance-service.ts`의 `therapistAttendanceMethods`(네 값 전체)·`TherapistAttendanceMethod`, `legacyTherapistAttendanceMethod`("이전 기록"), `liveTherapistAttendanceMethods`(저장 액션이 넘길 수 있는 세 값)·`LiveTherapistAttendanceMethod`. 05(직접 찍기)·06(근태 달력)·09(정정 승인)·11(현황)이 이 상수·타입을 그대로 import해서 쓴다.
- 스키마: `prisma/schema.prisma`의 `TherapistAttendance`에 `checkInMethod`(`check_in_method`, 기본값 "이전 기록", NOT NULL)·`checkOutMethod`(`check_out_method`, nullable) 추가. 마이그레이션 `prisma/migrations/20261020120400_add_therapist_attendance_methods/migration.sql`은 더하기만 한다. 기존 줄은 ADD COLUMN DEFAULT로 출근 방식이 "이전 기록"이 되고, `UPDATE ... WHERE check_out_minute IS NOT NULL`로 퇴근이 있는 줄만 퇴근 방식도 "이전 기록"이 된다. DB CHECK로 네 값만 허용하고, `(check_out_minute IS NULL) = (check_out_method IS NULL)` 불변식을 걸었다(퇴근 없으면 방식도 반드시 없음).
- 서비스: `upsertTherapistAttendance`가 `method: LiveTherapistAttendanceMethod` 필수 인자를 받는다. 새 순수 함수 `resolveCheckInMethod`/`resolveCheckOutMethod`(같은 파일)가 "바뀐 쪽만 방식이 바뀐다"를 구현한다 — 이전 줄이 없거나 비활성이거나 그 쪽 시각이 바뀌면 이번 호출의 method를, 그대로면 이전 방식을 쓴다. 퇴근 시각을 지우면(`checkOutTime: ""`) checkOutMethod는 무조건 null(이번 method를 넘기지 않는다). `TherapistAttendanceDto`·`attendanceSnapshot`(감사 before/after)·`listTherapistAttendanceForDate` 결과에 checkInMethod·checkOutMethod를 추가해 조회·감사 모두에 방식이 남는다.
- 화면: `src/app/(erp)/settlements/actions.ts`의 `saveTherapistAttendanceAction`만 고쳐 `method: "대리 입력"`을 서버에서 고정으로 넘긴다. 폼·컴포넌트는 손대지 않았다(화면이 바뀌지 않는 티켓).
- 가정: (1) 코드 값은 영문 SNAKE_CASE가 아니라 스펙 D16의 한글 문구("직접"·"대리 입력"·"정정 승인"·"이전 기록") 그대로를 저장한다 — 이 저장소의 `WorkPlanStatus`("근무 예정"·"휴무"·"미입력", `src/modules/masters/planned-working-day-query.ts`)가 같은 방식이라 그 관례를 따랐다. (2) `method`는 호출 하나에 하나(출근·퇴근 어느 쪽이 바뀌었는지는 서비스가 `before`와 비교해 판정)이고, 개별로 checkInMethod/checkOutMethod를 따로 받지 않는다 — M23 문장("직접 찍기는 '직접'을... 넘긴다")이 호출 전체에 방식 하나를 지정하는 것으로 읽었다. (3) `upsertTherapistAttendance`의 기존 호출부(테스트 15곳)는 모두 `method: "대리 입력"`을 명시하도록 고쳤다(기존 출퇴근 화면과 같은 동작이라 검증 내용은 바뀌지 않는다) — "기존 테스트가 그대로 통과한다"를 "동작 회귀 없음"으로 해석했다(시그니처 자체는 넓어졌으니 호출부 수정이 불가피했다).
- 마이그레이션 테스트: 저장소에 기존 방식이 있었다 — `src/modules/migration/prisma-migrations.test.ts`가 migration.sql 텍스트를 정적으로 검사하는 단위 테스트(DB 없음). 같은 방식으로 새 테스트를 더해 ADD COLUMN·DEFAULT·백필 UPDATE·CHECK 문구를 확인했다. 그 위에 "기존 줄 값이 규칙대로 채워진다"는 실제 동작까지 확인하려고, 전용 E2E DB(`vietnam_aesthetic_th04`)에서 이 마이그레이션 폴더만 잠깐 빼고 `prisma migrate deploy`로 마이그레이션 직전 상태를 만든 뒤, 퇴근 있는 줄 1개·퇴근 없는 줄 1개를 직접 INSERT하고, 마이그레이션 폴더를 되돌려 다시 `migrate deploy`를 돌려 결과를 psql로 확인했다: 퇴근 있는 줄 → check_in_method="이전 기록", check_out_method="이전 기록"; 퇴근 없는 줄 → check_in_method="이전 기록", check_out_method=NULL. 규칙대로였다. 검증 뒤 이 두 줄과 임시 운영월은 지웠다.
- 검증 결과:
  - `pnpm test:unit`: 1017 passed, 0 failed (새 테스트 4개: 방식 저장/감사 반영은 기존 "creates a new attendance row..." 테스트의 afterValue 단언을 넓혀 확인, "바뀐 쪽만 바뀐다"·"퇴근 지우면 비운다" 새 테스트 2개, migration.sql 정적 검사 1개).
  - `npx tsc --noEmit`: 에러 없음. `TherapistAttendanceDto`에 필드가 늘어 그 타입을 직접 만들던 기존 테스트 fixture 3곳(`settlement-view-model.test.ts`, `therapist-settlement-view.test.tsx`, `monthly-statement-service.test.ts`)에 checkInMethod/checkOutMethod: null(또는 "대리 입력")을 추가해 맞췄다(동작은 그대로).
  - 검증 스크립트: `validate-story-4-6.mjs`만 기존 실패(메모리 `e2e-prod-known-failures.md`와 일치). 그 밖은 통과.
  - E2E: DB `vietnam_aesthetic_th04`·포트 3204, `pnpm build` + `next start` 운영 빌드. `story-4-1-therapist-attendance` 5개 전부 통과(저장·밤샘·만근·잘못된 입력·잠긴 운영월·카운터 접근 거절). 티켓 범위상 이 스펙만 돌렸다(README의 "04는 story-4-1" 예시를 따름).
- 2026-10-20 운영 DB 적용 호환 조치: 새 코드 배포 전 구 Worker는 `check_out_method`를 모른 채 퇴근 시각만 저장하므로, `(check_out_minute IS NULL) = (check_out_method IS NULL)` CHECK에 걸릴 수 있었다. 운영 DB에만 BEFORE INSERT/UPDATE 트리거 `trg_therapist_attendance_checkout_method`를 걸어, 퇴근 시각이 있는데 방식이 비면 "이전 기록"으로 채우고 퇴근 시각이 없으면 방식을 비운다. 새 코드를 운영에 배포한 뒤 제거해도 된다.
