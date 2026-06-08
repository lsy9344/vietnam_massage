# Masters Module

## Source Documents

- `client_erp_specification.md` sections 5, 6.9, 6.10, 7
- `sheet_erp_design.md` sections 5, 6, 7.9, 7.10, 7.11, 7.12
- Excel sheets: `직원DB`, `TV설정`, `설정_코스수당`, hidden sheet `목록`

## Responsibility

The masters module owns all configurable data used by operational modules:

- operating month and month status
- rooms and room display names
- employees and employee roles
- courses, prices, durations, TV display names
- therapist course rates
- operations-team daily and monthly incentive rules
- status, payment, discount, confirmation, and attendance codes
- time slots

## Core Entities

- `OperatingMonth`
- `Room` with stable `id`, operational `displayName`, hidden-list `migrationReferenceName`, `sortOrder`, and `isActive`
- `CodeItem` with stable `id`, `codeType`, immutable-style `code`, operational `displayName`, `sortOrder`, `isSystemDefault`, and `isActive`
- `TimeSlot` with stable `id`, canonical `value` in `HH:mm`, `sortOrder`, and `isActive`
- `Employee` with stable `id`, stable `staffCode`, `employeeGroup`, `position`, `shiftType`, integer `baseSalary`, optional `phone`, `birthday`, `hireDate`, `employmentStatus`, `sortOrder`, and `isActive`
- `UserAccount` remains the login identity model and connects to `Employee` through optional unique `employeeId`
- `Course` with stable `id`, stable code `A` through `E`, `isActive`, and audit timestamps
- `CoursePolicy` with `courseId`, display name, minutes, VND base price, operations call credit, earcare pool amount, D-course second-therapist flag, TV display name, effective month range, and `isActive`
- `TherapistCourseRate` with stable `Employee.id`, stable `Course.id`, VND amount, effective month range, and `isActive`
- `OpsDailyIncentiveRule` with daily call threshold, personal VND amount, effective month range, and `isActive`
- `OpsMonthlyIncentiveRule` with monthly call threshold, total VND amount, lead/counter/waiter share ratios, effective month range, and `isActive`

## Rules

- Names are display values, not stable keys.
- Room references use `Room.id`; `displayName` can change and `migrationReferenceName` such as `1번방` is migration/verification context only.
- Room order is owned by `sortOrder`; duplicate order values are blocked before TV or room-status views consume the list.
- Rooms that may be referenced by calls, settlements, or status history become 비활성 instead of being physically removed.
- Code references use stable `CodeItem.id` or `codeType + code`, not mutable Korean `displayName`.
- Time slot ordering is owned by `sortOrder`; the canonical `HH:mm` value does not determine cross-midnight order.
- Story 1.6 default time slots are exactly 29 values from `11:00` through `01:00`; workbook values after `01:00` are not ERP input defaults.
- Code items and time slots that may be referenced by operational rows become 비활성 instead of being physically removed.
- Employee references use stable `Employee.id` 고유 ID; display names, positions, account IDs, and workbook row numbers are not stable keys.
- Story 1.7 default employees are 5 `OPERATIONS`, 4 `EARCARE`, and 50 `THERAPIST` rows keyed by stable `staffCode` values such as `OPS-LEAD-001`, `EAR-001`, and `THR-001`.
- Employee `baseSalary` is stored as a VND whole-number integer. `birthday` and `hireDate` are optional date values and service DTOs expose ISO `YYYY-MM-DD` strings or `null`.
- Employee inactive selection state (`Employee.isActive`) and employment status (`재직`, `퇴사`, `휴직`) are separate from account login state (`UserAccount.isActive`, `lockedUntil`, `failedLoginCount`).
- Employee rows that may be referenced by calls, settlements, audit logs, or monthly-close snapshots become 비활성 instead of being physically removed.
- Course references use stable `Course.id`; code `A` through `E` is a stable migration/reference code, while course name and TV display name are mutable policy values.
- D-course second-therapist validation must use `Course.id` and `CoursePolicy.requiresSecondTherapist`, not Korean course-name string matching.
- Course policies, therapist rates, and operations incentive rules use `YYYY-MM` effective month ranges. Active ranges cannot overlap for the same course, therapist/course, or threshold.
- Therapist course-rate seed is based on stable `Employee.staffCode` values `THR-001` through `THR-050`, then stores `Employee.id`. Display names such as `마사지사1` are not lookup keys.
- Explicit 0 VND therapist rates are preserved as migrated source values, not hidden or treated as missing policy rows.
- Operations daily incentive thresholds are 30/40/50 calls with 50,000/100,000/200,000 VND personal amounts.
- Operations monthly incentive thresholds are 1000 through 1500 calls with total amounts 3,000,000 through 25,000,000 VND and lead/counter/waiter shares 0.30/0.35/0.35.
- Course and policy writes record dot-notation audit events such as `course.policy_changed`, `therapist_course_rate.changed`, `ops_daily_incentive_rule.changed`, and `ops_monthly_incentive_rule.changed` with plain JSON snapshots.
- Rate and policy records need effective month ranges.
- Deleted master values should usually become inactive, not removed.
- Past monthly close results must not change when current master data changes.

## Handoffs

- `calls` reads rooms, courses, employees, status codes, payment codes, discount codes, and rates.
- `rooms` reads room and course display configuration.
- `settlements` reads attendance codes, course rates, and incentive rules.
- `closing` reads frozen snapshots or effective policies.
