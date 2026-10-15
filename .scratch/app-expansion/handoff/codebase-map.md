# 콜 원장 확장(티켓 17–36) 코드맵

기준: `vietnam_massage-preview`(01–12 클린), ledger 변경은 `feat/ticket-15-stale-save-rejection`(13·14·15 포함, main 위) 기준. 통합 브랜치 `integration/app-expansion`에는 둘 다 들어 있다. 티켓 16(요청 id)은 다른 세션이 커밋하는 대로 통합 브랜치에 들어온다(그 전에는 아래 16 관련 "없음"이 맞다). 이 지도는 탐색 시점의 스냅샷이므로 코드를 먼저 확인하라.

---

## 1. 콜 원장(ledger)

### 페이지/탭/주소
- `src/app/(erp)/calls/page.tsx` — 서버 페이지, 옵션/행/고객/가능목록 로드.
- `src/app/(erp)/calls/call-ledger-workspace.tsx` — 클라 루트. `useCallSelection()`(ticket15)이 `?call=<id>` 주소 파라미터로 상세 패널 열림/닫힘·포커스 복귀를 관리(`history.replaceState`, 서버 재호출 없음). `CALL_PARAM`은 `ledger-address.ts`.
- `src/app/(erp)/calls/ledger-address.ts` — `LedgerTab`("ledger"|"cashbook"), `ledgerHref`, `ledgerCallHref`, `ledgerCallAnchorId`, `CALL_PARAM = "call"`.
- 티켓 19(보기 전환)·26(휴대폰 카드)는 아직 없음 — `showSettlementColumns` 불리언 하나로만 열 가시성을 가름.

### 행 저장 파이프라인 (B07, ticket15)
- `src/app/(erp)/calls/call-row-save.ts` — 상태머신. `RowSaveStatus = "idle"|"saving"|"saved"|"failed"|"conflict"`, `CallRowSave`(draft/savedRow/status/inFlight/queued/message/fieldErrors/latestRow), `CallRowSaveEvent`(edit/commit/saved/failed/stale/reload/cancel), `callRowSaveReducer`, `draftFromRow`, `initialCallRowSave`, `isSaveHeld(status)`(failed|conflict). 행마다 inFlight 하나, 응답 대기 중 수정은 모아서 다음 저장에. `expectedUpdatedAt`은 `savedRow.updatedAt`.
- `src/app/(erp)/calls/call-row-save-status.tsx` — `CallRowSaveStatus`. `SaveStatus`(`components/ui/save-status.tsx`) 매핑, 실패시 재시도, 충돌시 "최신 내용으로 다시 불러오기".
- `src/app/(erp)/calls/editable-call-grid.tsx`의 `EditableCallRow` — `useReducer(callRowSaveReducer, ...)`, `save.inFlight`를 `useEffect`로 지켜보며 `autosaveServiceCallRowAction` 호출 → `dispatch({type:"saved"|"stale"|"failed"})`. `reloadLatest()`는 `reloadServiceCallRowAction(row.id)`.
- `src/modules/calls/service-call-service.ts`: `StaleServiceCallError`(currentRow), `updateServiceCallAtVersion(tx, {serviceCallId, operatingMonthId, expectedUpdatedAt}, data)` — `updateMany` 조건부 갱신. `saveBasicServiceCallRow`, `autosaveServiceCallRow`, `getServiceCallRow({serviceCallId})`.
- `src/modules/calls/service-call-schema.ts`: `savedVersion`, `serviceCallInputSchema.expectedUpdatedAt`, `serviceCallAutosaveInputSchema.expectedUpdatedAt`(required).
- `src/app/(erp)/calls/actions.ts`: `ServiceCallAutosaveResult`(STALE_CALL + currentRow), `autosaveServiceCallRowAction`, `reloadServiceCallRowAction`.
- 17(충돌 비교 UI): `latestRow`/`conflict`까지만 있고 필드별 비교 화면 없음. 18(떠나기 전 안내): `beforeunload`/라우터 가드 없음.

### 경고(B02, ticket13–14)
- `service-call-service.ts`: `CALL_ROW_WARNING_ORDER = ["previous_service_unfinished","room_overlap","yield_to_reservation","calculation_error"]`, `CallRowWarningDto{code, relatedTime, relatedCallIds}`, `ServiceCallRowDto.warnings`, `previousServiceUnfinished`, `roomOverlapFor`(방 화면과 공유), `deriveRowWarnings`, `roomFloorFactsForDate(input)` → `{displayEnds, roomOverlaps}`.
- `call-warning-cell.tsx`(첫 경고 + "+N"), `call-warning-label.ts`(`callWarningLabel`, `spokenClock`), `call-detail-panel.tsx`(`CallDetailPanel`, 비모달 `SidePanel`, `WarningList`, 관련 콜 `onSelectCall`, `DetailRow`). 충돌 비교는 17이 여기에 더한다.

### 그리드 보조
- `call-ledger-keyboard.ts` — `EDITABLE_CALL_FIELDS`, `cancelCellDraft`, `moveAdjacentCell`, `moveEnterCell`.
- `tests/e2e/support/call-grid.ts` — `selectGridOption`/`selectGridOptionByValue`(combobox 셀 E2E는 반드시 이것).
- 테스트: `service-call-service.test.ts`(파일 안 로컬 `createMemoryPrisma()`), `call-row-save.test.ts`, `call-row-save-status.test.tsx`, `call-row-warnings.test.tsx`.

### 가능 코스(B01, 10–12 구현됨)
- `service-call-service.ts`: `TherapistAvailabilityCourseVerdict = "possible"|"time_short"|"rate_missing"`, `TherapistAvailabilityRowDto{therapistId, therapistName, attendance("before_check_in"|"checked_in"|"checked_out"), shiftCheck, available, unavailableReason, inServiceDisplayEnd, freeFrom, nextReservationTime, freeMinutes, priorServiceEndCheck, courses}`, `listTherapistAvailability({operatingMonthId, serviceDate, time, now?})`.
- 화면: `therapist-availability-panel.tsx`, `therapist-availability-view.tsx`(`AvailabilityCourseChoice` → 그리드 Therapist/코스 칸 채움).
- 29(근무 예정): `TherapistAvailabilityRowDto`에 근무표 필드 없음.
- 20/21(빠른 예약): 없음. 지금 가능 코스는 원장 위 상시 패널. `ModalPanel`(`components/ui/panel.tsx`)이 틀로 적합.

---

## 2. 고객(customers)

- `src/app/(erp)/customers/page.tsx`(searchParams `customerQuery`/`visitCustomer`/`visitMemo`), `customer-screen.tsx`(클라, 디바운스 검색), `customer-screen-view.tsx`(순수 뷰), `customer-forms.tsx`(`CreateCustomerPanel`), `customer-search.ts`(`CUSTOMER_SEARCH_DEBOUNCE_MS`, `CustomerScreenState`, `customerScreenHref`, `moveCandidateIndex`).
- 서비스(`service-call-service.ts`): `CustomerDto`, `createCustomer`/`updateCustomer`/`listCustomers`, `CustomerVisitSelection`, `CustomerVisitHistoryRowDto`, `CustomerVisitCandidateDto{kind,customerId,label,phone,latestVisitDate}`, `listCustomerVisitHistory`, `searchCustomerVisitCandidates`.
- `service-call-schema.ts`: `customerInputSchema{name, phone, memo}`, `customerUpdateSchema`.
- Prisma `Customer`: `name/phone/memo`만. ADR 0003: 고객은 콜 메모와 별개, 자동 연결 없음.
- 22: 상태별 건수·연락처 중복 비교 없음. 23: 공통 선호 칸(고객)·방문별 요청 칸(콜) 새 컬럼 필요. 24: 새 고객 + 콜 한 트랜잭션, 16과 같은 요청 id 계약. 25: `saveBasicServiceCallRow` 안에 `linkChanged` 감지 → `service_call.row_changed` 감사가 이미 있음(사유 없음) — 전용 액션으로 빼서 사유 필수·STALE_CALL·잠금 거절.

---

## 3. 정산(settlements)

- `src/modules/settlements/therapist-daily-settlement-service.ts` — `TherapistDailySettlementDto.paymentStatus{isPaid, paidAt, paidByAccountId, paidBy, history}`, `setTherapistDailySettlementPayment(input)`(잠금검사 `assertPaymentWritableContext` → upsert + history.create).
- `therapist-attendance-service.ts`(`upsertTherapistAttendance`, `TherapistAttendanceWarning{code:"IN_SERVICE_CALL"}`, 만근 인식), `earcare-attendance-service.ts`, `earcare-daily-settlement-service.ts`(지급 확인 없음), `ops-attendance-service.ts`, `ops-daily-incentive-service.ts`, `ops-monthly-incentive-service.ts`(지급 확인 없음).
- `settlement-evidence-call.ts` — `SettlementEvidenceCallDto`, `settlementEvidenceCall(row)`(민감정보 뺀 근거 콜, 명세서/마감 점검에 재사용).
- 화면: `settlements/therapist-settlement-view.tsx` + `therapist-daily-settlement-payment-form.tsx`, `settlements/earcare/earcare-settlement-view.tsx`, `settlements/operations/ops-daily-view.tsx`·`ops-monthly-view.tsx`. 액션: `settlements/actions.ts`, `earcare/actions.ts`, `operations/actions.ts`. 오류 매핑: `payment-action-error.ts`, `payment-action-input.ts`.
- Prisma: `TherapistDailySettlementPayment`(`isPaid, paidAt, paidByAccountId`, unique `[monthId,date,employeeId]`) + `...PaymentHistory`. 금액 스냅샷 없음.
- 30/31: 사건형 새 모델(확인/재확인/해제 + 금액·처리자·시각·사유), 단위 therapist `(month,date,employee)`, earcare `(month,date,employee)`, ops daily `(month,date,employee)`, ops monthly `(month,employee)`. 기존 지급완료 기록을 금액 없는 확인 사건으로 옮긴다. `assertOperatingMonthPayoutWritable`(`month-lock-guard.ts`) 재사용.

---

## 4. 월마감(closing)

- `src/modules/closing/month-lock-guard.ts` — `isOperatingMonthPayoutLocked`, `assertOperatingMonthPayoutWritable`, `OperatingMonthPayoutLockError`.
- `src/modules/masters/operating-month-schema.ts` — `operatingMonthStatuses = ["작성중","검토중","마감확정","잠금"]`.
- `src/modules/closing/monthly-closing-service.ts` — `startMonthlyCloseReview`, `confirmMonthlyClose`(미리보기 재계산 + `closeVersion = latest+1`로 `monthlyClosing.create`), `lockMonthlyClose`, `reopenMonthlyClose`(지금은 잠금→검토중만, 사유 5자 이상, 같은 `MonthlyClosing`에 `reopenedAt/By/Reason`), `getMonthlyClosingSnapshot`. 모두 `recordAuditEvent`.
  - 35: 상태 검사를 마감확정도 허용하도록 넓히면 된다. 권한 `closing:reopen`(관리자만) 이미 있음.
- `monthly-closing-preview-service.ts` — `listMonthlyClosingPreview`, `MonthlyClosingPreviewWarningCounts`. 계산 오류 집계, 지급 재확인 미처리, 마감 확인 대상 콜 목록 없음(33 신설). `MonthlyClosingFinancialsDto`엔 현금/계좌 분리 없음(ADR 0002; `dashboard-query-service.ts` 참고).
- 화면: `src/app/(erp)/closing/page.tsx`, `closing-action-panel.tsx`, `actions.ts`.
- 34: 스냅샷(`snapshotJson`)에 예외 사유·확인 콜 목록·당시 상태·처리자 자리 필요. ADR 0005.

---

## 5. 근무표 / 직군·역할 (27–29 신규)

- Prisma 모델 없음. 예: `PlannedWorkingDay{id, employeeId, workDate, planStatus, ...}` unique `[employeeId, workDate]`. 변경 감사는 `AuditLog`(예: `planned_working_day.changed`)로 충분해 보임.
- `src/modules/masters/employee-schema.ts` — `employeeGroups = ["OPERATIONS","EARCARE","THERAPIST"]`, `accountRoles = ["administrator","counter","waiter","settlement_manager","read_only_viewer"]`.
- 권한: `payout:write`(관리자+정산 담당)가 근무표 편집 역할과 일치.
- 라우트: `src/lib/routes.ts`의 `screenRoutes`에 항목 추가(zone `"settlements"`, roles) → 도크·탭·서버 접근 검사가 붙는다.
- 28의 역할별 링크/요약 분기 참고: `src/components/domain/room-status-card.tsx`.

---

## 6. 공통

### Prisma / 마이그레이션
- `prisma/schema.prisma` 단일 파일. PascalCase 모델 + `@@map("snake_case_plural")`, `@map("snake_case")`, `cuid()`. 인덱스 `idx_<table>_<cols>`, unique `uq_<table>_<cols>`.
- 마이그레이션 `prisma/migrations/<YYYYMMDDHHMMSS>_<snake_description>/`. `src/modules/migration/prisma-migrations.test.ts`가 마이그레이션을 검사할 수 있으니 새 마이그레이션 추가 시 확인. 병렬 티켓끼리 타임스탬프가 겹치지 않게 티켓 번호를 시각에 넣어라(예: `20261016<NN>0000_...`).

### 감사
- `src/modules/audit/audit-event.ts`(`auditActionPattern` dot.snake_case, `recordAuditEvent`), `audit-service.ts`(`listAuditLogs` 등). 범용 `AuditLog`(actorId, action, targetType, targetId, beforeValue, afterValue, reason).
- 화면 `src/app/(erp)/audit/`, E2E `tests/e2e/support/audit.ts`(`openAuditEntry`, `auditAfterValue`).

### 권한
- `src/lib/authorization.ts` — `SensitivePermission = "call:write"|"payout:write"|"closing:write"|"closing:reopen"|"employee:write"|"audit:read"|"migration:write"`, `requirePermission`, `requireRouteAccess`.

### i18n
- `src/lib/i18n/messages/{ko,vi}.ts`(키 1:1, `i18n.test.ts`), `types.ts`, `errors.ts`(`DOMAIN_ERROR_VI`, 서비스는 ko로 throw), `format.ts`, `codes.ts`, `client.tsx`(`useT`), `server.ts`(`getServerTranslator`).

### design.md 컴포넌트
- `src/components/ui/panel.tsx` — `SidePanel`(비모달, 닫으면 opener로 포커스), `ModalPanel`(모달, 600px 이상 오른쪽 480px 서랍 / 미만 전체 시트, 포커스 트랩).
- `confirm-dialog.tsx`(`ConfirmDialog`), `detail-row.tsx`(`DetailRow`), `status-indicator.tsx`, `warning-summary.tsx`(`WarningSummary`/`WarningList`), `save-status.tsx`(`SaveStatus`), `screen-state.tsx`(`ScreenState`).
- `src/app/(erp)/settlements/settlement-parts.tsx` — `PanelSection`.
- `src/components/domain/room-status-card.tsx` — 역할별 링크/요약 분기, `OverlappingCalls`(접이식 목록).

### validate-story 스크립트
- `package.json` `lint`는 `scripts/validate-story-1-1.mjs` ~ `7-3.mjs`만 잇는다. 09 이후 티켓용 스크립트는 없다(새로 만들 의무 없음). 기존 스크립트가 파일 내용을 검사하므로 고친 파일이 걸리면 그 스크립트를 맞춘다. 4-6은 기존 실패.

### E2E 지원
- `tests/e2e/support/{auth,db,call-grid,masters,settlement,cleanup,audit}.ts` + `README.md`(공유 Postgres 격리 규칙). 새 스펙은 이 README를 따른다.
- 단위 테스트의 메모리 Prisma는 공유 헬퍼가 아니라 파일마다 로컬 `createMemoryPrisma()`.

### 설계/ADR 문서 (메인 폴더에만 있음, untracked — 절대 경로로 읽는다)
- `/home/noah/Desktop/project/dev_busi/vietnam_massage/docs/adr/0004-payout-confirmation-preserves-confirmed-amount.md`(30), `.../docs/adr/0005-close-unfinished-calls-with-recorded-reason.md`(34).
- `/home/noah/Desktop/project/dev_busi/vietnam_massage/docs/design/2026-10-14-ui-redesign.md` — 화면별 시안, 공통 상태표, 반응형 규칙, 표현 금지선("가능≠확정", "지급확인≠송금"). 19/20/26/27 UI 1차 참조.
- `/home/noah/Desktop/project/dev_busi/vietnam_massage/docs/plans/2026-10-14-ledger-phone-floor.md`, `.../docs/plans/2026-10-14-app-expansion-interview.md`.
