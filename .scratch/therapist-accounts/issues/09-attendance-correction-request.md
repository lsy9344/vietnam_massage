# 09: 출퇴근 정정 요청

**What to build:** Therapist가 근태 탭, 퇴근 미입력 안내, 이미 찍은 출퇴근 버튼에서 그날 출근·퇴근의 맞는 시각과 사유를 적어 정정을 요청한다. 요청은 08의 승인함에서 처리한다. 승인하면 그 시각이 "정정 승인" 방식으로 기록된다. (스펙 D23, D24, D28, M5, M23, M24, ADR 0004. 나누기 전 티켓 07)

**Blocked by:** 05, 08

**Status:** ready-for-agent

- [ ] 요청 대상은 출퇴근 시각뿐이다. 빠뜨린 출근·퇴근도 포함한다. Therapist는 출근, 퇴근 또는 둘 다의 맞는 시각과 사유(필수)를 적는다. 08의 신청 표에 정정 종류로 저장한다.
- [ ] 이럴 때는 요청할 수 없다.
  - 잠긴 운영월이나 마감확정 운영월의 날짜
  - 같은 날에 대기 중인 정정 요청이 있을 때
- [ ] 승인함에서 그대로 승인하거나 사유를 적어 거절한다.
  - 승인하는 사람이 시각을 고쳐 승인하는 기능은 없다.
  - 다른 시각이 맞으면 거절한 뒤 기존 출퇴근 화면에서 직접 고친다(대리 입력).
- [ ] 승인은 한 트랜잭션에서 한다(M24). 신청 상태를 바꾸고, 출퇴근을 저장하고, 감사에 남긴다.
  - 저장은 04로 넓힌 출퇴근 서비스를 부르고, 바뀐 쪽의 방식은 "정정 승인"이 된다.
  - 만근 판정과 잠금 검사를 그대로 거친다. 그사이 운영월이 잠겼으면 승인도 실패한다.
- [ ] 승인으로 이미 지급 확인한 날의 금액이 바뀌면 기존 계산대로 지급 재확인 필요가 된다(ADR 0004). 승인 쪽에서 따로 표시하지 않는다.
- [ ] 결과와 사유는 근태 탭에 보인다. 요청으로 이어지는 길은 두 곳이다.
  - 06의 퇴근 미입력 안내
  - 05에서 이미 찍은 뒤 버튼에 뜨는 "이미 찍음 — 정정 요청" 안내
- [ ] 승인과 거절이 감사에 남는다.
- [ ] 새 문구는 ko·vi 두 언어로 있다. Therapist 화면은 390px에서 가로 스크롤이 0이다.
- [ ] 단위 테스트, tsc, E2E가 통과한다.
  - Therapist 모듈 서비스(메모리 Prisma): 요청 거절 규칙(잠긴 달, 마감확정 달, 대기 중 중복), 승인 뒤 "정정 승인" 방식, 바뀐 쪽만 바뀜, 만근 재판정, 지급 확인한 날의 지급 재확인 필요, 감사
  - E2E 흐름: 퇴근 미입력 → 요청 → 승인 → 근태 반영

## Comments

- 만듦: `src/modules/therapists/therapist-request-service.ts`에 `requestTherapistCorrection`(생성, D23)·`approveTherapistCorrectionRequest`(승인, D23·D24·M24)를 더했다. 08이 만든 표·거절·취소·목록 조회를 그대로 썼다. `upsertTherapistAttendance`(`src/modules/settlements/therapist-attendance-service.ts`)를 바깥 트랜잭션에서 그대로 쓰도록 그 서비스의 `$transaction`을 optional로 넓히고 `runInTransaction` 헬퍼를 더했다(schedule-service.ts와 같은 모양, `deactivateTherapistAttendance`도 같은 헬퍼로 바꿔 타입을 맞췄다). 화면: `src/components/therapist/therapist-correction-request-dialog.tsx`(새 다이얼로그, `TherapistCorrectionRequestDialog`)를 05의 "이미 찍음" 안내(`therapist-attendance-actions-slot.tsx`, `serviceDate` prop 추가)와 06의 "퇴근 미입력" 안내(`therapist-clock-out-notice-slot.tsx`, `action` prop 추가)에 달았다. 관리자 쪽: `src/app/(erp)/settlements/requests/actions.ts`에 `approveTherapistCorrectionRequestAction`을 더하고 `request-workspace.tsx`가 카드의 `kind`로 두 승인 액션 중 하나를 고르게 했다. `request-action-error.ts`는 `TherapistAttendanceDomainError`(upsertTherapistAttendance가 낼 수 있는 `OPERATING_MONTH_LOCKED` 등)도 번역하게 넓혔다. E2E: `tests/e2e/story-ticket-09-attendance-correction-request.spec.ts`(3개).
- 고침(08이 만든 기존 로직의 결함, 이 티켓에서 드러남): `toStatusValue`·`assertActionable`이 "기한 지남"(M24)을 종류와 무관하게 적용해, 정정 요청(날짜가 거의 항상 과거)이 대기 상태가 되는 즉시 "기한 지남"으로 막혀 버렸다. 둘 다 `kind === "휴무"`일 때만 날짜 검사를 하게 고쳤다(day off 쪽 동작은 그대로다). 이 결함은 08의 자체 테스트가 "정정" 종류를 항상 미래 날짜로만 테스트해 드러나지 않았었다.
- 병합(2026-10-20, 코디네이터 지시): 보고 직전 `feat/therapist-accounts`를 merge하니 그 사이 사용자가 직접 올린 `93df843 "fix(therapists): limit payout to today and add special day off"`(`.scratch/therapist-daily-only/spec.md`, D19–D21 대체)가 선행 커밋으로 들어와 있었다. 그 커밋은 `businessTodayServiceDate`를 `(now)` 한 인자로 바꾸고(영업일 경계를 활성 슬롯이 아니라 고정 상수 `BUSINESS_DAY_START_TIME = "03:00"`으로 정함) `todayServiceDateOf` 헬퍼를 지웠으며, 신청 종류에 `special_day_off`("소중한날 휴가")를 더했다. 충돌은 `therapist-request-service.ts` 한 파일에서만 났다(나머지는 git이 자동 병합). 고친 것: (1) `approveTherapistCorrectionRequest`의 남은 `todayServiceDateOf` 호출을 `businessTodayServiceDate(now)`로 바꿈. (2) 내가 만든 종류별 "기한 지남" 판정을 `isDayOffFamilyKind(kind)`(휴무·소중한날 휴가만 true) 헬퍼로 합쳐 `toStatusValue`·`assertActionable` 둘 다 쓰게 함 — 정정은 여전히 기한 지남이 없다. 승인함의 종류별 액션 분기(`request-workspace.tsx`)는 이미 `kind === "correction"` 이분법이라 손대지 않아도 세 종류 모두 맞게 들어간다(day_off·special_day_off는 같은 `approveTherapistDayOffRequestAction`으로, correction만 내 액션으로). "소중한날 휴가 표시가 다른 신청이 뒤에 생겨도 유지"되는 93df843의 완료 기준은 `listApprovedSpecialDayOffs`(승인 상태만 읽음)가 지키고, 내 정정 요청 코드는 그 함수를 건드리지 않아 그대로 깨지지 않는다. 병합 커밋 `f708b12`.
- 가정
  - 정정 요청은 (D23에 없는 제한이라) 미래 날짜를 막지 않는다 — 05 "이미 찍음"(오늘)·06 "퇴근 미입력"(최근 31일) 두 진입점만 있어 실제로는 과거·오늘만 들어온다.
  - 승인 쪽이 요청에 없는 시각(예: 퇴근만 요청)은 기존 출퇴근 기록을 그대로 쓴다. 출근 기록 자체가 없는데 퇴근만 요청했으면 `THERAPIST_CORRECTION_CHECK_IN_REQUIRED`로 거절한다(관리자가 거절 뒤 대리 입력으로 고치게 한다) — 코드베이스 지도 6절이 미리 짚은 함정이다.
  - D23의 "지급 재확인" 항목은 ADR 0004 자동 계산이 이미 처리한다고 봤다(코드로 확인: `therapist-daily-settlement-service.ts`에 attendance 참조가 전혀 없다, 07의 merged-07.md와 같은 결론) — 정정 승인이 그 금액을 바꿀 길이 없어 따로 표시하지 않는다. 단위 테스트는 "메모리 Prisma에 정산 모델이 전혀 없는데도 승인이 끝까지 성공한다"로 이 사실을 고정했다(실제로 그 계산을 불렀다면 바로 실패했을 것이다).
  - E2E는 "잠긴 운영월" 거절을 다시 돌리지 않았다 — 화면에 날짜를 자유 입력하는 곳이 없어(두 진입점만 날짜를 준다) 브라우저로는 못 닿는 경로이고, 단위 테스트(요청 생성 시점 2개, 승인 시점의 "그사이 잠김" 1개)가 이미 코드로 확인한다. 같은 이유로 09는 08의 승인 액션 직접 호출 보안 테스트(카운터·therapist 거절)를 다시 만들지 않았다 — `requirePermission("payout:write")`를 08과 그대로 재사용해 08의 테스트가 이미 그 경계를 확인했다.
- 검증(병합 전, `feat/therapist-08-day-off-inbox` 기준): `pnpm test:unit` 1217 passed, E2E(DB `vietnam_aesthetic_th09`, 포트 3209) 새 스펙 3/3 + 03·05·06·07·08 관련 스펙 모두 통과(`story-ticket-05-clock-in-code.spec.ts:98`은 묶음 실행에서 환경 흔들림으로 1회 타임아웃, 단독 실행 9.6초로 통과 — merged-05.md와 같은 증상, 코드는 건드리지 않음).
- 검증(병합 후, `f708b12`, 코디네이터 지시대로 재검증)
  - `pnpm test:unit`: 1225 passed, 0 failed.
  - `npx tsc --noEmit`: 에러 없음.
  - `for f in scripts/validate-story-*.mjs; do ...; done`: `validate-story-4-6.mjs`만 실패(기존 실패).
  - 운영 빌드 E2E(DB `vietnam_aesthetic_th09`, 포트 3209, foreground, 직렬, 93df843의 새 마이그레이션 `20261020121300_add_special_day_off_request` 포함): `story-ticket-09-attendance-correction-request`(3) + `story-ticket-08-day-off-request-inbox`(6, 93df843이 더한 "소중한날 휴가" 시나리오 포함) + `story-ticket-06-attendance-judgment-calendar`(4) + `story-ticket-05-clock-in-code`(3) + `story-ticket-03-today-my-calls`(3) = 19/19 통과, 흔들림 없음. 끝나고 서버를 끄고 DB를 지웠다.
