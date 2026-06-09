import { expect, test } from "@playwright/test";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import type { RoomStatusDto } from "@/modules/rooms/dtos";

const operatingMonthId = "story31-month";
const serviceDate = "2034-07-05";
const nowDuringCrossMidnight = new Date("2034-07-06T00:15:00.000+09:00");

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma() {
  const operatingMonths = new Map<string, any>([[operatingMonthId, { id: operatingMonthId, monthKey: "2034-07" }]]);
  const rooms = new Map<string, any>(
    Array.from({ length: 11 }, (_, index) => {
      const roomNumber = String(index + 1).padStart(2, "0");
      return [
        `story31-room-${roomNumber}`,
        {
          id: `story31-room-${roomNumber}`,
          displayName: `E2E31 ${roomNumber} 호실`,
          sortOrder: 93110 + index * 10,
          isActive: true,
          createdAt: new Date(`2034-07-01T00:${String(index).padStart(2, "0")}:00.000Z`),
          updatedAt: new Date(`2034-07-01T00:${String(index).padStart(2, "0")}:00.000Z`)
        }
      ];
    })
  );
  const courses = new Map<string, any>([
    ["story31-course-a", { id: "story31-course-a", code: "S31A", isActive: true }],
    ["story31-course-b", { id: "story31-course-b", code: "S31B", isActive: true }],
    ["story31-course-missing-policy", { id: "story31-course-missing-policy", code: "S31Z", isActive: true }]
  ]);
  const coursePolicies = new Map<string, any>([
    [
      "story31-policy-a",
      {
        id: "story31-policy-a",
        courseId: "story31-course-a",
        name: "Story31 A 60",
        tvDisplayName: "S31 A60",
        durationMinutes: 60,
        effectiveFromMonth: "2034-07",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2034-07-01T00:00:00.000Z")
      }
    ],
    [
      "story31-policy-b",
      {
        id: "story31-policy-b",
        courseId: "story31-course-b",
        name: "Story31 B 90",
        tvDisplayName: "S31 B90",
        durationMinutes: 90,
        effectiveFromMonth: "2034-07",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2034-07-01T00:00:00.000Z")
      }
    ]
  ]);
  const employees = new Map<string, any>([
    ["story31-therapist", { id: "story31-therapist", displayName: "E2E31 마사지사", staffCode: "E2E31-THR-001" }],
    ["story31-earcare", { id: "story31-earcare", displayName: "E2E31 귀케어", staffCode: "E2E31-EAR-001" }]
  ]);
  const serviceCalls = new Map<string, any>();
  const assignments = new Map<string, any>();
  const writeOperations: string[] = [];

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
          .filter((room) => where?.isActive === undefined || room.isActive === where.isActive)
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
              (where?.serviceDate === undefined || call.serviceDate.toISOString().slice(0, 10) === where.serviceDate.toISOString().slice(0, 10)) &&
              (where?.status?.in === undefined || where.status.in.includes(call.status))
          )
          .map(withRelations);
      },
      async create() {
        writeOperations.push("serviceCall.create");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      },
      async update() {
        writeOperations.push("serviceCall.update");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      },
      async deleteMany() {
        writeOperations.push("serviceCall.deleteMany");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      }
    },
    serviceCallStatusHistory: {
      async create() {
        writeOperations.push("serviceCallStatusHistory.create");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      }
    },
    auditLog: {
      async create() {
        writeOperations.push("auditLog.create");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      }
    },
    dailyExpense: {
      async create() {
        writeOperations.push("dailyExpense.create");
        throw new Error("Story 3.1 E2E service call must stay read-only");
      }
    },
    writeOperations
  };

  function addCall(input: {
    id: string;
    roomId: string;
    status: string;
    startTime: string;
    courseId: string;
    createdAt?: string;
    updatedAt?: string;
  }) {
    serviceCalls.set(input.id, {
      id: input.id,
      operatingMonthId,
      serviceDate: dbDate(serviceDate),
      startTime: input.startTime,
      roomId: input.roomId,
      courseId: input.courseId,
      status: input.status,
      createdAt: new Date(input.createdAt ?? "2034-07-05T00:00:00.000Z"),
      updatedAt: new Date(input.updatedAt ?? "2034-07-05T00:00:00.000Z")
    });
  }

  function addAssignment(serviceCallId: string, assignmentRole: "THERAPIST_1" | "THERAPIST_2" | "EARCARE", employeeId: string) {
    assignments.set(`${serviceCallId}-${assignmentRole}`, {
      id: `${serviceCallId}-${assignmentRole}`,
      serviceCallId,
      assignmentRole,
      employeeId,
      isActive: true
    });
  }

  addCall({
    id: "story31-room01-2330-loser",
    roomId: "story31-room-01",
    status: "사용중",
    startTime: "23:30",
    courseId: "story31-course-b",
    createdAt: "2034-07-05T00:01:00.000Z",
    updatedAt: "2034-07-05T00:01:00.000Z"
  });
  addCall({
    id: "story31-room01-0100-latest",
    roomId: "story31-room-01",
    status: "RESERVED",
    startTime: "01:00",
    courseId: "story31-course-a",
    createdAt: "2034-07-05T00:02:00.000Z",
    updatedAt: "2034-07-05T00:02:00.000Z"
  });
  addCall({ id: "story31-room02-cross-midnight", roomId: "story31-room-02", status: "사용중", startTime: "23:30", courseId: "story31-course-b" });
  addAssignment("story31-room02-cross-midnight", "THERAPIST_1", "story31-therapist");
  addAssignment("story31-room02-cross-midnight", "EARCARE", "story31-earcare");
  addCall({ id: "story31-room03-elapsed", roomId: "story31-room-03", status: "IN_USE", startTime: "11:00", courseId: "story31-course-a" });
  addCall({ id: "story31-room04-cleaning", roomId: "story31-room-04", status: "CLEANING", startTime: "12:00", courseId: "story31-course-a" });
  addCall({ id: "story31-room05-complete-excluded", roomId: "story31-room-05", status: "VISIT_COMPLETE", startTime: "12:00", courseId: "story31-course-a" });
  addCall({ id: "story31-room06-no-show-excluded", roomId: "story31-room-06", status: "NO_SHOW", startTime: "12:00", courseId: "story31-course-a" });
  addCall({ id: "story31-room07-canceled-excluded", roomId: "story31-room-07", status: "CANCELED", startTime: "12:00", courseId: "story31-course-a" });
  addCall({ id: "story31-room08-missing-policy", roomId: "story31-room-08", status: "사용중", startTime: "13:00", courseId: "story31-course-missing-policy" });

  return client;
}

function storyRooms(statuses: RoomStatusDto[]) {
  return statuses.filter((status) => status.roomDisplayName.startsWith("E2E31 "));
}

test.describe("Story 3.1 room status DTO service", () => {
  test("returns consistent RoomStatusDto values without mutating operational data", async () => {
    const client = createMemoryPrisma();

    const statuses = storyRooms(
      await listRoomStatuses({
        operatingMonthId,
        serviceDate,
        now: nowDuringCrossMidnight,
        prismaClient: client
      })
    );

    expect(statuses).toHaveLength(11);
    expect(statuses.map((status) => status.roomSortOrder)).toEqual([93110, 93120, 93130, 93140, 93150, 93160, 93170, 93180, 93190, 93200, 93210]);

    expect(statuses[0]).toMatchObject({
      displayStatus: "예약",
      sourceCallStatus: "RESERVED",
      startTime: "01:00",
      remainingMinutes: null,
      guidanceText: "예약 고객 입실 준비가 필요합니다."
    });
    expect(statuses[0].activeCallId).toBe("story31-room01-0100-latest");
    expect(statuses[0].course?.tvDisplayName).toBe("S31 A60");

    expect(statuses[1]).toMatchObject({
      displayStatus: "사용중",
      sourceCallStatus: "사용중",
      startTime: "23:30",
      expectedEndAt: "2034-07-05T16:00:00.000Z",
      remainingMinutes: 45
    });
    expect(statuses[1].remainingMinutes).toBeGreaterThanOrEqual(0);
    expect(statuses[1].therapist1?.staffCode).toBe("E2E31-THR-001");
    expect(statuses[1].earcare?.displayName).toBe("E2E31 귀케어");

    expect(statuses[2]).toMatchObject({
      displayStatus: "종료확인",
      sourceCallStatus: "IN_USE",
      remainingMinutes: 0,
      guidanceText: "종료 확인이 필요합니다."
    });
    expect(statuses[3]).toMatchObject({ displayStatus: "청소중", sourceCallStatus: "CLEANING", remainingMinutes: null });

    for (const excludedStatus of statuses.slice(4, 7)) {
      expect(excludedStatus).toMatchObject({
        displayStatus: "빈방",
        sourceCallStatus: null,
        activeCallId: null,
        expectedEndAt: null,
        remainingMinutes: null
      });
    }

    expect(statuses[7]).toMatchObject({
      displayStatus: "사용중",
      sourceCallStatus: "사용중",
      course: null,
      expectedEndAt: null,
      remainingMinutes: null
    });
    for (const emptyStatus of statuses.slice(8)) {
      expect(emptyStatus.displayStatus).toBe("빈방");
      expect(emptyStatus.activeCallId).toBeNull();
    }

    expect(client.writeOperations).toEqual([]);
  });
});
