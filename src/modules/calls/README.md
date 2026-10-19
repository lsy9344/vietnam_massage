# Calls Module

Owns the reservation and service-call ledger.

## Story 2.1 Scope

- `ServiceCall` stores the date-scoped call row using stable references: `OperatingMonth.id`, `Room.id`, `Course.id`, Story 1.6 time-slot `value`, and code `codeType + code` values.
- `ServiceCallAssignment` stores 담당자 columns as normalized rows with stable roles: `THERAPIST_1`, `THERAPIST_2`.
- `listServiceCallsForDate()` returns one selected operating-month/date ledger, ordered by Story 1.6 time-slot sort order and creation order.
- `saveBasicServiceCallRow()` validates active masters, operating-month date range, locked-month blocking, stable code values, and writes the call row plus assignments in one transaction.
- Story 2.3 replaces the former payment and commission placeholders with server-derived readonly values.

## Story 2.2 Scope

- `ServiceCallStatusHistory` stores call status transitions in `service_call_status_histories`.
- row autosave used the `idle`, `saving`, `saved`, and `error` state model with the Korean row states `저장중`, `저장됨`, and `저장 보류`. Ticket 15 replaced these (see Ticket 15 Scope below).
- Status changes record `service_call.status_changed`; sensitive row changes record `service_call.row_changed`.
- Autosave retry must preserve the local draft instead of replacing failed input with the last server value.

## Story 2.3 Scope

- Completed-call calculation runs in the calls domain service, not in UI 계산 code.
- Only completed rows calculate money values. The service accepts both the legacy Korean value `방문완료` and the Story 1.6 stable code `VISIT_COMPLETE`; non-completed rows return a `not_completed` calculation status and are excluded from downstream totals.
- Discount is `0` when `discountTypeCode` is empty and fixed `100,000` VND when any discount type is selected.
- Calculation source of truth is `CoursePolicy.basePrice` and `TherapistCourseRate.amount` for the selected operating month.
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
- `getDailyCallLedgerSummary()` returns the daily strip DTO: reservation, completed, no-show, canceled, payment, therapist commission, discount, expense, `netSales`, course summaries, and warning counts.
- `netSales = paymentTotal - expenseTotal`. Expenses do not change call payment, commission, or discount values.
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
- Option cells use type-ahead combobox inputs for time, room, course, therapists, status, discount type, payment method, and confirmation code.
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
- therapist assignments
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

## Ledger Flow Redesign Ticket 03 (흐름별 원장 목록과 편집 패널, 목록 모양은 1018 Ticket 02가 대체)

This replaces the Story 2.6 grid, the Ticket 19 view switch, and the Ticket 16 add-row form on the ledger tab. The save contract (`call-row-save.ts`, `expectedUpdatedAt`, conflict compare and reapply, leave guard) is unchanged.

- `call-ledger-list.tsx` shows the day's calls as one-line rows in flow groups: in use (`사용중`·`청소중`) → reserved → finished (`방문완료`·`취소`·`노쇼`), each in the server's time-slot order (`ledger-flow.ts`). All rows are siblings in one `tbody`, so a row that moves to another group keeps its save state. The finished group is folded by default; the unfolded state is kept in `localStorage` (`calls.ledger.doneExpanded`) and falls back to folded.
- Each row owns its `callRowSaveReducer` and renders its edit panel (`call-edit-panel.tsx`) into the workspace's single `SidePanel` through a portal. The panel groups booking, entry, payment (method pills, discount type, calculated amounts, commissions for settlement roles, "결제 완료"), memo, and "더 보기" (visit request, confirmation, customer-link correction). The former call detail panel (all warnings, related calls) is part of it. Fields autosave on choose or blur.
- Row buttons: "입장" saves `actualEntryTime` = now rounded to ten minutes and `status` = in use; with no room it first offers only rooms not taken by in-use or cleaning calls. "결제" opens the panel at the payment group.
- Keyboard (`ledgerListKey`): ↑↓ between rows, Enter opens the panel at its first field, Esc returns focus to the row, N opens quick booking (`data-quick-booking-trigger`). Shortcuts are off inside fields and dialogs.
- New calls come only from quick booking; after it saves, the new row is selected and its panel opens. The old `view` address parameter is ignored. Phone width (<600px) still shows the Ticket 26 card list and a read-only panel until ledger-flow Ticket 05.

## 1018 Ticket 01 (실제 종료·예약 경로·예약자명)

- `ServiceCallRowDto`, the save input, and the audit snapshot carry `actualEndTime` (HH:mm, any minute), `bookingChannelCode` (an active `BOOKING_CHANNEL` code), and `bookerName`. Like `actualEntryTime`, a save that leaves one of them out keeps the stored value; `null` clears it. Stale-save rejection and request ids are unchanged. A changed actual end is a sensitive row change (`service_call.row_changed`).
- Availability holds a Therapist over [reservation time, actual end) when the call has an actual end, and over [reservation time, display end) when it does not (spec D2, ADR 0001). An in-use call with an actual end adds no hold past its display end.
- `listServiceCallFormOptions()` returns `bookingChannels`.

## 1018 Ticket 02 (두 줄 원장)

This replaces the flow-grouped table of Ledger Flow Ticket 03 above; the save contract, row buttons (enter, pay) and keyboard are unchanged until 1018 Ticket 03.

- `call-ledger-list.tsx` is an `ol` of two-line rows in the server's time-slot order (`ledgerTimeline` in `ledger-flow.ts`). Top line: reservation time, `입장 → 종료` (`미입장` / faint `예상` display end / actual end, `ledgerEndView`), status chip, main button. Bottom line: booking channel and booker (`ledgerWhoLabel`: booker name, else the linked customer's name, else the first line of customer memo), course, Therapist ▾, room ▾, payment badge. Finished calls are folded at the bottom; on the business today a `지금 HH:MM` line sits before the first later call and late reservations say `N분 늦음` (`nowDividerIndex`, `lateMinutes`). Parties keep their head row and a left bar.
- The ▾ cells (`ledger-cell-picker.tsx`) open a listbox in place. The Therapist list asks `listTherapistAvailability` at the call's time with `excludeCallId` (the call's own hold is left out, counts are not) and orders it with `therapistPickList`: checked-in therapists who can take the course first, fewest finished today first; the rest below. Picking one who cannot take it goes through the quick-booking override warning. The room list puts free rooms (`freeRoomOptions`) first (`roomPickList`). Both save through the row's own save state.
- `ServiceCallRowDto.reservedEnd` is reservation time + course length. The edit panel's entry group shows six times: reservation time·course, actual entry, reserved end, display end, actual end, next free time (actual end, else display end).
- Phone width shows the same two-line rows read-only (no main button, plain text instead of ▾ cells).

## 1018 Ticket 03 (입장·종료·청소 끝, 결제 배지, 자동 청소 중)

This replaces the row buttons (enter, pay) and the panel's "결제 완료" of the sections above.

- Row button (`nextLedgerAction`): reserved → "입장" (in use, `actualEntryTime` = now to the minute; no ten-minute rounding), in use → "종료" (cleaning, `actualEndTime` = now), cleaning → "청소 끝" (visit complete) with a small "종료 취소" (back to in use, `actualEndTime` cleared). No confirmation dialog. `actualEntryTime` is any HH:mm now, like `actualEndTime`.
- The status chip on the row and the panel's status field are lists that apply `statusChangeTimes` (spec D11): in use fills an empty entry with now and clears the end; cleaning/visit complete fill an empty entry with the reservation time and an empty end with the earlier of now and the display end; reserved clears both; no-show/cancel keep them. Off the business today, "now" is not used (entry = reservation time, end = display end). The entry and end times on the top line can be corrected in place (`type="time"`); the panel has both as time fields.
- Payment badge: a list of payment methods (and "결제 미확인" to clear) that saves only `paymentMethodCode`. Status does not change.
- `autoFinishOverdueCalls()` (ADR 0008): the ledger page (both tabs), the availability action, and the rooms, live and TV pages call it before they read the day. An in-use call with an actual entry, no actual end, a known course length and a display end before now becomes cleaning with `actualEndTime` = display end and a `service_call.auto_finished` audit (reason "자동 종료", actor `SYSTEM_AUDIT_ACTOR_ID` = `system`, shown as "시스템(자동)" on the audit screen). No status history row is written, as that table needs an account. Locked months are left alone; so is a call that was ever moved back from cleaning to in use (종료 취소). The update is conditional on the read `updatedAt`, so concurrent reads write once. When the availability action finishes a call it revalidates `/calls`, and a ledger line with no unsent edit, save in flight, failure or conflict follows a newer row the ledger receives (`refreshed` in `call-row-save.ts`), so auto cleaning does not leave open lines on a stale version.
- Availability no longer holds a Therapist past the display end of an in-use call (no overrun): `unavailableReason`, `inServiceDisplayEnd` and `priorServiceEndCheck` are gone, and so are their notices. The rooms screen's `종료확인` state stays for the rare in-use call past its display end (one whose end was canceled).

## 1018 Ticket 04 (상태 카드, Therapist 현황 줄, 하루 수납 이번 달 권한)

This replaces the flat status count line and the `1+4` Therapist strip on the ledger tab.

- `LedgerStatusCounts` is seven cards (all, reserved … canceled) in a wrapping row: summary-card shape on the beige surface, the total in the summary-number size, each status named by its `CallStatusChip`. Nothing on them is clickable.
- `listTherapistAvailability` rows also carry `callCounts.finished` (cleaning and visit complete; `done` still includes in use), `plannedStartTime` from the schedule, and `current`: the state on the business today at now, or at the asked time on another day — checked out / before check-in from attendance, otherwise in use (`expectedEnd` = end of the covering hold, reservations included) or available (`nextReservationTime` and `freeMinutes` until it). The page asks once, at the first time slot, for both the quick booking and the strip.
- `TherapistStatusStrip` (`therapist-status-strip.tsx`, client) shows those rows picked by `therapistStatusRows` (checked in; before check-in when scheduled to work or already holding a call; checked out only with calls) and ordered by `sortTherapistStatusRows` (free now first, then fewer finished; fewer finished; fewer remaining reservations; number). A card opens the quick booking with that Therapist on top, at the now slot on the business today or the first slot otherwise, availability loaded (`requestQuickBookingWithTherapist` → reducer `start`, 1018 Ticket 05). Its "콜만" button sets the `therapist` address parameter; `CallLedgerList` (`therapistFilter`) then hides, not drops, the other Therapists' lines (the open call stays), so a hidden line keeps its save state and leave guard, party heads count the whole day, and the finished toggle counts only the shown calls. A "모두 보기" notice clears it. The strip collapses and remembers it in `localStorage`. "미지명 N" closes the row; rooms and cleaning are left out. The header "빠른 예약" button now opens an untouched panel fresh, so a preset Therapist or a dropped "1명 추가" does not linger.
- The cashbook tab reads the month till only for administrator and settlement manager (`includeMonthTill`), and `DailySummaryStrip` draws "이번 달" notes and till rows only for them, so a counter's page carries no month numbers.

## 1018 Ticket 05 (빠른 예약 옆 패널과 2단계)

This replaces the five-step quick booking modal (customer → schedule → Therapist·course → room·memo → review) of Ticket 20 onward. Request ids, the party transaction (one customer link on call 1, ADR 0007) and "1명 추가" are unchanged.

- `QuickBookingPanel` is a `SidePanel` in `CallLedgerWorkspace`'s side column, so the ledger narrows instead of being covered; below 600px it is a full-screen sheet. The toolbar keeps only `QuickBookingTrigger` (`data-quick-booking-trigger`, N shortcut), which reaches the panel through a window event like the strip card and "1명 추가" (`quick-booking-party-join.ts`). While the panel is shown the trigger turns `secondary` (`aria-expanded`), so the panel's "다음"/"예약 저장" is the screen's one primary button; the panel announces this through `announceQuickBookingShown` and the trigger reads it with `useSyncExternalStore`. Opening a call shows its edit panel in the same column and hides, not drops, the quick booking draft. Closing returns focus to the opener; after a save the panel closes and the new row is opened.
- Two steps (`quick-booking-draft.ts`): ① conditions — date, time, party size, and guests picked by course chips; ② customer — booking channel buttons, booker name, existing-customer search, memo, a one-line summary (`quickBookingSummary`) and save. Rooms are not chosen here any more. The reducer keeps `guests` (guest 1 mirrored into the save draft) and `partySize`; save waits until they match. A chip on the "미지명" line adds a guest with no Therapist; one Therapist cannot take two guests. `start` opens a fresh draft at the now slot (business today) or the first slot, with the strip card's Therapist as `presetTherapistId` (shown on top, not picked).
- ① lists (`quickBookingTherapistGroups`) checked-in therapists who can take the time, fewest finished first; "출근 전 보기" adds only those scheduled "근무 예정" and not checked in; the rest (busy, checked out) fold under "이 시각에 안 되는 N명" with their free-from time. Chips sit in one column per active course (`quickBookingCourseColumns`); an impossible chip asks the override warning first. A D-course guest with a named Therapist picks the second one from a list.
- Saving (spec D21–D22): the booker name goes into customer/memo; with no existing customer and a booker name, a new customer of that name is created in the call's transaction. `createQuickBookingServiceCall` and `createQuickBookingParty` name a nameless, customerless `WALK_IN` booking `워크인 N` (next number that day) in booker name and customer/memo. The memo is the visit request.
- A D course needs its second Therapist only once the first is set, so a 미지명 D-course reservation saves with neither (`assertSecondTherapistRequirement`).
