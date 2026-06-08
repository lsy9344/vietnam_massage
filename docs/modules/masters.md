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
- `Employee`
- `Course`
- `CourseDisplayName`
- `TherapistCourseRate`
- `OpsIncentiveRule`
- `CodeItem`
- `TimeSlot`

## Rules

- Names are display values, not stable keys.
- Room references use `Room.id`; `displayName` can change and `migrationReferenceName` such as `1번방` is migration/verification context only.
- Room order is owned by `sortOrder`; duplicate order values are blocked before TV or room-status views consume the list.
- Rooms that may be referenced by calls, settlements, or status history become 비활성 instead of being physically removed.
- Rate and policy records need effective month ranges.
- Deleted master values should usually become inactive, not removed.
- Past monthly close results must not change when current master data changes.

## Handoffs

- `calls` reads rooms, courses, employees, status codes, payment codes, discount codes, and rates.
- `rooms` reads room and course display configuration.
- `settlements` reads attendance codes, course rates, and incentive rules.
- `closing` reads frozen snapshots or effective policies.
