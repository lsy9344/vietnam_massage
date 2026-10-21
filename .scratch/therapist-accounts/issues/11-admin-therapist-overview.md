# 11: 관리자 Therapist 현황

**What to build:** 관리자가 한 화면에서 두 가지를 본다. 하나는 오늘 누가 어떻게 출근했는지이고, 다른 하나는 운영월의 사람별 근태 집계, 대리 입력 횟수, 완료 콜 수와 순위다. 근태 판정은 06의 계산을 그대로 쓴다. (스펙 D26, M5, M12, M18. 나누기 전 티켓 09)

**Blocked by:** 06

**Status:** done

- [ ] `therapist:manage`를 가진 관리자만 연다. 운영팀 라우트 목록에 관리자 전용으로 올린다.
- [ ] 오늘 영역에는 활성 Therapist마다 출근 여부, 출근·퇴근 시각, 찍힌 방식(직접, 대리 입력, 정정 승인)이 보인다. 지각, 퇴근 미입력, 예정 없는 출근이 표시된다.
- [ ] 운영월 영역에는 사람별로 아래 내용이 보이고, 운영월을 고를 수 있다.
  - 지각 횟수와 합계 분
  - 결근
  - 퇴근 미입력
  - 예정 없는 출근
  - 대리 입력 횟수(이전 기록은 세지 않음)
  - 완료 콜 수(방문완료)와 순위
- [ ] 숫자는 06의 판정과 월 마감 미리보기의 완료 건수·순위와 같다. 이 화면만의 계산을 따로 만들지 않는다.
- [ ] 화면 모양은 `design.md`를 따르고, 자동 새로고침은 하지 않는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma), 같은 DB에서 비교: 집계가 06 판정과 같고, 완료 콜 수·순위가 마감 미리보기와 같다. 대리 입력 횟수에서 이전 기록이 빠진다.
  - E2E: 정산 담당, 카운터, therapist가 이 화면에 들어갈 수 없다.

## Comments

- 서비스 `src/modules/therapists/therapist-admin-overview-service.ts`: `getTherapistAdminTodayOverview({ operatingMonths, now?, prismaClient? })`(오늘 영역, `listTherapistAttendanceForDate` + `listPlannedWorkingDayStatusesForDate` + 06의 `judgeTherapistAttendanceDay`만 쓴다 — roster는 `listTherapistAttendanceForDate`가 이미 활성 Therapist 전원을 돌려줘서 따로 읽지 않음), `getTherapistAdminMonthlyOverview({ operatingMonth, now?, prismaClient?, dependencies? })`(운영월 영역, 06의 `listTherapistAttendanceForEmployeeInRange` + `listPlannedWorkingDayStatusesForEmployeeInRange` + `judgeTherapistAttendanceDay`를 날짜마다 돌려 집계하고, 완료 콜 수·순위는 `listMonthlyClosingPreview`/마감이면 `getMonthlyClosingSnapshot`의 Therapist 행을 그대로 옮긴다).
- `src/modules/closing/monthly-closing-preview-service.ts`에 `compareTherapistRowsByCountKingOrder`(완료 콜 수 desc → 월 정산액 desc → staffCode asc → id asc)를 새로 export하고 `applyCountKingBonuses`가 이 함수를 쓰게 고쳤다 — 콜킹 보너스(1–3위, 40콜 이상)와 11의 "전체 순위"가 같은 동점 규칙 하나를 쓴다. 로직은 그대로라 `monthly-closing-preview-service.test.ts` 6건이 그대로 통과한다.
- 화면 `src/app/(erp)/settlements/therapist-overview/{page,therapist-overview-view}.tsx`, 라우트 `/settlements/therapist-overview`(`src/lib/routes.ts`, zone `settlements`, `roles: ["administrator"]`, `dateContext: "month"`, 10의 공지 탭 옆에 둠). `routes.test.ts`·`screen-toolbar.test.tsx`·`workflow-dock.test.tsx`·`story-shell-workflow-dock.spec.ts`의 settlements 탭 목록 4곳에 한 줄씩 더했다(10이 남긴 선례와 같은 자리).
- 표는 design.md 6.6 그대로(`overflow-x-auto rounded-md border` + `relative`로 sr-only 라벨이 문서 폭을 안 늘리게), 드릴다운 패널은 안 둠(AC에 없고 보고용 화면이라 과한 복잡도로 봄).
- **가정**
  1. "오늘" 영역은 늘 실제 오늘 운영일만 본다(운영월 선택 매개변수와 무관) — 오늘 운영일이 속한 달이 아직 없으면(드문 경우) 안내만 보이고 빈 목록.
  2. "퇴근 미입력"은 오늘 영역에서는 판정 플래그(`isClockOutMissing`, 운영일이 끝나야만 켜짐)가 아니라 퇴근 칸이 비어 있는 그대로를 보인다 — 오늘 운영일은 아직 안 끝났으니 그 플래그는 늘 false라서(06의 달력도 같다), 글자 그대로의 미기록 상태로 "표시된다"는 AC를 만족시킨다. 운영월 영역의 "퇴근 미입력" 열은 판정 플래그(운영일이 끝난 날만) 횟수다.
  3. 대리 입력 횟수는 **일수가 아니라 사건 수**다 — 한 날짜에 출근·퇴근 모두 "대리 입력"이면 2로 센다(체크인·체크아웃 각각 센다).
  4. 완료 콜 수 순위는 (오케스트레이터 2026-10-20 결정대로) 40콜 미달도 포함해 전원에게 매긴다 — 콜킹 보너스 자격(1–3위, 40콜 이상)과는 다른 숫자다.
- **검증**
  - `pnpm test:unit`: 1138 passed / 0 failed(새 테스트 4건 포함: `therapist-admin-overview-service.test.ts`가 같은 메모리 DB에서 06 판정과 직접 비교).
  - `npx tsc --noEmit`: 에러 없음.
  - `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`: `validate-story-4-6.mjs`만 실패(기존 실패). `pnpm lint`도 같은 자리에서 멈춤(기존 문제).
  - 운영 빌드 E2E(DB `vietnam_aesthetic_th11`, 포트 3211, 직렬): 새 스펙 `story-ticket-11-admin-therapist-overview.spec.ts` 4건 + `story-ticket-01`(7) + `story-ticket-06`(4) + `story-shell-workflow-dock`(18) + `story-5-1`·`story-5-2`(6) 총 39건 통과, 0 failed, 새 실패 없음. 끝나고 서버(pid 1353862, cwd 확인) 종료·DB 삭제.
  - (좁은 위험, 테스트 파일에 주석으로 남김) 오늘이 매달 2일이면 E2E 스펙의 결근·예정없는출근 데이터가 서로 다른 운영월로 갈라져 집계 단언이 깨질 수 있다(1/30 수준) — 06의 근태 달력 스펙도 같은 종류의 월경계 문제를 안고 있다.
