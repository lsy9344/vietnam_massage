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

## Earcare Attendance Service

`listEarcareAttendanceForDate()` and `upsertEarcareAttendance()` own daily earcare attendance input for future earcare daily settlement.

- Persists `EarcareAttendance` by `operatingMonthId + attendanceDate + Employee.id`; display names are never stored as downstream keys.
- Uses active `CodeItem` rows where `codeType === "ATTENDANCE_STATUS"` for status options and stores only the stable `statusCode`.
- `NORMAL` or a status code whose display name is `정상` is payout eligible; `DAY_OFF`, `LATE`, `EARLY_LEAVE`, `ABSENT`, and equivalent non-normal codes expose `exclusionReason`.
- The DTO returned by `listEarcareAttendanceForDate()` is reusable by Story 4.4 and includes `employeeId`, `staffCode`, `displayName`, `statusCode`, `statusDisplayName`, `isPayoutEligible`, `exclusionReason`, and `attendanceDate`.
- `upsertEarcareAttendance()` blocks `잠금` operating months and out-of-range dates before any write.
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
