# PRD Addendum

This addendum captures implementation constraints and supporting detail that should inform downstream architecture and implementation planning without overloading the PRD body.

## Confirmed Technical Stack

- Server: Next.js + Node.js
- Database: PostgreSQL
- ORM and migrations: Prisma
- Authentication: NextAuth/Auth.js
- UI/UX foundation: Tailwind CSS v4 + shadcn/ui
- Deployment and operations: same deployment approach, environment variable rules, and migration procedure rules as the project standard

## Source Migration Principle

- The ERP must accurately migrate all functional behavior from the existing Excel workbook.
- Excel sheet row and cell coordinates should not become implementation rules; requirements should be expressed as ERP domain behavior, stable identifiers, policies, workflows, and calculations.

## Visualization Requirement

- The ERP must include improved visual presentation for operational understanding.
- Graphs and visualization dashboards are in scope.

## Discovery Research Notes

- Current massage/spa management products commonly include appointment scheduling, staff scheduling, payments/POS, client or visit records, analytics, and reporting dashboards.
- Staff compensation and commission tracking are common operational concerns in salon/spa systems and should be treated as first-class ERP requirements when mapping the Excel settlement rules.
- Room availability, therapist availability, turnover/buffer time, no-show/cancellation handling, and performance reporting are common comparison points, but this PRD should not expand into CRM, marketing automation, memberships, or external accounting unless the Excel source requires it.
