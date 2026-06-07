# Closing Module

## Source Documents

- `client_erp_specification.md` sections 6.8, 8.5
- `sheet_erp_design.md` sections 7.8, 8.4, 10.5
- Excel sheet: `월마감`

## Responsibility

The closing module owns monthly close workflow and payout snapshots:

- monthly calculation preview
- therapist total calls and settlement sums
- full-attendance bonus
- monthly ranking bonus
- operations-team incentive summary
- earcare payout summary
- close confirmation
- close lock and reopen policy

## Core Entities

- `MonthlyClosing`
- `MonthlyPayout`
- `MonthlyCloseSnapshot`
- `MonthlyCloseEvent`

## Rules

- Full-attendance bonus is paid when full-attendance days are 20 or more.
- Ranking bonus applies only to therapists with 40 or more monthly calls.
- Ranking bonuses are 5,000,000 for first, 3,000,000 for second, and 1,000,000 for third.
- Final therapist payout is monthly settlement plus attendance bonus plus ranking bonus.
- Confirmed closes must preserve payout snapshots.
- Locked months should block normal mutations to source records that affect payout.

## Handoffs

- Reads settlement results from `settlements`.
- Reads sales, expense, and call totals from `calls`.
- Emits summary data to `dashboard`.
- Emits audit events through `audit`.

