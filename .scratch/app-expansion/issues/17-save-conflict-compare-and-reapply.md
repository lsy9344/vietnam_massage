# 17: 저장 충돌 비교와 다시 반영

**What to build:** 행이 충돌 확인 필요가 되면 콜 상세 패널에 충돌 비교가 열린다. 원장 필드 순서대로 내 값과 최신 저장 값을 나란히 보여 주고, 필드마다 "내 값 쓰기"를 골라 최신 내용 위에 필요한 값만 다시 반영해 저장한다. 다시 저장할 때는 최신 updatedAt을 쓰므로 다시 버전 검사를 받는다. (스펙 B07, 스토리 39–40, 42–43, V05)

**Blocked by:** 13, 15

**Status:** done

- [x] 비교 화면의 필드 순서가 원장과 같고, 내 값과 최신 값이 다른 필드가 구분되어 보인다.
- [x] "내 값 쓰기"를 고른 필드만 최신 내용 위에 반영된다. 강제 덮어쓰기는 없다.
- [x] 비교하는 동안 다른 화면이 또 수정했다면 다시 저장할 때 충돌로 알려 준다.
- [x] "최신 내용으로 다시 불러오기"는 초안을 최신 행으로 바꾼다.
- [x] 키보드만으로 비교와 반영을 할 수 있고, 패널은 포커스를 가두며 닫으면 원래 자리로 돌려준다. 새 문구는 두 언어로 있다.
- [x] 두 브라우저 문맥 E2E로 충돌 → 비교 → 다시 반영 → 저장을 확인한다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-17-save-conflict-compare-and-reapply`, `integration/app-expansion` 2108244 위에서 시작). 워크트리·브랜치는 멈춘 시도가 5ef5e27에 있었으나 변경 없이 깨끗해 통합 브랜치로 reset하고 새로 시작했다.
- `call-row-save.ts`에 새 이벤트 `reapply`를 더했다. `{type:"reapply", row, changes}`는 상태가 `conflict`일 때만 동작하고, 최신 행(`row`)을 기준으로 삼아(=`initialCallRowSave(row)`) 거기에 `changes`(고른 필드만)를 얹어 바로 다시 보낸다(`expectedUpdatedAt`은 그 최신 행의 updatedAt). 비교하는 동안 또 바뀌었으면 이 재전송도 다시 STALE_CALL을 받아 `conflict`로 돌아간다(기존 "stale" 분기가 그대로 처리). `call-row-save.test.ts`에 2건(선택한 필드만 반영·최신 값은 그대로/충돌 밖에서는 무시) 추가.
- 새 모듈 `call-conflict-compare.tsx`:
  - `callConflictFieldRows(mine, latest, options, customers, t)` — 순수 함수. `EDITABLE_CALL_FIELDS` 순서대로 라벨·내 값·최신 값·differs를 만든다. `differs`는 표시 라벨이 아니라 원래 값(코드·id)으로 가린다. 옵션 목록(원장 칸이 쓰는 것과 같음)과 customers로 라벨을 입힌다. customerId는 `calls.detail.customerLink.unlinked`("연결된 고객 없음")를 재사용한다.
  - `useRegisterCallConflict`/`CallConflictProvider`/`useCallConflict` — 티켓 18의 `useUnsavedGuard`/`CallLeaveGuard`와 같은 등록 방식. 원장 행(`EditableCallRow`, editable-call-grid.tsx)이 `conflict` 상태인 동안 자기 비교 데이터(내 초안·최신 행·메시지·재반영·다시불러오기 콜백)를 등록하고, 콜 상세 패널(call-detail-panel.tsx)이 같은 콜 id로 그 등록을 읽어 비교 화면을 그린다. 두 컴포넌트가 원장 트리에서 서로 다른 가지에 있어 이 중간 매개(Context)가 필요했다.
  - `CallConflictCompareFields` — 표(필드/내 값/최신 값/내 값 쓰기)와 "최신 내용으로 다시 불러오기"·"다시 반영하고 저장" 버튼. 다른 값이 있는 필드만 체크박스가 있고, 같은 필드는 "—"만 보인다. "다시 반영하고 저장"은 고른 필드가 없으면 비활성.
  - `CallConflictCompare` — 위를 `ModalPanel`(포커스 가둠, design.md)로 연다. 트리거 버튼 없이 자동으로 열리므로 `open`은 늘 `true`로 두고, Esc·바깥 클릭·패널 자체 닫기 버튼으로 닫으려 하면(`onOpenChange(false)`) 바로 닫지 않고 `ConfirmDialog`로 먼저 확인한다(티켓 18이 "17 쪽에서 자기 닫기 버튼에 직접 확인을 걸어야 한다"고 남긴 몫). 확인하면 패널 전체(`CallDetailPanel`의 `onClose`)를 닫는다 — 비교만 숨기지 않는 이유는, 그래야 다시 그 행을 열었을 때(또는 새 STALE_CALL일 때) 비교가 깨끗하게 다시 열리기 때문이다. 다시 반영·다시 불러오기가 성공하면 그 콜이 더 이상 충돌 상태가 아니게 되어 등록이 저절로 사라지고, 콜 상세 패널이 이 컴포넌트를 치운다(별도 닫기 로직 불필요).
  - `call-detail-panel.tsx`는 `key={conflict.latestRow.updatedAt}`로 비교 컴포넌트를 둬, 같은 콜이 비교 중에 또 충돌하면(새 latestRow) 선택·확인 상태를 깨끗이 다시 시작한다.
- `editable-call-grid.tsx`: `EditableCallRow`가 `conflict` 상태가 되면 `useMemo`로 고정한 비교 데이터를 등록하고(아래 "버그" 참고), autosave 응답이 STALE_CALL이면 `onOpenDetail(row.id)`를 불러 콜 상세 패널을 그 행으로 연다(열려 있지 않았으면 열고, 다른 행이 열려 있었으면 이 행으로 바꾼다) — 체크박스 1의 "자동으로 열린다"가 이 호출이다.
- `call-ledger-workspace.tsx`: `CallConflictProvider`로 그리드와 콜 상세 패널을 함께 감쌌다(`CallLeaveGuard` 안, `TherapistAvailabilityPanel`·그리드·패널 모두 포함).
- i18n: `calls.conflict.*` 9개 키를 ko/vi에 추가(title/description/세 칸 머리말/useMine·useMineAria/reapply/closeConfirmDescription). 닫기 확인의 제목은 `calls.leaveGuard.title`, 확인 버튼은 `common.panel.close`를 재사용했다(같은 문구를 새 키로 중복하지 않음). "최신 내용으로 다시 불러오기" 버튼 문구도 기존 `calls.save.reloadLatest`를 그대로 썼다.

### 버그와 가정

- **구현 중 무한 렌더 루프를 만나 고쳤다.** `CallConflictProvider`가 `<Context.Provider value={{register, unregister}}>`처럼 객체 리터럴을 매 렌더 새로 만들어 넘기고 있었다. `register`/`unregister` 자체는 `useCallback([])`로 안정적이었지만, 감싸는 객체가 매번 새 참조라 소비자(`useRegisterCallConflict`)의 effect가 "api가 바뀌었다"고 보고 매 렌더 다시 돌아 `register`를 또 부르고 → `setRegistry` → Provider 리렌더 → 다시 effect... 로 무한 루프가 났다. 브라우저에서는 Radix Dialog의 ref 콜백(`usePresence`)이 겹쳐 React의 "Maximum update depth exceeded"로 페이지가 죽었다(개발 서버에서는 같은 루프가 콘솔 에러로만 보이고 멈추는 경우도 있었다 — React 버전·엔진에 따라 다르게 드러난 것으로 보인다). `useMemo`로 Context value를 고정해 고쳤다(`CallConflictProvider`). `EditableCallRow` 쪽 비교 데이터도 `useMemo`로 고정해 같은 패턴의 재발을 막았다. 재현·분리 과정은 디버그 스크립트로 두 브라우저 문맥을 직접 띄워 확인했고, 이 스크립트는 작업 폴더 밖(스크래치패드)에 남기지 않고 지웠다.
- **ModalPanel이 열리면 배경이 `aria-hidden`이 된다(Radix 기본 동작).** 그래서 충돌 중에는 원장 행 자체의 "최신 내용으로 다시 불러오기" 버튼이 접근성 트리에서 가려진다(화면에는 그대로 보이지만 `getByRole` 등 역할 기반 접근은 막힌다). 티켓 15의 기존 E2E가 바로 이 버튼을 썼으므로, 그 스펙에 "비교를 확인하고 닫은 뒤 행 상호작용을 잇는다" 단계를 추가해 맞췄다(아래 변경 파일 참고). 실제 사용자 동선에서는 이게 맞다고 본다 — 비교가 열리면 그걸로 해결하거나, 닫고(명확한 확인을 거쳐) 행에서 계속하거나다.
- **닫기 확인 문구는 "저장하지 않은 입력이 있습니다"(티켓 18 문구 재사용)를 그대로 썼다.** 실제로는 비교를 닫아도 아무것도 사라지지 않는다(행은 그대로 충돌 상태로 남고 다시 열 수 있다) — 설명은 "닫아도 초안은 원장 행에 남는다"로 정확하게 적었다.
- **다시 반영 중 또 충돌하면** 새 `latestRow`로 다시 "충돌 확인 필요"가 되고(리듀서의 `reapply`→`send`→`stale` 경로), `key`가 바뀌어 비교 화면이 그 최신 값으로 깨끗이 다시 열린다. 이 경로는 `call-row-save.test.ts`의 리듀서 단위 테스트로 확인했고(순수 로직), 두 브라우저 E2E에서 세 번째 동시 수정까지 만드는 것은 자원 제약상 범위에 넣지 않았다.
- `CallCustomerLinkCorrection`(티켓 25)·`PanelSection`(설정) 등 콜 상세 패널의 기존 섹션은 건드리지 않았다. 비교는 패널 맨 위, 경고 섹션보다 먼저 보인다.
- 티켓 20(빠른 예약)의 범위는 건드리지 않았다. 보고 직전 통합 브랜치를 합칠 때 그 변경도 함께 들어왔다(아래 검증 참고).

### 검증

- `npx tsc --noEmit` 통과.
- `pnpm test:unit`: 776개 전부 통과(새 테스트 9건 — `call-row-save.test.ts` 2건, `call-conflict-compare.test.tsx` 7건 — 포함).
- `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`: `validate-story-4-6`만 기존 실패(메모·선례와 일치, 이번 변경과 무관).
- `pnpm build` 통과.
- E2E(운영 빌드, 전용 DB `vietnam_aesthetic_t17`·포트 3117): 새 스펙 `story-ticket-17-save-conflict-compare-and-reapply.spec.ts`(2건 — 두 브라우저 문맥으로 충돌→비교→선택 반영→저장, 단일 화면에서 다시 불러오기로 초안 전체 교체) 3회 반복 모두 통과. 원장 관련 기존 스펙(2-1·2-2·2-3·2-4·2-6·client-revision·티켓 13·15·16·18·19·25)을 직렬로 함께 돌려 새 실패가 없는지 확인했다.
  - 기존 실패로 가린 것: `client-revision-verification:310`(새 행 추가 뒤 pending 고착, 메모에 2026-10-15 티켓 15가 기준 커밋에서도 재현한 기존 문제로 기록)과 `story-2-1:285`(strict-mode 중복 "이 날짜의 콜이 없습니다", 메모의 기존 흔들림 목록과 일치) — 둘 다 이 변경과 무관하다.
  - `story-ticket-26-phone-ledger-card-list.spec.ts`는 이 배치 순서로 함께 돌리면 다른 스펙이 오늘 날짜에 넣은 콜 때문에 B02 경고가 섞여 실패했지만, 새 DB에서 그 스펙만 단독으로 돌리면 3건 모두 통과한다 — 메모의 "현장 스펙이 오늘 날짜 객실에 넣은 콜" 패턴과 같은 기존 공유 DB 오염이라 가렸다.
  - `story-ticket-15-stale-save.spec.ts`는 내 변경으로 실제로 깨졌다(위 "버그와 가정"의 aria-hidden 참고) — 그 스펙에 비교 패널을 확인하고 닫는 단계를 더해 고쳤다(`tests/e2e/story-ticket-15-stale-save.spec.ts`). 티켓 17의 범위가 티켓 15의 화면을 바꾸는 것이므로 함께 고쳤다.
  - `story-ticket-17-...spec.ts`의 시드 직원 sortOrder는 처음에 9441–9443을 썼다가 `story-ticket-16-new-row-request-id.spec.ts`가 이미 쓰는 번호와 겹쳐 beforeAll이 깨졌다 — 9451–9453으로 바꿨다.
  - 서버 PID만 종료했고, `vietnam_aesthetic_t17` DB는 작업 뒤 지웠다. main·다른 워크트리는 건드리지 않았다.
