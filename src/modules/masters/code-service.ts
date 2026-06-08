import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  createCodeItemSchema,
  createTimeSlotSchema,
  deactivateCodeItemSchema,
  deactivateTimeSlotSchema,
  defaultCodeItems,
  defaultTimeSlots,
  updateCodeItemDisplayNameSchema,
  updateCodeItemSortOrderSchema,
  updateTimeSlotSortOrderSchema,
  updateTimeSlotValueSchema,
  type CodeType
} from "@/modules/masters/code-schema";

type CodeItemRecord = {
  id: string;
  codeType: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isSystemDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type TimeSlotRecord = {
  id: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CodePrismaClient = {
  codeItem: {
    create(args: unknown): Promise<CodeItemRecord>;
    findMany(args?: unknown): Promise<CodeItemRecord[]>;
    findUnique(args: unknown): Promise<CodeItemRecord | null>;
    findFirst(args: unknown): Promise<CodeItemRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  timeSlot: {
    create(args: unknown): Promise<TimeSlotRecord>;
    findMany(args?: unknown): Promise<TimeSlotRecord[]>;
    findUnique(args: unknown): Promise<TimeSlotRecord | null>;
    findFirst(args: unknown): Promise<TimeSlotRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: CodePrismaClient) => Promise<T>): Promise<T>;
};

export type CodeItemDto = {
  id: string;
  codeType: CodeType;
  code: string;
  displayName: string;
  sortOrder: number;
  isSystemDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TimeSlotDto = {
  id: string;
  value: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type CodeMutationBase = {
  actorId: string;
  prismaClient?: CodePrismaClient;
};

export type CreateCodeItemInput = CodeMutationBase & {
  codeType: CodeType;
  code: string;
  displayName: string;
  sortOrder: number;
};

export type CodeItemMutationInput = CodeMutationBase & {
  codeItemId: string;
};

export type UpdateCodeItemDisplayNameInput = CodeItemMutationInput & {
  displayName: string;
};

export type UpdateCodeItemSortOrderInput = CodeItemMutationInput & {
  sortOrder: number;
};

export type CreateTimeSlotInput = CodeMutationBase & {
  value: string;
  sortOrder: number;
};

export type TimeSlotMutationInput = CodeMutationBase & {
  timeSlotId: string;
};

export type UpdateTimeSlotValueInput = TimeSlotMutationInput & {
  value: string;
};

export type UpdateTimeSlotSortOrderInput = TimeSlotMutationInput & {
  sortOrder: number;
};

export class CodeDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CodeDomainError";
  }
}

function getClient(client?: CodePrismaClient) {
  return client ?? (prisma as unknown as CodePrismaClient);
}

async function runInTransaction<T>(client: CodePrismaClient, callback: (tx: CodePrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function normalizeParseError(message: string) {
  return new CodeDomainError(message, "INVALID_CODE_INPUT");
}

function assertCodeType(value: string): asserts value is CodeType {
  if (!["SERVICE_STATUS", "PAYMENT_METHOD", "DISCOUNT_TYPE", "ATTENDANCE_STATUS", "CONFIRMATION"].includes(value)) {
    throw new CodeDomainError("코드 유형이 올바르지 않습니다.", "INVALID_CODE_TYPE");
  }
}

function toCodeDto(record: CodeItemRecord): CodeItemDto {
  assertCodeType(record.codeType);
  return {
    id: record.id,
    codeType: record.codeType,
    code: record.code,
    displayName: record.displayName,
    sortOrder: record.sortOrder,
    isSystemDefault: record.isSystemDefault,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toTimeSlotDto(record: TimeSlotRecord): TimeSlotDto {
  return {
    id: record.id,
    value: record.value,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toCodeAuditSnapshot(dto: CodeItemDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    codeType: dto.codeType,
    code: dto.code,
    displayName: dto.displayName,
    sortOrder: dto.sortOrder,
    isSystemDefault: dto.isSystemDefault,
    isActive: dto.isActive
  };
}

function toTimeSlotAuditSnapshot(dto: TimeSlotDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    value: dto.value,
    sortOrder: dto.sortOrder,
    isActive: dto.isActive
  };
}

async function findCodeItemOrThrow(tx: CodePrismaClient, codeItemId: string) {
  const record = await tx.codeItem.findUnique({ where: { id: codeItemId } });
  if (!record) {
    throw new CodeDomainError("코드 항목을 찾을 수 없습니다.", "CODE_ITEM_NOT_FOUND");
  }
  return record;
}

async function findTimeSlotOrThrow(tx: CodePrismaClient, timeSlotId: string) {
  const record = await tx.timeSlot.findUnique({ where: { id: timeSlotId } });
  if (!record) {
    throw new CodeDomainError("시간 슬롯을 찾을 수 없습니다.", "TIME_SLOT_NOT_FOUND");
  }
  return record;
}

async function assertNoCodeConflict(tx: CodePrismaClient, input: { codeType: CodeType; code?: string; sortOrder?: number; excludeId?: string }) {
  if (input.code) {
    const conflict = await tx.codeItem.findFirst({
      where: { codeType: input.codeType, code: input.code, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }
    });
    if (conflict) {
      throw new CodeDomainError("같은 코드 유형에 이미 존재하는 코드입니다.", "DUPLICATE_CODE");
    }
  }

  if (typeof input.sortOrder === "number") {
    const conflict = await tx.codeItem.findFirst({
      where: { codeType: input.codeType, sortOrder: input.sortOrder, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }
    });
    if (conflict) {
      throw new CodeDomainError("같은 코드 유형에서 정렬 순서가 이미 사용 중입니다.", "DUPLICATE_CODE_SORT_ORDER");
    }
  }
}

async function assertNoTimeSlotConflict(tx: CodePrismaClient, input: { value?: string; sortOrder?: number; excludeId?: string }) {
  if (input.value) {
    const conflict = await tx.timeSlot.findFirst({
      where: { value: input.value, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }
    });
    if (conflict) {
      throw new CodeDomainError("이미 존재하는 시간 슬롯입니다.", "DUPLICATE_TIME_SLOT");
    }
  }

  if (typeof input.sortOrder === "number") {
    const conflict = await tx.timeSlot.findFirst({
      where: { sortOrder: input.sortOrder, ...(input.excludeId ? { NOT: { id: input.excludeId } } : {}) }
    });
    if (conflict) {
      throw new CodeDomainError("시간 슬롯 정렬 순서가 이미 사용 중입니다.", "DUPLICATE_TIME_SLOT_SORT_ORDER");
    }
  }
}

async function recordCodeAudit(
  tx: CodePrismaClient,
  input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeValue: AuditJsonSnapshot | null;
    afterValue: AuditJsonSnapshot | null;
  }
) {
  await recordAuditEvent(
    {
      actorId: input.actorId,
      action: input.action,
      targetType: "code_item",
      targetId: input.targetId,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue
    },
    { prismaClient: tx as any }
  );
}

async function recordTimeSlotAudit(
  tx: CodePrismaClient,
  input: {
    actorId: string;
    action: string;
    targetId: string;
    beforeValue: AuditJsonSnapshot | null;
    afterValue: AuditJsonSnapshot | null;
  }
) {
  await recordAuditEvent(
    {
      actorId: input.actorId,
      action: input.action,
      targetType: "time_slot",
      targetId: input.targetId,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue
    },
    { prismaClient: tx as any }
  );
}

export async function ensureDefaultCodeItems(input: { actorId: string; prismaClient?: CodePrismaClient }) {
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const created: CodeItemDto[] = [];

    for (const item of defaultCodeItems) {
      const existing = await tx.codeItem.findUnique({ where: { codeType_code: { codeType: item.codeType, code: item.code } } });
      if (existing) {
        continue;
      }

      const record = await tx.codeItem.create({
        data: {
          codeType: item.codeType,
          code: item.code,
          displayName: item.displayName,
          sortOrder: item.sortOrder,
          isSystemDefault: true,
          isActive: true
        }
      });
      const dto = toCodeDto(record);
      created.push(dto);

      await recordCodeAudit(tx, {
        actorId: input.actorId,
        action: "code_item.created",
        targetId: dto.id,
        beforeValue: null,
        afterValue: toCodeAuditSnapshot(dto)
      });
    }

    return created;
  });
}

export async function ensureDefaultTimeSlots(input: { actorId: string; prismaClient?: CodePrismaClient }) {
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const existing = await tx.timeSlot.findMany();
    const existingValues = new Set(existing.map((slot) => slot.value));
    const shouldBackfillDefaults = existing.length < defaultTimeSlots.length;
    const created: TimeSlotDto[] = [];

    for (const slot of defaultTimeSlots) {
      if (existingValues.has(slot.value) || !shouldBackfillDefaults) {
        continue;
      }

      const record = await tx.timeSlot.create({
        data: {
          value: slot.value,
          sortOrder: slot.sortOrder,
          isActive: true
        }
      });
      const dto = toTimeSlotDto(record);
      created.push(dto);
      existingValues.add(dto.value);

      await recordTimeSlotAudit(tx, {
        actorId: input.actorId,
        action: "time_slot.created",
        targetId: dto.id,
        beforeValue: null,
        afterValue: toTimeSlotAuditSnapshot(dto)
      });
    }

    return created;
  });
}

export async function listCodeItems(options: { codeType: CodeType; prismaClient?: CodePrismaClient }) {
  const records = await getClient(options.prismaClient).codeItem.findMany({
    where: { codeType: options.codeType },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toCodeDto);
}

export async function listActiveCodeItems(options: { codeType: CodeType; prismaClient?: CodePrismaClient }) {
  const records = await getClient(options.prismaClient).codeItem.findMany({
    where: { codeType: options.codeType, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toCodeDto);
}

export async function listTimeSlots(options: { prismaClient?: CodePrismaClient } = {}) {
  const records = await getClient(options.prismaClient).timeSlot.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toTimeSlotDto);
}

export async function listActiveTimeSlots(options: { prismaClient?: CodePrismaClient } = {}) {
  const records = await getClient(options.prismaClient).timeSlot.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toTimeSlotDto);
}

export async function createCodeItem(input: CreateCodeItemInput) {
  const parsed = createCodeItemSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "코드 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    await assertNoCodeConflict(tx, {
      codeType: parsed.data.codeType,
      code: parsed.data.code,
      sortOrder: parsed.data.sortOrder
    });

    const record = await tx.codeItem.create({
      data: {
        codeType: parsed.data.codeType,
        code: parsed.data.code,
        displayName: parsed.data.displayName,
        sortOrder: parsed.data.sortOrder,
        isSystemDefault: false,
        isActive: true
      }
    });
    const dto = toCodeDto(record);

    await recordCodeAudit(tx, {
      actorId: input.actorId,
      action: "code_item.created",
      targetId: dto.id,
      beforeValue: null,
      afterValue: toCodeAuditSnapshot(dto)
    });

    return dto;
  });
}

export async function updateCodeItemDisplayName(input: UpdateCodeItemDisplayNameInput) {
  const parsed = updateCodeItemDisplayNameSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "코드 표시명 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const before = toCodeDto(currentRecord);
    if (before.displayName === parsed.data.displayName) {
      return before;
    }

    const updateResult = await tx.codeItem.updateMany({
      where: { id: parsed.data.codeItemId },
      data: { displayName: parsed.data.displayName }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("코드 항목을 찾을 수 없습니다.", "CODE_ITEM_NOT_FOUND");
    }

    const updatedRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const after = toCodeDto(updatedRecord);

    await recordCodeAudit(tx, {
      actorId: input.actorId,
      action: "code_item.display_name_changed",
      targetId: after.id,
      beforeValue: toCodeAuditSnapshot(before),
      afterValue: toCodeAuditSnapshot(after)
    });

    return after;
  });
}

export async function updateCodeItemSortOrder(input: UpdateCodeItemSortOrderInput) {
  const parsed = updateCodeItemSortOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "코드 정렬 순서 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const before = toCodeDto(currentRecord);
    if (before.sortOrder === parsed.data.sortOrder) {
      return before;
    }

    await assertNoCodeConflict(tx, {
      codeType: before.codeType,
      sortOrder: parsed.data.sortOrder,
      excludeId: parsed.data.codeItemId
    });

    const updateResult = await tx.codeItem.updateMany({
      where: { id: parsed.data.codeItemId },
      data: { sortOrder: parsed.data.sortOrder }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("코드 항목을 찾을 수 없습니다.", "CODE_ITEM_NOT_FOUND");
    }

    const updatedRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const after = toCodeDto(updatedRecord);

    await recordCodeAudit(tx, {
      actorId: input.actorId,
      action: "code_item.sort_order_changed",
      targetId: after.id,
      beforeValue: toCodeAuditSnapshot(before),
      afterValue: toCodeAuditSnapshot(after)
    });

    return after;
  });
}

export async function deactivateCodeItem(input: CodeItemMutationInput) {
  const parsed = deactivateCodeItemSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "코드 비활성 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const before = toCodeDto(currentRecord);
    if (!before.isActive) {
      return before;
    }

    const updateResult = await tx.codeItem.updateMany({
      where: { id: parsed.data.codeItemId },
      data: { isActive: false }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("코드 항목을 찾을 수 없습니다.", "CODE_ITEM_NOT_FOUND");
    }

    const updatedRecord = await findCodeItemOrThrow(tx, parsed.data.codeItemId);
    const after = toCodeDto(updatedRecord);

    await recordCodeAudit(tx, {
      actorId: input.actorId,
      action: "code_item.deactivated",
      targetId: after.id,
      beforeValue: toCodeAuditSnapshot(before),
      afterValue: toCodeAuditSnapshot(after)
    });

    return after;
  });
}

export async function createTimeSlot(input: CreateTimeSlotInput) {
  const parsed = createTimeSlotSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "시간 슬롯 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    await assertNoTimeSlotConflict(tx, { value: parsed.data.value, sortOrder: parsed.data.sortOrder });

    const record = await tx.timeSlot.create({
      data: {
        value: parsed.data.value,
        sortOrder: parsed.data.sortOrder,
        isActive: true
      }
    });
    const dto = toTimeSlotDto(record);

    await recordTimeSlotAudit(tx, {
      actorId: input.actorId,
      action: "time_slot.created",
      targetId: dto.id,
      beforeValue: null,
      afterValue: toTimeSlotAuditSnapshot(dto)
    });

    return dto;
  });
}

export async function updateTimeSlotValue(input: UpdateTimeSlotValueInput) {
  const parsed = updateTimeSlotValueSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "시간 슬롯 값 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const before = toTimeSlotDto(currentRecord);
    if (before.value === parsed.data.value) {
      return before;
    }

    await assertNoTimeSlotConflict(tx, { value: parsed.data.value, excludeId: parsed.data.timeSlotId });

    const updateResult = await tx.timeSlot.updateMany({
      where: { id: parsed.data.timeSlotId },
      data: { value: parsed.data.value }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("시간 슬롯을 찾을 수 없습니다.", "TIME_SLOT_NOT_FOUND");
    }

    const updatedRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const after = toTimeSlotDto(updatedRecord);

    await recordTimeSlotAudit(tx, {
      actorId: input.actorId,
      action: "time_slot.value_changed",
      targetId: after.id,
      beforeValue: toTimeSlotAuditSnapshot(before),
      afterValue: toTimeSlotAuditSnapshot(after)
    });

    return after;
  });
}

export async function updateTimeSlotSortOrder(input: UpdateTimeSlotSortOrderInput) {
  const parsed = updateTimeSlotSortOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "시간 슬롯 정렬 순서 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const before = toTimeSlotDto(currentRecord);
    if (before.sortOrder === parsed.data.sortOrder) {
      return before;
    }

    await assertNoTimeSlotConflict(tx, { sortOrder: parsed.data.sortOrder, excludeId: parsed.data.timeSlotId });

    const updateResult = await tx.timeSlot.updateMany({
      where: { id: parsed.data.timeSlotId },
      data: { sortOrder: parsed.data.sortOrder }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("시간 슬롯을 찾을 수 없습니다.", "TIME_SLOT_NOT_FOUND");
    }

    const updatedRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const after = toTimeSlotDto(updatedRecord);

    await recordTimeSlotAudit(tx, {
      actorId: input.actorId,
      action: "time_slot.sort_order_changed",
      targetId: after.id,
      beforeValue: toTimeSlotAuditSnapshot(before),
      afterValue: toTimeSlotAuditSnapshot(after)
    });

    return after;
  });
}

export async function deactivateTimeSlot(input: TimeSlotMutationInput) {
  const parsed = deactivateTimeSlotSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "시간 슬롯 비활성 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const before = toTimeSlotDto(currentRecord);
    if (!before.isActive) {
      return before;
    }

    const updateResult = await tx.timeSlot.updateMany({
      where: { id: parsed.data.timeSlotId },
      data: { isActive: false }
    });
    if (updateResult.count !== 1) {
      throw new CodeDomainError("시간 슬롯을 찾을 수 없습니다.", "TIME_SLOT_NOT_FOUND");
    }

    const updatedRecord = await findTimeSlotOrThrow(tx, parsed.data.timeSlotId);
    const after = toTimeSlotDto(updatedRecord);

    await recordTimeSlotAudit(tx, {
      actorId: input.actorId,
      action: "time_slot.deactivated",
      targetId: after.id,
      beforeValue: toTimeSlotAuditSnapshot(before),
      afterValue: toTimeSlotAuditSnapshot(after)
    });

    return after;
  });
}
