# 25: 고객 연결 정정

**What to build:** 콜 상세 패널에서 잘못 연결된 콜의 고객을 사유와 함께 바꾸거나 연결을 해제한다. 입력은 콜, 새 고객(또는 해제), 필수 사유, 마지막으로 받은 updatedAt이다. 감사 기록에 이전 고객, 새 고객, 사유, 처리자가 남는다. 콜의 고객/메모는 바꾸지 않는다. (스펙 F06, ADR 0003, 스토리 81–83, 91, V09)

**Blocked by:** 13, 15, 22

**Status:** done

- [x] 마감확정이나 잠금 상태인 운영월의 콜은 거절되고, 관리자가 재오픈한 뒤에는 바꿀 수 있다.
- [x] updatedAt이 오래되었으면 STALE_CALL로 거절되고 쓰기와 감사가 없다.
- [x] 사유가 없으면 거절된다.
- [x] 카운터와 관리자가 콜 쓰기 권한으로만 할 수 있고, 다른 역할이 서버 액션을 직접 호출하면 거절된다.
- [x] 새 고객 후보는 22의 비교 정보로 고르며 자동 연결이 없다.
- [x] 콜 상세 패널에서 고객 화면으로 바로 갈 수 있다.
- [x] 콜 서비스 테스트로 감사 내용, 잠금 거절, STALE_CALL을 확인한다. 새 문구는 두 언어로 있다.

## Comments

- 2026-10-15 구현 완료(브랜치 `feat/ticket-25-correct-call-customer-link`, `integration/app-expansion` 4fbc952 위). 막는 티켓 13·15·22는 이미 통합 브랜치에 들어 있어 그 위에서 바로 시작했다. 스키마 변경이 없어 새 Prisma 마이그레이션은 만들지 않았다.
- 서비스(`src/modules/calls/service-call-service.ts`)에 전용 함수 `correctServiceCallCustomerLink`를 새로 추가했다. 기존 `saveBasicServiceCallRow`/`autosaveServiceCallRow`(원장 행 저장 파이프라인, 티켓 16이 같은 시기에 손대고 있어 건드리지 않았다)는 그대로 두고, customerId만 바꾸는 별도 조건부 갱신을 쓴다.
  - 입력은 `serviceCallId`, `customerId`(null이면 연결 해제), `reason`(필수), `expectedUpdatedAt`, `actorId`. 새 zod 스키마 `serviceCallCustomerLinkCorrectionSchema`(`service-call-schema.ts`)가 사유 필수(빈 문자열 거절, 500자 이하)를 검사한다.
  - 순서: 콜을 읽어 운영월 잠금 검사(`assertOperatingMonthPayoutWritable`, 마감확정·잠금만 거절, 재오픈 뒤 검토중이면 통과) → 새 `customerId`가 있으면 `requireCustomer`로 존재 확인 → `updateServiceCallAtVersion`(티켓 15의 그 조건부 갱신 그대로 재사용, `data: { customerId }`만 보내 다른 필드는 건드리지 않음)으로 STALE_CALL 검사와 쓰기를 한 번에 한다. 실패하면(잠금·사유 없음·STALE_CALL) 쓰기도 감사도 없다.
  - 성공하면 감사 `service_call.customer_link_corrected`를 남긴다. `beforeValue`/`afterValue`는 `{serviceCallId, customerId}`만 담는 좁은 스냅샷이고(기존 `service_call.row_changed`의 전체 행 스냅샷과 다르다), `reason`은 `recordAuditEvent`의 전용 `reason` 칼럼에 그대로 쓴다(감사 화면의 "사유" 열이 바로 보여준다). 콜의 `customerMemo`는 이 경로에서 전혀 쓰지 않는다.
  - 기존 그리드의 "고객" 칸(`CustomerLinkSelect`, 사유 없이 바로 바뀌고 `service_call.row_changed`로만 감사됨)은 건드리지 않았다 — 범위 밖으로 다음 섹션에 남긴다.
- 액션(`src/app/(erp)/calls/actions.ts`): `correctServiceCallCustomerLinkAction`(FormData, `useActionState`용, `createCustomerAction`과 같은 모양)과 `searchCustomerLinkCandidatesAction`(순수 검색)을 추가했다. 둘 다 `requirePermission("call:write")`만 쓴다 — 이 권한은 카운터·관리자에게만 있는 기존 권한표를 그대로 쓰므로 `authorization.ts`는 고치지 않았다(다른 역할이 직접 호출하면 `AuthorizationError`). STALE_CALL이면 `autosaveServiceCallRowAction`과 같은 모양(`currentRow` 포함)으로 돌려준다. `mapActionError`에 `SERVICE_CALL_CUSTOMER_LINK_REASON_REQUIRED` 전용 분기를 더해 `reason` 필드 오류로 보인다.
- 화면: 새 콜 상세 패널 하위 컴포넌트 `src/app/(erp)/calls/call-customer-link-correction.tsx`(`CallCustomerLinkCorrection`). `call-detail-panel.tsx`에 `PanelSection`으로 끼워 넣었고, `customers`·`isLocked` prop을 `call-ledger-workspace.tsx`까지 새로 뚫었다.
  - 지금 연결(이름·연락처 또는 "연결된 고객 없음")과 "고객 화면으로 이동" 링크(`customerScreenHref`, 연결된 고객이 있으면 그 고객, 없으면 고객/메모로)는 잠금 여부와 상관없이 항상 보인다.
  - 잠금 운영월(`isLocked`)이면 폼 대신 `ScreenState kind="locked"` 안내만 보이고 서버 호출 자체를 시도할 수 없다(방어적 UI, 실제 거절은 서비스가 한다).
  - 검색은 디바운스(`CUSTOMER_SEARCH_DEBOUNCE_MS` 재사용)로 새 액션 `searchCustomerLinkCandidatesAction`을 직접 부르는 자체 상태다(고객 화면의 주소 기반 검색과는 다른 길 — 패널을 열어도 원장 날짜·초안을 흔들면 안 돼서). 결과 중 `kind: "customer"`만 남기고(메모뿐인 후보는 연결할 customerId가 없어 이 정정의 대상이 아니다) `candidates.some(sharedPhone)`일 때만 22의 `CustomerCandidateCompare`/`isCustomerCandidateChosen`으로, 아니면 간단한 목록으로 보인다(고객 화면의 분기 그대로).
  - 처음에는 "컴포넌트를 `row.id:row.customerId`로 키잉해 리마운트"로 정정 뒤 상태를 깨끗이 되돌리려 했는데, 그러면 막 보여준 "고객 연결을 정정했습니다." 성공 문구가 리마운트로 바로 사라져 E2E에서 걸렸다(실제로 한 번 겪었다). `key={row.id}`(콜을 바꿀 때만 리마운트)로 바꾸고, 같은 콜 안에서 customerId가 바뀌면(정정 성공, STALE_CALL 뒤 "다시 불러오기") effect로 `pendingCustomerId`·검색 초안만 다시 맞췄다.
- 새 i18n 키(`calls.detail.customerLink.*`, 12개)를 `ko.ts`·`vi.ts`에 1:1로 추가했다. 도메인 에러 메시지도 두 언어로 뒀다: `errors.ts`의 `DOMAIN_ERROR_VI`에 `SERVICE_CALL_CUSTOMER_LINK_REASON_REQUIRED`/`INVALID_SERVICE_CALL_CUSTOMER_LINK_INPUT`, `KOREAN_MESSAGE_VI`에 zod 메시지 "정정 사유를 입력하세요."
- 가정·결정:
  - 사유 없음은 액션의 자체 zod 파싱(필드 오류, `reason` 칼럼 아래 바로 보임)과 서비스의 자체 zod 파싱(도메인 에러, 직접 호출을 막는 방어선) 둘 다에서 걸린다 — 기존 `reopenMonthlyCloseAction`/`reopenMonthlyClose` 쌍과 같은 이중 검사 패턴.
  - "새 고객 id == 지금 고객 id"로 다시 제출해도 막지 않는다(사유를 남기고 싶을 수도 있다고 보고 금지하지 않음). 감사는 그래도 남는다.
  - 연결 해제 뒤보이는 "T25 민아 · 0901112222" 같은 "지금 연결" 표시는 `customers`(고객 목록, 이미 `/calls` 페이지가 그리드의 고객 칸을 위해 불러오던 것)에서 customerId로 찾은 이름·연락처다. 새 질의는 추가하지 않았다.
  - 그리드의 "고객" 칸으로 사유 없이 바꾸는 기존 경로를 없애거나 사유를 강제하는 일은 하지 않았다(브리핑 지시: 원장 행 저장 파이프라인·editable-call-grid.tsx를 건드리지 말 것, 티켓 16이 같은 파일을 동시에 고치고 있었다). 두 경로가 같은 필드를 다르게 다루는 간극이 남는다 — 다음에 그 칸을 이 정정 작업으로 옮기거나 없앨지 결정이 필요하다.
- 범위 밖(다음에 넘길 것): 그리드 인라인 "고객" 칸 정리(위 간극), 빠른 예약(24)의 고객 단계도 같은 `CustomerCandidateCompare`/`searchCustomerVisitCandidates`를 재사용할 수 있다.
- 검증:
  - `npx tsc --noEmit` 통과.
  - `pnpm test:unit` 통과(679개 전부, 새 `describe("customer link correction", ...)` 8건 포함: 사유 없음 거절, 정정+감사 내용, 연결 해제, 잠금 거절(마감확정 월에 직접 만든 콜), 재오픈 뒤 허용(검토중 월), STALE_CALL(쓰기·감사 없음 확인), 행위자 없음 거절, 존재하지 않는 고객 id 거절).
  - `for f in scripts/validate-story-*.mjs; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`: `validate-story-4-6`만 기존 실패(메모·브랜치 선례와 일치, 이번 변경과 무관). `pnpm lint`의 `&&` 사슬 함정 때문에 이 방식으로 돌렸다.
  - `pnpm build` 통과.
  - E2E는 운영 빌드로 컨테이너 `vietnam-shell-02-e2e`에 전용 DB `vietnam_aesthetic_t25`·포트 3125를 올려 확인했다. 새 스펙(`story-ticket-25-correct-call-customer-link.spec.ts`, 3건: 사유와 함께 정정+감사 내용 확인, 사유 없음 거절+고객 화면 이동 링크, 마감확정 월은 폼 대신 안내) 모두 통과. 콜 상세 패널·후보 비교를 같이 건드리는 기존 스펙 `story-ticket-13-row-warnings-detail-panel.spec.ts`(10건, 390px 포함)·`story-ticket-22-visit-counts-and-candidate-compare.spec.ts`(2건) 회귀 없이 통과. 서버 PID만 종료했고 main·다른 워크트리는 건드리지 않았다.
  - `git merge integration/app-expansion`은 마지막에 fast-forward였다(이미 그 끝 위에서 시작했다) — 충돌 없음, tsc·단위 테스트 재실행 불필요.
