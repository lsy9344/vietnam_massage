import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  listCompletedServiceCallCalculationsForDate,
  listServiceCallsForDate
} from "@/modules/calls/service-call-service";
import { listOpsAttendanceForDate, type OpsAttendanceDto } from "@/modules/settlements/ops-attendance-service";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type OpsDailyIncentiveRuleRecord = {
  id: string;
  thresholdCallCount: number;
  personalAmount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
};

type OpsDailyIncentivePrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  opsDailyIncentiveRule: {
    findMany(args?: unknown): Promise<OpsDailyIncentiveRuleRecord[]>;
  };
};

export type OpsDailyIncentiveWarningCounts = {
  notCompleted: number;
  coursePolicyMissing: number;
  therapistRateMissing: number;
  secondTherapistRequired: number;
};

export type OpsDailyIncentiveRuleStatus = "applied" | "below_threshold" | "missing_policy";

export type OpsDailyIncentiveRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  position: string;
  statusCode: string;
  statusDisplayName: string;
  isPayoutEligible: boolean;
  exclusionReason: string | null;
  payoutAmount: number;
  calculationBasis: string;
};

export type OpsDailyCallEvidenceDto = {
  serviceCallId: string;
  serviceDate: string;
  opsCallCredit: number;
};

export type OpsDailyIncentiveResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  isLocked: boolean;
  dailyOpsCallCredit: number;
  sourceCallCount: number;
  appliedThresholdCallCount: number | null;
  personalIncentiveAmount: number;
  ruleStatus: OpsDailyIncentiveRuleStatus;
  warningMessage: string | null;
  eligibleCount: number;
  distributedAmount: number;
  warningCounts: OpsDailyIncentiveWarningCounts;
  rows: OpsDailyIncentiveRowDto[];
  callEvidence: OpsDailyCallEvidenceDto[];
};

export class OpsDailyIncentiveDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "OpsDailyIncentiveDomainError";
  }
}

const incentiveQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

function getClient(client?: OpsDailyIncentivePrismaClient) {
  return client ?? (prisma as unknown as OpsDailyIncentivePrismaClient);
}

function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function assertValidParsedDate(value: string) {
  if (toIsoDate(toDate(value)) !== value) {
    throw new OpsDailyIncentiveDomainError("조회 날짜가 올바르지 않습니다.", "INVALID_OPS_DAILY_INCENTIVE_INPUT");
  }
}

function assertDateInOperatingMonth(operatingMonth: OperatingMonthRecord, serviceDate: string) {
  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (serviceDate < startDate || serviceDate > endDate) {
    throw new OpsDailyIncentiveDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }
}

function toFieldError(error: z.ZodError) {
  return new OpsDailyIncentiveDomainError(
    error.issues[0]?.message ?? "운영팀 일일 인센 조회 조건이 올바르지 않습니다.",
    "INVALID_OPS_DAILY_INCENTIVE_INPUT"
  );
}

function effectiveForMonth(rule: OpsDailyIncentiveRuleRecord, monthKey: string) {
  return rule.isActive && rule.effectiveFromMonth <= monthKey && (!rule.effectiveToMonth || rule.effectiveToMonth >= monthKey);
}

function warningCounts(rows: Awaited<ReturnType<typeof listServiceCallsForDate>>): OpsDailyIncentiveWarningCounts {
  return {
    notCompleted: rows.filter((row) => row.calculationStatus === "not_completed").length,
    coursePolicyMissing: rows.filter((row) => row.calculationStatus === "course_policy_missing").length,
    therapistRateMissing: rows.filter((row) => row.calculationStatus === "therapist_rate_missing").length,
    secondTherapistRequired: rows.filter((row) => row.calculationStatus === "second_therapist_required").length
  };
}

function selectRule(input: { rules: OpsDailyIncentiveRuleRecord[]; monthKey: string; dailyOpsCallCredit: number }) {
  const effectiveRules = input.rules
    .filter((rule) => effectiveForMonth(rule, input.monthKey))
    .sort((a, b) => b.thresholdCallCount - a.thresholdCallCount || b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

  if (effectiveRules.length === 0) {
    return {
      ruleStatus: "missing_policy" as const,
      warningMessage: "적용월에 활성 운영팀 일일 인센 정책이 없습니다.",
      appliedThresholdCallCount: null,
      personalIncentiveAmount: 0
    };
  }

  const appliedRule = effectiveRules.find((rule) => input.dailyOpsCallCredit >= rule.thresholdCallCount);
  if (!appliedRule) {
    const minimumThreshold = Math.min(...effectiveRules.map((rule) => rule.thresholdCallCount));
    return {
      ruleStatus: "below_threshold" as const,
      warningMessage: `${minimumThreshold}콜 미만으로 운영팀 일일 인센이 없습니다.`,
      appliedThresholdCallCount: null,
      personalIncentiveAmount: 0
    };
  }

  return {
    ruleStatus: "applied" as const,
    warningMessage: null,
    appliedThresholdCallCount: appliedRule.thresholdCallCount,
    personalIncentiveAmount: appliedRule.personalAmount
  };
}

function calculationBasis(input: {
  row: OpsAttendanceDto;
  dailyOpsCallCredit: number;
  ruleStatus: OpsDailyIncentiveRuleStatus;
  appliedThresholdCallCount: number | null;
  personalIncentiveAmount: number;
  warningMessage: string | null;
}) {
  if (!input.row.isPayoutEligible) return `${input.row.exclusionReason ?? input.row.statusDisplayName} 제외`;
  if (input.ruleStatus === "missing_policy") return input.warningMessage ?? "운영팀 일일 인센 정책 없음";
  if (input.ruleStatus === "below_threshold") return input.warningMessage ?? "30콜 미만";
  return `일 총콜 ${input.dailyOpsCallCredit}콜 / ${input.appliedThresholdCallCount}콜 이상 개인 ${input.personalIncentiveAmount} VND`;
}

export async function listOpsDailyIncentives(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: OpsDailyIncentivePrismaClient;
}): Promise<OpsDailyIncentiveResultDto> {
  const parsed = incentiveQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);
  assertValidParsedDate(parsed.data.serviceDate);

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new OpsDailyIncentiveDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  assertDateInOperatingMonth(operatingMonth, parsed.data.serviceDate);

  const [attendance, completedCalculations, callRows, rules] = await Promise.all([
    listOpsAttendanceForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      attendanceDate: parsed.data.serviceDate,
      prismaClient: client as unknown as Parameters<typeof listOpsAttendanceForDate>[0]["prismaClient"]
    }),
    listCompletedServiceCallCalculationsForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as unknown as Parameters<typeof listCompletedServiceCallCalculationsForDate>[0]["prismaClient"]
    }),
    listServiceCallsForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as unknown as Parameters<typeof listServiceCallsForDate>[0]["prismaClient"]
    }),
    client.opsDailyIncentiveRule.findMany({
      where: { isActive: true },
      orderBy: [{ thresholdCallCount: "desc" }, { effectiveFromMonth: "desc" }]
    })
  ]);

  const dailyOpsCallCredit = completedCalculations.reduce((sum, calculation) => sum + calculation.opsCallCredit, 0);
  const ruleSelection = selectRule({ rules, monthKey: operatingMonth.monthKey, dailyOpsCallCredit });
  const rows = attendance.rows.map((row): OpsDailyIncentiveRowDto => {
    const payoutAmount = row.isPayoutEligible && ruleSelection.ruleStatus === "applied" ? ruleSelection.personalIncentiveAmount : 0;
    return {
      employeeId: row.employeeId,
      staffCode: row.staffCode,
      displayName: row.displayName,
      position: row.position,
      statusCode: row.statusCode,
      statusDisplayName: row.statusDisplayName,
      isPayoutEligible: row.isPayoutEligible,
      exclusionReason: row.exclusionReason,
      payoutAmount,
      calculationBasis: calculationBasis({
        row,
        dailyOpsCallCredit,
        ...ruleSelection
      })
    };
  });

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    isLocked: isOperatingMonthPayoutLocked(operatingMonth.status),
    dailyOpsCallCredit,
    sourceCallCount: completedCalculations.length,
    appliedThresholdCallCount: ruleSelection.appliedThresholdCallCount,
    personalIncentiveAmount: ruleSelection.personalIncentiveAmount,
    ruleStatus: ruleSelection.ruleStatus,
    warningMessage: ruleSelection.warningMessage,
    eligibleCount: rows.filter((row) => row.isPayoutEligible).length,
    distributedAmount: rows.reduce((sum, row) => sum + row.payoutAmount, 0),
    warningCounts: warningCounts(callRows),
    rows,
    callEvidence: completedCalculations.map((calculation) => ({
      serviceCallId: calculation.serviceCallId,
      serviceDate: calculation.serviceDate,
      opsCallCredit: calculation.opsCallCredit
    }))
  };
}
