import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { axisTicks, heightPercent, labelStride } from "@/app/(erp)/dashboard/chart-scale";

describe("세로 축 눈금", () => {
  it("covers the largest value with round steps of 1, 2 or 5 starting at 0", () => {
    assert.deepEqual(axisTicks([4_700_000, 4_400_000, 0]), [0, 2_000_000, 4_000_000, 6_000_000]);
    assert.deepEqual(axisTicks([3, 1, 0]), [0, 1, 2, 3]);
  });

  it("reaches below 0 when net sales went negative, so the 0 line sits above the bottom", () => {
    const ticks = axisTicks([1_200_000, -300_000]);

    assert.deepEqual(ticks, [-500_000, 0, 500_000, 1_000_000, 1_500_000]);
    assert.equal(heightPercent(0, ticks), 25);
    assert.equal(heightPercent(1_200_000, ticks), 85);
    assert.equal(heightPercent(-500_000, ticks), 0);
  });

  it("still draws one step when every value is 0", () => {
    assert.deepEqual(axisTicks([0, 0]), [0, 1]);
    assert.equal(heightPercent(0, [0, 1]), 0);
  });
});

describe("가로 축 날짜 글자", () => {
  it("labels every day of a short range but at most 7 days of a month, so 12px labels never overlap", () => {
    assert.equal(labelStride(7), 1);
    // 31일이면 1·6·11·16·21·26·31일에 글자를 단다.
    assert.equal(labelStride(31), 5);
    assert.equal(labelStride(28), 4);
  });
});
