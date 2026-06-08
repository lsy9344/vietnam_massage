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
- `Course`
- `CourseDisplayName`
- `TherapistCourseRate`
- `OpsIncentiveRule`

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
- Rate and policy records need effective month ranges.
- Deleted master values should usually become inactive, not removed.
- Past monthly close results must not change when current master data changes.

## Handoffs

- `calls` reads rooms, courses, employees, status codes, payment codes, discount codes, and rates.
- `rooms` reads room and course display configuration.
- `settlements` reads attendance codes, course rates, and incentive rules.
- `closing` reads frozen snapshots or effective policies.
