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
  employeeGroup: string;
  isActive: boolean;
  /** S7: 비활성된 직원도 자리표시 지급 확인 행에 이름을 보일 수 있게 한다. */
  staffCode?: string;
  displayName?: string;
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

  const rows: Array<Omit<EarcareDailySettlementRowDto, "payoutConfirmation">> = attendance.rows.map((row) => {
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

  // S7(ADR 0004): 확인 사건이 있는 단위는 그날 출근 행이 없어도(직원이 비활성되어도) 금액 0인 행으로
  // 남긴다. 그래야 attachPayoutConfirmations가 "지급 재확인 필요"로 가리고, 마감 점검도 이 차이를 막을
  // 수 있다. 출근 집계(eligibleCount·분배)는 이미 끝났으므로 자리표시 행은 그 계산에 끼지 않는다.
  if (client.payoutConfirmationEvent) {
    const confirmedEmployeeIds = await listActivelyConfirmedUnitEmployeeIds({
      unitType: "EARCARE_DAILY",
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
        statusCode: "",
        statusDisplayName: "그 날짜 출근 기록 없음",
        isPayoutEligible: false,
        exclusionReason: "그 날짜 출근 기록 없음",
        baseShareAmount: 0,
        remainderShareAmount: 0,
        payoutAmount: 0,
        calculationBasis: "확인 사건은 있지만 그 날짜 계산 대상이 아닙니다."
      });
    }
  }

  const distributedAmount = rows.reduce((sum, row) => sum + row.payoutAmount, 0);
  const rowsWithPayoutConfirmation = await attachPayoutConfirmationsToRows({
      unitType: "EARCARE_DAILY",
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

/** 운영월의 날짜 하나와 그 날짜의 귀케어사별 지급 확인 상태(월 전체 집계용, 티켓 32·33). */
export type EarcareDailyPayoutConfirmationDto = {
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

/**
 * 이 운영월의 모든 날짜·귀케어사 지급 확인 상태를 한 번에 돌려준다. 월 명세서(티켓 32)와 마감 점검의
 * "지급 재확인 미처리" 집계(티켓 33)가 쓴다. 날짜마다 listEarcareDailySettlements를 다시 계산해 현재 지급액과
 * 비교하므로(지급 재확인 필요 판정에 필요) 운영월 전체를 도는 비용이 있다.
 */
export async function listEarcareDailyPayoutConfirmationsForMonth(input: {
  operatingMonthId: string;
  prismaClient?: EarcareDailySettlementPrismaClient;
}): Promise<EarcareDailyPayoutConfirmationDto[]> {
  const parsed = z.object({ operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.") }).safeParse(input);
  if (!parsed.success) {
    throw new EarcareDailySettlementDomainError(parsed.error.issues[0]?.message ?? "운영월을 선택하세요.", "INVALID_EARCARE_DAILY_SETTLEMENT_INPUT");
  }

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new EarcareDailySettlementDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const results: EarcareDailyPayoutConfirmationDto[] = [];
  for (let cursor = operatingMonth.startDate; cursor <= operatingMonth.endDate; cursor = new Date(cursor.getTime() + 86400000)) {
    const serviceDate = toIsoDate(cursor);
    const dayResult = await listEarcareDailySettlements({ operatingMonthId: parsed.data.operatingMonthId, serviceDate, prismaClient: client });
    for (const row of dayResult.rows) {
      results.push({ serviceDate, employeeId: row.employeeId, payoutConfirmation: row.payoutConfirmation });
    }
  }
  return results;
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
