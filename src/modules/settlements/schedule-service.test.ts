import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ScheduleDomainError,
  listPlannedWorkingDayStatusesForDate,
  listPlannedWorkingDaysForWeek,
  setPlannedWorkingDay
} from "@/modules/settlements/schedule-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toIsoDate(value: Date | string) {
  return typeof value === "string" ? value : value.toISOString().slice(0, 10);
}

function cellKey(employeeId: string, workDate: string) {
  return `${employeeId}::${workDate}`;
}

function createMemoryPrisma(
  options: {
    failAudit?: boolean;
    seedCells?: Array<{ id: string; employeeId: string; workDate: string; planStatus: string }>;
  } = {}
) {
  const createdAt = new Date("2026-10-10T00:00:00.000Z");
  const updatedAt = new Date("2026-10-10T00:10:00.000Z");

  function employee(id: string, staffCode: string, displayName: string, sortOrder: number, isActive: boolean, group: string) {
    return { id, staffCode, displayName, employeeGroup: group, position: "직원", sortOrder, isActive, createdAt, updatedAt };
  }

  const employees = new Map<string, any>();
  employees.set("thr-1", employee("thr-1", "THR-001", "마사지사1", 10, true, "THERAPIST"));
  employees.set("thr-2", employee("thr-2", "THR-002", "마사지사2", 20, true, "THERAPIST"));
  employees.set("thr-inactive", employee("thr-inactive", "THR-999", "퇴사 마사지사", 998, false, "THERAPIST"));
  employees.set("ear-1", employee("ear-1", "EAR-001", "귀케어1", 10, true, "EARCARE"));
  employees.set("ops-1", employee("ops-1", "OPS-001", "팀장", 10, true, "OPERATIONS"));

  const cells = new Map<string, any>();
  for (const seed of options.seedCells ?? []) {
    cells.set(cellKey(seed.employeeId, seed.workDate), {
      id: seed.id,
      employeeId: seed.employeeId,
      workDate: dbDate(seed.workDate),
      planStatus: seed.planStatus,
      createdAt,
      updatedAt
    });
  }
  const auditEvents: any[] = [];

  function cloneCells() {
    return new Map([...cells.entries()].map(([key, value]) => [key, { ...value }]));
  }
  function restoreCells(snapshot: Map<string, any>) {
    cells.clear();
    for (const [key, value] of snapshot.entries()) cells.set(key, value);
  }

  function findCellByComposite(where: any) {
    const composite = where?.employeeId_workDate;
    if (!composite) return null;
    const key = cellKey(composite.employeeId, toIsoDate(composite.workDate));
    return cells.get(key) ?? null;
  }

  const client: any = {
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter((record) => where?.isActive === undefined || record.isActive === where.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.id.localeCompare(b.id));
      },
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    plannedWorkingDay: {
      async findMany({ where }: any = {}) {
        return [...cells.values()].filter((record) => {
          if (where?.employeeId !== undefined) {
            if (where.employeeId.in !== undefined) {
              if (!where.employeeId.in.includes(record.employeeId)) return false;
            } else if (record.employeeId !== where.employeeId) {
              return false;
            }
          }
          if (where?.workDate !== undefined) {
            if (where.workDate?.gte !== undefined || where.workDate?.lte !== undefined) {
              const iso = toIsoDate(record.workDate);
              if (where.workDate.gte !== undefined && iso < toIsoDate(where.workDate.gte)) return false;
              if (where.workDate.lte !== undefined && iso > toIsoDate(where.workDate.lte)) return false;
            } else if (toIsoDate(record.workDate) !== toIsoDate(where.workDate)) {
              return false;
            }
          }
          return true;
        });
      },
      async findUnique({ where }: any) {
        return findCellByComposite(where);
      },
      async upsert({ where, create, update }: any) {
        const existing = findCellByComposite(where);
        const key = cellKey(create.employeeId, toIsoDate(create.workDate));
        if (existing) {
          const next = { ...existing, ...update, updatedAt };
          cells.set(key, next);
          return next;
        }
        const record = { id: `pwd-${cells.size + 1}`, ...create, createdAt, updatedAt };
        cells.set(key, record);
        return record;
      },
      async delete({ where }: any) {
        const existing = findCellByComposite(where);
        if (!existing) throw new Error("Record to delete does not exist.");
        const composite = where.employeeId_workDate;
        cells.delete(cellKey(composite.employeeId, toIsoDate(composite.workDate)));
        return existing;
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
      const snapshot = cloneCells();
      const auditSnapshotLength = auditEvents.length;
      try {
        return await callback(client);
      } catch (error) {
        restoreCells(snapshot);
        auditEvents.splice(auditSnapshotLength);
        throw error;
      }
    },
    cells,
    auditEvents
  };

  return client;
}

describe("schedule service", () => {
  it("월요일이 아닌 날짜를 줘도 그 날짜가 속한 월요일 시작 7일을 돌려준다", async () => {
    const result = await listPlannedWorkingDaysForWeek({
      date: "2026-10-14", // 수요일
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.weekStartDate, "2026-10-12"); // 월요일
    assert.equal(result.weekEndDate, "2026-10-18"); // 일요일
    assert.deepEqual(result.dates, [
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18"
    ]);
  });

  it("달 경계를 넘는 주도 날짜 기준으로 그대로 7일을 돌려준다", async () => {
    const result = await listPlannedWorkingDaysForWeek({
      date: "2026-01-29", // 목요일, 그 주는 1월 26일(월)부터 2월 1일(일)까지
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.weekStartDate, "2026-01-26");
    assert.equal(result.weekEndDate, "2026-02-01");
  });

  it("세 직군의 활성 직원을 직군별로 묶고, 기록이 없는 칸은 미입력이다", async () => {
    const result = await listPlannedWorkingDaysForWeek({
      date: "2026-10-14",
      prismaClient: createMemoryPrisma()
    });

    assert.deepEqual(
      result.groups.map((group) => group.employeeGroup),
      ["OPERATIONS", "EARCARE", "THERAPIST"]
    );
    const therapistGroup = result.groups.find((group) => group.employeeGroup === "THERAPIST");
    assert.equal(therapistGroup?.employees.length, 2); // thr-inactive는 제외
    assert.equal(therapistGroup?.employees[0].employeeId, "thr-1");
    assert.equal(therapistGroup?.employees[0].days.length, 7);
    assert.ok(therapistGroup?.employees[0].days.every((day) => day.status === "미입력"));
  });

  it("기록된 근무 예정·휴무 칸을 그 날짜에 정확히 반영한다", async () => {
    const result = await listPlannedWorkingDaysForWeek({
      date: "2026-10-14",
      prismaClient: createMemoryPrisma({
        seedCells: [
          { id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-12", planStatus: "근무 예정" },
          { id: "pwd-2", employeeId: "thr-1", workDate: "2026-10-14", planStatus: "휴무" }
        ]
      })
    });

    const therapist1 = result.groups.find((group) => group.employeeGroup === "THERAPIST")?.employees[0];
    assert.equal(therapist1?.days.find((day) => day.date === "2026-10-12")?.status, "근무 예정");
    assert.equal(therapist1?.days.find((day) => day.date === "2026-10-14")?.status, "휴무");
    assert.equal(therapist1?.days.find((day) => day.date === "2026-10-13")?.status, "미입력");
  });

  it("미입력 칸을 근무 예정으로 설정하면 생성 감사 기록을 남긴다", async () => {
    const client = createMemoryPrisma();
    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "근무 예정",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.equal(result.status, "근무 예정");
    assert.equal(client.auditEvents.length, 1);
    assert.equal(client.auditEvents[0].action, "planned_working_day.created");
    assert.equal(client.auditEvents[0].actorId, "acc-1");
    assert.deepEqual(client.auditEvents[0].beforeValue, { employeeId: "thr-1", date: "2026-10-14", status: "미입력" });
    assert.deepEqual(client.auditEvents[0].afterValue, { employeeId: "thr-1", date: "2026-10-14", status: "근무 예정" });
  });

  it("근무 예정을 휴무로 바꾸면 변경 감사 기록을 남긴다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-14", planStatus: "근무 예정" }]
    });

    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "휴무",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.equal(result.status, "휴무");
    assert.equal(client.auditEvents.length, 1);
    assert.equal(client.auditEvents[0].action, "planned_working_day.changed");
    assert.deepEqual(client.auditEvents[0].beforeValue, { employeeId: "thr-1", date: "2026-10-14", status: "근무 예정" });
  });

  it("미입력으로 설정하면 기존 칸을 지우고 콜은 그대로 둔다(서비스가 콜을 참조하지 않는다)", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-14", planStatus: "휴무" }]
    });

    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "미입력",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.equal(result.status, "미입력");
    assert.equal(client.cells.size, 0);
    assert.equal(client.auditEvents[0].action, "planned_working_day.cleared");
  });

  it("같은 값으로 다시 설정하면 감사 기록을 남기지 않는다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-14", planStatus: "휴무" }]
    });

    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "휴무",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.equal(result.status, "휴무");
    assert.equal(client.auditEvents.length, 0);
  });

  it("비활성 직원은 설정할 수 없다", async () => {
    await assert.rejects(
      setPlannedWorkingDay({
        employeeId: "thr-inactive",
        date: "2026-10-14",
        status: "근무 예정",
        actorId: "acc-1",
        prismaClient: createMemoryPrisma()
      }),
      (error: unknown) => {
        assert.ok(error instanceof ScheduleDomainError);
        assert.equal(error.code, "SCHEDULE_EMPLOYEE_NOT_FOUND");
        return true;
      }
    );
  });

  it("날짜 형식이 올바르지 않으면 거절한다", async () => {
    await assert.rejects(
      setPlannedWorkingDay({
        employeeId: "thr-1",
        date: "2026-02-30",
        status: "근무 예정",
        actorId: "acc-1",
        prismaClient: createMemoryPrisma()
      }),
      (error: unknown) => {
        assert.ok(error instanceof ScheduleDomainError);
        assert.equal(error.code, "INVALID_SCHEDULE_INPUT");
        assert.equal(error.field, "date");
        return true;
      }
    );
  });

  it("직원별·날짜별 상태 조회는 기록이 없는 직원에 미입력을 채우고 중복 id를 제거한다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-14", planStatus: "휴무" }]
    });

    const result = await listPlannedWorkingDayStatusesForDate({
      employeeIds: ["thr-1", "thr-1", "thr-2"],
      date: "2026-10-14",
      prismaClient: client
    });

    assert.equal(result.length, 2);
    assert.deepEqual(
      result.find((row) => row.employeeId === "thr-1"),
      { employeeId: "thr-1", status: "휴무" }
    );
    assert.deepEqual(
      result.find((row) => row.employeeId === "thr-2"),
      { employeeId: "thr-2", status: "미입력" }
    );
  });
});
