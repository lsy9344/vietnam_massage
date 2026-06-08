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
- row autosave uses the `idle`, `saving`, `saved`, and `error` state model and displays Korean row states: `저장중`, `저장됨`, and `저장 보류`.
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

## Includes

- service calls
- therapist and earcare assignments
- status history
- daily expenses
- completed-call payment and commission derivation
- D-course second-therapist validation

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
- monthly-close snapshot persistence for derived amount columns
