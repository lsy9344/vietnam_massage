import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStartTimeWithinSlots, startTimeOrder } from "@/modules/calls/start-time-order";

const slots = [
  { value: "11:00", sortOrder: 1, isActive: true },
  { value: "11:30", sortOrder: 2, isActive: true },
  { value: "23:30", sortOrder: 3, isActive: true },
  { value: "00:00", sortOrder: 4, isActive: true },
  { value: "01:00", sortOrder: 5, isActive: true },
  { value: "02:00", sortOrder: 6, isActive: false }
];

describe("startTimeOrder", () => {
  it("keeps the slot sort order for slot times", () => {
    const order = startTimeOrder(slots);
    assert.equal(order("11:30"), 2);
    assert.equal(order("00:00"), 4);
  });

  it("places a 10-minute time right after the slot before it", () => {
    const order = startTimeOrder(slots);
    const sorted = ["11:30", "11:20", "11:00", "11:10", "23:40", "00:10"].sort((left, right) => (order(left) ?? 9999) - (order(right) ?? 9999));
    assert.deepEqual(sorted, ["11:00", "11:10", "11:20", "11:30", "23:40", "00:10"]);
  });

  it("puts a time earlier than the first slot at the end of the business day, and has no order for a malformed time", () => {
    const order = startTimeOrder(slots);
    assert.ok((order("10:50") ?? 0) > (order("01:00") ?? 0));
    assert.equal(order("1:10"), undefined);
  });
});

describe("isStartTimeWithinSlots", () => {
  it("accepts 10-minute times between the first and last active slot", () => {
    assert.equal(isStartTimeWithinSlots("11:10", slots), true);
    assert.equal(isStartTimeWithinSlots("00:50", slots), true);
    assert.equal(isStartTimeWithinSlots("01:00", slots), true);
  });

  it("rejects times outside business hours, past the last active slot, or off the 10-minute grid", () => {
    assert.equal(isStartTimeWithinSlots("10:50", slots), false);
    assert.equal(isStartTimeWithinSlots("01:10", slots), false);
    assert.equal(isStartTimeWithinSlots("11:15", slots), false);
    assert.equal(isStartTimeWithinSlots("abc", slots), false);
  });
});
