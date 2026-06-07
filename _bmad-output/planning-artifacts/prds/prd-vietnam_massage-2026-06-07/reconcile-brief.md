# Input Reconciliation — Product Brief

Source: `_bmad-output/planning-artifacts/briefs/brief-vietnam_massage-2026-06-07/brief.md`
Target: `prd.md`

## Verdict

The PRD captures the brief's main thesis: preserve every Excel function, center the ERP around the service-call ledger, prevent post-close payout drift, and keep CRM/marketing/accounting/mobile out of v1.

## Gaps Found

- **Daily side summary needs stronger wording.** The brief mentions daily expense, net sales, and daily/monthly summaries. The PRD includes these concepts, but `실시간콜입력` U:X side-summary preservation should be explicit in the calls feature.
- **Owner dashboard direction should be easier for UX to source-extract.** The brief and user instruction emphasize a visually impressive owner dashboard. The PRD states this, but a short dedicated visual/IA section would reduce ambiguity for UX.
- **Remaining open items are not PRD blockers.** Package manager/test runner, TV update mechanism, and migration date range are downstream implementation or architecture decisions, not reasons to keep the PRD in draft.

## Recommended Fix

Patch `FR-15` to include daily side summaries and add a concise screen/visual direction section before NFRs.
