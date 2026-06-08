# Audit Module

Owns immutable change history for payout-affecting and operational-state changes.

## Service Contract

- `recordAuditEvent(input, options?)`
  - Persists one append-only audit event.
  - Requires `actorId`, dot-notation `action`, `targetType`, `targetId`.
  - Accepts structured JSON `beforeValue`, `afterValue`, and optional `reason`.
  - Rejects non-JSON snapshots such as `NaN`, functions, class instances, and `Date` objects before writing.
  - Accepts an optional `prismaClient` so future domain services can call it inside a Prisma transaction.
- `listAuditLogs(query)`
  - Returns administrator review DTOs, not raw Prisma records.
  - Supports `targetType`, `from`, `to`, and bounded `limit` filtering.

## Action Naming

Actions must use dot notation:

- `service_call.status_changed`
- `monthly_close.confirmed`
- `employee.rate_policy_changed`

The action describes history only. The owning domain still performs validation, calculation, and source record mutation.

## Upstream

- `masters`
- `calls`
- `settlements`
- `closing`

Each upstream module supplies its own before/after snapshots after domain validation.

## Downstream

- administrator review at `/audit`
- close review
- traceability reports

## Does Not Own

- business decisions
- payout calculation
- source record mutation
- audit log update/delete paths
