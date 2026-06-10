import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto
} from "@/modules/closing/monthly-closing-preview-service";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
};

type MonthlyClosingRecord = {
  id: string;
  operatingMonthId: string;
  snapshotJson: unknown;
  confirmedByAccountId: string;
  confirmedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

type JsonPlainValue = string | number | boolean | null | JsonPlainValue[] | { [key: string]: JsonPlainValue };

type MonthlyClosingPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  monthlyClosing: {
    create(args: unknown): Promise<MonthlyClosingRecord>;
    findUnique(args: unknown): Promise<MonthlyClosingRecord | null>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: MonthlyClosingPrismaClient) => Promise<T>, options?: unknown): Promise<T>;
};

export type MonthlyClosingSnapshotDto = {
  id: string;
  month: {
    operatingMonthId: string;
    monthKey: string;
    startDate: string;
    endDate: string;
    statusAtConfirmation: string;
    confirmedStatus: "마감확정";
    confirmedAt: string;
    confirmedByAccountId: string;
  };
  therapists: MonthlyClosingPreviewDto["therapists"];
  operations: MonthlyClosingPreviewDto["operations"];
  earcare: MonthlyClosingPreviewDto["earcare"];
  totals: MonthlyClosingPreviewDto["totals"];
  warningCounts: MonthlyClosingPreviewDto["warningCounts"];
  evidence: MonthlyClosingPreviewDto["evidence"];
  source: {
    serviceVersion: "monthly-closing-service:5.3";
    previewBasis: "listMonthlyClosingPreview";
    snapshotCreatedAt: string;
  };
};

export type MonthlyClosingDto = {
  id: string;
  operatingMonthId: string;
  status: "마감확정";
  confirmedByAccountId: string;
  confirmedAt: string;
  snapshot: MonthlyClosingSnapshotDto;
};

export type MonthlyCloseReviewDto = {
  id: string;
  monthKey: string;
  startDate: string;
  endDate: string;
  status: string;
};

export type MonthlyClosingDependencies = {
  listMonthlyClosingPreview: typeof listMonthlyClosingPreview;
};

export type StartMonthlyCloseReviewInput = {
  operatingMonthId: string;
  actorId: string;
  prismaClient?: MonthlyClosingPrismaClient;
};

export type ConfirmMonthlyCloseInput = {
  operatingMonthId: string;
  actorId: string;
  prismaClient?: MonthlyClosingPrismaClient;
  dependencies?: MonthlyClosingDependencies;
  clock?: () => Date;
  idFactory?: () => string;
};

export type LockMonthlyCloseInput = {
  operatingMonthId: string;
  actorId: string;
  prismaClient?: MonthlyClosingPrismaClient;
  clock?: () => Date;
};

export type GetMonthlyClosingSnapshotInput = {
  operatingMonthId: string;
  prismaClient?: MonthlyClosingPrismaClient;
};

export class MonthlyClosingDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MonthlyClosingDomainError";
  }
}

const monthlyClosingInputSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  actorId: z.string().trim().min(1, "처리자 계정을 확인할 수 없습니다.")
});

const snapshotQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const defaultDependencies: MonthlyClosingDependencies = {
  listMonthlyClosingPreview
};

function getClient(client?: MonthlyClosingPrismaClient) {
  return client ?? (prisma as unknown as MonthlyClosingPrismaClient);
}

function toIsoDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeParseError(message: string) {
  return new MonthlyClosingDomainError(message, "INVALID_MONTHLY_CLOSE_INPUT");
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function isPlainObject(value: object) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainJson(value: unknown, path = "snapshotJson"): asserts value is JsonPlainValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) return;
    throw new MonthlyClosingDomainError(`확정 스냅샷은 유효한 JSON number만 저장할 수 있습니다. (${path})`, "INVALID_MONTHLY_CLOSE_INPUT");
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertPlainJson(entry, `${path}[${index}]`));
    return;
  }

  if (typeof value === "object" && value !== null && isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertPlainJson(entry, `${path}.${key}`);
    }
    return;
  }

  throw new MonthlyClosingDomainError(`확정 스냅샷은 plain JSON 값만 저장할 수 있습니다. (${path})`, "INVALID_MONTHLY_CLOSE_INPUT");
}

function clonePlainJson<T>(value: T): T {
  assertPlainJson(value);
  return structuredClone(value);
}

async function runInTransaction<T>(client: MonthlyClosingPrismaClient, callback: (tx: MonthlyClosingPrismaClient) => Promise<T>) {
  if (!client.$transaction) return callback(client);

  return client.$transaction(callback, {
    isolationLevel: "Serializable"
  });
}

function operatingMonthAuditSnapshot(record: OperatingMonthRecord): AuditJsonSnapshot {
  return {
    id: record.id,
    monthKey: record.monthKey,
    startDate: toIsoDateOnly(record.startDate),
    endDate: toIsoDateOnly(record.endDate),
    status: record.status
  };
}

function toReviewDto(record: OperatingMonthRecord): MonthlyCloseReviewDto {
  return {
    id: record.id,
    monthKey: record.monthKey,
    startDate: toIsoDateOnly(record.startDate),
    endDate: toIsoDateOnly(record.endDate),
    status: record.status
  };
}

function createSnapshot(input: {
  preview: MonthlyClosingPreviewDto;
  snapshotId: string;
  confirmedAt: string;
  confirmedByAccountId: string;
}): MonthlyClosingSnapshotDto {
  return {
    id: input.snapshotId,
    month: {
      operatingMonthId: input.preview.operatingMonthId,
      monthKey: input.preview.monthKey,
      startDate: input.preview.startDate,
      endDate: input.preview.endDate,
      statusAtConfirmation: input.preview.status,
      confirmedStatus: "마감확정",
      confirmedAt: input.confirmedAt,
      confirmedByAccountId: input.confirmedByAccountId
    },
    therapists: input.preview.therapists,
    operations: input.preview.operations,
    earcare: input.preview.earcare,
    totals: input.preview.totals,
    warningCounts: input.preview.warningCounts,
    evidence: input.preview.evidence,
    source: {
      serviceVersion: "monthly-closing-service:5.3",
      previewBasis: "listMonthlyClosingPreview",
      snapshotCreatedAt: input.confirmedAt
    }
  };
}

function assertSnapshotJson(value: unknown): asserts value is MonthlyClosingSnapshotDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new MonthlyClosingDomainError("확정 스냅샷 형식이 올바르지 않습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
  }
}

function toDto(record: MonthlyClosingRecord, snapshot: MonthlyClosingSnapshotDto): MonthlyClosingDto {
  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    status: "마감확정",
    confirmedByAccountId: record.confirmedByAccountId,
    confirmedAt: record.confirmedAt.toISOString(),
    snapshot
  };
}

export async function startMonthlyCloseReview(input: StartMonthlyCloseReviewInput) {
  const parsed = monthlyClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 검토 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  return runInTransaction(client, async (tx) => {
    const current = await tx.operatingMonth.findUnique({
      where: { id: parsed.data.operatingMonthId }
    });
    if (!current) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }
    if (current.status !== "작성중") {
      throw new MonthlyClosingDomainError("현재 상태에서는 검토를 시작할 수 없습니다.", "INVALID_MONTHLY_CLOSE_TRANSITION");
    }

    const updateResult = await tx.operatingMonth.updateMany({
      where: { id: current.id, status: "작성중" },
      data: { status: "검토중" }
    });
    if (updateResult.count !== 1) {
      throw new MonthlyClosingDomainError("현재 상태에서는 검토를 시작할 수 없습니다.", "INVALID_MONTHLY_CLOSE_TRANSITION");
    }

    const updated = await tx.operatingMonth.findUnique({
      where: { id: current.id }
    });
    if (!updated) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: "operating_month.status_changed",
        targetType: "operating_month",
        targetId: updated.id,
        beforeValue: operatingMonthAuditSnapshot(current),
        afterValue: operatingMonthAuditSnapshot(updated)
      },
      { prismaClient: tx as any }
    );

    return toReviewDto(updated);
  });
}

export async function confirmMonthlyClose(input: ConfirmMonthlyCloseInput): Promise<MonthlyClosingDto> {
  const parsed = monthlyClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 확정 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  const dependencies = input.dependencies ?? defaultDependencies;
  const now = input.clock?.() ?? new Date();
  const confirmedAt = now.toISOString();
  const snapshotId = input.idFactory?.() ?? `closing_${randomUUID()}`;

  try {
    return await runInTransaction(client, async (tx) => {
      const current = await tx.operatingMonth.findUnique({
        where: { id: parsed.data.operatingMonthId }
      });
      if (!current) {
        throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
      }
      if (current.status !== "검토중") {
        throw new MonthlyClosingDomainError("현재 상태에서는 마감 확정할 수 없습니다.", "INVALID_MONTHLY_CLOSE_TRANSITION");
      }

      const preview = await dependencies.listMonthlyClosingPreview({
        operatingMonthId: parsed.data.operatingMonthId,
        prismaClient: tx as any
      });
      if (preview.status !== "검토중") {
        throw new MonthlyClosingDomainError("현재 상태에서는 마감 확정할 수 없습니다.", "INVALID_MONTHLY_CLOSE_TRANSITION");
      }

      const updateResult = await tx.operatingMonth.updateMany({
        where: { id: current.id, status: "검토중" },
        data: { status: "마감확정" }
      });
      if (updateResult.count !== 1) {
        throw new MonthlyClosingDomainError("현재 상태에서는 마감 확정할 수 없습니다.", "MONTHLY_CLOSE_ALREADY_CONFIRMED");
      }

      const snapshot = clonePlainJson(
        createSnapshot({
          preview,
          snapshotId,
          confirmedAt,
          confirmedByAccountId: parsed.data.actorId
        })
      );
      const closing = await tx.monthlyClosing.create({
        data: {
          id: snapshotId,
          operatingMonthId: current.id,
          snapshotJson: snapshot,
          confirmedByAccountId: parsed.data.actorId,
          confirmedAt: now
        }
      });

      await recordAuditEvent(
        {
          actorId: parsed.data.actorId,
          action: "monthly_close.confirmed",
          targetType: "monthly_close",
          targetId: closing.id,
          beforeValue: {
            operatingMonthId: current.id,
            monthKey: current.monthKey,
            status: current.status
          },
          afterValue: {
            operatingMonthId: current.id,
            monthKey: current.monthKey,
            status: "마감확정",
            snapshotId: closing.id,
            confirmedAt
          }
        },
        { prismaClient: tx as any }
      );

      return toDto({ ...closing, snapshotJson: snapshot }, snapshot);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MonthlyClosingDomainError("현재 상태에서는 마감 확정할 수 없습니다.", "MONTHLY_CLOSE_ALREADY_CONFIRMED");
    }

    throw error;
  }
}

export async function lockMonthlyClose(input: LockMonthlyCloseInput): Promise<MonthlyCloseReviewDto> {
  const parsed = monthlyClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 잠금 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  const now = input.clock?.() ?? new Date();
  const lockedAt = now.toISOString();

  return runInTransaction(client, async (tx) => {
    const current = await tx.operatingMonth.findUnique({
      where: { id: parsed.data.operatingMonthId }
    });
    if (!current) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }
    if (current.status === "잠금") {
      throw new MonthlyClosingDomainError("이미 잠금 상태인 운영월입니다.", "MONTHLY_CLOSE_ALREADY_LOCKED");
    }
    if (current.status !== "마감확정") {
      throw new MonthlyClosingDomainError("먼저 마감확정이 필요합니다.", "MONTHLY_CLOSE_NOT_CONFIRMED");
    }

    const updateResult = await tx.operatingMonth.updateMany({
      where: { id: current.id, status: "마감확정" },
      data: { status: "잠금" }
    });
    if (updateResult.count !== 1) {
      throw new MonthlyClosingDomainError("현재 상태에서는 잠금 처리할 수 없습니다.", "INVALID_MONTHLY_CLOSE_TRANSITION");
    }

    const closing = await tx.monthlyClosing.findUnique({
      where: { operatingMonthId: current.id }
    });
    if (!closing) {
      throw new MonthlyClosingDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
    }

    const updated = await tx.operatingMonth.findUnique({
      where: { id: current.id }
    });
    if (!updated) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: "monthly_close.locked",
        targetType: "monthly_close",
        targetId: closing.id,
        beforeValue: {
          operatingMonthId: current.id,
          monthKey: current.monthKey,
          status: current.status,
          snapshotId: closing.id
        },
        afterValue: {
          operatingMonthId: updated.id,
          monthKey: updated.monthKey,
          status: updated.status,
          snapshotId: closing.id,
          lockedAt,
          lockedByAccountId: parsed.data.actorId
        }
      },
      { prismaClient: tx as any }
    );

    return toReviewDto(updated);
  });
}

export async function getMonthlyClosingSnapshot(input: GetMonthlyClosingSnapshotInput): Promise<MonthlyClosingDto> {
  const parsed = snapshotQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 스냅샷 조회 조건이 올바르지 않습니다.");
  }

  const record = await getClient(input.prismaClient).monthlyClosing.findUnique({
    where: { operatingMonthId: parsed.data.operatingMonthId }
  });

  if (!record) {
    throw new MonthlyClosingDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
  }

  assertSnapshotJson(record.snapshotJson);
  return toDto(record, record.snapshotJson);
}
