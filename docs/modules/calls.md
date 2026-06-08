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

## Rules

- Only `방문완료` calls count toward sales, commissions, earcare pool, and recognized calls.
- Any discount type currently means a fixed 100,000 discount.
- D course requires a second therapist in the ERP even though Excel does not enforce it.
- Commission values should be derived from effective therapist course rates.
- Status changes should be recorded.
- Story 2.1 stores room/course/employee references as stable IDs and code selections as stable code values, never mutable display labels.
- `ServiceCallAssignment.assignmentRole` is limited to `THERAPIST_1`, `THERAPIST_2`, and `EARCARE`.
- Writes use a transaction so a call row and assignment rows are not partially saved.

## Handoffs

- `rooms` reads active reservation and room usage states.
- `settlements` reads completed calls and assignment commission amounts.
- `dashboard` reads completed, reserved, no-show, canceled, payment, and course counts.
- `audit` records sensitive changes.
