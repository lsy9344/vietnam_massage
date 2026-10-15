import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { mapWithConcurrency } from "@/lib/concurrency";
import { memoizePrismaReads } from "@/lib/prisma-read-cache";
import {
  IN_USE_SERVICE_CALL_STATUSES,
  getDailyCallLedgerSummary,
  listServiceCallsForOperatingMonth,
  type DailyCallLedgerSummaryDto,
  type ServiceCallCalculationStatus,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import {
  listEarcareDailyPayoutConfirmationsForMonth,
  type EarcareDailyPayoutConfirmationDto
} from "@/modules/settlements/earcare-daily-settlement-service";
import {
  listOpsDailyPayoutConfirmationsForMonth,
  type OpsDailyPayoutConfirmationDto
} from "@/modules/settlements/ops-daily-incentive-service";
import { listOpsMonthlyIncentivePreview } from "@/modules/settlements/ops-monthly-incentive-service";
import {
  listTherapistDailyPayoutConfirmationsForMonth,
  type TherapistDailyPayoutConfirmationDto
} from "@/modules/settlements/therapist-daily-settlement-service";
import { type PayoutConfirmationDto, type PayoutConfirmationUnitType } from "@/modules/settlements/payout-confirmation-service";

/**
 * 월마감 점검(스펙 F07, ADR 0002, 티켓 33). 확정 전에 다시 계산해야 하는 네 가지를 한 번에 묶는다:
 * (1) 계산 오류(방문완료 콜 중 코스 정책 없음·수당 없음·두 번째 Therapist 필요),
 * (2) 지급 재확인 미처리(세 직군 지급 확인 서비스의 "지급 재확인 필요" 단위),
 * (3) 마감 확인 대상 콜(예약·사용중·청소중 — 이 티켓에서는 목록만, 확인·사유는 34에서),
 * (4) 금액 확인(결제수단별 합계, 지출, 현금/계좌 잔액, 순매출 — 콜 서비스의 기존 계산을 그대로 쓴다).
 * (1)·(2)가 남아 있으면 월마감 확정을 거절한다(monthly-closing-service.confirmMonthlyClose).
 */

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type MonthlyClosingChecklistPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
};

const CALCULATION_WARNING_STATUSES = ["course_policy_missing", "therapist_rate_missing", "second_therapist_required"] as const;
const PENDING_CLOSE_RESERVATION_STATUSES = ["예약", "RESERVED"];
const PENDING_CLOSE_CLEANING_STATUSES = ["청소중", "CLEANING"];
const COMPLETED_CALL_STATUSES = ["방문완료", "VISIT_COMPLETE"];

export type MonthlyClosingChecklistCallDto = {
  serviceCallId: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  courseCode: string;
  therapistNames: string[];
  status: string;
  calculationStatus: ServiceCallCalculationStatus;
};

export type MonthlyClosingPayoutReconfirmationUnitDto = {
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  /** 월 단위(운영팀 월 인센)는 날짜가 없다. */
  serviceDate: string | null;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

export type MonthlyClosingChecklistFinancialsDto = {
  paymentMethodTotals: DailyCallLedgerSummaryDto["paymentMethodTotals"];
  expenseTotal: number;
  /** ADR 0002: 현금 잔액(현금 수납 - 현금 지출)은 순매출과 다른 숫자다. */
  cashBalance: number;
  /** ADR 0002: 계좌 잔액(계좌 수납 - 계좌 지출)도 순매출과 따로 나온다. */
  bankBalance: number;
  netSales: number;
};

export type MonthlyClosingChecklistDto = {
  operatingMonthId: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  status: string;
  calculationErrorCalls: MonthlyClosingChecklistCallDto[];
  payoutReconfirmationUnits: MonthlyClosingPayoutReconfirmationUnitDto[];
  /** 예약·사용중·청소중 콜 목록. 확인·사유 입력은 34에서 붙는다(이 티켓은 목록만). */
  pendingCloseCalls: MonthlyClosingChecklistCallDto[];
  financials: MonthlyClosingChecklistFinancialsDto;
  /** 계산 오류나 지급 재확인 미처리가 있으면 true. 마감 확인 대상 콜은 이 티켓에서 확정을 막지 않는다. */
  isConfirmBlocked: boolean;
};

export class MonthlyClosingChecklistDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MonthlyClosingChecklistDomainError";
  }
}

export type MonthlyClosingChecklistDependencies = {
  listServiceCallsForOperatingMonth: typeof listServiceCallsForOperatingMonth;
  getDailyCallLedgerSummary: typeof getDailyCallLedgerSummary;
  listTherapistDailyPayoutConfirmationsForMonth: typeof listTherapistDailyPayoutConfirmationsForMonth;
  listEarcareDailyPayoutConfirmationsForMonth: typeof listEarcareDailyPayoutConfirmationsForMonth;
  listOpsDailyPayoutConfirmationsForMonth: typeof listOpsDailyPayoutConfirmationsForMonth;
  listOpsMonthlyIncentivePreview: typeof listOpsMonthlyIncentivePreview;
};

const defaultDependencies: MonthlyClosingChecklistDependencies = {
  listServiceCallsForOperatingMonth,
  getDailyCallLedgerSummary,
  listTherapistDailyPayoutConfirmationsForMonth,
  listEarcareDailyPayoutConfirmationsForMonth,
  listOpsDailyPayoutConfirmationsForMonth,
  listOpsMonthlyIncentivePreview
};

const checklistQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const MONTHLY_CLOSING_CHECKLIST_QUERY_CONCURRENCY = 5;

function getClient(client?: MonthlyClosingChecklistPrismaClient) {
  return client ?? (prisma as unknown as MonthlyClosingChecklistPrismaClient);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
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

function isCompletedCallStatus(status: string) {
  return COMPLETED_CALL_STATUSES.includes(status);
}

function isPendingCloseStatus(status: string) {
  return PENDING_CLOSE_RESERVATION_STATUSES.includes(status) || IN_USE_SERVICE_CALL_STATUSES.includes(status) || PENDING_CLOSE_CLEANING_STATUSES.includes(status);
}

function isCalculationWarningStatus(status: ServiceCallCalculationStatus): status is (typeof CALCULATION_WARNING_STATUSES)[number] {
  return (CALCULATION_WARNING_STATUSES as readonly string[]).includes(status);
}

function toChecklistCall(row: ServiceCallRowDto): MonthlyClosingChecklistCallDto {
  return {
    serviceCallId: row.id,
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    courseCode: row.courseCode,
    therapistNames: [row.therapist1, row.therapist2].flatMap((assignee) => (assignee ? [assignee.displayName] : [])),
    status: row.status,
    calculationStatus: row.calculationStatus
  };
}

function toReconfirmationUnit(
  unitType: PayoutConfirmationUnitType,
  operatingMonthId: string,
  unit: { serviceDate: string | null; employeeId: string; payoutConfirmation: PayoutConfirmationDto }
): MonthlyClosingPayoutReconfirmationUnitDto {
  return {
    unitType,
    operatingMonthId,
    serviceDate: unit.serviceDate,
    employeeId: unit.employeeId,
    payoutConfirmation: unit.payoutConfirmation
  };
}

async function listPayoutReconfirmationUnits(input: {
  operatingMonthId: string;
  client: MonthlyClosingChecklistPrismaClient;
  dependencies: MonthlyClosingChecklistDependencies;
}): Promise<MonthlyClosingPayoutReconfirmationUnitDto[]> {
  const [therapistUnits, earcareUnits, opsDailyUnits, opsMonthlyResult] = await Promise.all([
    input.dependencies.listTherapistDailyPayoutConfirmationsForMonth({
      operatingMonthId: input.operatingMonthId,
      prismaClient: input.client as unknown as Parameters<typeof listTherapistDailyPayoutConfirmationsForMonth>[0]["prismaClient"]
    }),
    input.dependencies.listEarcareDailyPayoutConfirmationsForMonth({
      operatingMonthId: input.operatingMonthId,
      prismaClient: input.client as unknown as Parameters<typeof listEarcareDailyPayoutConfirmationsForMonth>[0]["prismaClient"]
    }),
    input.dependencies.listOpsDailyPayoutConfirmationsForMonth({
      operatingMonthId: input.operatingMonthId,
      prismaClient: input.client as unknown as Parameters<typeof listOpsDailyPayoutConfirmationsForMonth>[0]["prismaClient"]
    }),
    input.dependencies.listOpsMonthlyIncentivePreview({
      operatingMonthId: input.operatingMonthId,
      prismaClient: input.client as unknown as Parameters<typeof listOpsMonthlyIncentivePreview>[0]["prismaClient"]
    })
  ]);

  const pendingTherapist = (therapistUnits as TherapistDailyPayoutConfirmationDto[])
    .filter((unit) => unit.payoutConfirmation.requiresReconfirmation)
    .map((unit) => toReconfirmationUnit("THERAPIST_DAILY", input.operatingMonthId, unit));
  const pendingEarcare = (earcareUnits as EarcareDailyPayoutConfirmationDto[])
    .filter((unit) => unit.payoutConfirmation.requiresReconfirmation)
    .map((unit) => toReconfirmationUnit("EARCARE_DAILY", input.operatingMonthId, unit));
  const pendingOpsDaily = (opsDailyUnits as OpsDailyPayoutConfirmationDto[])
    .filter((unit) => unit.payoutConfirmation.requiresReconfirmation)
    .map((unit) => toReconfirmationUnit("OPS_DAILY", input.operatingMonthId, unit));
  const pendingOpsMonthly = opsMonthlyResult.rows
    .filter((row) => row.payoutConfirmation.requiresReconfirmation)
    .map((row) => toReconfirmationUnit("OPS_MONTHLY", input.operatingMonthId, { serviceDate: null, employeeId: row.employeeId, payoutConfirmation: row.payoutConfirmation }));

  return [...pendingTherapist, ...pendingEarcare, ...pendingOpsDaily, ...pendingOpsMonthly];
}

async function aggregateFinancials(input: {
  operatingMonthId: string;
  dates: string[];
  client: MonthlyClosingChecklistPrismaClient;
  dependencies: MonthlyClosingChecklistDependencies;
}): Promise<MonthlyClosingChecklistFinancialsDto> {
  const dailyResults = await mapWithConcurrency(input.dates, MONTHLY_CLOSING_CHECKLIST_QUERY_CONCURRENCY, (serviceDate) =>
    input.dependencies.getDailyCallLedgerSummary({
      operatingMonthId: input.operatingMonthId,
      serviceDate,
      includeMonthTill: false,
      prismaClient: input.client as unknown as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
    })
  );

  const paymentMethodTotals = dailyResults.reduce(
    (totals, result) => ({
      cash: totals.cash + result.paymentMethodTotals.cash,
      card: totals.card + result.paymentMethodTotals.card,
      bank: totals.bank + result.paymentMethodTotals.bank,
      other: totals.other + result.paymentMethodTotals.other
    }),
    { cash: 0, card: 0, bank: 0, other: 0 }
  );
  const expenseTotal = dailyResults.reduce((sum, result) => sum + result.expenseTotal, 0);
  const netSales = dailyResults.reduce((sum, result) => sum + result.netSales, 0);

  // till.month는 조회한 날짜와 무관하게 운영월 전체의 누적이라(service-call-service.monthTillFor),
  // 날짜 하나만 includeMonthTill로 다시 불러 현금/계좌 잔액을 얻는다.
  const monthTillDay = input.dates[0];
  const monthTill = monthTillDay
    ? await input.dependencies.getDailyCallLedgerSummary({
        operatingMonthId: input.operatingMonthId,
        serviceDate: monthTillDay,
        includeMonthTill: true,
        prismaClient: input.client as unknown as Parameters<typeof getDailyCallLedgerSummary>[0]["prismaClient"]
      })
    : null;

  return {
    paymentMethodTotals,
    expenseTotal,
    cashBalance: monthTill?.till.month.cashBalance ?? 0,
    bankBalance: monthTill?.till.month.bankBalance ?? 0,
    netSales
  };
}

export async function listMonthlyClosingChecklist(input: {
  operatingMonthId: string;
  prismaClient?: MonthlyClosingChecklistPrismaClient;
  dependencies?: MonthlyClosingChecklistDependencies;
}): Promise<MonthlyClosingChecklistDto> {
  const parsed = checklistQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new MonthlyClosingChecklistDomainError(
      parsed.error.issues[0]?.message ?? "월마감 점검 조회 조건이 올바르지 않습니다.",
      "INVALID_MONTHLY_CLOSING_CHECKLIST_INPUT"
    );
  }

  const client = memoizePrismaReads(getClient(input.prismaClient));
  const dependencies = { ...defaultDependencies, ...input.dependencies };

  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new MonthlyClosingChecklistDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (startDate > endDate) {
    throw new MonthlyClosingChecklistDomainError("운영월 날짜 범위가 올바르지 않습니다.", "INVALID_OPERATING_MONTH_DATE_RANGE");
  }
  const dates = dateRange(startDate, endDate);

  const [allRows, payoutReconfirmationUnits, financials] = await Promise.all([
    dependencies.listServiceCallsForOperatingMonth({
      operatingMonthId: parsed.data.operatingMonthId,
      startDate,
      endDate,
      prismaClient: client as unknown as Parameters<typeof listServiceCallsForOperatingMonth>[0]["prismaClient"]
    }),
    listPayoutReconfirmationUnits({ operatingMonthId: parsed.data.operatingMonthId, client, dependencies }),
    aggregateFinancials({ operatingMonthId: parsed.data.operatingMonthId, dates, client, dependencies })
  ]);

  const calculationErrorCalls = allRows
    .filter((row) => isCompletedCallStatus(row.status) && isCalculationWarningStatus(row.calculationStatus))
    .map(toChecklistCall);
  const pendingCloseCalls = allRows.filter((row) => isPendingCloseStatus(row.status)).map(toChecklistCall);

  return {
    operatingMonthId: operatingMonth.id,
    monthKey: operatingMonth.monthKey,
    startDate,
    endDate,
    status: operatingMonth.status,
    calculationErrorCalls,
    payoutReconfirmationUnits,
    pendingCloseCalls,
    financials,
    isConfirmBlocked: calculationErrorCalls.length > 0 || payoutReconfirmationUnits.length > 0
  };
}
