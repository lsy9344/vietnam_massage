import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  completedServiceCallCalculationsFromRows,
  listServiceCallsForOperatingMonth
} from "@/modules/calls/service-call-service";
import { settlementEvidenceCall, type SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";
import {
  confirmPayoutConfirmation,
  listActivelyConfirmedUnitEmployeeIds,
  attachPayoutConfirmationsToRows,
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
  staffCode: string;
  displayName: string;
  employeeGroup: string;
  position: string;
  sortOrder: number;
  isActive: boolean;
};

type OpsMonthlyIncentiveRuleRecord = {
  id: string;
  thresholdCallCount: number;
  totalAmount: number;
  leadShare: number;
  counterTeamShare: number;
  waiterTeamShare: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
};

type OpsMonthlyIncentivePrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique?(args: unknown): Promise<EmployeeRecord | null>;
  };
  opsMonthlyIncentiveRule: {
    findMany(args?: unknown): Promise<OpsMonthlyIncentiveRuleRecord[]>;
  };
  payoutConfirmationEvent?: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
  };
};

export type OpsMonthlyIncentiveWarningCounts = {
  notCompleted: number;
  coursePolicyMissing: number;
  therapistRateMissing: number;
  secondTherapistRequired: number;
};

export type OpsMonthlyIncentiveRuleStatus = "applied" | "below_threshold" | "missing_policy";

export type OpsMonthlyIncentivePreviewStatus = "draft_current" | "closed_current";

export type OpsMonthlyIncentiveTeamRole = "lead" | "counter" | "waiter" | "unassigned";

export type OpsMonthlyIncentiveShareDto = {
  leadShare: number;
  counterTeamShare: number;
  waiterTeamShare: number;
  leadAmount: number;
  counterTeamAmount: number;
  waiterTeamAmount: number;
  undistributedAmount: number;
};

export type OpsMonthlyIncentiveRowDto = {
  employeeId: string;
  staffCode: string;
  displayName: string;
  position: string;
  teamRole: OpsMonthlyIncentiveTeamRole;
  teamShareLabel: string;
  payoutAmount: number;
  calculationBasis: string;
  /** 지급 확인(ADR 0004, 티켓 30·31). 이 값은 송금이 아니라 "확인했다는 사실"이다. 단위는 날짜 없이 운영월+직원이다. */
  payoutConfirmation: PayoutConfirmationDto;
};

export type OpsMonthlyCallEvidenceDto = {
  serviceCallId: string;
  serviceDate: string;
  call: SettlementEvidenceCallDto | null;
};

export type OpsMonthlyIncentiveResultDto = {
  operatingMonthId: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  isClosedOrLocked: boolean;
  previewStatus: OpsMonthlyIncentivePreviewStatus;
  monthlyOpsCallCount: number;
  sourceCallCount: number;
  appliedThresholdCallCount: number | null;
  totalMonthlyIncentiveAmount: number;
  ruleStatus: OpsMonthlyIncentiveRuleStatus;
  warningMessage: string | null;
  shares: OpsMonthlyIncentiveShareDto;
  rows: OpsMonthlyIncentiveRowDto[];
  warningCounts: OpsMonthlyIncentiveWarningCounts;
  callEvidence: OpsMonthlyCallEvidenceDto[];
};

/** 운영팀 월 인센 지급 확인 한 단위를 가리키는 서버 액션 결과. 월 단위라 날짜가 없다. */
export type OpsMonthlyIncentivePayoutResultDto = {
  operatingMonthId: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

export class OpsMonthlyIncentiveDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "OpsMonthlyIncentiveDomainError";
  }
}

const previewQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const payoutUnitSchema = previewQuerySchema.extend({
  employeeId: z.string().min(1, "운영팀 직원을 선택하세요."),
  actorId: z.string().min(1, "처리자를 확인할 수 없습니다.")
});

function getClient(client?: OpsMonthlyIncentivePrismaClient) {
  return client ?? (prisma as unknown as OpsMonthlyIncentivePrismaClient);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function toFieldError(error: z.ZodError) {
  return new OpsMonthlyIncentiveDomainError(
    error.issues[0]?.message ?? "운영팀 월 인센 조회 조건이 올바르지 않습니다.",
    "INVALID_OPS_MONTHLY_INCENTIVE_INPUT"
  );
}

function effectiveForMonth(rule: OpsMonthlyIncentiveRuleRecord, monthKey: string) {
  return rule.isActive && rule.effectiveFromMonth <= monthKey && (!rule.effectiveToMonth || rule.effectiveToMonth >= monthKey);
}

function isCompletedStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function selectRule(input: { rules: OpsMonthlyIncentiveRuleRecord[]; monthKey: string; monthlyOpsCallCount: number }) {
  const effectiveRules = input.rules
    .filter((rule) => effectiveForMonth(rule, input.monthKey))
    .sort((a, b) => b.thresholdCallCount - a.thresholdCallCount || b.effectiveFromMonth.localeCompare(a.effectiveFromMonth));

  if (effectiveRules.length === 0) {
    return {
      ruleStatus: "missing_policy" as const,
      warningMessage: "적용월에 활성 운영팀 월 인센 정책이 없습니다.",
      appliedThresholdCallCount: null,
      totalMonthlyIncentiveAmount: 0,
      appliedRule: null
    };
  }

  const appliedRule = effectiveRules.find((rule) => input.monthlyOpsCallCount >= rule.thresholdCallCount);
  if (!appliedRule) {
    const minimumThreshold = Math.min(...effectiveRules.map((rule) => rule.thresholdCallCount));
    return {
      ruleStatus: "below_threshold" as const,
      warningMessage: `${minimumThreshold}콜 미만으로 운영팀 월 인센이 없습니다.`,
      appliedThresholdCallCount: null,
      totalMonthlyIncentiveAmount: 0,
      appliedRule: null
    };
  }

  return {
    ruleStatus: "applied" as const,
    warningMessage: null,
    appliedThresholdCallCount: appliedRule.thresholdCallCount,
    totalMonthlyIncentiveAmount: appliedRule.totalAmount,
    appliedRule
  };
}

function warningCounts(rows: Awaited<ReturnType<typeof listServiceCallsForOperatingMonth>>): OpsMonthlyIncentiveWarningCounts {
  return {
    notCompleted: rows.filter((row) => !isCompletedStatus(row.status)).length,
    coursePolicyMissing: rows.filter((row) => row.calculationStatus === "course_policy_missing").length,
    therapistRateMissing: rows.filter((row) => row.calculationStatus === "therapist_rate_missing").length,
    secondTherapistRequired: rows.filter((row) => row.calculationStatus === "second_therapist_required").length
  };
}

function orderedEmployees(employees: EmployeeRecord[]) {
  return [...employees].sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.id.localeCompare(b.id));
}

function isLead(employee: EmployeeRecord) {
  return employee.position === "팀장" || employee.staffCode === "OPS-LEAD-001";
}

function isCounter(employee: EmployeeRecord) {
  return employee.position.includes("카운터") || employee.staffCode.includes("COUNTER");
}

function isWaiter(employee: EmployeeRecord) {
  return employee.position.includes("웨이터") || employee.staffCode.includes("WAITER");
}

function teamRole(employee: EmployeeRecord): OpsMonthlyIncentiveTeamRole {
  if (isLead(employee)) return "lead";
  if (isCounter(employee)) return "counter";
  if (isWaiter(employee)) return "waiter";
  return "unassigned";
}

function teamLabel(role: OpsMonthlyIncentiveTeamRole) {
  if (role === "lead") return "팀장";
  if (role === "counter") return "카운터팀";
  if (role === "waiter") return "웨이터팀";
  return "미분류";
}

function allocateTeamAmount(amount: number, members: EmployeeRecord[]) {
  if (members.length === 0 || amount === 0) {
    return { allocations: new Map<string, number>(), undistributedAmount: amount };
  }

  const ordered = orderedEmployees(members);
  const baseAmount = Math.floor(amount / ordered.length);
  const remainder = amount - baseAmount * ordered.length;
  const allocations = new Map<string, number>();
  ordered.forEach((employee, index) => {
    allocations.set(employee.id, baseAmount + (index < remainder ? 1 : 0));
  });
  return { allocations, undistributedAmount: 0 };
}

function mergeWarningMessages(...messages: Array<string | null | undefined>) {
  const activeMessages = messages.filter((message): message is string => Boolean(message));
  return activeMessages.length > 0 ? activeMessages.join(" ") : null;
}

function buildDistribution(input: {
  employees: EmployeeRecord[];
  ruleStatus: OpsMonthlyIncentiveRuleStatus;
  appliedRule: OpsMonthlyIncentiveRuleRecord | null;
}) {
  const totalAmount = input.ruleStatus === "applied" && input.appliedRule ? input.appliedRule.totalAmount : 0;
  const leadShare = input.appliedRule?.leadShare ?? 0;
  const counterTeamShare = input.appliedRule?.counterTeamShare ?? 0;
  const waiterTeamShare = input.appliedRule?.waiterTeamShare ?? 0;
  const leadAmount = Math.floor(totalAmount * leadShare);
  const counterTeamAmount = Math.floor(totalAmount * counterTeamShare);
  const waiterTeamAmount = Math.floor(totalAmount * waiterTeamShare);
  let undistributedAmount = totalAmount - leadAmount - counterTeamAmount - waiterTeamAmount;
  const warnings: string[] = [];
  const employees = orderedEmployees(input.employees);

  if (input.ruleStatus !== "applied") {
    return {
      shares: { leadShare, counterTeamShare, waiterTeamShare, leadAmount, counterTeamAmount, waiterTeamAmount, undistributedAmount: 0 },
      rows: employees.map((employee) => rowForEmployee(employee, teamRole(employee), 0, "월 인센 지급 조건 미충족")),
      warningMessage: null
    };
  }

  if (employees.length === 0) {
    return {
      shares: { leadShare, counterTeamShare, waiterTeamShare, leadAmount, counterTeamAmount, waiterTeamAmount, undistributedAmount: totalAmount },
      rows: [],
      warningMessage: "활성 운영팀 직원이 없어 전체 월 인센을 미배분으로 남겼습니다."
    };
  }

  const leadCandidates = employees.filter(isLead);
  const counterMembers = employees.filter((employee) => !isLead(employee) && isCounter(employee));
  const waiterMembers = employees.filter((employee) => !isLead(employee) && isWaiter(employee));
  if (leadCandidates.length === 0) warnings.push("팀장 대상자가 없어 팀장 몫을 미배분으로 남겼습니다.");
  if (leadCandidates.length > 1) warnings.push("팀장 대상자가 2명 이상이라 deterministic order의 첫 번째 직원에게 팀장 몫을 배정했습니다.");
  if (counterMembers.length === 0) warnings.push("카운터팀 대상자가 없어 카운터팀 몫을 미배분으로 남겼습니다.");
  if (waiterMembers.length === 0) warnings.push("웨이터팀 대상자가 없어 웨이터팀 몫을 미배분으로 남겼습니다.");

  const leadRecipient = leadCandidates[0] ?? null;
  const leadAllocations = new Map<string, number>();
  if (leadRecipient) {
    leadAllocations.set(leadRecipient.id, leadAmount);
  } else {
    undistributedAmount += leadAmount;
  }
  const counterAllocation = allocateTeamAmount(counterTeamAmount, counterMembers);
  const waiterAllocation = allocateTeamAmount(waiterTeamAmount, waiterMembers);
  undistributedAmount += counterAllocation.undistributedAmount + waiterAllocation.undistributedAmount;

  const rows = employees.map((employee) => {
    const role = teamRole(employee);
    const amount =
      leadAllocations.get(employee.id) ?? counterAllocation.allocations.get(employee.id) ?? waiterAllocation.allocations.get(employee.id) ?? 0;
    const basis = basisForEmployee({
      role,
      amount,
      leadAmount,
      counterTeamAmount,
      waiterTeamAmount,
      counterCount: counterMembers.length,
      waiterCount: waiterMembers.length,
      isLeadCandidate: leadCandidates.some((candidate) => candidate.id === employee.id),
      isLeadRecipient: leadRecipient?.id === employee.id
    });
    return rowForEmployee(employee, role, amount, basis);
  });

  return {
    shares: { leadShare, counterTeamShare, waiterTeamShare, leadAmount, counterTeamAmount, waiterTeamAmount, undistributedAmount },
    rows,
    warningMessage: warnings.length > 0 ? warnings.join(" ") : null
  };
}

function basisForEmployee(input: {
  role: OpsMonthlyIncentiveTeamRole;
  amount: number;
  leadAmount: number;
  counterTeamAmount: number;
  waiterTeamAmount: number;
  counterCount: number;
  waiterCount: number;
  isLeadCandidate: boolean;
  isLeadRecipient: boolean;
}) {
  if (input.role === "lead") {
    if (input.isLeadRecipient) return `팀장 몫 ${input.leadAmount} VND`;
    if (input.isLeadCandidate) return "팀장 중복 대상 / deterministic order 후순위";
    return "팀장 대상 아님";
  }
  if (input.role === "counter") {
    if (input.counterCount === 0) return `카운터팀 대상자 0명 / 미배분 ${input.counterTeamAmount} VND`;
    return `카운터팀 몫 ${input.counterTeamAmount} VND / ${input.counterCount}명`;
  }
  if (input.role === "waiter") {
    if (input.waiterCount === 0) return `웨이터팀 대상자 0명 / 미배분 ${input.waiterTeamAmount} VND`;
    return `웨이터팀 몫 ${input.waiterTeamAmount} VND / ${input.waiterCount}명`;
  }
  return input.amount > 0 ? "미분류 지급" : "월 인센 팀 분류 대상 아님";
}

function rowForEmployee(employee: EmployeeRecord, role: OpsMonthlyIncentiveTeamRole, payoutAmount: number, calculationBasis: string) {
  // Employee.id is the stable downstream row key for monthly incentive distribution.
  return {
    employeeId: employee.id,
    staffCode: employee.staffCode,
    displayName: employee.displayName,
    position: employee.position,
    teamRole: role,
    teamShareLabel: teamLabel(role),
    payoutAmount,
    calculationBasis
  };
}


/** 지급 확인을 쓰려는(확인/재확인/해제) 운영팀 직원이 활성 OPERATIONS인지 확인한다. */
async function assertActiveOpsEmployee(input: { client: OpsMonthlyIncentivePrismaClient; employeeId: string }) {
  if (!input.client.employee.findUnique) return;

  const employee = await input.client.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) {
    throw new Error("운영팀 직원을 찾을 수 없습니다.");
  }
  if (!employee.isActive || employee.employeeGroup !== "OPERATIONS") {
    throw new Error("활성 운영팀 직원만 지급 확인을 변경할 수 있습니다.");
  }
}

/** 이 운영월 이 운영팀 직원의 행(현재 계산 금액)을 다시 읽는다. 확인/재확인은 이 금액을 사건에 남긴다. */
async function opsMonthlyIncentiveRow(input: { client: OpsMonthlyIncentivePrismaClient; operatingMonthId: string; employeeId: string }) {
  const result = await listOpsMonthlyIncentivePreview({
    operatingMonthId: input.operatingMonthId,
    prismaClient: input.client
  });
  return result.rows.find((row) => row.employeeId === input.employeeId) ?? null;
}

async function assertPayoutHasIncentiveRow(input: { client: OpsMonthlyIncentivePrismaClient; operatingMonthId: string; employeeId: string }) {
  const row = await opsMonthlyIncentiveRow(input);
  if (!row) {
    throw new Error("해당 월의 운영팀 정산 대상을 찾을 수 없습니다.");
  }
  return row;
}

export async function listOpsMonthlyIncentivePreview(input: {
  operatingMonthId: string;
  prismaClient?: OpsMonthlyIncentivePrismaClient;
}): Promise<OpsMonthlyIncentiveResultDto> {
  const parsed = previewQuerySchema.safeParse(input);
  if (!parsed.success) throw toFieldError(parsed.error);

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new OpsMonthlyIncentiveDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const startDate = toIsoDate(operatingMonth.startDate);
  const endDate = toIsoDate(operatingMonth.endDate);
  if (startDate > endDate) {
    throw new OpsMonthlyIncentiveDomainError("운영월 날짜 범위가 올바르지 않습니다.", "INVALID_OPERATING_MONTH_DATE_RANGE");
  }

  const [employees, callRows, rules] = await Promise.all([
    client.employee.findMany({
      where: { employeeGroup: "OPERATIONS", isActive: true },
      orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }, { id: "asc" }]
    }),
    listServiceCallsForOperatingMonth({
      operatingMonthId: parsed.data.operatingMonthId,
      startDate,
      endDate,
      prismaClient: client as unknown as Parameters<typeof listServiceCallsForOperatingMonth>[0]["prismaClient"]
    }),
    client.opsMonthlyIncentiveRule.findMany({
      where: { isActive: true },
      orderBy: [{ thresholdCallCount: "desc" }, { effectiveFromMonth: "desc" }]
    })
  ]);

  const completedCalculations = completedServiceCallCalculationsFromRows(callRows);
  const callRowsById = new Map(callRows.map((row) => [row.id, row]));
  const monthlyOpsCallCount = completedCalculations.length;
  const ruleSelection = selectRule({ rules, monthKey: operatingMonth.monthKey, monthlyOpsCallCount });
  const distribution = buildDistribution({
    employees,
    ruleStatus: ruleSelection.ruleStatus,
    appliedRule: ruleSelection.appliedRule
  });
  const isClosedOrLocked = operatingMonth.status === "마감확정" || operatingMonth.status === "잠금";

  // S7(ADR 0004): 확인 사건이 있는 단위는 이 운영월에 활성 운영팀 직원이 아니게 되어도(비활성) 금액
  // 0인 행으로 남긴다. 그래야 attachPayoutConfirmations가 "지급 재확인 필요"로 가리고, 마감 점검도
  // 이 차이를 막을 수 있다.
  if (client.payoutConfirmationEvent) {
    const confirmedEmployeeIds = await listActivelyConfirmedUnitEmployeeIds({
      unitType: "OPS_MONTHLY",
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: null,
      prismaClient: toPayoutConfirmationPrismaClient(client)
    });
    const presentIds = new Set(distribution.rows.map((row) => row.employeeId));
    for (const employeeId of confirmedEmployeeIds) {
      if (presentIds.has(employeeId)) continue;
      const employee = await client.employee.findUnique?.({ where: { id: employeeId } });
      const fallback: EmployeeRecord = employee ?? {
        id: employeeId,
        staffCode: employeeId,
        displayName: employeeId,
        employeeGroup: "OPERATIONS",
        position: "",
        sortOrder: 9999,
        isActive: false
      };
      distribution.rows.push(rowForEmployee(fallback, teamRole(fallback), 0, "확인 사건은 있지만 이 운영월 계산 대상이 아닙니다."));
    }
  }

  const rowsWithPayoutConfirmation = await attachPayoutConfirmationsToRows({
      unitType: "OPS_MONTHLY",
      currentAmount: (row) => row.payoutAmount,
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    operatingMonthStatus: operatingMonth.status,
    rows: distribution.rows
  });

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    monthKey: operatingMonth.monthKey,
    startDate,
    endDate,
    isClosedOrLocked,
    previewStatus: isClosedOrLocked ? "closed_current" : "draft_current",
    monthlyOpsCallCount,
    sourceCallCount: completedCalculations.length,
    appliedThresholdCallCount: ruleSelection.appliedThresholdCallCount,
    totalMonthlyIncentiveAmount: ruleSelection.totalMonthlyIncentiveAmount,
    ruleStatus: ruleSelection.ruleStatus,
    warningMessage: mergeWarningMessages(ruleSelection.warningMessage, distribution.warningMessage),
    shares: distribution.shares,
    rows: rowsWithPayoutConfirmation,
    warningCounts: warningCounts(callRows),
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

/** 확인: 이 운영월 현재 계산된 지급액을 지급 확인 사건으로 남긴다. 아직 확인된 사건이 없는 단위에만 쓸 수 있다. */
export async function confirmOpsMonthlyIncentivePayout(input: {
  operatingMonthId: string;
  employeeId: string;
  actorId: string;
  reason?: string | null;
  prismaClient?: OpsMonthlyIncentivePrismaClient;
}): Promise<OpsMonthlyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await confirmPayoutConfirmation({
    unitType: "OPS_MONTHLY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: null,
    employeeId: parsed.data.employeeId,
    amount: row.payoutAmount,
    actorId: parsed.data.actorId,
    reason: input.reason ?? null,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 재확인: 금액이 바뀌어 지급 재확인 필요(또는 확인 금액 미기록)인 단위를 현재 지급액으로 다시 확인한다. 사유는 필수다. */
export async function reconfirmOpsMonthlyIncentivePayout(input: {
  operatingMonthId: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: OpsMonthlyIncentivePrismaClient;
}): Promise<OpsMonthlyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 재확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await reconfirmPayoutConfirmation({
    unitType: "OPS_MONTHLY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: null,
    employeeId: parsed.data.employeeId,
    amount: row.payoutAmount,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 해제: 확인을 취소해 미확인으로 되돌린다. 정산 대상 행 여부와 무관하게 허용한다(잘못 확인한 기록 정리). 사유는 필수다. */
export async function releaseOpsMonthlyIncentivePayout(input: {
  operatingMonthId: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: OpsMonthlyIncentivePrismaClient;
}): Promise<OpsMonthlyIncentivePayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 해제 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveOpsEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await opsMonthlyIncentiveRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await releasePayoutConfirmation({
    unitType: "OPS_MONTHLY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: null,
    employeeId: parsed.data.employeeId,
    currentAmount: row?.payoutAmount ?? 0,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, employeeId: parsed.data.employeeId, payoutConfirmation };
}
