import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EarcareDailySettlementDomainError,
  listEarcareDailySettlements
} from "@/modules/settlements/earcare-daily-settlement-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(
  options: { locked?: boolean; allExcluded?: boolean; outsideMonth?: boolean; employeeIdTieBreaker?: boolean } = {}
) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
  const firstEarcareId = options.employeeIdTieBreaker ? "ear-z" : "ear-1";
  const secondEarcareId = options.employeeIdTieBreaker ? "ear-a" : "ear-2";
  const firstEarcareStaffCode = options.employeeIdTieBreaker ? "EAR-TIE" : "EAR-002";
  const secondEarcareStaffCode = options.employeeIdTieBreaker ? "EAR-TIE" : "EAR-001";
  const firstEarcareSortOrder = options.employeeIdTieBreaker ? 10 : 20;
  const secondEarcareSortOrder = 10;
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.locked ? "잠금" : "작성중",
    createdAt,
    updatedAt
  };
  const room = { id: "room-101", displayName: "101 호실", isActive: true, createdAt, updatedAt };
  const courses = new Map<string, any>([
    ["course-a", course("course-a", "A")],
    ["course-b", course("course-b", "B")],
    ["course-c", course("course-c", "C")],
    ["course-d", course("course-d", "D")],
    ["course-no-policy", course("course-no-policy", "A")]
  ]);
  const policies = [
    policy("policy-a", "course-a", "A 누루60", 300001, false),
    policy("policy-b", "course-b", "B 귀청소90", 200000, false),
    policy("policy-c", "course-c", "C 때밀이90", 100000, false),
    policy("policy-d", "course-d", "D 2:1 90", 400000, true)
  ];
  const employees = new Map<string, any>([
    [firstEarcareId, employee(firstEarcareId, firstEarcareStaffCode, "귀케어2", firstEarcareSortOrder, "EARCARE")],
    [secondEarcareId, employee(secondEarcareId, secondEarcareStaffCode, "귀케어1", secondEarcareSortOrder, "EARCARE")],
    ["ear-3", employee("ear-3", "EAR-003", "귀케어3", 30, "EARCARE")],
    ["thr-1", employee("thr-1", "THR-001", "마사지사1", 1, "THERAPIST")],
    ["thr-2", employee("thr-2", "THR-002", "마사지사2", 2, "THERAPIST")]
  ]);
  const codeItems = [
    status("NORMAL", "정상", 10),
    status("DAY_OFF", "휴무", 20),
    status("LATE", "지각", 30)
  ];
  const attendances = new Map<string, any>([
    [attendanceKey(firstEarcareId), attendance("att-1", firstEarcareId, options.allExcluded ? "DAY_OFF" : "NORMAL")],
    [attendanceKey(secondEarcareId), attendance("att-2", secondEarcareId, options.allExcluded ? "LATE" : "NORMAL")],
    [attendanceKey("ear-3"), attendance("att-3", "ear-3", "DAY_OFF")]
  ]);
  const serviceCalls = [
    call("call-a", "course-a", "방문완료", [assignment("call-a", "THERAPIST_1", "thr-1")]),
    call("call-b", "course-b", "VISIT_COMPLETE", [assignment("call-b", "THERAPIST_1", "thr-1")]),
    call("call-zero", "course-c", "방문완료", [assignment("call-zero", "THERAPIST_1", "thr-1")]),
    call("call-reserved", "course-a", "예약", [assignment("call-reserved", "THERAPIST_1", "thr-1")]),
    call("call-no-policy", "course-no-policy", "방문완료", [assignment("call-no-policy", "THERAPIST_1", "thr-1")]),
    call("call-missing-rate", "course-a", "방문완료", [assignment("call-missing-rate", "THERAPIST_1", "thr-2")]),
    call("call-invalid-d", "course-d", "방문완료", [assignment("call-invalid-d", "THERAPIST_1", "thr-1")])
  ];
  const rates = [
    rate("rate-1-a", "thr-1", "course-a", 700000),
    rate("rate-1-b", "thr-1", "course-b", 900000),
    rate("rate-1-c", "thr-1", "course-c", 900000),
    rate("rate-1-d", "thr-1", "course-d", 900000)
  ];

  function course(id: string, codeValue: string) {
    return { id, code: codeValue, isActive: true, createdAt, updatedAt };
  }

  function policy(id: string, courseId: string, name: string, earcarePoolAmount: number, requiresSecondTherapist: boolean) {
    return {
      id,
      courseId,
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount,
      requiresSecondTherapist,
      tvDisplayName: name,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function employee(id: string, staffCode: string, displayName: string, sortOrder: number, employeeGroup: string) {
    return { id, staffCode, displayName, employeeGroup, position: employeeGroup, sortOrder, isActive: true, createdAt, updatedAt };
  }

  function status(code: string, displayName: string, sortOrder: number) {
    return { id: `status-${code}`, codeType: "ATTENDANCE_STATUS", code, displayName, sortOrder, isActive: true, createdAt, updatedAt };
  }

  function attendanceKey(employeeId: string) {
    return `${operatingMonth.id}::2026-06-10::${employeeId}`;
  }

  function attendance(id: string, employeeId: string, statusCode: string) {
    return {
      id,
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate("2026-06-10"),
      employeeId,
      statusCode,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function assignment(serviceCallId: string, assignmentRole: "THERAPIST_1" | "THERAPIST_2", employeeId: string) {
    return {
      id: `${serviceCallId}-${assignmentRole}`,
      serviceCallId,
      assignmentRole,
      employeeId,
      employee: employees.get(employeeId),
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function call(id: string, courseId: string, statusValue: string, assignments: any[]) {
    const serviceDate = options.outsideMonth ? dbDate("2026-07-01") : dbDate("2026-06-10");
    const courseRecord = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate,
      startTime: "11:00",
      roomId: room.id,
      room,
      courseId,
      course: courseRecord ? { ...courseRecord, policies: policies.filter((record) => record.courseId === courseId) } : undefined,
      customerMemo: id,
      status: statusValue,
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      note: null,
      confirmationCode: null,
      assignments,
      createdAt,
      updatedAt
    };
  }

  function rate(id: string, therapistId: string, courseId: string, amount: number) {
    return { id, therapistId, courseId, amount, effectiveFromMonth: "2026-06", effectiveToMonth: null, isActive: true, createdAt, updatedAt };
  }

  function sameDate(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter(
            (record) =>
              (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) &&
              (where?.isActive === undefined || record.isActive === where.isActive)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));
      }
    },
    codeItem: {
      async findMany({ where }: any = {}) {
        return codeItems
          .filter((record) => (where?.codeType === undefined || record.codeType === where.codeType) && (where?.isActive === undefined || record.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
    },
    earcareAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.attendanceDate === undefined || sameDate(record.attendanceDate, where.attendanceDate)) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return serviceCalls.filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.serviceDate === undefined || sameDate(record.serviceDate, where.serviceDate))
        );
      }
    },
    timeSlot: {
      async findMany() {
        return [{ value: "11:00", sortOrder: 10, isActive: true, createdAt, updatedAt }];
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return policies.filter((record) => (where?.courseId === undefined || record.courseId === where.courseId) && record.isActive === where.isActive);
      }
    },
    therapistCourseRate: {
      async findMany({ where }: any = {}) {
        return rates.filter(
          (record) =>
            (where?.therapistId === undefined ||
              record.therapistId === where.therapistId ||
              (Array.isArray(where.therapistId?.in) && where.therapistId.in.includes(record.therapistId))) &&
            (where?.courseId === undefined ||
              record.courseId === where.courseId ||
              (Array.isArray(where.courseId?.in) && where.courseId.in.includes(record.courseId))) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      }
    },
    dailyExpense: {
      async findMany() {
        return [];
      }
    }
  } as any;
}

describe("listEarcareDailySettlements", () => {
  it("sums calculated completed earcare pools and distributes remainder by sortOrder, staffCode, and Employee.id", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.earcarePoolTotal, 600001);
    assert.equal(result.sourceCallCount, 3);
    assert.equal(result.eligibleCount, 2);
    assert.equal(result.baseShareAmount, 300000);
    assert.equal(result.remainderAmount, 1);
    assert.equal(result.distributedAmount, 600001);
    assert.equal(result.undistributedAmount, 0);
    assert.deepEqual(result.warningCounts, {
      notCompleted: 1,
      coursePolicyMissing: 1,
      therapistRateMissing: 1,
      secondTherapistRequired: 1
    });
    assert.deepEqual(
      result.rows.map((row) => [
        row.employeeId,
        row.staffCode,
        row.statusDisplayName,
        row.isPayoutEligible,
        row.baseShareAmount,
        row.remainderShareAmount,
        row.payoutAmount,
        row.calculationBasis
      ]),
      [
        ["ear-2", "EAR-001", "정상", true, 300000, 1, 300001, "방문완료 풀 600001 VND / 정상 근무자 2명 + 잔여 1 VND 배분"],
        ["ear-1", "EAR-002", "정상", true, 300000, 0, 300000, "방문완료 풀 600001 VND / 정상 근무자 2명"],
        ["ear-3", "EAR-003", "휴무", false, 0, 0, 0, "휴무 제외"]
      ]
    );
    assert.deepEqual(
      result.poolEvidence.map((evidence) => [evidence.serviceCallId, evidence.serviceDate, evidence.earcarePoolAmount]),
      [
        ["call-a", "2026-06-10", 300001],
        ["call-b", "2026-06-10", 200000],
        ["call-zero", "2026-06-10", 100000]
      ]
    );
  });

  it("returns zero payouts and undistributed pool when no earcare employee is NORMAL and 근무상태 변경 반영 is visible", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ allExcluded: true })
    });

    assert.equal(result.eligibleCount, 0);
    assert.equal(result.distributedAmount, 0);
    assert.equal(result.undistributedAmount, 600001);
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
    assert.ok(result.rows.every((row) => row.calculationBasis.includes("정상 근무자 0명") || row.calculationBasis.includes("제외")));
  });

  it("uses Employee.id as the deterministic remainder tie-breaker after sortOrder and staffCode", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ employeeIdTieBreaker: true })
    });

    const firstByInputOrder = result.rows.find((row) => row.employeeId === "ear-z");
    const firstByEmployeeId = result.rows.find((row) => row.employeeId === "ear-a");
    assert.equal(result.remainderAmount, 1);
    assert.equal(firstByInputOrder?.remainderShareAmount, 0);
    assert.equal(firstByEmployeeId?.remainderShareAmount, 1);
  });

  it("keeps locked operating months readable", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ locked: true })
    });

    assert.equal(result.isLocked, true);
    assert.equal(result.distributedAmount, 600001);
  });

  it("rejects a service date outside the operating month range", async () => {
    await assert.rejects(
      listEarcareDailySettlements({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-07-01",
        prismaClient: createMemoryPrisma()
      }),
      (error) => error instanceof EarcareDailySettlementDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
  });
});
