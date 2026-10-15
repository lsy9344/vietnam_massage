# 28: 근무표: 지난주 복사와 휴무 영향 콜

**What to build:** 지난주 복사는 바로 앞 7일의 값을 이번 주 같은 요일의 미입력 칸에만 채우고, 채운 칸 수를 알려 준다. 휴무로 바꾸는 칸에 그 직원이 어느 배정 역할로든 들어 있는 콜(노쇼·취소 제외)이 있으면, 저장은 하고 그 콜들의 날짜·예약시각·코스·상태를 경고와 함께 보여 주며 재배정과 근무 확인을 안내한다. (스펙 F04, 스토리 101–102, V07)

**Blocked by:** 27

**Status:** done

- [x] 이미 입력된 근무 예정과 휴무는 복사로 덮이지 않는다.
- [x] 운영월 경계를 넘는 주에서도 날짜 기준으로 복사한다.
- [x] 휴무로 바꿔도 콜의 예약시각, 배정, 상태가 바뀌지 않는다.
- [x] 영향받는 콜에서 관리자는 원장의 그 날짜와 콜로 간다(콜 상세 패널이 열리는 것은 13). 정산 담당에게는 링크 대신 그 자리의 콜 요약이 보이고 원장 라우트나 콜 쓰기 권한이 생기지 않는다. (스토리 148)
- [x] 근무표 서비스 테스트로 복사 결과와 영향받는 콜을 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-28-schedule-copy-last-week-and-day-off-impact`, `integration/app-expansion`(3f2ffdb) 위). 막는 티켓 27은 이미 integration에 들어 있다. main 병합·push는 하지 않았다.
- 콜 서비스(`src/modules/calls/service-call-service.ts`)에 새 함수를 더했다. 기존 함수는 건드리지 않았다(순수 추가):
  - `AssignedServiceCallSummaryDto{serviceCallId, operatingMonthId, serviceDate, startTime, courseCode, status}` — 고객/메모, 연락처, 금액은 담지 않는다. `SettlementEvidenceCallDto`(기존 F05 선례)와 같은 발상이지만, 스펙이 요구한 필드(날짜·예약시각·코스·상태)만 두고 therapistNames는 넣지 않았다. 모듈 간 순환 참조(settlements → calls는 되지만 calls → settlements는 안 됨)를 피하려 타입을 새로 선언했다.
  - `listAssignedServiceCallsForEmployeeOnDate({employeeId, date, prismaClient?})` — 그 직원이 그 날짜에 어느 배정 역할(THERAPIST_1/2, EARCARE)로든 `isActive !== false`로 배정된, 노쇼·취소가 아닌 콜을 예약시각순으로 돌려준다. 조회만 하고 쓰지 않는다. `roomFloorFactsForDate`의 `DisplayEndReadClient` 선례를 따라, 받는 클라이언트 타입을 `serviceCall.findMany`만 요구하는 좁은 모양(`AssignedCallReadClient`)으로 선언해 모듈 경계를 넘나드는 다른 서비스가 자기 클라이언트를 그대로 넘길 수 있게 했다.
- 근무표 서비스(`src/modules/settlements/schedule-service.ts`):
  - `setPlannedWorkingDay`가 트랜잭션을 마친 뒤(값이 그대로였던 경우 포함, 모든 경로에서) 결과 상태가 "휴무"면 `listAssignedServiceCallsForEmployeeOnDate`를 호출해 `impactedCalls`를 채워 돌려준다(그 외 상태는 `[]`). 저장 자체는 영향받는 콜이 있어도 항상 성공한다 — 조회는 저장이 끝난 뒤의 부가 정보일 뿐이다.
  - 새 `copyLastWeekSchedule({date, actorId, prismaClient?})` — `date`가 속한 주의 미입력 칸만, 바로 앞 7일의 같은 요일 값으로 채운다. 이미 값이 있는 칸(행이 존재 = 근무 예정 또는 휴무)은 건드리지 않는다. 날짜 연산만 쓰므로 운영월 경계나 지난주가 지난달에 걸쳐 있어도 그대로 동작한다. 칸마다 `setPlannedWorkingDay`를 그대로 호출해 같은 upsert·감사 기록 경로를 재사용했다(새 분기를 만들지 않음). 돌려주는 값은 `{weekStartDate, weekEndDate, filledCount}`뿐이다.
  - `ScheduleServicePrismaClient`에 `serviceCall.findMany`만 요구하는 좁은 필드를 추가했다(실제로는 같은 prisma 싱글턴이라 런타임에서는 그냥 같은 테이블을 읽는다).
- 결정과 가정:
  - **복사가 새로 만드는 휴무 칸의 영향받는 콜은 복사 결과에 담지 않는다.** 티켓 문장을 "지난주 복사 → 채운 칸 수"와 "칸을 휴무로 바꿈 → 영향받는 콜"로 분리해서 읽었다(스토리 101은 채운 칸 수만, 스토리 102는 콜이 있는 날을 "직접" 휴무로 바꾸는 것을 말한다). 복사로 어떤 칸이 휴무가 되면, 그 주를 보는 화면의 표 자체가 이미 "휴무"로 보이므로 별도 알림 없이도 드러난다. 복사 자체는 콜 서비스를 매번 호출하지 않고 가볍게 끝낸다. 복사 중 `setPlannedWorkingDay`를 호출할 때도 내부적으로는 impactedCalls를 계산하지만(재사용의 부작용), 복사 결과에는 버리고 합산하지 않는다 — 코드를 더 단순하게 유지하는 대신 계산 낭비를 약간 감수했다.
  - **휴무 영향 콜 안내는 "저장 응답"에만 실린다.** `setPlannedWorkingDay`의 `impactedCalls`는 그 호출의 결과값이라, 화면은 이를 `useActionState`로 받아 저장 직후에만 보여준다(페이지를 새로 열거나 다른 요일을 봤다가 돌아오면 사라진다). 티켓 문장("저장은 하고 ... 보여 주며")과 선례(근무표 메인 표의 "휴무" 표시 자체가 상시 보이는 신호)에 맞춰, 상시 배지 같은 별도 상태를 만들지 않았다. 다시 보려면 같은 값으로 다시 저장하면 된다(그때도 매번 다시 계산해 보여준다).
  - **역할별 링크/요약은 `/calls` 라우트 접근 권한(`linkToScreen`)을 그대로 따른다.** `room-status-card.tsx`의 `OverlappingCalls`(관리자·카운터에게 원장 링크, 웨이터·조회 전용에게는 없음)와 정산 화면들의 `canOpenLedger={linkToScreen(account.role, "/calls", context) !== null}` 패턴을 그대로 재사용했다. 근무표 라우트는 관리자·정산 담당만 들어오므로, 이 화면에서는 관리자만 링크를, 정산 담당은 요약만 본다(스토리 148). `EvidenceCallItem`(정산 근거 콜)도 같은 발상이지만 금액(amount) 칸이 필수라 이 화면엔 안 맞아, `schedule-cell-form.tsx`에 `DayOffImpactNotice`를 새로 뒀다(`OverlappingCalls`와 같은 Link-또는-div 분기, 하지만 날짜·예약시각·코스·상태만 보여준다).
  - "지난주 복사" 버튼은 `ScreenToolbar`의 "오른쪽 끝의 주요 행동" 자리에 둔 새 클라이언트 컴포넌트(`schedule-copy-action.tsx`)다. `week.weekStartDate`를 key로 둬서 주를 옮기면(다른 week 값) 이전 복사 결과 문구가 남지 않고 새로 마운트된다(ScheduleView가 이미 쓰는 것과 같은 방식).
  - 새 i18n 키 9개(`settlements.schedule.copy.*`, `settlements.schedule.dayOff.impact.*`)를 ko/vi 양쪽에 추가했다.
- 뒤 티켓에 넘길 것: 없음. 29(가능 코스의 근무 예정 표시)는 `listPlannedWorkingDayStatusesForDate`를 그대로 쓰면 되고 이 티켓이 바꾼 범위와 무관하다.
- 범위 밖이라 손대지 않은 것: design.md의 근무표 탭 순서 조정(27이 이미 남긴 메모), 가능 코스 화면 연동(29).
- 검증(운영 빌드, 전용 DB `vietnam_aesthetic_t28`·포트 3128, 컨테이너 `vietnam-shell-02-e2e`):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 707개 전부 통과. 새로 더한 테스트: `service-call-service.test.ts`에 `listAssignedServiceCallsForEmployeeOnDate` 4건(역할 무관 배정 포함/노쇼·취소 제외, 다른 날짜 제외, 정렬, 입력 검증), `schedule-service.test.ts`에 `setPlannedWorkingDay`의 `impactedCalls` 3건과 `copyLastWeekSchedule` 5건(미입력만 채움, 지난주도 미입력이면 0건, 달 경계, 날짜 검증), `schedule-cell-form.test.tsx`에 `DayOffImpactNotice` 정적 렌더 5건(건수 문구, 관리자 링크 href, 정산 담당 요약, 베트남어).
  - `pnpm lint`는 `&&` 사슬이라 기존 실패 4-6에서 멈춘다. 코디네이터 지시대로 `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`으로 전체를 따로 돌렸다: 4-6만 실패, 그리고 내 브랜치가 아직 받지 못한 통합 브랜치의 최신 커밋(ac936c3, 티켓 35의 검증 스크립트 5-5 수정)이 빠져서 일시적으로 5-5도 실패했다 — 이 보고 직전 `git merge integration/app-expansion`으로 받은 뒤 다시 돌려 4-6만 남는지 확인했다(아래).
  - `pnpm build` 성공.
  - E2E(신규 `story-ticket-28-schedule-copy-and-day-off-impact.spec.ts` 4건 + 회귀로 `story-ticket-27-schedule.spec.ts` 5건, 같은 DB에서 `--workers=1`로 직렬 실행): 9건 모두 통과. `--workers=2`로 처음 돌렸을 때는 두 스펙이 같은 글로벌 `AuditLog` 개수를 동시에 건드려 27의 "+1건" 단언이 깨졌다 — 내 콜·근무표 로직 문제가 아니라 두 독립 스펙이 같은 DB에 동시에 쓰는 테스트 격리 문제라고 판단해 `--workers=1`로 다시 돌렸다(둘 다 파일 내부에서는 이미 `mode: "serial"`).
  - 새 스펙 범위: 관리자가 배정된 콜이 있는 칸을 휴무로 바꾸면 "영향받는 콜 1건" 안내와 원장 링크가 보이고 클릭하면 `/calls?...&call=` 콜 상세로 가며 콜 테이블(예약시각·상태·배정)이 그대로인 것, 정산 담당은 같은 상황에서 링크 없이 요약만 보는 것, 지난주 복사가 미입력 칸만 채우고 이미 입력된 칸은 덮지 않으며 "N칸을 채웠습니다" 문구가 뜨는 것(다른 활성 직원의 칸 수에 흔들리지 않게 전용 직원과 숫자 형식만 확인), 베트남어 버튼·안내 문구.
  - 공유 DB 함정 메모: 복사 결과 문구의 정확한 칸 수는 활성 직원 전체를 스캔하므로 다른 스펙(예: 27)이 같은 DB에 남긴 근무표 데이터에 영향받을 수 있어, E2E 단언은 숫자 형식(`/\d+칸을 채웠습니다\./`)만 보고 정확한 개수는 전용 직원의 DB 행으로만 확인했다. 서비스 단위 테스트(메모리 Prisma)는 정확한 개수를 그대로 확인한다.
