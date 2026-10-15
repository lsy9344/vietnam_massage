import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  listCompletedServiceCallCalculationsForDate,
  listServiceCallsForDate
} from "@/modules/calls/service-call-service";
import {
  listEarcareAttendanceForDate,
  type EarcareAttendanceDto
} from "@/modules/settlements/earcare-attendance-service";
import { settlementEvidenceCall, type SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";
import {
  confirmPayoutConfirmation,
  derivePayoutConfirmationStatus,
  listPayoutConfirmations,
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
};

type EarcareDailySettlementPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  employee?: {
    findUnique?(args: unknown): Promise<EmployeeRecord | null>;
  };
  payoutConfirmationEvent?: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
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
  /** 지급 확인(ADR 0004, 티켓 30·31). 이 값은 송금이 아니라 "확인했다는 사실"이다. */
  payoutConfirmation: PayoutConfirmationDto;
};

export type EarcarePoolEvidenceDto = {
  serviceCallId: string;
  serviceDate: string;
  earcarePoolAmount: number;
  /** 같은 조회에서 읽은 콜 행이 없으면(그 사이 바뀐 경우) null이다. */
  call: SettlementEvidenceCallDto | null;
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

/** 귀케어 일일 지급 확인 한 단위를 가리키는 서버 액션 결과. */
export type EarcareDailySettlementPayoutResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
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

const payoutUnitSchema = settlementQuerySchema.extend({
  employeeId: z.string().min(1, "귀케어사를 선택하세요."),
  actorId: z.string().min(1, "처리자를 확인할 수 없습니다.")
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

function isCompletedStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function warningCounts(rows: Awaited<ReturnType<typeof listServiceCallsForDate>>): EarcareDailySettlementWarningCounts {
  return {
    notCompleted: rows.filter((row) => !isCompletedStatus(row.status)).length,
    coursePolicyMissing: rows.filter((row) => row.calculationStatus === "course_policy_missing").length,
    therapistRateMissing: rows.filter((row) => row.calculationStatus === "therapist_rate_missing").length,
    secondTherapistRequired: rows.filter((row) => row.calculationStatus === "second_therapist_required").length
  };
}

function toPayoutConfirmationPrismaClient(client: EarcareDailySettlementPrismaClient) {
  return client as unknown as Parameters<typeof listPayoutConfirmations>[0]["prismaClient"];
}

/** 지급 확인(ADR 0004, 티켓 30·31)을 행마다 붙인다. 호출하는 쪽의 메모리 Prisma가 지급 확인 저장소를 흉내 내지 않으면 모두 미확인으로 둔다. */
async function attachPayoutConfirmations(input: {
  client: EarcareDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  operatingMonthStatus: string;
  rows: Array<Omit<EarcareDailySettlementRowDto, "payoutConfirmation">>;
}): Promise<EarcareDailySettlementRowDto[]> {
  if (!input.client.payoutConfirmationEvent) {
    return input.rows.map((row) => ({
      ...row,
      payoutConfirmation: derivePayoutConfirmationStatus([], row.payoutAmount, input.operatingMonthStatus)
    }));
  }

  const confirmations = await listPayoutConfirmations({
    unitType: "EARCARE_DAILY",
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    operatingMonthStatus: input.operatingMonthStatus,
    units: input.rows.map((row) => ({ employeeId: row.employeeId, currentAmount: row.payoutAmount })),
    prismaClient: toPayoutConfirmationPrismaClient(input.client)
  });

  return input.rows.map((row) => ({
    ...row,
    payoutConfirmation: confirmations.get(row.employeeId) ?? derivePayoutConfirmationStatus([], row.payoutAmount, input.operatingMonthStatus)
  }));
}

/** 지급 확인을 쓰려는(확인/재확인/해제) 귀케어사가 활성 EARCARE인지 확인한다. */
async function assertActiveEarcareEmployee(input: { client: EarcareDailySettlementPrismaClient; employeeId: string }) {
  if (!input.client.employee?.findUnique) return;

  const employee = await input.client.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) {
    throw new Error("귀케어사를 찾을 수 없습니다.");
  }
  if (!employee.isActive || employee.employeeGroup !== "EARCARE") {
    throw new Error("활성 귀케어사만 지급 확인을 변경할 수 있습니다.");
  }
}

/** 그날 이 귀케어사의 행(현재 계산 금액)을 다시 읽는다. 확인/재확인은 이 금액을 사건에 남긴다. */
async function earcareDailySettlementRow(input: {
  client: EarcareDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const { rows } = await listEarcareDailySettlements({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    prismaClient: input.client
  });
  return rows.find((row) => row.employeeId === input.employeeId) ?? null;
}

async function assertPayoutHasSettlementRow(input: {
  client: EarcareDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const row = await earcareDailySettlementRow(input);
  if (!row) {
    throw new Error("해당 날짜의 귀케어 정산 대상을 찾을 수 없습니다.");
  }
  return row;
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
  const callRowsById = new Map(callRows.map((row) => [row.id, row]));
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

  const rows = attendance.rows.map((row): Omit<EarcareDailySettlementRowDto, "payoutConfirmation"> => {
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
  const rowsWithPayoutConfirmation = await attachPayoutConfirmations({
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
    earcarePoolTotal,
    sourceCallCount: completedCalculations.length,
    eligibleCount,
    baseShareAmount,
    remainderAmount,
    distributedAmount,
    undistributedAmount: earcarePoolTotal - distributedAmount,
    warningCounts: warningCounts(callRows),
    rows: rowsWithPayoutConfirmation,
    poolEvidence: completedCalculations.map((calculation) => {
      const callRow = callRowsById.get(calculation.serviceCallId);
      return {
        serviceCallId: calculation.serviceCallId,
        serviceDate: calculation.serviceDate,
        earcarePoolAmount: calculation.earcarePoolAmount,
        call: callRow ? settlementEvidenceCall(callRow) : null
      };
    })
  };
}

/** 확인: 그날 계산된 지급액을 지급 확인 사건으로 남긴다. 아직 확인된 사건이 없는 단위에만 쓸 수 있다. */
export async function confirmEarcareDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason?: string | null;
  prismaClient?: EarcareDailySettlementPrismaClient;
}): Promise<EarcareDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveEarcareEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasSettlementRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await confirmPayoutConfirmation({
    unitType: "EARCARE_DAILY",
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
export async function reconfirmEarcareDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: EarcareDailySettlementPrismaClient;
}): Promise<EarcareDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 재확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveEarcareEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await assertPayoutHasSettlementRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await reconfirmPayoutConfirmation({
    unitType: "EARCARE_DAILY",
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
export async function releaseEarcareDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: EarcareDailySettlementPrismaClient;
}): Promise<EarcareDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 해제 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveEarcareEmployee({ client, employeeId: parsed.data.employeeId });
  const row = await earcareDailySettlementRow({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await releasePayoutConfirmation({
    unitType: "EARCARE_DAILY",
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
