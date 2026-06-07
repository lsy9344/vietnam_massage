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

