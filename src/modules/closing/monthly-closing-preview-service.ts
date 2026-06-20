import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getDailyCallLedgerSummary,
  listCompletedServiceCallCalculationsForOperatingMonth,
  type CompletedServiceCallCalculationDto,
  type DailyCallLedgerSummaryDto
} from "@/modules/calls/service-call-service";
import {
  listEarcareDailySettlements,
  type EarcareDailySettlementResultDto,
  type EarcareDailySettlementRowDto,
  type EarcareDailySettlementWarningCounts
} from "@/modules/settlements/earcare-daily-settlement-service";
import {
  listOpsDailyIncentives,
  type OpsDailyIncentiveResultDto,
  type OpsDailyIncentiveRowDto,
  type OpsDailyIncentiveWarningCounts
} from "@/modules/settlements/ops-daily-incentive-service";
import {
  listOpsMonthlyIncentivePreview,
  type OpsMonthlyIncentiveResultDto,
  type OpsMonthlyIncentiveWarningCounts
} from "@/modules/settlements/ops-monthly-incentive-service";
import {
  listTherapistDailySettlements,
  type TherapistCourseSettlementSummary,
  type TherapistDailySettlementDto,
  type TherapistDailySettlementResultDto
} from "@/modules/settlements/therapist-daily-settlement-service";
import { listTherapistFullAttendanceRecognitions } from "@/modules/settlements/therapist-attendance-service";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type ActiveTherapistRecord = {
  id: string;
  staffCode: string;
  displayName: string;
  sortOrder: number;
};

type MonthlyClosingPreviewPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findMany(args?: unknown): Promise<ActiveTherapistRecord[]>;
  };
};

type CourseCode = "A" | "B" | "C" | "D" | "E";

export type MonthlyClosingPreviewStatus = "draft_current" | "closed_current";

export type MonthlyClosingPreviewWarningCounts = {
  therapistCoursePolicyMissing: number;
  therapistRateMissing: number;
  therapistSecondTherapistRequired: number;
  therapistZeroPolicy: number;
  therapistExcludedCallCount: number;
  fullAttendanceSourceMissing: number;
  fullAttendanceSourceDayCount: number;
  countKingEligibleCount: number;
  countKingExcludedCount: number;
  opsDaily: OpsDailyIncentiveWarningCounts;
  opsMonthly: OpsMonthlyIncentiveWarningCounts;
  opsWarningMessageCount: number;
  earcare: EarcareDailySettlementWarningCounts;
  earcareNormalStaffZeroDays: number;
  earcareUndistributedDays: number;
  total: number;
};

export type MonthlyClosingTherapistRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  totalCallCount: number;
  monthlySettlementAmount: number;
  courseBreakdown: Record<CourseCode, TherapistCourseSettlementSummary>;
  assignmentEvidenceCount: number;
  warningCounts: TherapistDailySettlementDto["warningCounts"];
  fullAttendanceDays: number | null;
  fullAttendanceAllowanceAmount: number;
  fullAttendanceBasis: string;
  countKingRank: number | null;
  countKingBonusAmount: number;
  countKingBasis: string;
  finalPayoutAmount: number;
  bonusWarningMessages: string[];
};

export type TherapistFullAttendanceRecognitionResultDto = {
  sourceStatus: "available" | "missing_story_4_1_source";
  sourceDayCount: number;
  rows: Array<{
    employeeId: string;
    fullAttendanceDays: number;
  }>;
  warningMessages: string[];
};

export type MonthlyClosingOperationsRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  position: string;
  dailyIncentiveAmount: number;
  monthlyIncentiveAmount: number;
  totalOpsPayoutAmount: number;
  dailyEvidenceCount: number;
  monthlyCalculationBasis: string | null;
};

export type MonthlyClosingEarcareRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  eligibleDayCount: number;
  payoutAmount: number;
  calculationBasis: string;
};

export type MonthlyClosingFinancialsDto = {
  paymentTotal: number;
  netSales: number;
  discountTotal: number;
  expenseTotal: number;
  earcarePoolTotal: number;
  therapistCommissionTotal: number;
};

export type MonthlyClosingDashboardFinancialsDto = MonthlyClosingFinancialsDto & {
  earcarePayoutTotal: number;
  opsDailyIncentiveTotal: number;
  opsMonthlyIncentiveTotal: number;
  fullAttendanceAllowanceTotal: number;
  countKingBonusTotal: number;
  therapistPayoutTotal: number;
  dailyCostTotal: number;
  monthlyCostTotal: number;
  settlementPayoutTotal: number;
  netProfit: number;
};

export type MonthlyClosingGraphReportSnapshotDto = {
  dailyRevenueTrend: Array<{
    serviceDate: string;
    paymentTotal: number;
    netSales: number;
    completedCount: number;
  }>;
  courseMix: Array<{
    courseCode: CourseCode;
    completedCount: number;
    paymentTotal: number;
    callShare: number;
    revenueShare: number;
  }>;
  therapistCallRanking: Array<{
    employeeId: string;
    displayName: string;
    staffCode: string;
    assignedCallCount: number;
    therapist1Count: number;
    therapist2Count: number;
    totalCommissionAmount: number;
    evidenceCount: number;
  }>;
  noShowCancelTrend: Array<{
    serviceDate: string;
    noShowCount: number;
    canceledCount: number;
  }>;
  callLedgerWarnings: {
    coursePolicyMissing: number;
    therapistRateMissing: number;
    secondTherapistRequired: number;
  };
  totalStatusCount: number;
};

export type MonthlyClosingPreviewDto = {
  operatingMonthId: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  status: string;
  previewStatus: MonthlyClosingPreviewStatus;
  therapists: {
    rows: MonthlyClosingTherapistRowDto[];
    payoutAmount: number;
    totalCallCount: number;
  };
  operations: {
    dailyIncentiveAmount: number;
    monthlyIncentiveAmount: number;
    totalOpsPayoutAmount: number;
    monthlyOpsCallCredit: number;
    appliedThresholdCallCount: number | null;
    ruleStatus: OpsMonthlyIncentiveResultDto["ruleStatus"];
    warningMessages: string[];
    rows: MonthlyClosingOperationsRowDto[];
  };
  earcare: {
    earcarePoolTotal: number;
    distributedAmount: number;
    undistributedAmount: number;
    sourceCallCount: number;
    eligibleDayCount: number;
    rows: MonthlyClosingEarcareRowDto[];
  };
  financials: MonthlyClosingFinancialsDto;
  dashboardFinancials: MonthlyClosingDashboardFinancialsDto;
  graphReport: MonthlyClosingGraphReportSnapshotDto;
  totals: {
    therapistPayoutAmount: number;
    opsDailyIncentiveAmount: number;
    opsMonthlyIncentiveAmount: number;
    earcarePayoutAmount: number;
    grandPayoutAmount: number;
  };
  warningCounts: MonthlyClosingPreviewWarningCounts;
  evidence: {
    period: string;
    sourceDayCount: number;
    includedCallCount: number;
    excludedCallCount: number;
    fullAttendanceSourceStatus: TherapistFullAttendanceRecognitionResultDto["sourceStatus"];
    fullAttendanceSourceDayCount: number;
    countKingEligibleCount: number;
    countKingExcludedCount: number;
    countKingTieBreaker: string;
    policyWarningCount: number;
    warningCount: number;
    representativeEvidence: {
      therapist: string[];
      operationsDaily: string[];
      operationsMonthly: string[];
      earcare: string[];
    };
  };
};

export class MonthlyClosingPreviewDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MonthlyClosingPreviewDomainError";
  }
}

export type MonthlyClosingPreviewDependencies = {
  listTherapistDailySettlements: typeof listTherapistDailySettlements;
  listTherapistFullAttendanceRecognitions?: (input: {
    operatingMonthId: string;
    startDate: string;
    endDate: string;
    prismaClient?: unknown;
  }) => Promise<TherapistFullAttendanceRecognitionResultDto>;
  listOpsDailyIncentives: typeof listOpsDailyIncentives;
  listOpsMonthlyIncentivePreview: typeof listOpsMonthlyIncentivePreview;
  listEarcareDailySettlements: typeof listEarcareDailySettlements;
  getDailyCallLedgerSummary: typeof getDailyCallLedgerSummary;
  listCompletedServiceCallCalculationsForOperatingMonth: typeof listCompletedServiceCallCalculationsForOperatingMonth;
};

const previewQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

// Story 4.1 wires the real therapist attendance source. The closing preview keeps its own
// `missing_story_4_1_source` fallback for callers that omit this dependency, but the default
// path now consumes actual `TherapistAttendance` recognition data.
async function defaultTherapistFullAttendanceRecognitions(input: {
  operatingMonthId: string;
  startDate: string;
  endDate: string;
  prismaClient?: unknown;
}): Promise<TherapistFullAttendanceRecognitionResultDto> {
  const result = await listTherapistFullAttendanceRecognitions({
    operatingMonthId: input.operatingMonthId,
    startDate: input.startDate,
    endDate: input.endDate,
    prismaClient: input.prismaClient as Parameters<typeof listTherapistFullAttendanceRecognitions>[0]["prismaClient"]
  });
  return {
    sourceStatus: "available",
    sourceDayCount: result.sourceDayCount,
    rows: result.rows,
    warningMessages: []
  };
}

const defaultDependencies: MonthlyClosingPreviewDependencies = {
  listTherapistDailySettlements,
  listTherapistFullAttendanceRecognitions: defaultTherapistFullAttendanceRecognitions,
  listOpsDailyIncentives,
  listOpsMonthlyIncentivePreview,
  listEarcareDailySettlements,
  getDailyCallLedgerSummary,
  listCompletedServiceCallCalculationsForOperatingMonth
};

const courseCodes = ["A", "B", "C", "D", "E"] as const;
const FULL_ATTENDANCE_THRESHOLD_DAYS = 20;
const FULL_ATTENDANCE_ALLOWANCE_AMOUNT = 2_000_000;
const COUNT_KING_MIN_CALLS = 40;
const COUNT_KING_BONUS_BY_RANK = {
  1: 5_000_000,
  2: 3_000_000,
  3: 1_000_000
} as const;
const COUNT_KING_TIE_BREAKER_BASIS = "tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc";

function getClient(client?: MonthlyClosingPreviewPrismaClient) {
  return client ?? (prisma as unknown as MonthlyClosingPreviewPrismaClient);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toFieldError(error: z.ZodError) {
  return new MonthlyClosingPreviewDomainError(
    error.issues[0]?.message ?? "월마감 미리보기 조회 조건이 올바르지 않습니다.",
    "INVALID_MONTHLY_CLOSING_PREVIEW_INPUT"
  );
}

function previewStatusFor(status: string): MonthlyClosingPreviewStatus {
  return status === "마감확정" || status === "잠금" ? "closed_current" : "draft_current";
}

function dateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return dates;
}

function emptyCourseBreakdown(): Record<CourseCode, TherapistCourseSettlementSummary> {
  return Object.fromEntries(
    courseCodes.map((courseCode) => [courseCode, { courseCode, callCount: 0, commissionAmount: 0 }])
  ) as Record<CourseCode, TherapistCourseSettlementSummary>;
}

function addWarningCounts(target: Record<string, number>, source: Record<string, number>) {
  for (const key of Object.keys(target)) {
    target[key] += source[key] ?? 0;
  }
}

function addTherapistBreakdown(
  target: Record<CourseCode, TherapistCourseSettlementSummary>,
  source: Record<CourseCode, TherapistCourseSettlementSummary>
) {
  for (const courseCode of courseCodes) {
    target[courseCode].callCount += source[courseCode].callCount;
    target[courseCode].commissionAmount += source[courseCode].commissionAmount;
  }
}

function createMonthlyTherapistRow(therapist: ActiveTherapistRecord): MonthlyClosingTherapistRowDto {
  return {
    employeeId: therapist.id,
    staffCode: therapist.staffCode,
    displayName: therapist.displayName,
    totalCallCount: 0,
    monthlySettlementAmount: 0,
    courseBreakdown: emptyCourseBreakdown(),
    assignmentEvidenceCount: 0,
    warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
    fullAttendanceDays: null,
    fullAttendanceAllowanceAmount: 0,
    fullAttendanceBasis: "Story 4.1 만근 인정 source 없음",
    countKingRank: null,
    countKingBonusAmount: 0,
    countKingBasis: "월 총콜 0콜 / 40콜 미만 제외",
    finalPayoutAmount: 0,
    bonusWarningMessages: []
  };
}

function missingFullAttendanceResult(): TherapistFullAttendanceRecognitionResultDto {
  return {
    sourceStatus: "missing_story_4_1_source",
    sourceDayCount: 0,
    rows: [],
    warningMessages: ["Story 4.1 마사지사 출퇴근/만근 인정 source가 없어 만근수당을 계산하지 않았습니다."]
  };
}

function applyFullAttendanceAllowances(rows: MonthlyClosingTherapistRowDto[], result: TherapistFullAttendanceRecognitionResultDto) {
  const daysByEmployeeId = new Map(result.rows.map((row) => [row.employeeId, row.fullAttendanceDays]));
  const sourceMissing = result.sourceStatus === "missing_story_4_1_source";

  for (const row of rows) {
    if (sourceMissing) {
      row.fullAttendanceDays = null;
      row.fullAttendanceAllowanceAmount = 0;
      row.fullAttendanceBasis = "Story 4.1 만근 인정 source 없음";
      row.bonusWarningMessages.push(...result.warningMessages);
      continue;
    }

    const days = daysByEmployeeId.get(row.employeeId) ?? 0;
    row.fullAttendanceDays = days;
    row.fullAttendanceAllowanceAmount = days >= FULL_ATTENDANCE_THRESHOLD_DAYS ? FULL_ATTENDANCE_ALLOWANCE_AMOUNT : 0;
    row.fullAttendanceBasis =
      days >= FULL_ATTENDANCE_THRESHOLD_DAYS
        ? `만근 인정 ${days}일 / 20일 이상 2,000,000 VND`
        : `만근 인정 ${days}일 / 20일 미만`;
  }
}

function applyCountKingBonuses(rows: MonthlyClosingTherapistRowDto[]) {
  const eligibleRows = rows
    .filter((row) => row.totalCallCount >= COUNT_KING_MIN_CALLS)
    .sort(
      (a, b) =>
        b.totalCallCount - a.totalCallCount ||
        b.monthlySettlementAmount - a.monthlySettlementAmount ||
        a.staffCode.localeCompare(b.staffCode) ||
        a.employeeId.localeCompare(b.employeeId)
    );
  const topRows = eligibleRows.slice(0, 3);
  const rankByEmployeeId = new Map(topRows.map((row, index) => [row.employeeId, (index + 1) as keyof typeof COUNT_KING_BONUS_BY_RANK]));

  for (const row of rows) {
    const rank = rankByEmployeeId.get(row.employeeId) ?? null;
    if (rank) {
      const amount = COUNT_KING_BONUS_BY_RANK[rank];
      row.countKingRank = rank;
      row.countKingBonusAmount = amount;
      row.countKingBasis = `월 총콜 ${row.totalCallCount}콜 / 40콜 이상 / ${rank}위 ${amount.toLocaleString("ko-KR")} VND / ${COUNT_KING_TIE_BREAKER_BASIS}`;
    } else if (row.totalCallCount >= COUNT_KING_MIN_CALLS) {
      row.countKingRank = null;
      row.countKingBonusAmount = 0;
      row.countKingBasis = `월 총콜 ${row.totalCallCount}콜 / 40콜 이상이나 1~3위 밖 / ${COUNT_KING_TIE_BREAKER_BASIS}`;
    } else {
      row.countKingRank = null;
      row.countKingBonusAmount = 0;
      row.countKingBasis = `월 총콜 ${row.totalCallCount}콜 / 40콜 미만 제외`;
    }
  }

  return {
    eligibleCount: eligibleRows.length,
    excludedCount: rows.length - eligibleRows.length
  };
}

function finalizeTherapistPayouts(rows: MonthlyClosingTherapistRowDto[]) {
  for (const row of rows) {
    row.finalPayoutAmount = row.monthlySettlementAmount + row.fullAttendanceAllowanceAmount + row.countKingBonusAmount;
  }
}

function aggregateTherapists(
  dailyResults: TherapistDailySettlementResultDto[],
  activeTherapists: ActiveTherapistRecord[],
  fullAttendanceResult: TherapistFullAttendanceRecognitionResultDto
) {
  const rowsByEmployeeId = new Map<string, MonthlyClosingTherapistRowDto>();
  const warningCounts = {
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0,
    zeroPolicy: 0,
    missingPolicy: 0,
    excludedCallCount: 0
  };

  for (const therapist of activeTherapists) {
    rowsByEmployeeId.set(therapist.id, createMonthlyTherapistRow(therapist));
  }

  for (const result of dailyResults) {
    warningCounts.coursePolicyMissing += result.warningCounts.coursePolicyMissing;
    warningCounts.therapistRateMissing += result.warningCounts.therapistRateMissing;
    warningCounts.secondTherapistRequired += result.warningCounts.secondTherapistRequired;
    warningCounts.excludedCallCount += result.excludedCallCount;

    for (const dailyRow of result.settlements) {
      if (!rowsByEmployeeId.has(dailyRow.employeeId)) {
        rowsByEmployeeId.set(
          dailyRow.employeeId,
          createMonthlyTherapistRow({
            id: dailyRow.employeeId,
            staffCode: dailyRow.staffCode,
            displayName: dailyRow.displayName,
            sortOrder: dailyRow.sortOrder
          })
        );
      }

      const row = rowsByEmployeeId.get(dailyRow.employeeId);
      if (!row) continue;
      row.totalCallCount += dailyRow.totalCallCount;
      row.monthlySettlementAmount += dailyRow.totalCommissionAmount;
      row.assignmentEvidenceCount += dailyRow.assignmentEvidence.length;
      row.warningCounts.zeroPolicy += dailyRow.warningCounts.zeroPolicy;
      row.warningCounts.missingPolicy += dailyRow.warningCounts.missingPolicy;
      warningCounts.zeroPolicy += dailyRow.warningCounts.zeroPolicy;
      warningCounts.missingPolicy += dailyRow.warningCounts.missingPolicy;
      addTherapistBreakdown(row.courseBreakdown, dailyRow.courseBreakdown);
    }
  }

  const rows = [...rowsByEmployeeId.values()].sort((a, b) => a.staffCode.localeCompare(b.staffCode) || a.employeeId.localeCompare(b.employeeId));
  applyFullAttendanceAllowances(rows, fullAttendanceResult);
  const countKing = applyCountKingBonuses(rows);
  finalizeTherapistPayouts(rows);
  return {
    rows,
    payoutAmount: rows.reduce((sum, row) => sum + row.finalPayoutAmount, 0),
    totalCallCount: rows.reduce((sum, row) => sum + row.totalCallCount, 0),
    warningCounts,
    fullAttendanceSourceStatus: fullAttendanceResult.sourceStatus,
    fullAttendanceSourceMissing: fullAttendanceResult.sourceStatus === "missing_story_4_1_source" ? 1 : 0,
    fullAttendanceSourceDayCount: fullAttendanceResult.sourceDayCount,
    countKingEligibleCount: countKing.eligibleCount,
    countKingExcludedCount: countKing.excludedCount
  };
}

function createOpsRowFromDaily(row: OpsDailyIncentiveRowDto): MonthlyClosingOperationsRowDto {
  // Employee.id is the stable downstream merge key for closing preview rows.
  return {
    employeeId: row.employeeId,
    staffCode: row.staffCode,
    displayName: row.displayName,
    position: row.position,
    dailyIncentiveAmount: 0,
    monthlyIncentiveAmount: 0,
    totalOpsPayoutAmount: 0,
    dailyEvidenceCount: 0,
    monthlyCalculationBasis: null
  };
}

function aggregateOperations(dailyResults: OpsDailyIncentiveResultDto[], monthlyResult: OpsMonthlyIncentiveResultDto) {
  const rowsByEmployeeId = new Map<string, MonthlyClosingOperationsRowDto>();
  const dailyWarningCounts: OpsDailyIncentiveWarningCounts = {
    notCompleted: 0,
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0
  };
  const warningMessages = dailyResults
    .map((result) => result.warningMessage)
    .filter((message): message is string => Boolean(message));
  if (monthlyResult.warningMessage) warningMessages.push(monthlyResult.warningMessage);

  for (const result of dailyResults) {
    addWarningCounts(dailyWarningCounts, result.warningCounts);
    for (const dailyRow of result.rows) {
      if (!rowsByEmployeeId.has(dailyRow.employeeId)) {
        rowsByEmployeeId.set(dailyRow.employeeId, createOpsRowFromDaily(dailyRow));
      }
      const row = rowsByEmployeeId.get(dailyRow.employeeId);
      if (!row) continue;
      row.dailyIncentiveAmount += dailyRow.payoutAmount;
      row.totalOpsPayoutAmount += dailyRow.payoutAmount;
      row.dailyEvidenceCount += dailyRow.payoutAmount > 0 ? 1 : 0;
    }
  }

  for (const monthlyRow of monthlyResult.rows) {
    if (!rowsByEmployeeId.has(monthlyRow.employeeId)) {
      rowsByEmployeeId.set(monthlyRow.employeeId, {
        employeeId: monthlyRow.employeeId,
        staffCode: monthlyRow.staffCode,
        displayName: monthlyRow.displayName,
        position: monthlyRow.position,
        dailyIncentiveAmount: 0,
        monthlyIncentiveAmount: 0,
        totalOpsPayoutAmount: 0,
        dailyEvidenceCount: 0,
        monthlyCalculationBasis: null
      });
    }
    const row = rowsByEmployeeId.get(monthlyRow.employeeId);
    if (!row) continue;
    row.monthlyIncentiveAmount += monthlyRow.payoutAmount;
    row.totalOpsPayoutAmount += monthlyRow.payoutAmount;
    row.monthlyCalculationBasis = monthlyRow.calculationBasis;
  }

  const rows = [...rowsByEmployeeId.values()].sort((a, b) => a.staffCode.localeCompare(b.staffCode) || a.employeeId.localeCompare(b.employeeId));
  const dailyIncentiveAmount = dailyResults.reduce((sum, result) => sum + result.distributedAmount, 0);
  const monthlyIncentiveAmount = monthlyResult.rows.reduce((sum, row) => sum + row.payoutAmount, 0);

  return {
    dailyIncentiveAmount,
    monthlyIncentiveAmount,
    totalOpsPayoutAmount: dailyIncentiveAmount + monthlyIncentiveAmount,
    monthlyOpsCallCredit: monthlyResult.monthlyOpsCallCredit,
    appliedThresholdCallCount: monthlyResult.appliedThresholdCallCount,
    ruleStatus: monthlyResult.ruleStatus,
    warningMessages,
    rows,
    warningCounts: {
      daily: dailyWarningCounts,
      monthly: monthlyResult.warningCounts,
      warningMessageCount: warningMessages.length
    },
    sourceCallCount: dailyResults.reduce((sum, result) => sum + result.sourceCallCount, 0)
  };
}

function createEarcareRow(row: EarcareDailySettlementRowDto): MonthlyClosingEarcareRowDto {
  return {
    employeeId: row.employeeId,
    staffCode: row.staffCode,
    displayName: row.displayName,
    eligibleDayCount: 0,
    payoutAmount: 0,
    calculationBasis: row.calculationBasis
  };
}

function aggregateEarcare(dailyResults: EarcareDailySettlementResultDto[]) {
  const rowsByEmployeeId = new Map<string, MonthlyClosingEarcareRowDto>();
  const warningCounts: EarcareDailySettlementWarningCounts = {
    notCompleted: 0,
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0
  };
  let normalStaffZeroDays = 0;
  let undistributedDays = 0;

  for (const result of dailyResults) {
    addWarningCounts(warningCounts, result.warningCounts);
    if (result.earcarePoolTotal > 0 && result.eligibleCount === 0) normalStaffZeroDays += 1;
    if (result.undistributedAmount > 0) undistributedDays += 1;

    for (const dailyRow of result.rows) {
      if (!rowsByEmployeeId.has(dailyRow.employeeId)) {
        rowsByEmployeeId.set(dailyRow.employeeId, createEarcareRow(dailyRow));
      }
      const row = rowsByEmployeeId.get(dailyRow.employeeId);
      if (!row) continue;
      if (dailyRow.isPayoutEligible) row.eligibleDayCount += 1;
      row.payoutAmount += dailyRow.payoutAmount;
      row.calculationBasis = dailyRow.calculationBasis;
    }
  }

  const rows = [...rowsByEmployeeId.values()].sort((a, b) => a.staffCode.localeCompare(b.staffCode) || a.employeeId.localeCompare(b.employeeId));
  return {
    rows,
    earcarePoolTotal: dailyResults.reduce((sum, result) => sum + result.earcarePoolTotal, 0),
    distributedAmount: dailyResults.reduce((sum, result) => sum + result.distributedAmount, 0),
    undistributedAmount: dailyResults.reduce((sum, result) => sum + result.undistributedAmount, 0),
    sourceCallCount: dailyResults.reduce((sum, result) => sum + result.sourceCallCount, 0),
    eligibleDayCount: dailyResults.reduce((sum, result) => sum + result.eligibleCount, 0),
    warningCounts,
    normalStaffZeroDays,
    undistributedDays
  };
}

function aggregateFinancials(dailyResults: DailyCallLedgerSummaryDto[]): MonthlyClosingFinancialsDto {
  return dailyResults.reduce(
    (totals, result) => ({
      paymentTotal: totals.paymentTotal + result.paymentTotal,
      netSales: totals.netSales + result.netSales,
      discountTotal: totals.discountTotal + result.discountTotal,
      expenseTotal: totals.expenseTotal + result.expenseTotal,
      earcarePoolTotal: totals.earcarePoolTotal + result.earcarePoolTotal,
      therapistCommissionTotal: totals.therapistCommissionTotal + result.therapistCommissionTotal
    }),
    {
      paymentTotal: 0,
      netSales: 0,
      discountTotal: 0,
      expenseTotal: 0,
      earcarePoolTotal: 0,
      therapistCommissionTotal: 0
    }
  );
}

function dashboardNetProfit(input: {
  paymentTotal: number;
  expenseTotal: number;
  therapistPayoutTotal: number;
  earcarePayoutTotal: number;
  opsDailyIncentiveTotal: number;
  opsMonthlyIncentiveTotal: number;
}) {
  return (
    input.paymentTotal -
    input.expenseTotal -
    input.therapistPayoutTotal -
    input.earcarePayoutTotal -
    input.opsDailyIncentiveTotal -
    input.opsMonthlyIncentiveTotal
  );
}

function aggregateDashboardFinancials(input: {
  financials: MonthlyClosingFinancialsDto;
  therapists: ReturnType<typeof aggregateTherapists>;
  operations: ReturnType<typeof aggregateOperations>;
  earcare: ReturnType<typeof aggregateEarcare>;
}): MonthlyClosingDashboardFinancialsDto {
  const fullAttendanceAllowanceTotal = input.therapists.rows.reduce((sum, row) => sum + row.fullAttendanceAllowanceAmount, 0);
  const countKingBonusTotal = input.therapists.rows.reduce((sum, row) => sum + row.countKingBonusAmount, 0);
  const therapistPayoutTotal = input.therapists.payoutAmount;
  const earcarePayoutTotal = input.earcare.distributedAmount;
  const opsDailyIncentiveTotal = input.operations.dailyIncentiveAmount;
  const opsMonthlyIncentiveTotal = input.operations.monthlyIncentiveAmount;
  const dailyCostTotal =
    input.financials.expenseTotal + input.financials.therapistCommissionTotal + earcarePayoutTotal + opsDailyIncentiveTotal;
  const monthlyCostTotal = fullAttendanceAllowanceTotal + countKingBonusTotal + opsMonthlyIncentiveTotal;

  return {
    ...input.financials,
    earcarePayoutTotal,
    opsDailyIncentiveTotal,
    opsMonthlyIncentiveTotal,
    fullAttendanceAllowanceTotal,
    countKingBonusTotal,
    therapistPayoutTotal,
    dailyCostTotal,
    monthlyCostTotal,
    settlementPayoutTotal: therapistPayoutTotal + earcarePayoutTotal + opsDailyIncentiveTotal + opsMonthlyIncentiveTotal,
    netProfit: dashboardNetProfit({
      paymentTotal: input.financials.paymentTotal,
      expenseTotal: input.financials.expenseTotal,
      therapistPayoutTotal,
      earcarePayoutTotal,
      opsDailyIncentiveTotal,
      opsMonthlyIncentiveTotal
    })
  };
}

function emptyGraphCourseMix(): MonthlyClosingGraphReportSnapshotDto["courseMix"] {
  return courseCodes.map((courseCode) => ({
    courseCode,
    completedCount: 0,
    paymentTotal: 0,
    callShare: 0,
    revenueShare: 0
  }));
}

function aggregateGraphCourseMix(calculations: CompletedServiceCallCalculationDto[]): MonthlyClosingGraphReportSnapshotDto["courseMix"] {
  const courseMix = emptyGraphCourseMix();
  const byCode = new Map(courseMix.map((row) => [row.courseCode, row]));
  for (const calculation of calculations) {
    const row = byCode.get(calculation.courseCode as CourseCode);
    if (!row) continue;
    row.completedCount += 1;
    row.paymentTotal += calculation.paymentAmount;
  }

  const totalCalls = courseMix.reduce((sum, row) => sum + row.completedCount, 0);
  const totalRevenue = courseMix.reduce((sum, row) => sum + row.paymentTotal, 0);
  return courseMix.map((row) => ({
    ...row,
    callShare: totalCalls > 0 ? row.completedCount / totalCalls : 0,
    revenueShare: totalRevenue > 0 ? row.paymentTotal / totalRevenue : 0
  }));
}

function aggregateGraphTherapistRanking(results: TherapistDailySettlementResultDto[]): MonthlyClosingGraphReportSnapshotDto["therapistCallRanking"] {
  const rankings = new Map<string, MonthlyClosingGraphReportSnapshotDto["therapistCallRanking"][number]>();

  for (const result of results) {
    for (const settlement of result.settlements) {
      const current =
        rankings.get(settlement.employeeId) ??
        {
          employeeId: settlement.employeeId,
          displayName: settlement.displayName,
          staffCode: settlement.staffCode,
          assignedCallCount: 0,
          therapist1Count: 0,
          therapist2Count: 0,
          totalCommissionAmount: 0,
          evidenceCount: 0
        };
      current.assignedCallCount += settlement.totalCallCount;
      current.totalCommissionAmount += settlement.totalCommissionAmount;
      current.evidenceCount += settlement.assignmentEvidence.length;
      for (const evidence of settlement.assignmentEvidence) {
        if (evidence.role === "THERAPIST_1") current.therapist1Count += 1;
        if (evidence.role === "THERAPIST_2") current.therapist2Count += 1;
      }
      rankings.set(settlement.employeeId, current);
    }
  }

  return [...rankings.values()].sort(
    (left, right) =>
      right.assignedCallCount - left.assignedCallCount ||
      right.totalCommissionAmount - left.totalCommissionAmount ||
      left.staffCode.localeCompare(right.staffCode)
  );
}

function aggregateGraphReport(input: {
  dates: string[];
  dailyResults: DailyCallLedgerSummaryDto[];
  completedCalculations: CompletedServiceCallCalculationDto[];
  therapistDailyResults: TherapistDailySettlementResultDto[];
}): MonthlyClosingGraphReportSnapshotDto {
  const callLedgerWarnings = input.dailyResults.reduce(
    (totals, result) => ({
      coursePolicyMissing: totals.coursePolicyMissing + result.warningCounts.coursePolicyMissing,
      therapistRateMissing: totals.therapistRateMissing + result.warningCounts.therapistRateMissing,
      secondTherapistRequired: totals.secondTherapistRequired + result.warningCounts.secondTherapistRequired
    }),
    { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 }
  );

  return {
    dailyRevenueTrend: input.dates.map((serviceDate, index) => {
      const result = input.dailyResults[index] ?? financialEmptyDayResult();
      return {
        serviceDate,
        paymentTotal: result.paymentTotal,
        netSales: result.netSales,
        completedCount: result.completedCount
      };
    }),
    courseMix: aggregateGraphCourseMix(input.completedCalculations),
    therapistCallRanking: aggregateGraphTherapistRanking(input.therapistDailyResults),
    noShowCancelTrend: input.dates.map((serviceDate, index) => {
      const result = input.dailyResults[index] ?? financialEmptyDayResult();
      return {
        serviceDate,
        noShowCount: result.noShowCount,
        canceledCount: result.canceledCount
      };
    }),
    callLedgerWarnings,
    totalStatusCount: input.dailyResults.reduce(
      (sum, result) =>
        sum + result.reservationCount + result.inUseCount + result.cleaningCount + result.completedCount + result.noShowCount + result.canceledCount,
      0
    )
  };
}

function financialEmptyDayResult(): DailyCallLedgerSummaryDto {
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
    paymentMethodTotals: { cash: 0, card: 0, bank: 0, other: 0 },
    courseSummaries: [],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 }
  };
}

function representativeEvidence(input: {
  therapists: TherapistDailySettlementResultDto[];
  opsDaily: OpsDailyIncentiveResultDto[];
  opsMonthly: OpsMonthlyIncentiveResultDto;
  earcare: EarcareDailySettlementResultDto[];
}) {
  return {
    therapist: input.therapists.flatMap((result) => result.settlements.flatMap((row) => row.assignmentEvidence.map((evidence) => evidence.serviceCallId))).slice(0, 5),
    operationsDaily: input.opsDaily.flatMap((result) => result.callEvidence.map((evidence) => evidence.serviceCallId)).slice(0, 5),
    operationsMonthly: input.opsMonthly.callEvidence.map((evidence) => evidence.serviceCallId).slice(0, 5),
    earcare: input.earcare.flatMap((result) => result.poolEvidence.map((evidence) => evidence.serviceCallId)).slice(0, 5)
  };
}

function warningTotal(input: {
  therapists: ReturnType<typeof aggregateTherapists>;
  operations: ReturnType<typeof aggregateOperations>["warningCounts"];
  earcare: ReturnType<typeof aggregateEarcare>;
}) {
  const opsDaily =
    input.operations.daily.notCompleted +
    input.operations.daily.coursePolicyMissing +
    input.operations.daily.therapistRateMissing +
    input.operations.daily.secondTherapistRequired;
  const opsMonthly =
    input.operations.monthly.notCompleted +
    input.operations.monthly.coursePolicyMissing +
    input.operations.monthly.therapistRateMissing +
    input.operations.monthly.secondTherapistRequired;
  const earcareWarnings =
    input.earcare.warningCounts.notCompleted +
    input.earcare.warningCounts.coursePolicyMissing +
    input.earcare.warningCounts.therapistRateMissing +
    input.earcare.warningCounts.secondTherapistRequired;

  return (
    input.therapists.warningCounts.coursePolicyMissing +
    input.therapists.warningCounts.therapistRateMissing +
    input.therapists.warningCounts.secondTherapistRequired +
    input.therapists.warningCounts.zeroPolicy +
    input.therapists.warningCounts.missingPolicy +
    input.therapists.warningCounts.excludedCallCount +
    input.therapists.fullAttendanceSourceMissing +
    opsDaily +
    opsMonthly +
    input.operations.warningMessageCount +
    earcareWarnings +
    input.earcare.normalStaffZeroDays +
    input.earcare.undistributedDays
  );
}

export async function listMonthlyClosingPreview(input: {
  operatingMonthId: string;
  prismaClient?: MonthlyClosingPreviewPrismaClient;
  dependencies?: MonthlyClosingPreviewDependencies;
}): Promise<MonthlyClosingPreviewDto> {
  const parsed = previewQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);

  const client = getClient(input.prismaClient);
  const dependencies = { ...defaultDependencies, ...input.dependencies };
  const [operatingMonth, activeTherapists] = await Promise.all([
    client.operatingMonth.findUnique({
      where: { id: parsed.data.operatingMonthId },
      select: { id: true, monthKey: true, startDate: true, endDate: true, status: true }
    }),
    client.employee.findMany({
      where: { employeeGroup: "THERAPIST", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }, { id: "asc" }],
      select: { id: true, staffCode: true, displayName: true, sortOrder: true }
    })
  ]);

  if (!operatingMonth) {
    throw new MonthlyClosingPreviewDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (startDate > endDate) {
    throw new MonthlyClosingPreviewDomainError("운영월 날짜 범위가 올바르지 않습니다.", "INVALID_OPERATING_MONTH_DATE_RANGE");
  }

  const dates = dateRange(startDate, endDate);
  const therapistDailyResults: TherapistDailySettlementResultDto[] = [];
  const opsDailyResults: OpsDailyIncentiveResultDto[] = [];
  const earcareDailyResults: EarcareDailySettlementResultDto[] = [];
  const financialDailyResults: DailyCallLedgerSummaryDto[] = [];

  for (const serviceDate of dates) {
    therapistDailyResults.push(
      await dependencies.listTherapistDailySettlements({
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        prismaClient: client as unknown as Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]
      })
    );
  }

  const fullAttendanceResult = dependencies.listTherapistFullAttendanceRecognitions
    ? await dependencies.listTherapistFullAttendanceRecognitions({
        operatingMonthId: parsed.data.operatingMonthId,
        startDate,
        endDate,
        prismaClient: client
      })
    : missingFullAttendanceResult();

  for (const serviceDate of dates) {
    opsDailyResults.push(
      await dependencies.listOpsDailyIncentives({
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        prismaClient: client as unknown as Parameters<typeof listOpsDailyIncentives>[0]["prismaClient"]
      })
    );
  }

  const opsMonthlyResult = await dependencies.listOpsMonthlyIncentivePreview({
    operatingMonthId: parsed.data.operatingMonthId,
    prismaClient: client as unknown as Parameters<typeof listOpsMonthlyIncentivePreview>[0]["prismaClient"]
  });

  for (const serviceDate of dates) {
    earcareDailyResults.push(
      await dependencies.listEarcareDailySettlements({
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        prismaClient: client as unknown as Parameters<typeof listEarcareDailySettlements>[0]["prismaClient"]
      })
    );
  }

  for (const serviceDate of dates) {
    financialDailyResults.push(
      await dependencies.getDailyCallLedgerSummary({
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        prismaClient: client as unknown as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
      })
    );
  }
  const completedCalculations = await dependencies.listCompletedServiceCallCalculationsForOperatingMonth({
    operatingMonthId: parsed.data.operatingMonthId,
    startDate,
    endDate,
    prismaClient: client as unknown as Parameters<typeof listCompletedServiceCallCalculationsForOperatingMonth>[0]["prismaClient"]
  });

  const therapists = aggregateTherapists(therapistDailyResults, activeTherapists, fullAttendanceResult);
  const operations = aggregateOperations(opsDailyResults, opsMonthlyResult);
  const earcare = aggregateEarcare(earcareDailyResults);
  const financials = aggregateFinancials(financialDailyResults);
  const dashboardFinancials = aggregateDashboardFinancials({ financials, therapists, operations, earcare });
  const graphReport = aggregateGraphReport({ dates, dailyResults: financialDailyResults, completedCalculations, therapistDailyResults });
  const total = warningTotal({ therapists, operations: operations.warningCounts, earcare });
  const policyWarningCount =
    therapists.warningCounts.coursePolicyMissing +
    operations.warningCounts.daily.coursePolicyMissing +
    operations.warningCounts.monthly.coursePolicyMissing +
    earcare.warningCounts.coursePolicyMissing;

  return {
    operatingMonthId: operatingMonth.id,
    monthKey: operatingMonth.monthKey,
    startDate,
    endDate,
    status: operatingMonth.status,
    previewStatus: previewStatusFor(operatingMonth.status),
    therapists: {
      rows: therapists.rows,
      payoutAmount: therapists.payoutAmount,
      totalCallCount: therapists.totalCallCount
    },
    operations: {
      dailyIncentiveAmount: operations.dailyIncentiveAmount,
      monthlyIncentiveAmount: operations.monthlyIncentiveAmount,
      totalOpsPayoutAmount: operations.totalOpsPayoutAmount,
      monthlyOpsCallCredit: operations.monthlyOpsCallCredit,
      appliedThresholdCallCount: operations.appliedThresholdCallCount,
      ruleStatus: operations.ruleStatus,
      warningMessages: operations.warningMessages,
      rows: operations.rows
    },
    earcare: {
      rows: earcare.rows,
      earcarePoolTotal: earcare.earcarePoolTotal,
      distributedAmount: earcare.distributedAmount,
      undistributedAmount: earcare.undistributedAmount,
      sourceCallCount: earcare.sourceCallCount,
      eligibleDayCount: earcare.eligibleDayCount
    },
    financials,
    dashboardFinancials,
    graphReport,
    totals: {
      therapistPayoutAmount: therapists.payoutAmount,
      opsDailyIncentiveAmount: operations.dailyIncentiveAmount,
      opsMonthlyIncentiveAmount: operations.monthlyIncentiveAmount,
      earcarePayoutAmount: earcare.distributedAmount,
      grandPayoutAmount: therapists.payoutAmount + operations.dailyIncentiveAmount + operations.monthlyIncentiveAmount + earcare.distributedAmount
    },
    warningCounts: {
      therapistCoursePolicyMissing: therapists.warningCounts.coursePolicyMissing,
      therapistRateMissing: therapists.warningCounts.therapistRateMissing + therapists.warningCounts.missingPolicy,
      therapistSecondTherapistRequired: therapists.warningCounts.secondTherapistRequired,
      therapistZeroPolicy: therapists.warningCounts.zeroPolicy,
      therapistExcludedCallCount: therapists.warningCounts.excludedCallCount,
      fullAttendanceSourceMissing: therapists.fullAttendanceSourceMissing,
      fullAttendanceSourceDayCount: therapists.fullAttendanceSourceDayCount,
      countKingEligibleCount: therapists.countKingEligibleCount,
      countKingExcludedCount: therapists.countKingExcludedCount,
      opsDaily: operations.warningCounts.daily,
      opsMonthly: operations.warningCounts.monthly,
      opsWarningMessageCount: operations.warningCounts.warningMessageCount,
      earcare: earcare.warningCounts,
      earcareNormalStaffZeroDays: earcare.normalStaffZeroDays,
      earcareUndistributedDays: earcare.undistributedDays,
      total
    },
    evidence: {
      period: `${startDate} ~ ${endDate}`,
      sourceDayCount: dates.length,
      includedCallCount: therapists.totalCallCount + operations.sourceCallCount + earcare.sourceCallCount,
      excludedCallCount: therapists.warningCounts.excludedCallCount,
      fullAttendanceSourceStatus: therapists.fullAttendanceSourceStatus,
      fullAttendanceSourceDayCount: therapists.fullAttendanceSourceDayCount,
      countKingEligibleCount: therapists.countKingEligibleCount,
      countKingExcludedCount: therapists.countKingExcludedCount,
      countKingTieBreaker: COUNT_KING_TIE_BREAKER_BASIS,
      policyWarningCount,
      warningCount: total,
      representativeEvidence: representativeEvidence({
        therapists: therapistDailyResults,
        opsDaily: opsDailyResults,
        opsMonthly: opsMonthlyResult,
        earcare: earcareDailyResults
      })
    }
  };
}
