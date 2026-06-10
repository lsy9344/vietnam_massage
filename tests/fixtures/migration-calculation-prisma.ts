import { MIGRATION_CALCULATION_FIXTURE } from "./migration-calculation-comparison";

type Fixture = typeof MIGRATION_CALCULATION_FIXTURE;

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function sameDate(left: Date, right: Date) {
  // Story 7.2: normalize all fixture date comparisons to ISO YYYY-MM-DD.
  return left.toISOString().slice(0, 10) === right.toISOString().slice(0, 10);
}

function failWrite(method: string): never {
  throw new Error(`Story 7.2 migration calculation fixture is read-only; unexpected write: ${method}`);
}

function matchesIn<T>(value: T, filter: T | { in?: T[] } | undefined) {
  if (filter === undefined) return true;
  if (typeof filter === "object" && filter !== null && "in" in filter) return filter.in?.includes(value) ?? false;
  return value === filter;
}

export function createMigrationCalculationPrisma(options: { zeroEarcareWorkersDate?: string; monthlyOpsCredit?: number } = {}) {
  const fixture = MIGRATION_CALCULATION_FIXTURE as Fixture;
  const createdAt = new Date("2034-06-01T00:00:00.000Z");
  const updatedAt = new Date("2034-06-15T03:00:00.000Z");
  const writeOperations: string[] = [];
  const operatingMonth = {
    ...fixture.operatingMonth,
    startDate: dbDate(fixture.operatingMonth.startDate),
    endDate: dbDate(fixture.operatingMonth.endDate),
    createdAt,
    updatedAt
  };
  const rooms = new Map(fixture.rooms.map((room) => [room.id, { ...room, isActive: true, createdAt, updatedAt }]));
  const courses = new Map(fixture.courses.map((course) => [course.id, { id: course.id, code: course.code, isActive: true, createdAt, updatedAt }]));
  const coursePolicies = fixture.coursePolicies.map((policy) => ({
    ...policy,
    effectiveFromMonth: "2034-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt
  }));
  const employees = new Map(
    fixture.employees.map((employee) => [
      employee.id,
      {
        ...employee,
        shiftType: "전체",
        baseSalary: 0,
        phone: null,
        birthday: null,
        hireDate: null,
        employmentStatus: "재직",
        isActive: true,
        createdAt,
        updatedAt
      }
    ])
  );
  const statusCodes = [
    ["RESERVED", "예약"],
    ["IN_USE", "사용중"],
    ["CLEANING", "청소중"],
    ["VISIT_COMPLETE", "방문완료"],
    ["NO_SHOW", "노쇼"],
    ["CANCELED", "취소"],
    ["NORMAL", "정상"],
    ["DAY_OFF", "휴무"],
    ["LATE", "지각"],
    ["EARLY_LEAVE", "조퇴"],
    ["ABSENT", "결근"]
  ] as const;
  const codeItems = [
    ...statusCodes.flatMap(([code, displayName], index) => [code, displayName].map((codeValue) => ({
      id: `code-${code}`,
      codeType: ["NORMAL", "DAY_OFF", "LATE", "EARLY_LEAVE", "ABSENT"].includes(code) ? "ATTENDANCE_STATUS" : "SERVICE_STATUS",
      code: codeValue,
      displayName,
      sortOrder: (index + 1) * 10,
      isActive: true,
      createdAt,
      updatedAt
    }))),
    { id: "discount-weekly", codeType: "DISCOUNT_TYPE", code: "WEEKLY_VISIT", displayName: "일주일내방문", sortOrder: 10, isActive: true, createdAt, updatedAt },
    { id: "pay-cash", codeType: "PAYMENT_METHOD", code: "CASH", displayName: "현금", sortOrder: 10, isActive: true, createdAt, updatedAt },
    { id: "pay-card", codeType: "PAYMENT_METHOD", code: "CARD", displayName: "카드", sortOrder: 20, isActive: true, createdAt, updatedAt },
    { id: "confirm-y", codeType: "CONFIRMATION", code: "Y", displayName: "Y", sortOrder: 10, isActive: true, createdAt, updatedAt }
  ];
  const timeSlots = fixture.timeSlots.map((value, index) => ({ id: `slot-${value}`, value, sortOrder: (index + 1) * 10, isActive: true, createdAt, updatedAt }));
  const serviceCalls = new Map(
    fixture.serviceCalls.map((call) => [
      call.id,
      {
        ...call,
        operatingMonthId: operatingMonth.id,
        serviceDate: dbDate(call.serviceDate),
        customerMemo: call.id,
        note: null,
        confirmationCode: null,
        createdAt,
        updatedAt: call.id === "call-reserved" ? new Date("2034-06-15T04:00:00.000Z") : updatedAt
      }
    ])
  );
  const assignments = fixture.assignments.map((assignment, index) => ({
    id: `${assignment.serviceCallId}-${assignment.assignmentRole}`,
    ...assignment,
    isActive: true,
    createdAt: new Date(`2034-06-01T00:${String(index).padStart(2, "0")}:00.000Z`),
    updatedAt
  }));
  const therapistRates = fixture.therapistCourseRates.map((rate) => ({
    ...rate,
    effectiveFromMonth: "2034-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt
  }));
  const dailyExpenses = fixture.expenses.map((expense) => ({
    ...expense,
    operatingMonthId: operatingMonth.id,
    expenseDate: dbDate(expense.expenseDate),
    note: null,
    isActive: true,
    handledByEmployee: employees.get(expense.handledByEmployeeId),
    createdAt,
    updatedAt
  }));
  const opsAttendances = fixture.attendance.operations.map((attendance, index) => ({
    id: `ops-attendance-${index}`,
    operatingMonthId: operatingMonth.id,
    attendanceDate: dbDate(attendance.attendanceDate),
    employeeId: attendance.employeeId,
    statusCode: attendance.statusCode,
    isActive: true,
    createdAt,
    updatedAt
  }));
  const earcareAttendances = fixture.attendance.earcare.map((attendance, index) => ({
    id: `earcare-attendance-${index}`,
    operatingMonthId: operatingMonth.id,
    attendanceDate: dbDate(attendance.attendanceDate),
    employeeId: attendance.employeeId,
    statusCode: attendance.statusCode,
    isActive: true,
    createdAt,
    updatedAt
  }));
  const opsDailyRules = fixture.incentiveRules.opsDaily.map((rule) => ({
    ...rule,
    effectiveFromMonth: "2034-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt
  }));
  const opsMonthlyRules = fixture.incentiveRules.opsMonthly.map((rule) => ({
    ...rule,
    effectiveFromMonth: "2034-06",
    effectiveToMonth: null,
    isActive: true,
    createdAt,
    updatedAt
  }));

  function withRelations(call: any) {
    const course = courses.get(call.courseId);
    return {
      ...call,
      operatingMonth,
      room: rooms.get(call.roomId),
      course: course
        ? {
            ...course,
            policies: coursePolicies.filter((policy) => policy.courseId === call.courseId)
          }
        : undefined,
      assignments: assignments
        .filter((assignment) => assignment.serviceCallId === call.id && assignment.isActive !== false)
        .map((assignment) => ({ ...assignment, employee: employees.get(assignment.employeeId) }))
    };
  }

  const client: any = {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      },
      async findMany() {
        return [operatingMonth];
      }
    },
    room: {
      async findUnique({ where }: any) {
        const room = rooms.get(where.id);
        if (!room) return null;
        if (where.isActive !== undefined && room.isActive !== where.isActive) return null;
        return room;
      },
      async findMany({ where }: any = {}) {
        return [...rooms.values()]
          .filter((room) => where?.isActive === undefined || room.isActive === where.isActive)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
      }
    },
    course: {
      async findUnique({ where }: any) {
        const course = courses.get(where.id);
        if (!course) return null;
        if (where.isActive !== undefined && course.isActive !== where.isActive) return null;
        return course;
      },
      async findMany() {
        return [...courses.values()];
      }
    },
    coursePolicy: {
      async findMany({ where }: any = {}) {
        return coursePolicies.filter((policy) => (where?.courseId === undefined || policy.courseId === where.courseId) && (where?.isActive === undefined || policy.isActive === where.isActive));
      }
    },
    therapistCourseRate: {
      async findMany({ where }: any = {}) {
        return therapistRates.filter(
          (rate) =>
            matchesIn(rate.therapistId, where?.therapistId) &&
            matchesIn(rate.courseId, where?.courseId) &&
            (where?.isActive === undefined || rate.isActive === where.isActive)
        );
      }
    },
    employee: {
      async findUnique({ where }: any) {
        const employee = employees.get(where.id);
        if (!employee) return null;
        if (where.isActive !== undefined && employee.isActive !== where.isActive) return null;
        return employee;
      },
      async findMany({ where }: any = {}) {
        return [...employees.values()]
          .filter((employee) => (where?.employeeGroup === undefined || employee.employeeGroup === where.employeeGroup) && (where?.isActive === undefined || employee.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode) || a.id.localeCompare(b.id));
      }
    },
    codeItem: {
      async findUnique({ where }: any) {
        const record = codeItems.find((item) => item.codeType === where.codeType_code?.codeType && item.code === where.codeType_code?.code);
        return record ?? null;
      },
      async findMany({ where }: any = {}) {
        return codeItems
          .filter((item) => (where?.codeType === undefined || item.codeType === where.codeType) && (where?.isActive === undefined || item.isActive === where.isActive))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
      }
    },
    timeSlot: {
      async findUnique({ where }: any) {
        return timeSlots.find((slot) => slot.value === where.value && (where.isActive === undefined || slot.isActive === where.isActive)) ?? null;
      },
      async findMany() {
        return timeSlots;
      }
    },
    serviceCall: {
      async findMany({ where }: any = {}) {
        if (where?.serviceDate?.gte !== undefined && where?.serviceDate?.lte !== undefined && options.monthlyOpsCredit !== undefined) {
          return [
            withRelations({
              id: "call-monthly-ops-1500",
              operatingMonthId: operatingMonth.id,
              serviceDate: dbDate("2034-06-15"),
              startTime: "11:00",
              roomId: "room-101",
              courseId: "course-a",
              status: "방문완료",
              discountTypeCode: null,
              paymentMethodCode: "CASH",
              customerMemo: "monthly ops threshold fixture",
              note: null,
              confirmationCode: null,
              createdAt,
              updatedAt
            })
          ].map((call) => ({
            ...call,
            course: {
              ...call.course,
              policies: call.course.policies.map((policy: any) => ({ ...policy, opsCallCredit: options.monthlyOpsCredit }))
            }
          }));
        }
        return [...serviceCalls.values()]
          .filter(
            (call) =>
              (where?.operatingMonthId === undefined || call.operatingMonthId === where.operatingMonthId) &&
              (where?.serviceDate === undefined || sameDate(call.serviceDate, where.serviceDate)) &&
              (where?.serviceDate?.gte === undefined || call.serviceDate >= where.serviceDate.gte) &&
              (where?.serviceDate?.lte === undefined || call.serviceDate <= where.serviceDate.lte) &&
              matchesIn(call.status, where?.status)
          )
          .map(withRelations)
          .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.id.localeCompare(b.id));
      },
      async findUnique({ where }: any) {
        const call = serviceCalls.get(where.id);
        return call ? withRelations(call) : null;
      },
      async create() {
        writeOperations.push("serviceCall.create");
        return failWrite("serviceCall.create");
      },
      async updateMany() {
        writeOperations.push("serviceCall.updateMany");
        return failWrite("serviceCall.updateMany");
      }
    },
    serviceCallAssignment: {
      async findMany({ where }: any = {}) {
        return assignments.filter((assignment) => (where?.serviceCallId === undefined || assignment.serviceCallId === where.serviceCallId) && (where?.assignmentRole === undefined || assignment.assignmentRole === where.assignmentRole));
      },
      async create() {
        writeOperations.push("serviceCallAssignment.create");
        return failWrite("serviceCallAssignment.create");
      },
      async updateMany() {
        writeOperations.push("serviceCallAssignment.updateMany");
        return failWrite("serviceCallAssignment.updateMany");
      }
    },
    serviceCallStatusHistory: {
      async create() {
        writeOperations.push("serviceCallStatusHistory.create");
        return failWrite("serviceCallStatusHistory.create");
      },
      async findMany() {
        return [];
      }
    },
    dailyExpense: {
      async findMany({ where }: any = {}) {
        return dailyExpenses.filter(
          (expense) =>
            (where?.operatingMonthId === undefined || expense.operatingMonthId === where.operatingMonthId) &&
            (where?.expenseDate === undefined || sameDate(expense.expenseDate, where.expenseDate)) &&
            (where?.isActive === undefined || expense.isActive === where.isActive)
        );
      },
      async findUnique() {
        return null;
      },
      async create() {
        writeOperations.push("dailyExpense.create");
        return failWrite("dailyExpense.create");
      },
      async updateMany() {
        writeOperations.push("dailyExpense.updateMany");
        return failWrite("dailyExpense.updateMany");
      }
    },
    opsAttendance: {
      async findMany({ where }: any = {}) {
        return opsAttendances.filter((attendance) => (where?.operatingMonthId === undefined || attendance.operatingMonthId === where.operatingMonthId) && (where?.attendanceDate === undefined || sameDate(attendance.attendanceDate, where.attendanceDate)) && (where?.isActive === undefined || attendance.isActive === where.isActive));
      }
    },
    earcareAttendance: {
      async findMany({ where }: any = {}) {
        return earcareAttendances
          .filter((attendance) => options.zeroEarcareWorkersDate === undefined || attendance.attendanceDate.toISOString().slice(0, 10) !== options.zeroEarcareWorkersDate || attendance.statusCode !== "NORMAL")
          .filter((attendance) => (where?.operatingMonthId === undefined || attendance.operatingMonthId === where.operatingMonthId) && (where?.attendanceDate === undefined || sameDate(attendance.attendanceDate, where.attendanceDate)) && (where?.isActive === undefined || attendance.isActive === where.isActive));
      }
    },
    opsDailyIncentiveRule: {
      async findMany({ where }: any = {}) {
        return opsDailyRules.filter((rule) => where?.isActive === undefined || rule.isActive === where.isActive);
      }
    },
    opsMonthlyIncentiveRule: {
      async findMany({ where }: any = {}) {
        const monthlyCredit = options.monthlyOpsCredit;
        const rules = monthlyCredit === undefined ? opsMonthlyRules : opsMonthlyRules.map((rule) => ({ ...rule }));
        return rules.filter((rule) => where?.isActive === undefined || rule.isActive === where.isActive);
      }
    },
    auditLog: {
      async create() {
        writeOperations.push("auditLog.create");
        return failWrite("auditLog.create");
      },
      async findMany() {
        return [];
      }
    },
    $transaction<T>(callback: (tx: any) => Promise<T>) {
      return callback(client);
    },
    writeOperations
  };

  return client;
}
