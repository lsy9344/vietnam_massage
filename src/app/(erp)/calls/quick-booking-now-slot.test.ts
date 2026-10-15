import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectNowSlot } from "@/app/(erp)/calls/quick-booking-now-slot";

const businessDaySlots = [
  { value: "11:00" },
  { value: "11:30" },
  { value: "23:30" },
  { value: "23:50" },
  { value: "00:00" },
  { value: "00:30" },
  { value: "10:50" }
];

describe("quick booking: 지금 슬롯 선택(B05)", () => {
  it("picks the last active slot that does not come after now", () => {
    assert.equal(selectNowSlot(businessDaySlots, "11:45"), "11:30");
    assert.equal(selectNowSlot(businessDaySlots, "23:40"), "23:30");
  });

  it("picks the first slot when now is earlier than it", () => {
    const slots = [{ value: "14:00" }, { value: "14:30" }, { value: "15:00" }];
    assert.equal(selectNowSlot(slots, "10:00"), "14:00");
  });

  it("walks past midnight using the slot order given, not a plain string compare", () => {
    // 00:30은 숫자로는 작아 보이지만 영업일 순서(11:00 ~ 다음날 10:50)상 자정을 넘은 뒤쪽 구간이다.
    assert.equal(selectNowSlot(businessDaySlots, "00:30"), "00:30");
    assert.equal(selectNowSlot(businessDaySlots, "00:40"), "00:30");
    assert.equal(selectNowSlot(businessDaySlots, "10:50"), "10:50");
  });

  it("chooses exactly a slot that matches now", () => {
    assert.equal(selectNowSlot(businessDaySlots, "23:50"), "23:50");
  });

  it("returns an empty slot when there are no active slots", () => {
    assert.equal(selectNowSlot([], "12:00"), "");
  });
});
