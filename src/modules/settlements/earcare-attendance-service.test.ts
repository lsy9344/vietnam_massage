import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EarcareAttendanceDomainError,
  listEarcareAttendanceForDate,
  upsertEarcareAttendance
} from "@/modules/settlements/earcare-attendance-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(options: { locked?: boolean; failAudit?: boolean; lockInsideTransaction?: boolean } = {}) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
  let transactionActive = false;
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.locked ? "잠금" : "작성중",
    createdAt,
    updatedAt
  };
  const employees = new Map<string, any>([
    ["ear-1", employee("ear-1", "EAR-001", "귀케어1", 1, true)],
    ["ear-2", employee("ear-2", "EAR-002", "귀케어2", 2, true)],
    ["ear-3", employee("ear-3", "EAR-003", "귀케어3", 3, true)],
    ["ear-4", employee("ear-4", "EAR-004", "귀케어4", 4, true)],
    ["ear-inactive", employee("ear-inactive", "EAR-999", "퇴사 귀케어", 5, false)],
    ["thr-1", { ...employee("thr-1", "THR-001", "마사지사1", 1, true), employeeGroup: "THERAPIST" }]
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
    [attendanceKey("month-2026-06", "2026-06-10", "ear-2"), attendance("att-2", "ear-2", "DAY_OFF")],
    [attendanceKey("month-2026-06", "2026-06-10", "ear-3"), attendance("att-3", "ear-3", "LATE")]
  ]);
  const auditEvents: any[] = [];

  function employee(id: string, staffCode: string, displayName: string, sortOrder: number, isActive: boolean) {
    return { id, staffCode, displayName, employeeGroup: "EARCARE", position: "귀케어", sortOrder, isActive, createdAt, updatedAt };
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
        if (options.lockInsideTransaction && transactionActive) {
          return { ...operatingMonth, status: "잠금" };
        }
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
      },
      async findFirst({ where }: any = {}) {
        return codeItems.find((record) => record.codeType === where.codeType && record.code === where.code && record.isActive === where.isActive) ?? null;
      }
    },
    earcareAttendance: {
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

describe("earcare attendance service", () => {
  it("returns active EARCARE employees only and maps stable attendance codes to payout eligibility", async () => {
    const result = await listEarcareAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.rows.length, 4);
    assert.deepEqual(result.rows.map((row) => [row.employeeId, row.staffCode, row.statusCode, row.isPayoutEligible, row.exclusionReason]), [
      ["ear-1", "EAR-001", "NORMAL", true, null],
      ["ear-2", "EAR-002", "DAY_OFF", false, "휴무"],
      ["ear-3", "EAR-003", "LATE", false, "지각"],
      ["ear-4", "EAR-004", "NORMAL", true, null]
    ]);
    assert.deepEqual(result.statusOptions.map((option) => [option.code, option.displayName]), [
      ["NORMAL", "정상"],
      ["DAY_OFF", "휴무"],
      ["LATE", "지각"],
      ["EARLY_LEAVE", "조퇴"],
      ["ABSENT", "결근"]
    ]);
  });

  it("creates a new attendance row by Employee.id, stores stable code, and records created audit in the same transaction", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertEarcareAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ear-1",
      statusCode: "NORMAL",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.employeeId, "ear-1");
    assert.equal(dto.statusCode, "NORMAL");
    assert.equal(dto.isPayoutEligible, true);
    assert.equal(prismaClient.auditEvents.length, 1);
    assert.equal(prismaClient.auditEvents[0].actorId, "account-1");
    assert.equal(prismaClient.auditEvents[0].action, "earcare_attendance.created");
    assert.equal(prismaClient.auditEvents[0].targetId, dto.id);
    assert.equal(prismaClient.auditEvents[0].reason, "payout_affecting");
    assert.deepEqual(prismaClient.auditEvents[0].afterValue, {
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ear-1",
      statusCode: "NORMAL",
      isActive: true,
      payoutImpact: true,
      changedAt: "2026-06-10T00:10:00.000Z"
    });
  });

  it("updates an existing attendance row and records before/after status snapshots", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertEarcareAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ear-2",
      statusCode: "ABSENT",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.statusCode, "ABSENT");
    assert.equal(dto.isPayoutEligible, false);
    assert.equal(dto.exclusionReason, "결근");
    assert.equal(prismaClient.auditEvents[0].action, "earcare_attendance.changed");
    assert.equal(prismaClient.auditEvents[0].beforeValue.statusCode, "DAY_OFF");
    assert.equal(prismaClient.auditEvents[0].beforeValue.payoutImpact, true);
    assert.equal(prismaClient.auditEvents[0].afterValue.statusCode, "ABSENT");
    assert.equal(prismaClient.auditEvents[0].afterValue.changedAt, "2026-06-10T00:10:00.000Z");
  });

  it("marks early leave as excluded with the attendance status as the exclusion reason", async () => {
    const dto = await upsertEarcareAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "ear-4",
      statusCode: "EARLY_LEAVE",
      actorId: "account-1",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(dto.statusCode, "EARLY_LEAVE");
    assert.equal(dto.isPayoutEligible, false);
    assert.equal(dto.exclusionReason, "조퇴");
  });

  it("blocks out-of-range dates without DB or audit writes", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      upsertEarcareAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-07-01",
        employeeId: "ear-1",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof EarcareAttendanceDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.has(attendanceKey("month-2026-06", "2026-07-01", "ear-1")), false);
  });

  it("blocks locked operating month mutation with no attendance or audit side effects", async () => {
    const prismaClient = createMemoryPrisma({ locked: true });
    await assert.rejects(
      upsertEarcareAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ear-1",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof EarcareAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.has(attendanceKey("month-2026-06", "2026-06-10", "ear-1")), false);
  });

  it("rechecks locked operating month inside the write transaction before mutating", async () => {
    const prismaClient = createMemoryPrisma({ lockInsideTransaction: true });
    await assert.rejects(
      upsertEarcareAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ear-1",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof EarcareAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.has(attendanceKey("month-2026-06", "2026-06-10", "ear-1")), false);
  });

  it("rolls back attendance writes when audit logging fails inside transaction", async () => {
    const prismaClient = createMemoryPrisma({ failAudit: true });
    await assert.rejects(
      upsertEarcareAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "ear-1",
        statusCode: "NORMAL",
        actorId: "account-1",
        prismaClient
      }),
      /audit failed/
    );
    assert.equal(prismaClient.attendances.has(attendanceKey("month-2026-06", "2026-06-10", "ear-1")), false);
    assert.equal(prismaClient.auditEvents.length, 0);
  });
});
