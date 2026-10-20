import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TherapistRequestDomainError,
  approveTherapistDayOffRequest,
  cancelTherapistDayOffRequestForDate,
  cancelTherapistRequest,
  countPendingTherapistRequests,
  listApprovedSpecialDayOffs,
  listTherapistRequestsForAdmin,
  listTherapistRequestsForEmployeeInRange,
  rejectTherapistRequest,
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

// now는 UTC+7(영업 시간대)에서 2042-08-10 15:00이라 운영일은 2042-08-10이다(dayStart "11:00"보다 늦다).
const now = new Date("2042-08-10T08:00:00.000Z");

/**
 * 티켓 08 테스트용 메모리 Prisma. 신청(therapistRequest) + 승인이 그대로 부르는 근무표
 * (plannedWorkingDay·employee) + 콜(serviceCall, 배정 수) + 감사(auditLog) + 행위자 이름
 * (userAccount)를 모두 둔다(createMemoryPrisma는 공용 모듈이 아니다, 코드베이스 지도 14절).
 * $transaction은 schedule-service.test.ts와 같은 모양으로 실패 시 되돌린다.
 */
function createMemoryPrisma(
  options: {
    seedRequests?: Array<{
      id: string;
      employeeId: string;
      kind: "휴무" | "소중한날 휴가" | "정정";
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

  const auditEvents: any[] = [];

  function cloneState() {
    return {
      requests: new Map([...requests.entries()].map(([key, value]) => [key, { ...value }])),
      plannedWorkingDays: new Map([...plannedWorkingDays.entries()].map(([key, value]) => [key, { ...value }])),
      auditLength: auditEvents.length
    };
  }
  function restoreState(snapshot: ReturnType<typeof cloneState>) {
    requests.clear();
    for (const [key, value] of snapshot.requests.entries()) requests.set(key, value);
    plannedWorkingDays.clear();
    for (const [key, value] of snapshot.plannedWorkingDays.entries()) plannedWorkingDays.set(key, value);
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
            if (typeof where?.employeeId === "string" && record.employeeId !== where.employeeId) return false;
            if (where?.employeeId?.in && !where.employeeId.in.includes(record.employeeId)) return false;
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

  it("rejects approving a correction-kind request (not supported yet, ticket 09)", async () => {
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


describe("소중한날 휴가", () => {
  it("can be requested on the current service date and approved as ordinary day-off without fabricating attendance", async () => {
    const client = createMemoryPrisma();
    const request = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-10", kind: "special_day_off", now, prismaClient: client });
    assert.equal(request.kind, "special_day_off");
    assert.equal(client.requests.get(request.id).kind, "소중한날 휴가");
    const approved = await approveTherapistDayOffRequest({ requestId: request.id, actorId: "acct-admin", now, prismaClient: client });
    assert.equal(approved.kind, "special_day_off");
    assert.equal(approved.status, "approved");
    assert.equal(client.plannedWorkingDays.get("emp-1::2042-08-10").planStatus, "휴무");
    assert.ok(client.auditEvents.some((event: any) => event.action === "therapist_request.approved"));
    assert.deepEqual(await listApprovedSpecialDayOffs({ employeeIds: ["emp-1"], startDate: "2042-08-10", endDate: "2042-08-10", prismaClient: client }), [{ employeeId: "emp-1", date: "2042-08-10" }]);
    assert.deepEqual(await listApprovedSpecialDayOffs({ employeeIds: ["someone-else"], startDate: "2042-08-10", endDate: "2042-08-10", prismaClient: client }), []);
  });

  it("shares duplicate protection with ordinary day-off, and can be canceled from the calendar", async () => {
    const client = createMemoryPrisma();
    const request = await requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", kind: "special_day_off", now, prismaClient: client });
    await assert.rejects(() => requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", now, prismaClient: client }), { code: "THERAPIST_DAY_OFF_REQUEST_ALREADY_PENDING" });
    const canceled = await cancelTherapistDayOffRequestForDate({ employeeId: "emp-1", date: "2042-08-15", actorAccountId: "acct-emp-1", now, prismaClient: client });
    assert.equal(canceled.id, request.id);
    assert.equal(canceled.kind, "special_day_off");
    assert.equal(canceled.status, "canceled");
    assert.deepEqual(await listApprovedSpecialDayOffs({ employeeIds: ["emp-1"], startDate: "2042-08-10", endDate: "2042-08-31", prismaClient: client }), []);
  });

  it("rejects an unsupported leave kind before storing any request", async () => {
    const client = createMemoryPrisma();
    await assert.rejects(() => requestTherapistDayOff({ employeeId: "emp-1", date: "2042-08-15", kind: "correction", now, prismaClient: client }), { code: "INVALID_THERAPIST_REQUEST_INPUT" });
    assert.equal(client.requests.size, 0);
  });
});
