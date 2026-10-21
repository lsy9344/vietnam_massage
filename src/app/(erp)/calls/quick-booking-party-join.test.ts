import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { announceQuickBookingShown, isQuickBookingShown, subscribeQuickBookingShown } from "@/app/(erp)/calls/quick-booking-party-join";

describe("빠른 예약 패널이 보이는지(머리 버튼의 주 버튼 여부, design.md 주 버튼 하나)", () => {
  it("처음에는 닫혀 있고, 보임이 바뀔 때만 구독자에게 알린다", () => {
    assert.equal(isQuickBookingShown(), false);
    let calls = 0;
    const stop = subscribeQuickBookingShown(() => {
      calls += 1;
    });

    announceQuickBookingShown(true);
    assert.equal(isQuickBookingShown(), true);
    announceQuickBookingShown(true);
    assert.equal(calls, 1);

    announceQuickBookingShown(false);
    assert.equal(isQuickBookingShown(), false);
    assert.equal(calls, 2);

    stop();
    announceQuickBookingShown(true);
    assert.equal(calls, 2);
    announceQuickBookingShown(false);
  });
});
