# 08: 휴무 신청과 승인함

**What to build:** Therapist가 근태 탭에서 앞으로의 날짜에 휴무를 신청하고, 관리자와 정산 담당이 새 승인함에서 승인하거나 거절한다. 승인되면 그날 근무 예정이 휴무가 된다. 승인함과 신청 표는 09의 정정 요청도 담는 모양으로 만든다. (스펙 D22, D24, D28, D29, M5, M18, M24. 나누기 전 티켓 06)

**Blocked by:** 06

**Status:** done

- [ ] 휴무 신청과 정정 요청을 한 표에 담는다(M24). 칸은 종류, Therapist, 대상 날짜, 상태(대기, 승인, 거절, 취소), 요청한 출근·퇴근 시각(정정만), 사유, 처리 사유, 처리한 계정, 처리 시각이다. 더하기만 하는 마이그레이션이고, 운영 DB 적용은 사용자 확인 뒤에 한다.
- [ ] Therapist는 근태 탭의 앞으로의 날짜에서만 휴무를 신청한다. 사유는 선택이다.
  - 이미 휴무인 날과 이미 신청 중인 날은 거절한다.
  - 신청 마감일과 하루 인원 제한은 없다.
- [ ] 승인 전에는 Therapist가 취소할 수 있다.
- [ ] 처리되지 않은 채 날짜가 지나면 "기한 지남"으로 보인다. 이 상태는 저장하지 않고 읽을 때 정한다. 기한 지난 신청은 승인·거절·취소할 수 없다.
- [ ] 승인함은 운영팀 화면이고, `payout:write`(관리자와 정산 담당)만 연다(M18).
  - 대기 중인 신청이 위에 온다.
  - 대기 건수를 도크나 메뉴에서 알 수 있다(`design.md`를 따른다). 건수는 화면을 열 때 읽고, 자동으로 새로 읽지 않는다.
- [ ] 승인은 한 트랜잭션에서 한다. 신청 상태를 바꾸고, 기존 근무표 서비스로 그날을 휴무로 저장하고, 감사에 남긴다.
  - **(가정)** 승인 화면에는 그날 그 Therapist에게 배정된 예약 수가 보이지만, 승인을 막지는 않는다.
- [ ] 거절할 때는 사유가 필수다. 결과와 사유는 Therapist의 근태 탭 그 날짜(06이 둔 자리)에 보인다.
- [ ] 승인과 거절이 감사에 남는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. Therapist 화면은 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma): 신청 거절 규칙, 취소, 기한 지남, 승인 뒤 근무표 휴무, 거절 사유 필수, 감사
  - E2E 흐름: 신청 → 승인 → 근무표 휴무 → 근태 탭 표시
  - E2E 거절: 카운터와 therapist 역할이 승인 액션을 직접 부르면 거절된다.

## Comments

- 만듦: `src/modules/therapists/therapist-request-service.ts`(`requestTherapistDayOff`, `cancelTherapistRequest`, `cancelTherapistDayOffRequestForDate`, `listTherapistRequestsForAdmin`, `listTherapistRequestsForEmployeeInRange`, `approveTherapistDayOffRequest`, `rejectTherapistRequest`, `countPendingTherapistRequests`, `toDbKind`, `TherapistRequestDomainError`). 스키마 `prisma/schema.prisma`의 `TherapistRequest`(종류·대상 날짜·요청 출근·퇴근 시각·사유·상태·처리 사유·처리 계정·처리 시각, M24 그대로) + 마이그레이션 `20261020120800_add_therapist_requests`(더하기만, CHECK 4개 — 종류, 상태, 정정만 요청 시각을 쓰는 제약, 대기 아니면 처리 칸 필수·거절은 처리 사유 필수). 운영 DB 적용은 아직 안 함.
- 관리자 화면: `/settlements/requests`(`src/app/(erp)/settlements/requests/{page,request-workspace,actions,request-action-error}.tsx|ts`). `src/lib/routes.ts`의 settlements 구역에 `administrator`·`settlement_manager` 둘 다 접근하는 탭으로 더했다(`shell.tab.therapistRequests`="승인함", `payout:write`). 대기 중(기한 지남 포함)이 날짜 가까운 순으로 위, 처리된 신청은 최근 처리 순으로 아래다(가정, 선례 없음). 승인함 카드는 종류·대상 날짜·처리 시각·사유 줄을 모두 두어 09가 정정 요청(`kind="정정"`, `requestedCheckInTime`/`requestedCheckOutTime`)을 값만 채워 넣을 수 있게 모양을 정했다 — `approveTherapistDayOffRequest`는 지금 `kind="휴무"`만 승인하고 정정은 `THERAPIST_REQUEST_KIND_NOT_SUPPORTED`로 거절한다(09가 정정 승인 경로를 더해야 한다, `upsertTherapistAttendance({method:"정정 승인"})`가 필요해 다른 함수가 될 것). `rejectTherapistRequest`·`listTherapistRequestsForAdmin`·`cancelTherapistRequest`는 이미 종류와 무관해 09가 그대로 재사용할 수 있다.
- Therapist 화면: `src/app/therapist/attendance/actions.ts`(`requestTherapistDayOffAction`, `cancelTherapistRequestAction`), 근태 달력(`src/components/therapist/therapist-attendance-calendar.tsx`)의 날짜 상세 패널에 "휴무 신청"/"신청 취소" 버튼과 신청 상태 줄을 채웠다. 06이 둔 `TherapistAttendanceDayRequestStatus` 자리(`therapist-attendance-calendar-service.ts`)는 타입을 바꾸지 않고 `listTherapistRequestsForEmployeeInRange`로 값만 메웠다. 근태 달력은 날짜만 알고 신청 id를 모르므로(그 타입에 id가 없다) 취소는 `cancelTherapistDayOffRequestForDate`(employeeId+date로 대기 중인 신청을 찾아 취소)를 쓴다 — 하루에 대기 중인 휴무 신청은 하나뿐이라는 규칙(`requestTherapistDayOff`의 중복 검사)에 기댄다.
- 승인함 대기 건수 배지(design.md — 선례 없어 새로 만듦): `src/app/(erp)/settlements/layout.tsx`(새 settlements 구역 레이아웃)에서 `payout:write`가 있을 때만 읽어 `StatusIndicator`로 보인다. 공용 `(erp)/layout.tsx`에 두지 않은 이유는 객실·실시간·TV가 영업시간에 30초마다 `router.refresh()`로 레이아웃 트리를 다시 그려 "화면을 열 때만 읽고 자동으로 새로 읽지 않는다" 조건과 부딪히기 때문이다(코드베이스 지도 12절 함정) — settlements 구역은 그 세 화면과 겹치지 않아 이 문제가 없다.
- 가정: (1) "앞으로의 날짜"는 오늘(운영일) 포함 이후로 봤다 — 오늘도 신청할 수 있다. (2) 승인함 목록 정렬은 선례가 없어 위에 적은 규칙으로 새로 정했다. (3) 신청 취소·거절은 D28의 "승인·거절" 감사 목록에 없어 거절만 감사에 남기고 취소는 남기지 않았다. (4) 승인 트랜잭션은 `setPlannedWorkingDay`(근무표 서비스)가 스스로 남기는 `planned_working_day.changed/created` 감사와 별개로 `therapist_request.approved` 감사를 더해, 승인 한 번에 감사 기록이 둘 남는다. (5) `audit-view-model.ts`에 `therapist_request` 대상 종류(라벨·원본 화면 `/settlements/requests`)를 등록했다(12의 `therapist_internal_memo`와 같은 패턴).
- 검증: `pnpm test:unit` 1165 passed, 0 failed. `npx tsc --noEmit` 에러 없음. `for f in scripts/validate-story-*.mjs; do ...; done` → `validate-story-4-6.mjs`만 실패(기존 실패). E2E는 전용 DB `vietnam_aesthetic_th08`·포트 3208, 운영 빌드로 돌렸다: 새 스펙 `tests/e2e/story-ticket-08-day-off-request-inbox.spec.ts` 5개(신청→승인→근무표 휴무→근태 반영, 거절 사유 필수·근태 탭 반영, 승인 전 취소, 390px 가로 스크롤 없음, 카운터·therapist 직접 호출 거절) 통과. 직접 관련된 기존 스펙도 함께 돌렸다: `story-ticket-06-attendance-judgment-calendar`(4), `story-ticket-01-therapist-role-shell`(6), `story-ticket-08-audit-sign-in`(10, `audit-view-model.ts`를 건드려 같이 돌림), `story-ticket-10-therapist-notices`(3), `story-ticket-12-therapist-internal-memo`(3) 모두 통과. `story-shell-workflow-dock.spec.ts`(18)는 정산 구역 메뉴 목록에 "승인함"이 더해져 1개가 깨져 10이 했던 것과 같은 방식으로 기대값에 한 줄을 더해 고쳤다(18개 모두 통과). 새 실패 없음. 끝나고 서버를 끄고 DB를 지웠다.
