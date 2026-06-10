import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DashboardQueryDomainError, getTodayDashboardMetrics } from "@/modules/dashboard/dashboard-query-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

const createdAt = new Date("2026-06-10T00:00:00.000Z");
const updatedAt = new Date("2026-06-10T00:10:00.000Z");

function createDashboardPrisma(options: { operatingMonthMissing?: boolean; noCalls?: boolean } = {}) {
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: "작성중",
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
