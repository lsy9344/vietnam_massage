import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TherapistAttendanceDomainError } from "@/modules/settlements/therapist-attendance-service";
import {
  TherapistRequestDomainError,
  approveTherapistCorrectionRequest,
  approveTherapistDayOffRequest,
  cancelTherapistDayOffRequestForDate,
  cancelTherapistRequest,
  countPendingTherapistRequests,
  listTherapistRequestsForAdmin,
  listTherapistRequestsForEmployeeInRange,
  rejectTherapistRequest,
  requestTherapistCorrection,
  requestTherapistDayOff
} from "@/modules/therapists/therapist-request-service";

const createdAt = new Date("2042-08-01T00:00:00.000Z");
const updatedAt = createdAt;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

// createMemoryPrisma의 attendances 맵 키와 같은 모양(09, client.attendances 직접 들여다볼 때 쓴다).
function attendanceMapKey(attendanceDate: string, employeeId: string) {
  return `${attendanceDate}::${employeeId}`;
}

// now는 UTC+7(영업 시간대)에서 2042-08-10 15:00이라 운영일은 2042-08-10이다(dayStart "11:00"보다 늦다).
const now = new Date("2042-08-10T08:00:00.000Z");

/**
 * 티켓 08·09 테스트용 메모리 Prisma. 신청(therapistRequest) + 승인이 그대로 부르는 근무표
 * (plannedWorkingDay·employee) + 출퇴근(therapistAttendance·operatingMonth, 09의 정정 승인이
 * upsertTherapistAttendance·listTherapistAttendanceForEmployeeInRange를 거쳐 읽고 쓴다) + 콜
 * (serviceCall, 배정 수) + 감사(auditLog) + 행위자 이름(userAccount)을 모두 둔다
 * (createMemoryPrisma는 공용 모듈이 아니다, 코드베이스 지도 14절). $transaction은
 * schedule-service.test.ts와 같은 모양으로 실패 시 되돌린다.
 */
function createMemoryPrisma(
  options: {
    seedRequests?: Array<{
      id: string;
      employeeId: string;
      kind: "휴무" | "정정";
      targetDate: string;
      reason?: string | null;
      status?: "대기" | "승인" | "거절" | "취소";
      resolutionReason?: string | null;
      resolvedByAccountId?: string | null;
      resolvedAt?: Date | null;
      requestedCheckInTime?: string | null;
      requestedCheckOutTime?: string | null;
      createdAt?: Date;
    }>;
    seedPlannedWorkingDays?: Array<{ employeeId: string; workDate: string; planStatus: string }>;
    seedServiceCalls?: Array<{ id: string; serviceDate: string; employeeId: string }>;
    // 09: 운영월 상태(잠긴 운영월·마감확정 거절 테스트용)와 기존 출퇴근 줄(정정 승인이 바뀌지
    // 않은 쪽을 그대로 지키는지 보는 테스트용).
    monthStatus?: string;
    seedAttendances?: Array<{
      employeeId: string;
      attendanceDate: string;
      checkInMinute: number;
      checkInMethod?: string;
      checkOutMinute?: number | null;
      checkOutMethod?: string | null;
      standbyMinutes?: number | null;
      isFullAttendanceRecognized?: boolean;
      isActive?: boolean;
    }>;
    failAudit?: boolean;
  } = {}
) {
  const employees = new Map<string, any>([
    ["emp-1", { id: "emp-1", displayName: "민호", staffCode: "THR-901", employeeGroup: "THERAPIST", sortOrder: 9801, isActive: true }]
  ]);
  const userAccounts = new Map<string, any>([
    ["acct-admin", { id: "acct-admin", accountId: "admin-01", employee: { displayName: "박관리" } }],
    ["acct-emp-1", { id: "acct-emp-1", accountId: "therapist-01", employee: { displayName: "민호" } }]
  ]);

  const requests = new Map<string, any>();
  let sequence = 0;
  for (const seed of options.seedRequests ?? []) {
    requests.set(seed.id, {
      id: seed.id,
      employeeId: seed.employeeId,
      kind: seed.kind,
      targetDate: dbDate(seed.targetDate),
      requestedCheckInTime: seed.requestedCheckInTime ?? null,
      requestedCheckOutTime: seed.requestedCheckOutTime ?? null,
      reason: seed.reason ?? null,
      status: seed.status ?? "대기",
      resolutionReason: seed.resolutionReason ?? null,
      resolvedByAccountId: seed.resolvedByAccountId ?? null,
      resolvedAt: seed.resolvedAt ?? null,
      createdAt: seed.createdAt ?? new Date(createdAt.getTime() + sequence++ * 1000),
      updatedAt
    });
  }

  const plannedWorkingDays = new Map<string, any>();
  for (const seed of options.seedPlannedWorkingDays ?? []) {
    plannedWorkingDays.set(`${seed.employeeId}::${seed.workDate}`, {
      id: `pwd-${plannedWorkingDays.size + 1}`,
      employeeId: seed.employeeId,
      workDate: dbDate(seed.workDate),
      planStatus: seed.planStatus,
      plannedStartTime: null,
      createdAt,
      updatedAt
    });
  }

  const serviceCalls = (options.seedServiceCalls ?? []).map((seed) => ({
    id: seed.id,
    operatingMonthId: "month-2042-08",
    serviceDate: dbDate(seed.serviceDate),
    startTime: "10:00",
    status: "예약",
    course: { code: "A" },
    assignments: [{ employeeId: seed.employeeId, isActive: true }]
  }));

  // 09: 정정 승인의 상대편(upsertTherapistAttendance·listTherapistAttendanceForEmployeeInRange)이
  // 요구하는 모양만 둔다(therapist-attendance-service.test.ts의 메모리 Prisma와 같은 모양).
  const operatingMonth = {
    id: "month-2042-08",
    monthKey: "2042-08",
    startDate: dbDate("2042-08-01"),
    endDate: dbDate("2042-08-31"),
    status: options.monthStatus ?? "작성중",
    createdAt,
    updatedAt
  };

  function attendanceKey(attendanceDate: string, employeeId: string) {
    return `${attendanceDate}::${employeeId}`;
  }

  const attendances = new Map<string, any>();
  for (const seed of options.seedAttendances ?? []) {
    attendances.set(attendanceKey(seed.attendanceDate, seed.employeeId), {
      id: `att-${attendances.size + 1}`,
      operatingMonthId: operatingMonth.id,
      attendanceDate: dbDate(seed.attendanceDate),
      employeeId: seed.employeeId,
      checkInMinute: seed.checkInMinute,
      checkInMethod: seed.checkInMethod ?? "직접",
      checkOutMinute: seed.checkOutMinute ?? null,
      checkOutMethod: seed.checkOutMinute == null ? null : seed.checkOutMethod ?? "직접",
      standbyMinutes: seed.standbyMinutes ?? null,
      isFullAttendanceRecognized: seed.isFullAttendanceRecognized ?? false,
      isActive: seed.isActive ?? true,
      createdAt,
      updatedAt
    });
  }

  function findAttendanceByComposite(where: any) {
    const composite = where?.operatingMonthId_attendanceDate_employeeId;
    if (!composite) return null;
    return attendances.get(attendanceKey(toIsoDate(composite.attendanceDate), composite.employeeId)) ?? null;
  }

  const auditEvents: any[] = [];

  function cloneState() {
    return {
      requests: new Map([...requests.entries()].map(([key, value]) => [key, { ...value }])),
      plannedWorkingDays: new Map([...plannedWorkingDays.entries()].map(([key, value]) => [key, { ...value }])),
      attendances: new Map([...attendances.entries()].map(([key, value]) => [key, { ...value }])),
      auditLength: auditEvents.length
    };
  }
  function restoreState(snapshot: ReturnType<typeof cloneState>) {
    requests.clear();
    for (const [key, value] of snapshot.requests.entries()) requests.set(key, value);
    plannedWorkingDays.clear();
    for (const [key, value] of snapshot.plannedWorkingDays.entries()) plannedWorkingDays.set(key, value);
    attendances.clear();
    for (const [key, value] of snapshot.attendances.entries()) attendances.set(key, value);
    auditEvents.splice(snapshot.auditLength);
  }

  function withEmployee(request: any) {
    const employee = employees.get(request.employeeId);
    return { ...request, employee: employee ? { displayName: employee.displayName, staffCode: employee.staffCode } : null };
  }

  const client: any = {
    timeSlot: {
      async findMany() {
        return [{ value: "11:00", sortOrder: 10, createdAt, isActive: true }];
      }
    },
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()].filter((record) => where?.isActive === undefined || record.isActive === where.isActive);
      },
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    // 09: requestTherapistCorrection·approveTherapistCorrectionRequest가 날짜로 직접 찾고(monthKey),
    // upsertTherapistAttendance가 그 안에서 다시 id로 찾는다.
    operatingMonth: {
      async findUnique({ where }: any) {
        if (where?.id !== undefined) return where.id === operatingMonth.id ? operatingMonth : null;
        if (where?.monthKey !== undefined) return where.monthKey === operatingMonth.monthKey ? operatingMonth : null;
        return null;
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter((record) => {
          if (where?.employeeId !== undefined && record.employeeId !== where.employeeId) return false;
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
          return true;
        });
      },
      async findUnique({ where }: any) {
        return findAttendanceByComposite(where);
      },
      async upsert({ where, create, update }: any) {
        const existing = findAttendanceByComposite(where);
        const key = attendanceKey(toIsoDate(create.attendanceDate), create.employeeId);
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
        const existing = findAttendanceByComposite(where);
        if (!existing) throw new Error("Record to update not found.");
        const composite = where.operatingMonthId_attendanceDate_employeeId;
        const key = attendanceKey(toIsoDate(composite.attendanceDate), composite.employeeId);
        const next = { ...existing, ...data, updatedAt };
        attendances.set(key, next);
        return next;
      }
    },
    plannedWorkingDay: {
      async findMany({ where }: any = {}) {
        return [...plannedWorkingDays.values()].filter((record) => {
          if (where?.employeeId !== undefined) {
            if (where.employeeId.in !== undefined) {
              if (!where.employeeId.in.includes(record.employeeId)) return false;
            } else if (record.employeeId !== where.employeeId) {
              return false;
            }
          }
          if (where?.workDate !== undefined && toIsoDate(record.workDate) !== toIsoDate(where.workDate)) return false;
          return true;
        });
      },
      async findUnique({ where }: any) {
        const composite = where.employeeId_workDate;
        return plannedWorkingDays.get(`${composite.employeeId}::${toIsoDate(composite.workDate)}`) ?? null;
      },
      async upsert({ where, create, update }: any) {
        const composite = where.employeeId_workDate;
        const key = `${composite.employeeId}::${toIsoDate(composite.workDate)}`;
        const existing = plannedWorkingDays.get(key);
        if (existing) {
          const next = { ...existing, ...update, updatedAt };
          plannedWorkingDays.set(key, next);
          return next;
        }
        const record = { id: `pwd-${plannedWorkingDays.size + 1}`, ...create, createdAt, updatedAt };
        plannedWorkingDays.set(key, record);
        return record;
      },
      async delete({ where }: any) {
        const composite = where.employeeId_workDate;
        const key = `${composite.employeeId}::${toIsoDate(composite.workDate)}`;
        const existing = plannedWorkingDays.get(key);
        plannedWorkingDays.delete(key);
        return existing;
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return serviceCalls.filter((call) => where?.serviceDate === undefined || toIsoDate(call.serviceDate) === toIsoDate(where.serviceDate));
      }
    },
    therapistRequest: {
      async create({ data }: any) {
        const id = `req-${requests.size + 1}`;
        const record = { id, requestedCheckInTime: null, requestedCheckOutTime: null, reason: null, status: "대기", resolutionReason: null, resolvedByAccountId: null, resolvedAt: null, createdAt: new Date(createdAt.getTime() + sequence++ * 1000), updatedAt, ...data };
        requests.set(id, record);
        return withEmployee(record);
      },
      async findMany({ where }: any = {}) {
        return [...requests.values()]
          .filter((record) => {
            if (where?.employeeId !== undefined && record.employeeId !== where.employeeId) return false;
            if (where?.kind !== undefined && record.kind !== where.kind) return false;
            if (where?.status !== undefined && record.status !== where.status) return false;
            if (where?.targetDate !== undefined) {
              if (where.targetDate.gte !== undefined || where.targetDate.lte !== undefined) {
                const iso = toIsoDate(record.targetDate);
                if (where.targetDate.gte !== undefined && iso < toIsoDate(where.targetDate.gte)) return false;
                if (where.targetDate.lte !== undefined && iso > toIsoDate(where.targetDate.lte)) return false;
              } else if (toIsoDate(record.targetDate) !== toIsoDate(where.targetDate)) {
                return false;
              }
            }
            return true;
          })
          .map(withEmployee);
      },
      async findUnique({ where }: any) {
        const record = requests.get(where.id);
        return record ? withEmployee(record) : null;
      },
      async update({ where, data }: any) {
        const existing = requests.get(where.id);
        if (!existing) throw new Error("Record to update does not exist.");
        const next = { ...existing, ...data, updatedAt };
        requests.set(where.id, next);
        return withEmployee(next);
      },
      async count({ where }: any = {}) {
        return [...requests.values()].filter((record) => where?.status === undefined || record.status === where.status).length;
      }
    },
    userAccount: {
      async findMany({ where }: any = {}) {
        const ids: string[] = where?.OR?.[0]?.id?.in ?? [];
        const accountIds: string[] = where?.OR?.[1]?.accountId?.in ?? [];
        return [...userAccounts.values()].filter((account) => ids.includes(account.id) || accountIds.includes(account.accountId));
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
      const snapshot = cloneState();
      const { $transaction: _omit, ...tx } = client;
      try {
        return await callback(tx);
      } catch (error) {
        restoreState(snapshot);
        throw error;
      }
    },
    requests,
    plannedWorkingDays,
    attendances,
    auditEvents
  };

  return client;
}

describe("requestTherapistDayOff", () => {
  it("creates a pending day-off request for a future date, reason optional", async () => {
    const client = createMemoryPrisma();
    const result = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", now, prismaClient: client });

    assert.equal(result.kind, "day_off");
    assert.equal(result.status, "pending");
    assert.equal(result.targetDate, "2042-08-15");
    assert.equal(result.reason, null);
    assert.equal(client.requests.size, 1);
    const stored = [...client.requests.values()][0];
    assert.equal(stored.kind, "휴무");
    assert.equal(stored.status, "대기");
  });

  it("keeps a trimmed reason", async () => {
    const client = createMemoryPrisma();
    const result = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", reason: "  병원 진료  ", now, prismaClient: client });
    assert.equal(result.reason, "병원 진료");
  });

  it("rejects a date before today's operating day", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(
      () => requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-09", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_DATE_IN_PAST");
        return true;
      }
    );
  });

  it("allows requesting today", async () => {
    const client = createMemoryPrisma();
    const result = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-10", now, prismaClient: client });
    assert.equal(result.status, "pending");
  });

  it("rejects a day that is already set to day off", async () => {
    const client = createMemoryPrisma({ seedPlannedWorkingDays: [{ employeeId: "emp-1", workDate: "2042-08-15", planStatus: "휴무" }] });
    await assert.rejects(
      () => requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_DAY_OFF_ALREADY_SET");
        return true;
      }
    );
  });

  it("rejects a date that already has a pending day-off request", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    await assert.rejects(
      () => requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_DAY_OFF_REQUEST_ALREADY_PENDING");
        return true;
      }
    );
  });

  it("allows a new request for a date whose earlier request was rejected", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "거절", resolutionReason: "콜 많음", resolvedByAccountId: "acct-admin", resolvedAt: now }]
    });
    const result = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", now, prismaClient: client });
    assert.equal(result.status, "pending");
  });
});

describe("requestTherapistCorrection", () => {
  it("creates a pending correction request with a checkout time only (missed clock-out)", async () => {
    const client = createMemoryPrisma();
    const result = await requestTherapistCorrection({
      employeeId: "emp-1",
      date: "2042-08-05",
      requestedCheckOutTime: "20:30",
      reason: "퇴근을 못 찍었습니다",
      now,
      prismaClient: client
    });

    assert.equal(result.kind, "correction");
    assert.equal(result.status, "pending");
    const stored = [...client.requests.values()][0];
    assert.equal(stored.kind, "정정");
    assert.equal(stored.requestedCheckInTime, null);
    assert.equal(stored.requestedCheckOutTime, "20:30");
    assert.equal(stored.reason, "퇴근을 못 찍었습니다");
  });

  it("creates a pending correction request with both times", async () => {
    const client = createMemoryPrisma();
    const result = await requestTherapistCorrection({
      employeeId: "emp-1",
      date: "2042-08-05",
      requestedCheckInTime: "09:50",
      requestedCheckOutTime: "20:30",
      reason: "둘 다 늦게 찍었습니다",
      now,
      prismaClient: client
    });
    assert.equal(result.status, "pending");
    const stored = [...client.requests.values()][0];
    assert.equal(stored.requestedCheckInTime, "09:50");
    assert.equal(stored.requestedCheckOutTime, "20:30");
  });

  it("rejects when neither check-in nor check-out time is given", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_CORRECTION_TIME_REQUIRED");
        return true;
      }
    );
  });

  it("rejects an empty reason", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", requestedCheckOutTime: "20:30", reason: "   ", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "INVALID_THERAPIST_REQUEST_INPUT");
        assert.equal(error.field, "reason");
        return true;
      }
    );
  });

  it("rejects a malformed check-in time", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", requestedCheckInTime: "9:5", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "INVALID_THERAPIST_REQUEST_INPUT");
        return true;
      }
    );
  });

  it("rejects a date in a locked operating month", async () => {
    const client = createMemoryPrisma({ monthStatus: "잠금" });
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", requestedCheckOutTime: "20:30", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "OPERATING_MONTH_LOCKED");
        return true;
      }
    );
  });

  it("rejects a date in a finalized (마감확정) operating month", async () => {
    const client = createMemoryPrisma({ monthStatus: "마감확정" });
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", requestedCheckOutTime: "20:30", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "OPERATING_MONTH_LOCKED");
        return true;
      }
    );
  });

  it("rejects a date that already has a pending correction request", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00" }]
    });
    await assert.rejects(
      () => requestTherapistCorrection({ employeeId: "emp-1", date: "2042-08-05", requestedCheckOutTime: "20:30", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_CORRECTION_REQUEST_ALREADY_PENDING");
        return true;
      }
    );
  });

  it("does not block on a pending day-off request for the same date (dedup is kind-scoped)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-05", status: "대기" }]
    });
    const result = await requestTherapistCorrection({
      employeeId: "emp-1",
      date: "2042-08-05",
      requestedCheckOutTime: "20:30",
      reason: "사유",
      now,
      prismaClient: client
    });
    assert.equal(result.status, "pending");
  });

  it("allows a new correction request for a date whose earlier one was rejected", async () => {
    const client = createMemoryPrisma({
      seedRequests: [
        { id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "거절", resolutionReason: "다른 시각이 맞음", resolvedByAccountId: "acct-admin", resolvedAt: now, requestedCheckOutTime: "20:00" }
      ]
    });
    const result = await requestTherapistCorrection({
      employeeId: "emp-1",
      date: "2042-08-05",
      requestedCheckOutTime: "20:30",
      reason: "사유",
      now,
      prismaClient: client
    });
    assert.equal(result.status, "pending");
  });
});

describe("cancelTherapistRequest", () => {
  it("cancels a pending request and records who canceled it", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    const result = await cancelTherapistRequest({ employeeId: "emp-1", requestId: "req-1", actorAccountId: "acct-emp-1", now, prismaClient: client });

    assert.equal(result.status, "canceled");
    const stored = client.requests.get("req-1");
    assert.equal(stored.status, "취소");
    assert.equal(stored.resolvedByAccountId, "acct-emp-1");
    assert.deepEqual(stored.resolvedAt, now);
  });

  it("does not reveal whether a request belongs to someone else or does not exist", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-other", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    await assert.rejects(
      () => cancelTherapistRequest({ employeeId: "emp-1", requestId: "req-1", actorAccountId: "acct-emp-1", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_NOT_FOUND");
        return true;
      }
    );
  });

  it("rejects canceling an already-resolved request", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "승인", resolvedByAccountId: "acct-admin", resolvedAt: now }]
    });
    await assert.rejects(
      () => cancelTherapistRequest({ employeeId: "emp-1", requestId: "req-1", actorAccountId: "acct-emp-1", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_NOT_CANCELABLE");
        return true;
      }
    );
  });

  it("rejects canceling a pending request whose date already passed", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-01", status: "대기" }] });
    await assert.rejects(
      () => cancelTherapistRequest({ employeeId: "emp-1", requestId: "req-1", actorAccountId: "acct-emp-1", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_NOT_CANCELABLE");
        return true;
      }
    );
  });
});

describe("cancelTherapistDayOffRequestForDate (근태 달력이 신청 id 없이 날짜만 아는 자리용)", () => {
  it("finds the pending day-off request for that date and cancels it", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    const result = await cancelTherapistDayOffRequestForDate({ employeeId: "emp-1", date: "2042-08-15", actorAccountId: "acct-emp-1", now, prismaClient: client });
    assert.equal(result.status, "canceled");
    assert.equal(client.requests.get("req-1").status, "취소");
  });

  it("rejects when there is no pending request for that date", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(
      () => cancelTherapistDayOffRequestForDate({ employeeId: "emp-1", date: "2042-08-15", actorAccountId: "acct-emp-1", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_NOT_FOUND");
        return true;
      }
    );
  });
});

describe("listTherapistRequestsForAdmin", () => {
  it("puts pending (including expired) requests above resolved ones, nearest date first", async () => {
    const client = createMemoryPrisma({
      seedRequests: [
        { id: "req-approved", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-05", status: "승인", resolvedByAccountId: "acct-admin", resolvedAt: new Date("2042-08-04T00:00:00.000Z") },
        { id: "req-expired", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-01", status: "대기" },
        { id: "req-pending-later", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-20", status: "대기" },
        { id: "req-pending-soon", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-12", status: "대기" }
      ]
    });

    const rows = await listTherapistRequestsForAdmin({ now, prismaClient: client });

    assert.deepEqual(rows.map((row) => row.id), ["req-expired", "req-pending-soon", "req-pending-later", "req-approved"]);
    assert.equal(rows.find((row) => row.id === "req-expired")?.status, "expired");
    assert.equal(rows.find((row) => row.id === "req-approved")?.status, "approved");
  });

  it("resolves the acting account to a display name, and counts assigned calls only for pending day-off rows", async () => {
    const client = createMemoryPrisma({
      seedRequests: [
        { id: "req-pending", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" },
        { id: "req-rejected", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-04", status: "거절", resolutionReason: "콜 많음", resolvedByAccountId: "acct-admin", resolvedAt: now }
      ],
      seedServiceCalls: [
        { id: "call-1", serviceDate: "2042-08-15", employeeId: "emp-1" },
        { id: "call-2", serviceDate: "2042-08-15", employeeId: "emp-1" }
      ]
    });

    const rows = await listTherapistRequestsForAdmin({ now, prismaClient: client });

    const pending = rows.find((row) => row.id === "req-pending");
    assert.equal(pending?.assignedCallCount, 2);

    const rejected = rows.find((row) => row.id === "req-rejected");
    assert.equal(rejected?.assignedCallCount, null);
    assert.equal(rejected?.resolvedByName, "박관리");
    assert.equal(rejected?.resolutionReason, "콜 많음");
  });

  it("shows a pending correction request with a past target date as pending, not expired (09: M24's 기한 지남 rule is day-off only)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-01", status: "대기", requestedCheckOutTime: "20:00" }]
    });
    const rows = await listTherapistRequestsForAdmin({ now, prismaClient: client });
    assert.equal(rows.find((row) => row.id === "req-1")?.status, "pending");
  });
});

describe("approveTherapistDayOffRequest", () => {
  it("approves, sets the day to day-off through the schedule service, and records both audits in one transaction", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });

    const result = await approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });

    assert.equal(result.status, "approved");
    const storedRequest = client.requests.get("req-1");
    assert.equal(storedRequest.status, "승인");
    assert.equal(storedRequest.resolvedByAccountId, "acct-admin");

    const storedCell = client.plannedWorkingDays.get("emp-1::2042-08-15");
    assert.equal(storedCell.planStatus, "휴무");

    const actions = client.auditEvents.map((event: any) => event.action);
    assert.ok(actions.includes("therapist_request.approved"));
    assert.ok(actions.includes("planned_working_day.created"));
  });

  it("does not block approval when calls are already assigned that day (assumption)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }],
      seedServiceCalls: [{ id: "call-1", serviceDate: "2042-08-15", employeeId: "emp-1" }]
    });
    const result = await approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });
    assert.equal(result.status, "approved");
  });

  it("rejects approving a request that was already resolved", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "취소", resolvedByAccountId: "acct-emp-1", resolvedAt: now }]
    });
    await assert.rejects(
      () => approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_ALREADY_RESOLVED");
        return true;
      }
    );
  });

  it("rejects approving a request whose date already passed", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-01", status: "대기" }] });
    await assert.rejects(
      () => approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_EXPIRED");
        return true;
      }
    );
  });

  it("rejects approving a correction-kind request (handled by approveTherapistCorrectionRequest instead)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-15", status: "대기", requestedCheckInTime: "10:00" }]
    });
    await assert.rejects(
      () => approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_KIND_NOT_SUPPORTED");
        return true;
      }
    );
  });

  it("rolls back the request status if the audit write fails", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }], failAudit: true });
    await assert.rejects(() => approveTherapistDayOffRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }));

    assert.equal(client.requests.get("req-1").status, "대기");
    assert.equal(client.plannedWorkingDays.has("emp-1::2042-08-15"), false);
  });
});

describe("approveTherapistCorrectionRequest", () => {
  it("saves the requested check-out time as '정정 승인' while leaving the untouched check-in method as-is", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00", reason: "퇴근을 못 찍었습니다" }],
      // 10시간(600분) 경계를 넘기려고 09:00 출근 + 20:00 퇴근(660분)으로 둔다.
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-05", checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null }]
    });

    const result = await approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });

    assert.equal(result.status, "approved");
    assert.equal(client.requests.get("req-1").status, "승인");

    const stored = client.attendances.get(attendanceMapKey("2042-08-05", "emp-1"));
    assert.equal(stored.checkInMinute, 9 * 60);
    assert.equal(stored.checkInMethod, "직접", "바뀌지 않은 출근 방식은 그대로 지켜야 한다(M23)");
    assert.equal(stored.checkOutMinute, 20 * 60);
    assert.equal(stored.checkOutMethod, "정정 승인");
    assert.equal(stored.standbyMinutes, 660);
    assert.equal(stored.isFullAttendanceRecognized, true, "10시간 이상이면 만근 재판정이 켜져야 한다");

    const actions = client.auditEvents.map((event: any) => event.action);
    assert.ok(actions.includes("therapist_request.approved"));
    assert.ok(actions.includes("therapist_attendance.changed"));
  });

  it("saves a corrected check-in time while leaving the untouched check-out method as-is", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckInTime: "09:00" }],
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-05", checkInMinute: 9 * 60 + 30, checkInMethod: "직접", checkOutMinute: 18 * 60, checkOutMethod: "대리 입력" }]
    });

    await approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });

    const stored = client.attendances.get(attendanceMapKey("2042-08-05", "emp-1"));
    assert.equal(stored.checkInMinute, 9 * 60);
    assert.equal(stored.checkInMethod, "정정 승인");
    assert.equal(stored.checkOutMinute, 18 * 60);
    assert.equal(stored.checkOutMethod, "대리 입력", "바뀌지 않은 퇴근 방식은 그대로 지켜야 한다(M23)");
  });

  it("saves a missed check-in and check-out together when no row exists yet", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckInTime: "09:00", requestedCheckOutTime: "18:00" }]
    });

    await approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });

    const stored = client.attendances.get(attendanceMapKey("2042-08-05", "emp-1"));
    assert.equal(stored.checkInMinute, 9 * 60);
    assert.equal(stored.checkInMethod, "정정 승인");
    assert.equal(stored.checkOutMinute, 18 * 60);
    assert.equal(stored.checkOutMethod, "정정 승인");
  });

  it("rejects approving a day-off-kind request (handled by approveTherapistDayOffRequest instead)", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-05", status: "대기" }] });
    await assert.rejects(
      () => approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_KIND_NOT_SUPPORTED");
        return true;
      }
    );
  });

  it("rejects approving a request that was already resolved", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "취소", resolvedByAccountId: "acct-emp-1", resolvedAt: now, requestedCheckOutTime: "20:00" }]
    });
    await assert.rejects(
      () => approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_ALREADY_RESOLVED");
        return true;
      }
    );
  });

  it("does not treat a past target date as expired (unlike day-off, M24 has no 기한 지남 rule for corrections)", async () => {
    // 정정은 애초에 이미 지난 날짜를 고치는 일이다 — assertActionable이 day-off의 "기한 지남"
    // 규칙을 그대로 적용하면 모든 정정 요청이 대기 상태가 되는 즉시 처리할 수 없게 된다.
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-01", status: "대기", requestedCheckOutTime: "20:00" }],
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-01", checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null }]
    });
    const result = await approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });
    assert.equal(result.status, "approved");
  });

  it("rejects approval once the operating month has since been locked (fails the same way a direct correction would)", async () => {
    const client = createMemoryPrisma({
      monthStatus: "잠금",
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00" }],
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-05", checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null }]
    });
    await assert.rejects(
      () => approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistAttendanceDomainError);
        assert.equal(error.code, "OPERATING_MONTH_LOCKED");
        return true;
      }
    );
    assert.equal(client.requests.get("req-1").status, "대기", "출퇴근 저장이 거절되면 신청 상태도 롤백돼야 한다");
  });

  it("rejects approval when there is no existing check-in and the request only corrects check-out (must reject and fix via 대리 입력 instead)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00" }]
      // 출근 기록 자체가 없다(seedAttendances 없음) — 코드베이스 지도 6절 함정.
    });
    await assert.rejects(
      () => approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_CORRECTION_CHECK_IN_REQUIRED");
        return true;
      }
    );
  });

  it("rolls back both the request status and the attendance write if the audit write fails", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00" }],
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-05", checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null }],
      failAudit: true
    });
    await assert.rejects(() => approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client }));

    assert.equal(client.requests.get("req-1").status, "대기");
    assert.equal(client.attendances.get(attendanceMapKey("2042-08-05", "emp-1")).checkOutMinute, null);
  });

  it("never reads or writes a settlement/payout model, so a confirmed day's payout amount cannot change (ADR 0004)", async () => {
    // 이 메모리 Prisma에는 정산·지급 확인 모델이 전혀 없다(course·coursePolicy·dailySettlement류가
    // 없음) — 승인 경로가 그 계산을 조금이라도 불렀다면 이 테스트는 "X.findMany is not a function"
    // 같은 오류로 바로 실패했을 것이다. 날짜별 지급 확인 금액(코스 수당)은 출퇴근을 읽지 않고
    // 계산되므로(therapist-daily-settlement-service.ts에 attendance 참조가 없다, 07이 이미 코드로
    // 확인함 — merged-07.md) 정정 승인은 그 금액을 바꿀 수 없다.
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-05", status: "대기", requestedCheckOutTime: "20:00" }],
      seedAttendances: [{ employeeId: "emp-1", attendanceDate: "2042-08-05", checkInMinute: 9 * 60, checkInMethod: "직접", checkOutMinute: null }]
    });
    const result = await approveTherapistCorrectionRequest({ requestId: "req-1", actorId: "acct-admin", now, prismaClient: client });
    assert.equal(result.status, "approved");
  });
});

describe("rejectTherapistRequest", () => {
  it("requires a reason", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    await assert.rejects(
      () => rejectTherapistRequest({ requestId: "req-1", actorId: "acct-admin", reason: "   ", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_REJECTION_REASON_REQUIRED");
        return true;
      }
    );
  });

  it("rejects the request with a reason and records the audit", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" }] });
    const result = await rejectTherapistRequest({ requestId: "req-1", actorId: "acct-admin", reason: "그날은 예약이 많습니다", now, prismaClient: client });

    assert.equal(result.status, "rejected");
    assert.equal(result.resolutionReason, "그날은 예약이 많습니다");
    assert.equal(result.resolvedByName, "박관리");
    assert.ok(client.auditEvents.some((event: any) => event.action === "therapist_request.rejected"));
    // 거절은 휴무·정정 둘 다에 쓰므로 근무표를 건드리지 않는다.
    assert.equal(client.plannedWorkingDays.size, 0);
  });

  it("also rejects a correction-kind request (kind-agnostic, for ticket 09)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-15", status: "대기", requestedCheckInTime: "10:00" }]
    });
    const result = await rejectTherapistRequest({ requestId: "req-1", actorId: "acct-admin", reason: "다른 시각이 맞습니다", now, prismaClient: client });
    assert.equal(result.kind, "correction");
    assert.equal(result.status, "rejected");
  });

  it("rejects a correction-kind request with a past target date (09: M24's 기한 지남 rule is day-off only)", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "정정", targetDate: "2042-08-01", status: "대기", requestedCheckOutTime: "20:00" }]
    });
    const result = await rejectTherapistRequest({ requestId: "req-1", actorId: "acct-admin", reason: "다른 시각이 맞습니다", now, prismaClient: client });
    assert.equal(result.status, "rejected");
  });

  it("rejects rejecting an already-resolved request", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "승인", resolvedByAccountId: "acct-admin", resolvedAt: now }]
    });
    await assert.rejects(
      () => rejectTherapistRequest({ requestId: "req-1", actorId: "acct-admin", reason: "사유", now, prismaClient: client }),
      (error: unknown) => {
        assert.ok(error instanceof TherapistRequestDomainError);
        assert.equal(error.code, "THERAPIST_REQUEST_ALREADY_RESOLVED");
        return true;
      }
    );
  });
});

describe("listTherapistRequestsForEmployeeInRange (근태 달력 06이 쓰는 자리)", () => {
  it("shows a pending request over an earlier rejected one for the same date", async () => {
    const client = createMemoryPrisma({
      seedRequests: [
        { id: "req-rejected", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "거절", resolutionReason: "콜 많음", resolvedByAccountId: "acct-admin", resolvedAt: now, createdAt: new Date("2042-08-01T00:00:00.000Z") },
        { id: "req-pending", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기", createdAt: new Date("2042-08-05T00:00:00.000Z") }
      ]
    });

    const rows = await listTherapistRequestsForEmployeeInRange({ employeeId: "emp-1", startDate: "2042-08-01", endDate: "2042-08-31", now, prismaClient: client });
    assert.deepEqual(rows, [{ targetDate: "2042-08-15", kind: "day_off", status: "pending", rejectionReason: null }]);
  });

  it("marks a pending request whose date already passed as expired", async () => {
    const client = createMemoryPrisma({ seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-01", status: "대기" }] });
    const rows = await listTherapistRequestsForEmployeeInRange({ employeeId: "emp-1", startDate: "2042-08-01", endDate: "2042-08-31", now, prismaClient: client });
    assert.deepEqual(rows, [{ targetDate: "2042-08-01", kind: "day_off", status: "expired", rejectionReason: null }]);
  });

  it("shows the rejection reason for a rejected request", async () => {
    const client = createMemoryPrisma({
      seedRequests: [{ id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-05", status: "거절", resolutionReason: "콜 많음", resolvedByAccountId: "acct-admin", resolvedAt: now }]
    });
    const rows = await listTherapistRequestsForEmployeeInRange({ employeeId: "emp-1", startDate: "2042-08-01", endDate: "2042-08-31", now, prismaClient: client });
    assert.deepEqual(rows, [{ targetDate: "2042-08-05", kind: "day_off", status: "rejected", rejectionReason: "콜 많음" }]);
  });
});

describe("countPendingTherapistRequests", () => {
  it("counts only pending requests, including ones whose date already passed", async () => {
    const client = createMemoryPrisma({
      seedRequests: [
        { id: "req-1", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-15", status: "대기" },
        { id: "req-2", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-01", status: "대기" },
        { id: "req-3", employeeId: "emp-1", kind: "휴무", targetDate: "2042-08-05", status: "승인", resolvedByAccountId: "acct-admin", resolvedAt: now }
      ]
    });
    assert.equal(await countPendingTherapistRequests({ prismaClient: client }), 2);
  });
});
