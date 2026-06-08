# Calls Module

Owns the reservation and service-call ledger.

## Story 2.1 Scope

- `ServiceCall` stores the date-scoped call row using stable references: `OperatingMonth.id`, `Room.id`, `Course.id`, Story 1.6 time-slot `value`, and code `codeType + code` values.
- `ServiceCallAssignment` stores 담당자 columns as normalized rows with stable roles: `THERAPIST_1`, `THERAPIST_2`, `EARCARE`.
- `listServiceCallsForDate()` returns one selected operating-month/date ledger, ordered by Story 1.6 time-slot sort order and creation order.
- `saveBasicServiceCallRow()` validates active masters, operating-month date range, locked-month blocking, stable code values, and writes the call row plus assignments in one transaction.
- Payment, commission, earcare pool, and call-credit fields stay `null` display placeholders until Story 2.3.

## Story 2.2 Scope

- `ServiceCallStatusHistory` stores call status transitions in `service_call_status_histories`.
- row autosave uses the `idle`, `saving`, `saved`, and `error` state model and displays Korean row states: `저장중`, `저장됨`, and `저장 보류`.
- Status changes record `service_call.status_changed`; sensitive row changes record `service_call.row_changed`.
- Autosave retry must preserve the local draft instead of replacing failed input with the last server value.

## Includes

- service calls
- therapist and earcare assignments
- status history
- daily expenses
- completed-call payment and commission derivation

## Upstream

- `masters` for operating months, rooms, courses, employees, time slots, and code values

## Downstream

- `rooms` for active room status
- `settlements` for completed-call payouts
- `dashboard` for operational KPIs
- `closing` for monthly totals
- `audit` for sensitive changes

## Does Not Own

- room display layout
- attendance input
- monthly close locking
- payment, payout, earcare pool, and recognized-call calculations before Story 2.3
