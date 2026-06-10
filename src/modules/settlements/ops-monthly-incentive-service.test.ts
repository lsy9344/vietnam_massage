import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OpsMonthlyIncentiveDomainError,
  listOpsMonthlyIncentivePreview
} from "@/modules/settlements/ops-monthly-incentive-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(
  options: {
    monthStatus?: string;
    missingPolicy?: boolean;
    belowThreshold?: boolean;
    noOpsEmployees?: boolean;
    noCounterMembers?: boolean;
    duplicateLead?: boolean;
    malformedDateRange?: boolean;
    highThreshold?: boolean;
  } = {}
) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: options.malformedDateRange ? dbDate("2026-06-30") : dbDate("2026-06-01"),
    endDate: options.malformedDateRange ? dbDate("2026-06-01") : dbDate("2026-06-30"),
    status: options.monthStatus ?? "작성중",
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
  const completedCredit = options.belowThreshold ? 300 : options.highThreshold ? 900 : 500;
  const policies = [
    policy("policy-a", "course-a", "A 누루60", completedCredit, false),
    policy("policy-b", "course-b", "B 귀청소90", 350, false),
    policy("policy-c", "course-c", "C 때밀이90", 251, false),
    policy("policy-d", "course-d", "D 2:1 90", 10, true)
  ];
  const employees = new Map<string, any>(
    options.noOpsEmployees
      ? [["thr-1", employee("thr-1", "THR-001", "마사지사1", "마사지사", 10, "THERAPIST")]]
      : [
          ["ops-lead", employee("ops-lead", "OPS-LEAD-001", "운영팀장", "팀장", 1, "OPERATIONS")],
          ["ops-counter-day", employee("ops-counter-day", "OPS-COUNTER-DAY-001", "카운터1", "카운터", 2, "OPERATIONS")],
          ["ops-counter-night", employee("ops-counter-night", "OPS-COUNTER-NIGHT-001", "카운터2", "카운터", 3, "OPERATIONS")],
          ["ops-waiter-day", employee("ops-waiter-day", "OPS-WAITER-DAY-001", "웨이터1", "웨이터", 4, "OPERATIONS")],
          ["ops-waiter-night", employee("ops-waiter-night", "OPS-WAITER-NIGHT-001", "웨이터2", "웨이터", 5, "OPERATIONS")],
          ...(options.duplicateLead
            ? [["ops-lead-2", employee("ops-lead-2", "OPS-LEAD-002", "부팀장", "팀장", 6, "OPERATIONS")] as const]
            : []),
          ["thr-1", employee("thr-1", "THR-001", "마사지사1", "마사지사", 10, "THERAPIST")],
          ["thr-2", employee("thr-2", "THR-002", "마사지사2", "마사지사", 11, "THERAPIST")]
        ]
  );
  if (options.noCounterMembers) {
    employees.set("ops-counter-day", { ...employees.get("ops-counter-day"), position: "지원", staffCode: "OPS-SUPPORT-001" });
    employees.set("ops-counter-night", { ...employees.get("ops-counter-night"), position: "지원", staffCode: "OPS-SUPPORT-002" });
  }
  const serviceCalls = [
    call("call-a", "course-a", "VISIT_COMPLETE", "2026-06-01", [assignment("call-a", "THERAPIST_1", "thr-1")]),
    call("call-b", "course-b", "방문완료", "2026-06-15", [assignment("call-b", "THERAPIST_1", "thr-1")]),
    call("call-c", "course-c", "VISIT_COMPLETE", "2026-06-30", [assignment("call-c", "THERAPIST_1", "thr-1")]),
    call("call-reserved", "course-a", "예약", "2026-06-10", [assignment("call-reserved", "THERAPIST_1", "thr-1")]),
    call("call-no-policy", "course-no-policy", "방문완료", "2026-06-10", [assignment("call-no-policy", "THERAPIST_1", "thr-1")]),
    call("call-missing-rate", "course-a", "방문완료", "2026-06-10", [assignment("call-missing-rate", "THERAPIST_1", "thr-2")]),
    call("call-invalid-d", "course-d", "방문완료", "2026-06-10", [assignment("call-invalid-d", "THERAPIST_1", "thr-1")])
  ];
  const rates = [
    rate("rate-1-a", "thr-1", "course-a", 700000),
    rate("rate-1-b", "thr-1", "course-b", 900000),
    rate("rate-1-c", "thr-1", "course-c", 900000),
    rate("rate-1-d", "thr-1", "course-d", 900000)
  ];
  const monthlyRules = options.missingPolicy
    ? []
    : [
        monthlyRule("rule-1000-old", 1000, 3000001, "2026-01", 0.3, 0.35, 0.35),
        monthlyRule("rule-1000", 1000, 3000003, "2026-06", 0.3, 0.35, 0.35),
        monthlyRule("rule-1100", 1100, 5000000, "2026-06", 0.3, 0.35, 0.35),
        monthlyRule("rule-1200", 1200, 8000000, "2026-06", 0.3, 0.35, 0.35),
        monthlyRule("rule-1300", 1300, 12000000, "2026-06", 0.3, 0.35, 0.35),
        monthlyRule("rule-1400", 1400, 18000000, "2026-06", 0.3, 0.35, 0.35),
        monthlyRule("rule-1500", 1500, 25000000, "2026-06", 0.3, 0.35, 0.35),
        { ...monthlyRule("rule-expired", 900, 9999999, "2025-01", 0.3, 0.35, 0.35), effectiveToMonth: "2025-12" }
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

  function call(id: string, courseId: string, statusValue: string, serviceDate: string, assignments: any[]) {
    const courseRecord = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate: dbDate(serviceDate),
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

  function monthlyRule(
    id: string,
    thresholdCallCount: number,
    totalAmount: number,
    effectiveFromMonth: string,
    leadShare: number,
    counterTeamShare: number,
    waiterTeamShare: number
  ) {
    return {
      id,
      thresholdCallCount,
      totalAmount,
      leadShare,
      counterTeamShare,
      waiterTeamShare,
      effectiveFromMonth,
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
          .filter(
            (record) =>
              (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) &&
              (where?.isActive === undefined || record.isActive === where.isActive)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.id.localeCompare(b.id));
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return serviceCalls.filter((record) => {
          const lowerBound = where?.serviceDate?.gte;
          const upperBound = where?.serviceDate?.lte;
          return (
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.serviceDate === undefined ||
              (where.serviceDate instanceof Date && sameDate(record.serviceDate, where.serviceDate)) ||
              ((!lowerBound || record.serviceDate >= lowerBound) && (!upperBound || record.serviceDate <= upperBound)))
          );
        });
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
    opsMonthlyIncentiveRule: {
      async findMany({ where }: any = {}) {
        return monthlyRules.filter((record) => where?.isActive === undefined || record.isActive === where.isActive);
      }
    }
  } as any;
}

describe("listOpsMonthlyIncentivePreview", () => {
  it("sums monthly calculated opsCallCredit, applies the highest effective threshold, and splits by stable Employee.id row keys", async () => {
    const result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.monthlyOpsCallCredit, 1101);
    assert.equal(result.sourceCallCount, 3);
    assert.equal(result.ruleStatus, "applied");
    assert.equal(result.appliedThresholdCallCount, 1100);
    assert.equal(result.totalMonthlyIncentiveAmount, 5000000);
    assert.equal(result.previewStatus, "draft_current");
    assert.deepEqual(result.warningCounts, {
      notCompleted: 1,
      coursePolicyMissing: 1,
      therapistRateMissing: 1,
      secondTherapistRequired: 1
    });
    assert.deepEqual(
      result.rows.map((row) => [row.employeeId, row.staffCode, row.teamRole, row.payoutAmount, row.calculationBasis]),
      [
        ["ops-lead", "OPS-LEAD-001", "lead", 1500000, "팀장 몫 1500000 VND"],
        ["ops-counter-day", "OPS-COUNTER-DAY-001", "counter", 875000, "카운터팀 몫 1750000 VND / 2명"],
        ["ops-counter-night", "OPS-COUNTER-NIGHT-001", "counter", 875000, "카운터팀 몫 1750000 VND / 2명"],
        ["ops-waiter-day", "OPS-WAITER-DAY-001", "waiter", 875000, "웨이터팀 몫 1750000 VND / 2명"],
        ["ops-waiter-night", "OPS-WAITER-NIGHT-001", "waiter", 875000, "웨이터팀 몫 1750000 VND / 2명"]
      ]
    );
    assert.deepEqual(
      result.callEvidence.map((evidence) => [evidence.serviceCallId, evidence.serviceDate, evidence.opsCallCredit]),
      [
        ["call-a", "2026-06-01", 500],
        ["call-b", "2026-06-15", 350],
        ["call-c", "2026-06-30", 251]
      ]
    );
  });

  it("selects the highest satisfied seed threshold through the 1500-call monthly incentive band", async () => {
    const result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ highThreshold: true })
    });

    assert.equal(result.monthlyOpsCallCredit, 1501);
    assert.equal(result.appliedThresholdCallCount, 1500);
    assert.equal(result.totalMonthlyIncentiveAmount, 25000000);
  });

  it("uses deterministic integer VND remainders for team shares and internal member allocation", async () => {
    const result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.shares.leadAmount, 1500000);
    assert.equal(result.shares.counterTeamAmount, 1750000);
    assert.equal(result.shares.waiterTeamAmount, 1750000);
    assert.equal(result.shares.undistributedAmount, 0);
    assert.equal(result.rows.reduce((sum, row) => sum + row.payoutAmount, 0), 5000000);
  });

  it("returns below_threshold and zero payout when monthly ops call credit is below the minimum policy threshold", async () => {
    const result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ belowThreshold: true })
    });

    assert.equal(result.monthlyOpsCallCredit, 901);
    assert.equal(result.ruleStatus, "below_threshold");
    assert.equal(result.appliedThresholdCallCount, null);
    assert.equal(result.totalMonthlyIncentiveAmount, 0);
    assert.ok(result.warningMessage?.includes("1000콜 미만"));
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
  });

  it("returns missing_policy warning instead of silently assuming zero when no monthly incentive rule exists", async () => {
    const result = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ missingPolicy: true })
    });

    assert.equal(result.ruleStatus, "missing_policy");
    assert.equal(result.appliedThresholdCallCount, null);
    assert.equal(result.totalMonthlyIncentiveAmount, 0);
    assert.ok(result.warningMessage?.includes("정책"));
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
  });

  it("keeps closed and locked months readable as current preview, and validates input/month lookup/date range", async () => {
    const closed = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ monthStatus: "마감확정" })
    });
    assert.equal(closed.isClosedOrLocked, true);
    assert.equal(closed.previewStatus, "closed_current");

    const locked = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ monthStatus: "잠금" })
    });
    assert.equal(locked.isClosedOrLocked, true);
    assert.equal(locked.previewStatus, "closed_current");
    assert.equal(locked.totalMonthlyIncentiveAmount, 5000000);

    await assert.rejects(
      listOpsMonthlyIncentivePreview({ operatingMonthId: "", prismaClient: createMemoryPrisma() }),
      (error) => error instanceof OpsMonthlyIncentiveDomainError && error.code === "INVALID_OPS_MONTHLY_INCENTIVE_INPUT"
    );
    await assert.rejects(
      listOpsMonthlyIncentivePreview({ operatingMonthId: "missing-month", prismaClient: createMemoryPrisma() }),
      (error) => error instanceof OpsMonthlyIncentiveDomainError && error.code === "OPERATING_MONTH_NOT_FOUND"
    );
    await assert.rejects(
      listOpsMonthlyIncentivePreview({ operatingMonthId: "month-2026-06", prismaClient: createMemoryPrisma({ malformedDateRange: true }) }),
      (error) => error instanceof OpsMonthlyIncentiveDomainError && error.code === "INVALID_OPERATING_MONTH_DATE_RANGE"
    );
  });

  it("warns on missing team members or ambiguous leads while keeping deterministic distribution results", async () => {
    const noCounter = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ noCounterMembers: true })
    });
    assert.equal(noCounter.shares.undistributedAmount, 1750000);
    assert.ok(noCounter.warningMessage?.includes("카운터팀"));
    assert.ok(noCounter.rows.filter((row) => row.teamRole === "counter").every((row) => row.payoutAmount === 0));

    const duplicateLead = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ duplicateLead: true })
    });
    assert.ok(duplicateLead.warningMessage?.includes("팀장"));
    assert.equal(duplicateLead.rows.filter((row) => row.teamRole === "lead" && row.payoutAmount > 0).length, 1);

    const noEmployees = await listOpsMonthlyIncentivePreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createMemoryPrisma({ noOpsEmployees: true })
    });
    assert.equal(noEmployees.rows.length, 0);
    assert.equal(noEmployees.shares.undistributedAmount, 5000000);
    assert.ok(noEmployees.warningMessage?.includes("운영팀 직원"));
  });
});
