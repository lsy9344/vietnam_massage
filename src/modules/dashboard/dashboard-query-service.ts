import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDailyCallLedgerSummary, type DailyCourseSummaryDto } from "@/modules/calls/service-call-service";
import {
  listTherapistDailySettlements,
  type TherapistDailySettlementDto
} from "@/modules/settlements/therapist-daily-settlement-service";

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
    therapistCommissionTotal: number;
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
    amountBasis: "calculated_completed_service_calls_only";
    readOnly: true;
  };
};

const todayDashboardQuerySchema = z.object({
  operatingMonthId: z.string().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

export class DashboardQueryDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DashboardQueryDomainError";
  }
}

function getClient(client?: TodayDashboardPrismaClient) {
  return client ?? (prisma as unknown as TodayDashboardPrismaClient);
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

export async function getTodayDashboardMetrics(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: TodayDashboardPrismaClient;
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

  const [callSummary, therapistSettlements] = await Promise.all([
    getDailyCallLedgerSummary({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
    }),
    listTherapistDailySettlements({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listTherapistDailySettlements>[0]["prismaClient"]
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
      therapistCommissionTotal: callSummary.therapistCommissionTotal
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
      amountBasis: "calculated_completed_service_calls_only",
      readOnly: true
    }
  };
}
