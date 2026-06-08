import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OperatingMonthDomainError,
  calculateOperatingMonthRange,
  changeOperatingMonthStatus,
  createOperatingMonth,
  getOperatingMonthDateRange
} from "@/modules/masters/operating-month-service";

function createMemoryPrisma() {
  const months = new Map<string, any>();
  const auditEvents: any[] = [];

  const client: any = {
    operatingMonth: {
      async create({ data }: any) {
        if (months.has(data.monthKey)) {
          const error = new Error("Unique constraint failed");
          (error as any).code = "P2002";
          throw error;
        }
        const record = {
          id: `month-${data.monthKey}`,
          monthKey: data.monthKey,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status,
          createdAt: new Date("2026-06-08T00:00:00.000Z"),
          updatedAt: new Date("2026-06-08T00:00:00.000Z")
        };
        months.set(data.monthKey, record);
        return record;
      },
      async findMany() {
        return [...months.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      },
      async findUnique({ where }: any) {
        return months.get(where.monthKey) ?? null;
      },
      async update({ where, data }: any) {
        const record = months.get(where.monthKey);
        if (!record) {
          throw new Error("Record not found");
        }
        const updated = {
          ...record,
          ...data,
          updatedAt: new Date("2026-06-09T00:00:00.000Z")
        };
        months.set(where.monthKey, updated);
        return updated;
      },
      async updateMany({ where, data }: any) {
        const record = months.get(where.monthKey);
        if (!record || (where.status && record.status !== where.status)) {
          return { count: 0 };
        }
        const updated = {
          ...record,
          ...data,
          updatedAt: new Date("2026-06-09T00:00:00.000Z")
        };
        months.set(where.monthKey, updated);
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
    auditEvents
  };

  return client;
}

describe("operating month service", () => {
  it("calculates calendar start and end dates from YYYY-MM including leap years", () => {
    assert.deepEqual(calculateOperatingMonthRange("2026-06"), {
      monthKey: "2026-06",
      startDate: "2026-06-01",
      endDate: "2026-06-30"
    });
    assert.equal(calculateOperatingMonthRange("2028-02").endDate, "2028-02-29");
    assert.throws(() => calculateOperatingMonthRange("2026-13"), /YYYY-MM/);
  });

  it("creates 작성중 operating months and records operating_month.created audit events", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createOperatingMonth({
      actorId: "admin-1",
      monthKey: "2026-06",
      prismaClient
    });

    assert.equal(created.monthKey, "2026-06");
    assert.equal(created.startDate, "2026-06-01");
    assert.equal(created.endDate, "2026-06-30");
    assert.equal(created.status, "작성중");
    assert.equal(prismaClient.auditEvents[0].action, "operating_month.created");
    assert.equal(prismaClient.auditEvents[0].afterValue.status, "작성중");
  });

  it("rejects duplicate month keys with a safe Korean domain error", async () => {
    const prismaClient = createMemoryPrisma();
    await createOperatingMonth({ actorId: "admin-1", monthKey: "2026-06", prismaClient });

    await assert.rejects(
      () => createOperatingMonth({ actorId: "admin-1", monthKey: "2026-06", prismaClient }),
      (error) => error instanceof OperatingMonthDomainError && error.message === "이미 존재하는 운영월입니다."
    );
  });

  it("rejects explicit date ranges that do not match the YYYY-MM month key", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      () =>
        createOperatingMonth({
          actorId: "admin-1",
          monthKey: "2026-06",
          startDate: "2026-06-01",
          endDate: "2026-07-01",
          prismaClient
        }),
      (error) =>
        error instanceof OperatingMonthDomainError &&
        error.message === "운영월 날짜 범위가 YYYY-MM과 일치하지 않습니다."
    );
  });

  it("changes 작성중 to 검토중 and records operating_month.status_changed", async () => {
    const prismaClient = createMemoryPrisma();
    await createOperatingMonth({ actorId: "admin-1", monthKey: "2026-06", prismaClient });
    const changed = await changeOperatingMonthStatus({
      actorId: "admin-1",
      monthKey: "2026-06",
      status: "검토중",
      prismaClient
    });

    assert.equal(changed.status, "검토중");
    assert.equal(prismaClient.auditEvents[1].action, "operating_month.status_changed");
    assert.equal(prismaClient.auditEvents[1].beforeValue.status, "작성중");
    assert.equal(prismaClient.auditEvents[1].afterValue.status, "검토중");
  });

  it("rejects unsupported status transitions outside the Story 1.4 scope", async () => {
    const prismaClient = createMemoryPrisma();
    await createOperatingMonth({ actorId: "admin-1", monthKey: "2026-06", prismaClient });

    await assert.rejects(
      () =>
        changeOperatingMonthStatus({
          actorId: "admin-1",
          monthKey: "2026-06",
          status: "마감확정",
          prismaClient
        }),
      (error) =>
        error instanceof OperatingMonthDomainError &&
        error.message === "이 story에서는 작성중에서 검토중으로 변경만 지원합니다."
    );
  });

  it("does not write a second audit event when the draft status changed before the update", async () => {
    const prismaClient = createMemoryPrisma();
    await createOperatingMonth({ actorId: "admin-1", monthKey: "2026-06", prismaClient });
    await changeOperatingMonthStatus({ actorId: "admin-1", monthKey: "2026-06", status: "검토중", prismaClient });

    await assert.rejects(
      () => changeOperatingMonthStatus({ actorId: "admin-1", monthKey: "2026-06", status: "검토중", prismaClient }),
      (error) =>
        error instanceof OperatingMonthDomainError &&
        error.message === "이 story에서는 작성중에서 검토중으로 변경만 지원합니다."
    );
    assert.equal(prismaClient.auditEvents.length, 2);
  });

  it("returns reusable date range DTO values as ISO YYYY-MM-DD strings", async () => {
    const prismaClient = createMemoryPrisma();
    await createOperatingMonth({ actorId: "admin-1", monthKey: "2028-02", prismaClient });

    const range = await getOperatingMonthDateRange("2028-02", { prismaClient });

    assert.deepEqual(range, {
      monthKey: "2028-02",
      startDate: "2028-02-01",
      endDate: "2028-02-29",
      status: "작성중"
    });
  });
});
