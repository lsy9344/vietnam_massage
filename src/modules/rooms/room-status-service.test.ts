import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listRoomStatuses, RoomStatusDomainError } from "@/modules/rooms/room-status-service";
import type { RoomStatusDto } from "@/modules/rooms/dtos";

const defaultRoomFixtures = [
  { number: "401", migrationReferenceName: "10번방", sortOrder: 10 },
  { number: "402", migrationReferenceName: "11번방", sortOrder: 20 },
  { number: "301", migrationReferenceName: "7번방", sortOrder: 30 },
  { number: "302", migrationReferenceName: "8번방", sortOrder: 40 },
  { number: "303", migrationReferenceName: "9번방", sortOrder: 50 },
  { number: "201", migrationReferenceName: "4번방", sortOrder: 60 },
  { number: "202", migrationReferenceName: "5번방", sortOrder: 70 },
  { number: "203", migrationReferenceName: "6번방", sortOrder: 80 },
  { number: "101", migrationReferenceName: "1번방", sortOrder: 90 },
  { number: "102", migrationReferenceName: "2번방", sortOrder: 100 },
  { number: "103", migrationReferenceName: "3번방", sortOrder: 110 }
] as const;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function statusByRoom(statuses: RoomStatusDto[], roomId: string) {
  const status = statuses.find((candidate) => candidate.roomId === roomId);
  assert.ok(status, `${roomId} 상태가 필요합니다.`);
  return status;
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
    defaultRoomFixtures.map((fixture, index) => {
      return [
        `room-${fixture.number}`,
        {
          id: `room-${fixture.number}`,
          displayName: `${fixture.number} 호실`,
          migrationReferenceName: fixture.migrationReferenceName,
          sortOrder: fixture.sortOrder,
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
      statuses.map((status) => status.roomId),
      ["room-401", "room-402", "room-301", "room-302", "room-303", "room-201", "room-202", "room-203", "room-101", "room-102", "room-103"]
    );
    assert.deepEqual(
      statuses.map((status) => status.roomSortOrder),
      [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]
    );
    const room401 = statusByRoom(statuses, "room-401");
    assert.equal(room401.displayStatus, "빈방");
    assert.equal(room401.sourceCallStatus, null);
    assert.equal(room401.activeCallId, null);
    assert.equal(room401.expectedEndAt, null);
    assert.equal(room401.remainingMinutes, null);
    assert.equal(room401.course, null);
    assert.equal(room401.therapist1, null);
    assert.equal(room401.guidanceText, "입실 가능합니다.");
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

    const room101 = statusByRoom(statuses, "room-101");
    const room102 = statusByRoom(statuses, "room-102");
    const room103 = statusByRoom(statuses, "room-103");
    assert.equal(room101.displayStatus, "예약");
    assert.equal(room101.sourceCallStatus, "RESERVED");
    assert.equal(room101.course?.tvDisplayName, "A60");
    assert.equal(room102.displayStatus, "청소중");
    assert.equal(room102.sourceCallStatus, "청소중");
    assert.equal(room103.displayStatus, "사용중");
    assert.equal(room103.sourceCallStatus, "사용중");
    assert.equal(room103.remainingMinutes, 45);
    assert.equal(room103.therapist1?.id, "therapist-1");
    assert.equal(room103.therapist2?.staffCode, "THR-002");
    assert.equal(room103.earcare?.displayName, "귀케어1");
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

    assert.equal(statusByRoom(statuses, "room-101").displayStatus, "빈방");
    assert.equal(statusByRoom(statuses, "room-102").displayStatus, "빈방");
    assert.equal(statusByRoom(statuses, "room-103").displayStatus, "빈방");
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

    assert.equal(statusByRoom(statuses, "room-101").activeCallId, "call-early-next-day");
    assert.equal(statusByRoom(statuses, "room-101").displayStatus, "예약");
    assert.equal(statusByRoom(statuses, "room-102").activeCallId, "call-tie-winner");
    assert.equal(statusByRoom(statuses, "room-102").displayStatus, "예약");
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

    const room101 = statusByRoom(statuses, "room-101");
    const room102 = statusByRoom(statuses, "room-102");
    assert.equal(room101.displayStatus, "사용중");
    assert.equal(room101.expectedEndAt, "2034-06-05T16:00:00.000Z");
    assert.equal(room101.remainingMinutes, 45);
    assert.equal(room102.displayStatus, "종료확인");
    assert.equal(room102.sourceCallStatus, "사용중");
    assert.equal(room102.remainingMinutes, 0);
  });

  it("marks in-use rooms ending within 10 minutes as 종료임박", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-ending-soon", roomId: "room-101", status: "사용중", startTime: "11:00", courseId: "course-a" });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:50:00.000+09:00"),
      prismaClient: client
    });

    const room101 = statusByRoom(statuses, "room-101");
    assert.equal(room101.displayStatus, "종료임박");
    assert.equal(room101.sourceCallStatus, "사용중");
    assert.equal(room101.remainingMinutes, 10);
    assert.equal(room101.guidanceText, "종료 10분 전입니다. 결제와 다음 안내를 준비하세요.");
  });

  it("keeps in-use rooms with more than 10 minutes remaining as 사용중", async () => {
    const { client, addCall } = createMemoryPrisma();
    addCall({ id: "call-not-ending-soon", roomId: "room-101", status: "사용중", startTime: "11:00", courseId: "course-a" });

    const statuses = await listRoomStatuses({
      operatingMonthId: "month-2034-06",
      serviceDate: "2034-06-05",
      now: new Date("2034-06-05T11:49:00.000+09:00"),
      prismaClient: client
    });

    const room101 = statusByRoom(statuses, "room-101");
    assert.equal(room101.displayStatus, "사용중");
    assert.equal(room101.sourceCallStatus, "사용중");
    assert.equal(room101.remainingMinutes, 11);
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

    const room101 = statusByRoom(statuses, "room-101");
    assert.equal(room101.displayStatus, "사용중");
    assert.equal(room101.activeCallId, "call-missing-policy");
    assert.equal(room101.course, null);
    assert.equal(room101.expectedEndAt, null);
    assert.equal(room101.remainingMinutes, null);
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
