import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampDateToOperatingMonth, kstTodayIsoDate, selectedOperatingMonthFor } from "@/lib/operating-date";

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
  it("formats today's date in Korea time as an ISO date", () => {
    const now = new Date("2026-06-08T15:30:00.000Z");

    assert.equal(kstTodayIsoDate(now), "2026-06-09");
  });

  it("selects the requested operating month or falls back to the first month", () => {
    assert.equal(selectedOperatingMonthFor(months, "month-2026-05")?.id, "month-2026-05");
    assert.equal(selectedOperatingMonthFor(months, "missing")?.id, "month-2026-06");
    assert.equal(selectedOperatingMonthFor([], "missing"), null);
  });

  it("keeps an in-range service date and clamps missing or out-of-range dates", () => {
    assert.equal(clampDateToOperatingMonth("2026-06-20", months[0], new Date("2026-06-09T00:00:00.000+09:00")), "2026-06-20");
    assert.equal(clampDateToOperatingMonth(undefined, months[0], new Date("2026-06-09T00:00:00.000+09:00")), "2026-06-09");
    assert.equal(clampDateToOperatingMonth("2026-07-01", months[0], new Date("2026-07-01T00:00:00.000+09:00")), "2026-06-01");
  });
});
