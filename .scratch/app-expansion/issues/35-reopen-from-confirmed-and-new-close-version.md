# 35: 마감확정 상태의 재오픈과 재확정 새 버전

**What to build:** 지금은 잠금 상태에서만 되는 재오픈을 마감확정 상태에서도 할 수 있게 한다. 관리자가 사유를 남기고 검토중으로 되돌린다. 이전 마감 버전과 스냅샷은 수정하거나 지우지 않고, 재오픈 시각·처리자·사유를 기록한다. 재확정하면 새 버전이 생긴다. (스펙 F07, 스토리 133–135, V11)

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 마감확정과 잠금 상태 모두에서 관리자만 재오픈할 수 있다. 정산 담당이 재오픈 서버 액션을 직접 호출하면 거절된다.
- [x] 재확정하면 새 버전이 생기고 과거 스냅샷은 그대로 남는다. 기존 시재와 순매출 계산은 바뀌지 않는다.
- [x] 이미 확정된 스냅샷을 소급해 다시 계산하지 않는다.
- [x] 월마감 서비스 테스트(시계 주입)와 재오픈 E2E로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-35-reopen-from-confirmed-and-new-close-version`, `integration/app-expansion` bf565d0 위). 막는 티켓 없음. 33·34는 마감 점검 화면을 다시 구성할 예정이라, 이번 변경은 재오픈 액션과 그 서식만 건드렸다(화면 전체 재구성은 하지 않음).
- 서비스(`src/modules/closing/monthly-closing-service.ts`): `reopenMonthlyClose`의 상태 검사를 `현재 상태 !== "잠금"`에서 `isReopenableOperatingMonthStatus(status)`(마감확정 또는 잠금)로 넓혔다. 조건부 `updateMany`도 리터럴 `"잠금"` 대신 방금 읽은 `current.status`를 걸어, 마감확정·잠금 두 경로 모두에서 그 사이 상태가 바뀌면 거절하는 낙관적 동시성을 유지한다. `confirmMonthlyClose`(재확정 시 `closeVersion = latest+1`로 새 행 생성, 기존 스냅샷 불변)와 권한 검사(`closing:reopen`은 `requirePermission`으로 admin만, actions.ts에서 상태 확인보다 먼저)는 이미 있던 그대로라 손대지 않았다. 즉 "정산 담당 직접 호출 거절"과 "재확정 시 새 버전·과거 스냅샷 보존·소급 재계산 없음" 세 기준은 기존 코드가 이미 만족하고 있었고, 이번 티켓은 재오픈이 가능한 "출발 상태"만 넓힌 것이다.
- 화면(`closing-action-panel.tsx`): 재오픈 폼을 보이는 조건을 `status === "잠금"`에서 `status === "잠금" || status === "마감확정"`로 넓혔다. 마감확정 상태에서는 잠금 버튼과 재오픈 폼이 함께 보인다(둘 다 `canWrite`/`canReopen`로 각자 활성화 여부가 갈린다). 다른 조건식(`disabledReason`, 안내문단)은 그대로 둬도 동작이 맞는다.
- i18n: `closing.reopen.help`가 "재오픈은 잠금 상태에서만 가능하며..."라고 틀리게 말하던 것을 "마감확정과 잠금 상태에서 가능하며..."로 두 언어(ko/vi) 모두 고쳤다. 새 키는 만들지 않았다(문구 변경만).
- 가정: 재오픈 UI를 마감확정 상태에서 보여줄 때 디자인을 새로 그리지 않고 기존 잠금 상태용 재오픈 서식을 그대로 재사용했다(33/34가 마감 점검 화면을 다시 구성할 때 다시 보일 것으로 가정). 티켓 설명이 "요청 범위만 단순하게"를 요구해 그 외 레이아웃은 건드리지 않았다.
- 검증:
  - 단위(`monthly-closing-service.test.ts`): 기존 "blocks reopen unless the operating month is 잠금"을 "...마감확정 또는 잠금"으로 다시 쓰고 작성중·검토중만 거절되는지 확인, 새 테스트 "reopens a 마감확정 monthly close directly to 검토중 without requiring lock first" 추가. `node --import tsx --test`로 22/22 통과.
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 656/656 통과.
  - `pnpm lint`: validate-story-5-5는 통과, validate-story-4-6만 기존 실패(브리프에 적힌 그대로).
  - `pnpm build` 통과.
  - E2E(운영 빌드, 전용 DB `vietnam_aesthetic_t35`·포트 3135): `story-5-5-monthly-close-reopen.spec.ts`에 새 테스트 추가(마감확정 상태에서 바로 재오픈 → 검토중 → 재확정 시 closeVersion 2, 이전 스냅샷 불변). 재오픈 단계(폼 노출·제출·상태 전이·감사 before/after "마감확정"→"검토중")는 매번 통과했다. 그 뒤 재확정 단계("확정중"에서 멈추는 pending 고착)는 이번 실행에서 기존(변경 없는) 첫 테스트("administrator reopens a locked month...")도 같은 자리에서 똑같이 실패해, 메모 `e2e-prod-known-failures`의 `story-5-5:210`("서버 액션 응답은 200으로 오지만 화면이 반영하지 않고 pending으로 남는다")과 일치함을 확인했다. 당시 시스템에 다른 에이전트의 `next build`가 동시에 돌고 있었다(load average 13.9, swap 12GB). 재오픈 로직 자체(이 티켓이 바꾼 부분)는 손상 없이 통과했고, 재확정 단계는 기존에 알려진 환경 문제로 본다.
