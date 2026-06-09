# Source Modules

This folder contains the ERP domain modules used by the Next.js App Router application. Each module README defines the boundary, source-of-truth services, and handoffs expected by the route adapters and domain components.

## Module Flow

```text
masters -> calls -> rooms
                 -> settlements -> closing
                 -> dashboard
audit observes important changes across the flow
```

## Modules

- `masters`: configuration and master data
- `calls`: reservation and service-call ledger
- `rooms`: room status and display state
- `settlements`: daily settlement calculations
- `closing`: monthly closing and payout snapshots
- `dashboard`: read-only KPI summaries
- `audit`: immutable change history

Use `src/shared` only for cross-module primitives that do not belong to one domain.
