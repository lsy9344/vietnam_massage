import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OpsDailyIncentiveDomainError,
  listOpsDailyIncentives
} from "@/modules/settlements/ops-daily-incentive-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(options: { locked?: boolean; missingPolicy?: boolean; belowThreshold?: boolean; allExcluded?: boolean } = {}) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
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
    ["course-d", course("course-d", "D")],
    ["course-no-policy", course("course-no-policy", "A")]
  ]);
  const policies = [
    policy("policy-a", "course-a", "A 누루60", options.belowThreshold ? 10 : 20, false),
    policy("policy-b", "course-b", "B 귀청소90", options.belowThreshold ? 10 : 20, false),
    policy("policy-d", "course-d", "D 2:1 90", 10, true)
  ];
  const employees = new Map<string, any>([
    ["ops-lead", employee("ops-lead", "OPS-LEAD-001", "팀장", "팀장", 1, "OPERATIONS")],
    ["ops-counter-day", employee("ops-counter-day", "OPS-COUNTER-DAY-001", "카운터1", "카운터", 2, "OPERATIONS")],
    ["ops-counter-night", employee("ops-counter-night", "OPS-COUNTER-NIGHT-001", "카운터2", "카운터", 3, "OPERATIONS")],
    ["ops-waiter-day", employee("ops-waiter-day", "OPS-WAITER-DAY-001", "웨이터1", "웨이터", 4, "OPERATIONS")],
    ["ops-waiter-night", employee("ops-waiter-night", "OPS-WAITER-NIGHT-001", "웨이터2", "웨이터", 5, "OPERATIONS")],
    ["thr-1", employee("thr-1", "THR-001", "마사지사1", "마사지사", 10, "THERAPIST")],
    ["thr-2", employee("thr-2", "THR-002", "마사지사2", "마사지사", 11, "THERAPIST")]
  ]);
  const codeItems = [
    status("NORMAL", "정상", 10),
    status("DAY_OFF", "휴무", 20),
    status("LATE", "지각", 30),
    status("ABSENT", "결근", 50)
  ];
  const attendances = new Map<string, any>([
    [attendanceKey("ops-lead"), attendance("att-1", "ops-lead", options.allExcluded ? "DAY_OFF" : "NORMAL")],
    [attendanceKey("ops-counter-day"), attendance("att-2", "ops-counter-day", options.allExcluded ? "LATE" : "NORMAL")],
    [attendanceKey("ops-counter-night"), attendance("att-3", "ops-counter-night", "DAY_OFF")],
    [attendanceKey("ops-waiter-day"), attendance("att-4", "ops-waiter-day", "LATE")]
  ]);
  const serviceCalls = [
    call("call-a", "course-a", "방문완료", [assignment("call-a", "THERAPIST_1", "thr-1")]),
    call("call-b", "course-b", "VISIT_COMPLETE", [assignment("call-b", "THERAPIST_1", "thr-1")]),
    call("call-reserved", "course-a", "예약", [assignment("call-reserved", "THERAPIST_1", "thr-1")]),
    call("call-no-policy", "course-no-policy", "방문완료", [assignment("call-no-policy", "THERAPIST_1", "thr-1")]),
    call("call-missing-rate", "course-a", "방문완료", [assignment("call-missing-rate", "THERAPIST_1", "thr-2")]),
    call("call-invalid-d", "course-d", "방문완료", [assignment("call-invalid-d", "THERAPIST_1", "thr-1")])
  ];
  const rates = [
    rate("rate-1-a", "thr-1", "course-a", 700000),
    rate("rate-1-b", "thr-1", "course-b", 900000),
    rate("rate-1-d", "thr-1", "course-d", 900000)
  ];
  const dailyRules = options.missingPolicy
    ? []
    : [
        rule("rule-30", 30, 50000),
        rule("rule-40", 40, 100000),
        rule("rule-50", 50, 200000),
        { ...rule("rule-old", 10, 999999), effectiveToMonth: "2026-05" }
      ];

  function course(id: string, codeValue: string) {
    return { id, code: codeValue, isActive: true, createdAt, updatedAt };
  }

  function policy(id: string, courseId: string, name: string, opsCallCredit: number, requiresSecondTherapist: boolean) {
    return {
      id,
      courseId,
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice: 1500000,
      opsCallCredit,
      earcarePoolAmount: 0,
      requiresSecondTherapist,
      tvDisplayName: name,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function employee(id: string, staffCode: string, displayName: string, position: string, sortOrder: number, employeeGroup: string) {
    return { id, staffCode, displayName, employeeGroup, position, sortOrder, isActive: true, createdAt, updatedAt };
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
    const courseRecord = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate: dbDate("2026-06-10"),
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

  function rule(id: string, thresholdCallCount: number, personalAmount: number) {
    return {
      id,
      thresholdCallCount,
      personalAmount,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt,
      updatedAt
    };
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
          .filter((record) => (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) && (where?.isActive === undefined || record.isActive === where.isActive))
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
    opsAttendance: {
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
    },
    opsDailyIncentiveRule: {
      async findMany({ where }: any = {}) {
        return dailyRules.filter((record) => where?.isActive === undefined || record.isActive === where.isActive);
      }
    }
  } as any;
}

describe("listOpsDailyIncentives", () => {
  it("sums calculated completed opsCallCredit and applies the highest satisfied 30/40/50 threshold to NORMAL operations employees only", async () => {
    const result = await listOpsDailyIncentives({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.dailyOpsCallCredit, 40);
    assert.equal(result.sourceCallCount, 2);
    assert.equal(result.ruleStatus, "applied");
    assert.equal(result.appliedThresholdCallCount, 40);
    assert.equal(result.personalIncentiveAmount, 100000);
    assert.equal(result.eligibleCount, 3);
    assert.equal(result.distributedAmount, 300000);
    assert.deepEqual(result.warningCounts, {
      notCompleted: 1,
      coursePolicyMissing: 1,
      therapistRateMissing: 1,
      secondTherapistRequired: 1
    });
    assert.deepEqual(
      result.rows.map((row) => [row.staffCode, row.statusDisplayName, row.isPayoutEligible, row.payoutAmount, row.exclusionReason]),
      [
        ["OPS-LEAD-001", "정상", true, 100000, null],
        ["OPS-COUNTER-DAY-001", "정상", true, 100000, null],
        ["OPS-COUNTER-NIGHT-001", "휴무", false, 0, "휴무"],
        ["OPS-WAITER-DAY-001", "지각", false, 0, "지각"],
        ["OPS-WAITER-NIGHT-001", "정상", true, 100000, null]
      ]
    );
    assert.deepEqual(
      result.callEvidence.map((evidence) => [evidence.serviceCallId, evidence.serviceDate, evidence.opsCallCredit]),
      [
        ["call-a", "2026-06-10", 20],
        ["call-b", "2026-06-10", 20]
      ]
    );
  });

  it("returns below_threshold with zero payout when daily ops call credit is under 30", async () => {
    const result = await listOpsDailyIncentives({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ belowThreshold: true })
    });

    assert.equal(result.dailyOpsCallCredit, 20);
    assert.equal(result.ruleStatus, "below_threshold");
    assert.equal(result.appliedThresholdCallCount, null);
    assert.equal(result.personalIncentiveAmount, 0);
    assert.equal(result.distributedAmount, 0);
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
  });

  it("returns missing_policy warning instead of silently assuming zero when no active daily incentive rule exists", async () => {
    const result = await listOpsDailyIncentives({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ missingPolicy: true })
    });

    assert.equal(result.ruleStatus, "missing_policy");
    assert.equal(result.appliedThresholdCallCount, null);
    assert.equal(result.personalIncentiveAmount, 0);
    assert.equal(result.distributedAmount, 0);
    assert.ok(result.warningMessage?.includes("정책"));
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
  });

  it("keeps locked operating months readable and rejects service dates outside the operating month range", async () => {
    const locked = await listOpsDailyIncentives({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ locked: true })
    });
    assert.equal(locked.isLocked, true);
    assert.equal(locked.distributedAmount, 300000);

    await assert.rejects(
      listOpsDailyIncentives({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-07-01",
        prismaClient: createMemoryPrisma()
      }),
      (error) => error instanceof OpsDailyIncentiveDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
  });
});
