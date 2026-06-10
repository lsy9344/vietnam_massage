import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MonthlyClosingPreviewDomainError,
  listMonthlyClosingPreview
} from "@/modules/closing/monthly-closing-preview-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createClosingPrisma(options: { status?: string; invalidRange?: boolean; missingMonth?: boolean } = {}) {
  const operatingMonth = options.missingMonth
    ? null
    : {
        id: "month-2026-06",
        monthKey: "2026-06",
        startDate: options.invalidRange ? dbDate("2026-06-03") : dbDate("2026-06-01"),
        endDate: options.invalidRange ? dbDate("2026-06-01") : dbDate("2026-06-02"),
        status: options.status ?? "검토중"
      };

  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === "month-2026-06" ? operatingMonth : null;
      }
    },
    employee: {
      async findMany() {
        return [
          { id: "therapist-1", staffCode: "THR-001", displayName: "마사지사1", sortOrder: 1 },
          { id: "therapist-2", staffCode: "THR-002", displayName: "마사지사2", sortOrder: 2 },
          { id: "therapist-3", staffCode: "THR-003", displayName: "마사지사3", sortOrder: 3 }
        ];
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

function createDependencies() {
  const calledDates: string[] = [];

  return {
    calledDates,
    dependencies: {
      async listTherapistDailySettlements({ serviceDate }: { serviceDate: string }) {
        calledDates.push(`therapist:${serviceDate}`);
        return therapistDayResults[serviceDate as keyof typeof therapistDayResults] as any;
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
      "ops:2026-06-01",
      "ops:2026-06-02",
      "ops-monthly",
      "earcare:2026-06-01",
      "earcare:2026-06-02"
    ]);
    assert.equal(result.startDate, "2026-06-01");
    assert.equal(result.endDate, "2026-06-02");
    assert.equal(result.previewStatus, "draft_current");
    assert.equal(result.therapists.rows[0].employeeId, "therapist-1");
    assert.equal(result.therapists.rows[0].totalCallCount, 3);
    assert.equal(result.therapists.rows[0].monthlySettlementAmount, 2300000);
    assert.equal(result.therapists.rows[0].fullAttendanceDays, null);
    assert.equal(result.therapists.rows[0].fullAttendanceAllowanceAmount, 0);
    assert.equal(result.therapists.rows[0].bonusStatus, "pending_story_5_2");
    assert.equal(result.therapists.rows[0].finalBasePayoutAmount, 2300000);
    assert.equal(result.therapists.rows.length, 3);
    assert.equal(result.therapists.rows[2].employeeId, "therapist-3");
    assert.equal(result.therapists.rows[2].totalCallCount, 0);
    assert.equal(result.therapists.rows[2].finalBasePayoutAmount, 0);
    assert.equal(result.operations.dailyIncentiveAmount, 100000);
    assert.equal(result.operations.monthlyIncentiveAmount, 3000000);
    assert.equal(result.operations.rows[0].totalOpsPayoutAmount, 3050000);
    assert.equal(result.earcare.earcarePoolTotal, 150000);
    assert.equal(result.earcare.distributedAmount, 100000);
    assert.equal(result.earcare.undistributedAmount, 50000);
    assert.equal(result.totals.therapistPayoutAmount, 2300000);
    assert.equal(result.totals.opsDailyIncentiveAmount, 100000);
    assert.equal(result.totals.opsMonthlyIncentiveAmount, 3000000);
    assert.equal(result.totals.earcarePayoutAmount, 100000);
    assert.equal(result.totals.grandPayoutAmount, 5500000);
    assert.equal(result.evidence.sourceDayCount, 2);
    assert.equal(result.evidence.includedCallCount, 8);
    assert.equal(result.evidence.excludedCallCount, 3);
    assert.equal(result.warningCounts.earcareNormalStaffZeroDays, 1);
    assert.equal(result.warningCounts.earcareUndistributedDays, 1);
    assert.equal(result.warningCounts.opsMonthly.coursePolicyMissing, 1);
    assert.equal(result.warningCounts.opsWarningMessageCount, 2);
    assert.equal(result.warningCounts.total, 18);
    assert.ok(result.operations.warningMessages.some((message) => message.includes("30콜 미만")));
    assert.ok(result.operations.warningMessages.some((message) => message.includes("카운터팀 대상자")));
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
