# Audit Module

## Source Documents

- `client_erp_specification.md` sections 3.1, 9.2
- `sheet_erp_design.md` sections 9.2, 11

## Responsibility

The audit module owns immutable change history for sensitive ERP operations.

## Core Entities

- `AuditLog`
- `AuditTarget`
- `AuditActor`

## Required Events

- service-call status changes
- payment and discount changes
- therapist or earcare assignment changes
- shift time changes
- rate and incentive policy changes
- employee changes
- monthly close confirmation
- monthly close cancelation or reopen

## Rules

- Audit records should capture actor, action, target type, target ID, before state, after state, and timestamp.
- Audit history should not be deleted during normal operations.
- Audit should observe domain actions, not become the owner of domain rules.

## Handoffs

- Consumes events from `masters`, `calls`, `settlements`, and `closing`.
- Provides traceability for administrators and close-review workflows.

