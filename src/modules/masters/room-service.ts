import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import {
  deactivateRoomSchema,
  defaultRooms,
  updateRoomDisplayNameSchema,
  updateRoomSortOrderSchema
} from "@/modules/masters/room-schema";

type RoomRecord = {
  id: string;
  displayName: string;
  migrationReferenceName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RoomPrismaClient = {
  room: {
    create(args: unknown): Promise<RoomRecord>;
    findMany(args?: unknown): Promise<RoomRecord[]>;
    findUnique(args: unknown): Promise<RoomRecord | null>;
    findFirst(args: unknown): Promise<RoomRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: RoomPrismaClient) => Promise<T>): Promise<T>;
};

export type RoomDto = {
  id: string;
  displayName: string;
  migrationReferenceName: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RoomMutationInput = {
  actorId: string;
  roomId: string;
  prismaClient?: RoomPrismaClient;
};

export type UpdateRoomDisplayNameInput = RoomMutationInput & {
  displayName: string;
};

export type UpdateRoomSortOrderInput = RoomMutationInput & {
  sortOrder: number;
};

export class RoomDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RoomDomainError";
  }
}

function getClient(client?: RoomPrismaClient) {
  return client ?? (prisma as unknown as RoomPrismaClient);
}

async function runInTransaction<T>(client: RoomPrismaClient, callback: (tx: RoomPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function normalizeParseError(message: string) {
  return new RoomDomainError(message, "INVALID_ROOM_INPUT");
}

function toDto(record: RoomRecord): RoomDto {
  return {
    id: record.id,
    displayName: record.displayName,
    migrationReferenceName: record.migrationReferenceName,
    sortOrder: record.sortOrder,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toAuditSnapshot(dto: RoomDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    displayName: dto.displayName,
    migrationReferenceName: dto.migrationReferenceName,
    sortOrder: dto.sortOrder,
    isActive: dto.isActive
  };
}

async function findRoomOrThrow(tx: RoomPrismaClient, roomId: string) {
  const record = await tx.room.findUnique({ where: { id: roomId } });
  if (!record) {
    throw new RoomDomainError("객실을 찾을 수 없습니다.", "ROOM_NOT_FOUND");
  }
  return record;
}

async function recordRoomAudit(
  tx: RoomPrismaClient,
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
      targetType: "room",
      targetId: input.targetId,
      beforeValue: input.beforeValue,
      afterValue: input.afterValue
    },
    { prismaClient: tx as any }
  );
}

export async function ensureDefaultRooms(input: { actorId: string; prismaClient?: RoomPrismaClient }) {
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const existing = await tx.room.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const existingReferences = new Set(existing.map((room) => room.migrationReferenceName));
    const created: RoomDto[] = [];

    for (const room of defaultRooms) {
      if (existingReferences.has(room.migrationReferenceName)) {
        continue;
      }

      const record = await tx.room.create({
        data: {
          displayName: room.displayName,
          migrationReferenceName: room.migrationReferenceName,
          sortOrder: room.sortOrder,
          isActive: true
        }
      });
      const dto = toDto(record);
      created.push(dto);
      existingReferences.add(room.migrationReferenceName);

      await recordRoomAudit(tx, {
        actorId: input.actorId,
        action: "room.created",
        targetId: dto.id,
        beforeValue: null,
        afterValue: toAuditSnapshot(dto)
      });
    }

    return created;
  });
}

export async function listRooms(options: { prismaClient?: RoomPrismaClient } = {}) {
  const records = await getClient(options.prismaClient).room.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toDto);
}

export async function listActiveRooms(options: { prismaClient?: RoomPrismaClient } = {}) {
  const records = await getClient(options.prismaClient).room.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }]
  });

  return records.map(toDto);
}

export async function updateRoomDisplayName(input: UpdateRoomDisplayNameInput) {
  const parsed = updateRoomDisplayNameSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "객실 표시명 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const before = toDto(currentRecord);

    const updateResult = await tx.room.updateMany({
      where: { id: parsed.data.roomId },
      data: { displayName: parsed.data.displayName }
    });
    if (updateResult.count !== 1) {
      throw new RoomDomainError("객실을 찾을 수 없습니다.", "ROOM_NOT_FOUND");
    }

    const updatedRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const after = toDto(updatedRecord);

    await recordRoomAudit(tx, {
      actorId: input.actorId,
      action: "room.display_name_changed",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}

export async function updateRoomSortOrder(input: UpdateRoomSortOrderInput) {
  const parsed = updateRoomSortOrderSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "객실 정렬 순서 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const before = toDto(currentRecord);
    const conflict = await tx.room.findFirst({
      where: { sortOrder: parsed.data.sortOrder, NOT: { id: parsed.data.roomId } }
    });
    if (conflict) {
      throw new RoomDomainError("정렬 순서가 이미 사용 중입니다.", "DUPLICATE_ROOM_SORT_ORDER");
    }

    const updateResult = await tx.room.updateMany({
      where: { id: parsed.data.roomId },
      data: { sortOrder: parsed.data.sortOrder }
    });
    if (updateResult.count !== 1) {
      throw new RoomDomainError("객실을 찾을 수 없습니다.", "ROOM_NOT_FOUND");
    }

    const updatedRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const after = toDto(updatedRecord);

    await recordRoomAudit(tx, {
      actorId: input.actorId,
      action: "room.sort_order_changed",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}

export async function deactivateRoom(input: RoomMutationInput) {
  const parsed = deactivateRoomSchema.safeParse(input);
  if (!parsed.success) {
    throw normalizeParseError(parsed.error.issues[0]?.message ?? "객실 비활성 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const before = toDto(currentRecord);

    const updateResult = await tx.room.updateMany({
      where: { id: parsed.data.roomId },
      data: { isActive: false }
    });
    if (updateResult.count !== 1) {
      throw new RoomDomainError("객실을 찾을 수 없습니다.", "ROOM_NOT_FOUND");
    }

    const updatedRecord = await findRoomOrThrow(tx, parsed.data.roomId);
    const after = toDto(updatedRecord);

    await recordRoomAudit(tx, {
      actorId: input.actorId,
      action: "room.deactivated",
      targetId: after.id,
      beforeValue: toAuditSnapshot(before),
      afterValue: toAuditSnapshot(after)
    });

    return after;
  });
}
