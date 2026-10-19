import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  quickBookingCourseColumns,
  quickBookingFreeTime,
  quickBookingSeatShortage,
  quickBookingSummary,
  quickBookingTherapistGroups
} from "@/app/(erp)/calls/quick-booking-conditions";
import type { SeatPointDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

function row(therapistId: string, changes: Partial<TherapistAvailabilityRowDto> = {}): TherapistAvailabilityRowDto {
  return {
    therapistId,
    therapistName: therapistId,
    attendance: "checked_in",
    shiftCheck: false,
    available: true,
    freeFrom: null,
    nextReservationTime: null,
    freeMinutes: null,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done: 0, finished: 0, reserved: 0 },
    plannedStartTime: null,
    current: { state: "available", expectedEnd: null, nextReservationTime: null, freeMinutes: null },
    courses: [],
    ...changes
  };
}

const ids = (rows: TherapistAvailabilityRowDto[]) => rows.map((candidate) => candidate.therapistId);

describe("quick booking Therapist list (1018 스펙 D20·D23)", () => {
  const rows = [
    row("checked-in-busy", { available: false, freeFrom: "18:30" }),
    row("checked-in-two", { callCounts: { done: 2, finished: 2, reserved: 0 } }),
    row("checked-in-none"),
    row("checked-out", { attendance: "checked_out" }),
    row("planned", { attendance: "before_check_in", plannedWorkingDayStatus: "근무 예정" }),
    row("planned-busy", { attendance: "before_check_in", plannedWorkingDayStatus: "근무 예정", available: false, freeFrom: "19:00" }),
    row("day-off", { attendance: "before_check_in", plannedWorkingDayStatus: "휴무" }),
    row("unscheduled", { attendance: "before_check_in", plannedWorkingDayStatus: "미입력" })
  ];

  it("lists those who checked in and can take the time, fewest finished today first, and folds away those who cannot", () => {
    const groups = quickBookingTherapistGroups(rows, { showBeforeCheckIn: false, presetTherapistId: null });
    assert.deepEqual(ids(groups.listed), ["checked-in-none", "checked-in-two"]);
    assert.deepEqual(ids(groups.unavailable), ["checked-in-busy", "checked-out"]);
    assert.equal(groups.beforeCheckInCount, 2);
  });

  it("adds only those scheduled to work and not yet checked in when 출근 전 보기 is on, never the unscheduled or the day off", () => {
    const groups = quickBookingTherapistGroups(rows, { showBeforeCheckIn: true, presetTherapistId: null });
    assert.deepEqual(ids(groups.listed), ["checked-in-none", "planned", "checked-in-two"]);
    assert.deepEqual(ids(groups.unavailable), ["checked-in-busy", "planned-busy", "checked-out"]);
  });

  it("puts the Therapist opened from the status strip on top, even when not listed otherwise", () => {
    assert.deepEqual(ids(quickBookingTherapistGroups(rows, { showBeforeCheckIn: false, presetTherapistId: "checked-in-two" }).listed), [
      "checked-in-two",
      "checked-in-none"
    ]);
    const unscheduled = quickBookingTherapistGroups(rows, { showBeforeCheckIn: false, presetTherapistId: "unscheduled" });
    assert.deepEqual(ids(unscheduled.listed), ["unscheduled", "checked-in-none", "checked-in-two"]);
  });

  it("keeps the preset Therapist in the fold, on its top, when that Therapist cannot take the time", () => {
    const busy = quickBookingTherapistGroups(rows, { showBeforeCheckIn: false, presetTherapistId: "checked-in-busy" });
    assert.deepEqual(ids(busy.listed), ["checked-in-none", "checked-in-two"]);
    assert.deepEqual(ids(busy.unavailable), ["checked-in-busy", "checked-out"]);
    const out = quickBookingTherapistGroups(rows, { showBeforeCheckIn: false, presetTherapistId: "checked-out" });
    assert.deepEqual(ids(out.unavailable), ["checked-out", "checked-in-busy"]);
  });
});

describe("quick booking free time (1018 스펙 D20)", () => {
  it("reads until the next reservation, until closing, or from when the Therapist is free", () => {
    assert.deepEqual(quickBookingFreeTime(row("a", { nextReservationTime: "19:00", freeMinutes: 120 })), {
      kind: "until",
      time: "19:00",
      minutes: 120
    });
    assert.deepEqual(quickBookingFreeTime(row("a")), { kind: "untilClose" });
    assert.deepEqual(quickBookingFreeTime(row("a", { available: false, freeFrom: "18:30" })), { kind: "from", time: "18:30" });
    assert.deepEqual(quickBookingFreeTime(row("a", { available: false, freeFrom: null })), null);
    // 퇴근한 사람은 비는 시간이 없다.
    assert.deepEqual(quickBookingFreeTime(row("a", { attendance: "checked_out" })), null);
  });
});

describe("quick booking summary line (1018 스펙 D21)", () => {
  it("reads time · party size · each guest · channel and booker", () => {
    assert.equal(
      quickBookingSummary({
        startTime: "18:00",
        partySizeLabel: "2명",
        guests: ["12번 C90", "미지명 C90"],
        channelLabel: "텔레그램",
        bookerName: "홍길동"
      }),
      "18:00 · 2명 · 12번 C90, 미지명 C90 · 텔레그램 홍길동"
    );
  });

  it("leaves out what is not chosen yet", () => {
    assert.equal(
      quickBookingSummary({ startTime: "18:00", partySizeLabel: "1명", guests: ["12번 C90"], channelLabel: null, bookerName: " " }),
      "18:00 · 1명 · 12번 C90"
    );
  });
});

describe("quick booking course columns (1018 스펙 D20)", () => {
  it("lines the active courses up in one order across every row, the first time each course is seen", () => {
    const course = (courseId: string, minutes: number, requiresSecondTherapist = false) => ({
      courseId,
      courseCode: courseId.toUpperCase(),
      courseName: courseId,
      durationMinutes: minutes,
      verdict: "possible" as const,
      requiresSecondTherapist
    });
    const columns = quickBookingCourseColumns([
      row("a", { courses: [course("a", 60), course("c", 90)] }),
      row("b", { courses: [course("a", 60), course("d", 90, true), course("c", 90)] })
    ]);
    assert.deepEqual(columns, [
      { courseId: "a", code: "A", minutes: 60, requiresSecondTherapist: false },
      { courseId: "c", code: "C", minutes: 90, requiresSecondTherapist: false },
      { courseId: "d", code: "D", minutes: 90, requiresSecondTherapist: true }
    ]);
  });
});

describe("quick booking seat shortage (1018 스펙 D25·D26)", () => {
  const columns = [
    { courseId: "course-a", code: "A", minutes: 60, requiresSecondTherapist: false },
    { courseId: "course-d", code: "D", minutes: 90, requiresSecondTherapist: true }
  ];
  // 18:00에 2자리, 18:30부터 1자리가 남는다. 일하면서 비어 있는 사람은 t1·t2다.
  const seats: SeatPointDto[] = [
    { time: "18:00", offsetMinutes: 0, capacity: 4, remaining: 2, freeTherapistIds: ["t1", "t2"] },
    { time: "18:30", offsetMinutes: 30, capacity: 4, remaining: 1, freeTherapistIds: ["t1", "t2"] }
  ];
  const guest = (courseId: string, therapist1Id: string | null = null, therapist2Id: string | null = null) => ({ courseId, therapist1Id, therapist2Id });

  it("reads the guests' courses as seats over their length, a D course as 2 seats", () => {
    assert.equal(quickBookingSeatShortage(seats, columns, [guest("course-a")]), null);
    assert.deepEqual(quickBookingSeatShortage(seats, columns, [guest("course-a"), guest("course-a", "t1")]), {
      time: "18:30",
      remaining: 1,
      demand: 2
    });
    assert.deepEqual(quickBookingSeatShortage(seats, columns, [guest("course-d"), guest("course-a")]), {
      time: "18:00",
      remaining: 2,
      demand: 3
    });
  });

  it("takes no seat for a named guest whose Therapist is busy or not working", () => {
    assert.equal(quickBookingSeatShortage(seats, columns, [guest("course-a"), guest("course-a", "busy-or-off")]), null);
    assert.equal(quickBookingSeatShortage(seats, columns, [guest("course-d", "t1", "busy-or-off")]), null);
  });

  it("finds no shortage before the seats are loaded", () => {
    assert.equal(quickBookingSeatShortage([], columns, [guest("course-d"), guest("course-d")]), null);
  });
});
