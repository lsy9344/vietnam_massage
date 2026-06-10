import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  OpsAttendanceDomainError,
  listOpsAttendanceForDate,
  upsertOpsAttendance
} from "@/modules/settlements/ops-attendance-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(options: { locked?: boolean; monthStatus?: string; failAudit?: boolean; lockInsideTransaction?: boolean } = {}) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
  let transactionActive = false;
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.monthStatus ?? (options.locked ? "잠금" : "작성중"),
    createdAt,
    updatedAt
  };
  const employees = new Map<string, any>([
    ["ops-lead", employee("ops-lead", "OPS-LEAD-001", "팀장", "팀장", 1, true)],
    ["ops-counter-day", employee("ops-counter-day", "OPS-COUNTER-DAY-001", "카운터1", "카운터", 2, true)],
    ["ops-counter-night", employee("ops-counter-night", "OPS-COUNTER-NIGHT-001", "카운터2", "카운터", 3, true)],
    ["ops-waiter-day", employee("ops-waiter-day", "OPS-WAITER-DAY-001", "웨이터1", "웨이터", 4, true)],
    ["ops-waiter-night", employee("ops-waiter-night", "OPS-WAITER-NIGHT-001", "웨이터2", "웨이터", 5, true)],
    ["ops-inactive", employee("ops-inactive", "OPS-INACTIVE", "퇴사 운영", "웨이터", 6, false)],
    ["ear-1", { ...employee("ear-1", "EAR-001", "귀케어1", "귀케어", 1, true), employeeGroup: "EARCARE" }]
  ]);
  const codeItems = [
    code("NORMAL", "정상", 10),
    code("DAY_OFF", "휴무", 20),
    code("LATE", "지각", 30),
    code("EARLY_LEAVE", "조퇴", 40),
    code("ABSENT", "결근", 50),
    { ...code("INACTIVE_STATUS", "비활성", 60), isActive: false }
  ];
  const attendances = new Map<string, any>([
    [attendanceKey("month-2026-06", "2026-06-10", "ops-counter-day"), attendance("att-2", "ops-counter-day", "DAY_OFF")],
    [attendanceKey("month-2026-06", "2026-06-10", "ops-counter-night"), attendance("att-3", "ops-counter-night", "LATE")]
  ]);
  const auditEvents: any[] = [];

  function employee(id: string, staffCode: string, displayName: string, position: string, sortOrder: number, isActive: boolean) {
    return { id, staffCode, displayName, employeeGroup: "OPERATIONS", position, sortOrder, isActive, createdAt, updatedAt };
  }

  function code(codeValue: string, displayName: string, sortOrder: number) {
    return { id: `code-${codeValue}`, codeType: "ATTENDANCE_STATUS", code: codeValue, displayName, sortOrder, isActive: true, createdAt, updatedAt };
  }

  function attendance(id: string, employeeId: string, statusCode: string) {
    return {
      id,
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate("2026-06-10"),
      employeeId,
      statusCode,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function cloneAttendances() {
    return new Map([...attendances.entries()].map(([key, value]) => [key, { ...value }]));
  }

  function restoreAttendances(snapshot: Map<string, any>) {
    attendances.clear();
    for (const [key, value] of snapshot.entries()) attendances.set(key, value);
  }

  function findAttendance(where: any) {
    if (where?.operatingMonthId_attendanceDate_employeeId) {
      const key = attendanceKey(
        where.operatingMonthId_attendanceDate_employeeId.operatingMonthId,
        toIsoDate(where.operatingMonthId_attendanceDate_employeeId.attendanceDate),
        where.operatingMonthId_attendanceDate_employeeId.employeeId
      );
      return attendances.get(key) ?? null;
    }
    return null;
  }

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        if (where.id !== operatingMonth.id) return null;
        if (options.lockInsideTransaction && transactionActive) return { ...operatingMonth, status: options.monthStatus ?? "잠금" };
        return operatingMonth;
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter((record) => (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) && (where?.isActive === undefined || record.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));
      },
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    codeItem: {
      async findMany({ where }: any = {}) {
        return codeItems
          .filter((record) => (where?.codeType === undefined || record.codeType === where.codeType) && (where?.isActive === undefined || record.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
    },
    opsAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.attendanceDate === undefined || toIsoDate(record.attendanceDate) === toIsoDate(where.attendanceDate)) &&
            (where?.employeeId === undefined || record.employeeId === where.employeeId) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      },
      async findUnique({ where }: any) {
        return findAttendance(where);
      },
      async upsert({ where, create, update }: any) {
        const existing = findAttendance(where);
        const key = attendanceKey(create.operatingMonthId, toIsoDate(create.attendanceDate), create.employeeId);
        if (existing) {
          const next = { ...existing, ...update, updatedAt };
          attendances.set(key, next);
          return next;
        }
        const record = { id: `att-${attendances.size + 1}`, ...create, createdAt, updatedAt };
        attendances.set(key, record);
        return record;
      }
    },
    auditLog: {
      async create({ data }: any) {
        if (options.failAudit) throw new Error("audit failed");
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt, ...data };
        auditEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      const attendanceSnapshot = cloneAttendances();
      const auditSnapshotLength = auditEvents.length;
      transactionActive = true;
      try {
        return await callback(client);
      } catch (error) {
        restoreAttendances(attendanceSnapshot);
        auditEvents.splice(auditSnapshotLength);
        throw error;
      } finally {
        transactionActive = false;
      }
    },
    attendances,
    auditEvents
  };

  return client;
}

function attendanceKey(operatingMonthId: string, attendanceDate: string, employeeId: string) {
  return `${operatingMonthId}::${attendanceDate}::${employeeId}`;
}

function toIsoDate(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

describe("ops attendance service", () => {
  it("returns the five active OPERATIONS employees and maps stable status codes to payout eligibility", async () => {
    const result = await listOpsAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.rows.length, 5);
    assert.deepEqual(result.rows.map((row) => [row.staffCode, row.position, row.statusCode, row.isPayoutEligible, row.exclusionReason]), [
      ["OPS-LEAD-001", "팀장", "NORMAL", true, null],
      ["OPS-COUNTER-DAY-001", "카운터", "DAY_OFF", false, "휴무"],
      ["OPS-COUNTER-NIGHT-001", "카운터", "LATE", false, "지각"],
      ["OPS-WAITER-DAY-001", "웨이터", "NORMAL", true, null],
      ["OPS-WAITER-NIGHT-001", "웨이터", "NORMAL", true, null]
    ]);
    assert.deepEqual(result.statusOptions.map((option) => [option.code, option.displayName]), [
      ["NORMAL", "정상"],
      ["DAY_OFF", "휴무"],
      ["LATE", "지각"],
      ["EARLY_LEAVE", "조퇴"],
      ["ABSENT", "결근"]
    ]);
  });

  it("creates attendance by Employee.id, stores statusCode, and records ops_attendance.created audit in the same transaction", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertOpsAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ops-lead",
      statusCode: "NORMAL",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.employeeId, "ops-lead");
    assert.equal(dto.statusCode, "NORMAL");
    assert.equal(dto.isPayoutEligible, true);
    assert.equal(prismaClient.auditEvents.length, 1);
    assert.equal(prismaClient.auditEvents[0].actorId, "account-1");
    assert.equal(prismaClient.auditEvents[0].action, "ops_attendance.created");
    assert.equal(prismaClient.auditEvents[0].targetType, "ops_attendance");
    assert.equal(prismaClient.auditEvents[0].targetId, dto.id);
    assert.equal(prismaClient.auditEvents[0].reason, "payout_affecting");
    assert.deepEqual(prismaClient.auditEvents[0].afterValue, {
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ops-lead",
      statusCode: "NORMAL",
      isActive: true,
      payoutImpact: true,
      changedAt: "2026-06-10T00:10:00.000Z"
    });
  });

  it("updates existing attendance and records before/after status snapshots", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertOpsAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ops-counter-day",
      statusCode: "ABSENT",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.statusCode, "ABSENT");
    assert.equal(dto.isPayoutEligible, false);
    assert.equal(dto.exclusionReason, "결근");
    assert.equal(prismaClient.auditEvents[0].action, "ops_attendance.changed");
    assert.equal(prismaClient.auditEvents[0].beforeValue.statusCode, "DAY_OFF");
    assert.equal(prismaClient.auditEvents[0].beforeValue.payoutImpact, true);
    assert.equal(prismaClient.auditEvents[0].afterValue.statusCode, "ABSENT");
  });

  it("blocks non-operations employees, out-of-range dates, and locked operating months before writes", async () => {
    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ear-1",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: createMemoryPrisma()
      }),
      (error) => error instanceof OpsAttendanceDomainError && error.code === "OPS_EMPLOYEE_NOT_FOUND"
    );

    const rangeClient = createMemoryPrisma();
    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-07-01",
        employeeId: "ops-lead",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: rangeClient
      }),
      (error) => error instanceof OpsAttendanceDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
    assert.equal(rangeClient.auditEvents.length, 0);

    const lockedClient = createMemoryPrisma({ locked: true });
    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ops-lead",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: lockedClient
      }),
      (error) => error instanceof OpsAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(lockedClient.auditEvents.length, 0);

    const confirmedClient = createMemoryPrisma({ monthStatus: "마감확정" });
    const result = await listOpsAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient: confirmedClient
    });
    assert.equal(result.isLocked, true);

    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ops-lead",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: confirmedClient
      }),
      (error) => error instanceof OpsAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(confirmedClient.auditEvents.length, 0);
  });

  it("rechecks locks inside the transaction and rolls back attendance when audit logging fails", async () => {
    const lockedInside = createMemoryPrisma({ lockInsideTransaction: true });
    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ops-lead",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: lockedInside
      }),
      (error) => error instanceof OpsAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(lockedInside.auditEvents.length, 0);

    const failAudit = createMemoryPrisma({ failAudit: true });
    await assert.rejects(
      upsertOpsAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ops-lead",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient: failAudit
      }),
      /audit failed/
    );
    assert.equal(failAudit.attendances.has(attendanceKey("month-2026-06", "2026-06-10", "ops-lead")), false);
    assert.equal(failAudit.auditEvents.length, 0);
  });
});
