# Calls Module

Owns the reservation and service-call ledger.

## Story 2.1 Scope

- `ServiceCall` stores the date-scoped call row using stable references: `OperatingMonth.id`, `Room.id`, `Course.id`, Story 1.6 time-slot `value`, and code `codeType + code` values.
- `ServiceCallAssignment` stores 담당자 columns as normalized rows with stable roles: `THERAPIST_1`, `THERAPIST_2`, `EARCARE`.
- `listServiceCallsForDate()` returns one selected operating-month/date ledger, ordered by Story 1.6 time-slot sort order and creation order.
- `saveBasicServiceCallRow()` validates active masters, operating-month date range, locked-month blocking, stable code values, and writes the call row plus assignments in one transaction.
- Story 2.3 replaces the former payment, commission, earcare pool, and call-credit placeholders with server-derived readonly values.

## Story 2.2 Scope

- `ServiceCallStatusHistory` stores call status transitions in `service_call_status_histories`.
- row autosave used the `idle`, `saving`, `saved`, and `error` state model with the Korean row states `저장중`, `저장됨`, and `저장 보류`. Ticket 15 replaced these (see Ticket 15 Scope below).
- Status changes record `service_call.status_changed`; sensitive row changes record `service_call.row_changed`.
- Autosave retry must preserve the local draft instead of replacing failed input with the last server value.

## Story 2.3 Scope

- Completed-call calculation runs in the calls domain service, not in UI 계산 code.
- Only completed rows calculate money, pool, and recognized-call values. The service accepts both the legacy Korean value `방문완료` and the Story 1.6 stable code `VISIT_COMPLETE`; non-completed rows return a `not_completed` calculation status and are excluded from downstream totals.
- Discount is `0` when `discountTypeCode` is empty and fixed `100,000` VND when any discount type is selected.
- Calculation source of truth is `CoursePolicy.basePrice`, `CoursePolicy.earcarePoolAmount`, `CoursePolicy.opsCallCredit`, and `TherapistCourseRate.amount` for the selected operating month.
- Missing course policy or therapist rate is represented by an explicit calculation status and Korean error message rather than silently using zero.
- `listCompletedServiceCallCalculationsForDate()` exposes only calculated completed rows for settlement/dashboard handoff, including separate `THERAPIST_1` and `THERAPIST_2` assignment records.
- Calls do not add derived amount columns before monthly close snapshots; amounts are DTO/domain outputs.

## Story 2.4 Scope

- D코스 마사지사2 필수 여부는 course label or code text가 아니라 selected operating month의 `CoursePolicy.requiresSecondTherapist`로 판단한다.
- `saveBasicServiceCallRow()` and `autosaveServiceCallRow()` block required-second-therapist rows before any `ServiceCall`, assignment, status history, or audit write when `therapist2Id` is empty.
- The domain error code is `D_COURSE_SECOND_THERAPIST_REQUIRED`, and Server Actions map it to `fieldErrors.therapist2Id` plus a Korean form error.
- Completed invalid historical rows with `requiresSecondTherapist=true` and no therapist2 return `second_therapist_required` and are excluded from `listCompletedServiceCallCalculationsForDate()`.
- The call grid connects the therapist2 field error with `aria-invalid`, `aria-describedby`, `role="alert"`, a danger ring, a `!` icon, visible text, and the existing retry/draft-preservation flow.

## Story 2.5 Scope

- `DailyExpense` owns date-scoped U:X daily expense rows in `daily_expenses`. It stores `OperatingMonth.id`, `expenseDate`, whole-number VND `amount`, `description`, stable `Employee.id` handler, optional `note`, and `isActive`.
- Daily expenses are never physically deleted in normal operation. `deactivateDailyExpense()` soft-deletes with `isActive=false`, and only active expenses contribute to summaries.
- Expense create/update/deactivate reuse the operating-month date-range and payout lock guardrails. Range failures use `OPERATING_MONTH_DATE_OUT_OF_RANGE`; `마감확정` and `잠금` months use `OPERATING_MONTH_LOCKED`.
- Expense mutations record `daily_expense.created`, `daily_expense.changed`, and `daily_expense.deactivated` audit events with plain JSON snapshots. Snapshot dates use `YYYY-MM-DD`, amount is number, and handler is employee ID.
- `getDailyCallLedgerSummary()` returns the daily strip DTO: reservation, completed, no-show, canceled, payment, therapist commission, earcare pool, discount, expense, `netSales`, course summaries, and warning counts.
- `netSales = paymentTotal - expenseTotal`. Expenses do not change call payment, commission, discount, or earcare pool values.
- Money totals and course summaries include only rows with `calculationStatus === "calculated"`. `not_completed`, missing policy/rate, and `second_therapist_required` rows are excluded from amount and course summary totals.
- Course summaries are grouped by stable `Course.code` A-E, never by course label or policy name text.

## Story 3.2 Scope

- `/live` reuses `getDailyCallLedgerSummary()` for read-only / 읽기 전용 first-screen status and KPI display.
- The summary DTO includes `inUseCount` and `cleaningCount` so the first screen does not infer call-ledger status from room cards.
- `inUseCount` recognizes `사용중`/`IN_USE`/`USING`; `cleaningCount` recognizes `청소중`/`CLEANING`.
- UI 계산 재구현 금지: `/live` reads 결제합계, 순매출, 코스별 방문완료, warning counts, `inUseCount`, and `cleaningCount` from the service.

## Story 2.6 Scope

- `EditableCallGrid` uses TanStack Table as a headless row/column model while preserving the semantic `<table>` ledger markup.
- Keyboard movement is route-local in `call-ledger-keyboard.ts`: `Tab`/`Shift+Tab` move through editable fields, `Enter` commits and moves below, arrow keys move adjacent cells, and `Esc` restores the last server draft without autosave.
- Option cells use type-ahead combobox inputs for time, room, course, therapists, earcare, status, discount type, payment method, and confirmation code.
- Comboboxes persist stable value IDs/codes through hidden inputs and draft payloads. Display labels are never sent as downstream keys.
- Combobox accessibility uses `aria-expanded`, `aria-controls`, and `aria-activedescendant` with a listbox popup. Dropdown options always include visible text labels; swatches are decorative only.
- Computed readonly cells remain server-derived, `bg-readonly`, tabular, and visually distinct from editable cells.
- D-course therapist2 errors keep `aria-invalid`, `aria-describedby`, visible Korean copy, and the existing autosave retry/draft-preservation behavior.

## Ticket 15 Scope (저장 충돌 거절과 행 저장 상태)

- Saving an existing row requires `expectedUpdatedAt`, the `updatedAt` of the row the screen last received. Both `autosaveServiceCallRow()` and the existing-row path of `saveBasicServiceCallRow()` update with one conditional `updateMany` on `id`, `operatingMonthId`, and `updatedAt`, so no other save can slip in between the version check and the write.
- When no row was updated but the call still exists in that month, the service throws `StaleServiceCallError` (`STALE_CALL`, "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.") carrying the current row. Nothing is written: no assignment, status history, or audit entry. There is no force overwrite.
- `getServiceCallRow()` reads one call as saved now. The ledger's "최신 내용으로 다시 불러오기" uses it, because the row returned with the rejection may already be outdated.
- The ledger sends at most one save per row (`call-row-save.ts`). Edits made while waiting are collected and sent with the `updatedAt` from the response, so a row's own autosaves never conflict and a late response never reverts newer input. Inputs stay enabled while a save is in flight.
- Row save states now use the shared `SaveStatus` chip in the 저장상태 cell, apart from the warnings cell: `저장 중`, `저장됨` (also for a row not yet edited on this screen), `저장 실패`, `충돌 확인 필요`. The Story 2.2 labels `저장중` and `저장 보류` are no longer shown for the save state (`저장 보류 계산 대기` remains in the calculation cell).
- Daily expense and customer saves are unchanged and have no version check.

## Ticket 16 Scope (새 행 요청 id)

- `ServiceCall.requestId` (`request_id`) is nullable and unique. Calls made before Ticket 16 keep it empty.
- The ledger's new row uses `createServiceCallRow()` with the draft's `requestId`, which returns `{ row, alreadySaved }`. When a call already exists for that request id, it returns that call with `alreadySaved: true` and writes nothing, not even an audit entry. The lookup runs before the write checks, so a repeat still gets the call it made even if the month was locked since.
- When two creations with the same request id run at once, the later insert fails on the unique index (`P2002`), and that request reads the call the first one made and returns it the same way. One call and one creation audit remain. `saveBasicServiceCallRow()` keeps creating without a request id.
- The Server Action `createServiceCallRowAction()` replaces the add-row form action and returns the notice "이미 저장된 콜입니다." for a repeat.
- The new row keeps a controlled draft (`call-new-row-save.ts`). Each draft gets one request id, kept until the call is saved. When the response is lost (network error, or no answer within 15 seconds) the row shows `저장 여부 확인 중`, keeps its input locked as sent, and "재시도" sends the same request id. A late answer is still taken. After a save the row starts a blank draft with a new request id.

## Includes

- service calls
- therapist and earcare assignments
- status history
- daily expenses
- completed-call payment and commission derivation
- D-course second-therapist validation
- daily ledger summary and course-code summary
- keyboard-first call ledger and type-ahead cell behavior

## Upstream

- `masters` for operating months, rooms, courses, employees, time slots, and code values

## Query cost

- `listServiceCallsForDate()` and `listServiceCallsForOperatingMonth()` prefetch course policies and therapist course rates for the whole batch (`prefetchCalculationSources`) and hand them to `calculateServiceCallCompletion()`. Row-by-row rate lookups are an N+1: one month of ledger rows produced hundreds of extra round trips and made the monthly screens take ~10 seconds.
- Single-row write paths call the calculation without prefetched sources and keep the original per-row lookup.

## Downstream

- `rooms` for active room status
- `settlements` for completed-call payouts
- `dashboard` for operational KPIs
- `/live` for first-screen status and KPI summaries
- `closing` for monthly totals
- `audit` for sensitive changes

## Does Not Own

- room display layout
- attendance input
- monthly close locking
- monthly-close snapshot persistence for derived amount columns

## App Expansion (tickets 17–29, 33–34, 37–38)

- Save conflict comparison lives in the nonmodal call detail panel. Reapply uses the latest row version and selected fields; customer links must use the dedicated correction flow. Pending inputs survive retry and navigation is guarded for tabs, screens, dates and operating months (user decision 2026-10-16).
- Ledger views share time, customer/memo and status at the left. Infrequent fields are disclosed in detail. Phone widths show read-only row cards; larger widths keep the editable grid. Cross-screen call links use `src/lib/ledger-address.ts`.
- Quick booking owns one request id through response loss/retry, creates an optional new customer in the same transaction, rejects duplicate Therapist assignments, and returns focus to the saved row. Duplicate-save notices stay outside the drawer after it closes. The “now” action fills the current date/time and advances to Therapist (user decision 2026-10-16).
- Customer search returns visit counts, comparable same-phone candidates and recent visits ordered by service date and time-slot order. Customer-wide preferences and per-visit requests remain distinct; importing a recent visit requires explicit selection.
- `correctServiceCallCustomerLink()` is the only existing-call link mutation: reason, current version, writable operating month and actor are required; its audit records previous/new ids and reason (ADR 0003). Ordinary row saves reject link changes; the grid's customer action opens the detail panel. New rows may still choose a customer at creation.
- Planned working-day facts come from the masters read-only query, alongside availability; day off and unset never imply attendance or block booking. Assigned-call queries supply schedule impact without exposing customer/contact/amount data. `assigned-service-call-query.ts` is a dependency-free read boundary used when masters rejects employee deactivation with assigned future calls.
- Closing reads call calculation errors and unfinished calls through services. Exceptional close requires the displayed unfinished-call ids and a recorded reason (ADR 0005); closing never marks them completed.
