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

## Rules

- Only `방문완료` calls count toward sales, commissions, earcare pool, and recognized calls.
- Any discount type currently means a fixed 100,000 discount.
- D course requires a second therapist in the ERP even though Excel does not enforce it.
- Commission values should be derived from effective therapist course rates.
- Status changes should be recorded.

## Handoffs

- `rooms` reads active reservation and room usage states.
- `settlements` reads completed calls and assignment commission amounts.
- `dashboard` reads completed, reserved, no-show, canceled, payment, and course counts.
- `audit` records sensitive changes.

