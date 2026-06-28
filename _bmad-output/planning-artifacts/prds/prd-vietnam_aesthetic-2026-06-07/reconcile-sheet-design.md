# Input Reconciliation — Sheet ERP Design

Source: `sheet_erp_design.md`
Target: `prd.md`

## Verdict

The PRD follows the design document's domain split: masters, calls, rooms, settlements, closing, dashboard, audit. It also preserves the major calculation rules and explicitly avoids implementing Excel row ranges as business rules.

## Gaps Found

- **Daily side summary is the main precision gap.** The design document gives detailed U:V and W:X summary functions. PRD coverage is present but not yet precise enough for "function preservation 100%".
- **Aesthetic direction is product-specific and should be documented.** The user requested a dashboard the owner will immediately like. The PRD should encode this as UX guidance without becoming a design spec.
- **No critical calculation gaps found.** Time slots, fixed discount, D-course therapist2 requirement, earcare zero-normal-staff payout, room display names, attendance bonus, ranking bonus, and monthly close snapshot are all captured.

## Recommended Fix

Patch daily summary wording and add a short "화면과 시각화 방향" section.
