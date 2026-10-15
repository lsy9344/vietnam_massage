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

  // S10(스펙 226줄, 티켓 10): 영업일은 첫 활성 슬롯부터 다음 날 첫 활성 슬롯 전까지라서, 자정부터 첫
  // 활성 슬롯 전까지는 전날 서비스 날짜가 오늘이다 — businessTodayIsoDate(달력날)와는 다르다.
  describe("businessTodayServiceDate", () => {
    const activeSlots = [{ value: "11:00" }, { value: "11:30" }, { value: "23:30" }, { value: "00:00" }, { value: "00:30" }, { value: "01:00" }];

    it("returns yesterday's calendar date when now is before the first active slot (past-midnight tail of yesterday's business day)", () => {
      // 2026-10-14T17:30:00Z = 호찌민 2026-10-15 00:30, 첫 슬롯(11:00)보다 이르다.
      assert.equal(businessTodayServiceDate(activeSlots, new Date("2026-10-14T17:30:00.000Z")), "2026-10-14");
    });

    it("returns today's calendar date once now reaches the first active slot", () => {
      // 2026-10-14T05:30:00Z = 호찌민 2026-10-14 12:30, 첫 슬롯(11:00) 이후다.
      assert.equal(businessTodayServiceDate(activeSlots, new Date("2026-10-14T05:30:00.000Z")), "2026-10-14");
    });

    it("falls back to the calendar date when there is no active slot", () => {
      assert.equal(businessTodayServiceDate([], new Date("2026-10-14T17:30:00.000Z")), "2026-10-15");
    });
  });
});
