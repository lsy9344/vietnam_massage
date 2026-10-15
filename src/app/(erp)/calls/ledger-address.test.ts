import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CALL_PARAM,
  ledgerCallAnchorId,
  ledgerCallHref,
  ledgerHref,
  ledgerTabParams,
  parseLedgerTab
} from "@/app/(erp)/calls/ledger-address";

const october14 = { operatingMonthId: "m-2026-10", serviceDate: "2026-10-14" };

describe("call ledger address", () => {
  it("reads the cashbook tab from the address and treats anything else as the ledger tab", () => {
    assert.equal(parseLedgerTab("cashbook"), "cashbook");
    assert.equal(parseLedgerTab("ledger"), "ledger");
    assert.equal(parseLedgerTab(undefined), "ledger");
    assert.equal(parseLedgerTab(["cashbook"]), "ledger");
    assert.equal(parseLedgerTab("CASHBOOK"), "ledger");
  });

  it("keeps the ledger tab address bare and adds tab=cashbook for the cashbook tab", () => {
    assert.deepEqual(ledgerTabParams("ledger"), {});
    assert.deepEqual(ledgerTabParams("cashbook"), { tab: "cashbook" });
  });

  it("shares the operating month and date between the two tabs", () => {
    assert.equal(ledgerHref(october14, "ledger"), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14");
    assert.equal(ledgerHref(october14, "cashbook"), "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14&tab=cashbook");
  });

  it("keeps the opened call in the address so the same address opens the detail panel", () => {
    assert.equal(CALL_PARAM, "call");
    assert.equal(
      ledgerCallHref({ operatingMonthId: "m-2026-10", serviceDate: "2026-10-14", serviceCallId: "c9" }),
      "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14&call=c9"
    );
  });

  it("links to one call on the ledger tab of its own date", () => {
    assert.equal(ledgerCallAnchorId("call-9"), "call-call-9");
    assert.equal(
      ledgerCallHref({ operatingMonthId: "m-2026-09", serviceDate: "2026-09-30", serviceCallId: "c1" }),
      "/calls?operatingMonthId=m-2026-09&serviceDate=2026-09-30&call=c1"
    );
  });
});
