import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  autosaveServiceCallRow,
  calculationWarningCallsFromRows,
  correctServiceCallCustomerLink,
  createCustomer,
  createDailyExpense,
  createQuickBookingParty,
  createQuickBookingServiceCall,
  createServiceCallRow,
  customerSharedPhone,
  customerVisitCountsFromRows,
  deactivateDailyExpense,
  getDailyCallLedgerSummary,
  getServiceCallRow,
  listAssignedServiceCallsForEmployeeOnDate,
  listCustomerVisitHistory,
  listCustomers,
  ledgerStatusCountsFromRows,
  mostRecentCustomerVisit,
  listDailyExpensesForDate,
  listCompletedServiceCallCalculationsForDate,
  listServiceCallStatusHistory,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  listTherapistAvailability,
  redactServiceCallSettlementAmounts,
  roomFloorFactsForDate,
  saveBasicServiceCallRow,
  searchCustomerVisitCandidates,
  QuickBookingGuestError,
  ServiceCallDomainError,
  updateCustomer,
  updateDailyExpense,
  type CustomerVisitHistoryRowDto,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import { createCourse, reactivateCourse } from "@/modules/masters/course-service";

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
    ["course-missing-rate", { id: "course-missing-rate", code: "C", isActive: true, createdAt, updatedAt }]
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
        name: "C 귀청소90",
        durationMinutes: 90,
        basePrice: 1800000,
        requiresSecondTherapist: false,
        tvDisplayName: "C90",
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
  const plannedWorkingDays = new Map<string, any>();
  const statusHistories: any[] = [];
  const auditEvents: any[] = [];
  // 실제 DB의 @updatedAt처럼 콜을 고칠 때마다 updatedAt이 앞으로 간다. 같은 값이 다시 나오면 오래된 저장을 가려낼 수 없다.
  let serviceCallClock = Date.parse("2026-06-09T01:00:00.000Z");

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
      async findMany({ orderBy }: any = {}) {
        const ascending = Array.isArray(orderBy) && orderBy[0]?.monthKey === "asc";
        return [...operatingMonths.values()].sort((a, b) => (ascending ? a.monthKey.localeCompare(b.monthKey) : b.monthKey.localeCompare(a.monthKey)));
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
        if (where.code) return [...courses.values()].find((course) => course.code === where.code) ?? null;
        return courses.get(where.id) ?? null;
      },
      async findMany() {
        return [...courses.values()].sort((a, b) => a.code.localeCompare(b.code));
      },
      // 코스 기준정보(다시 사용, 새 코스 추가)가 같은 클라이언트로 쓰는 경로.
      async create({ data }: any) {
        const record = { id: `course-${data.code.toLowerCase()}`, ...data, createdAt, updatedAt };
        courses.set(record.id, record);
        return record;
      },
      async updateMany({ where, data }: any) {
        const record = courses.get(where.id);
        if (!record) return { count: 0 };
        courses.set(where.id, { ...record, ...data });
        return { count: 1 };
      }
    },
    coursePolicy: {
      async create({ data }: any) {
        const record = { id: `policy-${data.courseId}-${coursePolicies.size}`, ...data, createdAt, updatedAt };
        coursePolicies.set(record.id, record);
        return record;
      },
      async findUnique({ where }: any) {
        return coursePolicies.get(where.id) ?? null;
      },
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
        // 요청 id는 비어 있을 수 있고, 값이 있으면 실제 DB의 유일 인덱스처럼 같은 값을 두 번 받지 않는다.
        if (data.requestId != null && [...serviceCalls.values()].some((call) => call.requestId === data.requestId)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`request_id`)"), { code: "P2002", meta: { target: ["request_id"] } });
        }
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
              (where?.partyId === undefined || call.partyId === where.partyId) &&
              matchesDay(call.serviceDate, where?.serviceDate)
          )
          .map(withRelations);
      },
      async findUnique({ where }: any) {
        const record =
          where.requestId === undefined ? serviceCalls.get(where.id) : [...serviceCalls.values()].find((call) => call.requestId === where.requestId);
        return record ? withRelations(record) : null;
      },
      async updateMany({ where, data }: any) {
        const record = serviceCalls.get(where.id);
        if (!record || (where.operatingMonthId && record.operatingMonthId !== where.operatingMonthId)) {
          return { count: 0 };
        }
        // id·updatedAt 조건부 갱신: 조건의 updatedAt이 지금 행과 다르면 실제 DB처럼 아무것도 고치지 않고 0건이다.
        if (where.updatedAt !== undefined && record.updatedAt.getTime() !== where.updatedAt.getTime()) {
          return { count: 0 };
        }
        serviceCallClock += 1000;
        serviceCalls.set(where.id, { ...record, ...data, updatedAt: new Date(serviceCallClock) });
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
          preferenceNote: data.preferenceNote ?? null,
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
          preferenceNote: data.preferenceNote === undefined ? record.preferenceNote : data.preferenceNote,
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
    // 근무표(27)의 그날 근무 예정 조회(listPlannedWorkingDayStatusesForDate, 티켓 29가 listTherapistAvailability에서 재사용).
    plannedWorkingDay: {
      async findMany({ where }: any = {}) {
        return [...plannedWorkingDays.values()].filter((record) => {
          if (where?.employeeId?.in && !where.employeeId.in.includes(record.employeeId)) return false;
          if (where?.workDate !== undefined && !sameDate(record.workDate, where.workDate)) return false;
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
    therapistCourseRates,
    employees,
    timeSlots,
    therapistAttendances,
    plannedWorkingDays
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
    assert.equal(row.paymentAmount, 1400000);
    assert.equal(row.discountAmount, 100000);
    assert.equal(row.therapist1Commission, 0);
    assert.equal(row.therapist2Commission, 0);
    assert.equal(row.calculationStatus, "calculated");
    assert.equal(prismaClient.assignments.size, 2);

    const saved = [...prismaClient.serviceCalls.values()][0];
    assert.equal(saved.roomId, "room-101");
    assert.equal(saved.courseId, "course-a");
    assert.equal(saved.status, "예약");
    assert.equal(saved.paymentMethodCode, "현금");
  });

  it("lists a call that still carries an earcare assignment from before migration 0006 (ADR 0006)", async () => {
    const prismaClient = createMemoryPrisma();
    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "귀케어 남은 콜",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });
    await prismaClient.serviceCallAssignment.create({ data: { serviceCallId: row.id, employeeId: "therapist-2", assignmentRole: "EARCARE" } });

    const rows = await listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].therapist1?.id, "therapist-1");
    assert.equal(rows[0].therapist2, null);
  });

  it("saves the call's visit request apart from its note, and both show up distinctly on reload (F06, 티켓 23)", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      note: "카운터 전달용 비고",
      visitRequest: "조명을 어둡게 해 주세요",
      prismaClient
    });

    assert.equal(row.note, "카운터 전달용 비고");
    assert.equal(row.visitRequest, "조명을 어둡게 해 주세요");

    const reloaded = await getServiceCallRow({ serviceCallId: row.id, prismaClient });
    assert.equal(reloaded.note, "카운터 전달용 비고");
    assert.equal(reloaded.visitRequest, "조명을 어둡게 해 주세요");

    const edited = await saveBasicServiceCallRow({
      serviceCallId: row.id,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      note: "카운터 전달용 비고",
      visitRequest: "조명은 그대로, 향은 라벤더로",
      expectedUpdatedAt: row.updatedAt,
      prismaClient
    });

    // 방문별 요청만 고쳤는데 비고가 그대로인 것으로, 두 칸이 서로 독립임을 확인한다.
    assert.equal(edited.note, "카운터 전달용 비고");
    assert.equal(edited.visitRequest, "조명은 그대로, 향은 라벤더로");
  });

  it("rejects a visit-request-only edit under STALE_CALL the same way other fields are (F06, 티켓 23)", async () => {
    const prismaClient = createMemoryPrisma();
    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      visitRequest: "원래 요청",
      prismaClient
    });

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          serviceCallId: row.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          status: "예약",
          visitRequest: "다른 화면이 먼저 바꾼 요청",
          expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "STALE_CALL"
    );
  });

  it("blocks a visit-request edit into a locked operating month, same as every other field (F06, 티켓 23)", async () => {
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
          visitRequest: "잠긴 월의 요청",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
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

  it("calculates completed-call payment, fixed discount, and commissions from policy sources", async () => {
    const prismaClient = createMemoryPrisma();

    const row = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
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
      status: "방문완료",
      prismaClient
    });

    assert.equal(row.therapist1Commission, 700000);
    const redacted = redactServiceCallSettlementAmounts(row);
    assert.equal(redacted.paymentAmount, row.paymentAmount);
    assert.equal(redacted.discountAmount, row.discountAmount);
    assert.equal(redacted.therapist1Commission, 0);
    assert.equal(redacted.therapist2Commission, 0);
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
      // 방문완료 이전에는 수당이 발생하지 않는다.
      assert.equal(row.therapist1Commission, 0);
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
          expectedUpdatedAt: original.updatedAt,
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
      expectedUpdatedAt: original.updatedAt,
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

  it("autosave writes an edited visit request instead of reverting it to the old value (S1)", async () => {
    const prismaClient = createMemoryPrisma();
    const original = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      visitRequest: "조용한 방으로 부탁드립니다",
      prismaClient
    });
    assert.equal(original.visitRequest, "조용한 방으로 부탁드립니다");

    const saved = await autosaveServiceCallRow({
      serviceCallId: original.id,
      expectedUpdatedAt: original.updatedAt,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      visitRequest: "창가 쪽으로 바꿔주세요",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.visitRequest, "창가 쪽으로 바꿔주세요");
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
      expectedUpdatedAt: original.updatedAt,
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

    const first = await autosaveServiceCallRow({
      serviceCallId: original.id,
      expectedUpdatedAt: original.updatedAt,
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
      expectedUpdatedAt: first.updatedAt,
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
      expectedUpdatedAt: original.updatedAt,
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
      status: "예약",
      prismaClient
    });

    const saved = await autosaveServiceCallRow({
      serviceCallId: original.id,
      expectedUpdatedAt: original.updatedAt,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      therapist2Id: null,
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(saved.therapist2, null);
    assert.equal(prismaClient.assignments.size, 2);
    assert.equal([...prismaClient.assignments.values()].filter((assignment: any) => assignment.isActive === false).length, 1);
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
          expectedUpdatedAt: original.updatedAt,
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
          expectedUpdatedAt: original.updatedAt,
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
          expectedUpdatedAt: original.updatedAt,
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
      { id: created.id, name: "민아", phone: "090111", memo: "단골", preferenceNote: null }
    );
  });

  it("creates a customer with a common preference/caution note kept apart from the call memo (F06, 티켓 23)", async () => {
    const prismaClient = createMemoryPrisma();

    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      preferenceNote: "라벤더 오일 알레르기",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(created.memo, "단골");
    assert.equal(created.preferenceNote, "라벤더 오일 알레르기");
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
      { id: created.id, name: "민아정정", phone: "091222", memo: "메모수정", preferenceNote: null }
    ]);
  });

  it("corrects a customer's common preference/caution note without touching the memo (F06, 티켓 23)", async () => {
    const prismaClient = createMemoryPrisma();
    const created = await createCustomer({
      name: "민아",
      phone: "090111",
      memo: "단골",
      preferenceNote: "조용한 방 선호",
      actorId: "counter-account",
      prismaClient
    });

    const updated = await updateCustomer({
      customerId: created.id,
      name: "민아",
      phone: "090111",
      memo: "단골",
      preferenceNote: "라벤더 오일 알레르기",
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(updated.memo, "단골");
    assert.equal(updated.preferenceNote, "라벤더 오일 알레르기");
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

    const linked = await correctServiceCallCustomerLink({
      serviceCallId: saved.id,
      reason: "연결 확인 후 정정",
      expectedUpdatedAt: saved.updatedAt,
      customerId: sua.id,
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(linked.customerId, sua.id);
    assert.equal(linked.customerMemo, "090111 단골이라고 적힘");

    const unlinked = await correctServiceCallCustomerLink({
      serviceCallId: saved.id,
      reason: "연결 확인 후 정정",
      expectedUpdatedAt: linked.updatedAt,
      customerId: null,
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
          expectedUpdatedAt: original.updatedAt,
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
    await correctServiceCallCustomerLink({
      serviceCallId: saved.id,
      reason: "고객 확인 후 연결 정정",
      expectedUpdatedAt: saved.updatedAt,
      customerId: created.id,
      actorId: "counter-account",
      prismaClient
    });

    assert.deepEqual(
      prismaClient.auditEvents.map((event: { action: string }) => event.action),
      ["customer.created", "customer.changed", "service_call.customer_link_corrected"]
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
    assert.equal((await getServiceCallRow({ serviceCallId: saved.id, prismaClient })).customerMemo, "원장 표기");
    assert.equal(prismaClient.auditEvents[2].reason, "고객 확인 후 연결 정정");
  });

  it("carries the visit request along in the row_changed audit snapshot untouched (F06, 티켓 23)", async () => {
    const prismaClient = createMemoryPrisma();
    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      visitRequest: "창가 자리 선호",
      prismaClient
    });

    // 실제입장만 바꾸는 민감한 행 정정에도 방문별 요청은 감사 스냅샷에 그대로 남는다.
    await autosaveServiceCallRow({
      serviceCallId: saved.id,
      expectedUpdatedAt: saved.updatedAt,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      actualEntryTime: "11:00",
      status: "예약",
      visitRequest: "창가 자리 선호",
      actorId: "counter-account",
      prismaClient
    });

    const rowChanged = prismaClient.auditEvents.find((event: { action: string }) => event.action === "service_call.row_changed");
    assert.equal(rowChanged.beforeValue.visitRequest, "창가 자리 선호");
    assert.equal(rowChanged.afterValue.visitRequest, "창가 자리 선호");
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
          expectedUpdatedAt: saved.updatedAt,
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
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_CUSTOMER_LINK_CORRECTION_REQUIRED"
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

  it("기존 콜의 고객 연결은 일반 자동저장 직접 호출로도 바꿀 수 없다 (ticket 37)", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "정정 대상", actorId: "counter-account", prismaClient });
    const saved = await saveBasicServiceCallRow({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", startTime: "11:00", roomId: "room-101", courseId: "course-a", status: "예약", prismaClient });
    const auditCount = prismaClient.auditEvents.length;
    await assert.rejects(() => autosaveServiceCallRow({ serviceCallId: saved.id, expectedUpdatedAt: saved.updatedAt, operatingMonthId: saved.operatingMonthId, serviceDate: saved.serviceDate, startTime: saved.startTime, roomId: saved.roomId, courseId: saved.courseId, status: saved.status, customerId: customer.id, actorId: "counter-account", prismaClient }), (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_CUSTOMER_LINK_CORRECTION_REQUIRED");
    assert.equal((await getServiceCallRow({ serviceCallId: saved.id, prismaClient })).customerId, null);
    assert.equal(prismaClient.auditEvents.length, auditCount);
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
    // 빠른 예약 고객 단계의 최근 방문 가져오기(티켓 24)가 쓰는 코스·Therapist id와 방문별 요청.
    assert.equal(rows[0].courseId, "course-a");
    assert.equal(rows[0].therapist1Id, "therapist-1");
    assert.equal(rows[0].therapist2Id, null);
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
          expectedUpdatedAt: locked.updatedAt.toISOString(),
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

  it("groups customer and unlinked memo candidates, counts each candidate's completed visits, and marks a shared phone only among customers whose digits match within that search's results", async () => {
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
    // 둘 다 "민아"에 걸리지만 수아는 걸리지 않는 검색이라, 전화가 같아도 이 결과 안에서는 혼자다(공유 경고 없음).
    assert.deepEqual(await searchCustomerVisitCandidates({ query: " 민아 ", prismaClient }), [
      { kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03", completedVisitCount: 0, sharedPhone: false },
      {
        kind: "customer",
        customerId: mina.id,
        label: "원장표기",
        phone: "090111",
        latestVisitDate: "2026-06-20",
        completedVisitCount: 1,
        sharedPhone: false
      },
      { kind: "memo", customerId: null, label: "다른 사람", phone: null, latestVisitDate: "2026-06-04", completedVisitCount: 0, sharedPhone: false }
    ]);
    // 연락처로 검색하면 민아와 수아가 같이 걸리고, 숫자만 비교한 연락처가 같아 둘 다 공유 경고가 선다.
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "090111", prismaClient }), [
      {
        kind: "customer",
        customerId: mina.id,
        label: "원장표기",
        phone: "090111",
        latestVisitDate: "2026-06-20",
        completedVisitCount: 1,
        sharedPhone: true
      },
      { kind: "memo", customerId: null, label: "090111 적힘", phone: null, latestVisitDate: "2026-06-06", completedVisitCount: 0, sharedPhone: false },
      {
        kind: "customer",
        customerId: sua.id,
        label: "수아표기",
        phone: "090111",
        latestVisitDate: "2026-06-05",
        completedVisitCount: 1,
        sharedPhone: true
      }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "단골", prismaClient }), [
      {
        kind: "customer",
        customerId: mina.id,
        label: "원장표기",
        phone: "090111",
        latestVisitDate: "2026-06-20",
        completedVisitCount: 1,
        sharedPhone: false
      }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "조용", prismaClient }), [
      {
        kind: "customer",
        customerId: mina.id,
        label: "원장표기",
        phone: "090111",
        latestVisitDate: "2026-06-20",
        completedVisitCount: 1,
        sharedPhone: false
      }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "창가", prismaClient }), [
      { kind: "memo", customerId: null, label: "민아 메모", phone: null, latestVisitDate: "2026-07-03", completedVisitCount: 0, sharedPhone: false }
    ]);
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "lan", prismaClient }), [
      { kind: "customer", customerId: lan.id, label: "Lan", phone: "091000", latestVisitDate: null, completedVisitCount: 0, sharedPhone: false }
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

  it("marks a shared phone by comparing digits only, ignores formatting, does not interpret a country code, and skips an empty phone", async () => {
    const prismaClient = createMemoryPrisma();
    const formatted = await createCustomer({ name: "서식 전화", phone: "090-222-3333", memo: null, actorId: "counter-account", prismaClient });
    const plain = await createCustomer({ name: "숫자만 전화", phone: "0902223333", memo: null, actorId: "counter-account", prismaClient });
    const countryCode = await createCustomer({ name: "국가번호 전화", phone: "+84902223333", memo: null, actorId: "counter-account", prismaClient });
    const blank = await createCustomer({ name: "전화 없음", phone: "", memo: null, actorId: "counter-account", prismaClient });

    for (const [customer, day] of [
      [formatted, "2026-06-01"],
      [plain, "2026-06-02"],
      [countryCode, "2026-06-03"],
      [blank, "2026-06-04"]
    ] as const) {
      await saveBasicServiceCallRow({
        ...visitCall(prismaClient),
        serviceDate: day,
        customerId: customer.id,
        customerMemo: customer.name,
        status: "예약"
      });
    }

    const results = await searchCustomerVisitCandidates({ query: "전화", prismaClient });
    const sharedByLabel = new Map(results.map((candidate) => [candidate.label, candidate.sharedPhone]));

    // 서식(하이픈)만 다르고 숫자는 같아 공유로 본다.
    assert.equal(sharedByLabel.get("서식 전화"), true);
    assert.equal(sharedByLabel.get("숫자만 전화"), true);
    // 국가번호를 붙인 자리는 해석하지 않아 숫자 문자열이 달라 공유로 보지 않는다.
    assert.equal(sharedByLabel.get("국가번호 전화"), false);
    // 연락처가 빈 고객은 비교 대상이 아니다.
    assert.equal(sharedByLabel.get("전화 없음"), false);
  });

  it("S5: finds a shared phone for an already-chosen customer even without a search query", async () => {
    const prismaClient = createMemoryPrisma();
    const mina = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const sua = await createCustomer({ name: "수아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const lan = await createCustomer({ name: "Lan", phone: "091000", memo: null, actorId: "counter-account", prismaClient });

    // 검색 결과 밖(쿼리 없음)에서도 고객 화면 직접 진입(visitCustomer=)·빠른 예약 고객 선택 후와 같은
    // 모양으로 확인한다. searchCustomerVisitCandidates의 query가 ""면 빈 배열이라 이 경고를 줄 수 없다.
    assert.deepEqual(await searchCustomerVisitCandidates({ query: "", prismaClient }), []);

    assert.equal(await customerSharedPhone({ customerId: mina.id, prismaClient }), true);
    assert.equal(await customerSharedPhone({ customerId: sua.id, prismaClient }), true);
    assert.equal(await customerSharedPhone({ customerId: lan.id, prismaClient }), false);
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
    requiresSecondTherapist: input.requiresSecondTherapist ?? false,
    tvDisplayName: input.code,
    effectiveFromMonth: "2026-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt: createdAt
  });
}

function addTherapist(prismaClient: ReturnType<typeof createMemoryPrisma>, id: string) {
  const createdAt = new Date("2026-06-01T00:00:00.000Z");
  prismaClient.employees.set(id, {
    id,
    displayName: id,
    staffCode: id.toUpperCase(),
    employeeGroup: "THERAPIST",
    position: "마사지사",
    shiftType: "전체",
    baseSalary: 0,
    phone: null,
    birthday: null,
    hireDate: null,
    employmentStatus: "재직",
    sortOrder: 90 + prismaClient.employees.size,
    isActive: true,
    createdAt,
    updatedAt: createdAt
  });
}

function addAvailabilityRate(
  prismaClient: ReturnType<typeof createMemoryPrisma>,
  input: {
    therapistId: string;
    courseId: string;
    amount?: number;
    effectiveFromMonth?: string;
    effectiveToMonth?: string | null;
    isActive?: boolean;
  }
) {
  const createdAt = new Date("2026-06-01T00:00:00.000Z");
  const id = `rate-${input.therapistId}-${input.courseId}-${prismaClient.therapistCourseRates.size}`;
  prismaClient.therapistCourseRates.set(id, {
    id,
    therapistId: input.therapistId,
    courseId: input.courseId,
    amount: input.amount ?? 500000,
    effectiveFromMonth: input.effectiveFromMonth ?? "2026-06",
    effectiveToMonth: input.effectiveToMonth ?? null,
    isActive: input.isActive ?? true,
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
    roomId?: string | null;
    createdAt?: Date;
    // assignmentRole은 DB에서 자유 문자열이라, 역할과 무관하게 매칭하는 쿼리(listAssignedServiceCallsForEmployeeOnDate)를
    // 검증할 때는 THERAPIST_1·THERAPIST_2가 아닌 값도 넣어 본다.
    assignments: Array<{ role: string; employeeId: string }>;
  }
) {
  const createdAt = input.createdAt ?? new Date("2026-06-10T00:00:00.000Z");
  prismaClient.serviceCalls.set(input.id, {
    id: input.id,
    operatingMonthId: "month-2026-06",
    serviceDate: dbDate(input.serviceDate ?? availabilityDate),
    startTime: input.startTime,
    actualEntryTime: input.actualEntryTime ?? null,
    roomId: input.roomId === undefined ? "room-101" : input.roomId,
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

function courseVerdict(rows: Awaited<ReturnType<typeof listTherapistAvailability>>, therapistId: string, courseId: string) {
  return rows.find((row) => row.therapistId === therapistId)?.courses.find((course) => course.courseId === courseId)?.verdict;
}

describe("therapist availability", () => {
  // 코스 기준정보에서 다시 켠 코스와 새로 더한 코스는 가능 코스, 빠른 예약·원장 코스 선택에 바로 나온다(스펙 D9).
  it("shows a course turned back on and a newly added course in availability and the course options right away", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCourse(prismaClient, { id: "course-b", code: "B", name: "B 90", durationMinutes: 90, isActive: false });
    const courseIds = async () => ({
      availability: (await availabilityAt(prismaClient, "15:00")).find((row) => row.therapistId === "therapist-1")?.courses.map((course) => course.courseId),
      options: (await listServiceCallFormOptions({ operatingMonthId: "month-2026-06", prismaClient })).courses.map((course) => course.value)
    });

    const before = await courseIds();
    assert.equal(before.availability?.includes("course-b"), false);
    assert.equal(before.options.includes("course-b"), false);

    const june = new Date("2026-06-15T05:00:00.000Z");
    await reactivateCourse({ actorId: "admin-1", courseId: "course-b", now: june, prismaClient });
    const added = await createCourse({
      actorId: "admin-1",
      code: "F",
      name: "F 75",
      durationMinutes: 75,
      basePrice: 1700000,
      requiresSecondTherapist: false,
      tvDisplayName: "F 75",
      effectiveFromMonth: "2026-06",
      effectiveToMonth: "2026-06",
      now: june,
      prismaClient
    });

    const after = await courseIds();
    assert.ok(after.availability?.includes("course-b"));
    assert.ok(after.availability?.includes(added.id));
    assert.ok(after.options.includes("course-b"));
    assert.ok(after.options.includes(added.id));
    // 새 코스는 아직 Therapist 수당이 없어 "이 코스 불가"로 나온다. 칩 문구는 코드와 시간이다.
    const rows = await availabilityAt(prismaClient, "15:00");
    const newCourse = rows.find((row) => row.therapistId === "therapist-1")?.courses.find((course) => course.courseId === added.id);
    assert.deepEqual(newCourse && { code: newCourse.courseCode, minutes: newCourse.durationMinutes, verdict: newCourse.verdict }, { code: "F", minutes: 75, verdict: "rate_missing" });
  });

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
    assert.equal(therapist1?.attendance, "before_check_in");
    assert.equal(courseVerdict(rows, "therapist-1", "course-a"), "time_short");
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
    addAvailabilityCourse(prismaClient, { id: "course-e", code: "E", name: "E 120", durationMinutes: 120 });
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
      row?.courses.map((course) => ({ courseId: course.courseId, durationMinutes: course.durationMinutes, verdict: course.verdict })),
      [
        { courseId: "course-a", durationMinutes: 60, verdict: "possible" },
        { courseId: "course-missing-rate", durationMinutes: 90, verdict: "rate_missing" },
        { courseId: "course-d", durationMinutes: 90, verdict: "time_short" },
        { courseId: "course-e", durationMinutes: 120, verdict: "rate_missing" }
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

  it("occupies the second therapist assignment", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "call-second-assignment",
      startTime: "14:00",
      courseId: "course-missing-rate",
      status: "예약",
      assignments: [{ role: "THERAPIST_2", employeeId: "therapist-2" }]
    });

    const rows = await availabilityAt(prismaClient, "15:00");
    assert.equal(rows.find((row) => row.therapistId === "therapist-1")?.available, true);
    assert.equal(rows.find((row) => row.therapistId === "therapist-2")?.available, false);
    assert.equal(rows.find((row) => row.therapistId === "therapist-2")?.freeFrom, "15:30");
  });

  it("offers a second-therapist course only when another active therapist is free for the whole duration", async () => {
    const open = createMemoryPrisma();
    addAvailabilityCourse(open, { id: "course-e", code: "E", name: "E 120", durationMinutes: 120 });
    addAvailabilityRate(open, { therapistId: "therapist-1", courseId: "course-e" });
    const openRows = await availabilityAt(open, "15:00");
    const openTherapist = openRows.find((row) => row.therapistId === "therapist-1");
    assert.equal(openTherapist?.freeMinutes, 600);
    assert.equal(courseVerdict(openRows, "therapist-1", "course-a"), "possible");
    assert.equal(courseVerdict(openRows, "therapist-1", "course-e"), "possible");
    assert.equal(courseVerdict(openRows, "therapist-1", "course-d"), "possible");

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
    assert.equal(courseVerdict(blockedRows, "therapist-1", "course-a"), "possible");
    assert.equal(courseVerdict(blockedRows, "therapist-1", "course-missing-rate"), "rate_missing");
    assert.equal(courseVerdict(blockedRows, "therapist-1", "course-d"), "time_short");

    const alone = createMemoryPrisma();
    alone.employees.get("therapist-2").isActive = false;
    const aloneRows = await availabilityAt(alone, "15:00");
    assert.deepEqual(aloneRows.map((row) => row.therapistId), ["therapist-1"]);
    assert.equal(courseVerdict(aloneRows, "therapist-1", "course-a"), "possible");
    assert.equal(courseVerdict(aloneRows, "therapist-1", "course-d"), "rate_missing");
  });

  it("lists every active therapist, with attendance as a label, and leaves out operations and inactive therapists", async () => {
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
      checkOutMinute: null,
      isActive: true
    });
    prismaClient.therapistAttendances.set("att-2", {
      id: "att-2",
      operatingMonthId: "month-2026-06",
      attendanceDate: dbDate(availabilityDate),
      employeeId: "therapist-2",
      checkOutMinute: null,
      isActive: false
    });

    const rows = await availabilityAt(prismaClient, "15:00");
    assert.deepEqual(
      rows.map((row) => ({ therapistId: row.therapistId, attendance: row.attendance })),
      [
        { therapistId: "therapist-1", attendance: "checked_in" },
        { therapistId: "therapist-2", attendance: "before_check_in" }
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
    assert.equal(courseVerdict(before, "therapist-1", "course-missing-rate"), "rate_missing");

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

describe("therapist availability with course rates", () => {
  it("calls a course without a rate impossible for this course, even when the time is free or also short", async () => {
    const prismaClient = createMemoryPrisma();
    const free = (await availabilityAt(prismaClient, "15:00")).find((row) => row.therapistId === "therapist-1");
    assert.equal(free?.available, true);
    assert.equal(free?.freeMinutes, 600);
    assert.equal(courseVerdict([free!], "therapist-1", "course-missing-rate"), "rate_missing");
    assert.equal(courseVerdict([free!], "therapist-1", "course-a"), "possible");

    // 15:00–16:00 예약 다음의 15:30은 시간도 부족하다. 그래도 수당 쪽 판정이다.
    addAvailabilityCall(prismaClient, {
      id: "call-1500",
      startTime: "15:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const busy = (await availabilityAt(prismaClient, "15:30")).find((row) => row.therapistId === "therapist-1");
    assert.equal(busy?.available, false);
    assert.equal(courseVerdict([busy!], "therapist-1", "course-missing-rate"), "rate_missing");
    assert.equal(courseVerdict([busy!], "therapist-1", "course-a"), "time_short");
  });

  it("treats a valid 0 VND rate as a rate and judges the course by time", async () => {
    const prismaClient = createMemoryPrisma();
    // therapist-2의 A 수당은 0 VND다.
    addAvailabilityCall(prismaClient, {
      id: "call-1600",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-2" }]
    });
    assert.equal(courseVerdict(await availabilityAt(prismaClient, "15:00"), "therapist-2", "course-a"), "possible");
    assert.equal(courseVerdict(await availabilityAt(prismaClient, "15:30"), "therapist-2", "course-a"), "time_short");
  });

  it("offers a 60 minute course when 60 free minutes remain, and not when 59 do", async () => {
    const sixty = createMemoryPrisma();
    addAvailabilityCall(sixty, {
      id: "call-1600",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    const at1500 = await availabilityAt(sixty, "15:00");
    assert.equal(at1500.find((row) => row.therapistId === "therapist-1")?.freeMinutes, 60);
    assert.equal(courseVerdict(at1500, "therapist-1", "course-a"), "possible");

    const at1501 = await availabilityAt(sixty, "15:01");
    assert.equal(at1501.find((row) => row.therapistId === "therapist-1")?.freeMinutes, 59);
    assert.equal(courseVerdict(at1501, "therapist-1", "course-a"), "time_short");
  });

  it("offers a two-therapist course only when this therapist and another free active therapist both have its rate", async () => {
    // 기본: therapist-1, therapist-2 모두 D 수당이 있고 비어 있다.
    const both = createMemoryPrisma();
    assert.equal(courseVerdict(await availabilityAt(both, "15:00"), "therapist-1", "course-d"), "possible");

    // 이 Therapist에게 수당이 없으면 다른 사람이 있어도 수당 쪽 판정이다.
    const selfMissing = createMemoryPrisma();
    selfMissing.therapistCourseRates.delete("rate-therapist-1-d");
    assert.equal(courseVerdict(await availabilityAt(selfMissing, "15:00"), "therapist-1", "course-d"), "rate_missing");
    assert.equal(courseVerdict(await availabilityAt(selfMissing, "15:00"), "therapist-2", "course-d"), "rate_missing");

    // 비어 있는 다른 사람에게 수당이 없으면 짝이 없다.
    const partnerMissing = createMemoryPrisma();
    partnerMissing.therapistCourseRates.get("rate-therapist-2-d").effectiveToMonth = "2026-05";
    assert.equal(courseVerdict(await availabilityAt(partnerMissing, "15:00"), "therapist-1", "course-d"), "rate_missing");

    // 수당이 있는 짝은 같은 구간에 바쁘고, 비어 있는 다른 사람은 수당이 없다.
    const partnerBusy = createMemoryPrisma();
    addTherapist(partnerBusy, "therapist-3");
    addAvailabilityCall(partnerBusy, {
      id: "call-partner-1600",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-2" }]
    });
    const busyRows = await availabilityAt(partnerBusy, "15:00");
    assert.equal(busyRows.find((row) => row.therapistId === "therapist-3")?.available, true);
    assert.equal(courseVerdict(busyRows, "therapist-1", "course-d"), "time_short");

    // 그 비어 있는 사람에게 수당이 생기면 짝이 된다.
    addAvailabilityRate(partnerBusy, { therapistId: "therapist-3", courseId: "course-d", amount: 0 });
    assert.equal(courseVerdict(await availabilityAt(partnerBusy, "15:00"), "therapist-1", "course-d"), "possible");
  });

  it("코스별 판정에 두 번째 Therapist 필수 여부를 함께 담는다(티켓 21, 빠른 예약이 쓴다)", async () => {
    const prismaClient = createMemoryPrisma();
    const rows = await availabilityAt(prismaClient, "15:00");
    const row = rows.find((candidate) => candidate.therapistId === "therapist-1")!;
    assert.equal(row.courses.find((course) => course.courseId === "course-a")?.requiresSecondTherapist, false);
    assert.equal(row.courses.find((course) => course.courseId === "course-d")?.requiresSecondTherapist, true);
  });

  it("chooses the rate for the month the same way the completed amount calculation does", async () => {
    const scenarios: Array<{ name: string; rates: Array<Parameters<typeof addAvailabilityRate>[1]>; commission: number | null }> = [
      { name: "no rate", rates: [], commission: null },
      { name: "open-ended from this month", rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", amount: 400000 }], commission: 400000 },
      { name: "inactive", rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", isActive: false }], commission: null },
      { name: "starts next month", rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", effectiveFromMonth: "2026-07" }], commission: null },
      { name: "ended last month", rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", effectiveFromMonth: "2026-01", effectiveToMonth: "2026-05" }], commission: null },
      {
        name: "ends this month",
        rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", amount: 300000, effectiveFromMonth: "2026-01", effectiveToMonth: "2026-06" }],
        commission: 300000
      },
      { name: "zero VND", rates: [{ therapistId: "therapist-1", courseId: "course-missing-rate", amount: 0 }], commission: 0 },
      {
        name: "two valid, the later start wins",
        rates: [
          { therapistId: "therapist-1", courseId: "course-missing-rate", amount: 500000, effectiveFromMonth: "2026-01" },
          { therapistId: "therapist-1", courseId: "course-missing-rate", amount: 0, effectiveFromMonth: "2026-06" }
        ],
        commission: 0
      },
      { name: "another therapist only", rates: [{ therapistId: "therapist-2", courseId: "course-missing-rate" }], commission: null }
    ];

    for (const scenario of scenarios) {
      const prismaClient = createMemoryPrisma();
      for (const rate of scenario.rates) addAvailabilityRate(prismaClient, rate);
      const completed = await saveBasicServiceCallRow({
        operatingMonthId: "month-2026-06",
        serviceDate: availabilityDate,
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-missing-rate",
        therapist1Id: "therapist-1",
        status: "방문완료",
        paymentMethodCode: "현금",
        prismaClient
      });
      const verdict = courseVerdict(await availabilityAt(prismaClient, "15:00"), "therapist-1", "course-missing-rate");

      assert.equal(completed.calculationStatus === "calculated", scenario.commission !== null, scenario.name);
      assert.equal(verdict === "possible", completed.calculationStatus === "calculated", scenario.name);
      assert.equal(verdict, scenario.commission === null ? "rate_missing" : "possible", scenario.name);
      if (scenario.commission !== null) assert.equal(completed.therapist1Commission, scenario.commission, scenario.name);
    }
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
    assert.equal(courseVerdict([at1500!], "therapist-1", "course-a"), "time_short");

    const at1530 = (await overrunAvailabilityAt(prismaClient, "15:30")).find((row) => row.therapistId === "therapist-1");
    assert.equal(at1530?.available, true);
    assert.equal(at1530?.unavailableReason, null);
    assert.equal(at1530?.freeFrom, null);
    assert.equal(at1530?.priorServiceEndCheck, true);
    assert.equal(courseVerdict([at1530!], "therapist-1", "course-a"), "possible");

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
    assert.equal(courseVerdict([row!], "therapist-1", "course-a"), "time_short");
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
    assert.equal(courseVerdict(partnerRows, "therapist-1", "course-a"), "possible");
    assert.equal(courseVerdict(partnerRows, "therapist-1", "course-d"), "time_short");
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

function addAvailabilityAttendance(
  prismaClient: ReturnType<typeof createMemoryPrisma>,
  input: { employeeId: string; checkOutMinute: number | null; isActive?: boolean }
) {
  prismaClient.therapistAttendances.set(`att-${input.employeeId}`, {
    id: `att-${input.employeeId}`,
    operatingMonthId: "month-2026-06",
    attendanceDate: dbDate(availabilityDate),
    employeeId: input.employeeId,
    checkInMinute: 600,
    checkOutMinute: input.checkOutMinute,
    isActive: input.isActive ?? true
  });
}

// 근무표(27)의 그날 근무 예정(listPlannedWorkingDayStatusesForDate가 읽는 모양)을 심는다. 출근 기록(therapistAttendance)과는
// 별개의 테이블이라, 근무 예정·휴무와 실제 출근이 서로 다른 값으로 함께 나올 수 있다(티켓 29).
function addPlannedWorkingDay(
  prismaClient: ReturnType<typeof createMemoryPrisma>,
  input: { employeeId: string; status: "근무 예정" | "휴무"; date?: string }
) {
  const date = input.date ?? availabilityDate;
  prismaClient.plannedWorkingDays.set(`${input.employeeId}::${date}`, {
    employeeId: input.employeeId,
    workDate: dbDate(date),
    planStatus: input.status
  });
}

describe("therapist availability planned working day", () => {
  it("reads 미입력 when the schedule has no row for that therapist and date", async () => {
    const prismaClient = createMemoryPrisma();

    const rows = await availabilityAt(prismaClient, "15:00");

    assert.deepEqual(
      rows.map((row) => ({ therapistId: row.therapistId, plannedWorkingDayStatus: row.plannedWorkingDayStatus })),
      [
        { therapistId: "therapist-1", plannedWorkingDayStatus: "미입력" },
        { therapistId: "therapist-2", plannedWorkingDayStatus: "미입력" }
      ]
    );
  });

  it("reads each therapist's own 근무 예정/휴무 for that date, separate from attendance", async () => {
    const prismaClient = createMemoryPrisma();
    addPlannedWorkingDay(prismaClient, { employeeId: "therapist-1", status: "근무 예정" });
    addPlannedWorkingDay(prismaClient, { employeeId: "therapist-2", status: "휴무" });
    // 다른 날짜의 기록은 섞이지 않는다.
    addPlannedWorkingDay(prismaClient, { employeeId: "therapist-1", status: "휴무", date: "2026-06-11" });

    const rows = await availabilityAt(prismaClient, "15:00");

    assert.deepEqual(
      rows.map((row) => ({ therapistId: row.therapistId, plannedWorkingDayStatus: row.plannedWorkingDayStatus })),
      [
        { therapistId: "therapist-1", plannedWorkingDayStatus: "근무 예정" },
        { therapistId: "therapist-2", plannedWorkingDayStatus: "휴무" }
      ]
    );
  });

  it("does not turn off a 휴무 therapist's course button or availability — the schedule is a read-only note", async () => {
    const prismaClient = createMemoryPrisma();
    addPlannedWorkingDay(prismaClient, { employeeId: "therapist-1", status: "휴무" });

    const rows = await availabilityAt(prismaClient, "15:00");
    const therapist1 = rows.find((row) => row.therapistId === "therapist-1");

    assert.equal(therapist1?.plannedWorkingDayStatus, "휴무");
    assert.equal(therapist1?.available, true);
    assert.equal(courseVerdict(rows, "therapist-1", "course-a"), "possible");

    // 휴무라도 예약 저장 자체가 막히지 않는다: 근무표를 읽기만 할 뿐, 저장 경로(createQuickBookingServiceCall)는
    // 근무표를 전혀 조회하지 않으므로 그대로 저장된다.
    const saved = await createQuickBookingServiceCall({
      requestId: "request-schedule-day-off",
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "근무표 휴무 저장 확인",
      therapist1Id: "therapist-1",
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });
    assert.equal(saved.row.status, "예약");
  });
});

describe("therapist availability attendance and shift check", () => {
  it("tells before check-in, checked in, and checked out apart from the day's attendance, and keeps every row and course button", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityAttendance(prismaClient, { employeeId: "therapist-1", checkOutMinute: null });
    addAvailabilityAttendance(prismaClient, { employeeId: "therapist-2", checkOutMinute: 900 });

    const rows = await overrunAvailabilityAt(prismaClient, "15:30");
    assert.deepEqual(
      rows.map((row) => ({ therapistId: row.therapistId, attendance: row.attendance })),
      [
        { therapistId: "therapist-1", attendance: "checked_in" },
        { therapistId: "therapist-2", attendance: "checked_out" }
      ]
    );
    assert.equal(courseVerdict(rows, "therapist-1", "course-a"), "possible");
    assert.equal(courseVerdict(rows, "therapist-2", "course-a"), "possible");

    prismaClient.therapistAttendances.clear();
    addAvailabilityAttendance(prismaClient, { employeeId: "therapist-1", checkOutMinute: null, isActive: false });
    const beforeCheckIn = await overrunAvailabilityAt(prismaClient, "15:30");
    assert.deepEqual(beforeCheckIn.map((row) => row.attendance), ["before_check_in", "before_check_in"]);
    assert.equal(courseVerdict(beforeCheckIn, "therapist-1", "course-a"), "possible");
  });

  it("asks to check the shift only on today, more than 30 minutes after now, for a therapist who is not checked in", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityAttendance(prismaClient, { employeeId: "therapist-1", checkOutMinute: null });
    addAvailabilityAttendance(prismaClient, { employeeId: "therapist-2", checkOutMinute: 900 });
    const shiftChecks = async (time: string, now = overrunNow) =>
      (await overrunAvailabilityAt(prismaClient, time, now)).map((row) => ({ therapistId: row.therapistId, shiftCheck: row.shiftCheck }));

    // 지금 15:20. 40분 뒤는 붙고, 20분 뒤와 정확히 30분 뒤는 붙지 않는다.
    assert.deepEqual(await shiftChecks("16:00"), [
      { therapistId: "therapist-1", shiftCheck: false },
      { therapistId: "therapist-2", shiftCheck: true }
    ]);
    assert.deepEqual((await shiftChecks("15:40")).map((row) => row.shiftCheck), [false, false]);
    assert.deepEqual((await shiftChecks("15:50")).map((row) => row.shiftCheck), [false, false]);

    prismaClient.therapistAttendances.clear();
    assert.deepEqual((await shiftChecks("16:00")).map((row) => row.shiftCheck), [true, true]);

    // 고른 날짜가 어제(지금은 다음 영업일 15:20)면 붙지 않는다.
    const nextDay = new Date("2026-06-11T08:20:00.000Z");
    assert.deepEqual((await shiftChecks("16:00", nextDay)).map((row) => row.shiftCheck), [false, false]);
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
      expectedUpdatedAt: late.updatedAt,
      operatingMonthId: late.operatingMonthId,
      serviceDate: late.serviceDate,
      startTime: late.startTime,
      roomId: late.roomId,
      courseId: late.courseId,
      customerMemo: late.customerMemo,
      customerId: late.customerId,
      therapist1Id: late.therapist1?.id ?? null,
      therapist2Id: null,
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
          expectedUpdatedAt: saved.updatedAt,
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
      expectedUpdatedAt: saved.updatedAt,
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
    warnings: [],
    roomId: "room-101",
    roomLabel: "101",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: null,
    therapist1: null,
    therapist2: null,
    status: "방문완료",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    visitRequest: null,
    confirmationCode: null,
    partyId: null,
    partyPosition: null,
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
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

function visitHistoryRow(overrides: Partial<CustomerVisitHistoryRowDto>): CustomerVisitHistoryRowDto {
  return {
    serviceCallId: "call",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "11:00",
    courseId: "course-a",
    courseLabel: "A 누루60",
    therapist1Id: "therapist-1",
    therapist2Id: null,
    therapistLabel: "마사지사1",
    status: "방문완료",
    customerMemo: null,
    visitRequest: null,
    ...overrides
  };
}

describe("customer visit counts", () => {
  it("counts completed, no-show, and canceled rows, accepting both the Korean label and the stable code, and leaves out reserved/in-use/cleaning rows", () => {
    const counts = customerVisitCountsFromRows([
      visitHistoryRow({ serviceCallId: "v1", status: "방문완료" }),
      visitHistoryRow({ serviceCallId: "v2", status: "VISIT_COMPLETE" }),
      visitHistoryRow({ serviceCallId: "n1", status: "노쇼" }),
      visitHistoryRow({ serviceCallId: "c1", status: "취소" }),
      visitHistoryRow({ serviceCallId: "r1", status: "예약" }),
      visitHistoryRow({ serviceCallId: "u1", status: "사용중" }),
      visitHistoryRow({ serviceCallId: "cl1", status: "청소중" })
    ]);

    assert.deepEqual(counts, { completedCount: 2, noShowCount: 1, canceledCount: 1 });
  });

  it("includes zero counts for a selection with no matching visits yet", () => {
    assert.deepEqual(customerVisitCountsFromRows([]), { completedCount: 0, noShowCount: 0, canceledCount: 0 });
    assert.deepEqual(customerVisitCountsFromRows([visitHistoryRow({ status: "예약" })]), {
      completedCount: 0,
      noShowCount: 0,
      canceledCount: 0
    });
  });
});

describe("most recent customer visit (B09, 스토리 71-73, 티켓 24)", () => {
  // 영업일은 자정을 넘어 이어진다(11:00 ~ 다음날 01:00 같은 슬롯 순서, selectNowSlot과 같은 개념). 그래서
  // 같은 서비스 날짜 안에서는 시간 슬롯 정렬 순서(sortOrderByTime)로 비교해야 한다 — 글자 비교라면
  // "01:00"이 "15:00"보다 앞서 보이지만, 실제로는 자정을 넘긴 그 영업일의 더 늦은 슬롯이다(S6).
  const sortOrderByTime = new Map([
    ["11:00", 0],
    ["15:00", 8],
    ["23:30", 25],
    ["00:00", 26],
    ["00:30", 27],
    ["01:00", 28]
  ]);

  it("picks the row with the latest date and time regardless of status, not the completed-first order", () => {
    const older = visitHistoryRow({ serviceCallId: "older", serviceDate: "2026-06-01", startTime: "11:00", status: "방문완료" });
    const latestReservation = visitHistoryRow({ serviceCallId: "latest", serviceDate: "2026-06-20", startTime: "15:00", status: "예약" });
    const sameDayEarlier = visitHistoryRow({ serviceCallId: "same-day-earlier", serviceDate: "2026-06-10", startTime: "23:30", status: "노쇼" });

    assert.equal(mostRecentCustomerVisit([older, latestReservation, sameDayEarlier], sortOrderByTime)?.serviceCallId, "latest");
  });

  it("S6: within the same service date, a past-midnight slot (01:00) sorts after an earlier-clock slot (15:00), by time-slot order not string order", () => {
    const afternoon = visitHistoryRow({ serviceCallId: "afternoon", serviceDate: "2026-06-20", startTime: "15:00", status: "예약" });
    const pastMidnight = visitHistoryRow({ serviceCallId: "past-midnight", serviceDate: "2026-06-20", startTime: "01:00", status: "노쇼" });

    assert.equal(mostRecentCustomerVisit([afternoon, pastMidnight], sortOrderByTime)?.serviceCallId, "past-midnight");
    // 글자 비교("01:00" < "15:00")로는 틀린 답(afternoon)이 나왔던 자리다.
    assert.notEqual(mostRecentCustomerVisit([afternoon, pastMidnight], sortOrderByTime)?.serviceCallId, "afternoon");
  });

  it("returns null for an empty history", () => {
    assert.equal(mostRecentCustomerVisit([], sortOrderByTime), null);
  });
});

describe("row warnings", () => {
  // 영업일 2026-06-10의 16:05(현지 UTC+7)
  const at = (time: string) => new Date(`2026-06-10T${String(Number(time.slice(0, 2)) - 7).padStart(2, "0")}:${time.slice(3)}:00.000Z`);

  async function rowsAt(prismaClient: ReturnType<typeof createMemoryPrisma>, now: Date) {
    return listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: availabilityDate, prismaClient, now });
  }

  function yieldedPair(prismaClient: ReturnType<typeof createMemoryPrisma>) {
    // 15:00 사용중 콜은 16:00 예약에 양보해 표시 종료가 16:00이다.
    addAvailabilityCall(prismaClient, {
      id: "front",
      startTime: "15:00",
      actualEntryTime: "15:20",
      courseId: "course-a",
      status: "사용중",
      createdAt: new Date("2026-06-10T00:00:00.000Z"),
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "back",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      createdAt: new Date("2026-06-10T00:01:00.000Z"),
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
  }

  it("flags the later call as unfinished once now passes the yielded display end, and keeps the earlier call's yield warning", async () => {
    const prismaClient = createMemoryPrisma();
    yieldedPair(prismaClient);

    const rows = await rowsAt(prismaClient, at("16:05"));
    const front = rows.find((row) => row.id === "front");
    const back = rows.find((row) => row.id === "back");

    assert.equal(back?.startTime, "16:00");
    assert.deepEqual(back?.warnings, [
      { code: "previous_service_unfinished", relatedTime: "16:00", relatedCallIds: ["front"] }
    ]);
    assert.equal(front?.displayEnd, "16:00");
    assert.equal(front?.warningTime, "16:00");
    assert.deepEqual(front?.warnings, [{ code: "yield_to_reservation", relatedTime: "16:00", relatedCallIds: ["back"] }]);
  });

  it("does not flag while now is at or before the display end", async () => {
    const prismaClient = createMemoryPrisma();
    yieldedPair(prismaClient);

    const before = (await rowsAt(prismaClient, at("15:50"))).find((row) => row.id === "back");
    const exactly = (await rowsAt(prismaClient, at("16:00"))).find((row) => row.id === "back");

    assert.deepEqual(before?.warnings, []);
    assert.deepEqual(exactly?.warnings, []);
  });

  it("counts the previous call's second assignment role and ignores other therapists and non in-use statuses", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "assistant-front",
      roomId: "room-a",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [
        { role: "THERAPIST_1", employeeId: "therapist-2" },
        { role: "THERAPIST_2", employeeId: "therapist-1" }
      ]
    });
    addAvailabilityCall(prismaClient, {
      id: "cleaning-front",
      roomId: "room-b",
      startTime: "14:00",
      courseId: "course-a",
      status: "청소중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-3" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "mine",
      roomId: "room-c",
      startTime: "15:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "cleaning-back",
      roomId: "room-d",
      startTime: "15:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-3" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "elsewhere",
      roomId: "room-e",
      startTime: "15:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-4" }]
    });

    const rows = await rowsAt(prismaClient, at("15:30"));
    const warningsOf = (id: string) => rows.find((row) => row.id === id)?.warnings;

    assert.deepEqual(warningsOf("mine"), [
      { code: "previous_service_unfinished", relatedTime: "15:00", relatedCallIds: ["assistant-front"] }
    ]);
    assert.deepEqual(warningsOf("cleaning-back"), []);
    assert.deepEqual(warningsOf("elsewhere"), []);
  });

  it("leaves no-show and canceled calls without the unfinished sentence", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "front",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "no-show",
      startTime: "15:00",
      courseId: "course-a",
      status: "노쇼",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "canceled",
      startTime: "15:30",
      courseId: "course-a",
      status: "취소",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const rows = await rowsAt(prismaClient, at("16:30"));

    assert.deepEqual(rows.find((row) => row.id === "no-show")?.warnings, []);
    assert.deepEqual(rows.find((row) => row.id === "canceled")?.warnings, []);
  });

  it("does not flag a call that starts before, or with, the in-use call's start", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "in-use",
      roomId: "room-a",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "earlier",
      roomId: "room-b",
      startTime: "13:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "same-start",
      roomId: "room-c",
      startTime: "14:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const rows = await rowsAt(prismaClient, at("16:00"));

    assert.deepEqual(rows.find((row) => row.id === "earlier")?.warnings, []);
    assert.deepEqual(rows.find((row) => row.id === "same-start")?.warnings, []);
  });

  it("orders unfinished, room overlap, yield, then calculation error", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "front",
      startTime: "14:00",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "subject",
      startTime: "15:00",
      courseId: "course-missing-rate",
      status: "방문완료",
      paymentMethodCode: "현금",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "after",
      startTime: "15:30",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const subject = (await rowsAt(prismaClient, at("15:10"))).find((row) => row.id === "subject");

    assert.deepEqual(
      subject?.warnings.map((warning) => warning.code),
      ["previous_service_unfinished", "room_overlap", "yield_to_reservation", "calculation_error"]
    );
    assert.deepEqual(subject?.warnings[3], { code: "calculation_error", relatedTime: null, relatedCallIds: [] });
  });
});

describe("row warnings with an unreadable earlier start time", () => {
  it("ignores an in-use call whose start time is not a clock time", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "broken",
      startTime: "미정",
      courseId: "course-a",
      status: "사용중",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "later",
      startTime: "16:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const rows = await listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      prismaClient,
      now: new Date("2026-06-10T14:00:00.000Z")
    });

    assert.deepEqual(rows.find((row) => row.id === "later")?.warnings, []);
  });
});

describe("room overlap", () => {
  const therapist = (id: string) => [{ role: "THERAPIST_1" as const, employeeId: id }];

  async function rowsOf(prismaClient: ReturnType<typeof createMemoryPrisma>) {
    return listServiceCallsForDate({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      prismaClient,
      now: new Date("2026-06-10T00:00:00.000Z")
    });
  }

  function overlapOf(rows: Awaited<ReturnType<typeof rowsOf>>, id: string) {
    return rows.find((row) => row.id === id)?.warnings.find((warning) => warning.code === "room_overlap");
  }

  it("marks both calls with the other call's reservation time when 14:00–15:30 meets 15:00–16:00", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, { id: "first", startTime: "14:00", courseId: "course-d", status: "예약", assignments: therapist("therapist-1") });
    addAvailabilityCall(prismaClient, { id: "second", startTime: "15:00", courseId: "course-a", status: "방문완료", assignments: therapist("therapist-2") });

    const rows = await rowsOf(prismaClient);

    assert.deepEqual(overlapOf(rows, "first"), { code: "room_overlap", relatedTime: "15:00", relatedCallIds: ["second"] });
    assert.deepEqual(overlapOf(rows, "second"), { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["first"] });
  });

  it("does not overlap a call that ends at the minute another starts", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, { id: "first", startTime: "14:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-1") });
    addAvailabilityCall(prismaClient, { id: "second", startTime: "15:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-2") });

    const rows = await rowsOf(prismaClient);

    assert.equal(overlapOf(rows, "first"), undefined);
    assert.equal(overlapOf(rows, "second"), undefined);
  });

  it("names the earliest partner in the row and returns every partner id when three calls overlap", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, { id: "late", startTime: "15:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-3") });
    addAvailabilityCall(prismaClient, { id: "early", startTime: "14:00", courseId: "course-d", status: "예약", assignments: therapist("therapist-1") });
    addAvailabilityCall(prismaClient, { id: "middle", startTime: "14:30", courseId: "course-a", status: "예약", assignments: therapist("therapist-2") });

    const rows = await rowsOf(prismaClient);

    assert.deepEqual(overlapOf(rows, "late"), { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["early", "middle"] });
    assert.deepEqual(overlapOf(rows, "early"), { code: "room_overlap", relatedTime: "14:30", relatedCallIds: ["middle", "late"] });
    assert.deepEqual(overlapOf(rows, "middle"), { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["early", "late"] });
  });

  it("leaves out no-show, canceled, roomless, and other-room or other-day calls on both sides", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, { id: "subject", startTime: "14:00", courseId: "course-d", status: "예약", assignments: therapist("therapist-1") });
    addAvailabilityCall(prismaClient, { id: "no-show", startTime: "14:10", courseId: "course-a", status: "노쇼", assignments: therapist("therapist-2") });
    addAvailabilityCall(prismaClient, { id: "canceled", startTime: "14:20", courseId: "course-a", status: "취소", assignments: therapist("therapist-3") });
    addAvailabilityCall(prismaClient, { id: "roomless", startTime: "14:30", courseId: "course-a", status: "예약", roomId: null, assignments: therapist("therapist-4") });
    addAvailabilityCall(prismaClient, { id: "other-room", startTime: "14:40", courseId: "course-a", status: "예약", roomId: "room-102", assignments: therapist("therapist-5") });
    addAvailabilityCall(prismaClient, {
      id: "other-day",
      startTime: "14:50",
      courseId: "course-a",
      status: "예약",
      serviceDate: "2026-06-11",
      assignments: therapist("therapist-6")
    });

    const rows = await rowsOf(prismaClient);

    for (const id of ["subject", "no-show", "canceled", "roomless", "other-room"]) {
      assert.equal(overlapOf(rows, id), undefined, id);
    }
  });

  it("ignores the actual entry and the display end, and moves neither reservation time nor display end", async () => {
    const prismaClient = createMemoryPrisma();
    // 예약 구간은 14:00–15:00이다. 실제입장이 14:50이라 표시 종료는 15:50이지만 겹침에는 쓰지 않는다.
    addAvailabilityCall(prismaClient, {
      id: "late-guest",
      startTime: "14:00",
      actualEntryTime: "14:50",
      courseId: "course-a",
      status: "사용중",
      assignments: therapist("therapist-1")
    });
    addAvailabilityCall(prismaClient, { id: "next", startTime: "15:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-2") });
    const before = await rowsOf(prismaClient);

    assert.equal(overlapOf(before, "late-guest"), undefined);
    assert.equal(overlapOf(before, "next"), undefined);

    addAvailabilityCall(prismaClient, { id: "overlapping", startTime: "14:30", courseId: "course-a", status: "예약", assignments: therapist("therapist-3") });
    const after = await rowsOf(prismaClient);
    const lateGuest = (rows: typeof after) => rows.find((row) => row.id === "late-guest");

    assert.equal(lateGuest(after)?.startTime, lateGuest(before)?.startTime);
    assert.equal(lateGuest(after)?.displayEnd, lateGuest(before)?.displayEnd);
    assert.equal(after.find((row) => row.id === "next")?.startTime, "15:00");
    assert.equal(overlapOf(after, "late-guest")?.relatedTime, "14:30");
  });

  it("saves a row that overlaps another call in the same room and moves neither reservation time", async () => {
    const prismaClient = createMemoryPrisma();
    prismaClient.timeSlots.set("14:30", { id: "slot-1430", value: "14:30", sortOrder: 80, isActive: true, createdAt: new Date(), updatedAt: new Date() });
    addAvailabilityCall(prismaClient, { id: "existing", startTime: "14:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-2") });

    const saved = await saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      startTime: "14:30",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: null,
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });

    assert.equal(saved.startTime, "14:30");
    assert.deepEqual(saved.warnings.find((warning) => warning.code === "room_overlap"), {
      code: "room_overlap",
      relatedTime: "14:00",
      relatedCallIds: ["existing"]
    });
    assert.equal(prismaClient.serviceCalls.get("existing")?.startTime, "14:00");
  });

  it("returns the same result to consumers other than the ledger", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, { id: "early", startTime: "14:00", courseId: "course-d", status: "예약", assignments: therapist("therapist-1") });
    addAvailabilityCall(prismaClient, { id: "late", startTime: "15:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-2") });
    addAvailabilityCall(prismaClient, { id: "alone", startTime: "18:00", courseId: "course-a", status: "예약", assignments: therapist("therapist-3") });

    const { roomOverlaps: overlaps } = await roomFloorFactsForDate({ operatingMonthId: "month-2026-06", serviceDate: availabilityDate, prismaClient });
    const rows = await rowsOf(prismaClient);

    assert.deepEqual([...overlaps.keys()].sort(), ["early", "late"]);
    assert.deepEqual(overlaps.get("early"), { callId: "early", roomId: "room-101", relatedTime: "15:00", relatedCallIds: ["late"] });
    for (const [id, overlap] of overlaps) {
      const warning = overlapOf(rows, id);
      assert.deepEqual({ relatedTime: warning?.relatedTime, relatedCallIds: warning?.relatedCallIds }, {
        relatedTime: overlap.relatedTime,
        relatedCallIds: overlap.relatedCallIds
      });
    }
  });
});

describe("assigned service calls for day off impact (ticket 28)", () => {
  it("returns a call where the employee holds any assignment role, excluding no-show and canceled", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "as-therapist-1",
      startTime: "14:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "as-therapist-2",
      startTime: "15:00",
      courseId: "course-d",
      status: "사용중",
      assignments: [{ role: "THERAPIST_2", employeeId: "other-therapist" }, { role: "COORDINATOR", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "other-employee",
      startTime: "13:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "other-therapist" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "no-show",
      startTime: "16:00",
      courseId: "course-a",
      status: "노쇼",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "canceled",
      startTime: "17:00",
      courseId: "course-a",
      status: "취소",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const calls = await listAssignedServiceCallsForEmployeeOnDate({
      employeeId: "therapist-1",
      date: availabilityDate,
      prismaClient
    });

    assert.deepEqual(calls.map((call) => call.serviceCallId), ["as-therapist-1", "as-therapist-2"]);
    assert.deepEqual(calls[0], {
      serviceCallId: "as-therapist-1",
      operatingMonthId: "month-2026-06",
      serviceDate: availabilityDate,
      startTime: "14:00",
      courseCode: "A",
      status: "예약"
    });
    assert.equal(calls[1].courseCode, "D");
  });

  it("leaves out a call assigned on a different date", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "other-day",
      startTime: "14:00",
      courseId: "course-a",
      status: "예약",
      serviceDate: "2026-06-11",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const calls = await listAssignedServiceCallsForEmployeeOnDate({
      employeeId: "therapist-1",
      date: availabilityDate,
      prismaClient
    });

    assert.deepEqual(calls, []);
  });

  it("sorts by reservation time", async () => {
    const prismaClient = createMemoryPrisma();
    addAvailabilityCall(prismaClient, {
      id: "later",
      startTime: "18:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });
    addAvailabilityCall(prismaClient, {
      id: "earlier",
      startTime: "09:00",
      courseId: "course-a",
      status: "예약",
      assignments: [{ role: "THERAPIST_1", employeeId: "therapist-1" }]
    });

    const calls = await listAssignedServiceCallsForEmployeeOnDate({
      employeeId: "therapist-1",
      date: availabilityDate,
      prismaClient
    });

    assert.deepEqual(calls.map((call) => call.serviceCallId), ["earlier", "later"]);
  });

  it("rejects an empty employee id or an invalid date", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => listAssignedServiceCallsForEmployeeOnDate({ employeeId: "  ", date: availabilityDate, prismaClient }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_QUERY"
    );
    await assert.rejects(
      () => listAssignedServiceCallsForEmployeeOnDate({ employeeId: "therapist-1", date: "2026/06/10", prismaClient }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_QUERY"
    );
  });
});

describe("stale save rejection", () => {
  const staleMessage = "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.";

  function reservation(prismaClient: ReturnType<typeof createMemoryPrisma>) {
    return saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      prismaClient
    });
  }

  /** 화면이 마지막으로 받은 행(read)의 updatedAt을 붙여 그 행을 다시 저장한다. */
  function saveFrom(
    prismaClient: ReturnType<typeof createMemoryPrisma>,
    read: ServiceCallRowDto,
    changes: Partial<Parameters<typeof autosaveServiceCallRow>[0]>
  ) {
    return autosaveServiceCallRow({
      serviceCallId: read.id,
      operatingMonthId: read.operatingMonthId,
      serviceDate: read.serviceDate,
      startTime: read.startTime,
      actualEntryTime: read.actualEntryTime,
      roomId: read.roomId,
      courseId: read.courseId,
      customerMemo: read.customerMemo,
      customerId: read.customerId,
      therapist1Id: read.therapist1?.id ?? null,
      therapist2Id: read.therapist2?.id ?? null,
      status: read.status,
      discountTypeCode: read.discountTypeCode,
      paymentMethodCode: read.paymentMethodCode,
      note: read.note,
      confirmationCode: read.confirmationCode,
      expectedUpdatedAt: read.updatedAt,
      actorId: "counter-account",
      prismaClient,
      ...changes
    });
  }

  function isStale(error: unknown): error is ServiceCallDomainError & { currentRow: ServiceCallRowDto } {
    return error instanceof ServiceCallDomainError && error.code === "STALE_CALL";
  }

  it("lets one of two saves from the same updatedAt through and gives the other STALE_CALL, the current row, and no writes", async () => {
    const prismaClient = createMemoryPrisma();
    const read = await reservation(prismaClient);

    const results = await Promise.allSettled([
      saveFrom(prismaClient, read, { customerMemo: "카운터 A", status: "사용중", paymentMethodCode: "현금" }),
      saveFrom(prismaClient, read, { customerMemo: "카운터 B", status: "취소", therapist1Id: "therapist-2" })
    ]);

    const saved = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const rejected = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));
    assert.equal(saved.length, 1);
    assert.equal(rejected.length, 1);
    const [winner] = saved;
    const [error] = rejected;
    assert.ok(isStale(error));
    assert.equal(error.message, staleMessage);
    assert.deepEqual(error.currentRow, winner);

    const stored = prismaClient.serviceCalls.get(read.id);
    assert.equal(stored.customerMemo, winner.customerMemo);
    assert.equal(stored.status, winner.status);
    const activeTherapist1 = [...prismaClient.assignments.values()].filter(
      (assignment: any) => assignment.serviceCallId === read.id && assignment.assignmentRole === "THERAPIST_1" && assignment.isActive !== false
    );
    assert.deepEqual(activeTherapist1.map((assignment: any) => assignment.employeeId), [winner.therapist1?.id]);
    assert.deepEqual(
      prismaClient.statusHistories.map((history: any) => history.newStatus),
      [winner.status]
    );
    assert.equal(prismaClient.auditEvents.length > 0, true);
    for (const event of prismaClient.auditEvents) {
      assert.equal(event.afterValue.customerMemo, winner.customerMemo);
    }
  });

  it("rejects a later save from an older read, keeps the first save, and saves again from the updatedAt it returned", async () => {
    const prismaClient = createMemoryPrisma();
    const read = await reservation(prismaClient);
    const first = await saveFrom(prismaClient, read, { customerMemo: "먼저 저장", paymentMethodCode: "현금" });
    const auditCount = prismaClient.auditEvents.length;

    await assert.rejects(
      () => saveFrom(prismaClient, read, { customerMemo: "늦은 저장", status: "취소", paymentMethodCode: "카드" }),
      (error: unknown) => isStale(error) && error.currentRow.customerMemo === "먼저 저장" && error.currentRow.updatedAt === first.updatedAt
    );
    assert.equal(prismaClient.serviceCalls.get(read.id).customerMemo, "먼저 저장");
    assert.equal(prismaClient.serviceCalls.get(read.id).paymentMethodCode, "현금");
    assert.equal(prismaClient.statusHistories.length, 0);
    assert.equal(prismaClient.auditEvents.length, auditCount);

    const again = await saveFrom(prismaClient, first, { customerMemo: "다시 저장" });
    assert.equal(again.customerMemo, "다시 저장");
    assert.notEqual(again.updatedAt, first.updatedAt);
  });

  it("reads the row as saved now, so a screen reloading after a rejection gets the latest save and can save from it", async () => {
    const prismaClient = createMemoryPrisma();
    const read = await reservation(prismaClient);
    const first = await saveFrom(prismaClient, read, { customerMemo: "다른 화면 첫 저장" });
    const rejection = await saveFrom(prismaClient, read, { customerMemo: "늦은 화면" }).catch((error: unknown) => error);
    assert.ok(isStale(rejection));
    const second = await saveFrom(prismaClient, first, { customerMemo: "다른 화면 두 번째 저장", paymentMethodCode: "카드" });

    const latest = await getServiceCallRow({ serviceCallId: read.id, prismaClient });

    assert.deepEqual(latest, second);
    assert.notEqual(rejection.currentRow.updatedAt, latest.updatedAt);
    const saved = await saveFrom(prismaClient, latest, { customerMemo: "늦은 화면 다시 저장" });
    assert.equal(saved.customerMemo, "늦은 화면 다시 저장");
    assert.equal(saved.paymentMethodCode, "카드");
  });

  it("rejects an existing-row save that does not say which updatedAt it read, on both save paths", async () => {
    const prismaClient = createMemoryPrisma();
    const read = await reservation(prismaClient);

    await assert.rejects(
      () => saveFrom(prismaClient, read, { customerMemo: "버전 없음", expectedUpdatedAt: undefined }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_INPUT"
    );
    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          serviceCallId: read.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "버전 없음",
          status: "예약",
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_INPUT"
    );

    assert.equal(prismaClient.serviceCalls.get(read.id).customerMemo, null);
    assert.equal(prismaClient.serviceCalls.get(read.id).updatedAt.toISOString(), read.updatedAt);
  });

  it("gives a stale saveBasic of an existing row the same STALE_CALL and keeps the newer save", async () => {
    const prismaClient = createMemoryPrisma();
    const read = await reservation(prismaClient);
    const first = await saveFrom(prismaClient, read, { customerMemo: "원장에서 저장" });

    await assert.rejects(
      () =>
        saveBasicServiceCallRow({
          serviceCallId: read.id,
          operatingMonthId: "month-2026-06",
          serviceDate: "2026-06-10",
          startTime: "11:00",
          roomId: "room-101",
          courseId: "course-a",
          customerMemo: "오래된 화면",
          status: "예약",
          expectedUpdatedAt: read.updatedAt,
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => isStale(error) && error.currentRow.updatedAt === first.updatedAt
    );
    assert.equal(prismaClient.serviceCalls.get(read.id).customerMemo, "원장에서 저장");
  });
});

describe("new row request id", () => {
  /** 원장의 새 행 초안 하나. 화면은 초안마다 요청 id를 하나 만들고, 다시 보낼 때도 같은 id를 쓴다. */
  function newRow(prismaClient: ReturnType<typeof createMemoryPrisma>, requestId: string, changes: Partial<Parameters<typeof createServiceCallRow>[0]> = {}) {
    return createServiceCallRow({
      requestId,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "새 손님",
      therapist1Id: "therapist-1",
      status: "예약",
      actorId: "counter-account",
      prismaClient,
      ...changes
    });
  }

  function callsOnDate(prismaClient: ReturnType<typeof createMemoryPrisma>) {
    return listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient });
  }

  it("returns the call already made from the same request id instead of making a second one, and audits only the first", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", actorId: "counter-account", prismaClient });
    const auditsBefore = prismaClient.auditEvents.length;

    const first = await newRow(prismaClient, "request-1", { customerId: customer.id });
    const auditsAfterFirst = prismaClient.auditEvents.length;
    const again = await newRow(prismaClient, "request-1", { customerId: customer.id });

    assert.equal(first.alreadySaved, false);
    assert.equal(again.alreadySaved, true);
    assert.deepEqual(again.row, first.row);
    assert.deepEqual((await callsOnDate(prismaClient)).map((row) => row.id), [first.row.id]);
    // 고객을 붙여 만든 콜은 생성 때 감사 기록이 하나 남는다. 다시 보낸 요청은 아무것도 쓰지 않는다.
    assert.equal(auditsAfterFirst - auditsBefore, 1);
    assert.equal(prismaClient.auditEvents.length, auditsAfterFirst);
  });

  it("gives both of two simultaneous creations with the same request id the one call made, with one creation audit", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", actorId: "counter-account", prismaClient });
    const auditsBefore = prismaClient.auditEvents.length;

    // 둘 다 아직 콜이 없다고 읽은 뒤 만들러 간다. 늦은 쪽은 요청 id의 유일성 위반으로 실패하고, 먼저 만든 콜을 받는다.
    const results = await Promise.all([
      newRow(prismaClient, "request-1", { customerId: customer.id }),
      newRow(prismaClient, "request-1", { customerId: customer.id })
    ]);

    assert.deepEqual(results.map((result) => result.alreadySaved).sort(), [false, true]);
    assert.deepEqual(results[0].row, results[1].row);
    assert.deepEqual((await callsOnDate(prismaClient)).map((row) => row.id), [results[0].row.id]);
    assert.equal(prismaClient.auditEvents.length - auditsBefore, 1);
  });
});

describe("quick booking: new customer saved with the call (F01, 스토리 57·68, 티켓 24)", () => {
  function newRowWithNewCustomer(
    prismaClient: ReturnType<typeof createMemoryPrisma>,
    requestId: string,
    changes: Partial<Parameters<typeof createServiceCallRow>[0]> = {}
  ) {
    return createServiceCallRow({
      requestId,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      therapist1Id: "therapist-1",
      status: "예약",
      actorId: "counter-account",
      newCustomer: { name: "새손님", phone: "0909999999", preferenceNote: "조용한 방 선호" },
      prismaClient,
      ...changes
    });
  }

  it("creates the new customer and the call in the same write, with name/phone/preference note and no memo", async () => {
    const prismaClient = createMemoryPrisma();

    const result = await newRowWithNewCustomer(prismaClient, "request-new-1");

    assert.equal(result.alreadySaved, false);
    assert.ok(result.row.customerId);
    const customers = await listCustomers({ prismaClient });
    assert.equal(customers.length, 1);
    assert.deepEqual(customers[0], {
      id: result.row.customerId,
      name: "새손님",
      phone: "0909999999",
      memo: null,
      preferenceNote: "조용한 방 선호"
    });
    assert.deepEqual(
      prismaClient.auditEvents.map((event: { action: string }) => event.action),
      ["customer.created", "service_call.row_changed"]
    );
  });

  it("retrying the same request id returns the same call and customer instead of making a second customer", async () => {
    const prismaClient = createMemoryPrisma();

    const first = await newRowWithNewCustomer(prismaClient, "request-new-2");
    const auditsAfterFirst = prismaClient.auditEvents.length;
    const again = await newRowWithNewCustomer(prismaClient, "request-new-2");

    assert.equal(first.alreadySaved, false);
    assert.equal(again.alreadySaved, true);
    assert.deepEqual(again.row, first.row);
    const customers = await listCustomers({ prismaClient });
    assert.equal(customers.length, 1);
    assert.equal(customers[0].id, first.row.customerId);
    assert.equal(prismaClient.auditEvents.length, auditsAfterFirst);
  });

  it("rejects specifying both an existing customer id and a new customer", async () => {
    const prismaClient = createMemoryPrisma();
    const existing = await createCustomer({ name: "민아", actorId: "counter-account", prismaClient });

    await assert.rejects(
      () => newRowWithNewCustomer(prismaClient, "request-new-3", { customerId: existing.id }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "INVALID_SERVICE_CALL_INPUT"
    );
    assert.equal((await listCustomers({ prismaClient })).length, 1);
  });
});

describe("quick booking: two-therapist courses and the override path (F01, 티켓 21)", () => {
  /** 빠른 예약의 새 콜 초안 하나. 두 명 코스(course-d)를 기본값으로 쓴다. */
  function quickBookingDraft(
    prismaClient: ReturnType<typeof createMemoryPrisma>,
    requestId: string,
    changes: Partial<Parameters<typeof createQuickBookingServiceCall>[0]> = {}
  ) {
    return createQuickBookingServiceCall({
      requestId,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: null,
      courseId: "course-d",
      customerMemo: "빠른 예약",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-2",
      status: "예약",
      actorId: "counter-account",
      prismaClient,
      ...changes
    });
  }

  it("두 명 코스에서 같은 사람을 Therapist 1·2로 고르면 저장 오류다", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => quickBookingDraft(prismaClient, "request-dup", { therapist2Id: "therapist-1" }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "D_QUICK_BOOKING_DUPLICATE_THERAPIST"
    );
    assert.deepEqual(await listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient }), []);
  });

  it("두 명 코스에서 필수인 두 번째 Therapist가 비어 있으면 저장 오류다(원장 저장과 같은 검사)", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => quickBookingDraft(prismaClient, "request-missing-second", { therapist2Id: null }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED"
    );
  });

  it("서로 다른 두 명을 고르면 저장되고, 같은 요청 id를 다시 보내면 이미 만든 콜을 돌려준다", async () => {
    const prismaClient = createMemoryPrisma();
    const first = await quickBookingDraft(prismaClient, "request-ok");
    assert.equal(first.alreadySaved, false);
    assert.equal(first.row.therapist1?.id, "therapist-1");
    assert.equal(first.row.therapist2?.id, "therapist-2");

    const again = await quickBookingDraft(prismaClient, "request-ok");
    assert.equal(again.alreadySaved, true);
    assert.deepEqual(again.row, first.row);
  });

  it("시간이 겹치거나 수당이 없는 배정도 경고일 뿐 저장을 막지 않는다", async () => {
    const prismaClient = createMemoryPrisma();
    // course-a(60분)는 수당이 있지만 1인 코스다. therapist-2는 course-a 수당이 0원으로 있다(유효 수당).
    // 겹침 자체는 가능 코스 판정(listTherapistAvailability)의 몫이고, 저장 경로는 겹쳐도 그대로 쓴다.
    const overlapping = await createQuickBookingServiceCall({
      requestId: "request-overlap-1",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: null,
      courseId: "course-a",
      customerMemo: "첫 배정",
      therapist1Id: "therapist-2",
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });
    const sameSlotSameTherapist = await createQuickBookingServiceCall({
      requestId: "request-overlap-2",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: null,
      courseId: "course-a",
      customerMemo: "겹치는 배정(경고 확인 후 배정)",
      therapist1Id: "therapist-2",
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });
    assert.equal(overlapping.alreadySaved, false);
    assert.equal(sameSlotSameTherapist.alreadySaved, false);
    assert.notEqual(overlapping.row.id, sameSlotSameTherapist.row.id);
  });

  it("원장 직접 입력(createServiceCallRow)은 같은 사람을 Therapist 1·2로 두 번 골라도 저장 오류를 내지 않는다(소급하지 않음)", async () => {
    const prismaClient = createMemoryPrisma();
    const row = await createServiceCallRow({
      requestId: "request-direct-input",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: null,
      courseId: "course-a",
      customerMemo: "원장 직접 입력",
      therapist1Id: "therapist-1",
      therapist2Id: "therapist-1",
      status: "예약",
      actorId: "counter-account",
      prismaClient
    });
    assert.equal(row.alreadySaved, false);
    assert.equal(row.row.therapist1?.id, "therapist-1");
    assert.equal(row.row.therapist2?.id, "therapist-1");
  });
});

describe("quick booking party (스펙 D10–D13, 티켓 02)", () => {
  function addTherapist(prismaClient: ReturnType<typeof createMemoryPrisma>, id: string, displayName: string) {
    const template = prismaClient.employees.get("therapist-1");
    prismaClient.employees.set(id, { ...template, id, displayName, staffCode: id.toUpperCase(), sortOrder: 3 });
  }

  /** 3인 일행 하나. 손님 1은 A코스·101호실, 손님 2는 A코스 객실 없음, 손님 3은 D코스(두 명) — 같은 시각과 메모를 쓴다. */
  function party(
    prismaClient: ReturnType<typeof createMemoryPrisma>,
    requestId: string,
    changes: Partial<Parameters<typeof createQuickBookingParty>[0]> = {}
  ) {
    return createQuickBookingParty({
      requestId,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      customerMemo: "정 대표 일행",
      status: "예약",
      guests: [
        { courseId: "course-a", therapist1Id: "therapist-1", therapist2Id: null, roomId: "room-101" },
        { courseId: "course-a", therapist1Id: "therapist-2", therapist2Id: null, roomId: null },
        { courseId: "course-d", therapist1Id: "therapist-3", therapist2Id: "therapist-4", roomId: null }
      ],
      actorId: "counter-account",
      prismaClient,
      ...changes
    });
  }

  function partyClient() {
    const prismaClient = createMemoryPrisma();
    addTherapist(prismaClient, "therapist-3", "마사지사3");
    addTherapist(prismaClient, "therapist-4", "마사지사4");
    return prismaClient;
  }

  function callsOnDate(prismaClient: ReturnType<typeof createMemoryPrisma>) {
    return listServiceCallsForDate({ operatingMonthId: "month-2026-06", serviceDate: "2026-06-10", prismaClient });
  }

  it("makes one call per guest at the shared time and memo, each with the guest's own course, therapist and room", async () => {
    const prismaClient = partyClient();

    const result = await party(prismaClient, "party-1");

    assert.equal(result.alreadySaved, false);
    assert.deepEqual(
      result.rows.map((row) => [row.startTime, row.customerMemo, row.courseId, row.therapist1?.id, row.therapist2?.id ?? null, row.roomId]),
      [
        ["11:00", "정 대표 일행", "course-a", "therapist-1", null, "room-101"],
        ["11:00", "정 대표 일행", "course-a", "therapist-2", null, null],
        ["11:00", "정 대표 일행", "course-d", "therapist-3", "therapist-4", null]
      ]
    );
    assert.equal((await callsOnDate(prismaClient)).length, 3);
  });

  it("links the customer to the first call only and audits each call's creation with the party id and position", async () => {
    const prismaClient = partyClient();
    const customer = await createCustomer({ name: "정 대표", actorId: "counter-account", prismaClient });
    const auditsBefore = prismaClient.auditEvents.length;

    const result = await party(prismaClient, "party-2", { customerId: customer.id });

    assert.deepEqual(result.rows.map((row) => row.customerId), [customer.id, null, null]);
    const created = prismaClient.auditEvents.slice(auditsBefore);
    assert.deepEqual(
      created.map((event: any) => [event.action, event.targetId, event.beforeValue, event.afterValue.partyId, event.afterValue.partyPosition]),
      result.rows.map((row, index) => ["service_call.row_changed", row.id, null, result.partyId, index + 1])
    );
    assert.ok(result.partyId);
  });

  it("creates a new customer once for the party and links it to the first call", async () => {
    const prismaClient = partyClient();

    const result = await party(prismaClient, "party-3", { customerMemo: null, newCustomer: { name: "새 대표", phone: "0901112222" } });

    const customers = await listCustomers({ prismaClient });
    assert.deepEqual(customers.map((customer) => customer.name), ["새 대표"]);
    assert.deepEqual(result.rows.map((row) => row.customerId), [customers[0].id, null, null]);
  });

  it("makes nothing — no call, no new customer — when one guest fails, and names that guest and field", async () => {
    const prismaClient = partyClient();

    await assert.rejects(
      () =>
        party(prismaClient, "party-4", {
          newCustomer: { name: "새 대표" },
          guests: [
            { courseId: "course-a", therapist1Id: "therapist-1", therapist2Id: null, roomId: null },
            { courseId: "course-a", therapist1Id: "therapist-2", therapist2Id: null, roomId: null },
            { courseId: "course-d", therapist1Id: "therapist-3", therapist2Id: null, roomId: null }
          ]
        }),
      (error: unknown) =>
        error instanceof QuickBookingGuestError &&
        error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED" &&
        error.guestPosition === 3 &&
        error.field === "therapist2Id"
    );
    assert.deepEqual(await callsOnDate(prismaClient), []);
    assert.deepEqual(await listCustomers({ prismaClient }), []);
  });

  it("rejects the same therapist for two guests, on the later guest's field", async () => {
    const prismaClient = partyClient();

    await assert.rejects(
      () =>
        party(prismaClient, "party-5", {
          guests: [
            { courseId: "course-d", therapist1Id: "therapist-1", therapist2Id: "therapist-2", roomId: null },
            { courseId: "course-a", therapist1Id: "therapist-2", therapist2Id: null, roomId: null }
          ]
        }),
      (error: unknown) =>
        error instanceof QuickBookingGuestError &&
        error.code === "D_QUICK_BOOKING_PARTY_DUPLICATE_THERAPIST" &&
        error.guestPosition === 2 &&
        error.field === "therapist1Id"
    );
    assert.deepEqual(await callsOnDate(prismaClient), []);
  });

  it("keeps a guest's own Therapist 1·2 duplicate as a quick booking error on that guest", async () => {
    const prismaClient = partyClient();

    await assert.rejects(
      () =>
        party(prismaClient, "party-6", {
          guests: [
            { courseId: "course-a", therapist1Id: "therapist-1", therapist2Id: null, roomId: null },
            { courseId: "course-d", therapist1Id: "therapist-2", therapist2Id: "therapist-2", roomId: null }
          ]
        }),
      (error: unknown) =>
        error instanceof QuickBookingGuestError && error.code === "D_QUICK_BOOKING_DUPLICATE_THERAPIST" && error.guestPosition === 2
    );
  });

  it("does not pin a shared problem (an inactive time slot) on any one guest", async () => {
    const prismaClient = partyClient();

    await assert.rejects(
      () => party(prismaClient, "party-7", { startTime: "04:00" }),
      (error: unknown) => error instanceof ServiceCallDomainError && !(error instanceof QuickBookingGuestError) && error.code === "TIME_SLOT_NOT_ACTIVE"
    );
    assert.deepEqual(await callsOnDate(prismaClient), []);
  });

  it("is blocked by a locked operating month the same as a single booking, before any guest is looked at", async () => {
    const prismaClient = partyClient();

    await assert.rejects(
      () => party(prismaClient, "party-locked", { operatingMonthId: "month-locked", serviceDate: "2026-07-10" }),
      (error: unknown) => error instanceof ServiceCallDomainError && !(error instanceof QuickBookingGuestError) && error.code === "OPERATING_MONTH_LOCKED"
    );
  });

  it("returns the party already made from the same request id, writing nothing more", async () => {
    const prismaClient = partyClient();
    await party(prismaClient, "party-8-other", { startTime: "01:00" });

    const first = await party(prismaClient, "party-8");
    const auditsAfterFirst = prismaClient.auditEvents.length;
    const again = await party(prismaClient, "party-8");

    assert.equal(again.alreadySaved, true);
    assert.equal(again.partyId, first.partyId);
    assert.deepEqual(again.rows, first.rows);
    assert.deepEqual(again.rows.map((row) => row.startTime), ["11:00", "11:00", "11:00"]);
    assert.equal((await callsOnDate(prismaClient)).length, 6);
    assert.equal(prismaClient.auditEvents.length, auditsAfterFirst);
  });

  it("shows each call's party id and position on the ledger rows, and none on a call outside a party", async () => {
    const prismaClient = partyClient();
    await createQuickBookingServiceCall({
      requestId: "solo-1",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "01:00",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });

    const { partyId } = await party(prismaClient, "party-rows");

    const rows = await callsOnDate(prismaClient);
    assert.deepEqual(
      rows.map((row) => [row.startTime, row.partyId, row.partyPosition]),
      [
        ["11:00", partyId, 1],
        ["11:00", partyId, 2],
        ["11:00", partyId, 3],
        ["01:00", null, null]
      ]
    );
  });

  it("adds one more guest to an existing party at the next position, without a customer link, auditing the party", async () => {
    const prismaClient = partyClient();
    const customer = await createCustomer({ name: "정 대표", actorId: "counter-account", prismaClient });
    const { partyId } = await party(prismaClient, "party-join-base", { customerId: customer.id });
    const auditsBefore = prismaClient.auditEvents.length;

    const joined = await createQuickBookingServiceCall({
      requestId: "party-join-1",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      customerMemo: "정 대표 일행",
      courseId: "course-a",
      therapist1Id: "therapist-4",
      status: "예약",
      partyId,
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(joined.alreadySaved, false);
    assert.deepEqual([joined.row.partyId, joined.row.partyPosition, joined.row.customerId], [partyId, 4, null]);
    const created = prismaClient.auditEvents.slice(auditsBefore);
    assert.deepEqual(
      created.map((event: any) => [event.targetId, event.afterValue.partyId, event.afterValue.partyPosition]),
      [[joined.row.id, partyId, 4]]
    );

    const again = await createQuickBookingServiceCall({
      requestId: "party-join-1",
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      courseId: "course-a",
      status: "예약",
      partyId,
      actorId: "counter-account",
      prismaClient
    });
    assert.equal(again.alreadySaved, true);
    assert.equal(again.row.id, joined.row.id);
    assert.deepEqual(
      (await callsOnDate(prismaClient)).map((row) => row.partyPosition),
      [1, 2, 3, 4]
    );
  });

  it("refuses to add a guest to a party that is not on that day, or with a customer link", async () => {
    const prismaClient = partyClient();
    const customer = await createCustomer({ name: "정 대표", actorId: "counter-account", prismaClient });
    const { partyId } = await party(prismaClient, "party-join-refused");
    const join = (changes: Partial<Parameters<typeof createQuickBookingServiceCall>[0]>) =>
      createQuickBookingServiceCall({
        requestId: `party-join-${Object.keys(changes).join("-")}`,
        operatingMonthId: "month-2026-06",
        serviceDate: "2026-06-10",
        startTime: "11:00",
        courseId: "course-a",
        status: "예약",
        partyId,
        actorId: "counter-account",
        prismaClient,
        ...changes
      });

    await assert.rejects(
      () => join({ partyId: "no-such-party" }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_PARTY_NOT_FOUND"
    );
    await assert.rejects(
      () => join({ serviceDate: "2026-06-11" }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_PARTY_NOT_FOUND"
    );
    await assert.rejects(
      () => join({ customerId: customer.id }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_PARTY_CUSTOMER_LINK"
    );
    await assert.rejects(
      () => join({ newCustomer: { name: "새 손님" } }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_PARTY_CUSTOMER_LINK"
    );
    assert.equal((await callsOnDate(prismaClient)).length, 3);
    assert.deepEqual((await listCustomers({ prismaClient })).map((row) => row.name), ["정 대표"]);
  });

  it("allows two guests in the same room; the overlap stays a ledger warning", async () => {
    const prismaClient = partyClient();

    const result = await party(prismaClient, "party-9", {
      guests: [
        { courseId: "course-a", therapist1Id: "therapist-1", therapist2Id: null, roomId: "room-101" },
        { courseId: "course-a", therapist1Id: "therapist-2", therapist2Id: null, roomId: "room-101" }
      ]
    });

    assert.deepEqual(
      result.rows.map((row) => row.warnings.some((warning) => warning.code === "room_overlap")),
      [true, true]
    );
  });
});

describe("customer link correction", () => {
  function reservedCall(prismaClient: ReturnType<typeof createMemoryPrisma>, overrides: Partial<Parameters<typeof saveBasicServiceCallRow>[0]> = {}) {
    return saveBasicServiceCallRow({
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "원장 표기",
      status: "예약",
      prismaClient,
      ...overrides
    });
  }

  it("rejects without a reason and writes nothing", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const call = await reservedCall(prismaClient);
    const auditCountBefore = prismaClient.auditEvents.length;

    await assert.rejects(
      () =>
        correctServiceCallCustomerLink({
          serviceCallId: call.id,
          customerId: customer.id,
          reason: "   ",
          expectedUpdatedAt: call.updatedAt,
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "SERVICE_CALL_CUSTOMER_LINK_REASON_REQUIRED"
    );
    assert.equal(prismaClient.serviceCalls.get(call.id).customerId, null);
    assert.equal(prismaClient.auditEvents.length, auditCountBefore);
  });

  it("corrects the link, records previous customer, new customer, reason and actor in the audit log, and leaves the call memo untouched", async () => {
    const prismaClient = createMemoryPrisma();
    const wrong = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const right = await createCustomer({ name: "수진", phone: "090222", memo: null, actorId: "counter-account", prismaClient });
    const call = await reservedCall(prismaClient, { customerId: wrong.id, actorId: "counter-account" });
    const auditCountBefore = prismaClient.auditEvents.length;

    const corrected = await correctServiceCallCustomerLink({
      serviceCallId: call.id,
      customerId: right.id,
      reason: "다른 손님 전화번호로 잘못 연결됨",
      expectedUpdatedAt: call.updatedAt,
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(corrected.customerId, right.id);
    assert.equal(corrected.customerMemo, "원장 표기");
    assert.notEqual(corrected.updatedAt, call.updatedAt);

    assert.equal(prismaClient.auditEvents.length, auditCountBefore + 1);
    const event = prismaClient.auditEvents.at(-1);
    assert.equal(event.action, "service_call.customer_link_corrected");
    assert.equal(event.targetType, "service_call");
    assert.equal(event.targetId, call.id);
    assert.equal(event.actorId, "counter-account");
    assert.equal(event.reason, "다른 손님 전화번호로 잘못 연결됨");
    assert.equal(event.beforeValue.customerId, wrong.id);
    assert.equal(event.afterValue.customerId, right.id);
    assert.equal(prismaClient.serviceCalls.get(call.id).customerMemo, "원장 표기");
  });

  it("unlinks the customer when given null and still records the correction", async () => {
    const prismaClient = createMemoryPrisma();
    const linked = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const call = await reservedCall(prismaClient, { customerId: linked.id, actorId: "counter-account" });

    const corrected = await correctServiceCallCustomerLink({
      serviceCallId: call.id,
      customerId: null,
      reason: "다른 손님과 혼동됨",
      expectedUpdatedAt: call.updatedAt,
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(corrected.customerId, null);
    assert.equal(corrected.customerMemo, "원장 표기");
    const event = prismaClient.auditEvents.at(-1);
    assert.equal(event.beforeValue.customerId, linked.id);
    assert.equal(event.afterValue.customerId, null);
  });

  it("rejects a call in a locked operating month, even with a reason and the right version, and does not write or audit", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const lockedCall = await prismaClient.serviceCall.create({
      data: {
        operatingMonthId: "month-locked",
        serviceDate: dbDate("2026-07-05"),
        startTime: "11:00",
        roomId: "room-101",
        courseId: "course-a",
        customerId: null,
        customerMemo: "잠긴 달 콜",
        status: "예약",
        discountTypeCode: null,
        paymentMethodCode: null,
        note: null,
        confirmationCode: null
      }
    });
    const auditCountBefore = prismaClient.auditEvents.length;

    await assert.rejects(
      () =>
        correctServiceCallCustomerLink({
          serviceCallId: lockedCall.id,
          customerId: customer.id,
          reason: "정정 사유",
          expectedUpdatedAt: lockedCall.updatedAt.toISOString(),
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "OPERATING_MONTH_LOCKED"
    );
    assert.equal(prismaClient.serviceCalls.get(lockedCall.id).customerId, null);
    assert.equal(prismaClient.auditEvents.length, auditCountBefore);
  });

  it("allows the correction once an administrator reopens the operating month", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const reopenedCall = await saveBasicServiceCallRow({
      operatingMonthId: "month-reopened",
      serviceDate: "2026-09-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      status: "예약",
      prismaClient
    });

    const corrected = await correctServiceCallCustomerLink({
      serviceCallId: reopenedCall.id,
      customerId: customer.id,
      reason: "재오픈 후 정정",
      expectedUpdatedAt: reopenedCall.updatedAt,
      actorId: "counter-account",
      prismaClient
    });

    assert.equal(corrected.customerId, customer.id);
  });

  it("gives STALE_CALL with the current row and no write or audit when another screen saved the call first", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const call = await reservedCall(prismaClient);
    const laterSave = await saveBasicServiceCallRow({
      serviceCallId: call.id,
      expectedUpdatedAt: call.updatedAt,
      operatingMonthId: "month-2026-06",
      serviceDate: "2026-06-10",
      startTime: "11:00",
      roomId: "room-101",
      courseId: "course-a",
      customerMemo: "다른 화면이 먼저 저장",
      status: "예약",
      prismaClient
    });
    const auditCountBefore = prismaClient.auditEvents.length;

    await assert.rejects(
      () =>
        correctServiceCallCustomerLink({
          serviceCallId: call.id,
          customerId: customer.id,
          reason: "오래된 화면에서 정정",
          expectedUpdatedAt: call.updatedAt,
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) =>
        error instanceof ServiceCallDomainError &&
        error.code === "STALE_CALL" &&
        (error as unknown as { currentRow: ServiceCallRowDto }).currentRow.updatedAt === laterSave.updatedAt
    );
    assert.equal(prismaClient.serviceCalls.get(call.id).customerId, null);
    assert.equal(prismaClient.serviceCalls.get(call.id).customerMemo, "다른 화면이 먼저 저장");
    assert.equal(prismaClient.auditEvents.length, auditCountBefore);
  });

  it("rejects without an actor and keeps the link unchanged", async () => {
    const prismaClient = createMemoryPrisma();
    const customer = await createCustomer({ name: "민아", phone: "090111", memo: null, actorId: "counter-account", prismaClient });
    const call = await reservedCall(prismaClient);

    await assert.rejects(
      () =>
        correctServiceCallCustomerLink({
          serviceCallId: call.id,
          customerId: customer.id,
          reason: "사유",
          expectedUpdatedAt: call.updatedAt,
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "ACTOR_REQUIRED"
    );
    assert.equal(prismaClient.serviceCalls.get(call.id).customerId, null);
  });

  it("rejects a customer id that does not exist", async () => {
    const prismaClient = createMemoryPrisma();
    const call = await reservedCall(prismaClient);

    await assert.rejects(
      () =>
        correctServiceCallCustomerLink({
          serviceCallId: call.id,
          customerId: "missing-customer",
          reason: "사유",
          expectedUpdatedAt: call.updatedAt,
          actorId: "counter-account",
          prismaClient
        }),
      (error: unknown) => error instanceof ServiceCallDomainError && error.code === "CUSTOMER_NOT_FOUND"
    );
  });
});
