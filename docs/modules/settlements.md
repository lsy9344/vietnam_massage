# Settlements Module

## Source Documents

- `client_erp_specification.md` sections 6.5, 6.6, 6.7, 8.2, 8.3, 8.4
- `sheet_erp_design.md` sections 7.5, 7.6, 7.7, 10.3, 10.4
- Excel sheets: `운영팀근무인센`, `귀케어일정산`, `마사지사일정산`

## Responsibility

The settlements module owns daily settlement calculations before monthly closing:

- therapist shifts and daily payouts
- therapist course call counts
- full-attendance recognition
- earcare attendance and B-course pool distribution
- operations-team attendance and incentives

## Core Entities

- `TherapistShift`
- `TherapistDailySettlement`
- `EarcareAttendance`
- `EarcareDailySettlement`
- `OpsAttendance`
- `OpsDailyIncentive`
- `OpsMonthlyIncentivePreview`

## Rules

- Therapist calls count if the therapist appears as therapist 1 or therapist 2 on a completed call.
- Therapist daily payout is the sum of assigned completed-call commissions.
- Standby time crosses midnight if clock-out is earlier than clock-in.
- Full attendance is recognized at 8 or more standby hours.
- Earcare pool is distributed only to normal-status earcare staff.
- If normal earcare staff count is zero, payout must be zero until the business policy is confirmed.
- Operations-team daily incentive is paid only to normal-status staff.

## Handoffs

- Reads completed calls from `calls`.
- Reads rates and attendance codes from `masters`.
- Feeds `closing` with daily settlement results.
- Feeds `dashboard` with daily settlement summaries.

