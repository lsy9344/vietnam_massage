import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { businessMinuteOf, callGuestName, minutesUntilNextCall, sortByBusinessStartTime } from "@/modules/therapists/therapist-today-rules";

describe("businessMinuteOf", () => {
  it("returns the clock minute as-is at or after dayStart", () => {
    assert.equal(businessMinuteOf("09:00", "09:00"), 9 * 60);
    assert.equal(businessMinuteOf("23:30", "09:00"), 23 * 60 + 30);
  });

  it("adds 24h for a clock before dayStart (past midnight, same business day)", () => {
    assert.equal(businessMinuteOf("00:30", "09:00"), 24 * 60 + 30);
  });
});

describe("minutesUntilNextCall", () => {
  it("returns minutes to the earliest upcoming call", () => {
    const result = minutesUntilNextCall({
      now: "14:00",
      dayStart: "09:00",
      calls: [
        { startTime: "16:00", status: "예약" },
        { startTime: "15:00", status: "RESERVED" }
      ]
    });
    assert.equal(result, 60);
  });

  it("ignores calls that already started", () => {
    const result = minutesUntilNextCall({
      now: "14:00",
      dayStart: "09:00",
      calls: [{ startTime: "13:00", status: "사용중" }]
    });
    assert.equal(result, null);
  });

  it("ignores canceled and no-show calls", () => {
    const result = minutesUntilNextCall({
      now: "14:00",
      dayStart: "09:00",
      calls: [
        { startTime: "15:00", status: "취소" },
        { startTime: "16:00", status: "NO_SHOW" }
      ]
    });
    assert.equal(result, null);
  });

  it("counts an after-midnight call as later in the business day", () => {
    const result = minutesUntilNextCall({
      now: "23:30",
      dayStart: "09:00",
      calls: [{ startTime: "00:30", status: "예약" }]
    });
    assert.equal(result, 60);
  });

  it("returns null when there are no calls left today", () => {
    assert.equal(minutesUntilNextCall({ now: "23:00", dayStart: "09:00", calls: [] }), null);
  });
});

describe("sortByBusinessStartTime", () => {
  it("orders an after-midnight start time after the evening", () => {
    const sorted = sortByBusinessStartTime(
      [{ startTime: "00:30", id: "a" }, { startTime: "20:00", id: "b" }],
      "09:00"
    );
    assert.deepEqual(sorted.map((row) => row.id), ["b", "a"]);
  });
});

describe("callGuestName", () => {
  it("prefers the booker name", () => {
    assert.equal(callGuestName({ bookerName: "응오 반 아", customerName: "다른 이름", customerMemo: "메모" }), "응오 반 아");
  });

  it("falls back to the linked customer's name", () => {
    assert.equal(callGuestName({ bookerName: null, customerName: "응웬", customerMemo: "메모" }), "응웬");
  });

  it("falls back to the first line of the customer memo", () => {
    assert.equal(callGuestName({ bookerName: null, customerName: null, customerMemo: "단골\n주의사항" }), "단골");
  });

  it("returns null when nothing identifies the guest", () => {
    assert.equal(callGuestName({ bookerName: null, customerName: null, customerMemo: null }), null);
  });

  it("treats a blank booker name as missing", () => {
    assert.equal(callGuestName({ bookerName: "   ", customerName: "응웬", customerMemo: null }), "응웬");
  });
});
