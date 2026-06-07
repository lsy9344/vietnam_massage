# ERP Module Structure Design

## Goal

Create a practical development module structure for the Vietnamese aesthetic ERP described by `client_erp_specification.md`, `sheet_erp_design.md`, and `sheet.xlsx`.

## Assumptions

- This directory is a specification workspace, not an initialized application project.
- No backend or frontend framework has been selected yet.
- The module structure should preserve the business boundaries found in the Excel workbook instead of copying Excel sheet names directly.
- Since this directory is not a Git repository, commit and worktree steps are not available.

## Chosen Approach

Use a domain-module structure:

- `masters`: operating months, employees, rooms, courses, codes, and rate policies.
- `calls`: reservation and service-call ledger.
- `rooms`: room status, waiter board, and TV display state.
- `settlements`: therapist, earcare, and operations-team daily calculations.
- `closing`: monthly close, payouts, locks, and snapshots.
- `dashboard`: today and monthly KPI queries.
- `audit`: change history for operationally sensitive actions.
- `shared`: shared constants, types, and utility functions.

## Alternatives Considered

### Screen-first modules

This would mirror Excel sheets such as `today-dashboard`, `call-input`, `waiter-list`, and `monthly-close`. It is easy to understand at first, but settlement rules would be duplicated across screens.

### Technical-layer modules

This would use folders such as `entities`, `services`, `repositories`, and `controllers`. It is familiar, but it is too abstract before the tech stack is selected and hides the ERP business boundaries.

## Data Flow

```text
masters
  -> calls
  -> rooms
  -> settlements
  -> closing
  -> dashboard

audit observes changes across masters, calls, settlements, and closing.
```

## Error Handling Boundaries

- `masters` owns invalid configuration, missing rates, inactive employees, and inconsistent code values.
- `calls` owns invalid service-call input, missing required staff, and non-completed call calculation guards.
- `rooms` owns display-only state fallback, such as empty rooms and expired in-use calls.
- `settlements` owns division-by-zero and missing-attendance handling.
- `closing` owns locked-month mutation protection and payout snapshot consistency.
- `audit` owns immutable history records for sensitive changes.

## Testing Direction

When implementation begins, add tests around calculation rules before UI work:

- completed versus non-completed call settlement
- discount handling
- D course second-therapist validation
- room remaining-time calculation
- earcare zero-normal-staff behavior
- monthly full-attendance and ranking bonuses

