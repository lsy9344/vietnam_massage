import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DashboardQueryDomainError,
  getDashboardGraphReport,
  getMonthlyDashboardMetrics,
  getTodayDashboardMetrics
} from "@/modules/dashboard/dashboard-query-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const createdAt = new Date("2026-06-10T00:00:00.000Z");
const updatedAt = new Date("2026-06-10T00:10:00.000Z");

function createDashboardPrisma(options: { operatingMonthMissing?: boolean; noCalls?: boolean; operatingMonthStatus?: string } = {}) {
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.operatingMonthStatus ?? "작성중",
    createdAt,
    updatedAt
  };
  const room = { id: "room-101", displayName: "101 호실", isActive: true, createdAt, updatedAt };
  const courses = new Map<string, any>([
    ["course-a", { id: "course-a", code: "A", isActive: true, createdAt, updatedAt }],
    ["course-b", { id: "course-b", code: "B", isActive: true, createdAt, updatedAt }],
    ["course-c", { id: "course-c", code: "C", isActive: true, createdAt, updatedAt }],
    ["course-d", { id: "course-d", code: "D", isActive: true, createdAt, updatedAt }],
    ["course-e", { id: "course-e", code: "E", isActive: true, createdAt, updatedAt }]
  ]);
  const policies = [
    policy("policy-a", "course-a", "A 누루60", 1500000, 100000, false),
    policy("policy-b", "course-b", "B 귀청소90", 1800000, 200000, false),
    policy("policy-c", "course-c", "C 때밀이90", 2000000, 0, false),
    policy("policy-d", "course-d", "D 2:1 90", 3200000, 0, true),
    policy("policy-e", "course-e", "E 풀코스120", 3000000, 0, false)
  ];
  const employees = new Map<string, any>([
    ["therapist-1", employee("therapist-1", "마사지사1", "THR-001", 1)],
    ["therapist-2", employee("therapist-2", "마사지사2", "THR-002", 2)]
  ]);
  const rates = [
    rate("rate-t1-a", "therapist-1", "course-a", 700000),
    rate("rate-t1-b", "therapist-1", "course-b", 900000),
    rate("rate-t1-c", "therapist-1", "course-c", 900000),
    rate("rate-t1-d", "therapist-1", "course-d", 900000),
    rate("rate-t1-e", "therapist-1", "course-e", 0),
    rate("rate-t2-d", "therapist-2", "course-d", 900000)
  ];
  const serviceCalls = options.noCalls
    ? []
    : [
        call("call-reserved", "course-a", "예약", [assignment("call-reserved", "THERAPIST_1", "therapist-1")]),
        call("call-complete-a", "course-a", "VISIT_COMPLETE", [assignment("call-complete-a", "THERAPIST_1", "therapist-1")], "생일자"),
        call("call-complete-b-same", "course-b", "방문완료", [
          assignment("call-complete-b-same", "THERAPIST_1", "therapist-1"),
          assignment("call-complete-b-same", "THERAPIST_2", "therapist-1")
        ]),
        call("call-complete-d", "course-d", "VISIT_COMPLETE", [
          assignment("call-complete-d", "THERAPIST_1", "therapist-1"),
          assignment("call-complete-d", "THERAPIST_2", "therapist-2")
        ]),
        call("call-missing-rate", "course-c", "VISIT_COMPLETE", [assignment("call-missing-rate", "THERAPIST_1", "therapist-2")]),
        call("call-invalid-d", "course-d", "VISIT_COMPLETE", [assignment("call-invalid-d", "THERAPIST_1", "therapist-1")]),
        call("call-e", "course-e", "방문완료", [assignment("call-e", "THERAPIST_1", "therapist-1")]),
        call("call-noshow", "course-a", "노쇼", [assignment("call-noshow", "THERAPIST_1", "therapist-1")]),
        call("call-canceled", "course-a", "CANCELED", [assignment("call-canceled", "THERAPIST_1", "therapist-1")])
      ];
  const expenses = [
    {
      id: "expense-1",
      operatingMonthId: operatingMonth.id,
      expenseDate: dbDate("2026-06-10"),
      amount: 300000,
      description: "소모품",
      handledByEmployeeId: "therapist-1",
      note: null,
      isActive: true,
      createdAt,
      updatedAt
    }
  ];

  function policy(id: string, courseId: string, name: string, basePrice: number, earcarePoolAmount: number, requiresSecondTherapist: boolean) {
    return {
      id,
      courseId,
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice,
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

  function employee(id: string, displayName: string, staffCode: string, sortOrder: number) {
    return { id, displayName, staffCode, employeeGroup: "THERAPIST", sortOrder, isActive: true, createdAt, updatedAt };
  }

  function rate(id: string, therapistId: string, courseId: string, amount: number) {
    return { id, therapistId, courseId, amount, effectiveFromMonth: "2026-06", effectiveToMonth: null, isActive: true, createdAt, updatedAt };
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

  function call(id: string, courseId: string, status: string, assignments: any[], discountTypeCode: string | null = null) {
    const course = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate: dbDate("2026-06-10"),
      startTime: "11:00",
      roomId: room.id,
      room,
      courseId,
      course: { ...course, policies: policies.filter((record) => record.courseId === courseId) },
      customerMemo: id,
      status,
      discountTypeCode,
      paymentMethodCode: "CASH",
      note: null,
      confirmationCode: null,
      assignments,
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
        if (options.operatingMonthMissing) return null;
        return where.id === operatingMonth.id ? operatingMonth : null;
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
    dailyExpense: {
      async findMany({ where }: any = {}) {
        return expenses
          .filter(
            (expense) =>
              (where?.operatingMonthId === undefined || expense.operatingMonthId === where.operatingMonthId) &&
              (where?.expenseDate === undefined || sameDate(expense.expenseDate, where.expenseDate)) &&
              (where?.isActive === undefined || expense.isActive === where.isActive)
          )
          .map((expense) => ({ ...expense, handledByEmployee: employees.get(expense.handledByEmployeeId) }));
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
              (Array.isArray(where?.therapistId?.in) && where.therapistId.in.includes(record.therapistId))) &&
            (where?.courseId === undefined ||
              record.courseId === where.courseId ||
              (Array.isArray(where?.courseId?.in) && where.courseId.in.includes(record.courseId))) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
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
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
    }
  } as any;
}

describe("getTodayDashboardMetrics", () => {
  it("오늘 KPI DTO는 예약/방문완료/노쇼/취소, 비완료 금액 제외, 담당콜, 코스, warning을 조립한다", async () => {
    const result = await getTodayDashboardMetrics({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createDashboardPrisma()
    });

    assert.deepEqual(result.statusCounts, {
      reservation: 1,
      inUse: 0,
      cleaning: 0,
      completed: 6,
      noShow: 1,
      canceled: 1
    });
    assert.deepEqual(result.financials, {
      paymentTotal: 9400000,
      netSales: 9100000,
      discountTotal: 100000,
      expenseTotal: 300000,
      earcarePoolTotal: 300000,
      therapistCommissionTotal: 4300000
    });
    assert.equal(result.therapistSummary.totalAssignedCallCount, 7);
    assert.equal(result.therapistSummary.totalCommissionAmount, 4300000);
    assert.equal(result.therapistSummary.therapists.find((therapist) => therapist.employeeId === "therapist-1")?.totalAssignedCallCount, 5);
    assert.equal(result.therapistSummary.therapists.find((therapist) => therapist.employeeId === "therapist-2")?.totalAssignedCallCount, 2);
    assert.deepEqual(
      result.courseCompletions.map((course) => [course.courseCode, course.completedCount, course.therapistAssignmentCount]),
      [
        ["A", 1, 1],
        ["B", 1, 2],
        ["C", 0, 0],
        ["D", 1, 2],
        ["E", 1, 1]
      ]
    );
    assert.deepEqual(result.warningCounts, {
      coursePolicyMissing: 0,
      therapistRateMissing: 1,
      secondTherapistRequired: 1,
      settlementExcludedCallCount: 4
    });
    assert.equal(result.emptyState.kind, "warnings_excluded");
    assert.equal(result.sourceBasis.callLedgerSummary, "getDailyCallLedgerSummary");
    assert.equal(result.sourceBasis.therapistDailySettlements, "listTherapistDailySettlements");
    assert.equal(result.sourceBasis.readOnly, true);
  });

  it("운영월 범위 밖 날짜는 한국어 domain error로 차단한다", async () => {
    await assert.rejects(
      getTodayDashboardMetrics({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-07-01",
        prismaClient: createDashboardPrisma()
      }),
      (error) =>
        error instanceof DashboardQueryDomainError &&
        error.code === "DASHBOARD_DATE_OUT_OF_RANGE" &&
        error.message === "조회 날짜가 선택한 운영월 범위를 벗어났습니다."
    );
  });

  it("조회 날짜 형식 오류는 한국어 domain error로 차단한다", async () => {
    await assert.rejects(
      getTodayDashboardMetrics({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026/06/10",
        prismaClient: createDashboardPrisma()
      }),
      (error) =>
        error instanceof DashboardQueryDomainError &&
        error.code === "INVALID_DASHBOARD_QUERY" &&
        error.message === "조회 날짜는 YYYY-MM-DD 형식이어야 합니다."
    );
  });

  it("없는 운영월은 한국어 domain error로 차단한다", async () => {
    await assert.rejects(
      getTodayDashboardMetrics({
        operatingMonthId: "missing-month",
        serviceDate: "2026-06-10",
        prismaClient: createDashboardPrisma({ operatingMonthMissing: true })
      }),
      (error) =>
        error instanceof DashboardQueryDomainError &&
        error.code === "DASHBOARD_OPERATING_MONTH_NOT_FOUND" &&
        error.message === "운영월을 찾을 수 없습니다."
    );
  });

  it("콜이 없는 날짜는 0값 KPI와 명확한 empty state를 반환한다", async () => {
    const result = await getTodayDashboardMetrics({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createDashboardPrisma({ noCalls: true })
    });

    assert.deepEqual(result.statusCounts, {
      reservation: 0,
      inUse: 0,
      cleaning: 0,
      completed: 0,
      noShow: 0,
      canceled: 0
    });
    assert.equal(result.financials.paymentTotal, 0);
    assert.equal(result.therapistSummary.totalAssignedCallCount, 0);
    assert.equal(result.emptyState.kind, "no_calls");
    assert.equal(result.emptyState.message, "이 날짜의 콜이 없습니다.");
  });
});

function monthlyPreview(overrides: any = {}) {
  return {
    operatingMonthId: "month-2026-06",
    monthKey: "2026-06",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "작성중",
    previewStatus: "draft_current",
    therapists: { rows: [], payoutAmount: 4300000, totalCallCount: 7 },
    operations: {
      dailyIncentiveAmount: 100000,
      monthlyIncentiveAmount: 200000,
      totalOpsPayoutAmount: 300000,
      monthlyOpsCallCredit: 4,
      appliedThresholdCallCount: null,
      ruleStatus: "not_applicable",
      warningMessages: [],
      rows: []
    },
    earcare: {
      earcarePoolTotal: 300000,
      distributedAmount: 300000,
      undistributedAmount: 0,
      sourceCallCount: 2,
      eligibleDayCount: 1,
      rows: []
    },
    totals: {
      therapistPayoutAmount: 4300000,
      opsDailyIncentiveAmount: 100000,
      opsMonthlyIncentiveAmount: 200000,
      earcarePayoutAmount: 300000,
      grandPayoutAmount: 4900000
    },
    warningCounts: {
      total: 0
    },
    evidence: {
      period: "2026-06-01~2026-06-30",
      sourceDayCount: 30,
      includedCallCount: 4,
      excludedCallCount: 2,
      warningCount: 0,
      representativeEvidence: {
        therapist: [],
        operationsDaily: [],
        operationsMonthly: [],
        earcare: []
      }
    },
    ...overrides
  };
}

function monthlySnapshot(overrides: any = {}) {
  return {
    id: "closing-2",
    operatingMonthId: "month-2026-06",
    closeVersion: 2,
    status: "마감확정",
    confirmedByAccountId: "admin-1",
    confirmedAt: "2026-06-30T15:00:00.000Z",
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    snapshot: {
      id: "closing-2",
      month: {
        operatingMonthId: "month-2026-06",
        monthKey: "2026-06",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        statusAtConfirmation: "검토중",
        confirmedStatus: "마감확정",
        confirmedAt: "2026-06-30T15:00:00.000Z",
        confirmedByAccountId: "admin-1"
      },
      therapists: { rows: [], payoutAmount: 9100000, totalCallCount: 12 },
      operations: {
        dailyIncentiveAmount: 300000,
        monthlyIncentiveAmount: 500000,
        totalOpsPayoutAmount: 800000,
        monthlyOpsCallCredit: 12,
        appliedThresholdCallCount: null,
        ruleStatus: "not_applicable",
        warningMessages: [],
        rows: []
      },
      earcare: {
        earcarePoolTotal: 600000,
        distributedAmount: 600000,
        undistributedAmount: 0,
        sourceCallCount: 4,
        eligibleDayCount: 2,
        rows: []
      },
      totals: {
        therapistPayoutAmount: 9100000,
        opsDailyIncentiveAmount: 300000,
        opsMonthlyIncentiveAmount: 500000,
        earcarePayoutAmount: 600000,
        grandPayoutAmount: 10500000
      },
      warningCounts: { total: 1 },
      evidence: {
        period: "2026-06-01~2026-06-30",
        sourceDayCount: 30,
        includedCallCount: 12,
        excludedCallCount: 1,
        warningCount: 1,
        representativeEvidence: {
          therapist: [],
          operationsDaily: [],
          operationsMonthly: [],
          earcare: []
        }
      },
      source: {
        serviceVersion: "monthly-closing-service:5.3",
        previewBasis: "listMonthlyClosingPreview",
        snapshotCreatedAt: "2026-06-30T15:00:00.000Z"
      }
    },
    ...overrides
  };
}

describe("getMonthlyDashboardMetrics", () => {
  it("운영월 날짜 범위 전체를 누적하고 완료 calculated 콜만 금액/코스 집계에 포함한다", async () => {
    const result = await getMonthlyDashboardMetrics({
      operatingMonthId: "month-2026-06",
      prismaClient: createDashboardPrisma(),
      dependencies: {
        listMonthlyClosingPreview: async () => monthlyPreview()
      }
    });

    assert.deepEqual(result.statusCounts, {
      reservation: 1,
      inUse: 0,
      cleaning: 0,
      completed: 6,
      noShow: 1,
      canceled: 1
    });
    assert.equal(result.financials.paymentTotal, 9400000);
    assert.equal(result.financials.discountTotal, 100000);
    assert.deepEqual(
      result.courseCompletions.map((course) => [course.courseCode, course.completedCount, course.therapistAssignmentCount]),
      [
        ["A", 1, 1],
        ["B", 1, 2],
        ["C", 0, 0],
        ["D", 1, 2],
        ["E", 1, 1]
      ]
    );
    assert.deepEqual(result.warningCounts.callLedger, {
      coursePolicyMissing: 0,
      therapistRateMissing: 1,
      secondTherapistRequired: 1
    });
    assert.equal(result.sourceBasis.kind, "current_recalculation");
    assert.equal(result.sourceBasis.label, "미확정 현재 기준");
    assert.equal(result.settlementSummary?.grandPayoutAmount, 4900000);
    assert.equal(result.emptyState.kind, "warnings_excluded");
  });

  it("마감확정/잠금 운영월은 latest closing snapshot을 지급 기준 source로 사용한다", async () => {
    const result = await getMonthlyDashboardMetrics({
      operatingMonthId: "month-2026-06",
      prismaClient: createDashboardPrisma({ operatingMonthStatus: "마감확정" }),
      dependencies: {
        getMonthlyClosingSnapshot: async () => monthlySnapshot()
      }
    });

    assert.equal(result.sourceBasis.kind, "closed_snapshot");
    assert.equal(result.sourceBasis.label, "확정 스냅샷 기준");
    assert.equal(result.sourceBasis.closeVersion, 2);
    assert.equal(result.sourceBasis.confirmedAt, "2026-06-30T15:00:00.000Z");
    assert.equal(result.settlementSummary?.grandPayoutAmount, 10500000);
    assert.equal(result.snapshot?.kind, "latest");
    assert.equal(result.snapshot?.closeVersion, 2);
  });

  it("마감확정/잠금 운영월에서 snapshot이 없으면 current 지급값으로 fallback하지 않는다", async () => {
    const result = await getMonthlyDashboardMetrics({
      operatingMonthId: "month-2026-06",
      prismaClient: createDashboardPrisma({ operatingMonthStatus: "잠금" }),
      dependencies: {
        getMonthlyClosingSnapshot: async () => {
          const error = new Error("확정 스냅샷을 찾을 수 없습니다.");
          (error as any).code = "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND";
          throw error;
        },
        listMonthlyClosingPreview: async () => monthlyPreview({ totals: { grandPayoutAmount: 999999999 } })
      }
    });

    assert.equal(result.sourceBasis.kind, "snapshot_missing");
    assert.equal(result.sourceBasis.label, "확정 스냅샷을 찾을 수 없습니다");
    assert.equal(result.settlementSummary, null);
    assert.equal(result.snapshot, null);
    assert.equal(result.emptyState.kind, "snapshot_missing");
  });

  it("재오픈되어 검토중인 운영월은 current source를 사용하고 이전 snapshot은 참고 정보로만 분리한다", async () => {
    const result = await getMonthlyDashboardMetrics({
      operatingMonthId: "month-2026-06",
      prismaClient: createDashboardPrisma({ operatingMonthStatus: "검토중" }),
      dependencies: {
        listMonthlyClosingPreview: async () => monthlyPreview({ status: "검토중" }),
        getMonthlyClosingSnapshot: async () => monthlySnapshot({ closeVersion: 1 })
      }
    });

    assert.equal(result.sourceBasis.kind, "current_recalculation");
    assert.equal(result.sourceBasis.label, "미확정 현재 기준");
    assert.equal(result.settlementSummary?.grandPayoutAmount, 4900000);
    assert.equal(result.snapshot?.kind, "previous");
    assert.equal(result.snapshot?.label, "이전 확정 스냅샷");
    assert.equal(result.snapshot?.closeVersion, 1);
  });

  it("잘못된 운영월 입력은 한국어 domain error로 차단한다", async () => {
    await assert.rejects(
      getMonthlyDashboardMetrics({
        operatingMonthId: "",
        prismaClient: createDashboardPrisma()
      }),
      (error) =>
        error instanceof DashboardQueryDomainError &&
        error.code === "INVALID_DASHBOARD_QUERY" &&
        error.message === "운영월을 선택하세요."
    );
  });
});

function graphDailySummary(overrides: any = {}) {
  return {
    reservationCount: 0,
    inUseCount: 0,
    cleaningCount: 0,
    completedCount: 0,
    noShowCount: 0,
    canceledCount: 0,
    paymentTotal: 0,
    therapistCommissionTotal: 0,
    earcarePoolTotal: 0,
    discountTotal: 0,
    expenseTotal: 0,
    netSales: 0,
    courseSummaries: [
      { courseCode: "A", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "B", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "D", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "E", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }
    ],
    warningCounts: {
      coursePolicyMissing: 0,
      therapistRateMissing: 0,
      secondTherapistRequired: 0
    },
    ...overrides
  };
}

function graphSettlement(employeeId: string, displayName: string, staffCode: string, role: "THERAPIST_1" | "THERAPIST_2", callCount: number) {
  return {
    employeeId,
    displayName,
    staffCode,
    sortOrder: employeeId === "therapist-1" ? 1 : 2,
    totalCallCount: callCount,
    totalCommissionAmount: callCount * 700000,
    courseBreakdown: {
      A: { courseCode: "A", callCount, commissionAmount: callCount * 700000 },
      B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
      C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
      D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
      E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
    },
    assignmentEvidence: Array.from({ length: callCount }).map((_, index) => ({
      serviceCallId: `${employeeId}-${role}-${index}`,
      courseId: "course-a",
      courseCode: "A",
      role,
      employeeId,
      commissionAmount: 700000,
      rateStatus: "applied"
    })),
    warningCounts: {
      zeroPolicy: 0,
      missingPolicy: 0
    }
  };
}

describe("getDashboardGraphReport", () => {
  it("운영월 범위 기준으로 매출 추이, 코스 비중, 마사지사 순위, 객실/노쇼 추이를 DTO에서 조립한다", async () => {
    const result = await getDashboardGraphReport({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createDashboardPrisma(),
      dependencies: {
        getDailyCallLedgerSummary: async ({ serviceDate }: any) =>
          serviceDate === "2026-06-10"
            ? graphDailySummary({
                completedCount: 2,
                noShowCount: 1,
                canceledCount: 1,
                paymentTotal: 3300000,
                netSales: 3200000,
                expenseTotal: 100000,
                courseSummaries: [
                  { courseCode: "A", completedCount: 1, discountCount: 0, therapistAssignmentCount: 1 },
                  { courseCode: "B", completedCount: 1, discountCount: 0, therapistAssignmentCount: 2 },
                  { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
                  { courseCode: "D", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
                  { courseCode: "E", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }
                ]
              })
            : graphDailySummary(),
        listCompletedServiceCallCalculationsForOperatingMonth: async () => [
          {
            serviceCallId: "call-a",
            serviceDate: "2026-06-10",
            courseId: "course-a",
            courseCode: "A",
            paymentAmount: 1500000,
            discountAmount: 0,
            earcarePoolAmount: 100000,
            opsCallCredit: 1,
            therapistAssignments: [{ role: "THERAPIST_1", employeeId: "therapist-1", commissionAmount: 700000 }]
          },
          {
            serviceCallId: "call-b",
            serviceDate: "2026-06-10",
            courseId: "course-b",
            courseCode: "B",
            paymentAmount: 1800000,
            discountAmount: 0,
            earcarePoolAmount: 200000,
            opsCallCredit: 1,
            therapistAssignments: [
              { role: "THERAPIST_1", employeeId: "therapist-1", commissionAmount: 900000 },
              { role: "THERAPIST_2", employeeId: "therapist-1", commissionAmount: 900000 }
            ]
          }
        ],
        listTherapistDailySettlements: (async ({ serviceDate }: any) => ({
          operatingMonthId: "month-2026-06",
          serviceDate,
          settlements:
            serviceDate === "2026-06-10"
              ? [
                  {
                    ...graphSettlement("therapist-1", "마사지사1", "THR-001", "THERAPIST_1", 2),
                    totalCallCount: 3,
                    totalCommissionAmount: 2500000,
                    assignmentEvidence: [
                      {
                        serviceCallId: "call-a",
                        courseId: "course-a",
                        courseCode: "A",
                        role: "THERAPIST_1",
                        employeeId: "therapist-1",
                        commissionAmount: 700000,
                        rateStatus: "applied"
                      },
                      {
                        serviceCallId: "call-b",
                        courseId: "course-b",
                        courseCode: "B",
                        role: "THERAPIST_1",
                        employeeId: "therapist-1",
                        commissionAmount: 900000,
                        rateStatus: "applied"
                      },
                      {
                        serviceCallId: "call-b",
                        courseId: "course-b",
                        courseCode: "B",
                        role: "THERAPIST_2",
                        employeeId: "therapist-1",
                        commissionAmount: 900000,
                        rateStatus: "applied"
                      }
                    ]
                  },
                  graphSettlement("therapist-2", "마사지사2", "THR-002", "THERAPIST_2", 1)
                ]
              : [],
          warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
          excludedCallCount: 0
        })) as any,
        listRoomStatuses: (async () => [
          { roomId: "room-1", displayStatus: "사용중" },
          { roomId: "room-2", displayStatus: "청소중" },
          { roomId: "room-3", displayStatus: "종료확인" },
          { roomId: "room-4", displayStatus: "빈방" }
        ]) as any,
        listMonthlyClosingPreview: async () =>
          monthlyPreview({
            therapists: {
              rows: [
                {
                  employeeId: "therapist-1",
                  staffCode: "THR-001",
                  displayName: "마사지사1",
                  totalCallCount: 2,
                  monthlySettlementAmount: 1600000,
                  finalPayoutAmount: 1800000
                }
              ],
              payoutAmount: 1800000,
              totalCallCount: 2
            }
          })
      }
    });

    assert.equal(result.sourceBasis.kind, "current_recalculation");
    assert.equal(result.dailyRevenueTrend.find((row) => row.serviceDate === "2026-06-10")?.paymentTotal, 3300000);
    assert.deepEqual(
      result.courseMix.map((row) => [row.courseCode, row.completedCount, row.paymentTotal, row.callShare, row.revenueShare]),
      [
        ["A", 1, 1500000, 0.5, 1500000 / 3300000],
        ["B", 1, 1800000, 0.5, 1800000 / 3300000],
        ["C", 0, 0, 0, 0],
        ["D", 0, 0, 0, 0],
        ["E", 0, 0, 0, 0]
      ]
    );
    assert.equal(result.therapistCallRanking[0]?.employeeId, "therapist-1");
    assert.equal(result.therapistCallRanking[0]?.assignedCallCount, 3);
    assert.equal(result.therapistCallRanking[0]?.therapist2Count, 1);
    assert.equal(result.therapistSettlementRanking[0]?.finalPayoutAmount, 1800000);
    assert.deepEqual(
      result.roomStatusDistribution.map((row) => [row.displayStatus, row.count]),
      [
        ["사용중", 1],
        ["청소중", 1],
        ["예약", 0],
        ["종료확인", 1],
        ["빈방", 1]
      ]
    );
    assert.equal(result.noShowCancelTrend.find((row) => row.serviceDate === "2026-06-10")?.noShowCount, 1);
    assert.equal(result.opsIncentiveOrPayoutComposition.status, "available");
    assert.equal(result.emptyStates.snapshotMissing, false);
  });

  it("마감확정/잠금 운영월에서 snapshot이 없으면 지급 순위와 구성 그래프를 current로 대체하지 않는다", async () => {
    const result = await getDashboardGraphReport({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createDashboardPrisma({ operatingMonthStatus: "잠금" }),
      dependencies: {
        getDailyCallLedgerSummary: async () => graphDailySummary(),
        listCompletedServiceCallCalculationsForOperatingMonth: async () => [],
        listTherapistDailySettlements: async () => ({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          settlements: [],
          warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
          excludedCallCount: 0
        }),
        listRoomStatuses: async () => [],
        getMonthlyClosingSnapshot: async () => {
          const error = new Error("확정 스냅샷을 찾을 수 없습니다.");
          (error as any).code = "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND";
          throw error;
        },
        listMonthlyClosingPreview: async () => monthlyPreview({ totals: { grandPayoutAmount: 999999999 } })
      }
    });

    assert.equal(result.sourceBasis.kind, "snapshot_missing");
    assert.equal(result.therapistSettlementRanking.length, 0);
    assert.equal(result.opsIncentiveOrPayoutComposition.status, "snapshot_missing");
    assert.equal(result.emptyStates.snapshotMissing, true);
  });

  it("운영월 범위 밖 조회날짜는 한국어 domain error로 차단한다", async () => {
    await assert.rejects(
      getDashboardGraphReport({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-07-01",
        prismaClient: createDashboardPrisma()
      }),
      (error) =>
        error instanceof DashboardQueryDomainError &&
        error.code === "DASHBOARD_DATE_OUT_OF_RANGE" &&
        error.message === "조회 날짜가 선택한 운영월 범위를 벗어났습니다."
    );
  });
});
