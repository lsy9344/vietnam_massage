# 26: 휴대폰 원장 카드 목록

**What to build:** 휴대폰 폭에서 원장 탭은 넓은 표 대신 그날의 콜을 짧은 카드 목록(예약시각, 객실, 코스, Therapist, 상태, 첫 경고)으로 보여 준다. 카드를 누르면 콜 상세 패널이 읽기 형태로 열린다. (스펙 F08, 스토리 98, V14 일부)

**Blocked by:** 13

**Status:** done

- [x] 넓은 표를 축소해서 보여 주지 않는다. 빠른 예약과 표 편집은 태블릿 폭 이상에서만 보인다.
- [x] 카드의 첫 경고는 서비스가 준 우선순위의 첫 항목이다.
- [x] 권한 밖의 고객 연락처나 금액이 새로 보이지 않는다.
- [x] 휴대폰 폭 E2E와 뷰 테스트로 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-26-phone-ledger-card-list`, 통합 브랜치 `integration/app-expansion` 3f2ffdb 위). 13은 이미 통합 브랜치에 있다. main 병합·push는 하지 않았다.
- 화면: 새 컴포넌트 `src/app/(erp)/calls/call-phone-card-list.tsx`(`CallPhoneCardList`)가 카드 목록을 그린다. `editable-call-grid.tsx`의 `EditableCallGrid`가 두 블록을 같은 렌더에 두고 CSS로만 서로 민다 — `min-[600px]:hidden`(카드, 휴대폰에서만 보임)과 `hidden min-[600px]:block`(표 + "새 콜 행 추가" 직접 입력, 태블릿 이상에서만 보임). 600px 경계는 `design.md`/워크플로 문서의 "휴대폰(600px 미만)" 정의와 `today-dashboard-view.tsx`의 표/카드 전환 전례를 그대로 따랐다(`max-[599px]:hidden`/`min-[600px]:hidden` 짝).
- 카드는 명세가 적은 여섯 항목(예약시각, 객실, 코스, Therapist, 상태, 첫 경고)만 그린다. 고객/메모나 결제·수당 열은 애초에 이 컴포넌트에 넘기지 않아 "권한 밖 정보 노출"이 구조적으로 불가능하다. 상태는 `call-detail-panel.tsx`의 `statusLabel`과 같은 방식(마스터 옵션에서 라벨 조회, 실패 시 원래 값)으로 글자만 보이고, 색 칩(`StatusIndicator`)은 쓰지 않았다 — 기존 표의 상태 칸도 색 없는 평문이라 그 전례를 따랐다(결정, 아래).
- 첫 경고는 `row.warnings[0]`을 `callWarningLabel`로 바꾼 것이다. 순서는 서비스의 `CALL_ROW_WARNING_ORDER`(티켓 13) 그대로이고, 화면에서 다시 정렬하지 않는다.
- 카드를 누르면 기존 `onOpenDetail` 콜백(`CallLedgerWorkspace`의 `select(id)`)을 그대로 호출해 주소에 `?call=`을 남긴다. 열리는 패널은 티켓 13이 이미 읽기 전용으로 만든 `CallDetailPanel`이라 이 티켓에서 패널 자체는 손대지 않았다.
- `call-ledger-workspace.tsx`: 콜 선택 훅(`useCallSelection`)의 스크롤·포커스 복귀가 `document.querySelector`로 `data-service-call-id`/`data-call-open`을 찾는데, 이제 같은 값이 카드(휴대폰)와 표 행(태블릿 이상) 양쪽에 있어(CSS로만 숨김) 첫 DOM 매치가 숨은 쪽일 수 있었다. `firstVisible()`(offsetParent로 숨은 노드를 건너뛴다)로 바꿔 넓은 폭에서 경고 버튼으로 연 패널을 닫을 때 포커스가 여전히 그 버튼으로 돌아가는지 ticket 13 스펙으로 재확인했다(아래 검증).
- "빠른 예약과 표 편집은 태블릿 폭 이상에서만"의 "빠른 예약" 자리는 지금 가능 코스 패널(`TherapistAvailabilityPanel`, 20이 빠른 예약 패널로 옮기기 전까지의 자리, `page.tsx`의 기존 주석과 같은 전제)로 보고, `call-ledger-workspace.tsx`에서 같은 `hidden min-[600px]:block`로 휴대폰 폭에 숨겼다. 20이 실제 빠른 예약 패널을 만들면 그 컴포넌트가 이 래퍼를 이어 쓰면 된다.
- 결정: **상태는 색 칩이 아니라 평문**으로 뒀다. `call-detail-panel.tsx`(티켓 13)가 같은 상태 값을 `DetailRow`로 평문 표시하는 전례를 따른 것이고, 상태별 색 매핑(`StatusTone`)은 콜 상태에 대해 지금 어디에도 없어(원장 표 칸도 편집 가능한 선택칸이라 색이 없다) 새로 만드는 일은 이 티켓 범위 밖이라 보고만 남긴다.
- 결정: **data-service-call-id/data-call-open을 카드에도 그대로 붙였다**(표 행과 같은 값). 처음에는 충돌을 피하려 안 붙이는 쪽도 고려했지만, 그러면 휴대폰에서 카드로 연 패널을 닫을 때 포커스가 아무 데도 안 돌아간다(스펙의 일반 규칙 "닫으면 포커스가 원래 자리로 돌아온다"를 휴대폰에서만 못 지킨다). `firstVisible` 픽스로 두 폭 모두 지키는 쪽을 택했다. 이 때문에 ticket 19의 뷰 테스트 헬퍼(`editable-call-grid-views.test.tsx`의 `dataRow`)가 "첫 매치가 표 행"이라고 가정하던 게 깨져, `call-row-warnings.test.tsx`에 이미 있던 더 안전한 `<tr[^>]*data-service-call-id="…"[\s\S]*?</tr>` 패턴으로 맞춰 고쳤다(그 파일의 다른 로직은 그대로).
- i18n: `calls.phoneCard.aria`(ko "원장 카드 목록", vi "Danh sách thẻ sổ cuộc gọi")만 새로 추가했다. 나머지 글자(빈 상태, 아리아 라벨 "{time} 콜 상세 열기", 경고 문장)는 기존 키를 그대로 재사용했다.
- 새 테스트: `call-phone-card-list.test.tsx`(카드가 보이는 항목·첫 경고만·연락처·금액 미노출·빈 상태·ko/vi), `editable-call-grid-phone.test.tsx`(표/새 행 추가가 태블릿 이상 블록 안에 있는지, 카드 블록이 항상 렌더되는지), E2E `tests/e2e/story-ticket-26-phone-ledger-card-list.spec.ts`(390px: 표·빠른예약·표편집 숨음/카드 내용/카드 탭→읽기 패널→닫으면 포커스 복귀, 768px: 반대).
- 함정(기록): 기본 시드는 영업일이 첫 활성 시간 슬롯(11:00, sortOrder 최소)부터 시작해 자정을 넘어 이어진다(`businessMinute`). 11:00 이전 시각(예: 10:00)은 "그 영업일의 뒤"로 계산되어, 그보다 이른 사용중 콜과도 "앞 시술 미완료" 경고가 (의도대로) 붙는다. E2E의 "경고 없음" 비교 콜은 그 함정을 피해 11:00으로 뒀다.
- 넘긴 것: 20(빠른 예약 패널)이 생기면 `TherapistAvailabilityPanel`을 감싼 휴대폰-숨김 래퍼를 그 패널로 옮겨야 한다. 17(충돌 비교)·18(이탈 안내)·16(요청 id)은 표 편집·저장 파이프라인 쪽이라 이 티켓에서 건드리지 않았다(`EditableCallRow`/`AddRowForm`의 내부 로직은 손대지 않고 바깥 래퍼만 추가했다).
- 검증(전용 DB `vietnam_aesthetic_t26`, 포트 3126):
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 702개 전부 통과(새 테스트 13개 포함).
  - `for f in scripts/validate-story-*.mjs; do node "$f" ...; done`: 분기 당시(3f2ffdb)엔 `validate-story-4-6`(메모의 기존 실패)과 `validate-story-5-5`가 함께 실패했다. 5-5는 `git stash`로 되돌린 같은 커밋에서도 그대로 재현돼 내 변경과 무관한 통합 브랜치의 기존 실패임을 먼저 확인했다(`monthly-closing-service.ts missing status !== "잠금"`, 티켓 35쪽). 아래 병합에서 그 수정(`b2e2846 fix(closing): validate-story-5-5가 새 재오픈 상태 검사 방식을 보게 고친다`)이 들어와 지금은 `validate-story-4-6`만 남는다.
  - `pnpm build` 성공.
  - E2E(운영 빌드): 새 스펙 3건 통과(390px 카드·숨김·탭·포커스 복귀, 768px 표·빠른예약). 관련 기존 스펙(ticket-13, ticket-19, ticket-03, ticket-14, ticket-15, 2-2, 2-6) 34건 모두 통과 — 특히 ticket-13의 "경고 버튼으로 열고 닫으면 그 버튼에 포커스" 테스트가 `firstVisible` 픽스 이후에도 1440px에서 그대로 통과함을 확인했다.
- 병합 전 `git merge integration/app-expansion` 재확인: 분기 뒤 그 사이에 올라온 `validate-story-5-5` 수정(티켓 35쪽, 커밋 `b2e2846`/`ac936c3`)이 충돌 없이 들어왔다. 병합 뒤 `npx tsc --noEmit`·`pnpm test:unit`(702개)·검증 스크립트 루프를 다시 돌려 `validate-story-4-6`만 남은 것을 확인했다(위 수치에 반영).
