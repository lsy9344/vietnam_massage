# Calls Module

Owns the reservation and service-call ledger.

## Includes

- service calls
- therapist and earcare assignments
- status history
- daily expenses
- completed-call payment and commission derivation

## Upstream

- `masters` for rooms, courses, staff, rates, and code values

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

