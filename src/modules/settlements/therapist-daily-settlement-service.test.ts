import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createSettlementPrisma() {
  const createdAt = new Date("2026-06-09T00:00:00.000Z");
  const updatedAt = new Date("2026-06-09T00:10:00.000Z");
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-30"),
    status: "작성중",
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
    [therapist3.id, therapist3]
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

  return {
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
      }
    }
  } as any;
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
