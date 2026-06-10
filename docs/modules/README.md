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
| Migration verification | `src/modules/migration` | Story 7.1 source of truth for original sheet-to-ERP feature mapping, Story 7.2 calculation comparison checks, and Story 7.3 report/tracking |
| Audit | `src/modules/audit` | Change history for sensitive operational actions |
| Shared | `src/shared` | Cross-module constants, types, and utilities |

## Boundary Rule

Business calculations should live in the domain module that owns the rule. Screens should call those modules instead of reimplementing formulas from the Excel sheets.

## Migration Verification

Story 7.1 adds a source of truth mapping for the original workbook coverage. The contract is that all 12개 source sheets, including 숨김 `목록`, must map to at least one ERP screen, setting, calculation engine, or verification item. The mapping must preserve 기능 보존율 100%.

The verification reference is `docs/modules/migration-verification.md`, and the executable data lives in `src/modules/migration/sheet-feature-mapping.ts`. Excel 셀 좌표 and ranges are evidence only; implementation and downstream joins must keep stable ID references such as `Room.id`, `Employee.id`, `Course.id`, `CodeItem.id`, and `TimeSlot.value`.

Story 7.2 extends this with 계산 대조 fixture tests. `tests/fixtures/migration-calculation-comparison.ts` keeps expected results for `100000` VND discount, `THERAPIST_1`/`THERAPIST_2` assignment roles, D코스 2인 검증, `RoomStatusDto`, operations 30/40/50 and 1000/1100/1200/1300/1400/1500 thresholds, 귀케어 0명, 8시간, 20일, and 40콜 rules. Tests must reuse domain service boundaries instead of copying formulas into migration code, and 셀 좌표 remain source evidence only.

Story 7.3 adds the migration verification report DTO in `src/modules/migration/migration-verification-report.ts`. The DTO exposes `summary`, `sheetRows`, `calculationRows`, `openIssueRows`, `filters`, and `generatedAt`, and it consumes Story 7.1 mapping plus Story 7.2 `MigrationMismatchReport` evidence without runtime Excel parsing.

Story 7.3 persisted QA tracking uses `MigrationVerificationIssue` and `MigrationVerificationIssueHistory` with deterministic keys like `sheet:목록` and `calculation:calls.payment:call-complete-a-discount`. Status values are exactly `미확인`, `수정중`, `재검증 필요`, and `통과`; hidden `목록` remains a 100% gate; `read_only_viewer` keeps read-only viewer exact access to `/masters/sheet-mapping` only.
