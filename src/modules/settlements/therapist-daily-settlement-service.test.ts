import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  confirmTherapistDailySettlementPayout,
  listTherapistDailyPayoutConfirmationsForMonth,
  listTherapistDailySettlements,
  reconfirmTherapistDailySettlementPayout,
  releaseTherapistDailySettlementPayout
} from "@/modules/settlements/therapist-daily-settlement-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createSettlementPrisma(
  options: {
    operatingMonthStatus?: string;
    extraEmployees?: any[];
    seedPayoutConfirmationEvents?: any[];
  } = {}
) {
  const createdAt = new Date("2026-06-09T00:00:00.000Z");
  const updatedAt = new Date("2026-06-09T00:10:00.000Z");
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: options.operatingMonthStatus ?? "작성중",
    createdAt,
    updatedAt
  };
  const room = { id: "room-101", displayName: "101 호실", isActive: true, createdAt, updatedAt };
  const courses = new Map<string, any>([
    ["course-a", { id: "course-a", code: "A", isActive: true, createdAt, updatedAt }],
    ["course-b", { id: "course-b", code: "B", isActive: true, createdAt, updatedAt }],
    ["course-c", { id: "course-c", code: "C", isActive: true, createdAt, updatedAt }],
    ["course-d", { id: "course-d", code: "D", isActive: true, createdAt, updatedAt }],
    ["course-e", { id: "course-e", code: "E", isActive: true, createdAt, updatedAt }],
    ["course-no-policy", { id: "course-no-policy", code: "A", isActive: true, createdAt, updatedAt }]
  ]);
  const policies = [
    policy("policy-a", "course-a", "A 누루60", 1500000, false),
    policy("policy-b", "course-b", "B 귀청소90", 1800000, false),
    policy("policy-c", "course-c", "C 때밀이90", 2000000, false),
    policy("policy-d", "course-d", "D 2:1 90", 3200000, true),
    policy("policy-e", "course-e", "E 풀코스120", 3000000, false)
  ];
  const employees = new Map<string, any>([
    [therapist1.id, therapist1],
    [therapist2.id, therapist2],
    [therapist3.id, therapist3],
    ...(options.extraEmployees ?? []).map((employee) => [employee.id, employee] as const)
  ]);
  const rates = [
    rate("rate-t1-a", therapist1.id, "course-a", 700000),
    rate("rate-t1-b", therapist1.id, "course-b", 900000),
    rate("rate-t1-c", therapist1.id, "course-c", 900000),
    rate("rate-t1-d", therapist1.id, "course-d", 900000),
    rate("rate-t1-e", therapist1.id, "course-e", 0),
    rate("rate-t2-a", therapist2.id, "course-a", 0),
    rate("rate-t2-b", therapist2.id, "course-b", 800000),
    rate("rate-t2-d", therapist2.id, "course-d", 900000)
  ];
  const serviceCalls = [
    call("call-a", "course-a", "VISIT_COMPLETE", [
      assignment("call-a", "THERAPIST_1", therapist1.id),
      assignment("call-a", "THERAPIST_2", therapist2.id)
    ]),
    call("call-b", "course-b", "방문완료", [assignment("call-b", "THERAPIST_2", therapist1.id)]),
    call("call-c", "course-c", "VISIT_COMPLETE", [assignment("call-c", "THERAPIST_1", therapist1.id)]),
    call("call-d", "course-d", "VISIT_COMPLETE", [
      assignment("call-d", "THERAPIST_1", therapist1.id),
      assignment("call-d", "THERAPIST_2", therapist2.id)
    ]),
    call("call-e", "course-e", "VISIT_COMPLETE", [assignment("call-e", "THERAPIST_1", therapist1.id)]),
    call("call-same", "course-a", "VISIT_COMPLETE", [
      assignment("call-same", "THERAPIST_1", therapist1.id),
      assignment("call-same", "THERAPIST_2", therapist1.id)
    ]),
	    call("call-missing-rate", "course-c", "VISIT_COMPLETE", [assignment("call-missing-rate", "THERAPIST_1", therapist3.id)]),
	    call("call-partial-missing-rate", "course-a", "VISIT_COMPLETE", [
	      assignment("call-partial-missing-rate", "THERAPIST_1", therapist1.id),
	      assignment("call-partial-missing-rate", "THERAPIST_2", therapist3.id)
	    ]),
	    call("call-invalid-d", "course-d", "VISIT_COMPLETE", [assignment("call-invalid-d", "THERAPIST_1", therapist1.id)]),
    call("call-no-policy", "course-no-policy", "VISIT_COMPLETE", [assignment("call-no-policy", "THERAPIST_1", therapist1.id)]),
    call("call-reserved", "course-a", "예약", [assignment("call-reserved", "THERAPIST_1", therapist1.id)]),
    call("call-canceled", "course-a", "CANCELED", [assignment("call-canceled", "THERAPIST_1", therapist1.id)])
  ];
  const payoutConfirmationEvents: any[] = [...(options.seedPayoutConfirmationEvents ?? [])];

  function policy(id: string, courseId: string, name: string, basePrice: number, requiresSecondTherapist: boolean) {
    return {
      id,
      courseId,
      name,
      durationMinutes: requiresSecondTherapist ? 90 : 60,
      basePrice,
      opsCallCredit: 1,
      earcarePoolAmount: 0,
      requiresSecondTherapist,
      tvDisplayName: name,
      effectiveFromMonth: "2026-06",
      effectiveToMonth: null,
      isActive: true,
      createdAt,
      updatedAt
    };
  }

  function rate(id: string, therapistId: string, courseId: string, amount: number) {
    return { id, therapistId, courseId, amount, effectiveFromMonth: "2026-06", effectiveToMonth: null, isActive: true, createdAt, updatedAt };
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

  function call(id: string, courseId: string, status: string, assignments: any[]) {
    const course = courses.get(courseId);
    return {
      id,
      operatingMonthId: operatingMonth.id,
      operatingMonth,
      serviceDate: dbDate("2026-06-10"),
      startTime: "11:00",
      roomId: room.id,
      room,
      courseId,
      course: course ? { ...course, policies: policies.filter((record) => record.courseId === courseId) } : undefined,
      customerMemo: id,
      status,
      discountTypeCode: null,
      paymentMethodCode: "CASH",
      note: null,
      confirmationCode: null,
      assignments,
      createdAt,
      updatedAt
    };
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
    employee: {
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter(
            (employee) =>
              (where?.employeeGroup === undefined || employee.employeeGroup === where.employeeGroup) &&
              (where?.isActive === undefined || employee.isActive === where.isActive)
          )
          .sort((a, b) => a.sortOrder - b.sortOrder);
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
    payoutConfirmationEvents
  };

  return client;
}

const therapist1 = {
  id: "therapist-1",
  displayName: "마사지사1",
  staffCode: "THR-001",
  employeeGroup: "THERAPIST",
  sortOrder: 1,
  isActive: true
};
const therapist2 = {
  id: "therapist-2",
  displayName: "마사지사2",
  staffCode: "THR-002",
  employeeGroup: "THERAPIST",
  sortOrder: 2,
  isActive: true
};
const therapist3 = {
  id: "therapist-3",
  displayName: "마사지사3",
  staffCode: "THR-003",
  employeeGroup: "THERAPIST",
  sortOrder: 3,
  isActive: true
};

describe("listTherapistDailySettlements", () => {
  it("집계는 방문완료 콜의 마사지사1/2 담당 건과 같은 마사지사 이중 역할을 직원 ID 기준으로 반환한다", async () => {
    const result = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma()
    });

    const therapist = result.settlements.find((row) => row.employeeId === therapist1.id);
    assert.ok(therapist);
    assert.equal(therapist.displayName, "마사지사1");
    assert.equal(therapist.staffCode, "THR-001");
	    assert.equal(therapist.totalCallCount, 9);
	    assert.equal(therapist.totalCommissionAmount, 5500000);
    assert.deepEqual(
      Object.fromEntries(Object.entries(therapist.courseBreakdown).map(([courseCode, summary]) => [courseCode, [summary.callCount, summary.commissionAmount]])),
      {
	        A: [5, 2800000],
        B: [1, 900000],
        C: [1, 900000],
        D: [1, 900000],
        E: [1, 0]
      }
    );
    assert.deepEqual(
      therapist.assignmentEvidence.map((evidence) => [evidence.serviceCallId, evidence.courseCode, evidence.role, evidence.commissionAmount, evidence.rateStatus]),
      [
        ["call-a", "A", "THERAPIST_1", 700000, "applied"],
        ["call-b", "B", "THERAPIST_2", 900000, "applied"],
        ["call-c", "C", "THERAPIST_1", 900000, "applied"],
        ["call-d", "D", "THERAPIST_1", 900000, "applied"],
        ["call-e", "E", "THERAPIST_1", 0, "zero_policy"],
	        ["call-same", "A", "THERAPIST_1", 700000, "applied"],
	        ["call-same", "A", "THERAPIST_2", 700000, "applied"],
	        ["call-partial-missing-rate", "A", "THERAPIST_1", 700000, "applied"],
	        ["call-no-policy", "A", "THERAPIST_1", 0, "missing_policy"]
	      ]
	    );
  });

  it("근거 콜마다 원장 링크나 그 자리 요약에 쓸 콜 요약(날짜, 예약시각, 코스, 마사지사, 상태)을 함께 반환한다", async () => {
    const result = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma()
    });

    const therapist = result.settlements.find((row) => row.employeeId === therapist2.id);
    assert.ok(therapist);
    const evidence = therapist.assignmentEvidence.find((item) => item.serviceCallId === "call-a");
    assert.deepEqual(evidence?.call, {
      serviceCallId: "call-a",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      courseCode: "A",
      therapistNames: ["마사지사1", "마사지사2"],
      status: "VISIT_COMPLETE"
    });
    const missingPolicy = result.settlements
      .find((row) => row.employeeId === therapist1.id)
      ?.assignmentEvidence.find((item) => item.serviceCallId === "call-no-policy");
    assert.equal(missingPolicy?.call.serviceCallId, "call-no-policy");
  });

  it("비완료와 invalid D row는 제외하고 missing rate는 0원 warning 담당 건으로 남긴다", async () => {
    const result = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma()
    });

    const zeroPolicyTherapist = result.settlements.find((row) => row.employeeId === therapist2.id);
    assert.ok(zeroPolicyTherapist);
    assert.equal(zeroPolicyTherapist.totalCallCount, 2);
    assert.equal(zeroPolicyTherapist.totalCommissionAmount, 900000);
    assert.equal(zeroPolicyTherapist.courseBreakdown.A.callCount, 1);
    assert.equal(zeroPolicyTherapist.courseBreakdown.A.commissionAmount, 0);
    assert.equal(zeroPolicyTherapist.assignmentEvidence[0]?.rateStatus, "zero_policy");

    const missingRateTherapist = result.settlements.find((row) => row.employeeId === therapist3.id);
    assert.ok(missingRateTherapist);
	    assert.equal(missingRateTherapist.totalCallCount, 2);
	    assert.equal(missingRateTherapist.totalCommissionAmount, 0);
	    assert.equal(missingRateTherapist.warningCounts.missingPolicy, 2);
	    assert.deepEqual(missingRateTherapist.assignmentEvidence.map((evidence) => evidence.serviceCallId), ["call-missing-rate", "call-partial-missing-rate"]);
	    assert.equal(missingRateTherapist.assignmentEvidence[0]?.rateStatus, "missing_policy");
	    assert.equal(missingRateTherapist.assignmentEvidence[1]?.role, "THERAPIST_2");
	    assert.equal(missingRateTherapist.assignmentEvidence[1]?.rateStatus, "missing_policy");

	    assert.equal(result.warningCounts.therapistRateMissing, 2);
	    assert.equal(result.warningCounts.secondTherapistRequired, 1);
    assert.equal(result.excludedCallCount, 3);
    assert.equal(result.settlements.some((row) => row.assignmentEvidence.some((evidence) => evidence.serviceCallId === "call-invalid-d")), false);
    assert.equal(result.settlements.some((row) => row.assignmentEvidence.some((evidence) => evidence.serviceCallId === "call-reserved")), false);
  });

  it("지급 확인(ADR 0004)이 없는 마사지사별 일일정산 행은 미확인이다", async () => {
    const result = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma()
    });

    const therapist = result.settlements.find((row) => row.employeeId === therapist1.id);
    assert.ok(therapist);
    assert.equal(therapist.payoutConfirmation.status, "unconfirmed");
    assert.equal(therapist.payoutConfirmation.lastConfirmedAmount, null);
    assert.equal(therapist.payoutConfirmation.currentAmount, therapist.totalCommissionAmount);
    assert.deepEqual(therapist.payoutConfirmation.history, []);
  });

  it("금액 없이 옮겨진 기존 지급완료 사건은 확인 금액 미기록으로 보이고, 작성중·검토중 운영월에서는 재확인 필요로 센다", async () => {
    const seeded = [
      {
        id: "migrated-1",
        unitType: "THERAPIST_DAILY",
        operatingMonthId: "month-2026-06",
        serviceDate: dbDate("2026-06-10"),
        employeeId: therapist1.id,
        eventType: "confirm",
        amount: null,
        reason: null,
        actorAccountId: "account-admin",
        actorAccount: { accountId: "admin", employee: { displayName: "관리자", staffCode: "ADM-001" } },
        occurredAt: new Date("2026-06-10T13:00:00.000Z"),
        createdAt: new Date("2026-06-10T13:00:00.000Z")
      }
    ];

    const drafting = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma({ seedPayoutConfirmationEvents: seeded })
    });
    const therapistDrafting = drafting.settlements.find((row) => row.employeeId === therapist1.id);
    assert.equal(therapistDrafting?.payoutConfirmation.status, "confirmed_amount_unrecorded");
    assert.equal(therapistDrafting?.payoutConfirmation.lastConfirmedAmount, null);
    assert.equal(therapistDrafting?.payoutConfirmation.requiresReconfirmation, true);

    const locked = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient: createSettlementPrisma({ seedPayoutConfirmationEvents: seeded, operatingMonthStatus: "마감확정" })
    });
    const therapistLocked = locked.settlements.find((row) => row.employeeId === therapist1.id);
    assert.equal(therapistLocked?.payoutConfirmation.status, "confirmed_amount_unrecorded");
    assert.equal(therapistLocked?.payoutConfirmation.requiresReconfirmation, false);
  });

  it("조회 날짜는 YYYY-MM-DD만 허용한다", async () => {
    await assert.rejects(
      () =>
        listTherapistDailySettlements({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026/06/10",
          prismaClient: createSettlementPrisma()
        }),
      /YYYY-MM-DD/
    );
  });
});

describe("confirmTherapistDailySettlementPayout", () => {
  it("확인 당시 금액·처리자·시각을 사건으로 남기고, 다시 조회하면 확인됨으로 보인다", async () => {
    const prismaClient = createSettlementPrisma();

    const result = await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist2.id,
      actorId: "account-admin",
      prismaClient
    });

    assert.equal(result.payoutConfirmation.status, "confirmed");
    assert.equal(result.payoutConfirmation.lastConfirmedAmount, 900000);

    const relisted = await listTherapistDailySettlements({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient });
    const therapist = relisted.settlements.find((row) => row.employeeId === therapist2.id);
    assert.equal(therapist?.payoutConfirmation.status, "confirmed");
    assert.equal(therapist?.payoutConfirmation.history[0]?.actorAccountId, "account-admin");
  });

  it("해당 날짜에 담당 콜이 없는 마사지사의 확인을 거절한다", async () => {
    const idleTherapist = {
      id: "therapist-idle",
      displayName: "휴무 마사지사",
      staffCode: "THR-IDLE",
      employeeGroup: "THERAPIST",
      sortOrder: 9,
      isActive: true
    };

    await assert.rejects(
      () =>
        confirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: idleTherapist.id,
          actorId: "account-admin",
          prismaClient: createSettlementPrisma({ extraEmployees: [idleTherapist] })
        }),
      /정산 대상 콜이 없는 마사지사/
    );
  });

  it("비활성이거나 THERAPIST가 아닌 직원의 확인을 거절한다", async () => {
    const opsEmployee = { id: "ops-1", displayName: "운영팀1", staffCode: "OPS-001", employeeGroup: "OPERATIONS", sortOrder: 1, isActive: true };

    await assert.rejects(
      () =>
        confirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: opsEmployee.id,
          actorId: "account-admin",
          prismaClient: createSettlementPrisma({ extraEmployees: [opsEmployee] })
        }),
      /활성 마사지사만 지급 확인을 변경할 수 있습니다/
    );
  });

  it("마감확정·잠금 운영월에서는 확인을 쓸 수 없다", async () => {
    await assert.rejects(
      () =>
        confirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: therapist2.id,
          actorId: "account-admin",
          prismaClient: createSettlementPrisma({ operatingMonthStatus: "잠금" })
        }),
      /마감확정 또는 잠금 운영월/
    );
  });

  it("이미 확인된 단위를 다시 확인하면 거절된다(재확인을 쓰라고 안내)", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist2.id,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        confirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: therapist2.id,
          actorId: "account-admin",
          prismaClient
        }),
      /이미 확인된 지급 확인/
    );
  });
});

describe("listTherapistDailyPayoutConfirmationsForMonth", () => {
  it("운영월의 모든 날짜·마사지사 지급 확인 상태를 한 번에 돌려준다(티켓 32·33)", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist2.id,
      actorId: "account-admin",
      prismaClient
    });

    const results = await listTherapistDailyPayoutConfirmationsForMonth({ operatingMonthId: "month-2026-06", prismaClient });

    // 이 fixture는 모든 콜이 2026-06-10에만 있어, 담당 콜이 있는 그날에만 마사지사별 행이 생긴다.
    const confirmedOnTarget = results.find((row) => row.serviceDate === "2026-06-10" && row.employeeId === therapist2.id);
    assert.equal(confirmedOnTarget?.payoutConfirmation.status, "confirmed");
    const unconfirmedSameDay = results.find((row) => row.serviceDate === "2026-06-10" && row.employeeId === therapist1.id);
    assert.equal(unconfirmedSameDay?.payoutConfirmation.status, "unconfirmed");
    assert.equal(results.some((row) => row.serviceDate === "2026-06-11"), false);
  });

  it("운영월을 찾을 수 없으면 거절한다", async () => {
    await assert.rejects(
      () => listTherapistDailyPayoutConfirmationsForMonth({ operatingMonthId: "missing-month", prismaClient: createSettlementPrisma() }),
      /운영월을 찾을 수 없습니다/
    );
  });
});

describe("reconfirmTherapistDailySettlementPayout", () => {
  it("사유와 함께 재확인하면 현재 금액이 새 기준이 되고, 이전 확인 기록은 남는다", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist1.id,
      actorId: "account-admin",
      prismaClient
    });

    const reconfirmed = await reconfirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist1.id,
      actorId: "account-admin",
      reason: "출근 정정으로 금액 재확인",
      prismaClient
    });

    assert.equal(reconfirmed.payoutConfirmation.history.length, 2);
    assert.equal(reconfirmed.payoutConfirmation.history[0].eventType, "reconfirm");
    assert.equal(reconfirmed.payoutConfirmation.history[0].reason, "출근 정정으로 금액 재확인");
  });

  it("확인된 사건이 없으면 재확인을 거절한다", async () => {
    await assert.rejects(
      () =>
        reconfirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: therapist1.id,
          actorId: "account-admin",
          reason: "사유",
          prismaClient: createSettlementPrisma()
        }),
      /확인된 지급 확인이 없어/
    );
  });

  it("사유가 비어 있으면 재확인을 거절한다", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist1.id,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        reconfirmTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: therapist1.id,
          actorId: "account-admin",
          reason: "   ",
          prismaClient
        }),
      /재확인 사유를 입력하세요/
    );
  });
});

describe("releaseTherapistDailySettlementPayout", () => {
  it("사유와 함께 해제하면 미확인으로 돌아가고, 담당 콜 여부와 무관하게 허용한다", async () => {
    const idleTherapist = {
      id: "therapist-idle",
      displayName: "휴무 마사지사",
      staffCode: "THR-IDLE",
      employeeGroup: "THERAPIST",
      sortOrder: 9,
      isActive: true
    };
    const seeded = [
      {
        id: "migrated-idle",
        unitType: "THERAPIST_DAILY",
        operatingMonthId: "month-2026-06",
        serviceDate: dbDate("2026-06-10"),
        employeeId: idleTherapist.id,
        eventType: "confirm",
        amount: null,
        reason: null,
        actorAccountId: "account-admin",
        actorAccount: { accountId: "admin", employee: { displayName: "관리자", staffCode: "ADM-001" } },
        occurredAt: new Date("2026-06-10T13:00:00.000Z"),
        createdAt: new Date("2026-06-10T13:00:00.000Z")
      }
    ];

    const released = await releaseTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: idleTherapist.id,
      actorId: "account-admin",
      reason: "잘못 이관된 확인을 해제",
      prismaClient: createSettlementPrisma({ extraEmployees: [idleTherapist], seedPayoutConfirmationEvents: seeded })
    });

    assert.equal(released.payoutConfirmation.status, "unconfirmed");
    assert.equal(released.payoutConfirmation.history[0].eventType, "release");
    assert.equal(released.payoutConfirmation.history[0].reason, "잘못 이관된 확인을 해제");
  });

  it("사유 없는 해제는 거절한다", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist1.id,
      actorId: "account-admin",
      prismaClient
    });

    await assert.rejects(
      () =>
        releaseTherapistDailySettlementPayout({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          employeeId: therapist1.id,
          actorId: "account-admin",
          reason: "",
          prismaClient
        }),
      /해제 사유를 입력하세요/
    );
  });
});

describe("listTherapistDailyPayoutConfirmationsForMonth", () => {
  it("운영월의 모든 날짜·마사지사 지급 확인 상태를 한 번에 돌려준다(티켓 32·33)", async () => {
    const prismaClient = createSettlementPrisma();
    await confirmTherapistDailySettlementPayout({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      employeeId: therapist1.id,
      actorId: "account-admin",
      prismaClient
    });
    const dayResult = await listTherapistDailySettlements({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    const results = await listTherapistDailyPayoutConfirmationsForMonth({ operatingMonthId: "month-2026-06", prismaClient });

    // 콜이 2026-06-10에만 있어, 그날 담당 콜이 있는 마사지사 수만큼만 행이 생긴다(귀케어·운영팀과 달리
    // 활성 전원을 매일 미리 채우지 않는다. assertPayoutHasSettlement과 같은 전제).
    assert.equal(results.length, dayResult.settlements.length);
    const confirmedOnTarget = results.find((row) => row.serviceDate === "2026-06-10" && row.employeeId === therapist1.id);
    assert.equal(confirmedOnTarget?.payoutConfirmation.status, "confirmed");
    const otherDay = results.find((row) => row.serviceDate === "2026-06-11" && row.employeeId === therapist1.id);
    assert.equal(otherDay, undefined);
  });

  it("운영월을 찾을 수 없으면 거절한다", async () => {
    await assert.rejects(
      listTherapistDailyPayoutConfirmationsForMonth({ operatingMonthId: "missing-month", prismaClient: createSettlementPrisma() }),
      /운영월을 찾을 수 없습니다/
    );
  });
});
