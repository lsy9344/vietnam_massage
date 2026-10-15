import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmEarcareDailySettlementPayout,
  EarcareDailySettlementDomainError,
  listEarcareDailySettlements,
  reconfirmEarcareDailySettlementPayout,
  releaseEarcareDailySettlementPayout
} from "@/modules/settlements/earcare-daily-settlement-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(
  options: {
    locked?: boolean;
    allExcluded?: boolean;
    outsideMonth?: boolean;
    employeeIdTieBreaker?: boolean;
    seedPayoutConfirmationEvents?: any[];
  } = {}
) {
  const createdAt = new Date("2026-06-10T00:00:00.000Z");
  const updatedAt = new Date("2026-06-10T00:10:00.000Z");
  const firstEarcareId = options.employeeIdTieBreaker ? "ear-z" : "ear-1";
  const secondEarcareId = options.employeeIdTieBreaker ? "ear-a" : "ear-2";
  const firstEarcareStaffCode = options.employeeIdTieBreaker ? "EAR-TIE" : "EAR-002";
  const secondEarcareStaffCode = options.employeeIdTieBreaker ? "EAR-TIE" : "EAR-001";
  const firstEarcareSortOrder = options.employeeIdTieBreaker ? 10 : 20;
  const secondEarcareSortOrder = 10;
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.locked ? "잠금" : "작성중",
    createdAt,
    updatedAt
  };
  const room = { id: "room-101", displayName: "101 호실", isActive: true, createdAt, updatedAt };
  const courses = new Map<string, any>([
    ["course-a", course("course-a", "A")],
    ["course-b", course("course-b", "B")],
    ["course-c", course("course-c", "C")],
    ["course-d", course("course-d", "D")],
    ["course-no-policy", course("course-no-policy", "A")]
  ]);
  const policies = [
    policy("policy-a", "course-a", "A 누루60", 300001, false),
    policy("policy-b", "course-b", "B 귀청소90", 200000, false),
    policy("policy-c", "course-c", "C 때밀이90", 100000, false),
    policy("policy-d", "course-d", "D 2:1 90", 400000, true)
  ];
  const employees = new Map<string, any>([
    [firstEarcareId, employee(firstEarcareId, firstEarcareStaffCode, "귀케어2", firstEarcareSortOrder, "EARCARE")],
    [secondEarcareId, employee(secondEarcareId, secondEarcareStaffCode, "귀케어1", secondEarcareSortOrder, "EARCARE")],
    ["ear-3", employee("ear-3", "EAR-003", "귀케어3", 30, "EARCARE")],
    ["thr-1", employee("thr-1", "THR-001", "마사지사1", 1, "THERAPIST")],
    ["thr-2", employee("thr-2", "THR-002", "마사지사2", 2, "THERAPIST")]
  ]);
  const codeItems = [
    status("NORMAL", "정상", 10),
    status("DAY_OFF", "휴무", 20),
    status("LATE", "지각", 30)
  ];
  const attendances = new Map<string, any>([
    [attendanceKey(firstEarcareId), attendance("att-1", firstEarcareId, options.allExcluded ? "DAY_OFF" : "NORMAL")],
    [attendanceKey(secondEarcareId), attendance("att-2", secondEarcareId, options.allExcluded ? "LATE" : "NORMAL")],
    [attendanceKey("ear-3"), attendance("att-3", "ear-3", "DAY_OFF")]
  ]);
  const serviceCalls = [
    call("call-a", "course-a", "방문완료", [assignment("call-a", "THERAPIST_1", "thr-1")]),
    call("call-b", "course-b", "VISIT_COMPLETE", [assignment("call-b", "THERAPIST_1", "thr-1")]),
    call("call-zero", "course-c", "방문완료", [assignment("call-zero", "THERAPIST_1", "thr-1")]),
    call("call-reserved", "course-a", "예약", [assignment("call-reserved", "THERAPIST_1", "thr-1")]),
    call("call-no-policy", "course-no-policy", "방문완료", [assignment("call-no-policy", "THERAPIST_1", "thr-1")]),
    call("call-missing-rate", "course-a", "방문완료", [assignment("call-missing-rate", "THERAPIST_1", "thr-2")]),
    call("call-invalid-d", "course-d", "방문완료", [assignment("call-invalid-d", "THERAPIST_1", "thr-1")])
  ];
  const rates = [
    rate("rate-1-a", "thr-1", "course-a", 700000),
    rate("rate-1-b", "thr-1", "course-b", 900000),
    rate("rate-1-c", "thr-1", "course-c", 900000),
    rate("rate-1-d", "thr-1", "course-d", 900000)
  ];
  const payoutConfirmationEvents: any[] = [...(options.seedPayoutConfirmationEvents ?? [])];

  function course(id: string, codeValue: string) {
    return { id, code: codeValue, isActive: true, createdAt, updatedAt };
  }

  function policy(id: string, courseId: string, name: string, earcarePoolAmount: number, requiresSecondTherapist: boolean) {
    return {
      id,
      courseId,
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice: 1500000,
      opsCallCredit: 1,
      earcarePoolAmount,
      requiresSecondTherapist,
      tvDisplayName: name,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function employee(id: string, staffCode: string, displayName: string, sortOrder: number, employeeGroup: string) {
    return { id, staffCode, displayName, employeeGroup, position: employeeGroup, sortOrder, isActive: true, createdAt, updatedAt };
  }

  function status(code: string, displayName: string, sortOrder: number) {
    return { id: `status-${code}`, codeType: "ATTENDANCE_STATUS", code, displayName, sortOrder, isActive: true, createdAt, updatedAt };
  }

  function attendanceKey(employeeId: string) {
    return `${operatingMonth.id}::2026-06-10::${employeeId}`;
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

  function assignment(serviceCallId: string, assignmentRole: "THERAPIST_1" | "THERAPIST_2", employeeId: string) {
    return {
      id: `${serviceCallId}-${assignmentRole}`,
      serviceCallId,
      assignmentRole,
      employeeId,
      employee: employees.get(employeeId),
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function call(id: string, courseId: string, statusValue: string, assignments: any[]) {
    const serviceDate = options.outsideMonth ? dbDate("2026-07-01") : dbDate("2026-06-10");
    const courseRecord = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate,
      startTime: "11:00",
      roomId: room.id,
      room,
      courseId,
      course: courseRecord ? { ...courseRecord, policies: policies.filter((record) => record.courseId === courseId) } : undefined,
      customerMemo: id,
      status: statusValue,
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      note: null,
      confirmationCode: null,
      assignments,
      createdAt,
      updatedAt
    };
  }

  function rate(id: string, therapistId: string, courseId: string, amount: number) {
    return { id, therapistId, courseId, amount, effectiveFromMonth: "2026-06", effectiveToMonth: null, isActive: true, createdAt, updatedAt };
  }

  function sameDate(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  function sameDateOrNull(a: Date | null, b: Date | null) {
    if (a === null || b === null) return a === b;
    return sameDate(a, b);
  }

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
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
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));
      },
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      }
    },
    payoutConfirmationEvent: {
      async findMany({ where }: any = {}) {
        const results = payoutConfirmationEvents.filter((record) => {
          if (where?.unitType !== undefined && record.unitType !== where.unitType) return false;
          if (where?.operatingMonthId !== undefined && record.operatingMonthId !== where.operatingMonthId) return false;
          if (where?.serviceDate !== undefined && !sameDateOrNull(record.serviceDate, where.serviceDate)) return false;
          if (where?.employeeId !== undefined) {
            if (typeof where.employeeId === "string") {
              if (record.employeeId !== where.employeeId) return false;
            } else if (Array.isArray(where.employeeId?.in) && !where.employeeId.in.includes(record.employeeId)) {
              return false;
            }
          }
          return true;
        });
        return [...results].sort(
          (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.createdAt.getTime() - a.createdAt.getTime()
        );
      },
      async create({ data }: any) {
        const record = {
          id: `payout-event-${payoutConfirmationEvents.length + 1}`,
          createdAt: new Date(`2026-06-10T15:00:${String(payoutConfirmationEvents.length).padStart(2, "0")}.000Z`),
          actorAccount:
            data.actorAccountId === "account-admin"
              ? { accountId: "admin", employee: { displayName: "관리자", staffCode: "ADM-001" } }
              : { accountId: data.actorAccountId, employee: null },
          ...data
        };
        payoutConfirmationEvents.push(record);
        return record;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    codeItem: {
      async findMany({ where }: any = {}) {
        return codeItems
          .filter((record) => (where?.codeType === undefined || record.codeType === where.codeType) && (where?.isActive === undefined || record.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }
    },
    earcareAttendance: {
      async findMany({ where }: any = {}) {
        return [...attendances.values()].filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.attendanceDate === undefined || sameDate(record.attendanceDate, where.attendanceDate)) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return serviceCalls.filter(
          (record) =>
            (where?.operatingMonthId === undefined || record.operatingMonthId === where.operatingMonthId) &&
            (where?.serviceDate === undefined || sameDate(record.serviceDate, where.serviceDate))
        );
      }
    },
    timeSlot: {
      async findMany() {
        return [{ value: "11:00", sortOrder: 10, isActive: true, createdAt, updatedAt }];
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return policies.filter((record) => (where?.courseId === undefined || record.courseId === where.courseId) && record.isActive === where.isActive);
      }
    },
    therapistCourseRate: {
      async findMany({ where }: any = {}) {
        return rates.filter(
          (record) =>
            (where?.therapistId === undefined ||
              record.therapistId === where.therapistId ||
              (Array.isArray(where.therapistId?.in) && where.therapistId.in.includes(record.therapistId))) &&
            (where?.courseId === undefined ||
              record.courseId === where.courseId ||
              (Array.isArray(where.courseId?.in) && where.courseId.in.includes(record.courseId))) &&
            (where?.isActive === undefined || record.isActive === where.isActive)
        );
      }
    },
    dailyExpense: {
      async findMany() {
        return [];
      }
    },
    payoutConfirmationEvents
  };

  return client;
}

describe("listEarcareDailySettlements", () => {
  it("sums calculated completed earcare pools and distributes remainder by sortOrder, staffCode, and Employee.id", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.equal(result.earcarePoolTotal, 600001);
    assert.equal(result.sourceCallCount, 3);
    assert.equal(result.eligibleCount, 2);
    assert.equal(result.baseShareAmount, 300000);
    assert.equal(result.remainderAmount, 1);
    assert.equal(result.distributedAmount, 600001);
    assert.equal(result.undistributedAmount, 0);
    assert.deepEqual(result.warningCounts, {
      notCompleted: 1,
      coursePolicyMissing: 1,
      therapistRateMissing: 1,
      secondTherapistRequired: 1
    });
    assert.deepEqual(
      result.rows.map((row) => [
        row.employeeId,
        row.staffCode,
        row.statusDisplayName,
        row.isPayoutEligible,
        row.baseShareAmount,
        row.remainderShareAmount,
        row.payoutAmount,
        row.calculationBasis
      ]),
      [
        ["ear-2", "EAR-001", "정상", true, 300000, 1, 300001, "방문완료 풀 600001 VND / 정상 근무자 2명 + 잔여 1 VND 배분"],
        ["ear-1", "EAR-002", "정상", true, 300000, 0, 300000, "방문완료 풀 600001 VND / 정상 근무자 2명"],
        ["ear-3", "EAR-003", "휴무", false, 0, 0, 0, "휴무 제외"]
      ]
    );
    assert.deepEqual(
      result.poolEvidence.map((evidence) => [evidence.serviceCallId, evidence.serviceDate, evidence.earcarePoolAmount]),
      [
        ["call-a", "2026-06-10", 300001],
        ["call-b", "2026-06-10", 200000],
        ["call-zero", "2026-06-10", 100000]
      ]
    );
  });

  it("attaches the call summary (date, start time, course, therapists, status) to each pool evidence call", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    assert.deepEqual(result.poolEvidence[0]?.call, {
      serviceCallId: "call-a",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      courseCode: "A",
      therapistNames: ["마사지사1"],
      status: "방문완료"
    });
    assert.deepEqual(
      result.poolEvidence.map((evidence) => evidence.call?.serviceCallId),
      result.poolEvidence.map((evidence) => evidence.serviceCallId)
    );
  });

  it("returns zero payouts and undistributed pool when no earcare employee is NORMAL and 근무상태 변경 반영 is visible", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ allExcluded: true })
    });

    assert.equal(result.eligibleCount, 0);
    assert.equal(result.distributedAmount, 0);
    assert.equal(result.undistributedAmount, 600001);
    assert.ok(result.rows.every((row) => row.payoutAmount === 0));
    assert.ok(result.rows.every((row) => row.calculationBasis.includes("정상 근무자 0명") || row.calculationBasis.includes("제외")));
  });

  it("uses Employee.id as the deterministic remainder tie-breaker after sortOrder and staffCode", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ employeeIdTieBreaker: true })
    });

    const firstByInputOrder = result.rows.find((row) => row.employeeId === "ear-z");
    const firstByEmployeeId = result.rows.find((row) => row.employeeId === "ear-a");
    assert.equal(result.remainderAmount, 1);
    assert.equal(firstByInputOrder?.remainderShareAmount, 0);
    assert.equal(firstByEmployeeId?.remainderShareAmount, 1);
  });

  it("keeps locked operating months readable", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma({ locked: true })
    });

    assert.equal(result.isLocked, true);
    assert.equal(result.distributedAmount, 600001);
  });

  it("rejects a service date outside the operating month range", async () => {
    await assert.rejects(
      listEarcareDailySettlements({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-07-01",
        prismaClient: createMemoryPrisma()
      }),
      (error) => error instanceof EarcareDailySettlementDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
  });

  it("지급 확인(ADR 0004, 티켓 30)이 없는 행은 미확인이다", async () => {
    const result = await listEarcareDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createMemoryPrisma()
    });

    const earcare2 = result.rows.find((row) => row.employeeId === "ear-2");
    assert.equal(earcare2?.payoutConfirmation.status, "unconfirmed");
    assert.equal(earcare2?.payoutConfirmation.currentAmount, earcare2?.payoutAmount);
  });
});

describe("confirmEarcareDailySettlementPayout", () => {
  it("그날 계산된 지급액을 사건으로 남기고, 다시 조회하면 확인됨으로 보인다", async () => {
    const prismaClient = createMemoryPrisma();
    const result = await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    assert.equal(result.payoutConfirmation.status, "confirmed");
    assert.equal(result.payoutConfirmation.lastConfirmedAmount, 300001);

    const reread = await listEarcareDailySettlements({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient });
    const earcare2 = reread.rows.find((row) => row.employeeId === "ear-2");
    assert.equal(earcare2?.payoutConfirmation.status, "confirmed");
    assert.equal(earcare2?.payoutConfirmation.history[0]?.actorAccountId, "account-admin");
  });

  it("비활성이거나 EARCARE가 아닌 직원의 확인을 거절한다", async () => {
    await assert.rejects(
      confirmEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "thr-1",
        actorId: "account-admin",
        prismaClient: createMemoryPrisma()
      }),
      /활성 귀케어사만 지급 확인을 변경할 수 있습니다\./
    );
  });

  it("마감확정·잠금 운영월에서는 확인을 쓸 수 없다", async () => {
    await assert.rejects(
      confirmEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "ear-2",
        actorId: "account-admin",
        prismaClient: createMemoryPrisma({ locked: true })
      }),
      /마감확정 또는 잠금 운영월/
    );
  });

  it("이미 확인된 단위를 다시 확인하면 거절된다(재확인을 쓰라고 안내)", async () => {
    const prismaClient = createMemoryPrisma();
    await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      confirmEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "ear-2",
        actorId: "account-admin",
        prismaClient
      }),
      /이미 확인된 지급 확인입니다\./
    );
  });
});

describe("reconfirmEarcareDailySettlementPayout", () => {
  it("사유와 함께 재확인하면 현재 지급액이 새 기준이 되고, 이전 확인 기록은 남는다", async () => {
    const prismaClient = createMemoryPrisma();
    await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    const reconfirmed = await reconfirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      reason: "근무상태 정정으로 금액 재확인",
      prismaClient
    });

    assert.equal(reconfirmed.payoutConfirmation.status, "confirmed");
    assert.equal(reconfirmed.payoutConfirmation.history.length, 2);
    assert.equal(reconfirmed.payoutConfirmation.history[0].eventType, "reconfirm");
    assert.equal(reconfirmed.payoutConfirmation.history[0].reason, "근무상태 정정으로 금액 재확인");
  });

  it("확인된 사건이 없으면 재확인을 거절한다", async () => {
    await assert.rejects(
      reconfirmEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "ear-2",
        actorId: "account-admin",
        reason: "사유",
        prismaClient: createMemoryPrisma()
      }),
      /확인된 지급 확인이 없어/
    );
  });

  it("사유가 비어 있으면 재확인을 거절한다", async () => {
    const prismaClient = createMemoryPrisma();
    await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      reconfirmEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "ear-2",
        actorId: "account-admin",
        reason: "",
        prismaClient
      }),
      /재확인 사유를 입력하세요\./
    );
  });
});

describe("releaseEarcareDailySettlementPayout", () => {
  it("사유와 함께 해제하면 미확인으로 돌아가고, 이전 확인 기록은 남는다", async () => {
    const prismaClient = createMemoryPrisma();
    await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    const released = await releaseEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      reason: "잘못 이관된 확인을 해제",
      prismaClient
    });

    assert.equal(released.payoutConfirmation.status, "unconfirmed");
    assert.equal(released.payoutConfirmation.history[0].eventType, "release");
    assert.equal(released.payoutConfirmation.history[0].reason, "잘못 이관된 확인을 해제");
  });

  it("사유 없는 해제는 거절한다", async () => {
    const prismaClient = createMemoryPrisma();
    await confirmEarcareDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: "ear-2",
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      releaseEarcareDailySettlementPayout({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        employeeId: "ear-2",
        actorId: "account-admin",
        reason: "",
        prismaClient
      }),
      /해제 사유를 입력하세요\./
    );
  });
});
