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
| Migration verification | `src/modules/migration` | Story 7.1 source of truth for original sheet-to-ERP feature mapping and 100% preservation checks |
| Audit | `src/modules/audit` | Change history for sensitive operational actions |
| Shared | `src/shared` | Cross-module constants, types, and utilities |

## Boundary Rule

Business calculations should live in the domain module that owns the rule. Screens should call those modules instead of reimplementing formulas from the Excel sheets.

## Migration Verification

Story 7.1 adds a source of truth mapping for the original workbook coverage. The contract is that all 12개 source sheets, including 숨김 `목록`, must map to at least one ERP screen, setting, calculation engine, or verification item. The mapping must preserve 기능 보존율 100%.

The verification reference is `docs/modules/migration-verification.md`, and the executable data lives in `src/modules/migration/sheet-feature-mapping.ts`. Excel 셀 좌표 and ranges are evidence only; implementation and downstream joins must keep stable ID references such as `Room.id`, `Employee.id`, `Course.id`, `CodeItem.id`, and `TimeSlot.value`.
