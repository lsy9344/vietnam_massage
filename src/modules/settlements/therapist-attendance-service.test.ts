import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TherapistAttendanceDomainError,
  deactivateTherapistAttendance,
  listTherapistAttendanceForDate,
  listTherapistFullAttendanceRecognitions,
  upsertTherapistAttendance
} from "@/modules/settlements/therapist-attendance-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function attendanceKey(operatingMonthId: string, attendanceDate: string, employeeId: string) {
  return `${operatingMonthId}::${attendanceDate}::${employeeId}`;
}

function createMemoryPrisma(
  options: {
    locked?: boolean;
    monthStatus?: string;
    failAudit?: boolean;
    lockInsideTransaction?: boolean;
    deactivateTherapistInsideTransaction?: boolean;
    seedAttendances?: Array<{
      id: string;
      employeeId: string;
      attendanceDate: string;
      checkInMinute: number;
      checkOutMinute: number;
      standbyMinutes: number;
      isFullAttendanceRecognized: boolean;
      isActive?: boolean;
    }>;
    therapistCount?: number;
  } = {}
) {
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

  function employee(id: string, staffCode: string, displayName: string, sortOrder: number, isActive: boolean, group = "THERAPIST") {
    return { id, staffCode, displayName, employeeGroup: group, position: "마사지사", sortOrder, isActive, createdAt, updatedAt };
  }

  const employees = new Map<string, any>();
  const therapistCount = options.therapistCount ?? 50;
  for (let index = 1; index <= therapistCount; index += 1) {
    const id = `thr-${index}`;
    employees.set(id, employee(id, `THR-${String(index).padStart(3, "0")}`, `마사지사${index}`, index, true));
  }
  employees.set("thr-inactive", employee("thr-inactive", "THR-999", "퇴사 마사지사", 998, false));
  employees.set("ear-1", employee("ear-1", "EAR-001", "귀케어1", 999, true, "EARCARE"));

  const attendances = new Map<string, any>();
  for (const seed of options.seedAttendances ?? []) {
    attendances.set(attendanceKey(operatingMonth.id, seed.attendanceDate, seed.employeeId), {
      id: seed.id,
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate(seed.attendanceDate),
      employeeId: seed.employeeId,
      checkInMinute: seed.checkInMinute,
      checkOutMinute: seed.checkOutMinute,
      standbyMinutes: seed.standbyMinutes,
      isFullAttendanceRecognized: seed.isFullAttendanceRecognized,
      isActive: seed.isActive ?? true,
      createdAt,
      updatedAt
    });
  }
  const auditEvents: any[] = [];
  const attendanceLocks: string[] = [];

  function cloneAttendances() {
    return new Map([...attendances.entries()].map(([key, value]) => [key, { ...value }]));
  }

  function restoreAttendances(snapshot: Map<string, any>) {
    attendances.clear();
    for (const [key, value] of snapshot.entries()) attendances.set(key, value);
  }

  function findAttendanceByCompositeKey(where: any) {
    const composite = where?.operatingMonthId_attendanceDate_employeeId;
    if (!composite) return null;
    const key = attendanceKey(composite.operatingMonthId, toIsoDate(composite.attendanceDate), composite.employeeId);
    return attendances.get(key) ?? null;
  }

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        if (where.id !== operatingMonth.id) return null;
        if (options.lockInsideTransaction && transactionActive) {
          return { ...operatingMonth, status: options.monthStatus ?? "잠금" };
        }
        return operatingMonth;
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter(
            (record) =>
              (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) &&
              (where?.isActive === undefined || record.isActive === where.isActive)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.id.localeCompare(b.id));
      },
      async findUnique({ where }: any) {
        const record = employees.get(where.id) ?? null;
        if (record && options.deactivateTherapistInsideTransaction && transactionActive) {
          return { ...record, isActive: false };
        }
        return record;
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter((record) => {
          if (where?.operatingMonthId !== undefined && record.operatingMonthId !== where.operatingMonthId) return false;
          if (where?.isActive !== undefined && record.isActive !== where.isActive) return false;
          if (where?.attendanceDate !== undefined) {
            if (where.attendanceDate?.gte !== undefined || where.attendanceDate?.lte !== undefined) {
              const iso = toIsoDate(record.attendanceDate);
              if (where.attendanceDate.gte !== undefined && iso < toIsoDate(where.attendanceDate.gte)) return false;
              if (where.attendanceDate.lte !== undefined && iso > toIsoDate(where.attendanceDate.lte)) return false;
            } else if (toIsoDate(record.attendanceDate) !== toIsoDate(where.attendanceDate)) {
              return false;
            }
          }
          if (where?.employeeId !== undefined && record.employeeId !== where.employeeId) return false;
          return true;
        });
      },
      async findUnique({ where }: any) {
        return findAttendanceByCompositeKey(where);
      },
      async upsert({ where, create, update }: any) {
        const existing = findAttendanceByCompositeKey(where);
        const key = attendanceKey(create.operatingMonthId, toIsoDate(create.attendanceDate), create.employeeId);
        if (existing) {
          const next = { ...existing, ...update, updatedAt };
          attendances.set(key, next);
          return next;
        }
        const record = { id: `att-${attendances.size + 1}`, ...create, createdAt, updatedAt };
        attendances.set(key, record);
        return record;
      },
      async update({ where, data }: any) {
        const existing = findAttendanceByCompositeKey(where);
        if (!existing) {
          throw new Error("Record to update not found.");
        }
        const composite = where.operatingMonthId_attendanceDate_employeeId;
        const key = attendanceKey(composite.operatingMonthId, toIsoDate(composite.attendanceDate), composite.employeeId);
        const next = { ...existing, ...data, updatedAt };
        attendances.set(key, next);
        return next;
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
    async $executeRawUnsafe(_query: string, ...values: unknown[]) {
      attendanceLocks.push(String(values[0] ?? ""));
      return 1;
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
    auditEvents,
    attendanceLocks
  };

  return client;
}

describe("therapist attendance service", () => {
  it("returns exactly the 50 active therapists in stable order with incomplete DTOs when no row exists", async () => {
    const result = await listTherapistAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.rows.length, 50);
    assert.equal(result.rows[0].employeeId, "thr-1");
    assert.equal(result.rows[0].staffCode, "THR-001");
    assert.equal(result.rows[0].checkInTime, null);
    assert.equal(result.rows[0].checkOutTime, null);
    assert.equal(result.rows[0].isComplete, false);
    assert.equal(result.rows[0].incompleteReason, "출퇴근 미입력");
    assert.equal(result.rows[0].isFullAttendanceRecognized, false);
    // inactive therapist and earcare employee must be excluded
    assert.equal(result.rows.some((row) => row.employeeId === "thr-inactive"), false);
    assert.equal(result.rows.some((row) => row.employeeId === "ear-1"), false);
  });

  it("returns stored minute values as HH:mm display strings and recognition flags for complete rows", async () => {
    const result = await listTherapistAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({
        seedAttendances: [
          {
            id: "att-seed-1",
            employeeId: "thr-1",
            attendanceDate: "2026-06-10",
            checkInMinute: 600,
            checkOutMinute: 1080,
            standbyMinutes: 480,
            isFullAttendanceRecognized: true
          }
        ]
      })
    });

    const row = result.rows.find((entry) => entry.employeeId === "thr-1");
    assert.equal(row?.checkInTime, "10:00");
    assert.equal(row?.checkOutTime, "18:00");
    assert.equal(row?.standbyMinutes, 480);
    assert.equal(row?.isFullAttendanceRecognized, true);
    assert.equal(row?.isComplete, true);
  });

  it("creates a new attendance row by Employee.id, stores minute values, and records created audit in the same transaction", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "18:00",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.employeeId, "thr-1");
    assert.equal(dto.standbyMinutes, 480);
    assert.equal(dto.isFullAttendanceRecognized, true);
    assert.equal(prismaClient.auditEvents.length, 1);
    assert.equal(prismaClient.auditEvents[0].actorId, "account-1");
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.created");
    assert.equal(prismaClient.auditEvents[0].targetType, "therapist_attendance");
    assert.equal(prismaClient.auditEvents[0].targetId, dto.id);
    assert.equal(prismaClient.auditEvents[0].reason, "payout_affecting");
    assert.deepEqual(prismaClient.attendanceLocks, ["therapist_attendance:month-2026-06:2026-06-10:thr-1"]);
    assert.deepEqual(prismaClient.auditEvents[0].afterValue, {
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInMinute: 600,
      checkOutMinute: 1080,
      standbyMinutes: 480,
      isFullAttendanceRecognized: true,
      isActive: true,
      payoutImpact: true,
      changedAt: "2026-06-10T00:10:00.000Z"
    });
  });

  it("updates an existing attendance row and records before/after minute snapshots", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: 1079,
          standbyMinutes: 479,
          isFullAttendanceRecognized: false
        }
      ]
    });

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "18:00",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.standbyMinutes, 480);
    assert.equal(dto.isFullAttendanceRecognized, true);
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.changed");
    assert.equal(prismaClient.auditEvents[0].beforeValue.standbyMinutes, 479);
    assert.equal(prismaClient.auditEvents[0].beforeValue.isFullAttendanceRecognized, false);
    assert.equal(prismaClient.auditEvents[0].afterValue.standbyMinutes, 480);
    assert.equal(prismaClient.auditEvents[0].afterValue.isFullAttendanceRecognized, true);
  });

  it("computes overnight standby minutes without negative results", async () => {
    const cases: Array<[string, string, number, boolean]> = [
      ["22:00", "06:00", 480, true],
      ["22:00", "05:59", 479, false],
      ["10:00", "18:00", 480, true],
      ["10:00", "17:59", 479, false],
      ["10:00", "10:00", 0, false]
    ];

    for (const [checkInTime, checkOutTime, expectedStandby, expectedRecognized] of cases) {
      const prismaClient = createMemoryPrisma();
      const dto = await upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime,
        checkOutTime,
        actorId: "account-1",
        prismaClient
      });
      assert.equal(dto.standbyMinutes, expectedStandby, `${checkInTime}->${checkOutTime} standby`);
      assert.equal(dto.isFullAttendanceRecognized, expectedRecognized, `${checkInTime}->${checkOutTime} recognized`);
    }
  });

  it("rejects invalid or missing time input with a safe Korean message and no side effects", async () => {
    const prismaClient = createMemoryPrisma();
    for (const badTime of ["", "25:00", "10:60", "1000", "abc"]) {
      await assert.rejects(
        upsertTherapistAttendance({
          operatingMonthId: "month-2026-06",
          attendanceDate: "2026-06-10",
          employeeId: "thr-1",
          checkInTime: badTime,
          checkOutTime: "18:00",
          actorId: "account-1",
          prismaClient
        }),
        (error) => error instanceof TherapistAttendanceDomainError && error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT"
      );
    }
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("blocks out-of-range dates without DB or audit writes", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-07-01",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("blocks locked operating month mutation with no side effects", async () => {
    const prismaClient = createMemoryPrisma({ locked: true });
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("marks confirmed operating month read-only and blocks mutation", async () => {
    const prismaClient = createMemoryPrisma({ monthStatus: "마감확정" });

    const result = await listTherapistAttendanceForDate({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      prismaClient
    });
    assert.equal(result.isLocked, true);
    assert.equal(result.rows[0].isLocked, true);

    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("rechecks locked operating month inside the write transaction before mutating", async () => {
    const prismaClient = createMemoryPrisma({ lockInsideTransaction: true });
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("rechecks active therapist status inside the write transaction before mutating", async () => {
    const prismaClient = createMemoryPrisma({ deactivateTherapistInsideTransaction: true });
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "THERAPIST_EMPLOYEE_NOT_FOUND"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("rolls back attendance writes when audit logging fails inside the transaction", async () => {
    const prismaClient = createMemoryPrisma({ failAudit: true });
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "18:00",
        actorId: "account-1",
        prismaClient
      }),
      /audit failed/
    );
    assert.equal(prismaClient.attendances.size, 0);
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("deactivates an attendance row and records a deactivated audit event", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: 1080,
          standbyMinutes: 480,
          isFullAttendanceRecognized: true
        }
      ]
    });

    const dto = await deactivateTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.isComplete, false);
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.deactivated");
    assert.equal(prismaClient.auditEvents[0].afterValue.isActive, false);
  });

  it("does not record a stale or duplicate clear when the row is already inactive", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: 1080,
          standbyMinutes: 480,
          isFullAttendanceRecognized: true,
          isActive: false
        }
      ]
    });

    await assert.rejects(
      deactivateTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "THERAPIST_ATTENDANCE_NOT_FOUND"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("aggregates full-attendance recognitions by Employee.id within the requested range only", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        { id: "a1", employeeId: "thr-1", attendanceDate: "2026-06-10", checkInMinute: 600, checkOutMinute: 1080, standbyMinutes: 480, isFullAttendanceRecognized: true },
        { id: "a2", employeeId: "thr-1", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1080, standbyMinutes: 480, isFullAttendanceRecognized: true },
        { id: "a3", employeeId: "thr-1", attendanceDate: "2026-06-12", checkInMinute: 600, checkOutMinute: 1079, standbyMinutes: 479, isFullAttendanceRecognized: false },
        { id: "a4", employeeId: "thr-2", attendanceDate: "2026-06-10", checkInMinute: 600, checkOutMinute: 1080, standbyMinutes: 480, isFullAttendanceRecognized: true },
        // out of requested range
        { id: "a5", employeeId: "thr-1", attendanceDate: "2026-06-20", checkInMinute: 600, checkOutMinute: 1080, standbyMinutes: 480, isFullAttendanceRecognized: true },
        // inactive row must be excluded
        { id: "a6", employeeId: "thr-2", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1080, standbyMinutes: 480, isFullAttendanceRecognized: true, isActive: false }
      ]
    });

    const result = await listTherapistFullAttendanceRecognitions({
      operatingMonthId: "month-2026-06",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      prismaClient
    });

    assert.equal(result.sourceStatus, "available");
    assert.equal(result.sourceDayCount, 3);
    const byId = new Map(result.rows.map((row) => [row.employeeId, row.fullAttendanceDays]));
    assert.equal(byId.get("thr-1"), 2);
    assert.equal(byId.get("thr-2"), 1);
  });

  it("returns an available source with zero counts when no attendance exists in range", async () => {
    const prismaClient = createMemoryPrisma();
    const result = await listTherapistFullAttendanceRecognitions({
      operatingMonthId: "month-2026-06",
      startDate: "2026-06-01",
      endDate: "2026-06-30",
      prismaClient
    });

    assert.equal(result.sourceStatus, "available");
    assert.equal(result.sourceDayCount, 0);
    assert.deepEqual(result.rows, []);
  });

  it("rejects a reversed full-attendance recognition range instead of treating it as an empty source", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      listTherapistFullAttendanceRecognitions({
        operatingMonthId: "month-2026-06",
        startDate: "2026-06-30",
        endDate: "2026-06-01",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT"
    );
  });

  it("rejects an invalid calendar date in the full-attendance recognition range", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      listTherapistFullAttendanceRecognitions({
        operatingMonthId: "month-2026-06",
        startDate: "2026-06-01",
        endDate: "2026-02-30",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT"
    );
  });

  it("rejects a recognition range that falls outside the operating month dates", async () => {
    const prismaClient = createMemoryPrisma();
    // operating month is 2026-06-01..2026-06-30 in the memory client
    await assert.rejects(
      listTherapistFullAttendanceRecognitions({
        operatingMonthId: "month-2026-06",
        startDate: "2026-05-15",
        endDate: "2026-06-15",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
    await assert.rejects(
      listTherapistFullAttendanceRecognitions({
        operatingMonthId: "month-2026-06",
        startDate: "2026-06-15",
        endDate: "2026-07-15",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
  });
});
