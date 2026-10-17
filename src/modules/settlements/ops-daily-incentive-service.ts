import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  completedServiceCallCalculationsFromRows,
  listCompletedServiceCallCalculationsForDate,
  listServiceCallsForDate,
  listServiceCallsForOperatingMonth,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import {
  listOpsAttendanceByDateForOperatingMonth,
  listOpsAttendanceForDate,
  type OpsAttendanceDto,
  type OpsAttendanceForDateDto
} from "@/modules/settlements/ops-attendance-service";
import { settlementEvidenceCall, type SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";
import {
  confirmPayoutConfirmation,
  listActivelyConfirmedUnitEmployeeIds,
  attachPayoutConfirmationsToRows,
  derivePayoutConfirmationStatus,
  listPayoutConfirmationHistoriesByDate,
  toPayoutConfirmationPrismaClient,
  reconfirmPayoutConfirmation,
  releasePayoutConfirmation,
  type PayoutConfirmationDto
} from "@/modules/settlements/payout-confirmation-service";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type EmployeeRecord = {
  id: string;
  employeeGroup: string;
  isActive: boolean;
  /** S7: 비활성된 직원도 자리표시 지급 확인 행에 이름을 보일 수 있게 한다. */
  staffCode?: string;
  displayName?: string;
  position?: string;
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
  employee?: {
    findUnique?(args: unknown): Promise<EmployeeRecord | null>;
  };
  payoutConfirmationEvent?: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
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
  /** 지급 확인(ADR 0004, 티켓 30·31). 이 값은 송금이 아니라 "확인했다는 사실"이다. */
  payoutConfirmation: PayoutConfirmationDto;
};

export type OpsDailyCallEvidenceDto = {
  serviceCallId: string;
  serviceDate: string;
  /** 같은 조회에서 읽은 콜 행이 없으면(그 사이 바뀐 경우) null이다. */
  call: SettlementEvidenceCallDto | null;
};

export type OpsDailyIncentiveResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  isLocked: boolean;
  dailyOpsCallCount: number;
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

/** 운영팀 일일 인센 지급 확인 한 단위를 가리키는 서버 액션 결과. */
export type OpsDailyIncentivePayoutResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
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

const payoutUnitSchema = incentiveQuerySchema.extend({
  employeeId: z.string().min(1, "운영팀 직원을 선택하세요."),
  actorId: z.string().min(1, "처리자를 확인할 수 없습니다.")
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

function isCompletedStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function effectiveForMonth(rule: OpsDailyIncentiveRuleRecord, monthKey: string) {
  return rule.isActive && rule.effectiveFromMonth <= monthKey && (!rule.effectiveToMonth || rule.effectiveToMonth >= monthKey);
}

function warningCounts(rows: Awaited<ReturnType<typeof listServiceCallsForDate>>): OpsDailyIncentiveWarningCounts {
  return {
    notCompleted: rows.filter((row) => !isCompletedStatus(row.status)).length,
    coursePolicyMissing: rows.filter((row) => row.calculationStatus === "course_policy_missing").length,
    therapistRateMissing: rows.filter((row) => row.calculationStatus === "therapist_rate_missing").length,
    secondTherapistRequired: rows.filter((row) => row.calculationStatus === "second_therapist_required").length
  };
}

function selectRule(input: { rules: OpsDailyIncentiveRuleRecord[]; monthKey: string; dailyOpsCallCount: number }) {
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

  const appliedRule = effectiveRules.find((rule) => input.dailyOpsCallCount >= rule.thresholdCallCount);
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
  dailyOpsCallCount: number;
  ruleStatus: OpsDailyIncentiveRuleStatus;
  appliedThresholdCallCount: number | null;
  personalIncentiveAmount: number;
  warningMessage: string | null;
}) {
  if (!input.row.isPayoutEligible) return `${input.row.exclusionReason ?? input.row.statusDisplayName} 제외`;
  if (input.ruleStatus === "missing_policy") return input.warningMessage ?? "운영팀 일일 인센 정책 없음";
  if (input.ruleStatus === "below_threshold") return input.warningMessage ?? "30콜 미만";
  return `일 총콜 ${input.dailyOpsCallCount}콜 / ${input.appliedThresholdCallCount}콜 이상 개인 ${input.personalIncentiveAmount} VND`;
}


/** 지급 확인을 쓰려는(확인/재확인/해제) 운영팀 직원이 활성 OPERATIONS인지 확인한다. */
async function assertActiveOpsEmployee(input: { client: OpsDailyIncentivePrismaClient; employeeId: string }) {
  if (!input.client.employee?.findUnique) return;

  const employee = await input.client.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) {
    throw new Error("운영팀 직원을 찾을 수 없습니다.");
  }
  if (!employee.isActive || employee.employeeGroup !== "OPERATIONS") {
    throw new Error("활성 운영팀 직원만 지급 확인을 변경할 수 있습니다.");
  }
}

/** 그날 이 운영팀 직원의 행(현재 계산 금액)을 다시 읽는다. 확인/재확인은 이 금액을 사건에 남긴다. */
async function opsDailyIncentiveRow(input: {
  client: OpsDailyIncentivePrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const { rows } = await listOpsDailyIncentives({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    prismaClient: input.client
  });
  return rows.find((row) => row.employeeId === input.employeeId) ?? null;
}

async function assertPayoutHasIncentiveRow(input: {
  client: OpsDailyIncentivePrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const row = await opsDailyIncentiveRow(input);
  if (!row) {
    throw new Error("해당 날짜의 운영팀 정산 대상을 찾을 수 없습니다.");
  }
  return row;
}

export async function listOpsDailyIncentives(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: OpsDailyIncentivePrismaClient;
  serviceCallRows?: ServiceCallRowDto[];
  attendance?: OpsAttendanceForDateDto;
  /** 월간 집계는 금액만 쓴다. 지급 확인 조회를 날짜마다 하지 않는다. */
  skipPayoutReads?: boolean;
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
    input.attendance ??
      listOpsAttendanceForDate({
        operatingMonthId: parsed.data.operatingMonthId,
        attendanceDate: parsed.data.serviceDate,
        prismaClient: client as unknown as Parameters<typeof listOpsAttendanceForDate>[0]["prismaClient"]
      }),
    input.serviceCallRows
      ? completedServiceCallCalculationsFromRows(input.serviceCallRows)
      : listCompletedServiceCallCalculationsForDate({
          operatingMonthId: parsed.data.operatingMonthId,
          serviceDate: parsed.data.serviceDate,
          prismaClient: client as unknown as Parameters<typeof listCompletedServiceCallCalculationsForDate>[0]["prismaClient"]
        }),
    input.serviceCallRows
      ? input.serviceCallRows
      : listServiceCallsForDate({
          operatingMonthId: parsed.data.operatingMonthId,
          serviceDate: parsed.data.serviceDate,
          prismaClient: client as unknown as Parameters<typeof listServiceCallsForDate>[0]["prismaClient"]
        }),
    client.opsDailyIncentiveRule.findMany({
      where: { isActive: true },
      orderBy: [{ thresholdCallCount: "desc" }, { effectiveFromMonth: "desc" }]
    })
  ]);

  const dailyOpsCallCount = completedCalculations.length;
  const callRowsById = new Map(callRows.map((row) => [row.id, row]));
  const ruleSelection = selectRule({ rules, monthKey: operatingMonth.monthKey, dailyOpsCallCount });
  const rows: Array<Omit<OpsDailyIncentiveRowDto, "payoutConfirmation">> = attendance.rows.map((row) => {
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
        dailyOpsCallCount,
        ...ruleSelection
      })
    };
  });

  // S7(ADR 0004): 확인 사건이 있는 단위는 그날 출근 행이 없어도(직원이 비활성되어도) 금액 0인 행으로
  // 남긴다. 그래야 attachPayoutConfirmations가 "지급 재확인 필요"로 가리고, 마감 점검도 이 차이를 막을
  // 수 있다.
  if (!input.skipPayoutReads && client.payoutConfirmationEvent) {
    const confirmedEmployeeIds = await listActivelyConfirmedUnitEmployeeIds({
      unitType: "OPS_DAILY",
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: toPayoutConfirmationPrismaClient(client)
    });
    const presentIds = new Set(rows.map((row) => row.employeeId));
    for (const employeeId of confirmedEmployeeIds) {
      if (presentIds.has(employeeId)) continue;
      const employee = await client.employee?.findUnique?.({ where: { id: employeeId } });
      rows.push({
        employeeId,
        staffCode: employee?.staffCode ?? employeeId,
        displayName: employee?.displayName ?? employeeId,
        position: employee?.position ?? "",
        statusCode: "",
        statusDisplayName: "그 날짜 출근 기록 없음",
        isPayoutEligible: false,
        exclusionReason: "그 날짜 출근 기록 없음",
        payoutAmount: 0,
        calculationBasis: "확인 사건은 있지만 그 날짜 계산 대상이 아닙니다."
      });
    }
  }

  const rowsWithPayoutConfirmation = input.skipPayoutReads
    ? rows.map((row) => ({
        ...row,
        payoutConfirmation: derivePayoutConfirmationStatus([], row.payoutAmount, operatingMonth.status)
      }))
    : await attachPayoutConfirmationsToRows({
        unitType: "OPS_DAILY",
        currentAmount: (row) => row.payoutAmount,
        client,
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate: parsed.data.serviceDate,
        operatingMonthStatus: operatingMonth.status,
        rows
      });

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    isLocked: isOperatingMonthPayoutLocked(operatingMonth.status),
    dailyOpsCallCount,
    sourceCallCount: completedCalculations.length,
    appliedThresholdCallCount: ruleSelection.appliedThresholdCallCount,
    personalIncentiveAmount: ruleSelection.personalIncentiveAmount,
    ruleStatus: ruleSelection.ruleStatus,
    warningMessage: ruleSelection.warningMessage,
    eligibleCount: rows.filter((row) => row.isPayoutEligible).length,
    distributedAmount: rows.reduce((sum, row) => sum + row.payoutAmount, 0),
    warningCounts: warningCounts(callRows),
    rows: rowsWithPayoutConfirmation,
    callEvidence: completedCalculations.map((calculation) => {
      const callRow = callRowsById.get(calculation.serviceCallId);
      return {
        serviceCallId: calculation.serviceCallId,
        serviceDate: calculation.serviceDate,
        call: callRow ? settlementEvidenceCall(callRow) : null
      };
    })
  };
}

/** 운영월의 날짜 하나와 그 날짜의 운영팀 직원별 지급 확인 상태(월 전체 집계용, 티켓 32·33). */
export type OpsDailyPayoutConfirmationDto = {
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

/**
 * 이 운영월의 모든 날짜·운영팀 직원 지급 확인 상태를 한 번에 돌려준다. 월 명세서(티켓 32)와 마감 점검의
 * "지급 재확인 미처리" 집계(티켓 33)가 쓴다. 날짜마다 listOpsDailyIncentives를 다시 계산해 현재 지급액과
 * 비교하므로(지급 재확인 필요 판정에 필요) 운영월 전체를 도는 비용이 있다.
 */
export async function listOpsDailyPayoutConfirmationsForMonth(input: {
  operatingMonthId: string;
  prismaClient?: OpsDailyIncentivePrismaClient;
}): Promise<OpsDailyPayoutConfirmationDto[]> {
  const parsed = z.object({ operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.") }).safeParse(input);
  if (!parsed.success) {
    throw new OpsDailyIncentiveDomainError(parsed.error.issues[0]?.message ?? "운영월을 선택하세요.", "INVALID_OPS_DAILY_INCENTIVE_INPUT");
  }

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new OpsDailyIncentiveDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  const [monthRows, attendanceByDate, historiesByDate] = await Promise.all([
    listServiceCallsForOperatingMonth({
      operatingMonthId: parsed.data.operatingMonthId,
      startDate,
      endDate,
      prismaClient: client as unknown as Parameters<typeof listServiceCallsForOperatingMonth>[0]["prismaClient"]
    }),
    listOpsAttendanceByDateForOperatingMonth({
      operatingMonthId: parsed.data.operatingMonthId,
      startDate,
      endDate,
      prismaClient: client as unknown as Parameters<typeof listOpsAttendanceByDateForOperatingMonth>[0]["prismaClient"]
    }),
    listPayoutConfirmationHistoriesByDate({
      unitType: "OPS_DAILY",
      operatingMonthId: parsed.data.operatingMonthId,
      startDate,
      endDate,
      prismaClient: toPayoutConfirmationPrismaClient(client)
    })
  ]);
  const rowsByDate = new Map<string, ServiceCallRowDto[]>();
  for (const row of monthRows) {
    const bucket = rowsByDate.get(row.serviceDate) ?? [];
    bucket.push(row);
    rowsByDate.set(row.serviceDate, bucket);
  }

  const results: OpsDailyPayoutConfirmationDto[] = [];
  for (const serviceDate of [...attendanceByDate.keys()]) {
    const dayResult = await listOpsDailyIncentives({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      prismaClient: client,
      serviceCallRows: rowsByDate.get(serviceDate) ?? [],
      attendance: attendanceByDate.get(serviceDate),
      skipPayoutReads: true
    });
    const histories = historiesByDate.get(serviceDate) ?? new Map<string, PayoutConfirmationDto["history"]>();
    const seen = new Set<string>();
    for (const row of dayResult.rows) {
      seen.add(row.employeeId);
      results.push({
        serviceDate,
        employeeId: row.employeeId,
        payoutConfirmation: derivePayoutConfirmationStatus(histories.get(row.employeeId) ?? [], row.payoutAmount, operatingMonth.status)
      });
    }
    for (const [employeeId, history] of histories) {
      if (seen.has(employeeId) || history[0]?.eventType === "release") continue;
      results.push({
        serviceDate,
        employeeId,
        payoutConfirmation: derivePayoutConfirmationStatus(history, 0, operatingMonth.status)
      });
    }
  }
  return results;
}

/** 확인: 그날 계산된 지급액을 지급 확인 사건으로 남긴다. 아직 확인된 사건이 없는 단위에만 쓸 수 있다. */
export async function confirmOpsDailyIncentivePayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason?: string | null;
  prismaClient?: OpsDailyIncentivePrismaClient;
}): Promise<OpsDailyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await confirmPayoutConfirmation({
    unitType: "OPS_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    amount: row.payoutAmount,
    actorId: parsed.data.actorId,
    reason: input.reason ?? null,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 재확인: 금액이 바뀌어 지급 재확인 필요(또는 확인 금액 미기록)인 단위를 현재 지급액으로 다시 확인한다. 사유는 필수다. */
export async function reconfirmOpsDailyIncentivePayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: OpsDailyIncentivePrismaClient;
}): Promise<OpsDailyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 재확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await reconfirmPayoutConfirmation({
    unitType: "OPS_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    amount: row.payoutAmount,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 해제: 확인을 취소해 미확인으로 되돌린다. 정산 대상 행 여부와 무관하게 허용한다(잘못 확인한 기록 정리). 사유는 필수다. */
export async function releaseOpsDailyIncentivePayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: OpsDailyIncentivePrismaClient;
}): Promise<OpsDailyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 해제 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await opsDailyIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await releasePayoutConfirmation({
    unitType: "OPS_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    currentAmount: row?.payoutAmount ?? 0,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}
