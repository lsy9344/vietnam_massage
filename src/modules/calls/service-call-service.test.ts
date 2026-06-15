import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autosaveServiceCallRow,
  createDailyExpense,
  deactivateDailyExpense,
  getDailyCallLedgerSummary,
  listDailyExpensesForDate,
  listCompletedServiceCallCalculationsForDate,
  listServiceCallStatusHistory,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  redactServiceCallSettlementAmounts,
  saveBasicServiceCallRow,
  ServiceCallDomainError,
  updateDailyExpense
} from "@/modules/calls/service-call-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma() {
  const createdAt = new Date("2026-06-01T00:00:00.000Z");
  const updatedAt = new Date("2026-06-01T00:10:00.000Z");
  const operatingMonths = new Map<string, any>([
    [
      "month-2026-06",
      {
        id: "month-2026-06",
        monthKey: "2026-06",
        startDate: dbDate("2026-06-01"),
        endDate: dbDate("2026-06-30"),
        status: "작성중",
        createdAt,
        updatedAt
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
        createdAt: new Date("2026-07-01T00:00:00.000Z"),
        updatedAt: new Date("2026-07-01T00:10:00.000Z")
      }
    ],
    [
      "month-confirmed",
      {
        id: "month-confirmed",
        monthKey: "2026-08",
        startDate: dbDate("2026-08-01"),
        endDate: dbDate("2026-08-31"),
        status: "마감확정",
        createdAt: new Date("2026-08-01T00:00:00.000Z"),
        updatedAt: new Date("2026-08-01T00:10:00.000Z")
      }
    ],
    [
      "month-reopened",
      {
        id: "month-reopened",
        monthKey: "2026-09",
        startDate: dbDate("2026-09-01"),
        endDate: dbDate("2026-09-30"),
        status: "검토중",
        createdAt: new Date("2026-09-01T00:00:00.000Z"),
        updatedAt: new Date("2026-09-01T00:10:00.000Z")
      }
    ]
  ]);
  const rooms = new Map<string, any>([
    ["room-101", { id: "room-101", displayName: "101 호실", migrationReferenceName: "1번방", sortOrder: 10, isActive: true, createdAt, updatedAt }],
    ["room-off", { id: "room-off", displayName: "비활성 호실", migrationReferenceName: "비활성", sortOrder: 20, isActive: false, createdAt, updatedAt }]
  ]);
  const courses = new Map<string, any>([
    ["course-a", { id: "course-a", code: "A", isActive: true, createdAt, updatedAt }],
    ["course-d", { id: "course-d", code: "D", isActive: true, createdAt, updatedAt }],
    ["course-missing-rate", { id: "course-missing-rate", code: "B", isActive: true, createdAt, updatedAt }]
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
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "policy-d",
      {
        id: "policy-d",
        courseId: "course-d",
        name: "D 2:1 90",
        durationMinutes: 90,
        basePrice: 3200000,
        opsCallCredit: 1,
        earcarePoolAmount: 0,
        requiresSecondTherapist: true,
        tvDisplayName: "D90",
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "policy-missing-rate",
      {
        id: "policy-missing-rate",
        courseId: "course-missing-rate",
        name: "B 귀청소90",
        durationMinutes: 90,
        basePrice: 1800000,
        opsCallCredit: 1,
        earcarePoolAmount: 200000,
        requiresSecondTherapist: false,
        tvDisplayName: "B90",
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ]
  ]);
  const therapistCourseRates = new Map<string, any>([
    [
      "rate-therapist-1-a",
      {
        id: "rate-therapist-1-a",
        therapistId: "therapist-1",
        courseId: "course-a",
        amount: 700000,
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "rate-therapist-1-d",
      {
        id: "rate-therapist-1-d",
        therapistId: "therapist-1",
        courseId: "course-d",
        amount: 900000,
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "rate-therapist-2-d",
      {
        id: "rate-therapist-2-d",
        therapistId: "therapist-2",
        courseId: "course-d",
        amount: 900000,
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ],
    [
      "rate-therapist-2-a",
      {
        id: "rate-therapist-2-a",
        therapistId: "therapist-2",
        courseId: "course-a",
        amount: 0,
        effectiveFromMonth: "2026-06",
        effectiveToMonth: null,
        isActive: true,
        createdAt: new Date("2026-06-01T00:00:00.000Z"),
        updatedAt: new Date("2026-06-01T00:00:00.000Z")
      }
    ]
  ]);
  const employees = new Map<string, any>([
    [
      "therapist-1",
      {
        id: "therapist-1",
        displayName: "마사지사1",
        staffCode: "THR-001",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        sortOrder: 1,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "therapist-2",
      {
        id: "therapist-2",
        displayName: "마사지사2",
        staffCode: "THR-002",
        employeeGroup: "THERAPIST",
        position: "마사지사",
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        sortOrder: 2,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "earcare-1",
      {
        id: "earcare-1",
        displayName: "귀케어1",
        staffCode: "EAR-001",
        employeeGroup: "EARCARE",
        position: "귀케어",
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        sortOrder: 1,
        isActive: true,
        createdAt,
        updatedAt
      }
    ],
    [
      "ops-1",
      {
        id: "ops-1",
        displayName: "운영1",
        staffCode: "OPS-001",
        employeeGroup: "OPERATIONS",
        position: "운영",
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        sortOrder: 1,
        isActive: true,
        createdAt,
        updatedAt
      }
    ]
  ]);
  const codeItems = new Map<string, any>(
    [
      ["SERVICE_STATUS", "예약", "예약", 10, true],
      ["SERVICE_STATUS", "방문완료", "방문완료", 20, true],
      ["SERVICE_STATUS", "사용중", "사용중", 30, true],
      ["SERVICE_STATUS", "청소중", "청소중", 40, true],
      ["SERVICE_STATUS", "노쇼", "노쇼", 50, true],
      ["SERVICE_STATUS", "취소", "취소", 60, true],
      ["SERVICE_STATUS", "RESERVED", "예약", 110, true],
      ["SERVICE_STATUS", "VISIT_COMPLETE", "방문완료", 120, true],
      ["SERVICE_STATUS", "IN_USE", "사용중", 130, true],
      ["SERVICE_STATUS", "CLEANING", "청소중", 140, true],
      ["SERVICE_STATUS", "CANCELED", "취소", 160, true],
      ["DISCOUNT_TYPE", "생일자", "생일자", 20, true],
      ["DISCOUNT_TYPE", "BIRTHDAY", "생일자", 120, true],
      ["PAYMENT_METHOD", "현금", "현금", 10, true],
      ["PAYMENT_METHOD", "CASH", "현금", 110, true],
      ["CONFIRMATION", "Y", "Y", 10, true],
      ["CONFIRMATION", "N", "N", 20, true],
      ["PAYMENT_METHOD", "비활성", "비활성", 99, false]
    ].map(([codeType, code, displayName, sortOrder, isActive]) => [
      `${codeType}:${code}`,
      { id: `${codeType}:${code}`, codeType, code, displayName, sortOrder, isSystemDefault: true, isActive, createdAt, updatedAt }
    ])
  );
  const timeSlots = new Map<string, any>([
    ["11:00", { id: "slot-1100", value: "11:00", sortOrder: 10, isActive: true, createdAt, updatedAt }],
    ["01:00", { id: "slot-0100", value: "01:00", sortOrder: 290, isActive: true, createdAt, updatedAt }]
  ]);
  const serviceCalls = new Map<string, any>();
  const dailyExpenses = new Map<string, any>();
  const assignments = new Map<string, any>();
  const statusHistories: any[] = [];
  const auditEvents: any[] = [];

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
        .filter((assignment) => assignment.serviceCallId === call.id && assignment.isActive !== false)
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
    therapistCourseRate: {
      async findMany({ where }: any = {}) {
        return [...therapistCourseRates.values()].filter(
          (rate) =>
            (where?.therapistId === undefined || rate.therapistId === where.therapistId) &&
            (where?.courseId === undefined || rate.courseId === where.courseId) &&
            (where?.isActive === undefined || rate.isActive === where.isActive)
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
          isActive: data.isActive ?? true,
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
            (where?.assignmentRole === undefined || assignment.assignmentRole === where.assignmentRole) &&
            (where?.isActive === undefined || assignment.isActive === where.isActive)
        );
      },
      async updateMany({ where, data }: any) {
        const record = assignments.get(where.id);
        if (!record) return { count: 0 };
        assignments.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T01:00:00.000Z") });
        return { count: 1 };
      }
    },
    serviceCallStatusHistory: {
      async create({ data }: any) {
        const record = {
          id: `history-${statusHistories.length + 1}`,
          ...data,
          changedAt: data.changedAt ?? new Date("2026-06-09T01:00:00.000Z"),
          createdAt: new Date("2026-06-09T01:00:00.000Z")
        };
        statusHistories.push(record);
        return record;
      },
      async findMany({ where, orderBy }: any = {}) {
        const records = statusHistories.filter((history) => where?.serviceCallId === undefined || history.serviceCallId === where.serviceCallId);
        if (orderBy?.changedAt === "asc") {
          return records.sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
        }
        return records;
      }
    },
    dailyExpense: {
      async create({ data }: any) {
        const record = {
          id: `expense-${dailyExpenses.size + 1}`,
          ...data,
          isActive: data.isActive ?? true,
          createdAt: new Date(`2026-06-09T02:0${dailyExpenses.size}:00.000Z`),
          updatedAt: new Date(`2026-06-09T02:0${dailyExpenses.size}:00.000Z`)
        };
        dailyExpenses.set(record.id, record);
        return { ...record, handledByEmployee: employees.get(record.handledByEmployeeId) };
      },
      async findMany({ where }: any = {}) {
        return [...dailyExpenses.values()]
          .filter(
            (expense) =>
              (where?.operatingMonthId === undefined || expense.operatingMonthId === where.operatingMonthId) &&
              (where?.expenseDate === undefined || sameDate(expense.expenseDate, where.expenseDate)) &&
              (where?.isActive === undefined || expense.isActive === where.isActive)
          )
          .map((expense) => ({ ...expense, handledByEmployee: employees.get(expense.handledByEmployeeId) }));
      },
      async findUnique({ where }: any) {
        const record = dailyExpenses.get(where.id);
        return record ? { ...record, handledByEmployee: employees.get(record.handledByEmployeeId) } : null;
      },
      async updateMany({ where, data }: any) {
        const record = dailyExpenses.get(where.id);
        if (
          !record ||
          (where.operatingMonthId && record.operatingMonthId !== where.operatingMonthId) ||
          (where.isActive !== undefined && record.isActive !== where.isActive)
        ) {
          return { count: 0 };
        }
        dailyExpenses.set(where.id, { ...record, ...data, updatedAt: new Date("2026-06-09T03:00:00.000Z") });
        return { count: 1 };
      }
    },
    auditLog: {
      async create({ data }: any) {
        const record = {
          id: `audit-${auditEvents.length + 1}`,
          ...data,
          createdAt: new Date("2026-06-09T01:00:00.000Z")
        };
        auditEvents.push(record);
        return record;
      },
      async findMany() {
        return auditEvents;
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    serviceCalls,
    dailyExpenses,
    assignments,
    statusHistories,
    auditEvents
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
    assert.equal(row.paymentAmount, 1400000);
    assert.equal(row.discountAmount, 100000);
    assert.equal(row.therapist1Commission, 0);
    assert.equal(row.therapist2Commission, 0);
    assert.equal(row.earcarePoolAmount, 0);
    assert.equal(row.opsCallCredit, 0);
    assert.equal(row.calculationStatus, "calculated");
    assert.equal(prismaClient.assignments.size, 3);

    const saved = [...prismaClient.serviceCalls.values()][0];
    assert.equal(saved.roomId, "room-101");
    assert.equal(saved.courseId, "course-a");
    assert.equal(saved.status, "예약");
    assert.equal(saved.paymentMethodCode, "현금");
  });

  it("allows reservation rows to be saved without assigning a room yet", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: null as any,
      courseId: "course-a",
      customerMemo: "오후 방문 예정",
      status: "예약",
      prismaClient
    });

    assert.equal(row.roomId, null);
    assert.equal(row.roomLabel, "미배정");
    assert.equal(row.calculationStatus, "not_completed");
    assert.equal([...prismaClient.serviceCalls.values()][0].roomId, null);
  });

  it("requires a room before changing a row to an active or completed room status", async () => {
    const prismaClient = createMemoryPrisma();

    for (const status of ["사용중", "청소중", "방문완료"]) {
      await assert.rejects(
        () =>
          saveBasicServiceCallRow({
            operatingMonthId: "month-2026-06",
            serviceDate: "2026-06-10",
            startTime: "11:00",
            roomId: null as any,
            courseId: "course-a",
            status,
            prismaClient
          }),
        (error: unknown) => error instanceof ServiceCallDomainError && error.code === "ROOM_REQUIRED_FOR_STATUS"
      );
    }
  });

  it("calculates completed-call payment, fixed discount, commissions, earcare pool, and ops call credit from policy sources", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      earcareEmployeeId: "earcare-1",
      status: "방문완료",
      discountTypeCode: "생일자",
      paymentMethodCode: "현금",
      prismaClient
    });

    assert.equal(row.calculationStatus, "calculated");
    assert.equal(row.discountAmount, 100000);
    assert.equal(row.paymentAmount, 1400000);
    assert.equal(row.therapist1Commission, 700000);
    assert.equal(row.therapist2Commission, 0);
    assert.equal(row.earcarePoolAmount, 100000);
    assert.equal(row.opsCallCredit, 1);
  });

  it("redacts settlement-only amounts before rows are sent to non-settlement client views", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      earcareEmployeeId: "earcare-1",
      status: "방문완료",
      prismaClient
    });

    assert.equal(row.therapist1Commission, 700000);
    const redacted = redactServiceCallSettlementAmounts(row);
    assert.equal(redacted.paymentAmount, row.paymentAmount);
    assert.equal(redacted.discountAmount, row.discountAmount);
    assert.equal(redacted.therapist1Commission, 0);
    assert.equal(redacted.therapist2Commission, 0);
    assert.equal(redacted.earcarePoolAmount, 0);
    assert.equal(redacted.opsCallCredit, 0);
  });

  it("calculates completed calls when status is the stable VISIT_COMPLETE code", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "VISIT_COMPLETE",
      discountTypeCode: "BIRTHDAY",
      paymentMethodCode: "CASH",
      prismaClient
    });

    assert.equal(row.calculationStatus, "calculated");
    assert.equal(row.discountAmount, 100000);
    assert.equal(row.paymentAmount, 1400000);
    assert.equal(row.therapist1Commission, 700000);
  });

  it("keeps non-completed statuses out of settlement while reflecting using-state prepaid revenue", async () => {
    const prismaClient = createMemoryPrisma();

    for (const status of ["예약", "사용중", "청소중", "노쇼", "취소"]) {
      const row = await saveBasicServiceCallRow({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        therapist1Id: "therapist-1",
        status,
        discountTypeCode: "생일자",
        prismaClient
      });

      assert.equal(row.calculationStatus, status === "사용중" ? "calculated" : "not_completed");
      assert.equal(row.paymentAmount, status === "사용중" ? 1400000 : 0);
      assert.equal(row.therapist1Commission, 0);
      assert.equal(row.earcarePoolAmount, 0);
      assert.equal(row.opsCallCredit, 0);
    }

    const calculations = await listCompletedServiceCallCalculationsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });
    assert.deepEqual(calculations, []);
  });

  it("uses zero discount when discount type is empty and returns the same calculation on listing", async () => {
    const prismaClient = createMemoryPrisma();

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "방문완료",
      discountTypeCode: null,
      prismaClient
    });
    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(saved.discountAmount, 0);
    assert.equal(saved.paymentAmount, 1500000);
    assert.equal(rows[0].paymentAmount, 1500000);
    assert.equal(rows[0].therapist1Commission, 700000);
  });

  it("returns an explicit missing-rate calculation status instead of silently using zero", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-missing-rate",
      therapist1Id: "therapist-1",
      status: "방문완료",
      prismaClient
    });

    assert.equal(row.calculationStatus, "therapist_rate_missing");
    assert.equal(row.calculationErrorCode, "THERAPIST_RATE_NOT_FOUND");
    assert.equal(row.paymentAmount, 1800000);
    assert.equal(row.therapist1Commission, 0);
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

  it("blocks saving into a confirmed operating month", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-confirmed",
          serviceDate: "2026-08-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
  });

  it("allows payout-impacting writes after monthly close reopen returns the month to 검토중", async () => {
    const prismaClient = createMemoryPrisma();

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-reopened",
      serviceDate: "2026-09-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });
    const expense = await createDailyExpense({
      operatingMonthId: "month-reopened",
      expenseDate: "2026-09-10",
      amount: 1000,
      description: "재오픈 후 검토중 지출",
      handledByEmployeeId: "ops-1",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.operatingMonthId, "month-reopened");
    assert.equal(expense.operatingMonthId, "month-reopened");
    assert.equal(prismaClient.auditEvents.at(-1).action, "daily_expense.created");
  });

  it("uses only active masters for select options and filters staff by assignment role", async () => {
    const prismaClient = createMemoryPrisma();

    const options = await listServiceCallFormOptions({
      operatingMonthId: "month-2026-06",
      prismaClient
    });

    assert.deepEqual(options.rooms.map((room) => room.value), ["room-101"]);
    assert.deepEqual(options.courses.map((course) => course.value), ["course-a", "course-missing-rate", "course-d"]);
    assert.ok(options.paymentMethods.some((method) => method.value === "현금"));
    assert.ok(options.paymentMethods.some((method) => method.value === "CASH"));
    assert.deepEqual(options.therapists.map((therapist) => therapist.value), ["therapist-1", "therapist-2"]);
    assert.deepEqual(options.earcareEmployees.map((employee) => employee.value), ["earcare-1"]);
  });

  it("rejects D-course saves without therapist2 before creating a row or assignments", async () => {
    const prismaClient = createMemoryPrisma();

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-d",
          therapist1Id: "therapist-1",
          therapist2Id: null,
          status: "예약",
          prismaClient
        }),
      (error) =>
        error instanceof ServiceCallDomainError &&
        error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED" &&
        error.message === "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다."
    );

    assert.equal(prismaClient.serviceCalls.size, 0);
    assert.equal(prismaClient.assignments.size, 0);
  });

  it("rejects D-course autosave without therapist2 before row, history, assignment, or audit writes", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });
    const originalAssignmentsSize = prismaClient.assignments.size;

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: original.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-d",
          therapist1Id: "therapist-1",
          therapist2Id: null,
          status: "VISIT_COMPLETE",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED"
    );

    const stored = prismaClient.serviceCalls.get(original.id);
    assert.equal(stored.courseId, "course-a");
    assert.equal(stored.status, "예약");
    assert.equal(prismaClient.assignments.size, originalAssignmentsSize);
    assert.equal(prismaClient.statusHistories.length, 0);
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("allows non-required courses without therapist2 and allows D-course completion with two therapist commissions", async () => {
    const prismaClient = createMemoryPrisma();

    const nonRequired = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: null,
      status: "예약",
      prismaClient
    });
    assert.equal(nonRequired.calculationStatus, "not_completed");
    assert.equal(nonRequired.therapist2, null);

    const completed = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-d",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      status: "방문완료",
      prismaClient
    });

    assert.equal(completed.calculationStatus, "calculated");
    assert.equal(completed.paymentAmount, 3200000);
    assert.equal(completed.therapist1Commission, 900000);
    assert.equal(completed.therapist2Commission, 900000);
    assert.equal(completed.opsCallCredit, 1);
  });

  it("keeps existing invalid completed D-course rows out of completed-call aggregates", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.serviceCalls.set("invalid-d-call", {
      id: "invalid-d-call",
      operatingMonthId: "month-2026-06",
      serviceDate: dbDate("2026-06-10"),
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-d",
      customerMemo: null,
      status: "방문완료",
      discountTypeCode: null,
      paymentMethodCode: null,
      note: null,
      confirmationCode: null,
      createdAt: new Date("2026-06-09T00:00:00.000Z"),
      updatedAt: new Date("2026-06-09T00:00:00.000Z")
    });
    prismaClient.assignments.set("invalid-d-therapist-1", {
      id: "invalid-d-therapist-1",
      serviceCallId: "invalid-d-call",
      assignmentRole: "THERAPIST_1",
      employeeId: "therapist-1",
      isActive: true
    });

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });
    const calculations = await listCompletedServiceCallCalculationsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(rows[0].calculationStatus, "second_therapist_required");
    assert.equal(rows[0].calculationErrorCode, "D_COURSE_SECOND_THERAPIST_REQUIRED");
    assert.deepEqual(calculations, []);
  });

  it("autosaves one existing row, records status history, and returns saved timing DTO", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });

    const saved = await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "상태 변경",
      therapist1Id: "therapist-1",
      status: "취소",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.id, original.id);
    assert.equal(saved.status, "취소");
    assert.equal(saved.savedAt, saved.updatedAt);
    assert.equal(prismaClient.statusHistories.length, 1);
    assert.deepEqual(prismaClient.statusHistories[0], {
      id: "history-1",
      serviceCallId: original.id,
      previousStatus: "예약",
      newStatus: "취소",
      changedByAccountId: "counter-account",
      changedAt: new Date("2026-06-09T01:00:00.000Z"),
      createdAt: new Date("2026-06-09T01:00:00.000Z")
    });
  });

  it("autosave from 예약 to 방문완료 immediately returns computed readonly values", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      status: "예약",
      prismaClient
    });

    const saved = await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      status: "방문완료",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.calculationStatus, "calculated");
    assert.equal(saved.paymentAmount, 1500000);
    assert.equal(saved.therapist1Commission, 700000);
    assert.equal(saved.therapist2Commission, 0);
    assert.equal(saved.opsCallCredit, 1);
  });

  it("completed-call aggregate helper exposes both therapist roles as separate 담당 records", async () => {
    const prismaClient = createMemoryPrisma();
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-1",
      earcareEmployeeId: "earcare-1",
      status: "방문완료",
      discountTypeCode: "생일자",
      prismaClient
    });

    const calculations = await listCompletedServiceCallCalculationsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(calculations.length, 1);
    assert.equal(calculations[0].paymentAmount, 1400000);
    assert.equal(calculations[0].earcarePoolAmount, 100000);
    assert.deepEqual(calculations[0].therapistAssignments, [
      { role: "THERAPIST_1", employeeId: "therapist-1", commissionAmount: 700000 },
      { role: "THERAPIST_2", employeeId: "therapist-1", commissionAmount: 700000 }
    ]);
  });

  it("does not create status history for unchanged status and lists histories by changedAt asc", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });

    await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });
    await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "취소",
      actorId: "counter-account",
      prismaClient
    });

    const histories = await listServiceCallStatusHistory(original.id, { prismaClient });

    assert.equal(histories.length, 1);
    assert.equal(histories[0].previousStatus, "예약");
    assert.equal(histories[0].newStatus, "취소");
  });

  it("records plain JSON audit snapshots for status and sensitive row changes", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });

    await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-2",
      discountTypeCode: "생일자",
      paymentMethodCode: "현금",
      confirmationCode: "Y",
      status: "취소",
      actorId: "counter-account",
      prismaClient
    });

    assert.deepEqual(
      prismaClient.auditEvents.map((event: any) => event.action),
      ["service_call.status_changed", "service_call.row_changed"]
    );
    assert.equal(prismaClient.auditEvents[0].actorId, "counter-account");
    assert.equal(prismaClient.auditEvents[0].targetType, "service_call");
    assert.equal(prismaClient.auditEvents[0].targetId, original.id);
    assert.equal(prismaClient.auditEvents[0].beforeValue.status, "예약");
    assert.equal(prismaClient.auditEvents[0].afterValue.status, "취소");
    assert.equal(prismaClient.auditEvents[1].beforeValue.assignments.therapist1Id, "therapist-1");
    assert.equal(prismaClient.auditEvents[1].afterValue.assignments.therapist1Id, "therapist-2");
    assert.equal(JSON.stringify(prismaClient.auditEvents[1].afterValue).includes("2026-06-10"), true);
  });

  it("clears optional assignments without physical delete during autosave", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      earcareEmployeeId: "earcare-1",
      status: "예약",
      prismaClient
    });

    const saved = await autosaveServiceCallRow({
      serviceCallId: original.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: null,
      earcareEmployeeId: null,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.therapist2, null);
    assert.equal(saved.earcare, null);
    assert.equal(prismaClient.assignments.size, 3);
    assert.equal([...prismaClient.assignments.values()].filter((assignment: any) => assignment.isActive === false).length, 2);
  });

  it("blocks autosave for locked months and inactive employees", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: original.id,
          operatingMonthId: "month-locked",
          serviceDate: "2026-07-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: original.id,
          operatingMonthId: "month-confirmed",
          serviceDate: "2026-08-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: original.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          therapist1Id: "ops-1",
          status: "예약",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "EMPLOYEE_NOT_ACTIVE_FOR_ROLE"
    );
  });

  it("creates, lists, updates, and deactivates active daily expenses with audit snapshots", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 120000,
      description: "식대",
      handledByEmployeeId: "ops-1",
      note: "저녁",
      actorId: "counter-account",
      prismaClient
    });
    const updated = await updateDailyExpense({
      dailyExpenseId: created.id,
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 150000,
      description: "식대 수정",
      handledByEmployeeId: "ops-1",
      note: null,
      actorId: "counter-account",
      prismaClient
    });
    await deactivateDailyExpense({
      dailyExpenseId: created.id,
      actorId: "counter-account",
      prismaClient
    });

    const expenses = await listDailyExpensesForDate({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      prismaClient
    });

    assert.equal(created.amount, 120000);
    assert.equal(created.handledByEmployee.id, "ops-1");
    assert.equal(updated.amount, 150000);
    assert.deepEqual(expenses, []);
    assert.deepEqual(
      prismaClient.auditEvents.map((event: any) => event.action),
      ["daily_expense.created", "daily_expense.changed", "daily_expense.deactivated"]
    );
    assert.equal(prismaClient.auditEvents[1].beforeValue.expenseDate, "2026-06-10");
    assert.equal(prismaClient.auditEvents[1].afterValue.amount, 150000);
    assert.equal(prismaClient.auditEvents[2].afterValue.isActive, false);
  });

  it("blocks updates and duplicate deactivation for inactive daily expenses without extra audit events", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 120000,
      description: "식대",
      handledByEmployeeId: "ops-1",
      note: "저녁",
      actorId: "counter-account",
      prismaClient
    });
    await deactivateDailyExpense({
      dailyExpenseId: created.id,
      actorId: "counter-account",
      prismaClient
    });
    const auditCountAfterDeactivate = prismaClient.auditEvents.length;

    await assert.rejects(
      () =>
        updateDailyExpense({
          dailyExpenseId: created.id,
          operatingMonthId: "month-2026-06",
          expenseDate: "2026-06-10",
          amount: 150000,
          description: "비활성 수정",
          handledByEmployeeId: "ops-1",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "DAILY_EXPENSE_NOT_ACTIVE"
    );
    await assert.rejects(
      () =>
        deactivateDailyExpense({
          dailyExpenseId: created.id,
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "DAILY_EXPENSE_NOT_ACTIVE"
    );

    assert.equal(prismaClient.auditEvents.length, auditCountAfterDeactivate);
  });

  it("blocks formatted string and invalid daily expense amounts, date range violations, locked months, and inactive handlers without side effects", async () => {
    const prismaClient = createMemoryPrisma();

    for (const amount of ["1,000,000 VND", "", -1, 0, 1.5, Number.NaN]) {
      await assert.rejects(
        () =>
          createDailyExpense({
            operatingMonthId: "month-2026-06",
            expenseDate: "2026-06-10",
            amount,
            description: "검증",
            handledByEmployeeId: "ops-1",
            actorId: "counter-account",
            prismaClient
          } as any),
        (error) => error instanceof ServiceCallDomainError && error.code === "INVALID_DAILY_EXPENSE_INPUT"
      );
    }

    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-2026-06",
          expenseDate: "2026-07-01",
          amount: 1000,
          description: "범위 밖",
          handledByEmployeeId: "ops-1",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE"
    );
    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-locked",
          expenseDate: "2026-07-10",
          amount: 1000,
          description: "잠금",
          handledByEmployeeId: "ops-1",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-confirmed",
          expenseDate: "2026-08-10",
          amount: 1000,
          description: "마감확정",
          handledByEmployeeId: "ops-1",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-2026-06",
          expenseDate: "2026-06-10",
          amount: 1000,
          description: "담당자 오류",
          handledByEmployeeId: "missing-employee",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "EMPLOYEE_NOT_ACTIVE"
    );

    assert.equal(prismaClient.dailyExpenses.size, 0);
    assert.equal(prismaClient.auditEvents.length, 0);
  });

  it("summarizes a daily call ledger from calculated completed calls, active expenses, and course codes", async () => {
    const prismaClient = createMemoryPrisma();
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      earcareEmployeeId: "earcare-1",
      status: "VISIT_COMPLETE",
      discountTypeCode: "BIRTHDAY",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "01:00",
      roomId: "room-101",
      courseId: "course-d",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      status: "방문완료",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "RESERVED",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "사용중",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "IN_USE",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "청소중",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "CLEANING",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "01:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "CANCELED",
      prismaClient
    });
    prismaClient.serviceCalls.set("invalid-d-call", {
      id: "invalid-d-call",
      operatingMonthId: "month-2026-06",
      serviceDate: dbDate("2026-06-10"),
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-d",
      customerMemo: null,
      status: "방문완료",
      discountTypeCode: null,
      paymentMethodCode: null,
      note: null,
      confirmationCode: null,
      createdAt: new Date("2026-06-09T00:00:00.000Z"),
      updatedAt: new Date("2026-06-09T00:00:00.000Z")
    });
    prismaClient.assignments.set("invalid-d-therapist-1", {
      id: "invalid-d-therapist-1",
      serviceCallId: "invalid-d-call",
      assignmentRole: "THERAPIST_1",
      employeeId: "therapist-1",
      isActive: true
    });
    await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 250000,
      description: "소모품",
      handledByEmployeeId: "ops-1",
      actorId: "counter-account",
      prismaClient
    });

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(summary.reservationCount, 9);
    assert.equal(summary.inUseCount, 2);
    assert.equal(summary.cleaningCount, 2);
    assert.equal(summary.completedCount, 3);
    assert.equal(summary.noShowCount, 0);
    assert.equal(summary.canceledCount, 1);
    assert.equal(summary.paymentTotal, 7600000);
    assert.equal(summary.therapistCommissionTotal, 2500000);
    assert.equal(summary.earcarePoolTotal, 100000);
    assert.equal(summary.discountTotal, 100000);
    assert.equal(summary.expenseTotal, 250000);
    assert.equal(summary.netSales, 7350000);
    assert.equal(summary.warningCounts.secondTherapistRequired, 1);
    assert.deepEqual(summary.courseSummaries.find((course) => course.courseCode === "A"), {
      courseCode: "A",
      completedCount: 1,
      discountCount: 1,
      therapistAssignmentCount: 2
    });
    assert.deepEqual(summary.courseSummaries.find((course) => course.courseCode === "D"), {
      courseCode: "D",
      completedCount: 1,
      discountCount: 0,
      therapistAssignmentCount: 2
    });
  });

  it("summarizes all ledger rows as reservation count and recognizes prepaid revenue once", async () => {
    const prismaClient = createMemoryPrisma();
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      paymentMethodCode: "CASH",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "사용중",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "방문완료",
      discountTypeCode: "생일자",
      paymentMethodCode: "현금",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "취소",
      paymentMethodCode: "현금",
      prismaClient
    });

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(summary.reservationCount, 4);
    assert.equal(summary.paymentTotal, 4400000);
    assert.deepEqual((summary as any).paymentMethodTotals, {
      cash: 2900000,
      card: 0,
      bank: 0,
      other: 1500000
    });
  });
});
