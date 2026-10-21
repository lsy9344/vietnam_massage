import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeClockInCode, deriveClockCodeDaySecretHex } from "@/modules/therapists/therapist-clock-code";
import { clockInWithCode, TherapistClockInDomainError, type TherapistClockInPrismaClient } from "@/modules/therapists/therapist-clock-in-service";

const SECRET = "test-nextauth-secret";
// 2042-05-10 14:00(Asia/Ho_Chi_Minh) = 2042-05-10T07:00:00.000Z. 영업일 시작 "11:00"보다 늦어
// 오늘 영업일은 달력날 그대로다(티켓 05 E2E 예약 월과 맞춰 2042-05를 쓴다).
const NOW = new Date("2042-05-10T07:00:00.000Z");

async function correctCodeForNow() {
  const calendarDate = "2042-05-10";
  const minuteOfDay = 14 * 60;
  const daySecretHex = await deriveClockCodeDaySecretHex(SECRET, calendarDate);
  return computeClockInCode(daySecretHex, minuteOfDay);
}

async function wrongCodeForNow() {
  const correct = Number(await correctCodeForNow());
  return String((correct + 1) % 10000).padStart(4, "0");
}

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function attendanceKey(operatingMonthId: string, attendanceDate: string, employeeId: string) {
  return `${operatingMonthId}::${attendanceDate}::${employeeId}`;
}

type MemoryPrismaOptions = {
  monthStatus?: string;
  clockInCodeFailedCount?: number;
  clockInCodeLockedUntil?: Date | null;
  seedAttendance?: { checkInMinute: number; checkInMethod?: string; checkOutMinute?: number | null; checkOutMethod?: string | null };
};

/**
 * 티켓 05 전용 메모리 Prisma(코드베이스 지도 14절: createMemoryPrisma는 공용 모듈이 아니다). 이
 * 서비스가 직접 쓰는 모델(userAccount, timeSlot, operatingMonth-by-monthKey, therapistAttendance)과
 * upsertTherapistAttendance가 안에서 쓰는 모델(operatingMonth-by-id, employee, serviceCall, auditLog,
 * $transaction)을 모두 갖춘다 — therapist-attendance-service.test.ts의 메모리 Prisma와 같은 모양이다.
 */
function createMemoryPrisma(options: MemoryPrismaOptions = {}) {
  const createdAt = new Date("2042-05-01T00:00:00.000Z");
  const updatedAt = createdAt;

  const operatingMonth = {
    id: "month-2042-05",
    monthKey: "2042-05",
    startDate: dbDate("2042-05-01"),
    endDate: dbDate("2042-05-31"),
    status: options.monthStatus ?? "작성중",
    createdAt,
    updatedAt
  };

  const employee = {
    id: "thr-direct",
    staffCode: "THR-98050",
    displayName: "직접찍기",
    employeeGroup: "THERAPIST",
    sortOrder: 98050,
    isActive: true,
    createdAt,
    updatedAt
  };

  const account = {
    id: "acct-direct",
    clockInCodeFailedCount: options.clockInCodeFailedCount ?? 0,
    clockInCodeLockedUntil: options.clockInCodeLockedUntil ?? null
  };

  const timeSlots = [{ value: "11:00", sortOrder: 10, createdAt, isActive: true }];

  const attendances = new Map<string, any>();
  if (options.seedAttendance) {
    attendances.set(attendanceKey(operatingMonth.id, "2042-05-10", employee.id), {
      id: "att-seed",
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate("2042-05-10"),
      employeeId: employee.id,
      checkInMinute: options.seedAttendance.checkInMinute,
      checkInMethod: options.seedAttendance.checkInMethod ?? "직접",
      checkOutMinute: options.seedAttendance.checkOutMinute ?? null,
      checkOutMethod: options.seedAttendance.checkOutMethod ?? null,
      standbyMinutes: null,
      isFullAttendanceRecognized: false,
      isActive: true,
      createdAt,
      updatedAt
    });
  }

  const auditEvents: any[] = [];

  function findAttendanceByCompositeKey(where: any) {
    const composite = where?.operatingMonthId_attendanceDate_employeeId;
    if (!composite) return null;
    const key = attendanceKey(composite.operatingMonthId, toIsoDate(composite.attendanceDate), composite.employeeId);
    return attendances.get(key) ?? null;
  }

  let transactionActive = false;

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        if (where.id !== undefined) return where.id === operatingMonth.id ? operatingMonth : null;
        if (where.monthKey !== undefined) return where.monthKey === operatingMonth.monthKey ? operatingMonth : null;
        return null;
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [employee].filter(
          (record) =>
            (where?.employeeGroup === undefined || record.employeeGroup === where.employeeGroup) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      },
      async findUnique({ where }: any) {
        return where.id === employee.id ? employee : null;
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
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
        const composite = where.operatingMonthId_attendanceDate_employeeId;
        const key = attendanceKey(composite.operatingMonthId, toIsoDate(composite.attendanceDate), composite.employeeId);
        const existing = attendances.get(key);
        const next = { ...existing, ...data, updatedAt };
        attendances.set(key, next);
        return next;
      }
    },
    serviceCall: {
      async findMany() {
        return [] as any[];
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt, ...data };
        auditEvents.push(record);
        return record;
      }
    },
    userAccount: {
      async findUnique({ where }: any) {
        return where.id === account.id ? { ...account } : null;
      },
      async update({ where, data }: any) {
        if (where.id !== account.id) throw new Error("unknown account");
        Object.assign(account, data);
        return { ...account };
      }
    },
    timeSlot: {
      async findMany({ where }: any = {}) {
        return timeSlots.filter((slot) => where?.isActive === undefined || slot.isActive === where.isActive);
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      const snapshot = new Map([...attendances.entries()].map(([key, value]) => [key, { ...value }]));
      const auditLength = auditEvents.length;
      transactionActive = true;
      try {
        return await callback(client);
      } catch (error) {
        attendances.clear();
        for (const [key, value] of snapshot.entries()) attendances.set(key, value);
        auditEvents.splice(auditLength);
        throw error;
      } finally {
        transactionActive = false;
      }
    },
    account,
    attendances,
    auditEvents
  };

  return client as TherapistClockInPrismaClient & { account: typeof account; attendances: typeof attendances; auditEvents: typeof auditEvents };
}

describe("clockInWithCode", () => {
  it("records a check-in with method 직접 and audits it on actorId", async () => {
    const client = createMemoryPrisma();
    const code = await correctCodeForNow();

    const result = await clockInWithCode({
      employeeId: "thr-direct",
      accountId: "acct-direct",
      action: "check_in",
      code,
      now: NOW,
      secret: SECRET,
      prismaClient: client
    });

    assert.equal(result.checkInMethod, "직접");
    assert.equal(result.checkOutTime, null);
    assert.equal(client.auditEvents.length, 1);
    assert.equal(client.auditEvents[0].action, "therapist_attendance.created");
    assert.equal(client.auditEvents[0].actorId, "acct-direct");
  });

  it("rejects an already-clocked-in employee without touching the lockout count", async () => {
    const client = createMemoryPrisma({ seedAttendance: { checkInMinute: 600, checkOutMinute: null } });
    const code = await correctCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "ALREADY_CLOCKED_IN"
    );
    assert.equal(client.account.clockInCodeFailedCount, 0);
  });

  it("checks out using the existing check-in minute and marks it 직접", async () => {
    const client = createMemoryPrisma({ seedAttendance: { checkInMinute: 600, checkOutMinute: null } });
    const code = await correctCodeForNow();

    const result = await clockInWithCode({
      employeeId: "thr-direct",
      accountId: "acct-direct",
      action: "check_out",
      code,
      now: NOW,
      secret: SECRET,
      prismaClient: client
    });

    assert.equal(result.checkInTime, "10:00");
    assert.notEqual(result.checkOutTime, null);
    assert.equal(result.checkOutMethod, "직접");
  });

  it("rejects checking out before checking in", async () => {
    const client = createMemoryPrisma();
    const code = await correctCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_out", code, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "CHECK_IN_REQUIRED_BEFORE_CHECK_OUT"
    );
  });

  it("rejects an already-clocked-out employee", async () => {
    const client = createMemoryPrisma({ seedAttendance: { checkInMinute: 600, checkOutMinute: 900, checkOutMethod: "직접" } });
    const code = await correctCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_out", code, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "ALREADY_CLOCKED_OUT"
    );
  });

  it("rejects a wrong code and reports the remaining attempts", async () => {
    const client = createMemoryPrisma();
    const wrongCode = await wrongCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code: wrongCode, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "CLOCK_CODE_INVALID" && error.details?.remainingAttempts === 4
    );
    assert.equal(client.account.clockInCodeFailedCount, 1);
  });

  it("locks the account for 15 minutes after the 5th wrong code (D14)", async () => {
    const client = createMemoryPrisma({ clockInCodeFailedCount: 4 });
    const wrongCode = await wrongCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code: wrongCode, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "CLOCK_CODE_LOCKED"
    );
    assert.equal(client.account.clockInCodeFailedCount, 5);
    assert.equal(client.account.clockInCodeLockedUntil?.getTime(), NOW.getTime() + 15 * 60 * 1000);
  });

  it("rejects even a correct code while locked, without re-verifying", async () => {
    const client = createMemoryPrisma({ clockInCodeLockedUntil: new Date(NOW.getTime() + 5 * 60 * 1000) });
    const code = await correctCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof TherapistClockInDomainError && error.code === "CLOCK_CODE_LOCKED"
    );
  });

  it("resets the failed count to 0 once a correct code is entered", async () => {
    const client = createMemoryPrisma({ clockInCodeFailedCount: 3 });
    const code = await correctCodeForNow();

    await clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code, now: NOW, secret: SECRET, prismaClient: client });

    assert.equal(client.account.clockInCodeFailedCount, 0);
    assert.equal(client.account.clockInCodeLockedUntil, null);
  });

  it("lets a locked operating month's rejection (잠긴 운영월) pass through unchanged", async () => {
    const client = createMemoryPrisma({ monthStatus: "잠금" });
    const code = await correctCodeForNow();

    await assert.rejects(
      () =>
        clockInWithCode({ employeeId: "thr-direct", accountId: "acct-direct", action: "check_in", code, now: NOW, secret: SECRET, prismaClient: client }),
      (error: unknown) => error instanceof Error && (error as any).code === "OPERATING_MONTH_LOCKED"
    );
  });
});
