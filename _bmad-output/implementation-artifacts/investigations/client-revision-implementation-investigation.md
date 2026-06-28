# Investigation: client revision implementation status

## Hand-off Brief

1. **What happened.** Confirmed: the recent client revision request document is `docs/plans/2026-06-15-client-revision-work-order.md`, sourced from `C:\Users\KimYS\Desktop\수정요청사항.txt`.
2. **Where the case stands.** Confirmed: `REQ-001` through `REQ-014` are reflected in current code and targeted tests; the client-facing policy decisions still open are `돈통 잔액` and the display wording for `예약건수`.
3. **What's needed next.** Ask the client whether to show `돈통 잔액` as a separate KPI and whether `예약건수` should be renamed to reduce misunderstanding.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-06-26 |
| Status | Concluded |
| System | Windows, project `vietnam_aesthetic` |
| Evidence sources | Request docs, follow-up docs, source code, unit/static/E2E test runs |

## Problem Statement

User asked to find the document containing recent client modification requests and review how much of it is reflected in the project.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `docs/plans/2026-06-15-client-revision-work-order.md` | Available | Baseline request document. Lines 1, 4, and 6 identify title, original source, and purpose. |
| `docs/goal/done_2026-06-20-client-revision-implementation-audit.md` | Available | First audit. Initially marked only `REQ-010` partial. |
| `docs/goal/done_2026-06-20-client-revision-followup-work-order.md` | Available | Follow-up work order for partial items and test gaps. |
| `docs/goal/done_2026-06-20-client-revision-verification-work-order.md` | Available | Re-verification work order. Claims `REQ-001` to `REQ-014` are implemented. |
| `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md` | Available | Final review. Claims all 14 requests are reflected in feature code. |
| Source code and tests | Available | Directly inspected via `rg`; selected unit/static/E2E tests were executed. |

## Confirmed Findings

### Finding 1: Baseline Request Document

**Evidence:** `docs/plans/2026-06-15-client-revision-work-order.md:1`, `docs/plans/2026-06-15-client-revision-work-order.md:4`, `docs/plans/2026-06-15-client-revision-work-order.md:6`

**Detail:** The baseline document is `docs/plans/2026-06-15-client-revision-work-order.md`. It says the original source is `C:\Users\KimYS\Desktop\수정요청사항.txt` and its purpose is to convert client requests into work-ready requirements and acceptance criteria.

### Finding 2: Request Scope

**Evidence:** `docs/plans/2026-06-15-client-revision-work-order.md:10`, `docs/plans/2026-06-15-client-revision-work-order.md:454`, `docs/plans/2026-06-15-client-revision-work-order.md:483`

**Detail:** The document contains 14 requirements, `REQ-001` through `REQ-014`, and maps the client's 10 summary items to those requirements.

### Finding 3: Latest Document Claim

**Evidence:** `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md:10`, `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md:14`, `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md:45`, `docs/goal/done_2026-06-20-client-revision-final-review-work-order.md:58`

**Detail:** The latest final review says the feature code reflects all 14 client revision requests. It lists `REQ-001` through `REQ-014` as reflected.

### Finding 4: Current Code Evidence Supports The Latest Claim

**Evidence:** 
- `src/components/domain/page-header.tsx:25`, `src/app/globals.css:102`
- `src/modules/masters/room-schema.ts:3`
- `src/modules/rooms/room-status-service.ts:6`, `src/modules/rooms/room-status-service.ts:191`
- `src/app/(erp)/calls/editable-call-grid.tsx:59`, `src/app/(erp)/calls/editable-call-grid.tsx:764`
- `src/modules/calls/service-call-service.ts:382`, `src/modules/calls/service-call-service.ts:619`, `src/modules/calls/service-call-service.ts:1427`, `src/modules/calls/service-call-service.ts:1450`
- `src/app/(erp)/settlements/page.tsx:304`, `src/app/(erp)/settlements/page.tsx:315`
- `src/modules/dashboard/dashboard-query-service.ts:423`, `src/modules/dashboard/dashboard-query-service.ts:754`, `src/modules/dashboard/dashboard-query-service.ts:997`
- `src/modules/closing/monthly-closing-preview-service.ts:729`, `src/modules/closing/monthly-closing-preview-service.ts:731`

**Detail:** Direct code inspection found implementation evidence for page title styling, top-down room ordering, ending-soon status, settlement column hiding, discount strike-through display, unassigned reservations, prepaid revenue, payment method totals, reservation count semantics, settlement paid status/history UI, and daily/monthly net profit cost split.

### Finding 5: Verification Was Run In This Review

**Evidence:** local command output from 2026-06-26

**Detail:** `npm run lint` passed all story validators. `npm run test:unit -- --test-name-pattern "REQ|client revision|종료임박|payment method|reservation|paid|dailyCostTotal|monthlyCostTotal|netProfit"` passed 247 tests. `npm run test:e2e -- tests/e2e/client-revision-verification.spec.ts --project=chromium-desktop` passed 3 tests.

## Requirement Status Summary

| Requirement | Status | Evidence |
| --- | --- | --- |
| REQ-001 title visibility | Reflected | `PageHeader`, `page-header-band`, visual guard test |
| REQ-002 room floor/top-down order | Reflected | `defaultRooms` sort order starts `401`, `402`, then lower floors |
| REQ-003 ending-soon status | Reflected | 10-minute threshold and unit tests |
| REQ-004 hide settlement data in call ledger | Reflected | `showSettlementColumns` filtering and E2E coverage |
| REQ-005 discount payment display | Reflected | base price strike-through and actual amount emphasis |
| REQ-006 unassigned reservation | Reflected | nullable room label `미배정` and E2E coverage |
| REQ-007 prepaid revenue | Reflected | `recognizesRevenue()` uses payment method selection and excludes canceled/no-show |
| REQ-008 payment method totals | Reflected, except optional policy item | Cash/card/bank/other totals implemented; `돈통 잔액` remains policy decision |
| REQ-009 reservation count | Reflected, label decision open | `reservationCount = rows.length`; wording still client decision |
| REQ-010 paid settlement status | Reflected | paid state, paid actor, timestamp, and history visible |
| REQ-011 today net profit | Reflected | daily dashboard uses payment minus daily cost |
| REQ-012 payment/net profit emphasis | Reflected | strong/cost dashboard tone tests |
| REQ-013 monthly net profit | Reflected | monthly `netProfit` uses daily and monthly costs |
| REQ-014 daily/monthly cost split | Reflected | `dailyCostTotal` and `monthlyCostTotal` split in services and UI |

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Client decision on `돈통 잔액` | Determines whether another DB/UI/report change is needed | Ask whether to show it separately and confirm formula |
| Client decision on `예약건수` label | Current calculation is correct, but label may be misunderstood | Ask whether to keep or rename label |

## Conclusion

**Confidence:** High

The current project reflects the recent client revision request document at the feature-code level. The reflected rate is **14/14 requirements**, with **2 remaining policy/wording decisions** rather than missing implemented requirements: `돈통 잔액` and the `예약건수` label.

## Recommended Next Steps

### Fix direction

No immediate code fix is required for the 14 confirmed requirements.

### Diagnostic

For deployment confidence, keep running `npm run lint`, targeted unit tests, and `tests/e2e/client-revision-verification.spec.ts` after any related changes.

## Reproduction Plan

1. Run `npm run lint`.
2. Run `npm run test:unit -- --test-name-pattern "REQ|client revision|종료임박|payment method|reservation|paid|dailyCostTotal|monthlyCostTotal|netProfit"`.
3. Run `npm run test:e2e -- tests/e2e/client-revision-verification.spec.ts --project=chromium-desktop`.
