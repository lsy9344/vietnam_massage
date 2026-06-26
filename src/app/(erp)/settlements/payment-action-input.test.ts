import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTherapistDailySettlementPaymentIsPaid } from "@/app/(erp)/settlements/payment-action-input";

describe("parseTherapistDailySettlementPaymentIsPaid", () => {
  it("hidden field의 true/false 문자열만 지급완료 상태로 허용한다", () => {
    assert.equal(parseTherapistDailySettlementPaymentIsPaid("true"), true);
    assert.equal(parseTherapistDailySettlementPaymentIsPaid("false"), false);
  });

  it("누락되거나 조작된 지급완료 상태값은 false로 조용히 바꾸지 않는다", () => {
    assert.throws(() => parseTherapistDailySettlementPaymentIsPaid(""), /지급완료 상태값이 올바르지 않습니다/);
    assert.throws(() => parseTherapistDailySettlementPaymentIsPaid("yes"), /지급완료 상태값이 올바르지 않습니다/);
  });
});
