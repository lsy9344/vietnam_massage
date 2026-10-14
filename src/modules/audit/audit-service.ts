import { prisma } from "@/lib/prisma";
import {
  AuditDomainError,
  assertValidAuditAction,
  normalizeAuditText,
  type AuditJsonSnapshot,
  type AuditLogQuery,
  type RecordAuditEventInput
} from "@/modules/audit/audit-event";

type AuditPrismaClient = {
  auditLog: {
    create(args: unknown): Promise<AuditLogRecord>;
    findMany(args: unknown): Promise<AuditLogRecord[]>;
  };
};

type AuditLogRecord = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeValue: AuditJsonSnapshot | null;
  afterValue: AuditJsonSnapshot | null;
  reason: string | null;
  createdAt: Date;
};

export type AuditLogListItem = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  beforeValue: AuditJsonSnapshot | null;
  afterValue: AuditJsonSnapshot | null;
  beforeSummary: string;
  afterSummary: string;
  reason: string | null;
  createdAt: Date;
};

export type AuditLogListQuery = AuditLogQuery & {
  prismaClient?: AuditPrismaClient;
};

export type RecordAuditEventOptions = {
  prismaClient?: AuditPrismaClient;
};

function getAuditClient(client?: AuditPrismaClient) {
  return (client ?? (prisma as unknown as AuditPrismaClient)).auditLog;
}

function isPlainObject(value: object) {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertJsonSnapshot(value: unknown, fieldName: string, path = fieldName): asserts value is AuditJsonSnapshot {
  if (value === null) {
    return;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return;
  }

  if (typeof value === "number") {
    if (Number.isFinite(value)) {
      return;
    }

    throw new AuditDomainError(`감사 로그 ${fieldName} 값은 유효한 JSON number여야 합니다. (${path})`, "INVALID_AUDIT_JSON");
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertJsonSnapshot(entry, fieldName, `${path}[${index}]`));
    return;
  }

  if (typeof value === "object" && value !== null && isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertJsonSnapshot(entry, fieldName, `${path}.${key}`);
    }
    return;
  }

  throw new AuditDomainError(`감사 로그 ${fieldName} 값은 JSON으로 직렬화 가능한 값이어야 합니다. (${path})`, "INVALID_AUDIT_JSON");
}

function toNullableSnapshot(value: AuditJsonSnapshot | null | undefined, fieldName: string) {
  if (value === undefined) {
    return null;
  }

  assertJsonSnapshot(value, fieldName);
  return value;
}

function clampLimit(limit: number | undefined) {
  if (!limit) {
    return 100;
  }

  return Math.min(Math.max(limit, 1), 200);
}

function summarizePrimitive(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return null;
}

export function summarizeAuditValue(value: AuditJsonSnapshot | null) {
  const primitive = summarizePrimitive(value);
  if (primitive !== null) {
    return primitive;
  }

  if (Array.isArray(value)) {
    return `배열 ${value.length}개`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }

    const summary = entries
      .slice(0, 4)
      .map(([key, entryValue]) => {
        const entrySummary = summarizePrimitive(entryValue);
        return `${key}: ${entrySummary ?? "[object]"}`;
      })
      .join(", ");

    return entries.length > 4 ? `${summary}, ...` : summary;
  }

  return String(value);
}

function toListItem(record: AuditLogRecord): AuditLogListItem {
  return {
    id: record.id,
    actorId: record.actorId,
    action: record.action,
    targetType: record.targetType,
    targetId: record.targetId,
    beforeValue: record.beforeValue,
    afterValue: record.afterValue,
    beforeSummary: summarizeAuditValue(record.beforeValue),
    afterSummary: summarizeAuditValue(record.afterValue),
    reason: record.reason,
    createdAt: record.createdAt
  };
}

export async function recordAuditEvent(input: RecordAuditEventInput, options: RecordAuditEventOptions = {}) {
  const action = normalizeAuditText(input.action, "action");
  assertValidAuditAction(action);
  const beforeValue = toNullableSnapshot(input.beforeValue, "beforeValue");
  const afterValue = toNullableSnapshot(input.afterValue, "afterValue");

  const record = await getAuditClient(options.prismaClient).create({
    data: {
      actorId: normalizeAuditText(input.actorId, "actorId"),
      action,
      targetType: normalizeAuditText(input.targetType, "targetType"),
      targetId: normalizeAuditText(input.targetId, "targetId"),
      beforeValue,
      afterValue,
      reason: input.reason?.trim() || null
    }
  });

  return toListItem(record);
}

type AuditActorPrismaClient = {
  userAccount: {
    findMany(args: unknown): Promise<Array<{ id: string; accountId: string; employee: { displayName: string } | null }>>;
  };
};

export type AuditActor = { name: string; accountId: string };

/**
 * 감사 기록의 처리자 id를 사람이 읽을 이름으로 푼다. 화면 동작은 계정의 내부 id를, 이전 기록과 테스트 fixture는
 * 계정 ID를 남겨서 둘 다 찾는다. 계정이 없는 id는 결과에 넣지 않는다(화면은 기록된 id를 그대로 보인다).
 */
export async function listAuditActors(actorIds: string[], options: { prismaClient?: AuditActorPrismaClient } = {}) {
  const ids = [...new Set(actorIds)];
  const actors = new Map<string, AuditActor>();
  if (ids.length === 0) {
    return actors;
  }

  const client = options.prismaClient ?? (prisma as unknown as AuditActorPrismaClient);
  const accounts = await client.userAccount.findMany({
    where: { OR: [{ id: { in: ids } }, { accountId: { in: ids } }] },
    select: { id: true, accountId: true, employee: { select: { displayName: true } } }
  });
  for (const account of accounts) {
    const actor = { name: account.employee?.displayName ?? account.accountId, accountId: account.accountId };
    for (const key of [account.id, account.accountId]) {
      if (ids.includes(key)) actors.set(key, actor);
    }
  }

  return actors;
}

export async function listAuditLogs(query: AuditLogListQuery = {}) {
  const where: Record<string, unknown> = {};
  const targetType = query.targetType?.trim();
  if (targetType) {
    where.targetType = targetType;
  }
  if (query.from || query.to) {
    where.createdAt = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lt: query.to } : {})
    };
  }

  const records = await getAuditClient(query.prismaClient).findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: clampLimit(query.limit)
  });

  return records.map(toListItem);
}
