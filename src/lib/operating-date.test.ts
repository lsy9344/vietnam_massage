import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  businessClockString,
  businessTodayIsoDate,
  businessTodayServiceDate,
  clampDateToOperatingMonth,
  selectedOperatingMonthFor
} from "@/lib/operating-date";

const months = [
  {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "작성중"
  },
  {
    id: "month-2026-05",
    monthKey: "2026-05",
    startDate: "2026-05-01",
    endDate: "2026-05-31",
    status: "마감확정"
  }
];

describe("operating date helpers", () => {
  it("formats today's date in Vietnam time as an ISO date", () => {
    const now = new Date("2026-06-08T16:30:00.000Z");

    assert.equal(businessTodayIsoDate(now), "2026-06-08");
  });

  it("selects the requested operating month or falls back to the first month", () => {
    assert.equal(selectedOperatingMonthFor(months, "month-2026-05")?.id, "month-2026-05");
    assert.equal(selectedOperatingMonthFor(months, "missing")?.id, "month-2026-06");
    assert.equal(selectedOperatingMonthFor([], "missing"), null);
  });

  it("keeps an in-range service date and clamps missing or out-of-range dates", () => {
    assert.equal(clampDateToOperatingMonth("2026-06-20", months[0], new Date("2026-06-09T00:00:00.000+07:00")), "2026-06-20");
    assert.equal(clampDateToOperatingMonth(undefined, months[0], new Date("2026-06-09T00:00:00.000+07:00")), "2026-06-09");
    assert.equal(clampDateToOperatingMonth("2026-05-31", months[0], new Date("2026-05-31T00:00:00.000+07:00")), "2026-06-01");
    assert.equal(clampDateToOperatingMonth("2026-07-01", months[0], new Date("2026-07-01T00:00:00.000+07:00")), "2026-06-30");
  });

  it("reads the clock time in Vietnam time as HH:mm", () => {
    assert.equal(businessClockString(new Date("2026-06-08T16:30:00.000Z")), "23:30");
    assert.equal(businessClockString(new Date("2026-10-14T17:30:00.000Z")), "00:30");
  });

  describe("businessTodayServiceDate", () => {
    it("keeps 02:59:59 in the previous service date and switches at exactly 03:00 Vietnam time", () => {
      assert.equal(businessTodayServiceDate(new Date("2026-10-15T02:59:59+07:00")), "2026-10-14");
      assert.equal(businessTodayServiceDate(new Date("2026-10-15T03:00:00+07:00")), "2026-10-15");
      assert.equal(businessTodayServiceDate(new Date("2026-10-15T08:00:00+07:00")), "2026-10-15");
    });

    it("handles month and year boundaries without depending on reservation slots", () => {
      assert.equal(businessTodayServiceDate(new Date("2026-11-01T02:59:00+07:00")), "2026-10-31");
      assert.equal(businessTodayServiceDate(new Date("2027-01-01T01:00:00+07:00")), "2026-12-31");
      assert.equal(businessTodayServiceDate(new Date("2027-01-01T03:00:00+07:00")), "2027-01-01");
    });
  });
});
