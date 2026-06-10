# ERP Module Reference

This module structure is based on:

- `client_erp_specification.md`
- `sheet_erp_design.md`
- `sheet.xlsx`
- `client_erp_specification.pdf`

The Excel workbook has 12 sheets. The ERP should not copy that sheet layout directly. The core workflow is:

```text
master data -> service calls -> room status -> daily settlements -> monthly closing -> dashboard
```

## Modules

| Module | Source path | Main responsibility |
| --- | --- | --- |
| Masters | `src/modules/masters` | Operating month, employees, rooms, courses, codes, rates, and incentive policies |
| Calls | `src/modules/calls` | Reservation and real-time service-call ledger |
| Rooms | `src/modules/rooms` | Waiter room board and TV display state |
| Settlements | `src/modules/settlements` | Therapist, earcare, and operations-team daily settlement rules |
| Closing | `src/modules/closing` | Monthly close preview, confirmation, payout snapshots, and locks |
| Dashboard | `src/modules/dashboard` | Today/monthly KPI summaries, graph report datasets, and dashboard state/color guardrails |
| Audit | `src/modules/audit` | Change history for sensitive operational actions |
| Shared | `src/shared` | Cross-module constants, types, and utilities |

## Boundary Rule

Business calculations should live in the domain module that owns the rule. Screens should call those modules instead of reimplementing formulas from the Excel sheets.
