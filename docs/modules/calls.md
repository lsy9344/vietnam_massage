# Calls Module

## Source Documents

- `client_erp_specification.md` sections 6.2, 8.1
- `sheet_erp_design.md` sections 7.2, 8.1, 10.1
- Excel sheet: `실시간콜입력`

## Responsibility

The calls module owns the service-call ledger. This is the main transaction source for reservations, visits, room usage, payments, discounts, assignments, and recognized calls.

## Core Entities

- `ServiceCall`
- `ServiceCallAssignment`
- `DailyExpense`
- `ServiceCallStatusHistory`

## Story 2.1 Implemented Contract

- Route: `/calls`
- Page boundary: `requireRouteAccess("/calls")`
- Mutation boundary: `src/app/(erp)/calls/actions.ts` with `requirePermission("call:write")`
- Domain service: `src/modules/calls/service-call-service.ts`
- Date query: `listServiceCallsForDate({ operatingMonthId, serviceDate })`
- Basic write: `saveBasicServiceCallRow(input)`
- Input schema: `serviceCallInputSchema`
- Static validator: `scripts/validate-story-2-1.mjs`

The `/calls` page keeps `operatingMonthId` and `serviceDate` in URL search params. The date input is bounded by the selected operating month start/end dates. If no operating month exists, counters see guidance only; administrators also get the operating-month management link.

`saveBasicServiceCallRow()` blocks writes outside the selected operating month range with `운영월 범위를 벗어난 날짜입니다.` and blocks locked months with `OPERATING_MONTH_LOCKED`.

## Main Fields

- service date and start time
- room
- course
- customer or operating memo
- therapist 1
- therapist 2
- earcare staff
- payment amount
- therapist commissions
- earcare pool amount
- recognized call count
- reservation status
- discount type
- payment method
- confirmation flag
- notes

Story 2.3 displays payment amount, therapist commissions, earcare pool amount, and recognized call credit as server-derived readonly cells. The UI formats VND values but does not reimplement UI 계산 logic.

## Story 2.2 Autosave Contract

- Row autosave is scoped to one existing `ServiceCall` row and must require `serviceCallId`.
- The status-history table is `service_call_status_histories` via `ServiceCallStatusHistory`.
- The visible save state model is `idle`, `saving`, `saved`, and `error`; user-facing labels are `저장중`, `저장됨`, and `저장 보류`.
- Status transitions write `service_call.status_changed`; sensitive row changes such as payment method, discount type, assignments, and confirmation write `service_call.row_changed`.
- Failed autosave keeps the draft on screen and exposes inline retry using the same draft payload.
- Locked operating months and users without `call:write` are blocked by the Server Action/domain boundary and shown safe Korean errors.

## Story 2.3 Completed-Call Calculation Contract

- `calculateServiceCallCompletion()` is the calls service calculation boundary.
- Only completed rows calculate payment, commission, `CoursePolicy.earcarePoolAmount`, and `CoursePolicy.opsCallCredit`; the service recognizes both legacy `방문완료` and stable code `VISIT_COMPLETE`. Other statuses are excluded as `not_completed`.
- Empty discount is `0`; any selected discount type is fixed `100,000` VND.
- Payment is `CoursePolicy.basePrice - discountAmount`, clamped at zero.
- Therapist commissions use `TherapistCourseRate.amount` by therapist ID, course ID, and operating month. Massage therapist 1 and 2 are calculated independently.
- Missing course policy or therapist rate returns an explicit calculation status and Korean error message.
- `listCompletedServiceCallCalculationsForDate()` returns downstream aggregate inputs for completed rows only and exposes separate `THERAPIST_1` and `THERAPIST_2` assignment records.
- No derived amount columns are stored on `ServiceCall`; monthly close stories own snapshot persistence.

## Story 2.4 D-Course Second-Therapist Contract

- D-course enforcement is policy-based: the calls domain service reads the selected operating month's `CoursePolicy.requiresSecondTherapist` for `courseId`. It must not rely on course name, TV label, or a UI label.
- If `requiresSecondTherapist=true` and `therapist2Id` is empty, both new row save and existing row autosave fail with `D_COURSE_SECOND_THERAPIST_REQUIRED` before row, assignment, status history, or audit writes.
- The user-facing Korean message is `D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다.`
- Server Actions map this domain error to `fieldErrors.therapist2Id`, `formError`, and `domainErrorCode` so the grid can render field-level feedback.
- The grid therapist2 cell exposes `aria-invalid`, `aria-describedby`, `role="alert"`, danger ring styling, a `!` icon, and visible text. Failed autosave still keeps the draft and retry button.
- Historical invalid completed rows with `requiresSecondTherapist=true` and no therapist2 are not exposed as calculated downstream aggregates; row DTOs return `second_therapist_required` instead of silently calculating zero.

## Story 2.5 Daily Expense and Summary Contract

- Data model: `DailyExpense` in `daily_expenses`.
- Mutation boundary: `/calls` Server Actions `createDailyExpenseAction`, `updateDailyExpenseAction`, and `deactivateDailyExpenseAction`.
- Domain services: `createDailyExpense()`, `updateDailyExpense()`, `deactivateDailyExpense()`, `listDailyExpensesForDate()`, and `getDailyCallLedgerSummary()`.
- Static validator: `scripts/validate-story-2-5.mjs`.
- `DailyExpense` stores stable references: `OperatingMonth.id` and `Employee.id` for the handler. It does not store handler display names, account email, Excel row numbers, or formatted currency strings.
- `amount` is an integer whole VND value. UI renders formatted values such as `1,000,000 VND`, but DB/service payloads use numbers.
- Daily expense deactivation is soft delete via `isActive=false`. Active expenses only contribute to `expenseTotal`.
- Expense create/update/deactivate are blocked outside the operating month date range and blocked for locked months, reusing the same call-ledger guardrails.
- Audit events are `daily_expense.created`, `daily_expense.changed`, and `daily_expense.deactivated`. Snapshots are plain JSON with `expenseDate` as `YYYY-MM-DD`, `amount` as number, and handler as employee ID.
- `getDailyCallLedgerSummary()` calculates reservation, completed, no-show, canceled, payment, therapist commission, earcare pool, discount, expense, net sales, and course summary values from the selected operating month/date.
- `netSales = paymentTotal - expenseTotal`.
- 완료 콜 monetary totals use only rows where `calculationStatus === "calculated"`. Non-completed rows, missing policy/rate rows, and invalid completed D rows with `second_therapist_required` are excluded from amount and course-code summaries.
- Course summaries group by stable `Course.code` A-E and report completed count, discount count, and therapist assignment count.

## Rules

- Only `방문완료` calls count toward sales, commissions, earcare pool, and recognized calls.
- Story 2.5 daily summary uses `방문완료` and `VISIT_COMPLETE` for completed counts, and only `calculated` completed rows for payment and course-code summary totals.
- Any discount type currently means a fixed 100,000 discount.
- D course requires a second therapist in the ERP even though Excel does not enforce it.
- D course requirement is enforced from `CoursePolicy.requiresSecondTherapist`, not from mutable display text.
- Commission values should be derived from effective therapist course rates.
- Daily expenses reduce net sales only; they do not alter call payment, commission, discount, or earcare pool calculations.
- Status changes should be recorded.
- Story 2.1 stores room/course/employee references as stable IDs and code selections as stable code values, never mutable display labels.
- `ServiceCallAssignment.assignmentRole` is limited to `THERAPIST_1`, `THERAPIST_2`, and `EARCARE`.
- Writes use a transaction so a call row and assignment rows are not partially saved.

## Handoffs

- `rooms` reads active reservation and room usage states.
- `settlements` reads completed calls and assignment commission amounts.
- `dashboard` reads completed, reserved, no-show, canceled, payment, and course counts.
- `audit` records sensitive changes.
