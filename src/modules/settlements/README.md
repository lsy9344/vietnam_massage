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
