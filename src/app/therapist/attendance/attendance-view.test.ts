import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attendanceMonthHref,
  attendanceWeekHref,
  monthKeyToShowForWeek,
  resolveTherapistAttendanceView,
  weekDateToShowForMonth
} from "@/app/therapist/attendance/attendance-view";

describe("resolveTherapistAttendanceView", () => {
  it("shows this week when no search params are given", () => {
    assert.deepEqual(resolveTherapistAttendanceView({}), { kind: "week", date: undefined });
  });

  it("shows the week of ?week= when it is a real date", () => {
    assert.deepEqual(resolveTherapistAttendanceView({ week: "2042-05-01" }), { kind: "week", date: "2042-05-01" });
  });

  it("keeps old ?month= links on the month view", () => {
    assert.deepEqual(resolveTherapistAttendanceView({ month: "2042-05" }), { kind: "month", monthKey: "2042-05" });
  });

  it("falls back to this week when ?week= or ?month= is malformed", () => {
    assert.deepEqual(resolveTherapistAttendanceView({ week: "2042-02-31" }), { kind: "week", date: undefined });
    assert.deepEqual(resolveTherapistAttendanceView({ week: "tomorrow" }), { kind: "week", date: undefined });
    assert.deepEqual(resolveTherapistAttendanceView({ month: "2042-5" }), { kind: "week", date: undefined });
  });
});

describe("week ↔ month toggle targets", () => {
  it("opens today's month from the week containing today, even when that week starts in the previous month", () => {
    // 2042-04-28(월)–2042-05-04(일), 오늘 2042-04-30
    assert.equal(monthKeyToShowForWeek("2042-04-28", "2042-04-30"), "2042-04");
    assert.equal(monthKeyToShowForWeek("2042-04-28", "2042-05-02"), "2042-05");
  });

  it("opens the month holding most of another week (its Thursday)", () => {
    assert.equal(monthKeyToShowForWeek("2042-04-28", "2042-06-10"), "2042-05");
    assert.equal(monthKeyToShowForWeek("2042-03-30", "2042-06-10"), "2042-04");
    assert.equal(monthKeyToShowForWeek("2042-03-23", "2042-06-10"), "2042-03");
  });

  it("opens this week from today's month", () => {
    assert.equal(weekDateToShowForMonth("2042-05", "2042-05-20"), undefined);
  });

  it("returns to the same month after month → week → month, even when the 1st falls late in the week", () => {
    // 2026-05-01은 금요일, 2026-08-01은 토요일, 2026-11-01은 일요일이다 — 1일이 든 주는 앞 달에 더 많이 걸친다.
    for (const monthKey of ["2026-05", "2026-08", "2026-11", "2027-01", "2026-06"]) {
      const weekDate = weekDateToShowForMonth(monthKey, "2042-05-20")!;
      const weekday = new Date(`${weekDate}T00:00:00.000Z`).getUTCDay();
      const monday = new Date(Date.UTC(Number(weekDate.slice(0, 4)), Number(weekDate.slice(5, 7)) - 1, Number(weekDate.slice(8, 10)) - ((weekday + 6) % 7)))
        .toISOString()
        .slice(0, 10);
      assert.equal(monthKeyToShowForWeek(monday, "2042-05-20"), monthKey);
    }
    // 오늘(2026-10-28)이 든 주가 다음 달에 걸쳐 있어도, 다음 달에서 고른 주는 그 달로 돌아온다.
    assert.equal(weekDateToShowForMonth("2026-11", "2026-10-28"), "2026-11-04");
    assert.equal(monthKeyToShowForWeek("2026-11-02", "2026-10-28"), "2026-11");
  });

  it("builds the attendance links", () => {
    assert.equal(attendanceWeekHref(undefined), "/therapist/attendance");
    assert.equal(attendanceWeekHref("2042-04-28"), "/therapist/attendance?week=2042-04-28");
    assert.equal(attendanceMonthHref("2042-05"), "/therapist/attendance?month=2042-05");
  });
});
