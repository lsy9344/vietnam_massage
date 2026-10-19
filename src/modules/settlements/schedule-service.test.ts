import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ScheduleDomainError,
  copyLastWeekSchedule,
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
    /** S8: 여러 칸을 쓰는 지난주 복사가 한 트랜잭션인지 보려고, N번째 감사 기록부터만 실패시킨다. */
    failAuditAfter?: number;
    seedCells?: Array<{ id: string; employeeId: string; workDate: string; planStatus: string }>;
    // 휴무 영향 콜(28): 콜 서비스의 listAssignedServiceCallsForEmployeeOnDate가 읽는 모양만 흉내 낸다.
    seedCalls?: Array<{
      id: string;
      serviceDate: string;
      startTime: string;
      status: string;
      courseCode: string;
      operatingMonthId?: string;
      assignments: Array<{ employeeId: string; isActive?: boolean }>;
    }>;
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
  const serviceCalls = new Map<string, any>();
  for (const seed of options.seedCalls ?? []) {
    serviceCalls.set(seed.id, {
      id: seed.id,
      operatingMonthId: seed.operatingMonthId ?? "month-2026-10",
      serviceDate: dbDate(seed.serviceDate),
      startTime: seed.startTime,
      status: seed.status,
      course: { code: seed.courseCode },
      assignments: seed.assignments
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
        if (options.failAuditAfter !== undefined && auditEvents.length >= options.failAuditAfter) {
          throw new Error("audit failed after limit");
        }
        const record = { id: `audit-${auditEvents.length + 1}`, createdAt, ...data };
        auditEvents.push(record);
        return record;
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return [...serviceCalls.values()].filter(
          (call) => where?.serviceDate === undefined || toIsoDate(call.serviceDate) === toIsoDate(where.serviceDate)
        );
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      const snapshot = cloneCells();
      const auditSnapshotLength = auditEvents.length;
      // 실제 Prisma의 트랜잭션 콜백 인자(TransactionClient)에는 $transaction이 없다(중첩 트랜잭션
      // 불가). S8: setPlannedWorkingDay가 이미 트랜잭션 안(지난주 복사)에서 불려도 또 트랜잭션을 열지
      // 않고 같은 트랜잭션에 참여하는지, 이 double로 그 제약을 그대로 흉내 내 확인한다.
      const { $transaction: _omit, ...tx } = client;
      try {
        return await callback(tx);
      } catch (error) {
        restoreCells(snapshot);
        auditEvents.splice(auditSnapshotLength);
        throw error;
      }
    },
    cells,
    auditEvents,
    serviceCalls
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

  it("두 직군의 활성 직원을 직군별로 묶고, 기록이 없는 칸은 미입력이다", async () => {
    const result = await listPlannedWorkingDaysForWeek({
      date: "2026-10-14",
      prismaClient: createMemoryPrisma()
    });

    assert.deepEqual(
      result.groups.map((group) => group.employeeGroup),
      ["OPERATIONS", "THERAPIST"]
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
    assert.deepEqual(result.impactedCalls, []); // 배정된 콜이 없으면 빈 목록이다.
    assert.equal(client.auditEvents.length, 1);
    assert.equal(client.auditEvents[0].action, "planned_working_day.changed");
    assert.deepEqual(client.auditEvents[0].beforeValue, { employeeId: "thr-1", date: "2026-10-14", status: "근무 예정" });
  });

  it("휴무로 바꾸면 그 직원이 어느 역할로든 배정된, 노쇼·취소가 아닌 콜을 함께 돌려주고 콜은 그대로 둔다", async () => {
    const client = createMemoryPrisma({
      seedCalls: [
        { id: "call-1", serviceDate: "2026-10-14", startTime: "14:00", status: "예약", courseCode: "A", assignments: [{ employeeId: "thr-1" }] },
        {
          id: "call-2",
          serviceDate: "2026-10-14",
          startTime: "15:00",
          status: "사용중",
          courseCode: "B",
          assignments: [{ employeeId: "other" }, { employeeId: "thr-1" }]
        },
        { id: "call-noshow", serviceDate: "2026-10-14", startTime: "16:00", status: "노쇼", courseCode: "A", assignments: [{ employeeId: "thr-1" }] },
        { id: "call-other-day", serviceDate: "2026-10-15", startTime: "09:00", status: "예약", courseCode: "A", assignments: [{ employeeId: "thr-1" }] }
      ]
    });
    const callBefore = JSON.stringify(client.serviceCalls.get("call-1"));

    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "휴무",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.equal(result.status, "휴무");
    assert.deepEqual(result.impactedCalls.map((call) => call.serviceCallId), ["call-1", "call-2"]);
    assert.equal(result.impactedCalls[0].courseCode, "A");
    assert.equal(result.impactedCalls[0].status, "예약");
    assert.equal(result.impactedCalls[1].status, "사용중");
    // 콜의 예약시각, 배정, 상태는 바뀌지 않는다.
    assert.equal(JSON.stringify(client.serviceCalls.get("call-1")), callBefore);
  });

  it("근무 예정이나 미입력으로 설정할 때는 영향받는 콜을 계산하지 않는다", async () => {
    const client = createMemoryPrisma({
      seedCalls: [{ id: "call-1", serviceDate: "2026-10-14", startTime: "14:00", status: "예약", courseCode: "A", assignments: [{ employeeId: "thr-1" }] }]
    });

    const result = await setPlannedWorkingDay({
      employeeId: "thr-1",
      date: "2026-10-14",
      status: "근무 예정",
      actorId: "acc-1",
      prismaClient: client
    });

    assert.deepEqual(result.impactedCalls, []);
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
      { employeeId: "thr-1", status: "휴무", plannedStartTime: null }
    );
    assert.deepEqual(
      result.find((row) => row.employeeId === "thr-2"),
      { employeeId: "thr-2", status: "미입력", plannedStartTime: null }
    );
  });

  it("지난주 복사는 미입력 칸만 채우고, 이미 입력된 근무 예정·휴무는 덮지 않는다", async () => {
    const client = createMemoryPrisma({
      seedCells: [
        { id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-05", planStatus: "근무 예정" }, // 지난주 월
        { id: "pwd-2", employeeId: "thr-1", workDate: "2026-10-06", planStatus: "휴무" }, // 지난주 화
        { id: "pwd-3", employeeId: "thr-1", workDate: "2026-10-13", planStatus: "근무 예정" } // 이번주 화(이미 입력됨)
      ]
    });

    const result = await copyLastWeekSchedule({ date: "2026-10-14", actorId: "acc-1", prismaClient: client });

    assert.equal(result.weekStartDate, "2026-10-12");
    assert.equal(result.weekEndDate, "2026-10-18");
    // 월요일(10-12)은 미입력이었으니 지난주 월(근무 예정)이 복사된다.
    assert.equal(client.cells.get(cellKey("thr-1", "2026-10-12"))?.planStatus, "근무 예정");
    // 화요일(10-13)은 이미 근무 예정으로 입력돼 있었으니 지난주 화(휴무)로 덮이지 않는다.
    assert.equal(client.cells.get(cellKey("thr-1", "2026-10-13"))?.planStatus, "근무 예정");
    assert.equal(result.filledCount, 1);
    assert.equal(client.auditEvents.length, 1);
    assert.equal(client.auditEvents[0].action, "planned_working_day.created");
  });

  it("지난주도 미입력이면 채우지 않고 채운 칸 수는 0이다", async () => {
    const client = createMemoryPrisma();

    const result = await copyLastWeekSchedule({ date: "2026-10-14", actorId: "acc-1", prismaClient: client });

    assert.equal(result.filledCount, 0);
    assert.equal(client.cells.size, 0);
  });

  it("지난주가 달 경계를 넘어도 날짜 기준으로 그대로 복사한다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-01-26", planStatus: "근무 예정" }] // 지난주 월요일(1월)
    });

    // 이번 주는 2026-02-02(월)~02-08(일)이고 지난주는 2026-01-26(월)~02-01(일)이라 달 경계를 넘는다.
    const result = await copyLastWeekSchedule({ date: "2026-02-04", actorId: "acc-1", prismaClient: client });

    assert.equal(result.weekStartDate, "2026-02-02");
    assert.equal(client.cells.get(cellKey("thr-1", "2026-02-02"))?.planStatus, "근무 예정");
    assert.equal(result.filledCount, 1);
  });

  it("지난주 복사의 날짜 형식이 올바르지 않으면 거절한다", async () => {
    await assert.rejects(
      copyLastWeekSchedule({ date: "2026-02-30", actorId: "acc-1", prismaClient: createMemoryPrisma() }),
      (error: unknown) => {
        assert.ok(error instanceof ScheduleDomainError);
        assert.equal(error.code, "INVALID_SCHEDULE_INPUT");
        return true;
      }
    );
  });

  it("S8: 복사로 휴무가 된 칸의 영향받는 콜을 모아 돌려준다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-06", planStatus: "휴무" }], // 지난주 화
      seedCalls: [
        {
          id: "call-1",
          serviceDate: "2026-10-13", // 이번주 화(복사로 휴무가 되는 칸)
          startTime: "14:00",
          status: "예약",
          courseCode: "A",
          assignments: [{ employeeId: "thr-1" }]
        }
      ]
    });

    const result = await copyLastWeekSchedule({ date: "2026-10-14", actorId: "acc-1", prismaClient: client });

    assert.equal(result.filledCount, 1);
    assert.equal(client.cells.get(cellKey("thr-1", "2026-10-13"))?.planStatus, "휴무");
    assert.deepEqual(result.impacts, [
      { employeeId: "thr-1", employeeName: "마사지사1", date: "2026-10-13", calls: [{ serviceCallId: "call-1", operatingMonthId: "month-2026-10", serviceDate: "2026-10-13", startTime: "14:00", courseCode: "A", status: "예약" }] }
    ]);
  });

  it("S8: 영향받는 콜이 없는 칸은 impacts에 담기지 않는다", async () => {
    const client = createMemoryPrisma({
      seedCells: [{ id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-05", planStatus: "근무 예정" }] // 지난주 월, 영향 없음
    });

    const result = await copyLastWeekSchedule({ date: "2026-10-14", actorId: "acc-1", prismaClient: client });

    assert.equal(result.filledCount, 1);
    assert.deepEqual(result.impacts, []);
  });

  it("S8: 활성 직원 수×7번의 칸 쓰기를 한 트랜잭션으로 묶어, 중간에 하나가 실패하면 앞서 쓴 칸도 모두 되돌린다", async () => {
    // thr-1(정렬 10)이 thr-2(정렬 20)보다 먼저 쓰여 월요일 칸이 성공한 뒤 thr-2의 칸에서 실패하게 한다.
    const client = createMemoryPrisma({
      seedCells: [
        { id: "pwd-1", employeeId: "thr-1", workDate: "2026-10-05", planStatus: "근무 예정" },
        { id: "pwd-2", employeeId: "thr-2", workDate: "2026-10-05", planStatus: "근무 예정" }
      ],
      failAuditAfter: 1 // 첫 칸(thr-1 월요일) 감사는 통과하고, 그다음(thr-2 월요일)부터 실패한다.
    });

    await assert.rejects(copyLastWeekSchedule({ date: "2026-10-14", actorId: "acc-1", prismaClient: client }));

    // 한 트랜잭션이 아니었다면 thr-1의 칸은 이미 커밋돼 남아 있었을 것이다 — 지금은 전체가 되돌려져야 한다.
    assert.equal(client.cells.has(cellKey("thr-1", "2026-10-12")), false);
    assert.equal(client.cells.has(cellKey("thr-2", "2026-10-12")), false);
    assert.equal(client.auditEvents.length, 0);
  });
});
