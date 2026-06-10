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
