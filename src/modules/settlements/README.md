# Settlements Module

Owns daily settlement calculations.

## Includes

- therapist shifts
- therapist daily settlements
- earcare attendance
- earcare daily settlements
- operations-team attendance
- operations-team daily incentive
- operations-team monthly incentive preview

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
- Full-attendance recognition is `standbyMinutes >= 480` (8 hours). `standbyMinutes` and `isFullAttendanceRecognized` are computed and stored at write time so the monthly closing reuses the same source instead of re-deriving it.
- `HH:mm` and date input are validated with Zod `safeParse()` and mapped to safe Korean field messages; invalid or missing input blocks the write.
- `upsertTherapistAttendance()` / `deactivateTherapistAttendance()` block `마감확정` and `잠금` operating months plus out-of-range dates before any write, then re-check the operating-month lock inside the transaction to avoid races.
- Attendance writes and audit logs are one transaction. Audit actions are `therapist_attendance.created`, `therapist_attendance.changed`, and `therapist_attendance.deactivated` with plain JSON snapshots, `payoutImpact: true`, and `reason: "payout_affecting"`.
- `listTherapistFullAttendanceRecognitions({ operatingMonthId, startDate, endDate })` returns `{ sourceStatus: "available", sourceDayCount, rows: [{ employeeId, fullAttendanceDays }] }` from active attendance rows only. `sourceDayCount` is the distinct `attendanceDate` count of active source rows in range.
- The monthly closing preview (`monthly-closing-preview-service.ts`) wires this function as its default `listTherapistFullAttendanceRecognitions` dependency, replacing the `missing_story_4_1_source` fallback. Story 5.2 owns the 만근수당 threshold/amount constants (20일 이상 2,000,000 VND); Story 4.1 only provides the recognition-day source.

## Earcare Attendance Service

`listEarcareAttendanceForDate()` and `upsertEarcareAttendance()` own daily earcare attendance input for future earcare daily settlement.

- Persists `EarcareAttendance` by `operatingMonthId + attendanceDate + Employee.id`; display names are never stored as downstream keys.
- Uses active `CodeItem` rows where `codeType === "ATTENDANCE_STATUS"` for status options and stores only the stable `statusCode`.
- `NORMAL` or a status code whose display name is `정상` is payout eligible; `DAY_OFF`, `LATE`, `EARLY_LEAVE`, `ABSENT`, and equivalent non-normal codes expose `exclusionReason`.
- The DTO returned by `listEarcareAttendanceForDate()` is reusable by Story 4.4 and includes `employeeId`, `staffCode`, `displayName`, `statusCode`, `statusDisplayName`, `isPayoutEligible`, `exclusionReason`, and `attendanceDate`.
- `upsertEarcareAttendance()` blocks `마감확정` and `잠금` operating months plus out-of-range dates before any write.
- Attendance writes and audit logs are one transaction. Audit actions are `earcare_attendance.created` and `earcare_attendance.changed` with plain JSON snapshots, `payoutImpact: true`, and `reason: "payout_affecting"`.

## Earcare Daily Settlement Service

`listEarcareDailySettlements()` owns the read-only daily payout calculation for earcare staff.

- Uses `listEarcareAttendanceForDate()` as the payout 대상 source; the daily settlement service does not recalculate `isPayoutEligible`, `exclusionReason`, status labels, or stable employee identity.
- Uses `listCompletedServiceCallCalculationsForDate()` as the earcare pool source and includes only `calculationStatus === "calculated"` completed calls in `earcarePoolTotal`.
- Warning counts expose excluded service-call rows: `notCompleted`, `coursePolicyMissing`, `therapistRateMissing`, and `secondTherapistRequired`.
- If one or more earcare workers are `NORMAL` / `정상`, `baseShareAmount = Math.floor(earcarePoolTotal / eligibleCount)`.
- `remainderAmount` is allocated as 1 VND increments to eligible rows in the deterministic attendance order (`sortOrder`, `staffCode`, then `Employee.id` tie-breaker).
- If no earcare worker is payout eligible, every row returns `payoutAmount = 0` and `undistributedAmount = earcarePoolTotal`.
- Locked operating months remain readable; only Story 4.3 attendance mutation is disabled.
- The service creates no payout persistence, no payout edit action, no audit event, and no monthly close snapshot.

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
- Uses `listCompletedServiceCallCalculationsForDate()` as the 일 총콜 source and sums only `opsCallCredit` from `calculationStatus === "calculated"` completed calls.
- Warning counts expose excluded service-call rows: `notCompleted`, `coursePolicyMissing`, `therapistRateMissing`, and `secondTherapistRequired`.
- Uses active `OpsDailyIncentiveRule` rows effective for `OperatingMonth.monthKey`; the highest satisfied `thresholdCallCount` wins.
- Seed 기준 thresholds are 30/40/50 calls for 50,000/100,000/200,000 VND personal incentive amounts.
- If no effective rule exists, `ruleStatus = "missing_policy"` and a Korean warning is returned. The service does not silently assume a 0 VND policy.
- If rules exist but 일 총콜 is below the minimum threshold, `ruleStatus = "below_threshold"` and every row returns `payoutAmount = 0`.
- Locked operating months remain readable; only Story 4.5 attendance mutation is disabled.
- The service creates no payout persistence, no payout edit action, no audit event, no monthly preview, and no monthly close snapshot.

## Ops Monthly Incentive Preview Service

`listOpsMonthlyIncentivePreview()` owns the read-only operations-team monthly incentive preview.

- Uses `listCompletedServiceCallCalculationsForOperatingMonth()` as the monthly total-call source and sums only calculated completed-call `opsCallCredit`.
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
