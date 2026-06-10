import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertOperatingMonthPayoutWritable,
  isOperatingMonthPayoutLocked
} from "@/modules/closing/month-lock-guard";

describe("month payout lock guard", () => {
  it("treats 마감확정 and 잠금 as payout-impacting write lock states", () => {
    assert.equal(isOperatingMonthPayoutLocked("작성중"), false);
    assert.equal(isOperatingMonthPayoutLocked("검토중"), false);
    assert.equal(isOperatingMonthPayoutLocked("마감확정"), true);
    assert.equal(isOperatingMonthPayoutLocked("잠금"), true);
  });

  it("throws a domain-mappable error for confirmed or locked operating months", () => {
    assert.doesNotThrow(() => assertOperatingMonthPayoutWritable({ status: "검토중" }));

    assert.throws(
      () => assertOperatingMonthPayoutWritable({ status: "마감확정" }),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "OPERATING_MONTH_LOCKED" &&
        error.message === "마감확정 또는 잠금 운영월의 지급 영향 데이터는 수정할 수 없습니다."
    );

    assert.throws(
      () => assertOperatingMonthPayoutWritable({ status: "잠금" }, "잠긴 운영월입니다. 콜 원장을 수정할 수 없습니다."),
      (error: unknown) =>
        error instanceof Error &&
        "code" in error &&
        error.code === "OPERATING_MONTH_LOCKED" &&
        error.message === "잠긴 운영월입니다. 콜 원장을 수정할 수 없습니다."
    );
  });
});
