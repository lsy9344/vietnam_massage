import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CodeDomainError,
  createCodeItem,
  createTimeSlot,
  deactivateCodeItem,
  deactivateTimeSlot,
  ensureDefaultCodeItems,
  ensureDefaultTimeSlots,
  listActiveCodeItems,
  listActiveTimeSlots,
  listCodeItems,
  listTimeSlots,
  updateCodeItemDisplayName,
  updateCodeItemSortOrder,
  updateTimeSlotSortOrder,
  updateTimeSlotValue
} from "@/modules/masters/code-service";
import { defaultTimeSlots } from "@/modules/masters/code-schema";

function createMemoryPrisma() {
  const codeItems = new Map<string, any>();
  const timeSlots = new Map<string, any>();
  const auditEvents: any[] = [];

  function timestamp(offset: number) {
    return new Date(`2026-06-08T00:${String(offset).padStart(2, "0")}:00.000Z`);
  }

  function sortRecords(records: any[]) {
    return records.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
  }

  const client: any = {
    codeItem: {
      async create({ data }: any) {
        const record = {
          id: `code-${data.codeType}-${data.code}`,
          codeType: data.codeType,
          code: data.code,
          displayName: data.displayName,
          sortOrder: data.sortOrder,
          isSystemDefault: data.isSystemDefault ?? false,
          isActive: data.isActive ?? true,
          createdAt: timestamp(codeItems.size),
          updatedAt: timestamp(codeItems.size)
        };
        codeItems.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        const values = [...codeItems.values()].filter((item) => {
          if (where?.codeType && item.codeType !== where.codeType) return false;
          if (typeof where?.isActive === "boolean" && item.isActive !== where.isActive) return false;
          return true;
        });
        return sortRecords(values);
      },
      async findUnique({ where }: any) {
        if (where.id) return codeItems.get(where.id) ?? null;
        if (where.codeType_code) {
          return [...codeItems.values()].find(
            (item) => item.codeType === where.codeType_code.codeType && item.code === where.codeType_code.code
          ) ?? null;
        }
        return null;
      },
      async findFirst({ where }: any) {
        return (
          [...codeItems.values()].find((item) => {
            const notId = where.NOT?.id;
            const codeTypeMatches = where.codeType ? item.codeType === where.codeType : true;
            const codeMatches = where.code ? item.code === where.code : true;
            const sortMatches = typeof where.sortOrder === "number" ? item.sortOrder === where.sortOrder : true;
            return codeTypeMatches && codeMatches && sortMatches && (!notId || item.id !== notId);
          }) ?? null
        );
      },
      async updateMany({ where, data }: any) {
        const record = codeItems.get(where.id);
        if (!record) return { count: 0 };
        codeItems.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T00:00:00.000Z") });
        return { count: 1 };
      }
    },
    timeSlot: {
      async create({ data }: any) {
        const record = {
          id: `slot-${data.value}`,
          value: data.value,
          sortOrder: data.sortOrder,
          isActive: data.isActive ?? true,
          createdAt: timestamp(timeSlots.size),
          updatedAt: timestamp(timeSlots.size)
        };
        timeSlots.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        const values = [...timeSlots.values()].filter((slot) =>
          typeof where?.isActive === "boolean" ? slot.isActive === where.isActive : true
        );
        return sortRecords(values);
      },
      async findUnique({ where }: any) {
        if (where.id) return timeSlots.get(where.id) ?? null;
        if (where.value) return [...timeSlots.values()].find((slot) => slot.value === where.value) ?? null;
        return null;
      },
      async findFirst({ where }: any) {
        return (
          [...timeSlots.values()].find((slot) => {
            const notId = where.NOT?.id;
            const valueMatches = where.value ? slot.value === where.value : true;
            const sortMatches = typeof where.sortOrder === "number" ? slot.sortOrder === where.sortOrder : true;
            return valueMatches && sortMatches && (!notId || slot.id !== notId);
          }) ?? null
        );
      },
      async updateMany({ where, data }: any) {
        const record = timeSlots.get(where.id);
        if (!record) return { count: 0 };
        timeSlots.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T00:00:00.000Z") });
        return { count: 1 };
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt: timestamp(0), ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    auditEvents,
    codeItems,
    timeSlots
  };

  return client;
}

describe("code/time slot service", () => {
  it("seeds every required code group with Korean source values and idempotent audit events", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await ensureDefaultCodeItems({ actorId: "admin-1", prismaClient });
    const secondRun = await ensureDefaultCodeItems({ actorId: "admin-1", prismaClient });

    assert.equal(created.length, 20);
    assert.equal(secondRun.length, 0);
    assert.equal(prismaClient.auditEvents.length, 20);
    assert.deepEqual((await listCodeItems({ codeType: "SERVICE_STATUS", prismaClient })).map((item) => item.displayName), [
      "예약",
      "사용중",
      "청소중",
      "방문완료",
      "노쇼",
      "취소"
    ]);
    assert.deepEqual((await listCodeItems({ codeType: "PAYMENT_METHOD", prismaClient })).map((item) => item.displayName), [
      "현금",
      "카드",
      "계좌",
      "기타"
    ]);
    assert.deepEqual((await listCodeItems({ codeType: "DISCOUNT_TYPE", prismaClient })).map((item) => item.displayName), [
      "일주일내방문",
      "생일자",
      "후기작성"
    ]);
    assert.deepEqual((await listCodeItems({ codeType: "ATTENDANCE_STATUS", prismaClient })).map((item) => item.displayName), [
      "정상",
      "휴무",
      "지각",
      "조퇴",
      "결근"
    ]);
    assert.deepEqual((await listCodeItems({ codeType: "CONFIRMATION", prismaClient })).map((item) => item.displayName), ["Y", "N"]);
    assert.equal(prismaClient.auditEvents[0].action, "code_item.created");
    assert.equal(prismaClient.auditEvents[0].targetType, "code_item");
  });

  it("seeds exactly 29 time slots from 11:00 through 01:00 and excludes later workbook values", async () => {
    const prismaClient = createMemoryPrisma();

    await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const slots = await listTimeSlots({ prismaClient });

    assert.equal(slots.length, 29);
    assert.deepEqual(slots.map((slot) => slot.value), defaultTimeSlots.map((slot) => slot.value));
    assert.equal(slots[0].value, "11:00");
    assert.equal(slots.at(-1)?.value, "01:00");
    assert.equal(slots.some((slot) => ["01:30", "02:00", "02:30"].includes(slot.value)), false);
    assert.equal((await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient })).length, 0);
    assert.equal(prismaClient.auditEvents.length, 29);
  });

  it("does not recreate a default time slot after its value is edited by stable id", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const first = (await listTimeSlots({ prismaClient }))[0];

    const updated = await updateTimeSlotValue({
      actorId: "admin-1",
      timeSlotId: first.id,
      value: "10:30",
      prismaClient
    });
    const createdOnReseed = await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const slots = await listTimeSlots({ prismaClient });

    assert.equal(updated.id, first.id);
    assert.equal(createdOnReseed.length, 0);
    assert.equal(slots.length, 29);
    assert.equal(slots.some((slot) => slot.id !== first.id && slot.value === "11:00"), false);
    assert.equal(prismaClient.auditEvents.filter((event: any) => event.action === "time_slot.created").length, 29);
  });

  it("updates code display names and sort order by stable id, preserves code identity, and rejects duplicates", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultCodeItems({ actorId: "admin-1", prismaClient });
    const [first, second] = await listCodeItems({ codeType: "PAYMENT_METHOD", prismaClient });

    const renamed = await updateCodeItemDisplayName({
      actorId: "admin-1",
      codeItemId: first.id,
      displayName: "현금 결제",
      prismaClient
    });
    assert.equal(renamed.id, first.id);
    assert.equal(renamed.code, first.code);
    assert.equal(prismaClient.auditEvents.at(-1).action, "code_item.display_name_changed");

    const reordered = await updateCodeItemSortOrder({
      actorId: "admin-1",
      codeItemId: first.id,
      sortOrder: 15,
      prismaClient
    });
    assert.equal(reordered.id, first.id);
    assert.equal(reordered.sortOrder, 15);
    assert.equal(prismaClient.auditEvents.at(-1).action, "code_item.sort_order_changed");

    await assert.rejects(
      () => updateCodeItemSortOrder({ actorId: "admin-1", codeItemId: first.id, sortOrder: second.sortOrder, prismaClient }),
      (error) => error instanceof CodeDomainError && error.message === "같은 코드 유형에서 정렬 순서가 이미 사용 중입니다."
    );
    await assert.rejects(
      () =>
        createCodeItem({
          actorId: "admin-1",
          codeType: "PAYMENT_METHOD",
          code: second.code,
          displayName: "중복",
          sortOrder: 999,
          prismaClient
        }),
      (error) => error instanceof CodeDomainError && error.message === "같은 코드 유형에 이미 존재하는 코드입니다."
    );
  });

  it("updates time slot values/sort order by stable id and rejects duplicates", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const [first, second] = await listTimeSlots({ prismaClient });

    const updated = await updateTimeSlotValue({
      actorId: "admin-1",
      timeSlotId: first.id,
      value: "10:30",
      prismaClient
    });
    assert.equal(updated.id, first.id);
    assert.equal(updated.value, "10:30");
    assert.equal(prismaClient.auditEvents.at(-1).action, "time_slot.value_changed");

    const reordered = await updateTimeSlotSortOrder({
      actorId: "admin-1",
      timeSlotId: first.id,
      sortOrder: 15,
      prismaClient
    });
    assert.equal(reordered.id, first.id);
    assert.equal(reordered.sortOrder, 15);
    assert.equal(prismaClient.auditEvents.at(-1).action, "time_slot.sort_order_changed");

    await assert.rejects(
      () => updateTimeSlotValue({ actorId: "admin-1", timeSlotId: first.id, value: second.value, prismaClient }),
      (error) => error instanceof CodeDomainError && error.message === "이미 존재하는 시간 슬롯입니다."
    );
    await assert.rejects(
      () => updateTimeSlotSortOrder({ actorId: "admin-1", timeSlotId: first.id, sortOrder: second.sortOrder, prismaClient }),
      (error) => error instanceof CodeDomainError && error.message === "시간 슬롯 정렬 순서가 이미 사용 중입니다."
    );
  });

  it("deactivates code items and time slots without physical deletion and lists active values separately", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultCodeItems({ actorId: "admin-1", prismaClient });
    await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const targetCode = (await listCodeItems({ codeType: "CONFIRMATION", prismaClient }))[0];
    const targetSlot = (await listTimeSlots({ prismaClient }))[0];

    const deactivatedCode = await deactivateCodeItem({ actorId: "admin-1", codeItemId: targetCode.id, prismaClient });
    const deactivatedSlot = await deactivateTimeSlot({ actorId: "admin-1", timeSlotId: targetSlot.id, prismaClient });

    assert.equal(deactivatedCode.id, targetCode.id);
    assert.equal(deactivatedCode.isActive, false);
    assert.equal(deactivatedSlot.id, targetSlot.id);
    assert.equal(deactivatedSlot.isActive, false);
    assert.equal((await listCodeItems({ codeType: "CONFIRMATION", prismaClient })).length, 2);
    assert.equal((await listActiveCodeItems({ codeType: "CONFIRMATION", prismaClient })).length, 1);
    assert.equal((await listTimeSlots({ prismaClient })).length, 29);
    assert.equal((await listActiveTimeSlots({ prismaClient })).length, 28);
    assert.equal(prismaClient.auditEvents.at(-2).action, "code_item.deactivated");
    assert.equal(prismaClient.auditEvents.at(-1).action, "time_slot.deactivated");
  });

  it("does not create audit events for unchanged updates or repeated deactivation", async () => {
    const prismaClient = createMemoryPrisma();
    await ensureDefaultCodeItems({ actorId: "admin-1", prismaClient });
    await ensureDefaultTimeSlots({ actorId: "admin-1", prismaClient });
    const code = (await listCodeItems({ codeType: "CONFIRMATION", prismaClient }))[0];
    const slot = (await listTimeSlots({ prismaClient }))[0];
    const afterSeedAuditCount = prismaClient.auditEvents.length;

    await updateCodeItemDisplayName({ actorId: "admin-1", codeItemId: code.id, displayName: code.displayName, prismaClient });
    await updateCodeItemSortOrder({ actorId: "admin-1", codeItemId: code.id, sortOrder: code.sortOrder, prismaClient });
    await updateTimeSlotValue({ actorId: "admin-1", timeSlotId: slot.id, value: slot.value, prismaClient });
    await updateTimeSlotSortOrder({ actorId: "admin-1", timeSlotId: slot.id, sortOrder: slot.sortOrder, prismaClient });
    assert.equal(prismaClient.auditEvents.length, afterSeedAuditCount);

    await deactivateCodeItem({ actorId: "admin-1", codeItemId: code.id, prismaClient });
    await deactivateTimeSlot({ actorId: "admin-1", timeSlotId: slot.id, prismaClient });
    const afterFirstDeactivateAuditCount = prismaClient.auditEvents.length;

    await deactivateCodeItem({ actorId: "admin-1", codeItemId: code.id, prismaClient });
    await deactivateTimeSlot({ actorId: "admin-1", timeSlotId: slot.id, prismaClient });
    assert.equal(prismaClient.auditEvents.length, afterFirstDeactivateAuditCount);
  });

  it("creates custom code items and time slots with audit logs", async () => {
    const prismaClient = createMemoryPrisma();

    const code = await createCodeItem({
      actorId: "admin-1",
      codeType: "PAYMENT_METHOD",
      code: "VOUCHER",
      displayName: "상품권",
      sortOrder: 90,
      prismaClient
    });
    const slot = await createTimeSlot({ actorId: "admin-1", value: "10:00", sortOrder: 1, prismaClient });

    assert.equal(code.isSystemDefault, false);
    assert.equal(code.isActive, true);
    assert.equal(slot.value, "10:00");
    assert.deepEqual(
      prismaClient.auditEvents.map((event: any) => event.action),
      ["code_item.created", "time_slot.created"]
    );
  });
});
