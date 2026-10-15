# 34: 미완료 콜이 남은 운영월의 사유 있는 예외 마감

**What to build:** 마감 확인 대상 콜(예약·사용중·청소중)이 남아 있으면, 정산 담당이 목록을 확인하고 사유를 적어야 확정할 수 있다. 확정 요청은 확인한 콜 id 목록과 예외 사유를 함께 보낸다. 서비스는 확정 트랜잭션 안에서 다시 대조해, 목록에 없는 새 대상이 있으면 거절하고 지금의 목록을 돌려준다. 통과하면 예외 사유, 확인한 콜과 그 당시 상태, 처리자를 이번 마감 버전에 함께 저장한다. (스펙 F07, ADR 0005, 스토리 127–128, 130–131, V10)

**Blocked by:** 33

**Status:** done

- [x] 확인 목록이 비어 있지 않으면 사유가 필수다. 목록 확인과 사유 없이는 예외 마감할 수 없다.
- [x] 예외 마감은 콜 상태를 바꾸거나 자동으로 방문완료 처리하지 않고, 금액 스냅샷의 계산 의미도 바꾸지 않는다.
- [x] 사유가 있어도 계산 오류와 지급 재확인 미처리는 확정을 막는다.
- [x] 목록을 확인한 뒤 새 대상이 생기면 확정이 거절되고 새 목록이 보인다.
- [x] 예외 기록이 해당 마감 버전에 남고, 재오픈 뒤에도 보존된다.
- [x] 월마감 서비스 테스트와 E2E로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-34-close-with-unfinished-calls-and-reason`, `integration/app-expansion` 296356b 위, 33·35 포함).
- `src/modules/closing/monthly-closing-service.ts`의 `confirmMonthlyClose`: 33이 트랜잭션 안에서 다시 계산하던 `checklist.pendingCloseCalls`에 이번 티켓의 검사를 더했다. 목록이 비어 있지 않으면 (1) `exceptionReason`(trim)이 없으면 `MONTHLY_CLOSE_PENDING_CLOSE_REASON_REQUIRED`로 거절, (2) 다시 계산한 목록 중 입력받은 `confirmedPendingCloseCallIds`에 없는 콜이 있으면 새 에러 클래스 `MonthlyClosePendingCallsChangedError`(지금의 `checklist.pendingCloseCalls`를 `currentPendingCloseCalls`로 들고 있다 — `StaleServiceCallError`+`currentRow`와 같은 모양)로 거절해 액션 경계가 새 목록을 그대로 돌려줄 수 있게 했다. 두 검사를 모두 통과하면 `pendingCloseException = { reason, confirmedByAccountId, confirmedAt, calls: checklist.pendingCloseCalls }`를 만들어 스냅샷에 싣는다. "확인한 콜" 목록은 사용자가 보낸 id 목록이 아니라 트랜잭션 안에서 다시 계산한 목록 그 자체를 저장한다 — 그래야 "그 당시 상태"가 정확하고, 이미 다른 상태로 바뀐 과거 id가 섞여 들어와도 스냅샷이 오염되지 않는다(가정: confirmedPendingCloseCallIds는 다시 계산한 목록을 모두 "덮기만" 하면 되고, 그 안에 더 많은 id가 있어도 문제삼지 않는다 — 스펙 문구("확인 목록에 없는 콜이 있으면 거절")를 그대로 지켰다).
- `MonthlyClosingSnapshotDto`에 `pendingCloseException?: {...} | null`을 추가했다(`dashboardFinancials`/`graphReport`와 같은 이유로 optional — 이 필드가 생기기 전 과거 스냅샷에는 이 키가 없다). 새 Prisma 컬럼·마이그레이션은 만들지 않았다 — 예외 기록은 트랜잭션마다 새로 만드는 `MonthlyClosing.snapshotJson`에 추가 필드로만 들어가고, 그 컬럼은 재오픈 때도 고치지 않으므로(35 코드 그대로) ADR 0005의 "마감 버전과 연결해 보존"·"재오픈 뒤에도 보존"·"소급 재계산 없음"을 그대로 만족한다. 32(월 명세서)가 스냅샷을 읽는 범위는 건드리지 않았다(additive).
- 화면(`src/app/(erp)/closing/closing-action-panel.tsx`): "마감 확정" 다이얼로그 안에 마감 확인 대상 콜 목록(기존 `EvidenceCallItem`/`EvidenceCallList` 재사용, 역할별 원장 링크 규칙도 그대로 따름) + "위 N건을 확인했습니다" 체크박스 1개 + 사유 textarea를 추가했다. 개별 콜마다 체크박스를 두지 않고 하나의 확인 체크로 목록 전체를 확인하는 방식을 택했다(가정) — 스펙 문구("목록을 확인하고 사유를 적으면")가 건별 체크를 요구하지 않고, 서버 계약(`confirmedPendingCloseCallIds: string[]`)도 "그 시점에 보인 전체 목록을 확인했는지"만 요구한다. 체크박스가 켜지면 그 시점의 목록 id들을 hidden input(`form` 속성으로 다이얼로그 푸터의 제출 폼과 연결)으로 렌더링한다. 제출 버튼은 대상 콜이 없으면 그대로 활성, 있으면 체크+사유가 모두 있어야 활성(안내일 뿐, 실제 차단은 서버가 한다). `MONTHLY_CLOSE_PENDING_CALLS_CHANGED`로 거절되면 다이얼로그는 열어 둔 채 서버가 돌려준 새 목록으로 다시 그리고 체크만 초기화해 다시 확인하게 한다(사유는 지우지 않는다 — 보통 같은 사유로 재제출한다).
- 액션(`src/app/(erp)/closing/actions.ts`): `confirmMonthlyCloseAction`의 리턴 타입을 `ConfirmMonthlyCloseActionState`(기존 `ActionResult` 모양 또는 `{domainErrorCode: "MONTHLY_CLOSE_PENDING_CALLS_CHANGED", currentPendingCloseCalls}`)로 넓혔다(calls/actions.ts의 `ServiceCallAutosaveResult`+`STALE_CALL` 선례와 같은 모양). **E2E에서 실제 버그를 하나 찾아 고쳤다**: 마감 확인 대상 콜이 없어 사유 입력칸 자체가 그려지지 않을 때 `formData.get("exceptionReason")`은 `null`을 돌려주는데, zod `.default("")`는 `undefined`에만 적용되고 `null`은 그대로 통과시켜 스키마가 거절했다("입력값을 확인하세요." 오류로 confirm 전체가 막혔다). `formData.get("exceptionReason") ?? ""`로 고쳤다. 이 버그는 서비스 경계만 호출하는 유닛 테스트로는 안 잡히고 실제 `FormData`를 쓰는 E2E(story-5-3/5-6, 대상 콜 없는 기존 시나리오)에서만 드러났다 — 고치기 전엔 그 스펙들의 확정 자체가 실패했고, 고친 뒤에는 확정이 정상 동작했다(아래 검증 참고).
- i18n: `closing.confirmDialog.pendingCloseCalls.*`(새 6개 키), `closing.snapshot.pendingCloseException.*`(새 2개 키)를 ko/vi에 추가했다. `closing.checklist.pendingCloseCalls.description`(기존 키) 문구를 "이 목록은 마감 확정을 막지 않습니다"에서 "확인하고 사유를 적으면 ... 예외로 마감할 수 있습니다"로 고쳤다(33이 "34에서 바뀔 문구"로 남겨 둔 자리). 새 도메인 에러 code(`MONTHLY_CLOSE_PENDING_CLOSE_REASON_REQUIRED`, `MONTHLY_CLOSE_PENDING_CALLS_CHANGED`)는 기존 `MONTHLY_CLOSE_*` 관례대로 `DOMAIN_ERROR_VI`에 넣지 않고 한국어 fallback만 둔다(33 Comments가 남긴 관례).
- `SnapshotSummary`(page.tsx)에 예외 마감 콜 섹션(사유 + `EvidenceCallList`)을 더해 재확정 뒤에도 사람이 확인할 수 있게 했다(가정) — 스펙은 보존만 요구하지만, 저장만 하고 화면에 아무도 못 보면 스토리 131("처리한 사람이... 남기를 원한다")의 취지가 약해진다고 보았다.
- 영향받지 않게 지킨 것: `listMonthlyClosingChecklist`(33), 계산 오류·지급 재확인 차단 순서와 code, 재오픈/잠금 전이, 금액 계산은 한 줄도 바꾸지 않았다. 새 permission·라우트 없음(정산 담당은 여전히 `closing:write`만).
- 넘기는 것: 없음 — 33·35가 이 티켓에 남긴 자리는 모두 닫혔다. 36(교차 기능 E2E)이 전체를 다시 훑을 것이다.
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 782/782 통과(새 테스트: `monthly-closing-service.test.ts`에 5건 추가 — 사유 필수 거절, 목록 변경 거절+새 목록 반환, 확정 성공 시 스냅샷에 사유·콜·처리자 저장, 재오픈·재확정 뒤에도 과거 버전의 예외 기록 보존).
  - `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done` 전부 통과, 기존 실패 `validate-story-4-6.mjs`만 그대로(이 티켓과 무관).
  - `pnpm build` 통과.
  - E2E는 전용 DB `vietnam_aesthetic_t34`·포트 3134(컨테이너 `vietnam-shell-02-e2e`)에서 돌렸다(워커 1개, 다른 에이전트와 메모리 공유 중이라 전체 E2E는 돌리지 않고 마감 화면에 걸린 스펙만). 새 스펙 `story-ticket-34-close-with-unfinished-calls-and-reason.spec.ts`(1건, 목록 변경 거절 → 새 목록 확인 → 재제출 성공 → 재오픈 뒤 예외 기록 보존까지 한 시나리오로 확인) 통과. 기존 `story-ticket-33-closing-checklist.spec.ts`의 세 번째 테스트를 34의 새 계약(체크+사유 필요)에 맞게 고쳐 통과시켰다. `story-5-1`(4건)·`story-5-2`(2건) 통과. `story-5-3`·`story-5-5`·`story-5-6`은 위 액션 버그를 고치기 전 1차 실행에서 "확정 스냅샷"/"운영월 상태: 마감확정" 문구를 기다리다 4건이 실패했는데, DB를 직접 조회해 서버 쪽은 이미 올바르게 전이·`closeVersion`을 올렸음을 확인했다(메모 `e2e-prod-known-failures`의 story-5-3:242·story-5-5:210·story-5-6:176와 같은 "서버 액션은 200이지만 화면 반영이 지연/멈춘다" 증상). 버그를 고친 뒤 재실행에서는 같은 4건이 여전히 그 증상으로 남고(DB로 재확인함, 예: 재오픈·재확정 뒤 `closeVersion` 1→2가 둘 다 정상 생성됨) 나머지 7건은 통과해, 이 4건은 이 티켓과 무관한 기존 환경 문제로 본다.
  - E2E 서버 PID만 띄우고 끔(`ss -ltnp`로 PID 확인, `/proc/<pid>/cwd`가 이 워크트리인지 확인 후 kill), 자기 DB(`vietnam_aesthetic_t34`)에만 DROP/CREATE했다.
