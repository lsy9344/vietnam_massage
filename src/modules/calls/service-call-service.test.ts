import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  listServiceCallFormOptions,
  listServiceCallsForDate,
  saveBasicServiceCallRow,
  ServiceCallDomainError
} from "@/modules/calls/service-call-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma() {
  const operatingMonths = new Map<string, any>([
    [
      "month-2026-06",
      {
        id: "month-2026-06",
        monthKey: "2026-06",
        startDate: dbDate("2026-06-01"),
        endDate: dbDate("2026-06-30"),
        status: "작성중",
        createdAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "month-locked",
      {
        id: "month-locked",
        monthKey: "2026-07",
        startDate: dbDate("2026-07-01"),
        endDate: dbDate("2026-07-31"),
        status: "잠금",
        createdAt: new Date("2026-07-01T00:00:00.000Z")
      }
    ]
  ]);
  const rooms = new Map<string, any>([
    ["room-101", { id: "room-101", displayName: "101 호실", sortOrder: 10, isActive: true, createdAt: new Date("2026-06-01T00:00:00.000Z") }],
    ["room-off", { id: "room-off", displayName: "비활성 호실", sortOrder: 20, isActive: false, createdAt: new Date("2026-06-01T00:01:00.000Z") }]
  ]);
  const courses = new Map<string, any>([
    ["course-a", { id: "course-a", code: "A", isActive: true, createdAt: new Date("2026-06-01T00:00:00.000Z") }]
  ]);
  const coursePolicies = new Map<string, any>([
    [
      "policy-a",
      {
        id: "policy-a",
        courseId: "course-a",
        name: "A 누루60",
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true
      }
    ]
  ]);
  const employees = new Map<string, any>([
    ["therapist-1", { id: "therapist-1", displayName: "마사지사1", staffCode: "THR-001", employeeGroup: "THERAPIST", sortOrder: 1, isActive: true }],
    ["therapist-2", { id: "therapist-2", displayName: "마사지사2", staffCode: "THR-002", employeeGroup: "THERAPIST", sortOrder: 2, isActive: true }],
    ["earcare-1", { id: "earcare-1", displayName: "귀케어1", staffCode: "EAR-001", employeeGroup: "EARCARE", sortOrder: 1, isActive: true }],
    ["ops-1", { id: "ops-1", displayName: "운영1", staffCode: "OPS-001", employeeGroup: "OPERATIONS", sortOrder: 1, isActive: true }]
  ]);
  const codeItems = new Map<string, any>(
    [
      ["SERVICE_STATUS", "예약", "예약", 10, true],
      ["SERVICE_STATUS", "취소", "취소", 60, true],
      ["DISCOUNT_TYPE", "생일자", "생일자", 20, true],
      ["PAYMENT_METHOD", "현금", "현금", 10, true],
      ["CONFIRMATION", "Y", "Y", 10, true],
      ["CONFIRMATION", "N", "N", 20, true],
      ["PAYMENT_METHOD", "비활성", "비활성", 99, false]
    ].map(([codeType, code, displayName, sortOrder, isActive]) => [
      `${codeType}:${code}`,
      { codeType, code, displayName, sortOrder, isActive, createdAt: new Date("2026-06-01T00:00:00.000Z") }
    ])
  );
  const timeSlots = new Map<string, any>([
    ["11:00", { id: "slot-1100", value: "11:00", sortOrder: 10, isActive: true, createdAt: new Date("2026-06-01T00:00:00.000Z") }],
    ["01:00", { id: "slot-0100", value: "01:00", sortOrder: 290, isActive: true, createdAt: new Date("2026-06-01T00:01:00.000Z") }]
  ]);
  const serviceCalls = new Map<string, any>();
  const assignments = new Map<string, any>();

  function sortByOrder(records: any[]) {
    return records.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  function sameDate(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  function withRelations(call: any) {
    const operatingMonth = operatingMonths.get(call.operatingMonthId);
    const course = courses.get(call.courseId);
    return {
      ...call,
      operatingMonth,
      room: rooms.get(call.roomId),
      course: {
        ...course,
        policies: [...coursePolicies.values()].filter((policy) => policy.courseId === call.courseId)
      },
      assignments: [...assignments.values()]
        .filter((assignment) => assignment.serviceCallId === call.id)
        .map((assignment) => ({ ...assignment, employee: employees.get(assignment.employeeId) }))
    };
  }

  const client: any = {
    operatingMonth: {
      async findMany() {
        return [...operatingMonths.values()].sort((a, b) => b.monthKey.localeCompare(a.monthKey));
      },
      async findUnique({ where }: any) {
        return operatingMonths.get(where.id) ?? null;
      }
    },
    room: {
      async findUnique({ where }: any) {
        return rooms.get(where.id) ?? null;
      },
      async findMany({ where }: any = {}) {
        return sortByOrder([...rooms.values()].filter((room) => (where?.isActive === undefined ? true : room.isActive === where.isActive)));
      }
    },
    course: {
      async findUnique({ where }: any) {
        return courses.get(where.id) ?? null;
      },
      async findMany() {
        return [...courses.values()].sort((a, b) => a.code.localeCompare(b.code));
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return [...coursePolicies.values()].filter(
          (policy) => (where?.courseId === undefined || policy.courseId === where.courseId) && (where?.isActive === undefined || policy.isActive === where.isActive)
        );
      }
    },
    employee: {
      async findUnique({ where }: any) {
        return employees.get(where.id) ?? null;
      },
      async findMany({ where }: any = {}) {
        return sortByOrder(
          [...employees.values()].filter(
            (employee) =>
              (where?.isActive === undefined || employee.isActive === where.isActive) &&
              (where?.employeeGroup === undefined || employee.employeeGroup === where.employeeGroup)
          )
        );
      }
    },
    codeItem: {
      async findUnique({ where }: any) {
        return codeItems.get(`${where.codeType_code.codeType}:${where.codeType_code.code}`) ?? null;
      },
      async findMany({ where }: any = {}) {
        return sortByOrder(
          [...codeItems.values()].filter(
            (code) => (where?.codeType === undefined || code.codeType === where.codeType) && (where?.isActive === undefined || code.isActive === where.isActive)
          )
        );
      }
    },
    timeSlot: {
      async findUnique({ where }: any) {
        return timeSlots.get(where.value) ?? null;
      },
      async findMany({ where }: any = {}) {
        return sortByOrder([...timeSlots.values()].filter((slot) => (where?.isActive === undefined ? true : slot.isActive === where.isActive)));
      }
    },
    serviceCall: {
      async create({ data }: any) {
        const record = {
          id: `call-${serviceCalls.size + 1}`,
          ...data,
          createdAt: new Date(`2026-06-09T00:0${serviceCalls.size}:00.000Z`),
          updatedAt: new Date(`2026-06-09T00:0${serviceCalls.size}:00.000Z`)
        };
        serviceCalls.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        return [...serviceCalls.values()]
          .filter(
            (call) =>
              (where?.operatingMonthId === undefined || call.operatingMonthId === where.operatingMonthId) &&
              (where?.serviceDate === undefined || sameDate(call.serviceDate, where.serviceDate))
          )
          .map(withRelations);
      },
      async findUnique({ where }: any) {
        const record = serviceCalls.get(where.id);
        return record ? withRelations(record) : null;
      },
      async updateMany({ where, data }: any) {
        const record = serviceCalls.get(where.id);
        if (!record || (where.operatingMonthId && record.operatingMonthId !== where.operatingMonthId)) {
          return { count: 0 };
        }
        serviceCalls.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T01:00:00.000Z") });
        return { count: 1 };
      }
    },
    serviceCallAssignment: {
      async create({ data }: any) {
        const record = {
          id: `assignment-${assignments.size + 1}`,
          ...data,
          createdAt: new Date("2026-06-09T00:00:00.000Z"),
          updatedAt: new Date("2026-06-09T00:00:00.000Z")
        };
        assignments.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        return [...assignments.values()].filter(
          (assignment) =>
            (where?.serviceCallId === undefined || assignment.serviceCallId === where.serviceCallId) &&
            (where?.assignmentRole === undefined || assignment.assignmentRole === where.assignmentRole)
        );
      },
      async updateMany({ where, data }: any) {
        const record = assignments.get(where.id);
        if (!record) return { count: 0 };
        assignments.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T01:00:00.000Z") });
        return { count: 1 };
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    serviceCalls,
    assignments
  };

  return client;
}

describe("service call service", () => {
  it("returns an explicit empty result for a date with no call ledger rows", async () => {
    const prismaClient = createMemoryPrisma();

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.deepEqual(rows, []);
  });

  it("saves a basic row with stable IDs/codes and reconstructs assignment columns for 조회", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "단골 고객",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      earcareEmployeeId: "earcare-1",
      status: "예약",
      discountTypeCode: "생일자",
      paymentMethodCode: "현금",
      note: "조용한 방 선호",
      confirmationCode: "Y",
      prismaClient
    });

    assert.equal(row.roomId, "room-101");
    assert.equal(row.roomLabel, "101 호실");
    assert.equal(row.courseId, "course-a");
    assert.equal(row.courseLabel, "A A 누루60");
    assert.equal(row.status, "예약");
    assert.equal(row.discountTypeCode, "생일자");
    assert.equal(row.therapist1?.id, "therapist-1");
    assert.equal(row.therapist2?.staffCode, "THR-002");
    assert.equal(row.earcare?.id, "earcare-1");
    assert.equal(row.paymentAmount, null);
    assert.equal(prismaClient.assignments.size, 3);

    const saved = [...prismaClient.serviceCalls.values()][0];
    assert.equal(saved.roomId, "room-101");
    assert.equal(saved.courseId, "course-a");
    assert.equal(saved.status, "예약");
    assert.equal(saved.paymentMethodCode, "현금");
  });

  it("orders rows by Story 1.6 time slot sort order instead of lexicographic time", async () => {
    const prismaClient = createMemoryPrisma();

    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "01:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.deepEqual(
      rows.map((row) => row.startTime),
      ["11:00", "01:00"]
    );
  });

  it("blocks saving outside the selected operating month range with a safe Korean message", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-07-01",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          prismaClient
        }),
      (error) =>
        error instanceof ServiceCallDomainError &&
        error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE" &&
        error.message === "운영월 범위를 벗어난 날짜입니다."
    );
  });

  it("blocks saving into a locked operating month", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-locked",
          serviceDate: "2026-07-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
  });

  it("uses only active masters for select options and filters staff by assignment role", async () => {
    const prismaClient = createMemoryPrisma();

    const options = await listServiceCallFormOptions({
      operatingMonthId: "month-2026-06",
      prismaClient
    });

    assert.deepEqual(options.rooms.map((room) => room.value), ["room-101"]);
    assert.deepEqual(options.courses.map((course) => course.value), ["course-a"]);
    assert.deepEqual(options.paymentMethods.map((method) => method.value), ["현금"]);
    assert.deepEqual(options.therapists.map((therapist) => therapist.value), ["therapist-1", "therapist-2"]);
    assert.deepEqual(options.earcareEmployees.map((employee) => employee.value), ["earcare-1"]);
  });
});
