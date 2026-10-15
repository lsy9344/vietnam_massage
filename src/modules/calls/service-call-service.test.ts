import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autosaveServiceCallRow,
  calculationWarningCallsFromRows,
  createCustomer,
  createDailyExpense,
  deactivateDailyExpense,
  getDailyCallLedgerSummary,
  listCustomerVisitHistory,
  listCustomers,
  ledgerStatusCountsFromRows,
  listDailyExpensesForDate,
  listCompletedServiceCallCalculationsForDate,
  listServiceCallStatusHistory,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  listTherapistAvailability,
  redactServiceCallSettlementAmounts,
  saveBasicServiceCallRow,
  searchCustomerVisitCandidates,
  ServiceCallDomainError,
  updateCustomer,
  updateDailyExpense,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

// 목록 조회는 정책/수당을 { in: [...] } 로 한 번에 가져온다. 단건 비교와 in 비교를 모두 지원한다.
function matchesFilter(value: string, filter: unknown) {
  if (filter === undefined) return true;
  if (filter !== null && typeof filter === "object" && Array.isArray((filter as { in?: unknown }).in)) {
    return ((filter as { in: string[] }).in).includes(value);
  }
  return value === filter;
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
      ["PAYMENT_METHOD", "카드", "카드", 20, true],
      ["PAYMENT_METHOD", "계좌", "계좌", 30, true],
      ["PAYMENT_METHOD", "기타", "기타", 40, true],
      ["PAYMENT_METHOD", "CASH", "현금", 110, true],
      ["PAYMENT_METHOD", "CARD", "카드", 120, true],
      ["PAYMENT_METHOD", "BANK_TRANSFER", "계좌", 130, true],
      ["PAYMENT_METHOD", "OTHER", "기타", 140, true],
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
  const customers = new Map<string, any>();
  const therapistAttendances = new Map<string, any>();
  const statusHistories: any[] = [];
  const auditEvents: any[] = [];

  function sortByOrder(records: any[]) {
    return records.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0));
  }

  function sameDate(a: Date, b: Date) {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  function matchesDay(value: Date, filter: unknown) {
    if (filter === undefined) return true;
    if (filter instanceof Date) return sameDate(value, filter);
    if (filter !== null && typeof filter === "object") {
      const range = filter as { gte?: unknown; lte?: unknown };
      const iso = value.toISOString().slice(0, 10);
      if (range.gte instanceof Date && iso < range.gte.toISOString().slice(0, 10)) return false;
      if (range.lte instanceof Date && iso > range.lte.toISOString().slice(0, 10)) return false;
      return range.gte instanceof Date || range.lte instanceof Date;
    }
    return false;
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
          (policy) => matchesFilter(policy.courseId, where?.courseId) && (where?.isActive === undefined || policy.isActive === where.isActive)
        );
      }
    },
    therapistCourseRate: {
      async findMany({ where }: any = {}) {
        return [...therapistCourseRates.values()].filter(
          (rate) =>
            matchesFilter(rate.therapistId, where?.therapistId) &&
            matchesFilter(rate.courseId, where?.courseId) &&
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
          createdAt: new Date(Date.UTC(2026, 5, 9, 0, serviceCalls.size, 0)),
          updatedAt: new Date(Date.UTC(2026, 5, 9, 0, serviceCalls.size, 0))
        };
        serviceCalls.set(record.id, record);
        return record;
      },
      async findMany({ where }: any = {}) {
        return [...serviceCalls.values()]
          .filter(
            (call) =>
              (where?.operatingMonthId === undefined || call.operatingMonthId === where.operatingMonthId) &&
              matchesDay(call.serviceDate, where?.serviceDate)
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
              matchesDay(expense.expenseDate, where?.expenseDate) &&
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
    customer: {
      async create({ data }: any) {
        const record = {
          id: `customer-${customers.size + 1}`,
          name: data.name,
          phone: data.phone ?? null,
          memo: data.memo ?? null,
          createdAt: new Date(`2026-06-09T04:0${customers.size}:00.000Z`),
          updatedAt: new Date(`2026-06-09T04:0${customers.size}:00.000Z`)
        };
        customers.set(record.id, record);
        return record;
      },
      async findUnique({ where }: any) {
        return customers.get(where.id) ?? null;
      },
      async findMany() {
        return [...customers.values()];
      },
      async updateMany({ where, data }: any) {
        const record = customers.get(where.id);
        if (!record) return { count: 0 };
        customers.set(where.id, {
          ...record,
          name: data.name ?? record.name,
          phone: data.phone === undefined ? record.phone : data.phone,
          memo: data.memo === undefined ? record.memo : data.memo,
          updatedAt: new Date("2026-06-09T05:00:00.000Z")
        });
        return { count: 1 };
      }
    },
    therapistAttendance: {
      async findMany({ where }: any = {}) {
        return [...therapistAttendances.values()].filter((record) => {
          if (where?.operatingMonthId !== undefined && record.operatingMonthId !== where.operatingMonthId) return false;
          if (where?.employeeId !== undefined && record.employeeId !== where.employeeId) return false;
          if (where?.isActive !== undefined && record.isActive !== where.isActive) return false;
          if (where?.attendanceDate !== undefined && !sameDate(record.attendanceDate, where.attendanceDate)) return false;
          return true;
        });
      }
    },
    async $transaction(callback: (tx: any) => Promise<unknown>) {
      return callback(client);
    },
    serviceCalls,
    dailyExpenses,
    assignments,
    statusHistories,
    auditEvents,
    courses,
    coursePolicies,
    employees,
    timeSlots,
    therapistAttendances
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

  it("keeps non-completed statuses out of revenue until a payment method is selected (REQ-007 single criterion)", async () => {
    const prismaClient = createMemoryPrisma();

    // 결제수단이 비어 있으면 사용중이어도 매출로 잡지 않는다.
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

      assert.equal(row.calculationStatus, "not_completed");
      assert.equal(row.paymentAmount, 0);
      assert.equal(row.therapist1Commission, 0);
      assert.equal(row.earcarePoolAmount, 0);
      assert.equal(row.opsCallCredit, 0);
    }

    // 결제수단을 선택하면 방문완료 이전(예약·사용중)이라도 선결제 매출로 반영된다.
    for (const status of ["예약", "사용중", "청소중"]) {
      const row = await saveBasicServiceCallRow({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-11",
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        therapist1Id: "therapist-1",
        status,
        discountTypeCode: "생일자",
        paymentMethodCode: "현금",
        prismaClient
      });

      assert.equal(row.calculationStatus, "calculated");
      assert.equal(row.paymentAmount, 1400000);
      // 방문완료 이전에는 수당·귀케어·콜인정이 발생하지 않는다.
      assert.equal(row.therapist1Commission, 0);
      assert.equal(row.earcarePoolAmount, 0);
      assert.equal(row.opsCallCredit, 0);
    }

    // 취소/노쇼는 결제수단이 선택되어 있어도 매출에서 즉시 제외한다(차감 정책).
    for (const status of ["노쇼", "취소"]) {
      const row = await saveBasicServiceCallRow({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-12",
        startTime: "11:00",
        courseId: "course-a",
        therapist1Id: "therapist-1",
        status,
        discountTypeCode: "생일자",
        paymentMethodCode: "현금",
        prismaClient
      });

      assert.equal(row.calculationStatus, "not_completed");
      assert.equal(row.paymentAmount, 0);
    }

    // 방문완료 이전 건은 정산 대상에 포함되지 않는다.
    const calculations = await listCompletedServiceCallCalculationsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-11",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
      paymentMethodCode: "현금",
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
    // REQ-007: 결제수단이 없는 사용중/IN_USE는 더 이상 매출로 잡지 않는다.
    // 매출은 방문완료 2건(1,400,000 + 3,200,000)만 인정된다.
    assert.equal(summary.paymentTotal, 4600000);
    assert.equal(summary.therapistCommissionTotal, 2500000);
    assert.equal(summary.earcarePoolTotal, 100000);
    assert.equal(summary.discountTotal, 100000);
    assert.equal(summary.expenseTotal, 250000);
    assert.equal(summary.netSales, 4350000);
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

  it("counts every ledger row as a reservation and recognizes revenue only by selected payment method (REQ-007/009)", async () => {
    const prismaClient = createMemoryPrisma();
    // 예약 + 결제수단(CASH): 선결제 매출로 cash 버킷에 반영.
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
    // 사용중 + 결제수단 없음: 더 이상 매출로 잡지 않으며 other 버킷도 오염시키지 않는다.
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "사용중",
      prismaClient
    });
    // 방문완료 + 결제수단(현금) + 할인: cash 버킷에 할인 반영 금액으로 집계.
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
    // 취소 + 결제수단(현금): 차감 정책에 따라 매출에서 즉시 제외.
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
    // 예약(1,500,000) + 방문완료(1,400,000) = 2,900,000. 사용중·취소는 제외.
    assert.equal(summary.paymentTotal, 2900000);
    assert.deepEqual((summary as any).paymentMethodTotals, {
      cash: 2900000,
      card: 0,
      bank: 0,
      other: 0
    });
  });

  it("maps Korean and stable payment method codes into cash, card, bank, and other buckets (REQ-008)", async () => {
    const prismaClient = createMemoryPrisma();
    const paymentMethods = ["CASH", "현금", "CARD", "카드", "BANK_TRANSFER", "계좌", "OTHER", "기타"];

    for (const [index, paymentMethodCode] of paymentMethods.entries()) {
      await saveBasicServiceCallRow({
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        customerMemo: `payment bucket ${index}`,
        status: "예약",
        paymentMethodCode,
        prismaClient
      });
    }

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(summary.paymentTotal, 12000000);
    assert.deepEqual(summary.paymentMethodTotals, {
      cash: 3000000,
      card: 3000000,
      bank: 3000000,
      other: 3000000
    });
  });

  it("keeps completed calls without a payment method in settlement but out of revenue totals", async () => {
    const prismaClient = createMemoryPrisma();
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "방문완료",
      prismaClient
    });

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.equal(summary.paymentTotal, 0);
    assert.equal(summary.discountTotal, 0);
    assert.deepEqual(summary.paymentMethodTotals, { cash: 0, card: 0, bank: 0, other: 0 });
    assert.equal(summary.completedCount, 1);
    assert.equal(summary.therapistCommissionTotal, 700000);
    assert.equal(summary.courseSummaries.find((course) => course.courseCode === "A")?.completedCount, 1);
  });

  it("keeps till balances apart from net sales, card, other, and the previous operating month", async () => {
    const prismaClient = createMemoryPrisma();
    const paidCall = {
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    };
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", paymentMethodCode: "현금" });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", paymentMethodCode: "카드" });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", paymentMethodCode: "계좌" });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", paymentMethodCode: "기타" });
    await saveBasicServiceCallRow({
      ...paidCall,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      paymentMethodCode: "현금",
      status: "취소"
    });
    await saveBasicServiceCallRow({
      ...paidCall,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      paymentMethodCode: "계좌",
      status: "노쇼"
    });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-20", paymentMethodCode: "현금" });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-2026-06", serviceDate: "2026-06-20", paymentMethodCode: "카드" });
    await saveBasicServiceCallRow({ ...paidCall, operatingMonthId: "month-reopened", serviceDate: "2026-09-02", paymentMethodCode: "현금" });

    await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 200000,
      description: "현금 지출",
      handledByEmployeeId: "ops-1",
      method: "cash",
      actorId: "counter-account",
      prismaClient
    });
    await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 80000,
      description: "계좌 지출",
      handledByEmployeeId: "ops-1",
      method: "bank",
      actorId: "counter-account",
      prismaClient
    });
    await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-20",
      amount: 300000,
      description: "나중 날짜 계좌 지출",
      handledByEmployeeId: "ops-1",
      method: "bank",
      actorId: "counter-account",
      prismaClient
    });
    await createDailyExpense({
      operatingMonthId: "month-reopened",
      expenseDate: "2026-09-02",
      amount: 999000,
      description: "다른 운영월 현금 지출",
      handledByEmployeeId: "ops-1",
      method: "cash",
      actorId: "counter-account",
      prismaClient
    });
    prismaClient.dailyExpenses.set("legacy-cash", {
      id: "legacy-cash",
      operatingMonthId: "month-2026-06",
      expenseDate: dbDate("2026-06-10"),
      amount: 50000,
      description: "수단이 없던 지출",
      handledByEmployeeId: "ops-1",
      note: null,
      isActive: true,
      createdAt: new Date("2026-06-09T02:09:00.000Z"),
      updatedAt: new Date("2026-06-09T02:09:00.000Z")
    });

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });

    assert.deepEqual(summary.paymentMethodTotals, { cash: 1500000, card: 1500000, bank: 1500000, other: 1500000 });
    assert.equal(summary.paymentTotal, 6000000);
    assert.equal(summary.expenseTotal, 330000);
    assert.equal(summary.netSales, 5670000);
    assert.deepEqual(summary.till, {
      day: {
        cashReceipts: 1500000,
        cashExpenses: 250000,
        cashBalance: 1250000,
        bankReceipts: 1500000,
        bankExpenses: 80000,
        bankBalance: 1420000
      },
      month: {
        cashReceipts: 3000000,
        cashExpenses: 250000,
        cashBalance: 2750000,
        bankReceipts: 1500000,
        bankExpenses: 380000,
        bankBalance: 1120000
      }
    });
  });

  it("does not report the day's till as the month when the operating month row is missing", async () => {
    const prismaClient = createMemoryPrisma();
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      paymentMethodCode: "현금",
      prismaClient
    });
    await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-20",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      paymentMethodCode: "현금",
      prismaClient
    });
    await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-20",
      amount: 100000,
      description: "나중 날짜 현금 지출",
      handledByEmployeeId: "ops-1",
      method: "cash",
      actorId: "counter-account",
      prismaClient
    });
    prismaClient.operatingMonth.findUnique = async () => null;

    const dayOnly = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      includeMonthTill: false,
      prismaClient
    });
    assert.equal(dayOnly.till.day.cashBalance, 1500000);
    assert.equal(dayOnly.till.month.cashBalance, 0);

    const summary = await getDailyCallLedgerSummary({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });
    assert.deepEqual(summary.till.day, {
      cashReceipts: 1500000,
      cashExpenses: 0,
      cashBalance: 1500000,
      bankReceipts: 0,
      bankExpenses: 0,
      bankBalance: 0
    });
    assert.deepEqual(summary.till.month, {
      cashReceipts: 3000000,
      cashExpenses: 100000,
      cashBalance: 2900000,
      bankReceipts: 0,
      bankExpenses: 0,
      bankBalance: 0
    });
  });

  it("defaults an omitted expense method to cash, audits the method, and still rejects a locked month", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await createDailyExpense({
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 10000,
      description: "기본 현금",
      handledByEmployeeId: "ops-1",
      actorId: "counter-account",
      prismaClient
    });
    const updated = await updateDailyExpense({
      dailyExpenseId: created.id,
      operatingMonthId: "month-2026-06",
      expenseDate: "2026-06-10",
      amount: 10000,
      description: "계좌로 변경",
      handledByEmployeeId: "ops-1",
      method: "bank",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(created.method, "cash");
    assert.equal(updated.method, "bank");
    assert.equal(prismaClient.auditEvents[0].action, "daily_expense.created");
    assert.equal(prismaClient.auditEvents[0].afterValue.method, "cash");
    assert.equal(prismaClient.auditEvents[1].action, "daily_expense.changed");
    assert.equal(prismaClient.auditEvents[1].beforeValue.method, "cash");
    assert.equal(prismaClient.auditEvents[1].afterValue.method, "bank");

    const beforeInvalid = prismaClient.dailyExpenses.size;
    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-2026-06",
          expenseDate: "2026-06-10",
          amount: 1000,
          description: "카드 지출",
          handledByEmployeeId: "ops-1",
          method: "card",
          actorId: "counter-account",
          prismaClient
        } as any),
      (error) =>
        error instanceof ServiceCallDomainError &&
        error.code === "INVALID_DAILY_EXPENSE_INPUT" &&
        error.message === "수단은 현금 또는 계좌입니다."
    );
    assert.equal(prismaClient.dailyExpenses.size, beforeInvalid);

    prismaClient.dailyExpenses.set("locked-expense", {
      id: "locked-expense",
      operatingMonthId: "month-locked",
      expenseDate: dbDate("2026-07-10"),
      amount: 1000,
      method: "cash",
      description: "잠긴 지출",
      handledByEmployeeId: "ops-1",
      note: null,
      isActive: true,
      createdAt: new Date("2026-07-10T00:00:00.000Z"),
      updatedAt: new Date("2026-07-10T00:00:00.000Z")
    });
    await assert.rejects(
      () =>
        updateDailyExpense({
          dailyExpenseId: "locked-expense",
          operatingMonthId: "month-locked",
          expenseDate: "2026-07-10",
          amount: 1000,
          description: "잠긴 지출",
          handledByEmployeeId: "ops-1",
          method: "bank",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        createDailyExpense({
          operatingMonthId: "month-locked",
          expenseDate: "2026-07-10",
          amount: 1000,
          description: "잠긴 달 추가",
          handledByEmployeeId: "ops-1",
          method: "bank",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.dailyExpenses.get("locked-expense").method, "cash");
  });

  it("creates a customer and returns the name, phone, and memo", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(created.name, "민아");
    assert.equal(created.phone, "090111");
    assert.equal(created.memo, "단골");

    const listed = await listCustomers({ prismaClient });
    assert.deepEqual(
      listed.find((customer) => customer.id === created.id),
      { id: created.id, name: "민아", phone: "090111", memo: "단골" }
    );
  });

  it("corrects a customer's name, phone, and memo", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });

    const updated = await updateCustomer({
      customerId: created.id,
      name: "민아정정",
      phone: "091222",
      memo: "메모수정",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(updated.id, created.id);
    assert.equal(updated.name, "민아정정");
    assert.equal(updated.phone, "091222");
    assert.equal(updated.memo, "메모수정");
    assert.deepEqual(await listCustomers({ prismaClient }), [
      { id: created.id, name: "민아정정", phone: "091222", memo: "메모수정" }
    ]);
  });

  it("does not attach a customer from a shared phone until one is chosen, and keeps the call memo", async () => {
    const prismaClient = createMemoryPrisma();
    const mina = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    const sua = await createCustomer({
      name: "수아",
      phone: "090111",
      memo: "신규",
      actorId: "counter-account",
      prismaClient
    });

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "090111 단골이라고 적힘",
      status: "예약",
      prismaClient
    });

    assert.equal(saved.customerId, null);
    assert.equal(saved.customerMemo, "090111 단골이라고 적힘");
    assert.deepEqual(
      (await listCustomers({ prismaClient })).map((customer) => ({ id: customer.id, phone: customer.phone })).sort((a, b) => a.id.localeCompare(b.id)),
      [
        { id: mina.id, phone: "090111" },
        { id: sua.id, phone: "090111" }
      ]
    );

    const linked = await autosaveServiceCallRow({
      serviceCallId: saved.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "090111 단골이라고 적힘",
      customerId: sua.id,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(linked.customerId, sua.id);
    assert.equal(linked.customerMemo, "090111 단골이라고 적힘");

    const unlinked = await autosaveServiceCallRow({
      serviceCallId: saved.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "090111 단골이라고 적힘",
      customerId: null,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(unlinked.customerId, null);
    assert.equal(unlinked.customerMemo, "090111 단골이라고 적힘");
  });

  it("rejects saving a call on a locked month, including a chosen customer link", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      status: "예약",
      prismaClient
    });

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-locked",
          serviceDate: "2026-07-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "원장 표기",
          customerId: customer.id,
          status: "예약",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: original.id,
          operatingMonthId: "month-locked",
          serviceDate: "2026-07-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "원장 표기",
          customerId: customer.id,
          status: "예약",
          actorId: "counter-account",
          prismaClient
        }),
      (error) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].customerId, null);
    assert.equal(rows[0].customerMemo, "원장 표기");
    assert.deepEqual(
      await listServiceCallsForDate({
        operatingMonthId: "month-locked",
        serviceDate: "2026-07-10",
        prismaClient
      }),
      []
    );
  });

  it("records customer create, customer correction, and the call link in the audit log", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    await updateCustomer({
      customerId: created.id,
      name: "민아정정",
      phone: "091222",
      memo: "메모수정",
      actorId: "counter-account",
      prismaClient
    });
    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      status: "예약",
      prismaClient
    });
    await autosaveServiceCallRow({
      serviceCallId: saved.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      customerId: created.id,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.deepEqual(
      prismaClient.auditEvents.map((event: { action: string }) => event.action),
      ["customer.created", "customer.changed", "service_call.row_changed"]
    );
    assert.equal(prismaClient.auditEvents[0].targetType, "customer");
    assert.equal(prismaClient.auditEvents[0].actorId, "counter-account");
    assert.equal(prismaClient.auditEvents[0].afterValue.name, "민아");
    assert.equal(prismaClient.auditEvents[0].afterValue.phone, "090111");
    assert.equal(prismaClient.auditEvents[0].afterValue.memo, "단골");
    assert.equal(prismaClient.auditEvents[1].beforeValue.name, "민아");
    assert.equal(prismaClient.auditEvents[1].afterValue.name, "민아정정");
    assert.equal(prismaClient.auditEvents[1].afterValue.phone, "091222");
    assert.equal(prismaClient.auditEvents[1].afterValue.memo, "메모수정");
    assert.equal(prismaClient.auditEvents[2].targetType, "service_call");
    assert.equal(prismaClient.auditEvents[2].targetId, saved.id);
    assert.equal(prismaClient.auditEvents[2].beforeValue.customerId, null);
    assert.equal(prismaClient.auditEvents[2].afterValue.customerId, created.id);
    assert.equal(prismaClient.auditEvents[2].beforeValue.customerMemo, "원장 표기");
    assert.equal(prismaClient.auditEvents[2].afterValue.customerMemo, "원장 표기");
  });

  it("records a customer chosen while adding a call row without changing the call memo", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      customerId: created.id,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.customerId, created.id);
    assert.equal(saved.customerMemo, "원장 표기");
    assert.deepEqual(
      prismaClient.auditEvents.map((event: { action: string }) => event.action),
      ["customer.created", "service_call.row_changed"]
    );
    assert.equal(prismaClient.auditEvents[1].beforeValue, null);
    assert.equal(prismaClient.auditEvents[1].afterValue.customerId, created.id);
    assert.equal(prismaClient.auditEvents[1].afterValue.customerMemo, "원장 표기");
  });

  it("rejects a customer link on saveBasic when no actor is present and does not store it", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      status: "예약",
      prismaClient
    });

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          serviceCallId: saved.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "원장 표기",
          customerId: created.id,
          status: "예약",
          actorId: " ",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "ACTOR_REQUIRED"
    );
    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "01:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "새 행",
          customerId: created.id,
          status: "예약",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "ACTOR_REQUIRED"
    );

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      prismaClient
    });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, saved.id);
    assert.equal(rows[0].customerId, null);
    assert.equal(rows[0].customerMemo, "원장 표기");
    assert.deepEqual(
      prismaClient.auditEvents.map((event: { action: string }) => event.action),
      ["customer.created"]
    );
  });

  it("returns one call per visit row, completed visits first, and still reads a locked month", async () => {
    const prismaClient = createMemoryPrisma();
    const mina = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    const other = await createCustomer({
      name: "수아",
      phone: "090222",
      memo: null,
      actorId: "counter-account",
      prismaClient
    });

    const completedLate = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-10",
      startTime: "11:00",
      customerId: mina.id,
      customerMemo: "민아 방문",
      therapist1Id: "therapist-1",
      status: "방문완료"
    });
    const completedEarlySameDay = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-10",
      startTime: "01:00",
      customerId: mina.id,
      customerMemo: "민아 방문",
      therapist1Id: "therapist-1",
      status: "방문완료"
    });
    const completedCode = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-05",
      startTime: "11:00",
      customerId: mina.id,
      customerMemo: "민아 방문",
      therapist1Id: "therapist-1",
      status: "VISIT_COMPLETE"
    });
    const completedOldest = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-01",
      startTime: "11:00",
      customerId: mina.id,
      customerMemo: "민아 방문",
      therapist1Id: "therapist-1",
      status: "방문완료"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-15",
      customerId: mina.id,
      customerMemo: "민아 노쇼",
      status: "노쇼"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-18",
      startTime: "01:00",
      customerId: mina.id,
      customerMemo: "민아 노쇼",
      status: "노쇼"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-18",
      startTime: "11:00",
      customerId: mina.id,
      customerMemo: "민아 노쇼",
      status: "노쇼"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-20",
      customerId: mina.id,
      customerMemo: "민아 취소",
      status: "취소"
    });
    const locked = await prismaClient.serviceCall.create({
      data: {
        operatingMonthId: "month-locked",
        serviceDate: dbDate("2026-07-02"),
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        customerId: mina.id,
        customerMemo: "잠긴 달",
        status: "예약",
        discountTypeCode: null,
        paymentMethodCode: null,
        note: null,
        confirmationCode: null
      }
    });
    await prismaClient.serviceCallAssignment.create({
      data: {
        serviceCallId: locked.id,
        employeeId: "therapist-1",
        assignmentRole: "THERAPIST_1"
      }
    });
    const someoneElse = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-11",
      customerId: other.id,
      customerMemo: "수아 방문",
      status: "방문완료"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-12",
      customerMemo: "민아",
      status: "예약"
    });

    const rows = await listCustomerVisitHistory({
      kind: "customer",
      customerId: mina.id,
      prismaClient
    });

    assert.equal(rows.length, 9);
    assert.equal(new Set(rows.map((row) => row.serviceCallId)).size, 9);
    assert.deepEqual(
      rows.slice(0, 4).map((row) => ({ status: row.status, serviceDate: row.serviceDate, startTime: row.startTime })),
      [
        { status: "방문완료", serviceDate: "2026-06-10", startTime: "01:00" },
        { status: "방문완료", serviceDate: "2026-06-10", startTime: "11:00" },
        { status: "VISIT_COMPLETE", serviceDate: "2026-06-05", startTime: "11:00" },
        { status: "방문완료", serviceDate: "2026-06-01", startTime: "11:00" }
      ]
    );
    assert.deepEqual(
      rows.filter((row) => row.status === "노쇼").map((row) => ({ serviceDate: row.serviceDate, startTime: row.startTime })),
      [
        { serviceDate: "2026-06-18", startTime: "01:00" },
        { serviceDate: "2026-06-18", startTime: "11:00" },
        { serviceDate: "2026-06-15", startTime: "11:00" }
      ]
    );
    assert.deepEqual(
      rows.map((row) => row.status).filter((status) => status === "예약" || status === "노쇼" || status === "취소").sort(),
      ["노쇼", "노쇼", "노쇼", "예약", "취소"]
    );
    assert.equal(rows[0].serviceCallId, completedEarlySameDay.id);
    assert.equal(rows[1].serviceCallId, completedLate.id);
    assert.equal(rows[2].serviceCallId, completedCode.id);
    assert.equal(rows[3].serviceCallId, completedOldest.id);
    assert.equal(rows[0].courseLabel, "A A 누루60");
    assert.equal(rows[0].therapistLabel, "마사지사1");
    assert.equal(rows[0].customerMemo, "민아 방문");
    assert.equal(rows[0].operatingMonthId, "month-2026-06");
    const lockedRow = rows.find((row) => row.serviceCallId === locked.id);
    assert.equal(lockedRow?.operatingMonthId, "month-locked");
    assert.equal(lockedRow?.serviceDate, "2026-07-02");
    assert.equal(lockedRow?.startTime, "11:00");
    assert.equal(lockedRow?.status, "예약");
    assert.equal(lockedRow?.customerMemo, "잠긴 달");
    assert.equal(lockedRow?.therapistLabel, "마사지사1");
    assert.equal(rows.some((row) => row.serviceCallId === someoneElse.id), false);

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: locked.id,
          operatingMonthId: "month-locked",
          serviceDate: "2026-07-02",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerId: mina.id,
          customerMemo: "고친 메모",
          status: "방문완료",
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    const afterReject = await listCustomerVisitHistory({
      kind: "customer",
      customerId: mina.id,
      prismaClient
    });
    assert.equal(afterReject.find((row) => row.serviceCallId === locked.id)?.customerMemo, "잠긴 달");
    assert.equal(afterReject.find((row) => row.serviceCallId === locked.id)?.status, "예약");
  });

  it("groups customer and unlinked memo candidates without attaching a shared phone", async () => {
    const prismaClient = createMemoryPrisma();
    const mina = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      actorId: "counter-account",
      prismaClient
    });
    const sua = await createCustomer({
      name: "수아",
      phone: "090111",
      memo: "신규",
      actorId: "counter-account",
      prismaClient
    });
    const lan = await createCustomer({
      name: "Lan",
      phone: "091000",
      memo: null,
      actorId: "counter-account",
      prismaClient
    });

    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-01",
      customerId: mina.id,
      customerMemo: "원장표기",
      note: "조용",
      status: "방문완료"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-20",
      customerId: mina.id,
      customerMemo: "원장표기",
      status: "예약"
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-02",
      customerMemo: "민아 메모",
      note: "창가",
      status: "예약"
    });
    await prismaClient.serviceCall.create({
      data: {
        operatingMonthId: "month-locked",
        serviceDate: dbDate("2026-07-03"),
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        customerId: null,
        customerMemo: "민아 메모",
        status: "노쇼",
        discountTypeCode: null,
        paymentMethodCode: null,
        note: null,
        confirmationCode: null
      }
    });
    await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-04",
      customerMemo: "다른 사람",
      note: "민아 언급",
      status: "취소"
    });
    const suaCall = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-05",
      customerId: sua.id,
      customerMemo: "수아표기",
      status: "방문완료"
    });
    const sharedPhoneMemo = await saveBasicServiceCallRow({
      ...visitCall(prismaClient),
      serviceDate: "2026-06-06",
      customerMemo: "090111 적힘",
      status: "예약"
    });

    assert.deepEqual(await searchCustomerVisitCandidates({ query: "", prismaClient }), []);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "   ", prismaClient }), []);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "없는사람", prismaClient }), []);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: " 민아 ", prismaClient }), [
      { kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03" },
      { kind: "customer", customerId: mina.id, label: "원장표기", phone: "090111", latestVisitDate: "2026-06-20" },
      { kind: "memo", customerId: null, label: "다른 사람", phone: null, latestVisitDate: "2026-06-04" }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "090111", prismaClient }), [
      { kind: "customer", customerId: mina.id, label: "원장표기", phone: "090111", latestVisitDate: "2026-06-20" },
      { kind: "memo", customerId: null, label: "090111 적힘", phone: null, latestVisitDate: "2026-06-06" },
      { kind: "customer", customerId: sua.id, label: "수아표기", phone: "090111", latestVisitDate: "2026-06-05" }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "단골", prismaClient }), [
      { kind: "customer", customerId: mina.id, label: "원장표기", phone: "090111", latestVisitDate: "2026-06-20" }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "조용", prismaClient }), [
      { kind: "customer", customerId: mina.id, label: "원장표기", phone: "090111", latestVisitDate: "2026-06-20" }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "창가", prismaClient }), [
      { kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03" }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "lan", prismaClient }), [
      { kind: "customer", customerId: lan.id, label: "Lan", phone: "091000", latestVisitDate: null }
    ]);

    assert.deepEqual(
      (await listCustomerVisitHistory({ kind: "customer", customerId: mina.id, prismaClient })).map((row) => ({
        status: row.status,
        serviceDate: row.serviceDate,
        customerMemo: row.customerMemo
      })),
      [
        { status: "방문완료", serviceDate: "2026-06-01", customerMemo: "원장표기" },
        { status: "예약", serviceDate: "2026-06-20", customerMemo: "원장표기" }
      ]
    );
    const memoRows = await listCustomerVisitHistory({ kind: "memo", customerMemo: "민아 메모", prismaClient });
    assert.deepEqual(
      memoRows.map((row) => ({ status: row.status, serviceDate: row.serviceDate, operatingMonthId: row.operatingMonthId })),
      [
        { status: "예약", serviceDate: "2026-06-02", operatingMonthId: "month-2026-06" },
        { status: "노쇼", serviceDate: "2026-07-03", operatingMonthId: "month-locked" }
      ]
    );
    assert.deepEqual(
      (await listCustomerVisitHistory({ kind: "memo", customerMemo: "다른 사람", prismaClient })).map((row) => row.status),
      ["취소"]
    );

    const sharedPhoneDay = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-06",
      prismaClient
    });
    assert.equal(sharedPhoneDay.find((row) => row.id === sharedPhoneMemo.id)?.customerId, null);
    const suaDay = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-05",
      prismaClient
    });
    assert.equal(suaDay.find((row) => row.id === suaCall.id)?.customerId, sua.id);
  });
});

const availabilityDate = "2026-06-10";

function addAvailabilityCourse(
  prismaClient: ReturnType<typeof createMemoryPrisma>,
  input: { id: string; code: string; name: string; durationMinutes: number; requiresSecondTherapist?: boolean; isActive?: boolean }
) {
  const createdAt = new Date("2026-06-01T00:00:00.000Z");
  prismaClient.courses.set(input.id, {
    id: input.id,
    code: input.code,
    isActive: input.isActive ?? true,
    createdAt,
    updatedAt: createdAt
  });
  prismaClient.coursePolicies.set(`policy-${input.id}`, {
    id: `policy-${input.id}`,
    courseId: input.id,
    name: input.name,
    durationMinutes: input.durationMinutes,
    basePrice: 1000000,
    opsCallCredit: 1,
    earcarePoolAmount: 0,
    requiresSecondTherapist: input.requiresSecondTherapist ?? false,
    tvDisplayName: input.code,
    effectiveFromMonth: "2026-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt: createdAt
  });
}

function addAvailabilityCall(
  prismaClient: ReturnType<typeof createMemoryPrisma>,
  input: {
    id: string;
    startTime: string;
    courseId: string;
    status: string;
    serviceDate?: string;
    actualEntryTime?: string | null;
    paymentMethodCode?: string | null;
    createdAt?: Date;
    assignments: Array<{ role: "THERAPIST_1" | "THERAPIST_2" | "EARCARE"; employeeId: string }>;
  }
) {
  const createdAt = input.createdAt ?? new Date("2026-06-10T00:00:00.000Z");
  prismaClient.serviceCalls.set(input.id, {
    id: input.id,
    operatingMonthId: "month-2026-06",
    serviceDate: dbDate(input.serviceDate ?? availabilityDate),
    startTime: input.startTime,
    actualEntryTime: input.actualEntryTime ?? null,
    roomId: "room-101",
    courseId: input.courseId,
    customerId: null,
    customerMemo: null,
    status: input.status,
    discountTypeCode: null,
    paymentMethodCode: input.paymentMethodCode ?? null,
    note: null,
    confirmationCode: null,
    createdAt,
    updatedAt: createdAt
  });
  input.assignments.forEach((assignment, index) => {
    const assignmentId = `${input.id}-${assignment.role}-${index}`;
    prismaClient.assignments.set(assignmentId, {
      id: assignmentId,
      serviceCallId: input.id,
      employeeId: assignment.employeeId,
      assignmentRole: assignment.role,
      isActive: true,
      createdAt,
      updatedAt: createdAt
    });
  });
}

function availabilityAt(prismaClient: ReturnType<typeof createMemoryPrisma>, time: string) {
  return listTherapistAvailability({
    operatingMonthId: "month-2026-06",
    serviceDate: availabilityDate,
    time,
    prismaClient
  });
}

function courseFlag(rows: Awaited<ReturnType<typeof listTherapistAvailability>>, therapistId: string, courseId: string) {
  return rows.find((row) => row.therapistId === therapistId)?.courses.find((course) => course.courseId === courseId)?.possible;
}

describe("therapist availability", () => {
  it("makes 15:00 unavailable until 15:30 when a 14:00 call is 90 minutes", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-other-day",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "예약",
      serviceDate: "2026-06-11",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-2" }]
    });

    const rows = await availabilityAt(prismaClient, "15:00");
    const therapist1 = rows.find((row) => row.therapistId === "therapist-1");
    const therapist2 = rows.find((row) => row.therapistId === "therapist-2");

    assert.equal(therapist1?.available, false);
    assert.equal(therapist1?.freeFrom, "15:30");
    assert.equal(therapist1?.freeMinutes, null);
    assert.equal(therapist1?.attendance, "not_entered");
    assert.equal(courseFlag(rows, "therapist-1", "course-a"), false);
    assert.equal(therapist2?.available, true);
    assert.equal(therapist2?.freeFrom, null);
  });

  it("keeps 15:00 free when the earlier call ends at 15:00, and chains occupancy through a call that starts then", async () => {
    const touching = createMemoryPrisma();
    addAvailabilityCall(touching, {
      id: "call-ends-1500",
      startTime: "14:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const touched = await availabilityAt(touching, "15:00");
    assert.equal(touched.find((row) => row.therapistId === "therapist-1")?.available, true);
    assert.equal(touched.find((row) => row.therapistId === "therapist-1")?.freeFrom, null);
    assert.equal(touched.find((row) => row.therapistId === "therapist-1")?.nextReservationTime, null);
    assert.equal(touched.find((row) => row.therapistId === "therapist-1")?.freeMinutes, 600);

    const chained = createMemoryPrisma();
    addAvailabilityCall(chained, {
      id: "call-1400-90",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(chained, {
      id: "call-1530-60",
      startTime: "15:30",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (await availabilityAt(chained, "15:00")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.available, false);
    assert.equal(row?.freeFrom, "16:30");
    assert.equal(row?.nextReservationTime, "15:30");
  });

  it("offers a 60 minute course at 15:00 when the next reservation is 16:00, and not a 90 or 120", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCourse(prismaClient, { id: "course-c", code: "C", name: "C 120", durationMinutes: 120 });
    addAvailabilityCall(prismaClient, {
      id: "call-1600",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (await availabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.available, true);
    assert.equal(row?.nextReservationTime, "16:00");
    assert.equal(row?.freeMinutes, 60);
    assert.deepEqual(
      row?.courses.map((course) => ({ courseId: course.courseId, durationMinutes: course.durationMinutes, possible: course.possible })),
      [
        { courseId: "course-a", durationMinutes: 60, possible: true },
        { courseId: "course-missing-rate", durationMinutes: 90, possible: false },
        { courseId: "course-c", durationMinutes: 120, possible: false },
        { courseId: "course-d", durationMinutes: 90, possible: false }
      ]
    );
  });

  it("leaves the time free for no-show and canceled calls, and does not treat them as the next reservation", async () => {
    for (const status of ["노쇼", "NO_SHOW", "취소", "CANCELED"]) {
      const prismaClient = createMemoryPrisma();
      addAvailabilityCall(prismaClient, {
        id: `call-${status}`,
        startTime: "14:00",
        courseId: "course-missing-rate",
        status,
        assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
      });
      const row = (await availabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
      assert.equal(row?.available, true, status);
      assert.equal(row?.nextReservationTime, null, status);
      assert.equal(row?.freeMinutes, 600, status);
    }

    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-no-show",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "노쇼",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-canceled-next",
      startTime: "16:00",
      courseId: "course-a",
      status: "취소",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const row = (await availabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.available, true);
    assert.equal(row?.nextReservationTime, null);
    assert.equal(row?.freeMinutes, 600);
  });

  it("occupies a therapist for reservation, in use, cleaning, and completed calls only on that interval", async () => {
    for (const status of ["예약", "RESERVED", "사용중", "IN_USE", "USING", "청소중", "CLEANING", "방문완료", "VISIT_COMPLETE"]) {
      const prismaClient = createMemoryPrisma();
      addAvailabilityCall(prismaClient, {
        id: `call-${status}`,
        startTime: "14:00",
        courseId: "course-missing-rate",
        status,
        assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
      });
      const row = (await availabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
      assert.equal(row?.available, false, status);
      assert.equal(row?.freeFrom, "15:30", status);
      const later = (await availabilityAt(prismaClient, "15:30")).find((item) => item.therapistId === "therapist-1");
      assert.equal(later?.available, true, status);
    }
  });

  it("occupies both therapist assignments and ignores earcare", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-second-assignment",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "예약",
      assignments: [
        { role: "THERAPIST_2", employeeId: "therapist-2" },
        { role: "EARCARE", employeeId: "earcare-1" }
      ]
    });

    const rows = await availabilityAt(prismaClient, "15:00");
    assert.equal(rows.find((row) => row.therapistId === "therapist-1")?.available, true);
    assert.equal(rows.find((row) => row.therapistId === "therapist-2")?.available, false);
    assert.equal(rows.find((row) => row.therapistId === "therapist-2")?.freeFrom, "15:30");
    assert.equal(rows.some((row) => row.therapistId === "earcare-1"), false);
  });

  it("offers a second-therapist course only when another active therapist is free for the whole duration", async () => {
    const open = createMemoryPrisma();
    addAvailabilityCourse(open, { id: "course-c", code: "C", name: "C 120", durationMinutes: 120 });
    const openRows = await availabilityAt(open, "15:00");
    const openTherapist = openRows.find((row) => row.therapistId === "therapist-1");
    assert.equal(openTherapist?.freeMinutes, 600);
    assert.equal(courseFlag(openRows, "therapist-1", "course-a"), true);
    assert.equal(courseFlag(openRows, "therapist-1", "course-c"), true);
    assert.equal(courseFlag(openRows, "therapist-1", "course-d"), true);

    const blockedPartner = createMemoryPrisma();
    addAvailabilityCall(blockedPartner, {
      id: "call-partner",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-2" }]
    });
    const blockedRows = await availabilityAt(blockedPartner, "15:00");
    assert.equal(blockedRows.find((row) => row.therapistId === "therapist-1")?.freeMinutes, 600);
    assert.equal(courseFlag(blockedRows, "therapist-1", "course-a"), true);
    assert.equal(courseFlag(blockedRows, "therapist-1", "course-missing-rate"), true);
    assert.equal(courseFlag(blockedRows, "therapist-1", "course-d"), false);

    const alone = createMemoryPrisma();
    alone.employees.get("therapist-2").isActive = false;
    const aloneRows = await availabilityAt(alone, "15:00");
    assert.deepEqual(aloneRows.map((row) => row.therapistId), ["therapist-1"]);
    assert.equal(courseFlag(aloneRows, "therapist-1", "course-a"), true);
    assert.equal(courseFlag(aloneRows, "therapist-1", "course-d"), false);
  });

  it("lists every active therapist, with attendance as a label, and leaves out earcare, operations, and inactive therapists", async () => {
    const prismaClient = createMemoryPrisma();
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    prismaClient.employees.set("therapist-off", {
      id: "therapist-off",
      displayName: "비활성",
      staffCode: "THR-OFF",
      employeeGroup: "THERAPIST",
      position: "마사지사",
      shiftType: "전체",
      baseSalary: 0,
      phone: null,
      birthday: null,
      hireDate: null,
      employmentStatus: "재직",
      sortOrder: 3,
      isActive: false,
      createdAt,
      updatedAt: createdAt
    });
    prismaClient.therapistAttendances.set("att-1", {
      id: "att-1",
      operatingMonthId: "month-2026-06",
      attendanceDate: dbDate(availabilityDate),
      employeeId: "therapist-1",
      isActive: true
    });
    prismaClient.therapistAttendances.set("att-2", {
      id: "att-2",
      operatingMonthId: "month-2026-06",
      attendanceDate: dbDate(availabilityDate),
      employeeId: "therapist-2",
      isActive: false
    });

    const rows = await availabilityAt(prismaClient, "15:00");
    assert.deepEqual(
      rows.map((row) => ({ therapistId: row.therapistId, attendance: row.attendance })),
      [
        { therapistId: "therapist-1", attendance: "checked_in" },
        { therapistId: "therapist-2", attendance: "not_entered" }
      ]
    );
  });

  it("still saves a course the availability list calls impossible", async () => {
    const prismaClient = createMemoryPrisma();
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    prismaClient.timeSlots.set("15:00", { id: "slot-1500", value: "15:00", sortOrder: 90, isActive: true, createdAt, updatedAt: createdAt });
    prismaClient.timeSlots.set("16:00", { id: "slot-1600", value: "16:00", sortOrder: 110, isActive: true, createdAt, updatedAt: createdAt });
    addAvailabilityCall(prismaClient, {
      id: "call-1600",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const before = await availabilityAt(prismaClient, "15:00");
    assert.equal(courseFlag(before, "therapist-1", "course-missing-rate"), false);

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      startTime: "15:00",
      roomId: null,
      courseId: "course-missing-rate",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });

    assert.equal(saved.startTime, "15:00");
    assert.equal(saved.courseId, "course-missing-rate");
    assert.equal(saved.therapist1?.id, "therapist-1");
  });
});

// 2026-06-10 15:20 (Asia/Ho_Chi_Minh)
const overrunNow = new Date("2026-06-10T08:20:00.000Z");

function overrunAvailabilityAt(prismaClient: ReturnType<typeof createMemoryPrisma>, time: string, now = overrunNow) {
  return listTherapistAvailability({
    operatingMonthId: "month-2026-06",
    serviceDate: availabilityDate,
    time,
    now,
    prismaClient
  });
}

describe("therapist availability with an in-use call past its display end", () => {
  it("holds the therapist from the 15:00 display end until now and flags the later candidates", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-in-use",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const at1500 = (await overrunAvailabilityAt(prismaClient, "15:00")).find((row) => row.therapistId === "therapist-1");
    assert.equal(at1500?.available, false);
    assert.equal(at1500?.unavailableReason, "in_service_past_display_end");
    assert.equal(at1500?.inServiceDisplayEnd, "15:00");
    assert.equal(at1500?.freeFrom, "15:20");
    assert.equal(at1500?.courses.find((course) => course.courseId === "course-a")?.possible, false);

    const at1530 = (await overrunAvailabilityAt(prismaClient, "15:30")).find((row) => row.therapistId === "therapist-1");
    assert.equal(at1530?.available, true);
    assert.equal(at1530?.unavailableReason, null);
    assert.equal(at1530?.freeFrom, null);
    assert.equal(at1530?.priorServiceEndCheck, true);
    assert.equal(at1530?.courses.find((course) => course.courseId === "course-a")?.possible, true);

    const atNow = (await overrunAvailabilityAt(prismaClient, "15:20")).find((row) => row.therapistId === "therapist-1");
    assert.equal(atNow?.available, true);
  });

  it("keeps holding after midnight, because the business day of the chosen date runs past it", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-2300-in-use",
      startTime: "23:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    // 2026-06-11 00:30 (Asia/Ho_Chi_Minh): 달력날은 다음 날이지만 06-10 영업일 안이다.
    const afterMidnight = new Date("2026-06-10T17:30:00.000Z");

    const atMidnight = (await overrunAvailabilityAt(prismaClient, "00:00", afterMidnight)).find((row) => row.therapistId === "therapist-1");
    assert.equal(atMidnight?.available, false);
    assert.equal(atMidnight?.unavailableReason, "in_service_past_display_end");
    assert.equal(atMidnight?.inServiceDisplayEnd, "00:00");
    assert.equal(atMidnight?.freeFrom, "00:30");

    const at0030 = (await overrunAvailabilityAt(prismaClient, "00:30", afterMidnight)).find((row) => row.therapistId === "therapist-1");
    assert.equal(at0030?.available, true);
    assert.equal(at0030?.priorServiceEndCheck, true);
  });

  it("names the earliest display end when two in-use calls of one therapist have both run over", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-in-use",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-1300-in-use",
      startTime: "13:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (await overrunAvailabilityAt(prismaClient, "15:10")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.unavailableReason, "in_service_past_display_end");
    assert.equal(row?.inServiceDisplayEnd, "14:00");
    assert.equal(row?.freeFrom, "15:20");
  });

  it("frees at the end of a booking that starts right when the hold ends, and keeps the in-service reason", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-in-use",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-1520",
      startTime: "15:20",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (await overrunAvailabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.unavailableReason, "in_service_past_display_end");
    assert.equal(row?.inServiceDisplayEnd, "15:00");
    assert.equal(row?.freeFrom, "16:20");
  });

  it("counts free minutes only up to a hold that starts later than the chosen time", async () => {
    // 14:00 예약, 15:00 실제입장, 60분: 표시 종료 16:00. 지금 16:40이면 추가 점유는 16:00–16:40이다.
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-late",
      startTime: "14:00",
      actualEntryTime: "15:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (await overrunAvailabilityAt(prismaClient, "15:30", new Date("2026-06-10T09:40:00.000Z"))).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.available, true);
    assert.equal(row?.nextReservationTime, null);
    assert.equal(row?.freeMinutes, 30);
    assert.equal(courseFlag([row!], "therapist-1", "course-a"), false);
  });

  it("adds no hold for a reserved call, for yesterday, or for cleaning, completed, no-show, and canceled calls", async () => {
    const cases: Array<{ status: string; now?: Date }> = [
      { status: "예약" },
      { status: "RESERVED" },
      // 고른 날짜(06-10)가 어제가 된다.
      { status: "사용중", now: new Date("2026-06-11T08:20:00.000Z") },
      { status: "청소중" },
      { status: "방문완료" },
      { status: "노쇼" },
      { status: "취소" }
    ];
    for (const { status, now } of cases) {
      const prismaClient = createMemoryPrisma();
      addAvailabilityCall(prismaClient, {
        id: "call-1400",
        startTime: "14:00",
        courseId: "course-a",
        status,
        assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
      });
      const row = (await overrunAvailabilityAt(prismaClient, "15:00", now)).find((item) => item.therapistId === "therapist-1");
      const label = `${status} ${now?.toISOString() ?? "today"}`;
      assert.equal(row?.available, true, label);
      assert.equal(row?.unavailableReason, null, label);
      assert.equal(row?.inServiceDisplayEnd, null, label);
      assert.equal(row?.priorServiceEndCheck, false, label);
    }
  });

  it("adds no hold while now is at or before the display end", async () => {
    for (const now of [new Date("2026-06-10T08:00:00.000Z"), new Date("2026-06-10T07:50:00.000Z")]) {
      const prismaClient = createMemoryPrisma();
      addAvailabilityCall(prismaClient, {
        id: "call-1400-in-use",
        startTime: "14:00",
        courseId: "course-a",
        status: "사용중",
        assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
      });
      const row = (await overrunAvailabilityAt(prismaClient, "15:00", now)).find((item) => item.therapistId === "therapist-1");
      assert.equal(row?.available, true, now.toISOString());
      assert.equal(row?.priorServiceEndCheck, false, now.toISOString());
    }
  });

  it("is unavailable when either the booking or the hold covers the time, and frees at the later end", async () => {
    // 14:30 예약에 양보해 표시 종료가 14:30이 된다. 추가 점유는 14:30–15:20, 예약 점유는 14:30–15:00이다.
    const prismaClient = createMemoryPrisma();
    addAvailabilityCourse(prismaClient, { id: "course-30", code: "S", name: "S 30", durationMinutes: 30 });
    addAvailabilityCall(prismaClient, {
      id: "call-1400-in-use",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-1430",
      startTime: "14:30",
      courseId: "course-30",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const at1440 = (await overrunAvailabilityAt(prismaClient, "14:40")).find((row) => row.therapistId === "therapist-1");
    assert.equal(at1440?.available, false);
    assert.equal(at1440?.unavailableReason, "booked");
    assert.equal(at1440?.inServiceDisplayEnd, null);
    assert.equal(at1440?.freeFrom, "15:20");

    const at1510 = (await overrunAvailabilityAt(prismaClient, "15:10")).find((row) => row.therapistId === "therapist-1");
    assert.equal(at1510?.available, false);
    assert.equal(at1510?.unavailableReason, "in_service_past_display_end");
    assert.equal(at1510?.inServiceDisplayEnd, "14:30");
    assert.equal(at1510?.freeFrom, "15:20");
  });

  it("holds both the therapist 1 and therapist 2 assignments, and keeps a two-therapist course from using the held partner", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-pair",
      startTime: "14:00",
      courseId: "course-a",
      status: "IN_USE",
      assignments: [
        { role: "THERAPIST_1", employeeId: "therapist-1" },
        { role: "THERAPIST_2", employeeId: "therapist-2" }
      ]
    });

    const rows = await overrunAvailabilityAt(prismaClient, "15:00");
    for (const therapistId of ["therapist-1", "therapist-2"]) {
      const row = rows.find((item) => item.therapistId === therapistId);
      assert.equal(row?.available, false, therapistId);
      assert.equal(row?.unavailableReason, "in_service_past_display_end", therapistId);
      assert.equal(row?.inServiceDisplayEnd, "15:00", therapistId);
      assert.equal(row?.freeFrom, "15:20", therapistId);
    }

    // therapist-2만 THERAPIST_2로 붙잡혀 있으면 therapist-1은 혼자 할 코스만 가능하다.
    const heldPartner = createMemoryPrisma();
    addAvailabilityCall(heldPartner, {
      id: "call-1400-partner",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [
        { role: "THERAPIST_1", employeeId: "therapist-3" },
        { role: "THERAPIST_2", employeeId: "therapist-2" }
      ]
    });
    const partnerRows = await overrunAvailabilityAt(heldPartner, "15:10");
    assert.equal(partnerRows.find((row) => row.therapistId === "therapist-2")?.unavailableReason, "in_service_past_display_end");
    assert.equal(partnerRows.find((row) => row.therapistId === "therapist-1")?.priorServiceEndCheck, false);
    assert.equal(courseFlag(partnerRows, "therapist-1", "course-a"), true);
    assert.equal(courseFlag(partnerRows, "therapist-1", "course-d"), false);
  });

  it("leaves the display end, the next call's reservation time, the course, and the amount as they were", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-1400-in-use",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "call-1500",
      startTime: "15:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const listRows = () => listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: availabilityDate, prismaClient });
    const before = await listRows();

    const row = (await overrunAvailabilityAt(prismaClient, "15:00")).find((item) => item.therapistId === "therapist-1");
    assert.equal(row?.unavailableReason, "booked");
    assert.equal(row?.freeFrom, "16:00");

    const after = await listRows();
    assert.deepEqual(after, before);
    const inUse = after.find((call) => call.id === "call-1400-in-use");
    const next = after.find((call) => call.id === "call-1500");
    assert.equal(inUse?.displayEnd, "15:00");
    assert.equal(inUse?.warningTime, null);
    assert.equal(next?.startTime, "15:00");
    assert.equal(next?.courseId, "course-a");
    assert.equal(next?.basePrice, before.find((call) => call.id === "call-1500")?.basePrice);
  });
});

describe("actual entry and display end", () => {
  it("yields a 15:20 arrival of 60 minutes to the 16:00 reservation and keeps that booking", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "late",
      startTime: "15:00",
      actualEntryTime: "15:20",
      courseId: "course-a",
      status: "예약",
      paymentMethodCode: "현금",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "dropped",
      startTime: "15:40",
      courseId: "course-a",
      status: "노쇼",
      createdAt: new Date("2026-06-10T00:01:00.000Z"),
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "other-therapist",
      startTime: "15:30",
      courseId: "course-a",
      status: "예약",
      createdAt: new Date("2026-06-10T00:02:00.000Z"),
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-2" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "next",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      paymentMethodCode: "현금",
      createdAt: new Date("2026-06-10T00:03:00.000Z"),
      assignments: [{ role: "THERAPIST_2", employeeId: "therapist-1" }]
    });

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      prismaClient
    });
    const late = rows.find((row) => row.id === "late");
    const next = rows.find((row) => row.id === "next");

    assert.equal(late?.actualEntryTime, "15:20");
    assert.equal(late?.displayEnd, "16:00");
    assert.equal(late?.warningTime, "16:00");
    assert.equal(late?.startTime, "15:00");
    assert.equal(late?.courseId, "course-a");
    assert.equal(late?.basePrice, 1500000);
    assert.equal(late?.paymentAmount, 1500000);
    assert.equal(next?.startTime, "16:00");
    assert.equal(next?.courseId, "course-a");
    assert.equal(next?.paymentAmount, 1500000);
    assert.equal(next?.actualEntryTime, null);
  });

  it("shows 16:20 and no warning when the next reservation is absent or at 17:00", async () => {
    const alone = createMemoryPrisma();
    addAvailabilityCall(alone, {
      id: "late",
      startTime: "15:00",
      actualEntryTime: "15:20",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const aloneRow = (
      await listServiceCallsForDate({
        operatingMonthId: "month-2026-06",
        serviceDate: availabilityDate,
        prismaClient: alone
      })
    ).find((row) => row.id === "late");
    assert.equal(aloneRow?.displayEnd, "16:20");
    assert.equal(aloneRow?.warningTime, null);

    const later = createMemoryPrisma();
    addAvailabilityCall(later, {
      id: "late",
      startTime: "15:00",
      actualEntryTime: "15:20",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(later, {
      id: "canceled",
      startTime: "16:00",
      courseId: "course-a",
      status: "취소",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(later, {
      id: "other-day",
      startTime: "15:10",
      courseId: "course-a",
      status: "예약",
      serviceDate: "2026-06-11",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(later, {
      id: "next",
      startTime: "17:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const row = (
      await listServiceCallsForDate({
        operatingMonthId: "month-2026-06",
        serviceDate: availabilityDate,
        prismaClient: later
      })
    ).find((item) => item.id === "late");
    assert.equal(row?.displayEnd, "16:20");
    assert.equal(row?.warningTime, null);
  });

  it("keeps the proposed end and an empty warning when the next reservation only touches it", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "late",
      startTime: "15:00",
      actualEntryTime: "15:20",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "next",
      startTime: "16:20",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (
      await listServiceCallsForDate({
        operatingMonthId: "month-2026-06",
        serviceDate: availabilityDate,
        prismaClient
      })
    ).find((item) => item.id === "late");

    assert.equal(row?.displayEnd, "16:20");
    assert.equal(row?.warningTime, null);
  });

  it("uses the reservation time when actual entry is empty and still yields past the next reservation", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "booked",
      startTime: "15:00",
      actualEntryTime: null,
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "next",
      startTime: "15:30",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const row = (
      await listServiceCallsForDate({
        operatingMonthId: "month-2026-06",
        serviceDate: availabilityDate,
        prismaClient
      })
    ).find((item) => item.id === "booked");

    assert.equal(row?.actualEntryTime, null);
    assert.equal(row?.displayEnd, "15:30");
    assert.equal(row?.warningTime, "15:30");
  });

  it("stores a 10-minute actual entry, rejects anything else before write, and leaves the next call unchanged", async () => {
    const prismaClient = createMemoryPrisma();
    const createdAt = new Date("2026-06-01T00:00:00.000Z");
    prismaClient.timeSlots.set("15:00", { id: "slot-1500", value: "15:00", sortOrder: 90, isActive: true, createdAt, updatedAt: createdAt });
    prismaClient.timeSlots.set("16:00", { id: "slot-1600", value: "16:00", sortOrder: 110, isActive: true, createdAt, updatedAt: createdAt });
    const shared = {
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      paymentMethodCode: "현금",
      prismaClient
    };
    const beforeSize = prismaClient.serviceCalls.size;

    await assert.rejects(
      () => saveBasicServiceCallRow({ ...shared, startTime: "15:00", actualEntryTime: "15:05" }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_INPUT"
    );
    assert.equal(prismaClient.serviceCalls.size, beforeSize);

    const late = await saveBasicServiceCallRow({ ...shared, startTime: "15:00", actualEntryTime: "" });
    const next = await saveBasicServiceCallRow({ ...shared, startTime: "16:00" });
    assert.equal(late.actualEntryTime, null);
    assert.equal(late.courseId, "course-a");
    assert.equal(late.basePrice, 1500000);
    assert.equal(late.paymentAmount, 1500000);

    const saved = await autosaveServiceCallRow({
      serviceCallId: late.id,
      operatingMonthId: late.operatingMonthId,
      serviceDate: late.serviceDate,
      startTime: late.startTime,
      roomId: late.roomId,
      courseId: late.courseId,
      customerMemo: late.customerMemo,
      customerId: late.customerId,
      therapist1Id: late.therapist1?.id ?? null,
      therapist2Id: null,
      earcareEmployeeId: null,
      status: late.status,
      discountTypeCode: late.discountTypeCode,
      paymentMethodCode: late.paymentMethodCode,
      note: late.note,
      confirmationCode: late.confirmationCode,
      actualEntryTime: "15:20",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.actualEntryTime, "15:20");
    assert.equal(saved.startTime, "15:00");
    assert.equal(saved.displayEnd, "16:00");
    assert.equal(saved.warningTime, "16:00");
    assert.equal(saved.courseId, "course-a");
    assert.equal(saved.paymentAmount, 1500000);
    assert.equal(saved.basePrice, 1500000);

    const listed = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      prismaClient
    });
    const nextRow = listed.find((row) => row.id === next.id);
    assert.equal(nextRow?.startTime, "16:00");
    assert.equal(nextRow?.courseId, "course-a");
    assert.equal(nextRow?.paymentAmount, 1500000);
    assert.equal(nextRow?.basePrice, 1500000);
    assert.equal(prismaClient.serviceCalls.get(next.id).startTime, "16:00");
    assert.equal(prismaClient.serviceCalls.get(next.id).courseId, "course-a");

    const arrivalAudit = prismaClient.auditEvents.find(
      (event: { action: string; afterValue?: { actualEntryTime?: string | null } }) =>
        event.action === "service_call.row_changed" && event.afterValue?.actualEntryTime === "15:20"
    );
    assert.equal(arrivalAudit?.beforeValue?.actualEntryTime ?? null, null);

    await assert.rejects(
      () =>
        autosaveServiceCallRow({
          serviceCallId: late.id,
          operatingMonthId: late.operatingMonthId,
          serviceDate: late.serviceDate,
          startTime: late.startTime,
          roomId: late.roomId,
          courseId: late.courseId,
          therapist1Id: "therapist-1",
          status: late.status,
          paymentMethodCode: late.paymentMethodCode,
          actualEntryTime: "15:25",
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_INPUT"
    );
    assert.equal(prismaClient.serviceCalls.get(late.id).actualEntryTime, "15:20");

    const cleared = await autosaveServiceCallRow({
      serviceCallId: late.id,
      operatingMonthId: late.operatingMonthId,
      serviceDate: late.serviceDate,
      startTime: late.startTime,
      roomId: late.roomId,
      courseId: late.courseId,
      therapist1Id: "therapist-1",
      status: late.status,
      paymentMethodCode: late.paymentMethodCode,
      actualEntryTime: null,
      actorId: "counter-account",
      prismaClient
    });
    assert.equal(cleared.actualEntryTime, null);
    assert.equal(cleared.displayEnd, "16:00");
    assert.equal(cleared.warningTime, null);
  });
});

function visitCall(prismaClient: ReturnType<typeof createMemoryPrisma>, overrides: Partial<Parameters<typeof saveBasicServiceCallRow>[0]> = {}) {
  return {
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "11:00",
    roomId: "room-101",
    courseId: "course-a",
    status: "예약",
    actorId: "counter-account",
    prismaClient,
    ...overrides
  };
}

function ledgerRow(overrides: Partial<ServiceCallRowDto>): ServiceCallRowDto {
  return {
    id: "call",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "11:00",
    actualEntryTime: null,
    displayEnd: "12:00",
    warningTime: null,
    roomId: "room-101",
    roomLabel: "101",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: null,
    therapist1: null,
    therapist2: null,
    earcare: null,
    status: "방문완료",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    confirmationCode: null,
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 0,
    calculationStatus: "calculated",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    savedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

describe("calculation warning calls", () => {
  it("lists the ledger rows whose calculation failed, in ledger order, with the time, memo, and calculation status", () => {
    const warnings = calculationWarningCallsFromRows([
      ledgerRow({ id: "calculated", startTime: "10:00" }),
      ledgerRow({ id: "rate", startTime: "11:00", customerMemo: "민아", calculationStatus: "therapist_rate_missing" }),
      ledgerRow({ id: "reserved", startTime: "12:00", status: "예약", calculationStatus: "not_completed" }),
      ledgerRow({ id: "policy", startTime: "13:00", calculationStatus: "course_policy_missing" }),
      ledgerRow({ id: "second", startTime: "14:00", customerMemo: "지윤", calculationStatus: "second_therapist_required" })
    ]);

    assert.deepEqual(warnings, [
      {
        serviceCallId: "rate",
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "11:00",
        customerMemo: "민아",
        calculationStatus: "therapist_rate_missing"
      },
      {
        serviceCallId: "policy",
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "13:00",
        customerMemo: null,
        calculationStatus: "course_policy_missing"
      },
      {
        serviceCallId: "second",
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "14:00",
        customerMemo: "지윤",
        calculationStatus: "second_therapist_required"
      }
    ]);
  });
});

describe("ledger status counts", () => {
  it("counts all calls and each status, accepting both the Korean label and the stable code", () => {
    const counts = ledgerStatusCountsFromRows([
      ledgerRow({ id: "r1", status: "예약" }),
      ledgerRow({ id: "r2", status: "RESERVED" }),
      ledgerRow({ id: "u1", status: "IN_USE" }),
      ledgerRow({ id: "c1", status: "청소중" }),
      ledgerRow({ id: "v1", status: "VISIT_COMPLETE" }),
      ledgerRow({ id: "v2", status: "방문완료" }),
      ledgerRow({ id: "n1", status: "NO_SHOW" }),
      ledgerRow({ id: "x1", status: "CANCELED" })
    ]);

    assert.deepEqual(counts, {
      totalCount: 8,
      reservedCount: 2,
      inUseCount: 1,
      cleaningCount: 1,
      completedCount: 2,
      noShowCount: 1,
      canceledCount: 1
    });
    assert.deepEqual(ledgerStatusCountsFromRows([]), {
      totalCount: 0,
      reservedCount: 0,
      inUseCount: 0,
      cleaningCount: 0,
      completedCount: 0,
      noShowCount: 0,
      canceledCount: 0
    });
  });
});
