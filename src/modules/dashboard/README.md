# Dashboard Module

Owns read-only KPI summaries.

## Includes

- today dashboard metrics
- monthly dashboard metrics
- course completion counts
- payment and settlement summaries
- monthly close snapshot summaries for closed months

## Upstream

- `calls`
- `settlements`
- `closing`

## Snapshot Rules

- `마감확정` and `잠금` operating months use the latest `MonthlyClosing` snapshot as the historical KPI source.
- Reopened `검토중` months use current recalculation as the editable truth; previous snapshots are historical reference only.
- Dashboard route components should consume a dashboard query DTO instead of parsing `MonthlyClosing.snapshotJson` directly.
- Missing snapshots for closed or locked months must be surfaced as a distinct state, not hidden by current preview fallback.

## Downstream

- dashboard screens and reports

## Does Not Own

- core calculation rules
- mutable operational records
- close confirmation
