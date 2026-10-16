import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  listMonthlyClosingPreview,
  type MonthlyClosingPreviewDto
} from "@/modules/closing/monthly-closing-preview-service";
import { listMonthlyClosingChecklist, type MonthlyClosingChecklistCallDto } from "@/modules/closing/monthly-closing-checklist-service";

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
  closeVersion: number;
  snapshotJson: unknown;
  confirmedByAccountId: string;
  confirmedAt: Date;
  reopenedAt?: Date | null;
  reopenedByAccountId?: string | null;
  reopenReason?: string | null;
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
    findFirst(args: unknown): Promise<MonthlyClosingRecord | null>;
    findMany(args: unknown): Promise<MonthlyClosingRecord[]>;
    update(args: unknown): Promise<MonthlyClosingRecord>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: MonthlyClosingPrismaClient) => Promise<T>, options?: unknown): Promise<T>;
};

// F07/ADR 0005(티켓 34): 예약·사용중·청소중 콜이 남아 있을 때 확인한 목록·사유·처리자를 이 마감 버전에
// 함께 저장한다. 콜이 없으면 null. dashboardFinancials/graphReport와 같은 이유로 optional로 둔다 —
// 이 필드가 생기기 전에 만들어진 과거 스냅샷에는 이 키가 없다.
export type MonthlyClosingPendingCloseExceptionDto = {
  reason: string;
  confirmedByAccountId: string;
  confirmedAt: string;
  /** 다시 계산해 확인을 통과한 마감 확인 대상 콜과 "그 당시" 상태. */
  calls: MonthlyClosingChecklistCallDto[];
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
  financials: MonthlyClosingPreviewDto["financials"];
  dashboardFinancials?: MonthlyClosingPreviewDto["dashboardFinancials"];
  graphReport?: MonthlyClosingPreviewDto["graphReport"];
  totals: MonthlyClosingPreviewDto["totals"];
  warningCounts: MonthlyClosingPreviewDto["warningCounts"];
  evidence: MonthlyClosingPreviewDto["evidence"];
  pendingCloseException?: MonthlyClosingPendingCloseExceptionDto | null;
  source: {
    serviceVersion: "monthly-closing-service:5.3";
    previewBasis: "listMonthlyClosingPreview";
    snapshotCreatedAt: string;
  };
};

export type MonthlyClosingDto = {
  id: string;
  operatingMonthId: string;
  closeVersion: number;
  status: "마감확정";
  confirmedByAccountId: string;
  confirmedAt: string;
  reopenedAt: string | null;
  reopenedByAccountId: string | null;
  reopenReason: string | null;
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
  listMonthlyClosingChecklist: typeof listMonthlyClosingChecklist;
};

export type StartMonthlyCloseReviewInput = {
  operatingMonthId: string;
  actorId: string;
  prismaClient?: MonthlyClosingPrismaClient;
};

export type ConfirmMonthlyCloseInput = {
  operatingMonthId: string;
  actorId: string;
  /** F07/ADR 0005(티켓 34): 확인한 마감 확인 대상 콜(예약·사용중·청소중) id 목록. 생략하면 빈 목록. */
  confirmedPendingCloseCallIds?: string[];
  /** 목록이 비어 있지 않을 때만 필수. 빈 문자열이면 트랜잭션 안에서 거절한다. */
  exceptionReason?: string;
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

export type ReopenMonthlyCloseInput = {
  operatingMonthId: string;
  actorId: string;
  reason: string;
  prismaClient?: MonthlyClosingPrismaClient;
  clock?: () => Date;
};

export type GetMonthlyClosingSnapshotInput = {
  operatingMonthId: string;
  prismaClient?: MonthlyClosingPrismaClient;
};

/** 마감 버전 하나의 메타(스냅샷 본문은 빼고, 버전 고르는 화면·명세서 버전 목록용, 티켓 32). */
export type MonthlyClosingVersionSummaryDto = {
  id: string;
  closeVersion: number;
  confirmedByAccountId: string;
  confirmedAt: string;
  reopenedAt: string | null;
  reopenedByAccountId: string | null;
  reopenReason: string | null;
};

export type ListMonthlyClosingVersionsInput = {
  operatingMonthId: string;
  prismaClient?: MonthlyClosingPrismaClient;
};

export type GetMonthlyClosingSnapshotByVersionInput = {
  operatingMonthId: string;
  closeVersion: number;
  prismaClient?: MonthlyClosingPrismaClient;
};

export class MonthlyClosingDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "MonthlyClosingDomainError";
  }
}

/**
 * F07/ADR 0005(티켓 34): 확인한 목록을 받은 뒤 트랜잭션 안에서 마감 확인 대상 콜을 다시 계산했더니
 * 목록에 없던 콜이 새로 있으면 확정을 거절한다. 액션 경계가 지금의 목록을 그대로 화면에 보여 줄 수
 * 있도록 그 목록을 들고 있는다(StaleServiceCallError의 currentRow와 같은 모양).
 */
export class MonthlyClosePendingCallsChangedError extends MonthlyClosingDomainError {
  constructor(public readonly currentPendingCloseCalls: MonthlyClosingChecklistCallDto[]) {
    super(
      "확인한 목록 이후 새로운 마감 확인 대상 콜이 생겨 마감 확정할 수 없습니다. 새로 보이는 목록을 다시 확인하세요.",
      "MONTHLY_CLOSE_PENDING_CALLS_CHANGED"
    );
    this.name = "MonthlyClosePendingCallsChangedError";
  }
}

const monthlyClosingInputSchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요."),
  actorId: z.string().trim().min(1, "처리자 계정을 확인할 수 없습니다.")
});

const reopenMonthlyClosingInputSchema = monthlyClosingInputSchema.extend({
  reason: z.string().trim().min(5, "재오픈 사유를 5자 이상 입력하세요.")
});

// F07/ADR 0005(티켓 34): 사유 유무는 트랜잭션 안에서 다시 계산한 마감 확인 대상 콜이 있는지에 따라
// 달라지므로(목록이 비어 있으면 사유 불필요), 여기서는 모양만 확인하고 필수 여부는 confirmMonthlyClose가 검사한다.
const confirmMonthlyClosingInputSchema = monthlyClosingInputSchema.extend({
  confirmedPendingCloseCallIds: z.array(z.string().trim().min(1)).default([]),
  exceptionReason: z.string().trim().max(500, "사유는 500자 이하로 입력하세요.").default("")
});

const snapshotQuerySchema = z.object({
  operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.")
});

const versionSnapshotQuerySchema = snapshotQuerySchema.extend({
  closeVersion: z.number().int().min(1, "마감 버전을 선택하세요.")
});

const defaultDependencies: MonthlyClosingDependencies = {
  listMonthlyClosingPreview,
  listMonthlyClosingChecklist
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

// 재오픈은 마감확정과 잠금 두 상태 모두에서 할 수 있다(F07/V11). 둘 다 검토중으로 되돌아간다.
function isReopenableOperatingMonthStatus(status: string): status is "마감확정" | "잠금" {
  return status === "마감확정" || status === "잠금";
}

async function findLatestMonthlyClosing(client: MonthlyClosingPrismaClient, operatingMonthId: string) {
  return client.monthlyClosing.findFirst({
    where: { operatingMonthId },
    orderBy: { closeVersion: "desc" }
  });
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
  pendingCloseException: MonthlyClosingPendingCloseExceptionDto | null;
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
    financials: input.preview.financials,
    pendingCloseException: input.pendingCloseException,
    dashboardFinancials: input.preview.dashboardFinancials,
    graphReport: input.preview.graphReport,
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
    closeVersion: record.closeVersion,
    status: "마감확정",
    confirmedByAccountId: record.confirmedByAccountId,
    confirmedAt: record.confirmedAt.toISOString(),
    reopenedAt: record.reopenedAt ? record.reopenedAt.toISOString() : null,
    reopenedByAccountId: record.reopenedByAccountId ?? null,
    reopenReason: record.reopenReason ?? null,
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
  const parsed = confirmMonthlyClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 확정 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  const dependencies = { ...defaultDependencies, ...input.dependencies };
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

      // 마감 전 점검(F07, 티켓 33)을 확정 트랜잭션 안에서 다시 계산한다. 계산 오류나 지급 재확인 미처리가
      // 남아 있으면 확정을 거절한다.
      const checklist = await dependencies.listMonthlyClosingChecklist({
        operatingMonthId: parsed.data.operatingMonthId,
        prismaClient: tx as any
      });
      if (checklist.calculationErrorCalls.length > 0) {
        throw new MonthlyClosingDomainError(
          "계산 오류가 있는 콜이 남아 있어 마감 확정할 수 없습니다.",
          "MONTHLY_CLOSE_CALCULATION_ERRORS_PENDING"
        );
      }
      if (checklist.payoutReconfirmationUnits.length > 0) {
        throw new MonthlyClosingDomainError(
          "지급 재확인이 필요한 항목이 남아 있어 마감 확정할 수 없습니다.",
          "MONTHLY_CLOSE_PAYOUT_RECONFIRMATION_PENDING"
        );
      }

      // F07/ADR 0005(티켓 34): 예약·사용중·청소중 콜(마감 확인 대상)이 남아 있으면 사유 없이는 확정할 수
      // 없고, 확인한 목록이 지금 다시 계산한 목록을 모두 덮어야 한다. 콜 상태는 바꾸지 않는다.
      let pendingCloseException: MonthlyClosingPendingCloseExceptionDto | null = null;
      if (checklist.pendingCloseCalls.length > 0) {
        const exceptionReason = parsed.data.exceptionReason.trim();
        if (exceptionReason === "") {
          throw new MonthlyClosingDomainError("예외 사유를 입력하세요.", "MONTHLY_CLOSE_PENDING_CLOSE_REASON_REQUIRED");
        }

        const confirmedIds = new Set(parsed.data.confirmedPendingCloseCallIds);
        const hasUnconfirmedCall = checklist.pendingCloseCalls.some((call) => !confirmedIds.has(call.serviceCallId));
        if (hasUnconfirmedCall) {
          throw new MonthlyClosePendingCallsChangedError(checklist.pendingCloseCalls);
        }

        pendingCloseException = {
          reason: exceptionReason,
          confirmedByAccountId: parsed.data.actorId,
          confirmedAt,
          calls: checklist.pendingCloseCalls
        };
      }

      const latestClosing = await findLatestMonthlyClosing(tx, current.id);
      const closeVersion = (latestClosing?.closeVersion ?? 0) + 1;

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
          confirmedByAccountId: parsed.data.actorId,
          pendingCloseException
        })
      );
      const closing = await tx.monthlyClosing.create({
        data: {
          id: snapshotId,
          operatingMonthId: current.id,
          closeVersion,
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
            closeVersion,
            confirmedAt,
            pendingCloseExceptionCallCount: pendingCloseException?.calls.length ?? 0
          }
        },
        { prismaClient: tx as any }
      );

      return toDto({ ...closing, snapshotJson: snapshot }, snapshot);
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new MonthlyClosingDomainError("동일한 월마감 버전이 이미 생성되었습니다. 다시 시도해 주세요.", "MONTHLY_CLOSE_VERSION_CONFLICT");
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

    const closing = await findLatestMonthlyClosing(tx, current.id);
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
          snapshotId: closing.id,
          closeVersion: closing.closeVersion
        },
        afterValue: {
          operatingMonthId: updated.id,
          monthKey: updated.monthKey,
          status: updated.status,
          snapshotId: closing.id,
          closeVersion: closing.closeVersion,
          lockedAt,
          lockedByAccountId: parsed.data.actorId
        }
      },
      { prismaClient: tx as any }
    );

    return toReviewDto(updated);
  });
}

export async function reopenMonthlyClose(input: ReopenMonthlyCloseInput): Promise<MonthlyCloseReviewDto> {
  const parsed = reopenMonthlyClosingInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code = issue?.path[0] === "reason" ? "INVALID_MONTHLY_CLOSE_REOPEN_REASON" : "INVALID_MONTHLY_CLOSE_INPUT";
    throw new MonthlyClosingDomainError(issue?.message ?? "월마감 재오픈 입력값이 올바르지 않습니다.", code);
  }

  const client = getClient(input.prismaClient);
  const now = input.clock?.() ?? new Date();
  const reopenedAt = now.toISOString();

  return runInTransaction(client, async (tx) => {
    const current = await tx.operatingMonth.findUnique({
      where: { id: parsed.data.operatingMonthId }
    });
    if (!current) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }
    if (!isReopenableOperatingMonthStatus(current.status)) {
      throw new MonthlyClosingDomainError("현재 상태에서는 재오픈할 수 없습니다.", "INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION");
    }

    const closing = await findLatestMonthlyClosing(tx, current.id);
    if (!closing) {
      throw new MonthlyClosingDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
    }

    // 마감확정과 잠금 둘 다에서 재오픈할 수 있으므로, 방금 읽은 상태 그대로 조건부 갱신해
    // 그 사이 상태가 바뀌었으면 거절한다(낙관적 동시성).
    const updateResult = await tx.operatingMonth.updateMany({
      where: { id: current.id, status: current.status },
      data: { status: "검토중" }
    });
    if (updateResult.count !== 1) {
      throw new MonthlyClosingDomainError("현재 상태에서는 재오픈할 수 없습니다.", "INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION");
    }

    const updatedClosing = await tx.monthlyClosing.update({
      where: { id: closing.id },
      data: {
        reopenedAt: now,
        reopenedByAccountId: parsed.data.actorId,
        reopenReason: parsed.data.reason
      }
    });

    const updated = await tx.operatingMonth.findUnique({
      where: { id: current.id }
    });
    if (!updated) {
      throw new MonthlyClosingDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
    }

    await recordAuditEvent(
      {
        actorId: parsed.data.actorId,
        action: "monthly_close.reopened",
        targetType: "monthly_close",
        targetId: closing.id,
        beforeValue: {
          operatingMonthId: current.id,
          monthKey: current.monthKey,
          status: current.status,
          snapshotId: closing.id,
          closeVersion: closing.closeVersion
        },
        afterValue: {
          operatingMonthId: updated.id,
          monthKey: updated.monthKey,
          status: updated.status,
          reason: parsed.data.reason,
          reopenedAt,
          reopenedByAccountId: parsed.data.actorId,
          snapshotId: updatedClosing.id,
          closeVersion: updatedClosing.closeVersion
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

  const record = await findLatestMonthlyClosing(getClient(input.prismaClient), parsed.data.operatingMonthId);

  if (!record) {
    throw new MonthlyClosingDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
  }

  assertSnapshotJson(record.snapshotJson);
  return toDto(record, record.snapshotJson);
}

function toVersionSummaryDto(record: MonthlyClosingRecord): MonthlyClosingVersionSummaryDto {
  return {
    id: record.id,
    closeVersion: record.closeVersion,
    confirmedByAccountId: record.confirmedByAccountId,
    confirmedAt: record.confirmedAt.toISOString(),
    reopenedAt: record.reopenedAt ? record.reopenedAt.toISOString() : null,
    reopenedByAccountId: record.reopenedByAccountId ?? null,
    reopenReason: record.reopenReason ?? null
  };
}

/**
 * 이 운영월의 모든 마감 버전을 최신순으로 돌려준다(스냅샷 본문은 빼고 메타만, 티켓 32 월 명세서의 버전 고르기용).
 * 재오픈과 재확정을 거쳐도 지난 버전은 이 목록에 그대로 남는다(스냅샷은 지우거나 고치지 않는다).
 */
export async function listMonthlyClosingVersions(input: ListMonthlyClosingVersionsInput): Promise<MonthlyClosingVersionSummaryDto[]> {
  const parsed = snapshotQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 버전 조회 조건이 올바르지 않습니다.");
  }

  const records = await getClient(input.prismaClient).monthlyClosing.findMany({
    where: { operatingMonthId: parsed.data.operatingMonthId },
    orderBy: { closeVersion: "desc" }
  });
  return records.map(toVersionSummaryDto);
}

/**
 * 고른 마감 버전 하나의 스냅샷을 그대로 돌려준다(최신이 아니어도 된다). 월 명세서(티켓 32)가 "이전 마감 버전도
 * 골라서 본다"를 구현하는 자리다. 스냅샷은 확정 당시 그대로이며 다시 계산하지 않는다.
 */
export async function getMonthlyClosingSnapshotByVersion(input: GetMonthlyClosingSnapshotByVersionInput): Promise<MonthlyClosingDto> {
  const parsed = versionSnapshotQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "월마감 스냅샷 조회 조건이 올바르지 않습니다.");
  }

  const record = await getClient(input.prismaClient).monthlyClosing.findFirst({
    where: { operatingMonthId: parsed.data.operatingMonthId, closeVersion: parsed.data.closeVersion }
  });

  if (!record) {
    throw new MonthlyClosingDomainError("확정 스냅샷을 찾을 수 없습니다.", "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND");
  }

  assertSnapshotJson(record.snapshotJson);
  return toDto(record, record.snapshotJson);
}
