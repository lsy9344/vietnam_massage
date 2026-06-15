import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  getDailyCallLedgerSummary,
  listCompletedServiceCallCalculationsForOperatingMonth,
  type CompletedServiceCallCalculationDto,
  type DailyCourseSummaryDto
} from "@/modules/calls/service-call-service";
import {
  getMonthlyClosingSnapshot,
  MonthlyClosingDomainError,
  type MonthlyClosingDto
} from "@/modules/closing/monthly-closing-service";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto
} from "@/modules/closing/monthly-closing-preview-service";
import {
  listTherapistDailySettlements,
  type TherapistDailySettlementDto
} from "@/modules/settlements/therapist-daily-settlement-service";
import { listOpsDailyIncentives } from "@/modules/settlements/ops-daily-incentive-service";
import { listEarcareDailySettlements } from "@/modules/settlements/earcare-daily-settlement-service";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import type { RoomDisplayStatus } from "@/modules/rooms/dtos";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type TodayDashboardPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
};

type DashboardPrismaClient = TodayDashboardPrismaClient;

type CourseCode = "A" | "B" | "C" | "D" | "E";

export type TodayDashboardMetricsDto = {
  operatingMonth: {
    id: string;
    monthKey: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  serviceDate: string;
  statusCounts: {
    reservation: number;
    inUse: number;
    cleaning: number;
    completed: number;
    noShow: number;
    canceled: number;
  };
  financials: {
    paymentTotal: number;
    netSales: number;
    discountTotal: number;
    expenseTotal: number;
    earcarePoolTotal: number;
    earcarePayoutTotal: number;
    opsDailyIncentiveTotal: number;
    opsMonthlyIncentiveTotal: number;
    therapistCommissionTotal: number;
    therapistPayoutTotal: number;
    dailyCostTotal: number;
    monthlyCostTotal: number;
    settlementPayoutTotal: number;
    netProfit: number;
  };
  therapistSummary: {
    totalAssignedCallCount: number;
    totalCommissionAmount: number;
    therapists: Array<{
      employeeId: string;
      displayName: string;
      staffCode: string;
      totalAssignedCallCount: number;
      totalCommissionAmount: number;
      warningCounts: TherapistDailySettlementDto["warningCounts"];
      courseBreakdown: TherapistDailySettlementDto["courseBreakdown"];
    }>;
  };
  courseCompletions: DailyCourseSummaryDto[];
  warningCounts: {
    coursePolicyMissing: number;
    therapistRateMissing: number;
    secondTherapistRequired: number;
    settlementExcludedCallCount: number;
  };
  emptyState: {
    kind: "none" | "no_calls" | "warnings_excluded";
    message: string | null;
  };
  sourceBasis: {
    callLedgerSummary: "getDailyCallLedgerSummary";
    therapistDailySettlements: "listTherapistDailySettlements";
    amountBasis: "calculated_completed_service_calls_only" | "prepaid_revenue_and_completed_settlements";
    readOnly: true;
  };
};

export type MonthlyDashboardMetricsDto = {
  operatingMonth: TodayDashboardMetricsDto["operatingMonth"];
  sourceBasis:
    | {
        kind: "current_recalculation";
        label: "미확정 현재 기준";
        calculationBasis: "getDailyCallLedgerSummary_range";
        settlementBasis: "listMonthlyClosingPreview";
        readOnly: true;
      }
    | {
        kind: "closed_snapshot";
        label: "확정 스냅샷 기준";
        closeVersion: number;
        confirmedAt: string;
        calculationBasis: "getDailyCallLedgerSummary_range";
        settlementBasis: "getMonthlyClosingSnapshot";
        readOnly: true;
      }
    | {
        kind: "snapshot_missing";
        label: "확정 스냅샷을 찾을 수 없습니다";
        calculationBasis: "getDailyCallLedgerSummary_range";
        settlementBasis: "none";
        readOnly: true;
      };
  statusCounts: TodayDashboardMetricsDto["statusCounts"];
  financials: TodayDashboardMetricsDto["financials"];
  courseCompletions: DailyCourseSummaryDto[];
  warningCounts: {
    callLedger: DailyDashboardWarningCounts;
    settlement: MonthlyClosingPreviewDto["warningCounts"] | null;
    settlementExcludedCallCount: number;
  };
  settlementSummary: MonthlyDashboardSettlementSummaryDto | null;
  snapshot: MonthlyDashboardSnapshotReferenceDto | null;
  emptyState: {
    kind: "none" | "no_calls" | "warnings_excluded" | "snapshot_missing";
    message: string | null;
  };
};

type DailyDashboardWarningCounts = TodayDashboardMetricsDto["warningCounts"] extends infer W
  ? Omit<W & Record<string, number>, "settlementExcludedCallCount">
  : never;

type MonthlyDashboardSettlementSummaryDto = {
  therapistPayoutAmount: number;
  opsDailyIncentiveAmount: number;
  opsMonthlyIncentiveAmount: number;
  earcarePayoutAmount: number;
  grandPayoutAmount: number;
  includedCallCount: number;
  excludedCallCount: number;
  warningCount: number;
};

type MonthlyDashboardSnapshotReferenceDto = {
  kind: "latest" | "previous";
  label: "확정 스냅샷 기준" | "이전 확정 스냅샷";
  id: string;
  closeVersion: number;
  confirmedAt: string;
  totals: MonthlyClosingPreviewDto["totals"];
  warningCounts: MonthlyClosingPreviewDto["warningCounts"];
};

export type MonthlyDashboardDependencies = {
  getDailyCallLedgerSummary: typeof getDailyCallLedgerSummary;
  listMonthlyClosingPreview: typeof listMonthlyClosingPreview;
  getMonthlyClosingSnapshot: typeof getMonthlyClosingSnapshot;
};

export type TodayDashboardDependencies = {
  getDailyCallLedgerSummary: typeof getDailyCallLedgerSummary;
  listTherapistDailySettlements: typeof listTherapistDailySettlements;
  listOpsDailyIncentives: typeof listOpsDailyIncentives;
  listEarcareDailySettlements: typeof listEarcareDailySettlements;
};

export type DashboardGraphReportDto = {
  operatingMonth: TodayDashboardMetricsDto["operatingMonth"];
  serviceDate: string;
  sourceBasis: MonthlyDashboardMetricsDto["sourceBasis"];
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
  therapistSettlementRanking: Array<{
    employeeId: string;
    displayName: string;
    staffCode: string;
    totalCallCount: number;
    monthlySettlementAmount: number;
    finalPayoutAmount: number;
  }>;
  roomStatusDistribution: Array<{
    displayStatus: RoomDisplayStatus;
    count: number;
  }>;
  noShowCancelTrend: Array<{
    serviceDate: string;
    noShowCount: number;
    canceledCount: number;
  }>;
  opsIncentiveOrPayoutComposition: {
    status: "available" | "no_ops_incentive_data" | "snapshot_missing";
    label: string;
    segments: Array<{
      key: "therapist" | "ops_daily" | "ops_monthly" | "earcare";
      label: string;
      amount: number;
    }>;
  };
  warningCounts: {
    callLedger: DailyDashboardWarningCounts;
    settlement: MonthlyClosingPreviewDto["warningCounts"] | null;
    settlementExcludedCallCount: number;
  };
  emptyStates: {
    noCallsInPeriod: boolean;
    noCalculatedCompletedCalls: boolean;
    noRoomStatuses: boolean;
    noSettlementSource: boolean;
    snapshotMissing: boolean;
  };
};

export type DashboardGraphReportDependencies = MonthlyDashboardDependencies & {
  listCompletedServiceCallCalculationsForOperatingMonth: typeof listCompletedServiceCallCalculationsForOperatingMonth;
  listTherapistDailySettlements: typeof listTherapistDailySettlements;
  listRoomStatuses: typeof listRoomStatuses;
};

const todayDashboardQuerySchema = z.object({
  operatingMonthId: z.string().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

const monthlyDashboardQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const defaultMonthlyDependencies: MonthlyDashboardDependencies = {
  getDailyCallLedgerSummary,
  listMonthlyClosingPreview,
  getMonthlyClosingSnapshot
};

const defaultTodayDependencies: TodayDashboardDependencies = {
  getDailyCallLedgerSummary,
  listTherapistDailySettlements,
  listOpsDailyIncentives,
  listEarcareDailySettlements
};

const defaultGraphReportDependencies: DashboardGraphReportDependencies = {
  ...defaultMonthlyDependencies,
  listCompletedServiceCallCalculationsForOperatingMonth,
  listTherapistDailySettlements,
  listRoomStatuses
};

export class DashboardQueryDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DashboardQueryDomainError";
  }
}

function getClient(client?: TodayDashboardPrismaClient) {
  return client ?? (prisma as unknown as TodayDashboardPrismaClient);
}

function getDashboardClient(client?: DashboardPrismaClient) {
  return client ?? (prisma as unknown as DashboardPrismaClient);
}

function toIsoDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isServiceDateInMonth(serviceDate: string, month: { startDate: string; endDate: string }) {
  return serviceDate >= month.startDate && serviceDate <= month.endDate;
}

function emptyStateFor(input: {
  statusTotal: number;
  warningTotal: number;
}): TodayDashboardMetricsDto["emptyState"] {
  if (input.statusTotal === 0) {
    return {
      kind: "no_calls",
      message: "이 날짜의 콜이 없습니다."
    };
  }

  if (input.warningTotal > 0) {
    return {
      kind: "warnings_excluded",
      message: "정책/수당/D코스 검증 문제로 금액 또는 코스별 집계에서 제외된 콜이 있습니다."
    };
  }

  return {
    kind: "none",
    message: null
  };
}

function monthlyEmptyStateFor(input: {
  statusTotal: number;
  warningTotal: number;
  sourceKind: MonthlyDashboardMetricsDto["sourceBasis"]["kind"];
}): MonthlyDashboardMetricsDto["emptyState"] {
  if (input.sourceKind === "snapshot_missing") {
    return {
      kind: "snapshot_missing",
      message: "마감확정 또는 잠금 상태이지만 확정 스냅샷을 찾을 수 없습니다."
    };
  }

  if (input.statusTotal === 0) {
    return {
      kind: "no_calls",
      message: "이 운영월의 콜이 없습니다."
    };
  }

  if (input.warningTotal > 0) {
    return {
      kind: "warnings_excluded",
      message: "정책/수당/D코스 검증 문제로 금액 또는 코스별 집계에서 제외된 콜이 있습니다."
    };
  }

  return {
    kind: "none",
    message: null
  };
}

function dateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  let cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(toIsoDateOnly(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return dates;
}

function emptyMonthlyCourseCompletions(): DailyCourseSummaryDto[] {
  return (["A", "B", "C", "D", "E"] as const).map((courseCode) => ({
    courseCode,
    completedCount: 0,
    discountCount: 0,
    therapistAssignmentCount: 0
  }));
}

function emptyCourseMix(): DashboardGraphReportDto["courseMix"] {
  return (["A", "B", "C", "D", "E"] as const).map((courseCode) => ({
    courseCode,
    completedCount: 0,
    paymentTotal: 0,
    callShare: 0,
    revenueShare: 0
  }));
}

function emptyRoomStatusDistribution(): DashboardGraphReportDto["roomStatusDistribution"] {
  return (["사용중", "종료임박", "청소중", "예약", "종료확인", "빈방"] as const).map((displayStatus) => ({
    displayStatus,
    count: 0
  }));
}

function netProfit(input: {
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

function toSettlementSummary(source: Pick<MonthlyClosingPreviewDto, "totals" | "evidence">): MonthlyDashboardSettlementSummaryDto {
  return {
    therapistPayoutAmount: source.totals.therapistPayoutAmount,
    opsDailyIncentiveAmount: source.totals.opsDailyIncentiveAmount,
    opsMonthlyIncentiveAmount: source.totals.opsMonthlyIncentiveAmount,
    earcarePayoutAmount: source.totals.earcarePayoutAmount,
    grandPayoutAmount: source.totals.grandPayoutAmount,
    includedCallCount: source.evidence.includedCallCount,
    excludedCallCount: source.evidence.excludedCallCount,
    warningCount: source.evidence.warningCount
  };
}

function toSnapshotReference(
  closing: MonthlyClosingDto,
  kind: MonthlyDashboardSnapshotReferenceDto["kind"]
): MonthlyDashboardSnapshotReferenceDto {
  return {
    kind,
    label: kind === "latest" ? "확정 스냅샷 기준" : "이전 확정 스냅샷",
    id: closing.id,
    closeVersion: closing.closeVersion,
    confirmedAt: closing.confirmedAt,
    totals: closing.snapshot.totals,
    warningCounts: closing.snapshot.warningCounts
  };
}

function isClosedMonth(status: string) {
  return status === "마감확정" || status === "잠금";
}

function toGraphSourceBasis(input: {
  operatingMonthStatus: string;
  closing: MonthlyClosingDto | null;
  snapshotMissing: boolean;
}): MonthlyDashboardMetricsDto["sourceBasis"] {
  if (input.snapshotMissing) {
    return {
      kind: "snapshot_missing",
      label: "확정 스냅샷을 찾을 수 없습니다",
      calculationBasis: "getDailyCallLedgerSummary_range",
      settlementBasis: "none",
      readOnly: true
    };
  }

  if (input.closing) {
    return {
      kind: "closed_snapshot",
      label: "확정 스냅샷 기준",
      closeVersion: input.closing.closeVersion,
      confirmedAt: input.closing.confirmedAt,
      calculationBasis: "getDailyCallLedgerSummary_range",
      settlementBasis: "getMonthlyClosingSnapshot",
      readOnly: true
    };
  }

  return {
    kind: "current_recalculation",
    label: "미확정 현재 기준",
    calculationBasis: "getDailyCallLedgerSummary_range",
    settlementBasis: "listMonthlyClosingPreview",
    readOnly: true
  };
}

function aggregateCourseMix(calculations: CompletedServiceCallCalculationDto[]): DashboardGraphReportDto["courseMix"] {
  const courseMix = emptyCourseMix();
  const byCode = new Map(courseMix.map((row) => [row.courseCode, row]));
  for (const calculation of calculations) {
    const courseCode = calculation.courseCode;
    if (!byCode.has(courseCode as CourseCode)) continue;
    const row = byCode.get(courseCode as CourseCode);
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

function aggregateTherapistCallRanking(results: Array<Awaited<ReturnType<typeof listTherapistDailySettlements>>>): DashboardGraphReportDto["therapistCallRanking"] {
  const rankings = new Map<string, DashboardGraphReportDto["therapistCallRanking"][number]>();

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

function settlementRowsFromSource(source: MonthlyClosingPreviewDto | MonthlyClosingDto | null): DashboardGraphReportDto["therapistSettlementRanking"] {
  if (!source) return [];
  const rows = "snapshot" in source ? source.snapshot.therapists.rows : source.therapists.rows;
  return rows
    .map((row) => ({
      employeeId: row.employeeId,
      displayName: row.displayName,
      staffCode: row.staffCode,
      totalCallCount: row.totalCallCount,
      monthlySettlementAmount: row.monthlySettlementAmount,
      finalPayoutAmount: row.finalPayoutAmount
    }))
    .sort(
      (left, right) =>
        right.finalPayoutAmount - left.finalPayoutAmount ||
        right.totalCallCount - left.totalCallCount ||
        left.staffCode.localeCompare(right.staffCode)
    );
}

function payoutCompositionFromSource(source: MonthlyClosingPreviewDto | MonthlyClosingDto | null): DashboardGraphReportDto["opsIncentiveOrPayoutComposition"] {
  if (!source) {
    return {
      status: "snapshot_missing",
      label: "확정 스냅샷을 찾을 수 없습니다",
      segments: []
    };
  }

  const data = "snapshot" in source ? source.snapshot : source;
  const segments = [
    { key: "therapist" as const, label: "마사지사 지급", amount: data.totals.therapistPayoutAmount },
    { key: "ops_daily" as const, label: "운영팀 일일 인센", amount: data.totals.opsDailyIncentiveAmount },
    { key: "ops_monthly" as const, label: "운영팀 월 인센", amount: data.totals.opsMonthlyIncentiveAmount },
    { key: "earcare" as const, label: "귀케어 지급", amount: data.totals.earcarePayoutAmount }
  ];
  const hasOpsData = data.operations.rows.length > 0 || data.totals.opsDailyIncentiveAmount > 0 || data.totals.opsMonthlyIncentiveAmount > 0;
  return {
    status: hasOpsData ? "available" : "no_ops_incentive_data",
    label: hasOpsData ? "월마감 지급 구성" : "운영팀 인센 데이터 없음",
    segments
  };
}

function isSnapshotNotFound(error: unknown) {
  return (
    (error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND")
  );
}

export async function getTodayDashboardMetrics(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: TodayDashboardPrismaClient;
  dependencies?: Partial<TodayDashboardDependencies>;
}): Promise<TodayDashboardMetricsDto> {
  const parsed = todayDashboardQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new DashboardQueryDomainError(parsed.error.issues[0]?.message ?? "대시보드 조회 조건이 올바르지 않습니다.", "INVALID_DASHBOARD_QUERY");
  }

  const client = getClient(input.prismaClient);
  const operatingMonthRecord = await client.operatingMonth.findUnique({
    where: { id: parsed.data.operatingMonthId }
  });
  if (!operatingMonthRecord) {
    throw new DashboardQueryDomainError("운영월을 찾을 수 없습니다.", "DASHBOARD_OPERATING_MONTH_NOT_FOUND");
  }

  const operatingMonth = {
    id: operatingMonthRecord.id,
    monthKey: operatingMonthRecord.monthKey,
    startDate: toIsoDateOnly(operatingMonthRecord.startDate),
    endDate: toIsoDateOnly(operatingMonthRecord.endDate),
    status: operatingMonthRecord.status
  };
  if (!isServiceDateInMonth(parsed.data.serviceDate, operatingMonth)) {
    throw new DashboardQueryDomainError("조회 날짜가 선택한 운영월 범위를 벗어났습니다.", "DASHBOARD_DATE_OUT_OF_RANGE");
  }

  const dependencies = { ...defaultTodayDependencies, ...input.dependencies };
  const [callSummary, therapistSettlements, opsDailyIncentives, earcareSettlements] = await Promise.all([
    dependencies.getDailyCallLedgerSummary({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
    }),
    dependencies.listTherapistDailySettlements({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]
    }),
    dependencies.listOpsDailyIncentives({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listOpsDailyIncentives>[0]["prismaClient"]
    }),
    dependencies.listEarcareDailySettlements({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listEarcareDailySettlements>[0]["prismaClient"]
    })
  ]);

  const statusCounts = {
    reservation: callSummary.reservationCount,
    inUse: callSummary.inUseCount,
    cleaning: callSummary.cleaningCount,
    completed: callSummary.completedCount,
    noShow: callSummary.noShowCount,
    canceled: callSummary.canceledCount
  };
  const warningTotal =
    callSummary.warningCounts.coursePolicyMissing + callSummary.warningCounts.therapistRateMissing + callSummary.warningCounts.secondTherapistRequired;
  const opsDailyIncentiveTotal = opsDailyIncentives.distributedAmount;
  const earcarePayoutTotal = earcareSettlements.distributedAmount;
  const dailyCostTotal = callSummary.expenseTotal + callSummary.therapistCommissionTotal + earcarePayoutTotal + opsDailyIncentiveTotal;

  return {
    operatingMonth,
    serviceDate: parsed.data.serviceDate,
    statusCounts,
    financials: {
      paymentTotal: callSummary.paymentTotal,
      netSales: callSummary.netSales,
      discountTotal: callSummary.discountTotal,
      expenseTotal: callSummary.expenseTotal,
      earcarePoolTotal: callSummary.earcarePoolTotal,
      earcarePayoutTotal,
      opsDailyIncentiveTotal,
      opsMonthlyIncentiveTotal: 0,
      therapistCommissionTotal: callSummary.therapistCommissionTotal,
      therapistPayoutTotal: callSummary.therapistCommissionTotal,
      dailyCostTotal,
      monthlyCostTotal: 0,
      settlementPayoutTotal: callSummary.therapistCommissionTotal + earcarePayoutTotal + opsDailyIncentiveTotal,
      netProfit: netProfit({
        paymentTotal: callSummary.paymentTotal,
        expenseTotal: callSummary.expenseTotal,
        therapistPayoutTotal: callSummary.therapistCommissionTotal,
        earcarePayoutTotal,
        opsDailyIncentiveTotal,
        opsMonthlyIncentiveTotal: 0
      })
    },
    therapistSummary: {
      totalAssignedCallCount: therapistSettlements.settlements.reduce((sum, settlement) => sum + settlement.totalCallCount, 0),
      totalCommissionAmount: therapistSettlements.settlements.reduce((sum, settlement) => sum + settlement.totalCommissionAmount, 0),
      therapists: therapistSettlements.settlements.map((settlement) => ({
        employeeId: settlement.employeeId,
        displayName: settlement.displayName,
        staffCode: settlement.staffCode,
        totalAssignedCallCount: settlement.totalCallCount,
        totalCommissionAmount: settlement.totalCommissionAmount,
        warningCounts: settlement.warningCounts,
        courseBreakdown: settlement.courseBreakdown
      }))
    },
    courseCompletions: callSummary.courseSummaries,
    warningCounts: {
      ...callSummary.warningCounts,
      settlementExcludedCallCount: therapistSettlements.excludedCallCount
    },
    emptyState: emptyStateFor({
      statusTotal: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      warningTotal
    }),
    sourceBasis: {
      callLedgerSummary: "getDailyCallLedgerSummary",
      therapistDailySettlements: "listTherapistDailySettlements",
      amountBasis: "prepaid_revenue_and_completed_settlements",
      readOnly: true
    }
  };
}

export async function getMonthlyDashboardMetrics(input: {
  operatingMonthId: string;
  prismaClient?: DashboardPrismaClient;
  dependencies?: Partial<MonthlyDashboardDependencies>;
}): Promise<MonthlyDashboardMetricsDto> {
  const parsed = monthlyDashboardQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new DashboardQueryDomainError(parsed.error.issues[0]?.message ?? "대시보드 조회 조건이 올바르지 않습니다.", "INVALID_DASHBOARD_QUERY");
  }

  const client = getDashboardClient(input.prismaClient);
  const operatingMonthRecord = await client.operatingMonth.findUnique({
    where: { id: parsed.data.operatingMonthId }
  });
  if (!operatingMonthRecord) {
    throw new DashboardQueryDomainError("운영월을 찾을 수 없습니다.", "DASHBOARD_OPERATING_MONTH_NOT_FOUND");
  }

  const dependencies = { ...defaultMonthlyDependencies, ...input.dependencies };
  const operatingMonth = {
    id: operatingMonthRecord.id,
    monthKey: operatingMonthRecord.monthKey,
    startDate: toIsoDateOnly(operatingMonthRecord.startDate),
    endDate: toIsoDateOnly(operatingMonthRecord.endDate),
    status: operatingMonthRecord.status
  };
  const summaries = [];
  for (const serviceDate of dateRange(operatingMonth.startDate, operatingMonth.endDate)) {
    summaries.push(
      await dependencies.getDailyCallLedgerSummary({
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        prismaClient: client as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
      })
    );
  }

  const statusCounts = summaries.reduce(
    (totals, summary) => ({
      reservation: totals.reservation + summary.reservationCount,
      inUse: totals.inUse + summary.inUseCount,
      cleaning: totals.cleaning + summary.cleaningCount,
      completed: totals.completed + summary.completedCount,
      noShow: totals.noShow + summary.noShowCount,
      canceled: totals.canceled + summary.canceledCount
    }),
    { reservation: 0, inUse: 0, cleaning: 0, completed: 0, noShow: 0, canceled: 0 }
  );
  const financials = summaries.reduce(
    (totals, summary) => ({
      paymentTotal: totals.paymentTotal + summary.paymentTotal,
      netSales: totals.netSales + summary.netSales,
      discountTotal: totals.discountTotal + summary.discountTotal,
      expenseTotal: totals.expenseTotal + summary.expenseTotal,
      earcarePoolTotal: totals.earcarePoolTotal + summary.earcarePoolTotal,
      therapistCommissionTotal: totals.therapistCommissionTotal + summary.therapistCommissionTotal
    }),
    { paymentTotal: 0, netSales: 0, discountTotal: 0, expenseTotal: 0, earcarePoolTotal: 0, therapistCommissionTotal: 0 }
  );
  const courseCompletions = emptyMonthlyCourseCompletions();
  const courseSummaryByCode = new Map(courseCompletions.map((summary) => [summary.courseCode, summary]));
  const callLedgerWarnings = {
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0
  };
  for (const summary of summaries) {
    callLedgerWarnings.coursePolicyMissing += summary.warningCounts.coursePolicyMissing;
    callLedgerWarnings.therapistRateMissing += summary.warningCounts.therapistRateMissing;
    callLedgerWarnings.secondTherapistRequired += summary.warningCounts.secondTherapistRequired;
    for (const course of summary.courseSummaries) {
      const target = courseSummaryByCode.get(course.courseCode);
      if (!target) continue;
      target.completedCount += course.completedCount;
      target.discountCount += course.discountCount;
      target.therapistAssignmentCount += course.therapistAssignmentCount;
    }
  }

  let sourceBasis: MonthlyDashboardMetricsDto["sourceBasis"];
  let settlementSummary: MonthlyDashboardMetricsDto["settlementSummary"] = null;
  let snapshot: MonthlyDashboardMetricsDto["snapshot"] = null;
  let settlementWarnings: MonthlyDashboardMetricsDto["warningCounts"]["settlement"] = null;
  let settlementExcludedCallCount = 0;

  if (isClosedMonth(operatingMonth.status)) {
    try {
      const closing = await dependencies.getMonthlyClosingSnapshot({
        operatingMonthId: parsed.data.operatingMonthId,
        prismaClient: client as Parameters<typeof getMonthlyClosingSnapshot>[0]["prismaClient"]
      });
      sourceBasis = {
        kind: "closed_snapshot",
        label: "확정 스냅샷 기준",
        closeVersion: closing.closeVersion,
        confirmedAt: closing.confirmedAt,
        calculationBasis: "getDailyCallLedgerSummary_range",
        settlementBasis: "getMonthlyClosingSnapshot",
        readOnly: true
      };
      snapshot = toSnapshotReference(closing, "latest");
      settlementSummary = toSettlementSummary(closing.snapshot);
      settlementWarnings = closing.snapshot.warningCounts;
      settlementExcludedCallCount = closing.snapshot.evidence.excludedCallCount;
    } catch (error) {
      if (!isSnapshotNotFound(error)) throw error;
      sourceBasis = {
        kind: "snapshot_missing",
        label: "확정 스냅샷을 찾을 수 없습니다",
        calculationBasis: "getDailyCallLedgerSummary_range",
        settlementBasis: "none",
        readOnly: true
      };
    }
  } else {
    const preview = await dependencies.listMonthlyClosingPreview({
      operatingMonthId: parsed.data.operatingMonthId,
      prismaClient: client as Parameters<typeof listMonthlyClosingPreview>[0]["prismaClient"]
    });
    sourceBasis = {
      kind: "current_recalculation",
      label: "미확정 현재 기준",
      calculationBasis: "getDailyCallLedgerSummary_range",
      settlementBasis: "listMonthlyClosingPreview",
      readOnly: true
    };
    settlementSummary = toSettlementSummary(preview);
    settlementWarnings = preview.warningCounts;
    settlementExcludedCallCount = preview.evidence.excludedCallCount;

    if (operatingMonth.status === "검토중") {
      try {
        const previousSnapshot = await dependencies.getMonthlyClosingSnapshot({
          operatingMonthId: parsed.data.operatingMonthId,
          prismaClient: client as Parameters<typeof getMonthlyClosingSnapshot>[0]["prismaClient"]
        });
        snapshot = toSnapshotReference(previousSnapshot, "previous");
      } catch (error) {
        if (!isSnapshotNotFound(error)) throw error;
      }
    }
  }

  const therapistPayoutTotal = settlementSummary?.therapistPayoutAmount ?? financials.therapistCommissionTotal;
  const earcarePayoutTotal = settlementSummary?.earcarePayoutAmount ?? financials.earcarePoolTotal;
  const opsDailyIncentiveTotal = settlementSummary?.opsDailyIncentiveAmount ?? 0;
  const opsMonthlyIncentiveTotal = settlementSummary?.opsMonthlyIncentiveAmount ?? 0;
  const therapistMonthlyBonusTotal = Math.max(0, therapistPayoutTotal - financials.therapistCommissionTotal);
  const dailyCostTotal = financials.expenseTotal + financials.therapistCommissionTotal + earcarePayoutTotal + opsDailyIncentiveTotal;
  const monthlyCostTotal = therapistMonthlyBonusTotal + opsMonthlyIncentiveTotal;
  const enrichedFinancials = {
    ...financials,
    earcarePayoutTotal,
    opsDailyIncentiveTotal,
    opsMonthlyIncentiveTotal,
    therapistPayoutTotal,
    dailyCostTotal,
    monthlyCostTotal,
    settlementPayoutTotal: therapistPayoutTotal + earcarePayoutTotal + opsDailyIncentiveTotal + opsMonthlyIncentiveTotal,
    netProfit: netProfit({
      paymentTotal: financials.paymentTotal,
      expenseTotal: financials.expenseTotal,
      therapistPayoutTotal,
      earcarePayoutTotal,
      opsDailyIncentiveTotal,
      opsMonthlyIncentiveTotal
    })
  };

  const warningTotal = callLedgerWarnings.coursePolicyMissing + callLedgerWarnings.therapistRateMissing + callLedgerWarnings.secondTherapistRequired;
  return {
    operatingMonth,
    sourceBasis,
    statusCounts,
    financials: enrichedFinancials,
    courseCompletions,
    warningCounts: {
      callLedger: callLedgerWarnings,
      settlement: settlementWarnings,
      settlementExcludedCallCount
    },
    settlementSummary,
    snapshot,
    emptyState: monthlyEmptyStateFor({
      statusTotal: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      warningTotal,
      sourceKind: sourceBasis.kind
    })
  };
}

export async function getDashboardGraphReport(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: DashboardPrismaClient;
  dependencies?: Partial<DashboardGraphReportDependencies>;
}): Promise<DashboardGraphReportDto> {
  const parsed = todayDashboardQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new DashboardQueryDomainError(parsed.error.issues[0]?.message ?? "그래프 리포트 조회 조건이 올바르지 않습니다.", "INVALID_DASHBOARD_QUERY");
  }

  const client = getDashboardClient(input.prismaClient);
  const operatingMonthRecord = await client.operatingMonth.findUnique({
    where: { id: parsed.data.operatingMonthId }
  });
  if (!operatingMonthRecord) {
    throw new DashboardQueryDomainError("운영월을 찾을 수 없습니다.", "DASHBOARD_OPERATING_MONTH_NOT_FOUND");
  }

  const operatingMonth = {
    id: operatingMonthRecord.id,
    monthKey: operatingMonthRecord.monthKey,
    startDate: toIsoDateOnly(operatingMonthRecord.startDate),
    endDate: toIsoDateOnly(operatingMonthRecord.endDate),
    status: operatingMonthRecord.status
  };
  if (!isServiceDateInMonth(parsed.data.serviceDate, operatingMonth)) {
    throw new DashboardQueryDomainError("조회 날짜가 선택한 운영월 범위를 벗어났습니다.", "DASHBOARD_DATE_OUT_OF_RANGE");
  }

  const dependencies = { ...defaultGraphReportDependencies, ...input.dependencies };
  const serviceDates = dateRange(operatingMonth.startDate, operatingMonth.endDate);
  const [dailySummaries, completedCalculations, therapistDailyResults, roomStatuses] = await Promise.all([
    Promise.all(
      serviceDates.map((serviceDate) =>
        dependencies.getDailyCallLedgerSummary({
          operatingMonthId: parsed.data.operatingMonthId,
          serviceDate,
          prismaClient: client as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
        })
      )
    ),
    dependencies.listCompletedServiceCallCalculationsForOperatingMonth({
      operatingMonthId: parsed.data.operatingMonthId,
      startDate: operatingMonth.startDate,
      endDate: operatingMonth.endDate,
      prismaClient: client as Parameters<typeof listCompletedServiceCallCalculationsForOperatingMonth>[0]["prismaClient"]
    }),
    Promise.all(
      serviceDates.map((serviceDate) =>
        dependencies.listTherapistDailySettlements({
          operatingMonthId: parsed.data.operatingMonthId,
          serviceDate,
          prismaClient: client as Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]
        })
      )
    ),
    dependencies.listRoomStatuses({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listRoomStatuses>[0]["prismaClient"]
    })
  ]);

  const dailyRevenueTrend = serviceDates.map((serviceDate, index) => {
    const summary = dailySummaries[index];
    return {
      serviceDate,
      paymentTotal: summary.paymentTotal,
      netSales: summary.netSales,
      completedCount: summary.completedCount
    };
  });
  const noShowCancelTrend = serviceDates.map((serviceDate, index) => {
    const summary = dailySummaries[index];
    return {
      serviceDate,
      noShowCount: summary.noShowCount,
      canceledCount: summary.canceledCount
    };
  });
  const callLedgerWarnings = dailySummaries.reduce(
    (totals, summary) => ({
      coursePolicyMissing: totals.coursePolicyMissing + summary.warningCounts.coursePolicyMissing,
      therapistRateMissing: totals.therapistRateMissing + summary.warningCounts.therapistRateMissing,
      secondTherapistRequired: totals.secondTherapistRequired + summary.warningCounts.secondTherapistRequired
    }),
    { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 }
  );

  let settlementSource: MonthlyClosingPreviewDto | MonthlyClosingDto | null = null;
  let sourceBasis: MonthlyDashboardMetricsDto["sourceBasis"];
  let settlementWarnings: MonthlyClosingPreviewDto["warningCounts"] | null = null;
  let settlementExcludedCallCount = 0;
  let snapshotMissing = false;

  if (isClosedMonth(operatingMonth.status)) {
    try {
      const closing = await dependencies.getMonthlyClosingSnapshot({
        operatingMonthId: parsed.data.operatingMonthId,
        prismaClient: client as Parameters<typeof getMonthlyClosingSnapshot>[0]["prismaClient"]
      });
      settlementSource = closing;
      settlementWarnings = closing.snapshot.warningCounts;
      settlementExcludedCallCount = closing.snapshot.evidence.excludedCallCount;
      sourceBasis = toGraphSourceBasis({ operatingMonthStatus: operatingMonth.status, closing, snapshotMissing: false });
    } catch (error) {
      if (!isSnapshotNotFound(error)) throw error;
      snapshotMissing = true;
      sourceBasis = toGraphSourceBasis({ operatingMonthStatus: operatingMonth.status, closing: null, snapshotMissing: true });
    }
  } else {
    const preview = await dependencies.listMonthlyClosingPreview({
      operatingMonthId: parsed.data.operatingMonthId,
      prismaClient: client as Parameters<typeof listMonthlyClosingPreview>[0]["prismaClient"]
    });
    settlementSource = preview;
    settlementWarnings = preview.warningCounts;
    settlementExcludedCallCount = preview.evidence.excludedCallCount;
    sourceBasis = toGraphSourceBasis({ operatingMonthStatus: operatingMonth.status, closing: null, snapshotMissing: false });
  }

  const roomStatusDistribution = emptyRoomStatusDistribution();
  const roomStatusByDisplayStatus = new Map(roomStatusDistribution.map((row) => [row.displayStatus, row]));
  for (const status of roomStatuses) {
    const target = roomStatusByDisplayStatus.get(status.displayStatus);
    if (target) target.count += 1;
  }

  const totalStatusCount = dailySummaries.reduce(
    (sum, summary) =>
      sum + summary.reservationCount + summary.inUseCount + summary.cleaningCount + summary.completedCount + summary.noShowCount + summary.canceledCount,
    0
  );

  return {
    operatingMonth,
    serviceDate: parsed.data.serviceDate,
    sourceBasis,
    dailyRevenueTrend,
    courseMix: aggregateCourseMix(completedCalculations),
    therapistCallRanking: aggregateTherapistCallRanking(therapistDailyResults),
    therapistSettlementRanking: settlementRowsFromSource(settlementSource),
    roomStatusDistribution,
    noShowCancelTrend,
    opsIncentiveOrPayoutComposition: payoutCompositionFromSource(settlementSource),
    warningCounts: {
      callLedger: callLedgerWarnings,
      settlement: settlementWarnings,
      settlementExcludedCallCount
    },
    emptyStates: {
      noCallsInPeriod: totalStatusCount === 0,
      noCalculatedCompletedCalls: completedCalculations.length === 0,
      noRoomStatuses: roomStatuses.length === 0,
      noSettlementSource: settlementSource === null,
      snapshotMissing
    }
  };
}
