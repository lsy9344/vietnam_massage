import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { judgeTherapistAttendanceDay, type TherapistAttendanceDayJudgmentInput } from "@/modules/therapists/therapist-attendance-judgment";

const baseInput: TherapistAttendanceDayJudgmentInput = {
  planStatus: "근무 예정",
  plannedStartTime: "10:00",
  checkInTime: "10:00",
  checkOutTime: "19:00",
  dayStart: "11:00",
  isOperatingDayEnded: true
};

describe("judgeTherapistAttendanceDay", () => {
  it("is not late when the check-in is the same minute as the planned start", () => {
    const result = judgeTherapistAttendanceDay({ ...baseInput, checkInTime: "10:00" });
    assert.equal(result.lateMinutes, null);
  });

  it("is late by 1 minute when the check-in is one minute after the planned start", () => {
    const result = judgeTherapistAttendanceDay({ ...baseInput, checkInTime: "10:01" });
    assert.equal(result.lateMinutes, 1);
  });

  it("does not judge lateness when the planned start time is empty", () => {
    const result = judgeTherapistAttendanceDay({ ...baseInput, plannedStartTime: null, checkInTime: "10:30" });
    assert.equal(result.lateMinutes, null);
  });

  it("flags unscheduled attendance on a day off with a check-in", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      planStatus: "휴무",
      plannedStartTime: null,
      checkInTime: "11:00"
    });
    assert.equal(result.isUnscheduledAttendance, true);
    assert.equal(result.isAbsent, false);
  });

  it("flags unscheduled attendance on an unset day with a check-in", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      planStatus: "미입력",
      plannedStartTime: null,
      checkInTime: "11:00"
    });
    assert.equal(result.isUnscheduledAttendance, true);
  });

  it("compares an overnight planned start and check-in without the +1440 standby bug (early arrival is not a large lateness)", () => {
    // Business day starts at 11:00. Planned start 22:00 is already past dayStart (no wrap).
    // Checking in at 21:50 (10 minutes early) must not be treated as ~1670 minutes late, which
    // is what would happen if the checkout<checkin style +1440 correction were reused here.
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      dayStart: "11:00",
      plannedStartTime: "22:00",
      checkInTime: "21:50"
    });
    assert.equal(result.lateMinutes, null);
  });

  it("compares an overnight planned start and check-in past midnight correctly", () => {
    // Checking in at 08:00 (past midnight, before dayStart) when planned for 22:00 the previous
    // calendar day is genuinely very late (600 minutes), not early.
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      dayStart: "11:00",
      plannedStartTime: "22:00",
      checkInTime: "08:00"
    });
    assert.equal(result.lateMinutes, 600);
  });

  it("is not absent for today's operating day even without a check-in", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      checkInTime: null,
      checkOutTime: null,
      isOperatingDayEnded: false
    });
    assert.equal(result.isAbsent, false);
  });

  it("is absent when a scheduled day ended with no check-in at all", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      checkInTime: null,
      checkOutTime: null,
      isOperatingDayEnded: true
    });
    assert.equal(result.isAbsent, true);
  });

  it("flags clock-out missing when an ended operating day has a check-in but no checkout", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      checkOutTime: null,
      isOperatingDayEnded: true
    });
    assert.equal(result.isClockOutMissing, true);
  });

  it("does not flag clock-out missing for today's ongoing shift with no checkout yet", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      checkOutTime: null,
      isOperatingDayEnded: false
    });
    assert.equal(result.isClockOutMissing, false);
  });

  it("is not absent or unscheduled on a day off with no attendance", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      planStatus: "휴무",
      plannedStartTime: null,
      checkInTime: null,
      checkOutTime: null,
      isOperatingDayEnded: true
    });
    assert.equal(result.isAbsent, false);
    assert.equal(result.isUnscheduledAttendance, false);
  });

  it("is not absent or unscheduled on an unset day with no attendance", () => {
    const result = judgeTherapistAttendanceDay({
      ...baseInput,
      planStatus: "미입력",
      plannedStartTime: null,
      checkInTime: null,
      checkOutTime: null,
      isOperatingDayEnded: true
    });
    assert.equal(result.isAbsent, false);
    assert.equal(result.isUnscheduledAttendance, false);
  });
});
