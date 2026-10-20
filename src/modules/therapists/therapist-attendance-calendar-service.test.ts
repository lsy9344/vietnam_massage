import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getTherapistAttendanceCalendar, listTherapistClockOutMissingDates } from "@/modules/therapists/therapist-attendance-calendar-service";

const createdAt = new Date("2042-01-01T00:00:00.000Z");
const updatedAt = createdAt;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * 티켓 06 테스트용 메모리 Prisma: 근태 달력이 읽는 timeSlot·employee·plannedWorkingDay·
 * therapistAttendance·operatingMonth만 둔다(createMemoryPrisma는 공용 모듈이 아니다, 코드베이스
 * 지도 14절). dayStart는 "11:00"이다.
 */
function createMemoryPrisma() {
  const employee = { id: "emp-1", displayName: "민호", staffCode: "THR-901", employeeGroup: "THERAPIST", sortOrder: 9801, isActive: true };
  const operatingMonth = { id: "month-2042-05", monthKey: "2042-05", startDate: dbDate("2042-05-01"), endDate: dbDate("2042-05-31"), status: "작성중" };

  const plannedWorkingDays = [
    { employeeId: "emp-1", workDate: dbDate("2042-05-02"), planStatus: "근무 예정", plannedStartTime: "10:00" },
    { employeeId: "emp-1", workDate: dbDate("2042-05-03"), planStatus: "근무 예정", plannedStartTime: "09:00" },
    { employeeId: "emp-1", workDate: dbDate("2042-05-04"), planStatus: "휴무", plannedStartTime: null },
    // 오늘(미래 아님, 운영일 안 끝남) 근무 예정인데 아직 출근 기록 없음 — 결근 아니다.
    { employeeId: "emp-1", workDate: dbDate("2042-05-05"), planStatus: "근무 예정", plannedStartTime: "09:00" }
  ];

  const attendances = new Map<string, any>([
    [
      "att-1",
      {
        id: "att-1",
        operatingMonthId: "month-2042-05",
        attendanceDate: dbDate("2042-05-02"),
        employeeId: "emp-1",
        checkInMinute: 605, // 10:05
        checkInMethod: "직접",
        checkOutMinute: 1140, // 19:00
        checkOutMethod: "직접",
        standbyMinutes: 535,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "att-2",
      {
        id: "att-2",
        operatingMonthId: "month-2042-05",
        attendanceDate: dbDate("2042-05-04"),
        employeeId: "emp-1",
        checkInMinute: 660, // 11:00, 휴무인 날의 출근 → 예정 없는 출근
        checkInMethod: "대리 입력",
        checkOutMinute: null,
        checkOutMethod: null,
        standbyMinutes: null,
        isFullAttendanceRecognized: false,
        isActive: true,
        createdAt,
        updatedAt
      }
    ]
  ]);

  const client: any = {
    timeSlot: {
      async findMany() {
        return [{ value: "11:00", sortOrder: 10, createdAt, isActive: true }];
      }
    },
    plannedWorkingDay: {
      async findMany({ where }: any = {}) {
        return plannedWorkingDays.filter((row) => {
          if (where?.employeeId !== undefined && row.employeeId !== where.employeeId) return false;
          if (where?.workDate?.gte !== undefined && row.workDate < where.workDate.gte) return false;
          if (where?.workDate?.lte !== undefined && row.workDate > where.workDate.lte) return false;
          return true;
        });
      }
    },
    employee: {
      async findUnique({ where }: any) {
        return where.id === employee.id ? employee : null;
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter((row) => {
          if (where?.employeeId !== undefined && row.employeeId !== where.employeeId) return false;
          if (where?.isActive !== undefined && row.isActive !== where.isActive) return false;
          if (where?.attendanceDate?.gte !== undefined && row.attendanceDate < where.attendanceDate.gte) return false;
          if (where?.attendanceDate?.lte !== undefined && row.attendanceDate > where.attendanceDate.lte) return false;
          return true;
        });
      }
    },
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    // 08이 채운 자리(휴무·정정 신청). 이 파일의 시나리오에는 신청이 없어 늘 빈 배열이다 — 신청이
    // 있는 날의 requestStatus는 therapist-request-service.test.ts에서 확인한다.
    therapistRequest: {
      async findMany() {
        return [];
      }
    }
  };

  return client;
}

// now는 UTC+7(영업 시간대)에서 2042-05-05 15:00이라 운영일은 2042-05-05다(dayStart "11:00"보다 늦다).
const now = new Date("2042-05-05T08:00:00.000Z");

describe("getTherapistAttendanceCalendar", () => {
  it("returns the month's days with schedule, attendance display/method, and attendance judgment", async () => {
    const prismaClient = createMemoryPrisma();
    const calendar = await getTherapistAttendanceCalendar({ employeeId: "emp-1", monthKey: "2042-05", now, prismaClient });

    assert.equal(calendar.monthKey, "2042-05");
    assert.equal(calendar.startDate, "2042-05-01");
    assert.equal(calendar.endDate, "2042-05-31");
    assert.equal(calendar.todayServiceDate, "2042-05-05");
    assert.equal(calendar.days.length, 31);

    const byDate = new Map(calendar.days.map((day) => [day.date, day]));

    // 2042-05-01: 근무표 행 없음 → 미입력, 아무 판정도 없음.
    const unset = byDate.get("2042-05-01")!;
    assert.equal(unset.planStatus, "미입력");
    assert.equal(unset.checkInTime, null);
    assert.deepEqual(unset.judgment, { lateMinutes: null, isAbsent: false, isClockOutMissing: false, isUnscheduledAttendance: false });
    assert.equal(unset.requestStatus, null);

    // 2042-05-02: 근무 예정(10:00) + 출근 10:05(직접)/퇴근 19:00(직접) → 5분 지각, 방식이 보인다.
    const late = byDate.get("2042-05-02")!;
    assert.equal(late.planStatus, "근무 예정");
    assert.equal(late.plannedStartTime, "10:00");
    assert.equal(late.checkInTime, "10:05");
    assert.equal(late.checkInMethod, "직접");
    assert.equal(late.checkOutTime, "19:00");
    assert.equal(late.checkOutMethod, "직접");
    assert.equal(late.judgment.lateMinutes, 5);
    assert.equal(late.judgment.isAbsent, false);

    // 2042-05-03: 근무 예정(09:00)인데 출근 기록이 없고 운영일이 끝났다 → 결근.
    const absent = byDate.get("2042-05-03")!;
    assert.equal(absent.judgment.isAbsent, true);
    assert.equal(absent.judgment.isClockOutMissing, false);

    // 2042-05-04: 휴무인 날 출근(퇴근 없음), 운영일이 끝났다 → 예정 없는 출근 + 퇴근 미입력.
    const unscheduled = byDate.get("2042-05-04")!;
    assert.equal(unscheduled.planStatus, "휴무");
    assert.equal(unscheduled.checkInTime, "11:00");
    assert.equal(unscheduled.checkInMethod, "대리 입력");
    assert.equal(unscheduled.judgment.isUnscheduledAttendance, true);
    assert.equal(unscheduled.judgment.isClockOutMissing, true);

    // 2042-05-05(오늘): 근무 예정인데 아직 출근 기록이 없어도 오늘 운영일은 결근이 아니다.
    const today = byDate.get("2042-05-05")!;
    assert.equal(today.judgment.isAbsent, false);
    assert.equal(today.judgment.isClockOutMissing, false);
  });

  it("defaults to the month containing now when monthKey is omitted", async () => {
    const prismaClient = createMemoryPrisma();
    const calendar = await getTherapistAttendanceCalendar({ employeeId: "emp-1", now, prismaClient });
    assert.equal(calendar.monthKey, "2042-05");
  });
});

describe("listTherapistClockOutMissingDates", () => {
  it("returns dates whose operating day ended with a check-in but no checkout", async () => {
    const prismaClient = createMemoryPrisma();
    const dates = await listTherapistClockOutMissingDates({ employeeId: "emp-1", now, prismaClient });
    assert.deepEqual(dates, ["2042-05-04"]);
  });
});
