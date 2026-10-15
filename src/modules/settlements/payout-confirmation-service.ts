import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { assertOperatingMonthPayoutWritable } from "@/modules/closing/month-lock-guard";

/**
 * 지급 확인(ADR 0004, 티켓 30): 세 직군(Therapist·귀케어·운영팀)의 정산 행 지급 확인을 공통으로 다루는 서비스.
 * 단위는 (unitType, operatingMonthId, serviceDate, employeeId)이고, serviceDate는 월 단위(운영팀 월 인센)에서 null이다.
 * 확인·재확인·해제는 금액·처리자·시각·사유를 가진 사건으로 쌓이고, 현재 상태는 사건과 현재 계산 금액에서 도출한다.
 * 현재 계산 금액은 호출하는 쪽(직군별 계산 서비스)이 넘겨주고, 이 서비스는 계산하지 않는다.
 * 티켓 31(귀케어·운영팀)은 unitType만 바꿔 이 서비스를 그대로 쓴다.
 */

export const payoutConfirmationUnitTypes = ["THERAPIST_DAILY", "EARCARE_DAILY", "OPS_DAILY", "OPS_MONTHLY"] as const;
export type PayoutConfirmationUnitType = (typeof payoutConfirmationUnitTypes)[number];

/** 월 단위(운영팀 월 인센)는 날짜 없이 운영월 하나가 단위다. */
function unitRequiresServiceDate(unitType: PayoutConfirmationUnitType) {
  return unitType !== "OPS_MONTHLY";
}

const payoutConfirmationEventTypes = ["confirm", "reconfirm", "release"] as const;
export type PayoutConfirmationEventType = (typeof payoutConfirmationEventTypes)[number];

export type PayoutConfirmationStatus = "unconfirmed" | "confirmed" | "needs_reconfirmation" | "confirmed_amount_unrecorded";

export class PayoutConfirmationDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "PayoutConfirmationDomainError";
  }
}

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type PayoutConfirmationActorRecord = {
  accountId: string;
  employee?: { displayName: string; staffCode: string } | null;
};

type PayoutConfirmationEventRecord = {
  id: string;
  unitType: string;
  operatingMonthId: string;
  serviceDate: Date | null;
  employeeId: string;
  eventType: string;
  amount: number | null;
  reason: string | null;
  actorAccountId: string;
  actorAccount?: PayoutConfirmationActorRecord | null;
  occurredAt: Date;
  createdAt: Date;
};

type PayoutConfirmationPrismaClient = {
  $transaction?<T>(callback: (tx: PayoutConfirmationPrismaClient) => Promise<T>, options?: unknown): Promise<T>;
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  payoutConfirmationEvent: {
    findMany(args?: unknown): Promise<PayoutConfirmationEventRecord[]>;
    create(args: unknown): Promise<PayoutConfirmationEventRecord>;
  };
};

export type PayoutConfirmationActorDto = {
  accountId: string;
  employeeDisplayName: string | null;
  employeeStaffCode: string | null;
};

export type PayoutConfirmationEventDto = {
  id: string;
  eventType: PayoutConfirmationEventType;
  amount: number | null;
  reason: string | null;
  occurredAt: string;
  actorAccountId: string;
  actor: PayoutConfirmationActorDto | null;
};

/** 정산 행 하나의 지급 확인 현재 상태. 송금이 아니라 "확인했다는 사실"을 보여 준다. */
export type PayoutConfirmationDto = {
  status: PayoutConfirmationStatus;
  /** 호출하는 쪽이 넘긴 현재 계산 금액(그대로 반영). */
  currentAmount: number;
  /** 마지막으로 금액을 남긴 확인/재확인의 금액. 옮겨온 과거 기록처럼 금액이 없으면 null. */
  lastConfirmedAmount: number | null;
  /** currentAmount - lastConfirmedAmount. 비교할 금액이 없으면 null. */
  difference: number | null;
  /** 지급 재확인 필요, 또는(확인 금액 미기록이고 운영월이 작성중·검토중이라) 재확인이 필요한 것으로 센다. */
  requiresReconfirmation: boolean;
  /** 최신 사건이 먼저 오는 전체 이력. */
  history: PayoutConfirmationEventDto[];
};

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function isDateWithinOperatingMonth(serviceDate: Date, month: OperatingMonthRecord) {
  return serviceDate >= month.startDate && serviceDate <= month.endDate;
}

function getClient(client?: PayoutConfirmationPrismaClient) {
  return client ?? (prisma as unknown as PayoutConfirmationPrismaClient);
}

const unitKeySchema = z
  .object({
    unitType: z.enum(payoutConfirmationUnitTypes),
    operatingMonthId: z.string().min(1, "운영월을 선택하세요."),
    serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.").nullable(),
    employeeId: z.string().min(1, "직원을 선택하세요.")
  })
  .superRefine((value, context) => {
    const requiresServiceDate = unitRequiresServiceDate(value.unitType);
    if (requiresServiceDate && value.serviceDate === null) {
      context.addIssue({ code: "custom", path: ["serviceDate"], message: "이 지급 확인 단위에는 날짜가 필요합니다." });
    }
    if (!requiresServiceDate && value.serviceDate !== null) {
      context.addIssue({ code: "custom", path: ["serviceDate"], message: "월 단위 지급 확인에는 날짜를 지정할 수 없습니다." });
    }
  });

const amountSchema = z.number().int().min(0, "금액은 0 이상의 정수여야 합니다.");

const confirmInputSchema = unitKeySchema.and(
  z.object({
    amount: amountSchema,
    actorId: z.string().min(1, "처리자를 확인할 수 없습니다."),
    reason: z.string().trim().max(500, "사유는 500자 이하로 입력하세요.").nullable().optional()
  })
);

const reconfirmInputSchema = unitKeySchema.and(
  z.object({
    amount: amountSchema,
    actorId: z.string().min(1, "처리자를 확인할 수 없습니다."),
    reason: z.string().trim().min(1, "재확인 사유를 입력하세요.").max(500, "사유는 500자 이하로 입력하세요.")
  })
);

const releaseInputSchema = unitKeySchema.and(
  z.object({
    currentAmount: amountSchema,
    actorId: z.string().min(1, "처리자를 확인할 수 없습니다."),
    reason: z.string().trim().min(1, "해제 사유를 입력하세요.").max(500, "사유는 500자 이하로 입력하세요.")
  })
);

function toEventDto(record: PayoutConfirmationEventRecord): PayoutConfirmationEventDto {
  return {
    id: record.id,
    eventType: record.eventType as PayoutConfirmationEventType,
    amount: record.amount,
    reason: record.reason,
    occurredAt: record.occurredAt.toISOString(),
    actorAccountId: record.actorAccountId,
    actor: record.actorAccount
      ? {
          accountId: record.actorAccount.accountId,
          employeeDisplayName: record.actorAccount.employee?.displayName ?? null,
          employeeStaffCode: record.actorAccount.employee?.staffCode ?? null
        }
      : null
  };
}

const actorInclude = {
  actorAccount: {
    select: {
      accountId: true,
      employee: { select: { displayName: true, staffCode: true } }
    }
  }
};

/**
 * 사건과 현재 계산 금액에서 지급 확인 현재 상태를 도출한다(순수 함수). `history`는 최신이 먼저 오는 순서여야 한다.
 * - 사건이 없거나 마지막 사건이 해제면 미확인.
 * - 마지막 사건에 금액이 없으면(옮겨온 과거 지급완료) 확인 금액 미기록. 운영월이 작성중·검토중이면 재확인 필요로 센다.
 * - 마지막 확인 금액과 현재 금액이 다르면 지급 재확인 필요(이전 금액, 현재 금액, 차이와 함께).
 * - 같으면 확인됨.
 */
export function derivePayoutConfirmationStatus(
  history: PayoutConfirmationEventDto[],
  currentAmount: number,
  operatingMonthStatus: string
): PayoutConfirmationDto {
  const latest = history[0] ?? null;

  if (!latest || latest.eventType === "release") {
    return { status: "unconfirmed", currentAmount, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history };
  }

  if (latest.amount === null) {
    const requiresReconfirmation = operatingMonthStatus === "작성중" || operatingMonthStatus === "검토중";
    return { status: "confirmed_amount_unrecorded", currentAmount, lastConfirmedAmount: null, difference: null, requiresReconfirmation, history };
  }

  if (latest.amount !== currentAmount) {
    return {
      status: "needs_reconfirmation",
      currentAmount,
      lastConfirmedAmount: latest.amount,
      difference: currentAmount - latest.amount,
      requiresReconfirmation: true,
      history
    };
  }

  return { status: "confirmed", currentAmount, lastConfirmedAmount: latest.amount, difference: 0, requiresReconfirmation: false, history };
}

function isActiveLatestEvent(latest: PayoutConfirmationEventDto | null) {
  return latest !== null && latest.eventType !== "release";
}

/** confirm은 확인된 사건이 없을 때만, reconfirm/release는 확인된 사건이 있을 때만 쓸 수 있다. */
function assertTransitionAllowed(history: PayoutConfirmationEventDto[], eventType: PayoutConfirmationEventType) {
  const latest = history[0] ?? null;
  const isActive = isActiveLatestEvent(latest);

  if (eventType === "confirm" && isActive) {
    throw new PayoutConfirmationDomainError(
      "이미 확인된 지급 확인입니다. 금액이 바뀌었으면 재확인하세요.",
      "PAYOUT_CONFIRMATION_ALREADY_CONFIRMED"
    );
  }

  if ((eventType === "reconfirm" || eventType === "release") && !isActive) {
    throw new PayoutConfirmationDomainError(
      "확인된 지급 확인이 없어 재확인하거나 해제할 수 없습니다.",
      "PAYOUT_CONFIRMATION_NOT_CONFIRMED"
    );
  }
}

async function fetchUnitHistory(
  client: PayoutConfirmationPrismaClient,
  key: { unitType: PayoutConfirmationUnitType; operatingMonthId: string; serviceDate: Date | null; employeeId: string }
) {
  const records = await client.payoutConfirmationEvent.findMany({
    where: {
      unitType: key.unitType,
      operatingMonthId: key.operatingMonthId,
      serviceDate: key.serviceDate,
      employeeId: key.employeeId
    },
    include: actorInclude,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });
  return records.map(toEventDto);
}

const CONFIRMATION_TRANSACTION_OPTIONS = { isolationLevel: "Serializable" } as const;
const MAX_CONFIRMATION_TRANSACTION_ATTEMPTS = 3;

function isRetryableConfirmationTransactionError(error: unknown) {
  const code = (error as { code?: unknown })?.code;
  return code === "P2034" || code === "40001";
}

async function runConfirmationTransaction<T>(
  client: PayoutConfirmationPrismaClient,
  callback: (tx: PayoutConfirmationPrismaClient) => Promise<T>
) {
  if (!client.$transaction) {
    throw new Error("지급 확인 트랜잭션을 사용할 수 없습니다.");
  }

  for (let attempt = 1; attempt <= MAX_CONFIRMATION_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await client.$transaction(callback, CONFIRMATION_TRANSACTION_OPTIONS);
    } catch (error) {
      if (attempt === MAX_CONFIRMATION_TRANSACTION_ATTEMPTS || !isRetryableConfirmationTransactionError(error)) {
        throw error;
      }
    }
  }

  throw new Error("지급 확인 트랜잭션을 완료할 수 없습니다.");
}

async function appendPayoutConfirmationEvent(input: {
  client: PayoutConfirmationPrismaClient;
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  serviceDate: string | null;
  employeeId: string;
  eventType: PayoutConfirmationEventType;
  amount: number | null;
  reason: string | null;
  actorId: string;
  currentAmount: number;
}): Promise<PayoutConfirmationDto> {
  return runConfirmationTransaction(input.client, async (tx) => {
    const month = await tx.operatingMonth.findUnique({ where: { id: input.operatingMonthId } });
    if (!month) {
      throw new PayoutConfirmationDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }
    assertOperatingMonthPayoutWritable(month, "마감확정 또는 잠금 운영월에는 지급 확인 사건을 쓸 수 없습니다.");

    const serviceDateValue = input.serviceDate ? toDateOnly(input.serviceDate) : null;
    if (serviceDateValue && !isDateWithinOperatingMonth(serviceDateValue, month)) {
      throw new PayoutConfirmationDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
    }

    const unitKey = { unitType: input.unitType, operatingMonthId: input.operatingMonthId, serviceDate: serviceDateValue, employeeId: input.employeeId };
    const existingHistory = await fetchUnitHistory(tx, unitKey);
    assertTransitionAllowed(existingHistory, input.eventType);

    const created = await tx.payoutConfirmationEvent.create({
      data: {
        unitType: input.unitType,
        operatingMonthId: input.operatingMonthId,
        serviceDate: serviceDateValue,
        employeeId: input.employeeId,
        eventType: input.eventType,
        amount: input.amount,
        reason: input.reason,
        actorAccountId: input.actorId,
        occurredAt: new Date()
      },
      include: actorInclude
    });

    const history = [toEventDto(created), ...existingHistory];
    return derivePayoutConfirmationStatus(history, input.currentAmount, month.status);
  });
}

/** 확인: 확인된 사건이 없는 단위에만 쓸 수 있다. 사유는 선택이다. */
export async function confirmPayoutConfirmation(input: {
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  serviceDate: string | null;
  employeeId: string;
  amount: number;
  actorId: string;
  reason?: string | null;
  prismaClient?: PayoutConfirmationPrismaClient;
}): Promise<PayoutConfirmationDto> {
  const parsed = confirmInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 입력값이 올바르지 않습니다.");
  }

  return appendPayoutConfirmationEvent({
    client: getClient(input.prismaClient),
    unitType: parsed.data.unitType,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    eventType: "confirm",
    amount: parsed.data.amount,
    reason: parsed.data.reason ?? null,
    actorId: parsed.data.actorId,
    currentAmount: parsed.data.amount
  });
}

/** 재확인: 확인된 사건(확인됨/지급 재확인 필요/확인 금액 미기록)이 있는 단위에만 쓸 수 있다. 사유는 필수다. */
export async function reconfirmPayoutConfirmation(input: {
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  serviceDate: string | null;
  employeeId: string;
  amount: number;
  actorId: string;
  reason: string;
  prismaClient?: PayoutConfirmationPrismaClient;
}): Promise<PayoutConfirmationDto> {
  const parsed = reconfirmInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 재확인 입력값이 올바르지 않습니다.");
  }

  return appendPayoutConfirmationEvent({
    client: getClient(input.prismaClient),
    unitType: parsed.data.unitType,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    eventType: "reconfirm",
    amount: parsed.data.amount,
    reason: parsed.data.reason,
    actorId: parsed.data.actorId,
    currentAmount: parsed.data.amount
  });
}

/** 해제: 확인된 사건이 있는 단위에만 쓸 수 있다. 사유는 필수다. 해제 뒤 금액은 남기지 않는다(다시 확인하면 새 금액). */
export async function releasePayoutConfirmation(input: {
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  serviceDate: string | null;
  employeeId: string;
  currentAmount: number;
  actorId: string;
  reason: string;
  prismaClient?: PayoutConfirmationPrismaClient;
}): Promise<PayoutConfirmationDto> {
  const parsed = releaseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 해제 입력값이 올바르지 않습니다.");
  }

  return appendPayoutConfirmationEvent({
    client: getClient(input.prismaClient),
    unitType: parsed.data.unitType,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    eventType: "release",
    amount: null,
    reason: parsed.data.reason,
    actorId: parsed.data.actorId,
    currentAmount: parsed.data.currentAmount
  });
}

/**
 * 같은 (unitType, operatingMonthId, serviceDate)의 여러 직원 지급 확인을 한 번에 읽는다(목록 화면의 N+1 방지).
 * operatingMonthStatus는 호출하는 쪽이 이미 읽은 운영월 상태를 그대로 넘긴다(중복 조회 방지).
 */
export async function listPayoutConfirmations(input: {
  unitType: PayoutConfirmationUnitType;
  operatingMonthId: string;
  serviceDate: string | null;
  operatingMonthStatus: string;
  units: Array<{ employeeId: string; currentAmount: number }>;
  prismaClient?: PayoutConfirmationPrismaClient;
}): Promise<Map<string, PayoutConfirmationDto>> {
  const result = new Map<string, PayoutConfirmationDto>();
  if (input.units.length === 0) return result;

  const client = getClient(input.prismaClient);
  const serviceDateValue = input.serviceDate ? toDateOnly(input.serviceDate) : null;
  const employeeIds = input.units.map((unit) => unit.employeeId);

  const records = await client.payoutConfirmationEvent.findMany({
    where: {
      unitType: input.unitType,
      operatingMonthId: input.operatingMonthId,
      serviceDate: serviceDateValue,
      employeeId: { in: employeeIds }
    },
    include: actorInclude,
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }]
  });

  const historyByEmployeeId = new Map<string, PayoutConfirmationEventDto[]>();
  for (const record of records) {
    const list = historyByEmployeeId.get(record.employeeId) ?? [];
    list.push(toEventDto(record));
    historyByEmployeeId.set(record.employeeId, list);
  }

  for (const unit of input.units) {
    result.set(
      unit.employeeId,
      derivePayoutConfirmationStatus(historyByEmployeeId.get(unit.employeeId) ?? [], unit.currentAmount, input.operatingMonthStatus)
    );
  }

  return result;
}
