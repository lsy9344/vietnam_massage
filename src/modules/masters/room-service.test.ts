import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  RoomDomainError,
  deactivateRoom,
  ensureDefaultRooms,
  listActiveRooms,
  listRooms,
  updateRoomDisplayName,
  updateRoomSortOrder
} from "@/modules/masters/room-service";

function createMemoryPrisma() {
  const rooms = new Map<string, any>();
  const auditEvents: any[] = [];

  function sortRecords(records: any[]) {
    return records.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
  }

  const client: any = {
    room: {
      async create({ data }: any) {
        if ([...rooms.values()].some((room) => room.sortOrder === data.sortOrder)) {
          const error = new Error("Unique constraint failed");
          (error as any).code = "P2002";
          throw error;
        }
        const record = {
          id: `room-${data.sortOrder}`,
          displayName: data.displayName,
          migrationReferenceName: data.migrationReferenceName,
          sortOrder: data.sortOrder,
          isActive: data.isActive ?? true,
          createdAt: new Date(`2026-06-08T00:${String(rooms.size).padStart(2, "0")}:00.000Z`),
          updatedAt: new Date(`2026-06-08T00:${String(rooms.size).padStart(2, "0")}:00.000Z`)
        };
        rooms.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        const values = [...rooms.values()].filter((room) =>
          typeof where?.isActive === "boolean" ? room.isActive === where.isActive : true
        );
        return sortRecords(values);
      },
      async findUnique({ where }: any) {
        return rooms.get(where.id) ?? null;
      },
      async findFirst({ where }: any) {
        return (
          [...rooms.values()].find((room) => {
            const notId = where.NOT?.id;
            return room.sortOrder === where.sortOrder && (!notId || room.id !== notId);
          }) ?? null
        );
      },
      async updateMany({ where, data }: any) {
        const record = rooms.get(where.id);
        if (!record) {
          return { count: 0 };
        }
        const updated = {
          ...record,
          ...data,
          updatedAt: new Date("2026-06-09T00:00:00.000Z")
        };
        rooms.set(where.id, updated);
        return { count: 1 };
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = {
          id: `audit-${auditEvents.length + 1}`,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
          ...data
        };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    auditEvents,
    rooms
  };

  return client;
}

describe("room service", () => {
  it("seeds the default 11 rooms with separate migration references and room.created audit events", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await ensureDefaultRooms({ actorId: "admin-1", prismaClient });
    const rooms = await listRooms({ prismaClient });

    assert.equal(created.length, 11);
    assert.deepEqual(
      rooms.map((room) => room.displayName),
      ["101 호실", "102 호실", "103 호실", "201 호실", "202 호실", "203 호실", "301 호실", "302 호실", "303 호실", "401 호실", "402 호실"]
    );
    assert.deepEqual(
      rooms.map((room) => room.migrationReferenceName),
      ["1번방", "2번방", "3번방", "4번방", "5번방", "6번방", "7번방", "8번방", "9번방", "10번방", "11번방"]
    );
    assert.equal(rooms[0].isActive, true);
    assert.equal(prismaClient.auditEvents.length, 11);
    assert.equal(prismaClient.auditEvents[0].action, "room.created");
    assert.equal(prismaClient.auditEvents[0].targetType, "room");
  });

  it("is idempotent and does not create duplicate rooms or duplicate audit events on re-run", async () => {
    const prismaClient = createMemoryPrisma();

    await ensureDefaultRooms({ actorId: "admin-1", prismaClient });
    const secondRun = await ensureDefaultRooms({ actorId: "admin-1", prismaClient });

    assert.equal(secondRun.length, 0);
    assert.equal((await listRooms({ prismaClient })).length, 11);
    assert.equal(prismaClient.auditEvents.length, 11);
  });

  it("updates a display name and preserves its stable id and migration reference", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultRooms({ actorId: "admin-1", prismaClient });
    const before = (await listRooms({ prismaClient }))[0];

    const updated = await updateRoomDisplayName({
      actorId: "admin-1",
      roomId: before.id,
      displayName: "101 VIP 호실",
      prismaClient
    });

    assert.equal(updated.id, before.id);
    assert.equal(updated.displayName, "101 VIP 호실");
    assert.equal(updated.migrationReferenceName, "1번방");
    assert.equal(prismaClient.auditEvents.at(-1).action, "room.display_name_changed");
    assert.equal(prismaClient.auditEvents.at(-1).beforeValue.id, before.id);
    assert.equal(prismaClient.auditEvents.at(-1).afterValue.displayName, "101 VIP 호실");
  });

  it("updates sort order and rejects duplicate order values with a safe Korean error", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultRooms({ actorId: "admin-1", prismaClient });
    const [first, second] = await listRooms({ prismaClient });

    const updated = await updateRoomSortOrder({
      actorId: "admin-1",
      roomId: first.id,
      sortOrder: 15,
      prismaClient
    });
    assert.equal(updated.sortOrder, 15);
    assert.equal(updated.id, first.id);
    assert.equal(prismaClient.auditEvents.at(-1).action, "room.sort_order_changed");

    await assert.rejects(
      () =>
        updateRoomSortOrder({
          actorId: "admin-1",
          roomId: first.id,
          sortOrder: second.sortOrder,
          prismaClient
        }),
      (error) => error instanceof RoomDomainError && error.message === "정렬 순서가 이미 사용 중입니다."
    );
  });

  it("deactivates rooms without physical deletion and records room.deactivated", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultRooms({ actorId: "admin-1", prismaClient });
    const target = (await listRooms({ prismaClient }))[0];

    const updated = await deactivateRoom({ actorId: "admin-1", roomId: target.id, prismaClient });

    assert.equal(updated.id, target.id);
    assert.equal(updated.isActive, false);
    assert.equal((await listRooms({ prismaClient })).length, 11);
    assert.equal((await listActiveRooms({ prismaClient })).length, 10);
    assert.equal(prismaClient.auditEvents.at(-1).action, "room.deactivated");
    assert.equal(prismaClient.auditEvents.at(-1).beforeValue.isActive, true);
    assert.equal(prismaClient.auditEvents.at(-1).afterValue.isActive, false);
  });
});
