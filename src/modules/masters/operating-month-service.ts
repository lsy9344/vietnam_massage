import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  changeOperatingMonthStatusSchema,
  createOperatingMonthSchema,
  type OperatingMonthStatus
} from "@/modules/masters/operating-month-schema";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

type OperatingMonthPrismaClient = {
  operatingMonth: {
    create(args: unknown): Promise<OperatingMonthRecord>;
    findMany(args?: unknown): Promise<OperatingMonthRecord[]>;
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
    update(args: unknown): Promise<OperatingMonthRecord>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: OperatingMonthPrismaClient) => Promise<T>): Promise<T>;
};

export type OperatingMonthDto = {
  id: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  status: OperatingMonthStatus;
  createdAt: string;
  updatedAt: string;
};

export type OperatingMonthDateRange = Pick<OperatingMonthDto, "monthKey" | "startDate" | "endDate" | "status">;

export type CreateOperatingMonthInput = {
  actorId: string;
  monthKey: string;
  startDate?: string;
  endDate?: string;
  prismaClient?: OperatingMonthPrismaClient;
};

export type ChangeOperatingMonthStatusInput = {
  actorId: string;
  monthKey: string;
  status: OperatingMonthStatus;
  prismaClient?: OperatingMonthPrismaClient;
};

export class OperatingMonthDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "OperatingMonthDomainError";
  }
}

function getClient(client?: OperatingMonthPrismaClient) {
  return client ?? (prisma as unknown as OperatingMonthPrismaClient);
}

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assertStatus(value: string): asserts value is OperatingMonthStatus {
  if (!["작성중", "검토중", "마감확정", "잠금"].includes(value)) {
    throw new OperatingMonthDomainError("운영월 상태가 올바르지 않습니다.", "INVALID_OPERATING_MONTH_STATUS");
  }
}

function toDto(record: OperatingMonthRecord): OperatingMonthDto {
  assertStatus(record.status);
  return {
    id: record.id,
    monthKey: record.monthKey,
    startDate: toIsoDateOnly(record.startDate),
    endDate: toIsoDateOnly(record.endDate),
    status: record.status,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toAuditSnapshot(dto: OperatingMonthDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    monthKey: dto.monthKey,
    startDate: dto.startDate,
    endDate: dto.endDate,
    status: dto.status
  };
}

function normalizeParseError(message: string) {
  return new OperatingMonthDomainError(message, "INVALID_OPERATING_MONTH_INPUT");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

async function runInTransaction<T>(client: OperatingMonthPrismaClient, callback: (tx: OperatingMonthPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

export function calculateOperatingMonthRange(monthKey: string) {
  const parsedMonthKey = createOperatingMonthSchema.pick({ monthKey: true }).safeParse({ monthKey });
  if (!parsedMonthKey.success) {
    throw normalizeParseError("운영월은 YYYY-MM 형식이어야 합니다.");
  }

  const [year, month] = parsedMonthKey.data.monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    monthKey: parsedMonthKey.data.monthKey,
    startDate: `${parsedMonthKey.data.monthKey}-01`,
    endDate: `${parsedMonthKey.data.monthKey}-${String(lastDay).padStart(2, "0")}`
  };
}

export async function createOperatingMonth(input: CreateOperatingMonthInput) {
  const parsed = createOperatingMonthSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "운영월 입력값이 올바르지 않습니다.");
  }

  const expectedRange = calculateOperatingMonthRange(parsed.data.monthKey);
  if (
    (parsed.data.startDate && parsed.data.startDate !== expectedRange.startDate) ||
    (parsed.data.endDate && parsed.data.endDate !== expectedRange.endDate)
  ) {
    throw new OperatingMonthDomainError("운영월 날짜 범위가 YYYY-MM과 일치하지 않습니다.", "OPERATING_MONTH_RANGE_MISMATCH");
  }

  const client = getClient(input.prismaClient);

  try {
    return await runInTransaction(client, async (tx) => {
      const record = await tx.operatingMonth.create({
        data: {
          monthKey: expectedRange.monthKey,
          startDate: toDateOnly(expectedRange.startDate),
          endDate: toDateOnly(expectedRange.endDate),
          status: "작성중"
        }
      });
      const dto = toDto(record);

      await recordAuditEvent(
        {
          actorId: input.actorId,
          action: "operating_month.created",
          targetType: "operating_month",
          targetId: dto.id,
          beforeValue: null,
          afterValue: toAuditSnapshot(dto)
        },
        { prismaClient: tx as any }
      );

      return dto;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new OperatingMonthDomainError("이미 존재하는 운영월입니다.", "DUPLICATE_OPERATING_MONTH");
    }

    throw error;
  }
}

export async function listOperatingMonths(options: { prismaClient?: OperatingMonthPrismaClient } = {}) {
  const records = await getClient(options.prismaClient).operatingMonth.findMany({
    orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }]
  });

  return records.map(toDto);
}

export async function changeOperatingMonthStatus(input: ChangeOperatingMonthStatusInput) {
  const parsed = changeOperatingMonthStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "운영월 상태 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await tx.operatingMonth.findUnique({
      where: { monthKey: parsed.data.monthKey }
    });

    if (!currentRecord) {
      throw new OperatingMonthDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }

    const before = toDto(currentRecord);
    if (before.status !== "작성중" || parsed.data.status !== "검토중") {
      throw new OperatingMonthDomainError(
        "이 story에서는 작성중에서 검토중으로 변경만 지원합니다.",
        "UNSUPPORTED_OPERATING_MONTH_TRANSITION"
      );
    }

    const updateResult = await tx.operatingMonth.updateMany({
      where: { monthKey: parsed.data.monthKey, status: "작성중" },
      data: { status: parsed.data.status }
    });
    if (updateResult.count !== 1) {
      throw new OperatingMonthDomainError(
        "이 story에서는 작성중에서 검토중으로 변경만 지원합니다.",
        "UNSUPPORTED_OPERATING_MONTH_TRANSITION"
      );
    }

    const updatedRecord = await tx.operatingMonth.findUnique({
      where: { monthKey: parsed.data.monthKey }
    });
    if (!updatedRecord) {
      throw new OperatingMonthDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }
    const after = toDto(updatedRecord);

    await recordAuditEvent(
      {
        actorId: input.actorId,
        action: "operating_month.status_changed",
        targetType: "operating_month",
        targetId: after.id,
        beforeValue: toAuditSnapshot(before),
        afterValue: toAuditSnapshot(after)
      },
      { prismaClient: tx as any }
    );

    return after;
  });
}

export async function getOperatingMonthDateRange(
  monthKey: string,
  options: { prismaClient?: OperatingMonthPrismaClient } = {}
): Promise<OperatingMonthDateRange> {
  const parsedMonthKey = createOperatingMonthSchema.pick({ monthKey: true }).safeParse({ monthKey });
  if (!parsedMonthKey.success) {
    throw normalizeParseError("운영월은 YYYY-MM 형식이어야 합니다.");
  }

  const record = await getClient(options.prismaClient).operatingMonth.findUnique({
    where: { monthKey: parsedMonthKey.data.monthKey }
  });
  if (!record) {
    throw new OperatingMonthDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }

  const { monthKey: dtoMonthKey, startDate, endDate, status } = toDto(record);
  return {
    monthKey: dtoMonthKey,
    startDate,
    endDate,
    status
  };
}
