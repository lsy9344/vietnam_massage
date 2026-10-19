# Settlements Module

Owns daily settlement calculations and payout confirmation events.

## Includes

- therapist shifts
- therapist daily settlements
- operations-team attendance
- operations-team daily incentive
- operations-team monthly incentive preview
- weekly planned-working-day schedule (F04)

## Schedule Service

`schedule-service.ts` owns the per-employee-per-date planned-working-day calendar (ticket 27), independent of any operating month.

- A cell is `PlannedWorkingDay(employeeId, workDate)` with `planStatus` of `"근무 예정"` or `"휴무"`. No row means `"미입력"`; a missing record is never treated as a day off.
- `listPlannedWorkingDaysForWeek({ date })` snaps any given date to the Monday-starting week that contains it (date math only; no operating month lookup or clamping) and returns the three employee groups' active employees, each with all 7 days.
- `listPlannedWorkingDayStatusesForDate({ employeeIds, date })` is the per-employee-per-date lookup ticket 28 (day-off impact) and ticket 29 (planned working day on availability) reuse; it fills in `"미입력"` for any requested employee with no row.
- `setPlannedWorkingDay()` writes one cell (or deletes it when set back to `"미입력"`) and records a `planned_working_day.created` / `.changed` / `.cleared` audit event (employee, date, previous value, new value, actor) — but only when the status actually changes; a no-op write is not audited.
- Never touches `TherapistAttendance`, full-attendance recognition, payout, or `ServiceCall` rows. Does not block call/reservation writes.
- Edits require `payout:write` (administrator, settlement manager); enforced in the `/settlements/schedule` server action, not in this service.
- Copying last week's values into unset cells and surfacing calls assigned to an employee being marked off are ticket 28's additions on top of this service.
- 1018 Ticket 06 (spec D28): a `"근무 예정"` cell may carry `plannedStartTime` (HH:MM, optional; empty means the whole day). Other statuses store none, so changing a cell to `"휴무"` clears it. Changing only the time is audited like a status change, and the audit snapshot carries `plannedStartTime` only when there is one. Last week's copy copies the time with the status. Availability reads it (calls module, 1018 Ticket 06).

## Therapist Daily Settlement Service

`listTherapistDailySettlements()` owns the read-only daily settlement aggregation for massage therapists.

- Uses completed service-call calculation output from `calls`; UI components must not recalculate commissions.
- Groups by stable `Employee.id`, not display name.
- Counts both `THERAPIST_1` and `THERAPIST_2` as separate assignment evidence.
- A same employee assigned to both therapist roles in one call is counted as two 담당 건.
- `zero_policy` means an explicit 0 VND therapist course rate exists.
- `missing_policy` means the applicable course policy or therapist rate is missing; the assignment remains visible as a 0 VND evidence row with warning context.
- `second_therapist_required` invalid completed D-course rows are excluded from therapist payout totals.

## Therapist Attendance Service

`listTherapistAttendanceForDate()`, `upsertTherapistAttendance()`, `deactivateTherapistAttendance()`, and `listTherapistFullAttendanceRecognitions()` own daily massage-therapist check-in/check-out input and full-attendance recognition (Story 4.1).

- Persists `TherapistAttendance` by `operatingMonthId + attendanceDate + Employee.id`; display names and Excel row numbers are never stored as downstream keys.
- The active 대상 source is `Employee.employeeGroup === "THERAPIST"` ordered by `sortOrder`, then `staffCode`, then `Employee.id`. The list returns exactly the active therapists, with incomplete DTOs for days that have no row yet.
- Time-of-day is stored as `checkInMinute`/`checkOutMinute` (minute-of-day `0`–`1439`). The UI renders `HH:mm`, but the minute integers are the source of truth so overnight math is deterministic.
- Overnight checkout: when `checkOutMinute < checkInMinute`, `standbyMinutes = (checkOutMinute + 1440) - checkInMinute`, so standby is never negative. Equal minutes mean `0`.
- Full-attendance recognition is `standbyMinutes >= 600` (10 hours). `standbyMinutes` and `isFullAttendanceRecognized` are computed and stored at write time so the monthly closing reuses the same source instead of re-deriving it. A check-in-only row (nullable `checkOutMinute`/`standbyMinutes`) is stored without a judgment and is re-evaluated when the checkout is saved.
- `HH:mm` and date input are validated with Zod `safeParse()` and mapped to safe Korean field messages; invalid or missing input blocks the write.
- `upsertTherapistAttendance()` / `deactivateTherapistAttendance()` block `마감확정` and `잠금` operating months plus out-of-range dates before any write, then re-check the operating-month lock inside the transaction to avoid races.
- Attendance writes and audit logs are one transaction. Audit actions are `therapist_attendance.created`, `therapist_attendance.changed`, and `therapist_attendance.deactivated` with plain JSON snapshots, `payoutImpact: true`, and `reason: "payout_affecting"`.
- `listTherapistFullAttendanceRecognitions({ operatingMonthId, startDate, endDate })` returns `{ sourceStatus: "available", sourceDayCount, rows: [{ employeeId, fullAttendanceDays }] }` from active attendance rows only. `sourceDayCount` is the distinct `attendanceDate` count of active source rows in range.
- The monthly closing preview (`monthly-closing-preview-service.ts`) wires this function as its default `listTherapistFullAttendanceRecognitions` dependency, replacing the `missing_story_4_1_source` fallback. Story 5.2 owns the 만근수당 threshold/amount constants (20일 이상 2,000,000 VND); Story 4.1 only provides the recognition-day source.

## Ops Attendance Service

`listOpsAttendanceForDate()` and `upsertOpsAttendance()` own daily operations-team attendance input for daily incentive calculation.

- Persists `OpsAttendance` by `operatingMonthId + attendanceDate + Employee.id`; display names, positions, and Excel row references are never stored as downstream keys.
- Uses active `CodeItem` rows where `codeType === "ATTENDANCE_STATUS"` for status options and stores only the stable `statusCode`.
- The active operations-team 대상 source is `Employee.employeeGroup === "OPERATIONS"` ordered by `sortOrder`, then `staffCode`.
- `NORMAL` or a status code whose display name is `정상` is payout eligible; non-normal codes expose `exclusionReason`.
- `upsertOpsAttendance()` blocks `마감확정` and `잠금` operating months plus out-of-range dates before any write, then rechecks the operating month inside the transaction.
- Attendance writes and audit logs are one transaction. Audit actions are `ops_attendance.created` and `ops_attendance.changed` with plain JSON snapshots, `payoutImpact: true`, and `reason: "payout_affecting"`.

## Ops Daily Incentive Service

`listOpsDailyIncentives()` owns the read-only daily incentive calculation for operations-team staff.

- Uses `listOpsAttendanceForDate()` as the payout 대상 source; the daily incentive service does not recalculate employee identity, status labels, or payout eligibility.

## Ops Monthly Incentive Page

- For `마감확정` or `잠금` months, `/settlements/operations/monthly` shows the closing domain `getMonthlyClosingSnapshot()` value as `확정 스냅샷` before the current recalculation preview.
- The monthly incentive preview remains useful for drift inspection, but it is labeled `현재 기준 미리보기` and is not the historical payout source.
- Uses `listCompletedServiceCallCalculationsForDate()` as the 일 총콜 source and counts only `calculationStatus === "calculated"` completed calls.
- Warning counts expose excluded service-call rows: `notCompleted`, `coursePolicyMissing`, `therapistRateMissing`, and `secondTherapistRequired`.
- Uses active `OpsDailyIncentiveRule` rows effective for `OperatingMonth.monthKey`; the highest satisfied `thresholdCallCount` wins.
- Seed 기준 thresholds are 30/40/50 calls for 50,000/100,000/200,000 VND personal incentive amounts.
- If no effective rule exists, `ruleStatus = "missing_policy"` and a Korean warning is returned. The service does not silently assume a 0 VND policy.
- If rules exist but 일 총콜 is below the minimum threshold, `ruleStatus = "below_threshold"` and every row returns `payoutAmount = 0`.
- Locked operating months remain readable; only Story 4.5 attendance mutation is disabled.
- The service creates no payout persistence, no payout edit action, no audit event, no monthly preview, and no monthly close snapshot.

## Ops Monthly Incentive Preview Service

`listOpsMonthlyIncentivePreview()` owns the read-only operations-team monthly incentive preview.

- Uses `listCompletedServiceCallCalculationsForOperatingMonth()` as the monthly total-call source and counts only calculated completed calls.
- Excluded call rows are surfaced as warning counts: `notCompleted`, `coursePolicyMissing`, `therapistRateMissing`, and `secondTherapistRequired`.
- Uses active `OpsMonthlyIncentiveRule` rows with effective-month filtering: `effectiveFromMonth <= OperatingMonth.monthKey` and `effectiveToMonth` null or greater than/equal to the month key.
- The highest satisfied `thresholdCallCount` wins. Seed 기준 thresholds are 1000/1100/1200/1300/1400/1500 calls.
- The service applies the policy row's 30/35/35 team split values (`leadShare`, `counterTeamShare`, `waiterTeamShare`) instead of hard-coding UI calculations.
- Team shares are converted to integer VND with `Math.floor`; any policy-share remainder is tracked as `undistributedAmount`.
- Counter-team and waiter-team member payouts use deterministic remainder allocation in `sortOrder`, `staffCode`, then `Employee.id` order.
- Employee rows use stable `Employee.id`; display names, position text, staffCode, and Excel references are display/context only.
- `missing_policy` is returned when no effective monthly policy exists; the service does not silently assume a 0 VND policy.
- `below_threshold` is returned when a policy exists but the monthly total is under the minimum threshold.
- 작성중/검토중 months are draft current previews. 마감확정/잠금 months remain readable but are labeled current preview so they are not confused with closing snapshot values.
- The service is read-only: no persistence, no write action, no audit log, no operating-month status mutation, and no closing snapshot creation or recalculation.

## Upstream

- `calls` for completed service calls and assignments
- `masters` for rates, staff, and incentive policies

## Downstream

- `closing` for monthly payout calculation
- `dashboard` for settlement summaries

## Does Not Own

- service-call input
- monthly close confirmation
- audit persistence

## Payout Confirmation and Monthly Statements (tickets 30–32)

- `payout-confirmation-service.ts` owns confirm/reconfirm/release events for Therapist daily, operations daily and operations monthly units (ADR 0004). Calculators pass current amounts; `attachPayoutConfirmationsToRows()` adds the event-derived state consistently. Existing confirmed units remain visible at 0 when calculations or active staff rows disappear, so reconfirmation and closing checks still see differences.
- `monthly-statement-service.ts` lives in `../closing/`: it composes settlement calculations with immutable closing snapshots, downstream of settlements. Draft/review months default to current unconfirmed calculations, including reopened months; explicit earlier versions remain selectable. Confirmed/locked months require a snapshot. Historical versions never acquire newly calculated evidence.
- The read-only planned-work lookup and status vocabulary live in `../masters/planned-working-day-query.ts`. Schedule mutations stay here and ask calls for day-off impact. This prevents availability lookup from importing the schedule mutation service.
