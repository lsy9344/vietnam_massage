import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CompletedServiceCallCalculationDto } from "@/modules/calls/service-call-service";
import {
  MonthlyClosingPreviewDomainError,
  listMonthlyClosingPreview,
  type TherapistFullAttendanceRecognitionResultDto
} from "@/modules/closing/monthly-closing-preview-service";
import { listTherapistFullAttendanceRecognitions } from "@/modules/settlements/therapist-attendance-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createClosingPrisma(
  options: {
    status?: string;
    invalidRange?: boolean;
    missingMonth?: boolean;
    activeTherapists?: Array<{ id: string; staffCode: string; displayName: string; sortOrder: number }>;
    therapistAttendances?: Array<{ employeeId: string; attendanceDate: string; isFullAttendanceRecognized: boolean; isActive?: boolean }>;
  } = {}
) {
  const operatingMonth = options.missingMonth
    ? null
    : {
        id: "month-2026-06",
        monthKey: "2026-06",
        startDate: options.invalidRange ? dbDate("2026-06-03") : dbDate("2026-06-01"),
        endDate: options.invalidRange ? dbDate("2026-06-01") : dbDate("2026-06-02"),
        status: options.status ?? "검토중"
      };

  const attendanceRecords = (options.therapistAttendances ?? []).map((record) => ({
    ...record,
    operatingMonthId: "month-2026-06",
    attendanceDate: dbDate(record.attendanceDate),
    isActive: record.isActive ?? true
  }));

  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === "month-2026-06" ? operatingMonth : null;
      }
    },
    employee: {
      async findMany() {
        return options.activeTherapists ?? [
          { id: "therapist-1", staffCode: "THR-001", displayName: "마사지사1", sortOrder: 1 },
          { id: "therapist-2", staffCode: "THR-002", displayName: "마사지사2", sortOrder: 2 },
          { id: "therapist-3", staffCode: "THR-003", displayName: "마사지사3", sortOrder: 3 }
        ];
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return attendanceRecords.filter((record) => {
          if (where?.operatingMonthId !== undefined && record.operatingMonthId !== where.operatingMonthId) return false;
          if (where?.isActive !== undefined && record.isActive !== where.isActive) return false;
          if (where?.attendanceDate?.gte !== undefined && record.attendanceDate < where.attendanceDate.gte) return false;
          if (where?.attendanceDate?.lte !== undefined && record.attendanceDate > where.attendanceDate.lte) return false;
          return true;
        });
      }
    }
  } as any;
}

const therapistDayResults = {
  "2026-06-01": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-01",
    settlements: [
      {
        employeeId: "therapist-1",
        displayName: "마사지사1",
        staffCode: "THR-001",
        sortOrder: 1,
        totalCallCount: 2,
        totalCommissionAmount: 1600000,
        courseBreakdown: {
          A: { courseCode: "A", callCount: 1, commissionAmount: 700000 },
          B: { courseCode: "B", callCount: 1, commissionAmount: 900000 },
          C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
          D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
          E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
        },
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
            role: "THERAPIST_2",
            employeeId: "therapist-1",
            commissionAmount: 900000,
            rateStatus: "applied"
          }
        ],
        warningCounts: { zeroPolicy: 0, missingPolicy: 0 }
      }
    ],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    excludedCallCount: 1
  },
  "2026-06-02": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-02",
    settlements: [
      {
        employeeId: "therapist-1",
        displayName: "마사지사1",
        staffCode: "THR-001",
        sortOrder: 1,
        totalCallCount: 1,
        totalCommissionAmount: 700000,
        courseBreakdown: {
          A: { courseCode: "A", callCount: 1, commissionAmount: 700000 },
          B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
          C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
          D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
          E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
        },
        assignmentEvidence: [
          {
            serviceCallId: "call-c",
            courseId: "course-a",
            courseCode: "A",
            role: "THERAPIST_1",
            employeeId: "therapist-1",
            commissionAmount: 700000,
            rateStatus: "applied"
          }
        ],
        warningCounts: { zeroPolicy: 0, missingPolicy: 0 }
      },
      {
        employeeId: "therapist-2",
        displayName: "마사지사2",
        staffCode: "THR-002",
        sortOrder: 2,
        totalCallCount: 1,
        totalCommissionAmount: 0,
        courseBreakdown: {
          A: { courseCode: "A", callCount: 1, commissionAmount: 0 },
          B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
          C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
          D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
          E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
        },
        assignmentEvidence: [
          {
            serviceCallId: "call-d",
            courseId: "course-a",
            courseCode: "A",
            role: "THERAPIST_2",
            employeeId: "therapist-2",
            commissionAmount: 0,
            rateStatus: "zero_policy"
          }
        ],
        warningCounts: { zeroPolicy: 1, missingPolicy: 0 }
      }
    ],
    warningCounts: { coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 1 },
    excludedCallCount: 2
  }
} as const;

const emptyCourseBreakdown = {
  A: { courseCode: "A", callCount: 0, commissionAmount: 0 },
  B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
  C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
  D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
  E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
} as const;

function therapistSettlement(input: {
  employeeId: string;
  staffCode: string;
  displayName: string;
  sortOrder: number;
  totalCallCount: number;
  totalCommissionAmount: number;
}) {
  return {
    ...input,
    courseBreakdown: {
      ...emptyCourseBreakdown,
      A: { courseCode: "A", callCount: input.totalCallCount, commissionAmount: input.totalCommissionAmount }
    },
    assignmentEvidence: Array.from({ length: Math.min(input.totalCallCount, 3) }, (_, index) => ({
      serviceCallId: `${input.employeeId}-call-${index + 1}`,
      courseId: "course-a",
      courseCode: "A",
      role: "THERAPIST_1",
      employeeId: input.employeeId,
      commissionAmount: Math.floor(input.totalCommissionAmount / Math.max(input.totalCallCount, 1)),
      rateStatus: "applied"
    })),
    warningCounts: { zeroPolicy: 0, missingPolicy: 0 }
  };
}

const opsDailyResults = {
  "2026-06-01": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-01",
    dailyOpsCallCredit: 31,
    sourceCallCount: 2,
    appliedThresholdCallCount: 30,
    personalIncentiveAmount: 50000,
    ruleStatus: "applied",
    warningMessage: null,
    eligibleCount: 2,
    distributedAmount: 100000,
    warningCounts: { notCompleted: 1, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    rows: [
      {
        employeeId: "ops-1",
        staffCode: "OPS-001",
        displayName: "운영1",
        position: "카운터",
        statusCode: "NORMAL",
        statusDisplayName: "정상",
        isPayoutEligible: true,
        exclusionReason: null,
        payoutAmount: 50000,
        calculationBasis: "일 총콜 31콜 / 30콜 이상 개인 50000 VND"
      },
      {
        employeeId: "ops-2",
        staffCode: "OPS-002",
        displayName: "운영2",
        position: "웨이터",
        statusCode: "NORMAL",
        statusDisplayName: "정상",
        isPayoutEligible: true,
        exclusionReason: null,
        payoutAmount: 50000,
        calculationBasis: "일 총콜 31콜 / 30콜 이상 개인 50000 VND"
      }
    ],
    callEvidence: [{ serviceCallId: "call-a", serviceDate: "2026-06-01", opsCallCredit: 31 }]
  },
  "2026-06-02": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-02",
    dailyOpsCallCredit: 0,
    sourceCallCount: 0,
    appliedThresholdCallCount: null,
    personalIncentiveAmount: 0,
    ruleStatus: "below_threshold",
    warningMessage: "30콜 미만으로 운영팀 일일 인센이 없습니다.",
    eligibleCount: 1,
    distributedAmount: 0,
    warningCounts: { notCompleted: 0, coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 1 },
    rows: [
      {
        employeeId: "ops-1",
        staffCode: "OPS-001",
        displayName: "운영1",
        position: "카운터",
        statusCode: "NORMAL",
        statusDisplayName: "정상",
        isPayoutEligible: true,
        exclusionReason: null,
        payoutAmount: 0,
        calculationBasis: "30콜 미만"
      }
    ],
    callEvidence: []
  }
} as const;

const earcareDayResults = {
  "2026-06-01": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-01",
    earcarePoolTotal: 100000,
    sourceCallCount: 1,
    eligibleCount: 1,
    baseShareAmount: 100000,
    remainderAmount: 0,
    distributedAmount: 100000,
    undistributedAmount: 0,
    warningCounts: { notCompleted: 1, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    rows: [
      {
        employeeId: "earcare-1",
        staffCode: "EAR-001",
        displayName: "귀케어1",
        statusCode: "NORMAL",
        statusDisplayName: "정상",
        isPayoutEligible: true,
        exclusionReason: null,
        baseShareAmount: 100000,
        remainderShareAmount: 0,
        payoutAmount: 100000,
        calculationBasis: "방문완료 풀 100000 VND / 정상 근무자 1명"
      }
    ],
    poolEvidence: [{ serviceCallId: "call-b", serviceDate: "2026-06-01", earcarePoolAmount: 100000 }]
  },
  "2026-06-02": {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-02",
    earcarePoolTotal: 50000,
    sourceCallCount: 1,
    eligibleCount: 0,
    baseShareAmount: 0,
    remainderAmount: 0,
    distributedAmount: 0,
    undistributedAmount: 50000,
    warningCounts: { notCompleted: 0, coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 0 },
    rows: [
      {
        employeeId: "earcare-1",
        staffCode: "EAR-001",
        displayName: "귀케어1",
        statusCode: "OFF",
        statusDisplayName: "휴무",
        isPayoutEligible: false,
        exclusionReason: "휴무",
        baseShareAmount: 0,
        remainderShareAmount: 0,
        payoutAmount: 0,
        calculationBasis: "휴무 제외"
      }
    ],
    poolEvidence: [{ serviceCallId: "call-c", serviceDate: "2026-06-02", earcarePoolAmount: 50000 }]
  }
} as const;

function financialDayResult(overrides: Partial<{
  paymentTotal: number;
  netSales: number;
  discountTotal: number;
  expenseTotal: number;
  earcarePoolTotal: number;
  therapistCommissionTotal: number;
}> = {}) {
  return {
    reservationCount: 0,
    inUseCount: 0,
    cleaningCount: 0,
    completedCount: 0,
    noShowCount: 0,
    canceledCount: 0,
    paymentTotal: 0,
    netSales: 0,
    discountTotal: 0,
    expenseTotal: 0,
    earcarePoolTotal: 0,
    therapistCommissionTotal: 0,
    paymentMethodTotals: { cash: 0, card: 0, bank: 0, other: 0 },
    courseSummaries: [],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    ...overrides
  };
}

const financialDayResults = {
  "2026-06-01": financialDayResult({
    paymentTotal: 3000000,
    netSales: 2850000,
    discountTotal: 100000,
    expenseTotal: 150000,
    earcarePoolTotal: 100000,
    therapistCommissionTotal: 1600000
  }),
  "2026-06-02": financialDayResult({
    paymentTotal: 1000000,
    netSales: 950000,
    discountTotal: 0,
    expenseTotal: 50000,
    earcarePoolTotal: 50000,
    therapistCommissionTotal: 700000
  })
} as const;

function createDependencies(options: { fullAttendanceResult?: TherapistFullAttendanceRecognitionResultDto; therapistResults?: Record<string, unknown> } = {}) {
  const calledDates: string[] = [];

  return {
    calledDates,
    dependencies: {
      async listTherapistDailySettlements({ serviceDate }: { serviceDate: string }) {
        calledDates.push(`therapist:${serviceDate}`);
        const source = options.therapistResults ?? therapistDayResults;
        return source[serviceDate as keyof typeof source] as any;
      },
      async listTherapistFullAttendanceRecognitions() {
        calledDates.push("full-attendance");
        return (
          options.fullAttendanceResult ?? {
            sourceStatus: "missing_story_4_1_source",
            sourceDayCount: 0,
            rows: [],
            warningMessages: ["Story 4.1 마사지사 출퇴근/만근 인정 source가 없어 만근수당을 계산하지 않았습니다."]
          }
        );
      },
      async listOpsDailyIncentives({ serviceDate }: { serviceDate: string }) {
        calledDates.push(`ops:${serviceDate}`);
        return opsDailyResults[serviceDate as keyof typeof opsDailyResults] as any;
      },
      async listOpsMonthlyIncentivePreview() {
        calledDates.push("ops-monthly");
        return {
          operatingMonthId: "month-2026-06",
          monthKey: "2026-06",
          startDate: "2026-06-01",
          endDate: "2026-06-02",
          isClosedOrLocked: false,
          previewStatus: "draft_current",
          monthlyOpsCallCredit: 31,
          sourceCallCount: 1,
          appliedThresholdCallCount: 30,
          totalMonthlyIncentiveAmount: 3000000,
          ruleStatus: "applied",
          warningMessage: "카운터팀 대상자가 없어 카운터팀 몫을 미배분으로 남겼습니다.",
          shares: {
            leadShare: 0.3,
            counterTeamShare: 0.35,
            waiterTeamShare: 0.35,
            leadAmount: 900000,
            counterTeamAmount: 1050000,
            waiterTeamAmount: 1050000,
            undistributedAmount: 1050000
          },
          rows: [
            {
              employeeId: "ops-1",
              staffCode: "OPS-001",
              displayName: "운영1",
              position: "카운터",
              teamRole: "counter",
              teamShareLabel: "카운터팀",
              payoutAmount: 3000000,
              calculationBasis: "카운터팀 몫 3000000 VND / 1명"
            }
          ],
          warningCounts: { notCompleted: 1, coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 1 },
          callEvidence: [{ serviceCallId: "call-a", serviceDate: "2026-06-01", opsCallCredit: 31 }]
        } as any;
      },
      async listEarcareDailySettlements({ serviceDate }: { serviceDate: string }) {
        calledDates.push(`earcare:${serviceDate}`);
        return earcareDayResults[serviceDate as keyof typeof earcareDayResults] as any;
      },
      async getDailyCallLedgerSummary({ serviceDate }: { serviceDate: string }) {
        calledDates.push(`financial:${serviceDate}`);
        return financialDayResults[serviceDate as keyof typeof financialDayResults] ?? financialDayResult();
      },
      async listCompletedServiceCallCalculationsForOperatingMonth(): Promise<CompletedServiceCallCalculationDto[]> {
        calledDates.push("completed-calculations");
        return [
          {
            serviceCallId: "call-a",
            serviceDate: "2026-06-01",
            courseId: "course-a",
            courseCode: "A",
            basePrice: 3000000,
            paymentAmount: 3000000,
            discountAmount: 0,
            earcarePoolAmount: 100000,
            opsCallCredit: 1,
            therapistAssignments: [{ role: "THERAPIST_1", employeeId: "therapist-1", commissionAmount: 1600000 }]
          },
          {
            serviceCallId: "call-b",
            serviceDate: "2026-06-02",
            courseId: "course-b",
            courseCode: "B",
            basePrice: 1000000,
            paymentAmount: 1000000,
            discountAmount: 0,
            earcarePoolAmount: 50000,
            opsCallCredit: 1,
            therapistAssignments: [{ role: "THERAPIST_1", employeeId: "therapist-1", commissionAmount: 700000 }]
          }
        ];
      }
    }
  };
}

describe("listMonthlyClosingPreview", () => {
  it("aggregates operating-month dates from upstream settlement services and keeps payout totals consistent", async () => {
    const { dependencies, calledDates } = createDependencies();

    const result = await listMonthlyClosingPreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createClosingPrisma(),
      dependencies
    });

    assert.deepEqual(calledDates, [
      "therapist:2026-06-01",
      "therapist:2026-06-02",
      "full-attendance",
      "ops:2026-06-01",
      "ops:2026-06-02",
      "ops-monthly",
      "earcare:2026-06-01",
      "earcare:2026-06-02",
      "financial:2026-06-01",
      "financial:2026-06-02",
      "completed-calculations"
    ]);
    assert.equal(result.startDate, "2026-06-01");
    assert.equal(result.endDate, "2026-06-02");
    assert.equal(result.previewStatus, "draft_current");
    assert.equal(result.therapists.rows[0].employeeId, "therapist-1");
    assert.equal(result.therapists.rows[0].totalCallCount, 3);
    assert.equal(result.therapists.rows[0].monthlySettlementAmount, 2300000);
    assert.equal(result.therapists.rows[0].fullAttendanceDays, null);
    assert.equal(result.therapists.rows[0].fullAttendanceAllowanceAmount, 0);
    assert.equal(result.therapists.rows[0].fullAttendanceBasis, "Story 4.1 만근 인정 source 없음");
    assert.equal(result.therapists.rows[0].countKingRank, null);
    assert.equal(result.therapists.rows[0].countKingBonusAmount, 0);
    assert.equal(result.therapists.rows[0].countKingBasis, "월 총콜 3콜 / 40콜 미만 제외");
    assert.equal(result.therapists.rows[0].finalPayoutAmount, 2300000);
    assert.ok(result.therapists.rows[0].bonusWarningMessages.some((message) => message.includes("Story 4.1")));
    assert.equal(result.therapists.rows.length, 3);
    assert.equal(result.therapists.rows[2].employeeId, "therapist-3");
    assert.equal(result.therapists.rows[2].totalCallCount, 0);
    assert.equal(result.therapists.rows[2].finalPayoutAmount, 0);
    assert.equal(result.operations.dailyIncentiveAmount, 100000);
    assert.equal(result.operations.monthlyIncentiveAmount, 3000000);
    assert.equal(result.operations.rows[0].totalOpsPayoutAmount, 3050000);
    assert.equal(result.earcare.earcarePoolTotal, 150000);
    assert.equal(result.earcare.distributedAmount, 100000);
    assert.equal(result.earcare.undistributedAmount, 50000);
    assert.deepEqual(result.financials, {
      paymentTotal: 4000000,
      netSales: 3800000,
      discountTotal: 100000,
      expenseTotal: 200000,
      earcarePoolTotal: 150000,
      therapistCommissionTotal: 2300000
    });
    assert.equal(result.totals.therapistPayoutAmount, 2300000);
    assert.equal(result.totals.opsDailyIncentiveAmount, 100000);
    assert.equal(result.totals.opsMonthlyIncentiveAmount, 3000000);
    assert.equal(result.totals.earcarePayoutAmount, 100000);
    assert.equal(result.totals.grandPayoutAmount, 5500000);
    assert.equal((result as any).dashboardFinancials.dailyCostTotal, 2700000);
    assert.equal((result as any).dashboardFinancials.monthlyCostTotal, 3000000);
    assert.equal((result as any).dashboardFinancials.settlementPayoutTotal, 5500000);
    assert.equal((result as any).dashboardFinancials.netProfit, -1700000);
    assert.equal((result as any).graphReport.dailyRevenueTrend[0].paymentTotal, 3000000);
    assert.equal((result as any).graphReport.courseMix[0].paymentTotal, 3000000);
    assert.equal((result as any).graphReport.therapistCallRanking[0].employeeId, "therapist-1");
    assert.equal(result.evidence.sourceDayCount, 2);
    assert.equal(result.evidence.includedCallCount, 8);
    assert.equal(result.evidence.excludedCallCount, 3);
    assert.equal(result.evidence.fullAttendanceSourceStatus, "missing_story_4_1_source");
    assert.equal(result.evidence.fullAttendanceSourceDayCount, 0);
    assert.equal(result.evidence.countKingEligibleCount, 0);
    assert.equal(result.evidence.countKingExcludedCount, 3);
    assert.equal(result.warningCounts.earcareNormalStaffZeroDays, 1);
    assert.equal(result.warningCounts.earcareUndistributedDays, 1);
    assert.equal(result.warningCounts.opsMonthly.coursePolicyMissing, 1);
    assert.equal(result.warningCounts.opsWarningMessageCount, 2);
    assert.equal(result.warningCounts.fullAttendanceSourceMissing, 1);
    assert.equal(result.warningCounts.fullAttendanceSourceDayCount, 0);
    assert.equal(result.warningCounts.countKingEligibleCount, 0);
    assert.equal(result.warningCounts.countKingExcludedCount, 3);
    assert.equal(result.warningCounts.total, 19);
    assert.ok(result.operations.warningMessages.some((message) => message.includes("30콜 미만")));
    assert.ok(result.operations.warningMessages.some((message) => message.includes("카운터팀 대상자")));
  });

  it("applies full-attendance and count-king bonuses with deterministic tie-breaker and final totals", async () => {
    const activeTherapists = [
      { id: "therapist-a", staffCode: "THR-010", displayName: "동률고액", sortOrder: 10 },
      { id: "therapist-b", staffCode: "THR-011", displayName: "동률저액", sortOrder: 11 },
      { id: "therapist-c", staffCode: "THR-012", displayName: "콜왕", sortOrder: 12 },
      { id: "therapist-d", staffCode: "THR-013", displayName: "39콜", sortOrder: 13 }
    ];
    const therapistResults = {
      "2026-06-01": {
        ...therapistDayResults["2026-06-01"],
        settlements: [
          therapistSettlement({
            employeeId: "therapist-a",
            staffCode: "THR-010",
            displayName: "동률고액",
            sortOrder: 10,
            totalCallCount: 25,
            totalCommissionAmount: 3000000
          }),
          therapistSettlement({
            employeeId: "therapist-b",
            staffCode: "THR-011",
            displayName: "동률저액",
            sortOrder: 11,
            totalCallCount: 25,
            totalCommissionAmount: 2000000
          }),
          therapistSettlement({
            employeeId: "therapist-c",
            staffCode: "THR-012",
            displayName: "콜왕",
            sortOrder: 12,
            totalCallCount: 30,
            totalCommissionAmount: 1500000
          }),
          therapistSettlement({
            employeeId: "therapist-d",
            staffCode: "THR-013",
            displayName: "39콜",
            sortOrder: 13,
            totalCallCount: 20,
            totalCommissionAmount: 1000000
          })
        ],
        warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        excludedCallCount: 0
      },
      "2026-06-02": {
        ...therapistDayResults["2026-06-02"],
        settlements: [
          therapistSettlement({
            employeeId: "therapist-a",
            staffCode: "THR-010",
            displayName: "동률고액",
            sortOrder: 10,
            totalCallCount: 20,
            totalCommissionAmount: 3000000
          }),
          therapistSettlement({
            employeeId: "therapist-b",
            staffCode: "THR-011",
            displayName: "동률저액",
            sortOrder: 11,
            totalCallCount: 20,
            totalCommissionAmount: 2000000
          }),
          therapistSettlement({
            employeeId: "therapist-c",
            staffCode: "THR-012",
            displayName: "콜왕",
            sortOrder: 12,
            totalCallCount: 20,
            totalCommissionAmount: 1500000
          }),
          therapistSettlement({
            employeeId: "therapist-d",
            staffCode: "THR-013",
            displayName: "39콜",
            sortOrder: 13,
            totalCallCount: 19,
            totalCommissionAmount: 1000000
          })
        ],
        warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        excludedCallCount: 0
      }
    } as const;
    const { dependencies } = createDependencies({
      therapistResults,
      fullAttendanceResult: {
        sourceStatus: "available",
        sourceDayCount: 22,
        rows: [
          { employeeId: "therapist-a", fullAttendanceDays: 19 },
          { employeeId: "therapist-b", fullAttendanceDays: 20 },
          { employeeId: "therapist-c", fullAttendanceDays: 21 },
          { employeeId: "therapist-d", fullAttendanceDays: 20 }
        ],
        warningMessages: []
      }
    });

    const result = await listMonthlyClosingPreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createClosingPrisma({ activeTherapists }),
      dependencies
    });

    const rowsById = new Map(result.therapists.rows.map((row) => [row.employeeId, row]));
    assert.equal(rowsById.get("therapist-c")?.countKingRank, 1);
    assert.equal(rowsById.get("therapist-c")?.countKingBonusAmount, 5000000);
    assert.equal(rowsById.get("therapist-a")?.countKingRank, 2);
    assert.equal(rowsById.get("therapist-a")?.countKingBonusAmount, 3000000);
    assert.equal(rowsById.get("therapist-b")?.countKingRank, 3);
    assert.equal(rowsById.get("therapist-b")?.countKingBonusAmount, 1000000);
    assert.equal(rowsById.get("therapist-d")?.countKingRank, null);
    assert.equal(rowsById.get("therapist-d")?.countKingBasis, "월 총콜 39콜 / 40콜 미만 제외");
    assert.equal(rowsById.get("therapist-a")?.fullAttendanceDays, 19);
    assert.equal(rowsById.get("therapist-a")?.fullAttendanceAllowanceAmount, 0);
    assert.match(rowsById.get("therapist-a")?.fullAttendanceBasis ?? "", /20일 미만/);
    assert.equal(rowsById.get("therapist-b")?.fullAttendanceDays, 20);
    assert.equal(rowsById.get("therapist-b")?.fullAttendanceAllowanceAmount, 2000000);
    assert.match(rowsById.get("therapist-b")?.fullAttendanceBasis ?? "", /20일 이상 2,000,000 VND/);
    assert.match(rowsById.get("therapist-a")?.countKingBasis ?? "", /tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc/);
    assert.equal(rowsById.get("therapist-c")?.finalPayoutAmount, 3000000 + 2000000 + 5000000);
    assert.equal(rowsById.get("therapist-a")?.finalPayoutAmount, 6000000 + 0 + 3000000);
    assert.equal(rowsById.get("therapist-b")?.finalPayoutAmount, 4000000 + 2000000 + 1000000);
    assert.equal(rowsById.get("therapist-d")?.finalPayoutAmount, 2000000 + 2000000 + 0);
    assert.equal(result.therapists.payoutAmount, result.therapists.rows.reduce((sum, row) => sum + row.finalPayoutAmount, 0));
    assert.equal(result.totals.therapistPayoutAmount, 30000000);
    assert.equal(result.totals.grandPayoutAmount, 33200000);
    assert.equal(result.evidence.fullAttendanceSourceStatus, "available");
    assert.equal(result.evidence.fullAttendanceSourceDayCount, 22);
    assert.equal(result.evidence.countKingEligibleCount, 3);
    assert.equal(result.evidence.countKingExcludedCount, 1);
  });

  it("applies count-king bonuses only to existing eligible therapists when fewer than three qualify", async () => {
    const activeTherapists = [
      { id: "therapist-one", staffCode: "THR-021", displayName: "1위", sortOrder: 21 },
      { id: "therapist-two", staffCode: "THR-022", displayName: "2위", sortOrder: 22 },
      { id: "therapist-low", staffCode: "THR-023", displayName: "미달", sortOrder: 23 }
    ];
    const therapistResults = {
      "2026-06-01": {
        ...therapistDayResults["2026-06-01"],
        settlements: [
          therapistSettlement({
            employeeId: "therapist-one",
            staffCode: "THR-021",
            displayName: "1위",
            sortOrder: 21,
            totalCallCount: 50,
            totalCommissionAmount: 5000000
          }),
          therapistSettlement({
            employeeId: "therapist-two",
            staffCode: "THR-022",
            displayName: "2위",
            sortOrder: 22,
            totalCallCount: 41,
            totalCommissionAmount: 4100000
          }),
          therapistSettlement({
            employeeId: "therapist-low",
            staffCode: "THR-023",
            displayName: "미달",
            sortOrder: 23,
            totalCallCount: 39,
            totalCommissionAmount: 3900000
          })
        ],
        warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        excludedCallCount: 0
      },
      "2026-06-02": {
        ...therapistDayResults["2026-06-02"],
        settlements: [],
        warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        excludedCallCount: 0
      }
    } as const;
    const { dependencies } = createDependencies({
      therapistResults,
      fullAttendanceResult: {
        sourceStatus: "available",
        sourceDayCount: 2,
        rows: activeTherapists.map((therapist) => ({ employeeId: therapist.id, fullAttendanceDays: 0 })),
        warningMessages: []
      }
    });

    const result = await listMonthlyClosingPreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createClosingPrisma({ activeTherapists }),
      dependencies
    });

    const rowsById = new Map(result.therapists.rows.map((row) => [row.employeeId, row]));
    assert.equal(rowsById.get("therapist-one")?.countKingRank, 1);
    assert.equal(rowsById.get("therapist-one")?.countKingBonusAmount, 5000000);
    assert.equal(rowsById.get("therapist-two")?.countKingRank, 2);
    assert.equal(rowsById.get("therapist-two")?.countKingBonusAmount, 3000000);
    assert.equal(rowsById.get("therapist-low")?.countKingRank, null);
    assert.equal(result.evidence.countKingEligibleCount, 2);
    assert.equal(result.evidence.countKingExcludedCount, 1);
    assert.equal(result.therapists.rows.some((row) => row.countKingRank === 3), false);
  });

  it("labels closed or locked months as current preview, not a snapshot", async () => {
    const { dependencies } = createDependencies();

    const result = await listMonthlyClosingPreview({
      operatingMonthId: "month-2026-06",
      prismaClient: createClosingPrisma({ status: "잠금" }),
      dependencies
    });

    assert.equal(result.previewStatus, "closed_current");
    assert.equal(result.status, "잠금");
  });

  it("consumes the real Story 4.1 therapist attendance source so missing_story_4_1_source disappears and the 20-day allowance applies", async () => {
    const activeTherapists = [
      { id: "therapist-1", staffCode: "THR-001", displayName: "마사지사1", sortOrder: 1 },
      { id: "therapist-2", staffCode: "THR-002", displayName: "마사지사2", sortOrder: 2 }
    ];
    // therapist-1 reaches 20 recognized days; therapist-2 only 19.
    const therapistAttendances: Array<{ employeeId: string; attendanceDate: string; isFullAttendanceRecognized: boolean }> = [];
    for (let day = 1; day <= 20; day += 1) {
      const attendanceDate = `2026-06-${String(day).padStart(2, "0")}`;
      therapistAttendances.push({ employeeId: "therapist-1", attendanceDate, isFullAttendanceRecognized: true });
      therapistAttendances.push({ employeeId: "therapist-2", attendanceDate, isFullAttendanceRecognized: day <= 19 });
    }

    const closingPrisma = createClosingPrisma({
      // widen the date range so all 20 seeded days fall inside the operating month
      activeTherapists,
      therapistAttendances
    });
    // Stretch the operating month to cover the 20 seeded days.
    closingPrisma.operatingMonth.findUnique = async ({ where }: any) =>
      where.id === "month-2026-06"
        ? { id: "month-2026-06", monthKey: "2026-06", startDate: dbDate("2026-06-01"), endDate: dbDate("2026-06-20"), status: "검토중" }
        : null;

    const { dependencies } = createDependencies({
      therapistResults: Object.fromEntries(
        Array.from({ length: 20 }, (_, index) => {
          const serviceDate = `2026-06-${String(index + 1).padStart(2, "0")}`;
          return [
            serviceDate,
            {
              operatingMonthId: "month-2026-06",
              serviceDate,
              settlements: [],
              warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
              excludedCallCount: 0
            }
          ];
        })
      )
    });
    // Provide empty-but-valid ops/earcare results for every seeded date.
    dependencies.listOpsDailyIncentives = async ({ serviceDate }: { serviceDate: string }) =>
      ({
        operatingMonthId: "month-2026-06",
        serviceDate,
        sourceCallCount: 0,
        distributedAmount: 0,
        warningMessage: null,
        warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        rows: [],
        callEvidence: []
      }) as any;
    dependencies.listEarcareDailySettlements = async ({ serviceDate }: { serviceDate: string }) =>
      ({
        operatingMonthId: "month-2026-06",
        serviceDate,
        earcarePoolTotal: 0,
        sourceCallCount: 0,
        eligibleCount: 0,
        distributedAmount: 0,
        undistributedAmount: 0,
        warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        rows: [],
        poolEvidence: []
      }) as any;
    dependencies.listOpsMonthlyIncentivePreview = async () =>
      ({
        operatingMonthId: "month-2026-06",
        monthKey: "2026-06",
        startDate: "2026-06-01",
        endDate: "2026-06-20",
        monthlyOpsCallCredit: 0,
        appliedThresholdCallCount: null,
        ruleStatus: "below_threshold",
        warningMessage: null,
        rows: [],
        warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        callEvidence: []
      }) as any;
    // Use the real Story 4.1 recognition source instead of the missing-source stub.
    dependencies.listTherapistFullAttendanceRecognitions = (async (input: {
      operatingMonthId: string;
      startDate: string;
      endDate: string;
      prismaClient?: unknown;
    }): Promise<TherapistFullAttendanceRecognitionResultDto> => {
      const result = await listTherapistFullAttendanceRecognitions({
        operatingMonthId: input.operatingMonthId,
        startDate: input.startDate,
        endDate: input.endDate,
        prismaClient: input.prismaClient as any
      });
      return { sourceStatus: "available", sourceDayCount: result.sourceDayCount, rows: result.rows, warningMessages: [] };
    }) as typeof dependencies.listTherapistFullAttendanceRecognitions;

    const result = await listMonthlyClosingPreview({
      operatingMonthId: "month-2026-06",
      prismaClient: closingPrisma,
      dependencies
    });

    assert.equal(result.evidence.fullAttendanceSourceStatus, "available");
    assert.equal(result.warningCounts.fullAttendanceSourceMissing, 0);
    assert.equal(result.warningCounts.fullAttendanceSourceDayCount, 20);

    const rowsById = new Map(result.therapists.rows.map((row) => [row.employeeId, row]));
    assert.equal(rowsById.get("therapist-1")?.fullAttendanceDays, 20);
    assert.equal(rowsById.get("therapist-1")?.fullAttendanceAllowanceAmount, 2000000);
    assert.match(rowsById.get("therapist-1")?.fullAttendanceBasis ?? "", /20일 이상 2,000,000 VND/);
    assert.equal(rowsById.get("therapist-2")?.fullAttendanceDays, 19);
    assert.equal(rowsById.get("therapist-2")?.fullAttendanceAllowanceAmount, 0);
    assert.equal(
      result.therapists.rows.some((row) => row.bonusWarningMessages.some((message) => message.includes("missing_story_4_1_source"))),
      false
    );
  });

  it("maps invalid input and operating-month records to Korean domain errors", async () => {
    await assert.rejects(
      () => listMonthlyClosingPreview({ operatingMonthId: "", prismaClient: createClosingPrisma(), dependencies: createDependencies().dependencies }),
      (error) =>
        error instanceof MonthlyClosingPreviewDomainError &&
        error.code === "INVALID_MONTHLY_CLOSING_PREVIEW_INPUT" &&
        error.message === "운영월을 선택하세요."
    );

    await assert.rejects(
      () =>
        listMonthlyClosingPreview({
          operatingMonthId: "month-2026-06",
          prismaClient: createClosingPrisma({ invalidRange: true }),
          dependencies: createDependencies().dependencies
        }),
      (error) =>
        error instanceof MonthlyClosingPreviewDomainError &&
        error.code === "INVALID_OPERATING_MONTH_DATE_RANGE" &&
        error.message === "운영월 날짜 범위가 올바르지 않습니다."
    );

    await assert.rejects(
      () =>
        listMonthlyClosingPreview({
          operatingMonthId: "missing",
          prismaClient: createClosingPrisma({ missingMonth: true }),
          dependencies: createDependencies().dependencies
        }),
      (error) =>
        error instanceof MonthlyClosingPreviewDomainError &&
        error.code === "OPERATING_MONTH_NOT_FOUND" &&
        error.message === "운영월을 찾을 수 없습니다."
    );
  });
});
