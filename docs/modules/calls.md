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

Story 2.1 displays payment amount, therapist commissions, earcare pool amount, and recognized call credit as read-only placeholders. The actual calculation contract belongs to Story 2.3.

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
