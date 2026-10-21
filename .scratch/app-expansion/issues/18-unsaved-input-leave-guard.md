# 18: 저장하지 않은 입력이 있을 때 떠나기 전 안내

**What to build:** 원장에 저장하지 않은 입력(저장 실패, 충돌 확인 필요, 저장 여부 확인 중 포함)이 있는 상태에서 원장 탭을 떠나거나, 앱의 다른 화면으로 가거나, 브라우저를 닫거나 새로고침하려 하면 안내한다. 취소를 고르면 초안이 남는다. 원장 보기 전환은 같은 화면의 표시 방식만 바꾸므로 안내 없이 초안을 그대로 둔다. (스펙 B07, 스토리 51, V06)

**Blocked by:** 03, 15

**Status:** done

- [x] 탭 이동, 앱 안 화면 이동, 브라우저 닫기와 새로고침에서 모두 안내가 나온다. 취소하면 초안이 그대로다.
- [x] 저장하지 않은 입력이 없으면 안내가 나오지 않는다.
- [x] 브라우저를 닫은 뒤의 초안 복구와 오프라인 저장 대기열은 만들지 않는다.
- [x] 새 문구는 두 언어로 있다. E2E로 이동 안내와 취소 시 초안 유지를 확인한다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-18-unsaved-input-leave-guard`, 통합 브랜치 `integration/app-expansion` d7cfe9f — 티켓 01–31 포함 — 위). 막는 티켓 03·15는 이미 통합 브랜치에 있다. main 병합·push는 하지 않았다.
- 새 모듈 `unsaved-guard.tsx`: `useUnsavedGuard(unsaved: boolean)` hook과 그 hook들을 모으는 `<CallLeaveGuard>`. 등록된 저장하지 않은 입력이 하나라도 있으면 (1) `beforeunload`로 브라우저 자체의 닫기·새로고침 안내를 걸고, (2) App Router에 이동 전 가로채기 API가 없어 `document`에 캡처 단계 클릭 리스너를 달아 앱 안 링크 클릭을 가로채 `ConfirmDialog`로 안내한다. 취소하면 그 자리에 남고, "나가기"를 고르면 `window.location.assign(href)`로 실제 이동한다(Next 라우터의 `useRouter()`는 App Router 밖 정적 렌더 테스트에서 throw하므로 쓰지 않았다 — 아래 가정 참고).
- 저장하지 않은 입력의 정의: 기존 행은 `isSaveHeld(status)`(failed/conflict, 티켓 15), 새 행은 새로 더한 `isNewRowSaveHeld(status)`(failed/checking, 티켓 16) — 티켓 설명의 "저장 실패, 충돌 확인 필요, 저장 여부 확인 중"과 정확히 1:1이다. `EditableCallRow`/`AddRowForm`에서 각각 `useUnsavedGuard(...)`로 등록한다. `CallLeaveGuard`는 `CallLedgerWorkspace`가 감싸(그리드와 콜 상세 패널 모두 안에 든다), 하루 수납·지출 탭(지출 저장은 이 규칙 제외, 스펙 B07)에서는 아예 마운트되지 않는다.
- 원장 보기 전환(티켓 19)은 안내하지 않는다: `ledger-address.ts`에 `LEAVE_GUARD_SKIP_ATTRIBUTE`("data-leave-guard-skip")를 두고 보기 전환 `<Link>`에만 붙였다. 클릭 가로채기는 이 속성이 있는 링크와 `#`로 시작하는 같은 쪽 이동, 새 탭으로 여는 클릭(Ctrl/Cmd/Shift·가운데 버튼)을 건너뛴다. 이 상수는 `page.tsx`(서버 컴포넌트)와 `unsaved-guard.tsx`("use client")가 함께 쓰므로, 메모의 "use client 상수 함정"을 피해 "use client" 없는 `ledger-address.ts`에 뒀다(처음에 unsaved-guard.tsx에 뒀다가 page.tsx가 클라이언트 참조 프록시를 읽게 되는 것을 발견하고 옮겼다).
- 17(충돌 비교)·20(빠른 예약)에 넘기는 것: 두 패널 모두 `CallLedgerWorkspace` 안에 그려지면 `useUnsavedGuard(자기 저장하지 않은 입력 여부)`를 그 패널 컴포넌트 안에서 부르기만 하면 같은 안내를 받는다. 새 등록 지점을 늘리는 것 외에 `unsaved-guard.tsx`를 고칠 필요는 없을 것이다.
- 결정과 가정:
  - **탭/화면 이동은 전부 Link 클릭이라 한 리스너로 충분하다**: 원장 탭↔하루 수납·지출 탭, 도크의 다른 화면, 날짜·운영월 이동(`DateContextControls`)이 모두 `next/link`의 `<Link>`다. `document` 캡처 리스너 하나를 `CallLedgerWorkspace` 안에 마운트해도 DOM 이벤트 버블링은 React 트리 위치와 무관하므로 도크(다른 React 서브트리)의 클릭도 잡힌다.
  - **날짜·운영월 이동도 안내 대상으로 뒀다**: 티켓 설명의 예시 목록(탭 이동, 앱 안 화면 이동)에는 없지만, 날짜를 바꾸면 `CallLedgerWorkspace`가 `key`로 다시 그려져(page.tsx) 탭 이동과 똑같이 초안이 사라진다. 범위를 넓힌 것이므로 밝혀 둔다 — 원치 않으면 `DateContextControls`의 링크에 `LEAVE_GUARD_SKIP_ATTRIBUTE`를 붙여 빼면 된다.
  - **"저장 중"(saving)은 안내 대상이 아니다**: 커밋은 입력칸이 blur될 때 일어나고, 블러는 다른 요소를 클릭할 때 그 클릭 이벤트보다 먼저 일어난다. 그래서 링크를 클릭하는 시점에는 막 편집하던 칸도 이미 "저장 중"으로 넘어가 있다(또는 바뀐 것이 없어 "idle"). "저장 중"인 저장은 이미 서버로 보낸 요청이라(네트워크 끊김이 아니면) 앱 안 이동으로 끊기지 않으므로, "저장 실패/충돌/확인 중"만 안내 대상으로 뒀다.
  - **확정 이동은 전체 새로고침**: `router.push` 대신 `window.location.assign`을 썼다. `useRouter()`는 App Router 바깥(정적 렌더 테스트, 예: `editable-call-grid-views.test.tsx`)에서 호출되면 throw해 기존 테스트를 깨뜨릴 위험이 있었다. 전체 새로고침은 SPA 전환보다 느리지만, 떠나기를 고른 뒤이므로 상태를 깨끗이 비우는 쪽이 더 안전하다고 봤다.
  - **beforeunload 문구는 커스텀하지 않는다**: 최신 브라우저는 `event.returnValue`의 문자열을 무시하고 고정 문구를 보여 준다. `event.preventDefault()`와 `returnValue = ""`만 설정했다.
  - **패널을 닫을 때의 안내는 이번 범위에 없다**: 스펙 B07 문장에는 "패널을 닫거나"도 있지만, 지금 `CallDetailPanel`은 자기 저장하지 않은 입력을 들고 있지 않다(충돌 비교는 17에서 붙는다). 그래서 패널을 닫는 동작 자체에는 안내를 걸지 않았고, 17이 `useUnsavedGuard`로 등록하면 패널을 닫는 X 버튼도 `<a>`가 아니므로(지금 클릭 가로채기는 링크만 본다) 17 쪽에서 자기 닫기 버튼에 직접 확인을 걸어야 한다 — 이 hook은 "앱 안 이동"만 가로챈다.
- 검증(운영 빌드, 전용 DB `vietnam_aesthetic_t18`·포트 3118): `npx tsc --noEmit` 통과. `pnpm test:unit` 765개 전부 통과(새 predicate 단위 테스트 2건 포함). 검증 스크립트는 `for f in scripts/validate-story-*.mjs; ...`로 모두 돌려 기존 실패인 4-6만 실패. `pnpm build` 성공.
  - 새 E2E 3건(`story-ticket-18-unsaved-input-leave-guard.spec.ts`: 탭·다른 화면 이동 안내와 취소/나가기, 저장하지 않은 입력 없음·보기 전환 무안내, 브라우저 닫기·새로고침 beforeunload)은 2·3 workers로 각 3회 반복 모두 통과.
  - 원장 관련 기존 스펙(2-1, 2-2, 2-3, 2-4, 2-6, i18n-vi, ticket-03, ticket-15, ticket-16, ticket-19, client-revision)과 새 스펙을 함께 2 workers로 돌리니 44개 중 2개만 실패했고, 둘 다 메모의 기존 목록과 같다: `story-2-1:285`(흔들림, 같은 strict-mode 중복 "이 날짜의 콜이 없습니다" 증상)과 `client-revision-verification:310`(새 행 추가 뒤 pending 고착). 내 변경과 겹치는 파일인지 `git diff --stat <통합 브랜치 커밋>`으로 확인했는데 둘 다 내가 건드린 파일과 무관했다.
  - 전체 E2E는 돌리지 않았다(메모리 제약, 다른 세션과 동시 실행). 띄운 서버 PID만 껐다.

- 2026-10-16 사용자 결정: 날짜·운영월 변경에도 미저장 입력 이탈 안내를 유지한다(사용자 명시 선택).
