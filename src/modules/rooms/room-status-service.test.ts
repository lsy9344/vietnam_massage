import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listRoomStatuses, RoomStatusDomainError } from "@/modules/rooms/room-status-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma() {
  const operatingMonths = new Map<string, any>([
    [
      "month-2034-06",
      {
        id: "month-2034-06",
        monthKey: "2034-06",
        startDate: dbDate("2034-06-01"),
        endDate: dbDate("2034-06-30"),
        status: "작성중",
        createdAt: new Date("2034-06-01T00:00:00.000Z"),
        updatedAt: new Date("2034-06-01T00:00:00.000Z")
      }
    ]
  ]);
  const rooms = new Map<string, any>(
    Array.from({ length: 11 }, (_, index) => {
      const floor = index < 3 ? 1 : index < 6 ? 2 : index < 9 ? 3 : 4;
      const number = `${floor}0${(index % 3) + 1}`;
      return [
        `room-${number}`,
        {
          id: `room-${number}`,
          displayName: `${number} 호실`,
          migrationReferenceName: `${index + 1}번방`,
          sortOrder: (index + 1) * 10,
          isActive: true,
          createdAt: new Date(`2034-06-01T00:${String(index).padStart(2, "0")}:00.000Z`),
          updatedAt: new Date(`2034-06-01T00:${String(index).padStart(2, "0")}:00.000Z`)
        }
      ];
    })
  );
  const courses = new Map<string, any>([
    ["course-a", { id: "course-a", code: "A", isActive: true, createdAt: new Date("2034-06-01T00:00:00.000Z"), updatedAt: new Date("2034-06-01T00:00:00.000Z") }],
    ["course-b", { id: "course-b", code: "B", isActive: true, createdAt: new Date("2034-06-01T00:00:00.000Z"), updatedAt: new Date("2034-06-01T00:00:00.000Z") }],
    ["course-missing-policy", { id: "course-missing-policy", code: "Z", isActive: true, createdAt: new Date("2034-06-01T00:00:00.000Z"), updatedAt: new Date("2034-06-01T00:00:00.000Z") }]
  ]);
  const coursePolicies = new Map<string, any>([
    [
      "policy-a",
      {
        id: "policy-a",
        courseId: "course-a",
        name: "A 누루60",
        durationMinutes: 60,
        basePrice: 1500000,
        opsCallCredit: 1,
        earcarePoolAmount: 100000,
        requiresSecondTherapist: false,
        tvDisplayName: "A60",
        effectiveFromMonth: "2034-01",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2034-01-01T00:00:00.000Z"),
        updatedAt: new Date("2034-01-01T00:00:00.000Z")
      }
    ],
    [
      "policy-b",
      {
        id: "policy-b",
        courseId: "course-b",
        name: "B 귀청소90",
        durationMinutes: 90,
        basePrice: 1800000,
        opsCallCredit: 1,
        earcarePoolAmount: 200000,
        requiresSecondTherapist: false,
        tvDisplayName: "B90",
        effectiveFromMonth: "2034-01",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2034-01-01T00:00:00.000Z"),
        updatedAt: new Date("2034-01-01T00:00:00.000Z")
      }
    ]
  ]);
  const employees = new Map<string, any>([
    ["therapist-1", { id: "therapist-1", displayName: "마사지사1", staffCode: "THR-001", employeeGroup: "THERAPIST", sortOrder: 1, isActive: true }],
    ["therapist-2", { id: "therapist-2", displayName: "마사지사2", staffCode: "THR-002", employeeGroup: "THERAPIST", sortOrder: 2, isActive: true }],
    ["earcare-1", { id: "earcare-1", displayName: "귀케어1", staffCode: "EAR-001", employeeGroup: "EARCARE", sortOrder: 1, isActive: true }]
  ]);
  const serviceCalls = new Map<string, any>();
  const assignments = new Map<string, any>();
  const writeOperations: string[] = [];

  function sameDate(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  function withRelations(call: any) {
    const course = courses.get(call.courseId);
    return {
      ...call,
      operatingMonth: operatingMonths.get(call.operatingMonthId),
      room: rooms.get(call.roomId),
      course: {
        ...course,
        policies: [...coursePolicies.values()].filter((policy) => policy.courseId === call.courseId)
      },
      assignments: [...assignments.values()]
        .filter((assignment) => assignment.serviceCallId === call.id && assignment.isActive !== false)
        .map((assignment) => ({ ...assignment, employee: employees.get(assignment.employeeId) }))
    };
  }

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        return operatingMonths.get(where.id) ?? null;
      }
    },
    room: {
      async findMany({ where }: any = {}) {
        return [...rooms.values()]
          .filter((room) => (where?.isActive === undefined ? true : room.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.getTime() - b.createdAt.getTime());
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return [...coursePolicies.values()].filter(
          (policy) => (where?.courseId === undefined || policy.courseId === where.courseId) && (where?.isActive === undefined || policy.isActive === where.isActive)
        );
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        return [...serviceCalls.values()]
          .filter(
            (call) =>
              (where?.operatingMonthId === undefined || call.operatingMonthId === where.operatingMonthId) &&
              (where?.serviceDate === undefined || sameDate(call.serviceDate, where.serviceDate)) &&
              (where?.status?.in === undefined || where.status.in.includes(call.status))
          )
          .map(withRelations);
      },
      async create() {
        writeOperations.push("serviceCall.create");
        throw new Error("room status service must be read-only");
      },
      async updateMany() {
        writeOperations.push("serviceCall.updateMany");
        throw new Error("room status service must be read-only");
      },
      async deleteMany() {
        writeOperations.push("serviceCall.deleteMany");
        throw new Error("room status service must be read-only");
      }
    },
    serviceCallAssignment: {
      async create() {
        writeOperations.push("serviceCallAssignment.create");
        throw new Error("room status service must be read-only");
      }
    },
    serviceCallStatusHistory: {
      async create() {
        writeOperations.push("serviceCallStatusHistory.create");
        throw new Error("room status service must be read-only");
      }
    },
    settlement: {
      async create() {
        writeOperations.push("settlement.create");
        throw new Error("room status service must be read-only");
      }
    },
    closing: {
      async create() {
        writeOperations.push("closing.create");
        throw new Error("room status service must be read-only");
      }
    },
    auditLog: {
      async create() {
        writeOperations.push("auditLog.create");
        throw new Error("room status service must be read-only");
      }
    },
    serviceCalls,
    assignments,
    writeOperations
  };

  function addCall(input: {
    id: string;
    roomId: string;
    status: string;
    startTime: string;
    courseId?: string;
    createdAt?: string;
    updatedAt?: string;
    serviceDate?: string;
  }) {
    serviceCalls.set(input.id, {
      id: input.id,
      operatingMonthId: "month-2034-06",
      serviceDate: dbDate(input.serviceDate ?? "2034-06-05"),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId ?? "course-a",
      customerMemo: null,
      status: input.status,
      discountTypeCode: null,
      paymentMethodCode: null,
      note: null,
      confirmationCode: null,
      createdAt: new Date(input.createdAt ?? "2034-06-05T00:00:00.000Z"),
      updatedAt: new Date(input.updatedAt ?? "2034-06-05T00:00:00.000Z")
    });
  }

  function addAssignment(serviceCallId: string, assignmentRole: string, employeeId: string, isActive = true) {
    assignments.set(`${serviceCallId}-${assignmentRole}`, {
      id: `${serviceCallId}-${assignmentRole}`,
      serviceCallId,
      employeeId,
      assignmentRole,
      isActive,
      createdAt: new Date("2034-06-05T00:00:00.000Z"),
      updatedAt: new Date("2034-06-05T00:00:00.000Z")
    });
  }

  return { client, addCall, addAssignment };
}

describe("room status service", () => {
  it("returns all 11 active rooms in sort order and empty rooms as 빈방 DTOs", async () => {
    const { client } = createMemoryPrisma();

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T12:00:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses.length, 11);
    assert.deepEqual(
      statuses.map((status) => status.roomSortOrder),
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]
    );
    assert.equal(statuses[0].roomId, "room-101");
    assert.equal(statuses[0].displayStatus, "빈방");
    assert.equal(statuses[0].sourceCallStatus, null);
    assert.equal(statuses[0].activeCallId, null);
    assert.equal(statuses[0].expectedEndAt, null);
    assert.equal(statuses[0].remainingMinutes, null);
    assert.equal(statuses[0].course, null);
    assert.equal(statuses[0].therapist1, null);
    assert.equal(statuses[0].guidanceText, "입실 가능합니다.");
  });

  it("maps 예약, 청소중, 사용중 active calls with course and active assignees", async () => {
    const { client, addCall, addAssignment } = createMemoryPrisma();
    addCall({ id: "call-reserved", roomId: "room-101", status: "RESERVED", startTime: "11:00", courseId: "course-a" });
    addCall({ id: "call-cleaning", roomId: "room-102", status: "청소중", startTime: "11:30", courseId: "course-b" });
    addCall({ id: "call-in-use", roomId: "room-103", status: "사용중", startTime: "11:00", courseId: "course-a" });
    addAssignment("call-in-use", "THERAPIST_1", "therapist-1");
    addAssignment("call-in-use", "THERAPIST_2", "therapist-2");
    addAssignment("call-in-use", "EARCARE", "earcare-1");

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:15:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses[0].displayStatus, "예약");
    assert.equal(statuses[0].sourceCallStatus, "RESERVED");
    assert.equal(statuses[0].course?.tvDisplayName, "A60");
    assert.equal(statuses[1].displayStatus, "청소중");
    assert.equal(statuses[1].sourceCallStatus, "청소중");
    assert.equal(statuses[2].displayStatus, "사용중");
    assert.equal(statuses[2].sourceCallStatus, "사용중");
    assert.equal(statuses[2].remainingMinutes, 45);
    assert.equal(statuses[2].therapist1?.id, "therapist-1");
    assert.equal(statuses[2].therapist2?.staffCode, "THR-002");
    assert.equal(statuses[2].earcare?.displayName, "귀케어1");
  });

  it("excludes 방문완료, 노쇼, and 취소 statuses from current room occupancy", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-complete", roomId: "room-101", status: "VISIT_COMPLETE", startTime: "11:00" });
    addCall({ id: "call-noshow", roomId: "room-102", status: "NO_SHOW", startTime: "11:00" });
    addCall({ id: "call-canceled", roomId: "room-103", status: "CANCELED", startTime: "11:00" });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:15:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses[0].displayStatus, "빈방");
    assert.equal(statuses[1].displayStatus, "빈방");
    assert.equal(statuses[2].displayStatus, "빈방");
  });

  it("selects the latest active call by normalized service date, start time, and deterministic tie breaker", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({
      id: "call-early-next-day",
      roomId: "room-101",
      status: "예약",
      startTime: "01:00",
      createdAt: "2034-06-05T00:01:00.000Z",
      updatedAt: "2034-06-05T00:01:00.000Z"
    });
    addCall({
      id: "call-late-evening",
      roomId: "room-101",
      status: "사용중",
      startTime: "23:30",
      createdAt: "2034-06-05T00:02:00.000Z",
      updatedAt: "2034-06-05T00:02:00.000Z"
    });
    addCall({
      id: "call-tie-winner",
      roomId: "room-102",
      status: "예약",
      startTime: "11:00",
      createdAt: "2034-06-05T00:05:00.000Z",
      updatedAt: "2034-06-05T00:06:00.000Z"
    });
    addCall({
      id: "call-tie-loser",
      roomId: "room-102",
      status: "청소중",
      startTime: "11:00",
      createdAt: "2034-06-05T00:04:00.000Z",
      updatedAt: "2034-06-05T00:05:00.000Z"
    });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-06T00:15:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses[0].activeCallId, "call-early-next-day");
    assert.equal(statuses[0].displayStatus, "예약");
    assert.equal(statuses[1].activeCallId, "call-tie-winner");
    assert.equal(statuses[1].displayStatus, "예약");
  });

  it("calculates cross-midnight expected end and clamps elapsed 사용중 to 종료확인 without negative remaining minutes", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-cross-midnight", roomId: "room-101", status: "사용중", startTime: "23:30", courseId: "course-b" });
    addCall({ id: "call-elapsed", roomId: "room-102", status: "사용중", startTime: "11:00", courseId: "course-a" });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-06T00:15:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses[0].displayStatus, "사용중");
    assert.equal(statuses[0].expectedEndAt, "2034-06-05T16:00:00.000Z");
    assert.equal(statuses[0].remainingMinutes, 45);
    assert.equal(statuses[1].displayStatus, "종료확인");
    assert.equal(statuses[1].sourceCallStatus, "사용중");
    assert.equal(statuses[1].remainingMinutes, 0);
  });

  it("keeps active occupancy when course policy is missing and nulls time calculation fields", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-missing-policy", roomId: "room-101", status: "사용중", startTime: "11:00", courseId: "course-missing-policy" });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:15:00.000+09:00"),
      prismaClient: client
    });

    assert.equal(statuses[0].displayStatus, "사용중");
    assert.equal(statuses[0].activeCallId, "call-missing-policy");
    assert.equal(statuses[0].course, null);
    assert.equal(statuses[0].expectedEndAt, null);
    assert.equal(statuses[0].remainingMinutes, null);
  });

  it("performs read-only queries and never writes service-call, settlement, closing, or audit data", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-read-only", roomId: "room-101", status: "사용중", startTime: "11:00" });

    await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:15:00.000+09:00"),
      prismaClient: client
    });

    assert.deepEqual(client.writeOperations, []);
  });

  it("rejects invalid service dates and impossible start times before returning misleading room status DTOs", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-invalid-start-time", roomId: "room-101", status: "사용중", startTime: "24:00" });

    await assert.rejects(
      () =>
        listRoomStatuses({
          operatingMonthId: "month-2034-06",
          serviceDate: "2034-02-31",
          now: new Date("2034-06-05T11:15:00.000+09:00"),
          prismaClient: client
        }),
      (error) => error instanceof RoomStatusDomainError && error.code === "INVALID_SERVICE_DATE"
    );

    await assert.rejects(
      () =>
        listRoomStatuses({
          operatingMonthId: "month-2034-06",
          serviceDate: "2034-06-05",
          now: new Date("2034-06-05T11:15:00.000+09:00"),
          prismaClient: client
        }),
      (error) => error instanceof RoomStatusDomainError && error.code === "INVALID_START_TIME"
    );
  });
});
