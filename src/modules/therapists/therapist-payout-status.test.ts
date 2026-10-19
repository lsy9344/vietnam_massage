import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { therapistPayoutStatusOf } from "@/modules/therapists/therapist-payout-status";

function confirmation(status: "unconfirmed" | "confirmed" | "needs_reconfirmation" | "confirmed_amount_unrecorded", requiresReconfirmation: boolean) {
  return { status, requiresReconfirmation };
}

describe("therapistPayoutStatusOf", () => {
  it("미확인은 '아직'이다", () => {
    assert.equal(therapistPayoutStatusOf(confirmation("unconfirmed", false)), "unconfirmed");
  });

  it("확인됨(금액이 그대로)은 '확인됨'이다", () => {
    assert.equal(therapistPayoutStatusOf(confirmation("confirmed", false)), "confirmed");
  });

  it("지급 재확인 필요는 '관리자 확인 중'이다", () => {
    assert.equal(therapistPayoutStatusOf(confirmation("needs_reconfirmation", true)), "needsReview");
  });

  it("확인 금액 미기록이고 운영월이 작성중·검토중이면(재확인 필요로 센다) '관리자 확인 중'이다", () => {
    assert.equal(therapistPayoutStatusOf(confirmation("confirmed_amount_unrecorded", true)), "needsReview");
  });

  it("확인 금액 미기록이지만 운영월이 마감확정·잠금이면(재확인 필요로 세지 않는다) '확인됨'이다", () => {
    assert.equal(therapistPayoutStatusOf(confirmation("confirmed_amount_unrecorded", false)), "confirmed");
  });
});
