import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  listCompletedServiceCallCalculationsForDate,
  listServiceCallsForDate
} from "@/modules/calls/service-call-service";
import {
  listEarcareAttendanceForDate,
  type EarcareAttendanceDto
} from "@/modules/settlements/earcare-attendance-service";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type EarcareDailySettlementPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
};

export type EarcareDailySettlementWarningCounts = {
  notCompleted: number;
  coursePolicyMissing: number;
  therapistRateMissing: number;
  secondTherapistRequired: number;
};

export type EarcareDailySettlementRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  statusCode: string;
  statusDisplayName: string;
  isPayoutEligible: boolean;
  exclusionReason: string | null;
  baseShareAmount: number;
  remainderShareAmount: number;
  payoutAmount: number;
  calculationBasis: string;
};

export type EarcarePoolEvidenceDto = {
  serviceCallId: string;
  serviceDate: string;
  earcarePoolAmount: number;
};

export type EarcareDailySettlementResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  isLocked: boolean;
  earcarePoolTotal: number;
  sourceCallCount: number;
  eligibleCount: number;
  baseShareAmount: number;
  remainderAmount: number;
  distributedAmount: number;
  undistributedAmount: number;
  warningCounts: EarcareDailySettlementWarningCounts;
  rows: EarcareDailySettlementRowDto[];
  poolEvidence: EarcarePoolEvidenceDto[];
};

export class EarcareDailySettlementDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "EarcareDailySettlementDomainError";
  }
}

const settlementQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

function getClient(client?: EarcareDailySettlementPrismaClient) {
  return client ?? (prisma as unknown as EarcareDailySettlementPrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw new EarcareDailySettlementDomainError("조회 날짜가 올바르지 않습니다.", "INVALID_EARCARE_DAILY_SETTLEMENT_INPUT");
  }
}

function assertDateInOperatingMonth(operatingMonth: OperatingMonthRecord, serviceDate: string) {
  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (serviceDate < startDate || serviceDate > endDate) {
    throw new EarcareDailySettlementDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }
}

function toFieldError(error: z.ZodError) {
  return new EarcareDailySettlementDomainError(
    error.issues[0]?.message ?? "귀케어 일일정산 조회 조건이 올바르지 않습니다.",
    "INVALID_EARCARE_DAILY_SETTLEMENT_INPUT"
  );
}

function payoutBasis(input: {
  row: EarcareAttendanceDto;
  earcarePoolTotal: number;
  eligibleCount: number;
  baseShareAmount: number;
  remainderShareAmount: number;
}) {
  if (!input.row.isPayoutEligible) return `${input.row.exclusionReason ?? input.row.statusDisplayName} 제외`;
  if (input.earcarePoolTotal === 0) return "방문완료 귀케어 풀 0 VND";
  if (input.eligibleCount === 0) return `정상 근무자 0명 / 미분배 ${input.earcarePoolTotal} VND`;

  const suffix = input.remainderShareAmount > 0 ? ` + 잔여 ${input.remainderShareAmount} VND 배분` : "";
  return `방문완료 풀 ${input.earcarePoolTotal} VND / 정상 근무자 ${input.eligibleCount}명${suffix}`;
}

function warningCounts(rows: Awaited<ReturnType<typeof listServiceCallsForDate>>): EarcareDailySettlementWarningCounts {
  return {
    notCompleted: rows.filter((row) => row.calculationStatus === "not_completed").length,
    coursePolicyMissing: rows.filter((row) => row.calculationStatus === "course_policy_missing").length,
    therapistRateMissing: rows.filter((row) => row.calculationStatus === "therapist_rate_missing").length,
    secondTherapistRequired: rows.filter((row) => row.calculationStatus === "second_therapist_required").length
  };
}

export async function listEarcareDailySettlements(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: EarcareDailySettlementPrismaClient;
}): Promise<EarcareDailySettlementResultDto> {
  const parsed = settlementQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.serviceDate);

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new EarcareDailySettlementDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  assertDateInOperatingMonth(operatingMonth, parsed.data.serviceDate);

  const [attendance, completedCalculations, callRows] = await Promise.all([
    listEarcareAttendanceForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      attendanceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listEarcareAttendanceForDate>[0]["prismaClient"]
    }),
    listCompletedServiceCallCalculationsForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listCompletedServiceCallCalculationsForDate>[0]["prismaClient"]
    }),
    listServiceCallsForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listServiceCallsForDate>[0]["prismaClient"]
    })
  ]);

  const earcarePoolTotal = completedCalculations.reduce((sum, calculation) => sum + calculation.earcarePoolAmount, 0);
  const eligibleRows = attendance.rows.filter((row) => row.isPayoutEligible);
  const eligibleCount = eligibleRows.length;
  const baseShareAmount = eligibleCount > 0 ? Math.floor(earcarePoolTotal / eligibleCount) : 0;
  const remainderAmount = eligibleCount > 0 ? earcarePoolTotal - baseShareAmount * eligibleCount : 0;
  const remainderEmployeeIds = new Set(
    [...eligibleRows]
      .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.employeeId.localeCompare(b.employeeId))
      .slice(0, remainderAmount)
      .map((row) => row.employeeId)
  );

  const rows = attendance.rows.map((row): EarcareDailySettlementRowDto => {
    const remainderShareAmount = row.isPayoutEligible && remainderEmployeeIds.has(row.employeeId) ? 1 : 0;
    const payoutAmount = row.isPayoutEligible ? baseShareAmount + remainderShareAmount : 0;
    return {
      employeeId: row.employeeId,
      staffCode: row.staffCode,
      displayName: row.displayName,
      statusCode: row.statusCode,
      statusDisplayName: row.statusDisplayName,
      isPayoutEligible: row.isPayoutEligible,
      exclusionReason: row.exclusionReason,
      baseShareAmount: row.isPayoutEligible ? baseShareAmount : 0,
      remainderShareAmount,
      payoutAmount,
      calculationBasis: payoutBasis({
        row,
        earcarePoolTotal,
        eligibleCount,
        baseShareAmount,
        remainderShareAmount
      })
    };
  });
  const distributedAmount = rows.reduce((sum, row) => sum + row.payoutAmount, 0);

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    isLocked: operatingMonth.status === "잠금",
    earcarePoolTotal,
    sourceCallCount: completedCalculations.length,
    eligibleCount,
    baseShareAmount,
    remainderAmount,
    distributedAmount,
    undistributedAmount: earcarePoolTotal - distributedAmount,
    warningCounts: warningCounts(callRows),
    rows,
    poolEvidence: completedCalculations.map((calculation) => ({
      serviceCallId: calculation.serviceCallId,
      serviceDate: calculation.serviceDate,
      earcarePoolAmount: calculation.earcarePoolAmount
    }))
  };
}
