import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectNowSlot, shiftStartTime, timeOptionsWith } from "@/app/(erp)/calls/quick-booking-now-slot";

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

describe("quick booking: ±10분 버튼", () => {
  const slots = [{ value: "11:00" }, { value: "11:30" }, { value: "23:30" }, { value: "00:00" }, { value: "01:00" }];

  it("moves the start time by ten minutes between slots", () => {
    assert.equal(shiftStartTime(slots, "11:00", 10), "11:10");
    assert.equal(shiftStartTime(slots, "11:30", -10), "11:20");
  });

  it("walks past midnight", () => {
    assert.equal(shiftStartTime(slots, "23:50", 10), "00:00");
    assert.equal(shiftStartTime(slots, "00:00", -10), "23:50");
  });

  it("stays inside the first and last slot", () => {
    assert.equal(shiftStartTime(slots, "11:00", -10), "11:00");
    assert.equal(shiftStartTime(slots, "01:00", 10), "01:00");
  });

  it("leaves an empty time alone", () => {
    assert.equal(shiftStartTime(slots, "", 10), "");
  });
});

describe("quick booking: 슬롯 사이 시각을 시각 목록에 끼우기", () => {
  const slots = [{ value: "23:30", label: "23:30" }, { value: "00:00", label: "00:00" }, { value: "00:30", label: "00:30" }];

  it("inserts a 10-minute time after the slot before it, across midnight", () => {
    assert.deepEqual(timeOptionsWith(slots, "00:10").map((option) => option.value), ["23:30", "00:00", "00:10", "00:30"]);
    assert.deepEqual(timeOptionsWith(slots, "23:40").map((option) => option.value), ["23:30", "23:40", "00:00", "00:30"]);
  });

  it("keeps the slot list as is for a slot time or no time", () => {
    assert.equal(timeOptionsWith(slots, "00:00").length, 3);
    assert.equal(timeOptionsWith(slots, null).length, 3);
  });
});
