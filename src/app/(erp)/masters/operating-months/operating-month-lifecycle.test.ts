import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lifecycleSteps, operatingMonthTone } from "@/app/(erp)/masters/operating-months/operating-month-lifecycle";

describe("운영월 단계", () => {
  it("작성중부터 잠금까지 순서대로 지난 단계, 지금 단계, 남은 단계를 나눈다", () => {
    assert.deepEqual(lifecycleSteps("검토중"), [
      { status: "작성중", state: "done" },
      { status: "검토중", state: "current" },
      { status: "마감확정", state: "upcoming" },
      { status: "잠금", state: "upcoming" }
    ]);
    assert.deepEqual(
      lifecycleSteps("잠금").map((step) => step.state),
      ["done", "done", "done", "current"]
    );
  });

  it("모르는 상태면 지금 단계를 표시하지 않는다", () => {
    assert.deepEqual(
      lifecycleSteps("없는 상태").map((step) => step.state),
      ["upcoming", "upcoming", "upcoming", "upcoming"]
    );
  });

  it("상태마다 다른 칩 모양을 쓴다", () => {
    const tones = ["작성중", "검토중", "마감확정", "잠금"].map(operatingMonthTone);
    assert.equal(new Set(tones).size, 4);
    assert.equal(operatingMonthTone("없는 상태"), "neutral");
  });
});
