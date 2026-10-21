import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TherapistAttendanceDomainError,
  deactivateTherapistAttendance,
  listTherapistAttendanceForDate,
  listTherapistAttendanceForEmployeeInRange,
  listTherapistAttendanceForEmployeesInRange,
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
      checkInMethod?: string;
      checkOutMinute: number | null;
      checkOutMethod?: string | null;
      standbyMinutes: number | null;
      isFullAttendanceRecognized: boolean;
      isActive?: boolean;
    }>;
    therapistCount?: number;
    seedServiceCalls?: Array<{
      id: string;
      serviceDate: string;
      startTime: string;
      status: string;
      assignments: Array<{ employeeId: string; assignmentRole: string; isActive?: boolean }>;
    }>;
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
  employees.set("ops-1", employee("ops-1", "OPS-001", "운영팀1", 999, true, "OPERATIONS"));

  const attendances = new Map<string, any>();
  for (const seed of options.seedAttendances ?? []) {
    // 메모리 시드는 기본적으로 이 칸이 생기기 전 기존 줄("이전 기록")을 흉내낸다(스펙 D16).
    attendances.set(attendanceKey(operatingMonth.id, seed.attendanceDate, seed.employeeId), {
      id: seed.id,
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate(seed.attendanceDate),
      employeeId: seed.employeeId,
      checkInMinute: seed.checkInMinute,
      checkInMethod: seed.checkInMethod ?? "이전 기록",
      checkOutMinute: seed.checkOutMinute,
      checkOutMethod: seed.checkOutMinute === null ? null : seed.checkOutMethod ?? "이전 기록",
      standbyMinutes: seed.standbyMinutes,
      isFullAttendanceRecognized: seed.isFullAttendanceRecognized,
      isActive: seed.isActive ?? true,
      createdAt,
      updatedAt
    });
  }
  const auditEvents: any[] = [];
  const attendanceLocks: string[] = [];
  const serviceCalls = (options.seedServiceCalls ?? []).map((call) => ({
    ...call,
    operatingMonthId: operatingMonth.id,
    serviceDate: dbDate(call.serviceDate),
    assignments: call.assignments.map((assignment) => ({ ...assignment, isActive: assignment.isActive ?? true }))
  }));

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
          if (typeof where?.employeeId === "string" && record.employeeId !== where.employeeId) return false;
          if (where?.employeeId?.in && !where.employeeId.in.includes(record.employeeId)) return false;
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
    serviceCall: {
      async findMany({ where }: any = {}) {
        return serviceCalls
          .filter(
            (call) =>
              (where?.operatingMonthId === undefined || call.operatingMonthId === where.operatingMonthId) &&
              (where?.serviceDate === undefined || toIsoDate(call.serviceDate) === toIsoDate(where.serviceDate)) &&
              (where?.status?.in === undefined || where.status.in.includes(call.status))
          )
          .map((call) => ({ ...call, assignments: call.assignments.map((assignment) => ({ ...assignment })) }));
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
    attendanceLocks,
    serviceCalls
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
    // inactive therapist and non-therapist employee must be excluded
    assert.equal(result.rows.some((row) => row.employeeId === "thr-inactive"), false);
    assert.equal(result.rows.some((row) => row.employeeId === "ops-1"), false);
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
            checkOutMinute: 1200,
            standbyMinutes: 600,
            isFullAttendanceRecognized: true
          }
        ]
      })
    });

    const row = result.rows.find((entry) => entry.employeeId === "thr-1");
    assert.equal(row?.checkInTime, "10:00");
    assert.equal(row?.checkOutTime, "20:00");
    assert.equal(row?.standbyMinutes, 600);
    assert.equal(row?.isFullAttendanceRecognized, true);
    assert.equal(row?.isComplete, true);
  });

  it("returns a check-in-only stored row as incomplete with the checkout-missing reason", async () => {
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
            checkOutMinute: null,
            standbyMinutes: null,
            isFullAttendanceRecognized: false
          }
        ]
      })
    });

    const row = result.rows.find((entry) => entry.employeeId === "thr-1");
    assert.equal(row?.checkInTime, "10:00");
    assert.equal(row?.checkOutTime, null);
    assert.equal(row?.standbyMinutes, null);
    assert.equal(row?.isFullAttendanceRecognized, false);
    assert.equal(row?.isComplete, false);
    assert.equal(row?.incompleteReason, "퇴근 미입력");
  });

  it("creates a new attendance row by Employee.id, stores minute values, and records created audit in the same transaction", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "20:00",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.employeeId, "thr-1");
    assert.equal(dto.standbyMinutes, 600);
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
      checkInMethod: "대리 입력",
      checkOutMinute: 1200,
      checkOutMethod: "대리 입력",
      standbyMinutes: 600,
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
      checkOutTime: "20:00",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.standbyMinutes, 600);
    assert.equal(dto.isFullAttendanceRecognized, true);
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.changed");
    assert.equal(prismaClient.auditEvents[0].beforeValue.standbyMinutes, 479);
    assert.equal(prismaClient.auditEvents[0].beforeValue.isFullAttendanceRecognized, false);
    assert.equal(prismaClient.auditEvents[0].afterValue.standbyMinutes, 600);
    assert.equal(prismaClient.auditEvents[0].afterValue.isFullAttendanceRecognized, true);
  });

  it("changes only the side whose time actually changed, leaving the other side's method as-is (스펙 M23)", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkInMethod: "직접",
          checkOutMinute: 1200,
          checkOutMethod: "직접",
          standbyMinutes: 600,
          isFullAttendanceRecognized: true
        }
      ]
    });

    // checkInTime만 바뀐다. checkOutTime은 저장된 값과 같다.
    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "09:00",
      checkOutTime: "20:00",
      method: "정정 승인",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.checkInMethod, "정정 승인");
    assert.equal(dto.checkOutMethod, "직접");
  });

  it("clears the checkout method when the checkout is removed, instead of assigning this call's method", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkInMethod: "직접",
          checkOutMinute: 1200,
          checkOutMethod: "직접",
          standbyMinutes: 600,
          isFullAttendanceRecognized: true
        }
      ]
    });

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.checkOutTime, null);
    assert.equal(dto.checkOutMethod, null);
    // checkInTime은 그대로이니 출근 방식도 바뀌지 않는다(바뀐 쪽만 바뀐다).
    assert.equal(dto.checkInMethod, "직접");
    const stored = prismaClient.attendances.get("month-2026-06::2026-06-10::thr-1");
    assert.equal(stored.checkOutMethod, null);
  });

  it("stores a check-in-only row when the checkout is missing and defers the full-attendance judgment", async () => {
    const prismaClient = createMemoryPrisma();

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.checkInTime, "10:00");
    assert.equal(dto.checkOutTime, null);
    assert.equal(dto.standbyMinutes, null);
    assert.equal(dto.isFullAttendanceRecognized, false);
    assert.equal(dto.isComplete, false);
    assert.equal(dto.incompleteReason, "퇴근 미입력");
    const stored = prismaClient.attendances.get("month-2026-06::2026-06-10::thr-1");
    assert.equal(stored.checkOutMinute, null);
    assert.equal(stored.standbyMinutes, null);
    assert.equal(stored.isFullAttendanceRecognized, false);
    assert.equal(prismaClient.auditEvents.length, 1);
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.created");
    assert.equal(prismaClient.auditEvents[0].afterValue.checkOutMinute, null);
    assert.equal(prismaClient.auditEvents[0].afterValue.standbyMinutes, null);
  });

  it("re-evaluates the full-attendance flag when the checkout is saved after a check-in-only row", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: null,
          standbyMinutes: null,
          isFullAttendanceRecognized: false
        }
      ]
    });

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "20:00",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.checkOutTime, "20:00");
    assert.equal(dto.standbyMinutes, 600);
    assert.equal(dto.isFullAttendanceRecognized, true);
    assert.equal(dto.isComplete, true);
    assert.equal(dto.incompleteReason, null);
    assert.equal(prismaClient.auditEvents[0].action, "therapist_attendance.changed");
  });

  it("keeps a complete row stored without checkout when the checkout input is cleared", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: 1200,
          standbyMinutes: 600,
          isFullAttendanceRecognized: true
        }
      ]
    });

    const dto = await upsertTherapistAttendance({
      operatingMonthId: "month-2026-06",
      attendanceDate: "2026-06-10",
      employeeId: "thr-1",
      checkInTime: "10:00",
      checkOutTime: "",
      method: "대리 입력",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(dto.checkOutTime, null);
    assert.equal(dto.standbyMinutes, null);
    assert.equal(dto.isFullAttendanceRecognized, false);
  });

  it("rejects a malformed checkout value even though checkout is optional", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId: "thr-1",
        checkInTime: "10:00",
        checkOutTime: "25:00",
        method: "대리 입력",
        actorId: "account-1",
        prismaClient
      }),
      (error) => error instanceof TherapistAttendanceDomainError && error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT"
    );
    assert.equal(prismaClient.auditEvents.length, 0);
    assert.equal(prismaClient.attendances.size, 0);
  });

  it("computes overnight standby minutes without negative results", async () => {
    const cases: Array<[string, string, number, boolean]> = [
      ["22:00", "08:00", 600, true],
      ["22:00", "07:59", 599, false],
      ["10:00", "20:00", 600, true],
      ["10:00", "19:59", 599, false],
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
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
        method: "대리 입력",
        actorId: "account-1",
        prismaClient
      }),
      /audit failed/
    );
    assert.equal(prismaClient.attendances.size, 0);
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("saves a checkout for a therapist with an in-use call and warns without touching the call", async () => {
    const prismaClient = createMemoryPrisma({
      seedServiceCalls: [
        { id: "call-in-use", serviceDate: "2026-06-10", startTime: "19:00", status: "사용중", assignments: [{ employeeId: "thr-1", assignmentRole: "THERAPIST_2" }] },
        { id: "call-reserved", serviceDate: "2026-06-10", startTime: "21:00", status: "예약", assignments: [{ employeeId: "thr-1", assignmentRole: "THERAPIST_1" }] },
        { id: "call-other-day", serviceDate: "2026-06-11", startTime: "19:00", status: "사용중", assignments: [{ employeeId: "thr-1", assignmentRole: "THERAPIST_1" }] },
        { id: "call-other-therapist", serviceDate: "2026-06-10", startTime: "19:00", status: "사용중", assignments: [{ employeeId: "thr-2", assignmentRole: "THERAPIST_1" }] },
        { id: "call-removed", serviceDate: "2026-06-10", startTime: "18:00", status: "사용중", assignments: [{ employeeId: "thr-1", assignmentRole: "THERAPIST_1", isActive: false }] }
      ]
    });
    const save = (employeeId: string, checkOutTime: string) =>
      upsertTherapistAttendance({
        operatingMonthId: "month-2026-06",
        attendanceDate: "2026-06-10",
        employeeId,
        checkInTime: "10:00",
        checkOutTime,
        method: "대리 입력",
        actorId: "account-1",
        prismaClient
      });

    const checkInOnly = await save("thr-1", "");
    assert.deepEqual(checkInOnly.warnings, []);

    const checkedOut = await save("thr-1", "20:00");
    assert.equal(checkedOut.checkOutTime, "20:00");
    assert.deepEqual(checkedOut.warnings, [{ code: "IN_SERVICE_CALL", serviceCallIds: ["call-in-use"] }]);
    assert.equal(prismaClient.serviceCalls.find((call: any) => call.id === "call-in-use")?.status, "사용중");

    const otherTherapist = await save("thr-3", "20:00");
    assert.deepEqual(otherTherapist.warnings, []);

    // 저장 뒤 다시 읽어도 같은 경고가 남는다(직원 패널이 저장 결과로 다시 그려진다).
    const listed = await listTherapistAttendanceForDate({ operatingMonthId: "month-2026-06", attendanceDate: "2026-06-10", prismaClient });
    assert.deepEqual(listed.rows.find((row) => row.employeeId === "thr-1")?.warnings, [{ code: "IN_SERVICE_CALL", serviceCallIds: ["call-in-use"] }]);
    assert.deepEqual(listed.rows.find((row) => row.employeeId === "thr-3")?.warnings, []);
  });

  it("deactivates an attendance row and records a deactivated audit event", async () => {
    const prismaClient = createMemoryPrisma({
      seedAttendances: [
        {
          id: "att-seed-1",
          employeeId: "thr-1",
          attendanceDate: "2026-06-10",
          checkInMinute: 600,
          checkOutMinute: 1200,
          standbyMinutes: 600,
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
          checkOutMinute: 1200,
          standbyMinutes: 600,
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
        { id: "a1", employeeId: "thr-1", attendanceDate: "2026-06-10", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true },
        { id: "a2", employeeId: "thr-1", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true },
        { id: "a3", employeeId: "thr-1", attendanceDate: "2026-06-12", checkInMinute: 600, checkOutMinute: 1199, standbyMinutes: 599, isFullAttendanceRecognized: false },
        { id: "a4", employeeId: "thr-2", attendanceDate: "2026-06-10", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true },
        // out of requested range
        { id: "a5", employeeId: "thr-1", attendanceDate: "2026-06-20", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true },
        // inactive row must be excluded
        { id: "a6", employeeId: "thr-2", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true, isActive: false }
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

  describe("listTherapistAttendanceForEmployeeInRange", () => {
    it("returns one employee's rows across a date range in ascending order, with HH:mm display and methods", async () => {
      const prismaClient = createMemoryPrisma({
        seedAttendances: [
          { id: "a1", employeeId: "thr-1", attendanceDate: "2026-06-12", checkInMinute: 600, checkInMethod: "직접", checkOutMinute: 1200, checkOutMethod: "직접", standbyMinutes: 600, isFullAttendanceRecognized: true },
          { id: "a2", employeeId: "thr-1", attendanceDate: "2026-06-10", checkInMinute: 601, checkInMethod: "대리 입력", checkOutMinute: null, checkOutMethod: null, standbyMinutes: null, isFullAttendanceRecognized: false },
          // different employee, must be excluded
          { id: "a3", employeeId: "thr-2", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true },
          // inactive row, must be excluded
          { id: "a4", employeeId: "thr-1", attendanceDate: "2026-06-11", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true, isActive: false }
        ]
      });

      const rows = await listTherapistAttendanceForEmployeeInRange({
        employeeId: "thr-1",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        prismaClient
      });

      assert.deepEqual(rows.map((row) => row.attendanceDate), ["2026-06-10", "2026-06-12"]);
      assert.equal(rows[0].checkInTime, "10:01");
      assert.equal(rows[0].checkInMethod, "대리 입력");
      assert.equal(rows[0].checkOutTime, null);
      assert.equal(rows[0].incompleteReason, "퇴근 미입력");
      assert.equal(rows[1].checkInTime, "10:00");
      assert.equal(rows[1].checkOutTime, "20:00");
      assert.equal(rows[1].checkOutMethod, "직접");
      assert.equal(rows[1].isFullAttendanceRecognized, true);
    });

    it("returns an empty array when the employee has no attendance in range", async () => {
      const prismaClient = createMemoryPrisma();
      const rows = await listTherapistAttendanceForEmployeeInRange({
        employeeId: "thr-1",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        prismaClient
      });
      assert.deepEqual(rows, []);
    });

    it("rejects an unknown or inactive employee id", async () => {
      const prismaClient = createMemoryPrisma();
      await assert.rejects(
        listTherapistAttendanceForEmployeeInRange({ employeeId: "thr-inactive", startDate: "2026-06-01", endDate: "2026-06-30", prismaClient }),
        (error) => error instanceof TherapistAttendanceDomainError && error.code === "THERAPIST_EMPLOYEE_NOT_FOUND"
      );
      await assert.rejects(
        listTherapistAttendanceForEmployeeInRange({ employeeId: "no-such-id", startDate: "2026-06-01", endDate: "2026-06-30", prismaClient }),
        (error) => error instanceof TherapistAttendanceDomainError && error.code === "THERAPIST_EMPLOYEE_NOT_FOUND"
      );
    });

    it("rejects a reversed date range", async () => {
      const prismaClient = createMemoryPrisma();
      await assert.rejects(
        listTherapistAttendanceForEmployeeInRange({ employeeId: "thr-1", startDate: "2026-06-30", endDate: "2026-06-01", prismaClient }),
        (error) => error instanceof TherapistAttendanceDomainError && error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT"
      );
    });

    it("marks rows as locked when the owning operating month is locked", async () => {
      const prismaClient = createMemoryPrisma({
        locked: true,
        seedAttendances: [
          { id: "a1", employeeId: "thr-1", attendanceDate: "2026-06-12", checkInMinute: 600, checkOutMinute: 1200, standbyMinutes: 600, isFullAttendanceRecognized: true }
        ]
      });

      const rows = await listTherapistAttendanceForEmployeeInRange({
        employeeId: "thr-1",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        prismaClient
      });

      assert.equal(rows.length, 1);
      assert.equal(rows[0].isLocked, true);
    });
  });

  // R7(비용): 관리자 운영월 현황(11)이 사람마다 listTherapistAttendanceForEmployeeInRange를 부르는
  // 대신 한 번에 읽어 메모리에서 나눌 수 있는 자리. R6: 활성 여부를 보지 않아 퇴사한 Therapist도
  // (listTherapistAttendanceForEmployeeInRange라면 거절될 사람도) 그대로 포함된다.
  describe("listTherapistAttendanceForEmployeesInRange", () => {
    it("groups rows by employeeId in one query, including a now-inactive employee's rows", async () => {
      const prismaClient = createMemoryPrisma({
        seedAttendances: [
          { id: "a1", employeeId: "thr-1", attendanceDate: "2026-06-12", checkInMinute: 600, checkInMethod: "직접", checkOutMinute: 1200, checkOutMethod: "직접", standbyMinutes: 600, isFullAttendanceRecognized: true },
          { id: "a2", employeeId: "thr-inactive", attendanceDate: "2026-06-10", checkInMinute: 540, checkInMethod: "직접", checkOutMinute: 1080, checkOutMethod: "직접", standbyMinutes: 540, isFullAttendanceRecognized: true }
        ]
      });

      const byEmployeeId = await listTherapistAttendanceForEmployeesInRange({
        employeeIds: ["thr-1", "thr-inactive", "thr-2"],
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        prismaClient
      });

      assert.deepEqual([...byEmployeeId.keys()].sort(), ["thr-1", "thr-2", "thr-inactive"]);
      assert.equal(byEmployeeId.get("thr-1")?.length, 1);
      assert.equal(byEmployeeId.get("thr-1")?.[0].checkInTime, "10:00");
      assert.equal(byEmployeeId.get("thr-inactive")?.length, 1);
      assert.equal(byEmployeeId.get("thr-inactive")?.[0].checkInTime, "09:00");
      assert.deepEqual(byEmployeeId.get("thr-2"), []);
    });

    it("returns an empty-array map entry for every requested id when none have attendance", async () => {
      const prismaClient = createMemoryPrisma();
      const byEmployeeId = await listTherapistAttendanceForEmployeesInRange({
        employeeIds: ["thr-1", "thr-2"],
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        prismaClient
      });
      assert.deepEqual(byEmployeeId.get("thr-1"), []);
      assert.deepEqual(byEmployeeId.get("thr-2"), []);
    });
  });
});
