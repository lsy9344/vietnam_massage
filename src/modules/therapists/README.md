# Therapists Module

Owns Therapist-side self-service (today's calls, clock-in, attendance, payout, requests, notices) and the
admin-side Therapist work (approvals inbox, notices, overview, internal memo). Screens and server actions are
thin adapters; this module assembles calculations by calling existing services (attendance, schedule, daily
settlement, payout confirmation, monthly closing preview, monthly statement, calls). It does not introduce new
payout math (spec M1).

## Includes (ticket 01 so far)

- `therapist-access-service.ts`: `requireTherapistAccess()`, the single gate (spec M17) every Therapist screen
  and server action calls. It checks the session account is active, its role is `therapist`, and the linked
  employee is `employeeGroup === "THERAPIST"` and not `employmentStatus === "퇴사"`. On success it returns
  `{ accountId, employeeId }`; Therapist-side functions take that `employeeId` as input and never read it from
  a request body (spec M3).
- `therapist-profile-service.ts`: `getTherapistProfile(employeeId)`, the narrow read behind the "나" (me) menu's
  name/staff code/phone. Selects only those three columns — contact-adjacent fields that must not leak (other
  employees' info, 비고, etc.) are never in this query's `select` (spec M6).

Later tickets add the self-service interface (오늘 보기, 출근 코드로 찍기, 근태 달력, 수당, 신청) and the
admin-side interface (승인함, 공지, 현황, 내부 메모) here (spec M4–M5, M9–M10, M23–M24).

## Upstream

`masters` (employee, account), and later tickets' calls/settlements/closing services for the data this module
assembles.

## Downstream

The Therapist route group `src/app/therapist/*` and its server actions, and the admin screens tickets 10–12 add
under `(erp)`.

## Does Not Own

- Payout, attendance, schedule, or closing calculation rules — it reads them from their owning modules.
- The account issuance/reset/suspend screen (ticket 02 extends `linkUserAccountToEmployee`,
  `deactivateUserAccount`, `resetUserAccountLock` in `masters/account-service.ts`, not this module).
