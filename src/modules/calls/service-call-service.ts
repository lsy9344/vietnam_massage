import { prisma } from "@/lib/prisma";
import { listActiveCodeItems, listActiveTimeSlots } from "@/modules/masters/code-service";
import { listActiveCourses } from "@/modules/masters/course-service";
import { listActiveEmployees } from "@/modules/masters/employee-service";
import { listActiveRooms } from "@/modules/masters/room-service";
import {
  assignmentRoles,
  serviceCallInputSchema,
  type ServiceCallAssignmentRole,
  type ServiceCallInput
} from "@/modules/calls/service-call-schema";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
};

type RoomRecord = {
  id: string;
  displayName: string;
  isActive: boolean;
};

type CourseRecord = {
  id: string;
  code: string;
  isActive: boolean;
  policies?: CoursePolicyRecord[];
};

type CoursePolicyRecord = {
  id: string;
  courseId: string;
  name: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
};

type EmployeeRecord = {
  id: string;
  displayName: string;
  staffCode: string;
  employeeGroup: string;
  isActive: boolean;
};

type CodeItemRecord = {
  codeType: string;
  code: string;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
};

type TimeSlotRecord = {
  value: string;
  sortOrder: number;
  isActive: boolean;
};

type ServiceCallAssignmentRecord = {
  id: string;
  serviceCallId: string;
  employeeId: string;
  assignmentRole: string;
  employee?: EmployeeRecord;
};

type ServiceCallRecord = {
  id: string;
  operatingMonthId: string;
  operatingMonth?: OperatingMonthRecord;
  serviceDate: Date;
  startTime: string;
  roomId: string;
  room?: RoomRecord;
  courseId: string;
  course?: CourseRecord;
  customerMemo: string | null;
  status: string;
  discountTypeCode: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  confirmationCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  assignments?: ServiceCallAssignmentRecord[];
};

type ServiceCallPrismaClient = {
  operatingMonth: {
    findMany(args?: unknown): Promise<OperatingMonthRecord[]>;
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  room: {
    findUnique(args: unknown): Promise<RoomRecord | null>;
    findMany(args?: unknown): Promise<RoomRecord[]>;
  };
  course: {
    findUnique(args: unknown): Promise<CourseRecord | null>;
    findMany(args?: unknown): Promise<CourseRecord[]>;
  };
  coursePolicy: {
    findMany(args?: unknown): Promise<CoursePolicyRecord[]>;
  };
  employee: {
    findUnique(args: unknown): Promise<EmployeeRecord | null>;
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
  };
  codeItem: {
    findUnique(args: unknown): Promise<CodeItemRecord | null>;
    findMany(args?: unknown): Promise<CodeItemRecord[]>;
  };
  timeSlot: {
    findUnique(args: unknown): Promise<TimeSlotRecord | null>;
    findMany(args?: unknown): Promise<TimeSlotRecord[]>;
  };
  serviceCall: {
    create(args: unknown): Promise<ServiceCallRecord>;
    findMany(args?: unknown): Promise<ServiceCallRecord[]>;
    findUnique(args: unknown): Promise<ServiceCallRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  serviceCallAssignment: {
    create(args: unknown): Promise<ServiceCallAssignmentRecord>;
    findMany(args?: unknown): Promise<ServiceCallAssignmentRecord[]>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  $transaction?<T>(callback: (tx: ServiceCallPrismaClient) => Promise<T>): Promise<T>;
};

export type ServiceCallAssigneeDto = {
  id: string;
  displayName: string;
  staffCode: string;
};

export type ServiceCallRowDto = {
  id: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  roomId: string;
  roomLabel: string;
  courseId: string;
  courseLabel: string;
  customerMemo: string | null;
  therapist1: ServiceCallAssigneeDto | null;
  therapist2: ServiceCallAssigneeDto | null;
  earcare: ServiceCallAssigneeDto | null;
  status: string;
  discountTypeCode: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  confirmationCode: string | null;
  paymentAmount: null;
  therapist1Commission: null;
  therapist2Commission: null;
  earcarePoolAmount: null;
  opsCallCredit: null;
  createdAt: string;
  updatedAt: string;
};

export type ServiceCallOption = {
  value: string;
  label: string;
};

export type ServiceCallFormOptions = {
  rooms: ServiceCallOption[];
  timeSlots: ServiceCallOption[];
  courses: ServiceCallOption[];
  statuses: ServiceCallOption[];
  discountTypes: ServiceCallOption[];
  paymentMethods: ServiceCallOption[];
  confirmationCodes: ServiceCallOption[];
  therapists: ServiceCallOption[];
  earcareEmployees: ServiceCallOption[];
};

export class ServiceCallDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ServiceCallDomainError";
  }
}

function getClient(client?: ServiceCallPrismaClient) {
  return client ?? (prisma as unknown as ServiceCallPrismaClient);
}

async function runInTransaction<T>(client: ServiceCallPrismaClient, callback: (tx: ServiceCallPrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function toIsoDateOnly(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function assertAssignmentRole(value: string): asserts value is ServiceCallAssignmentRole {
  if (!assignmentRoles.includes(value as ServiceCallAssignmentRole)) {
    throw new ServiceCallDomainError("담당자 역할이 올바르지 않습니다.", "INVALID_ASSIGNMENT_ROLE");
  }
}

function isDateWithinOperatingMonth(date: Date, month: OperatingMonthRecord) {
  return date.getTime() >= month.startDate.getTime() && date.getTime() <= month.endDate.getTime();
}

function effectiveForMonth(policy: CoursePolicyRecord, monthKey: string) {
  return policy.isActive && policy.effectiveFromMonth <= monthKey && (policy.effectiveToMonth === null || policy.effectiveToMonth >= monthKey);
}

function firstCurrentPolicy(course: CourseRecord, monthKey: string) {
  return [...(course.policies ?? [])]
    .filter((policy) => effectiveForMonth(policy, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
}

function toAssigneeDto(record: EmployeeRecord): ServiceCallAssigneeDto {
  return {
    id: record.id,
    displayName: record.displayName,
    staffCode: record.staffCode
  };
}

function assignmentByRole(record: ServiceCallRecord, role: ServiceCallAssignmentRole) {
  return (record.assignments ?? []).find((assignment) => {
    assertAssignmentRole(assignment.assignmentRole);
    return assignment.assignmentRole === role;
  });
}

function toRowDto(record: ServiceCallRecord): ServiceCallRowDto {
  const operatingMonth = record.operatingMonth;
  const course = record.course;
  const policy = operatingMonth && course ? firstCurrentPolicy(course, operatingMonth.monthKey) : null;
  const therapist1 = assignmentByRole(record, "THERAPIST_1")?.employee ?? null;
  const therapist2 = assignmentByRole(record, "THERAPIST_2")?.employee ?? null;
  const earcare = assignmentByRole(record, "EARCARE")?.employee ?? null;

  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    serviceDate: toIsoDateOnly(record.serviceDate),
    startTime: record.startTime,
    roomId: record.roomId,
    roomLabel: record.room?.displayName ?? record.roomId,
    courseId: record.courseId,
    courseLabel: policy ? `${course?.code ?? ""} ${policy.name}`.trim() : record.courseId,
    customerMemo: record.customerMemo,
    therapist1: therapist1 ? toAssigneeDto(therapist1) : null,
    therapist2: therapist2 ? toAssigneeDto(therapist2) : null,
    earcare: earcare ? toAssigneeDto(earcare) : null,
    status: record.status,
    discountTypeCode: record.discountTypeCode,
    paymentMethodCode: record.paymentMethodCode,
    note: record.note,
    confirmationCode: record.confirmationCode,
    paymentAmount: null,
    therapist1Commission: null,
    therapist2Commission: null,
    earcarePoolAmount: null,
    opsCallCredit: null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function option(value: string, label: string): ServiceCallOption {
  return { value, label };
}

async function requireOperatingMonth(tx: ServiceCallPrismaClient, operatingMonthId: string) {
  const month = await tx.operatingMonth.findUnique({ where: { id: operatingMonthId } });
  if (!month) {
    throw new ServiceCallDomainError("운영월을 찾을 수 없습니다.", "OPERATING_MONTH_NOT_FOUND");
  }
  return month;
}

async function assertWritableDate(tx: ServiceCallPrismaClient, input: { operatingMonthId: string; serviceDate: string }) {
  const month = await requireOperatingMonth(tx, input.operatingMonthId);
  if (month.status === "잠금") {
    throw new ServiceCallDomainError("잠긴 운영월입니다. 콜 원장을 수정할 수 없습니다.", "OPERATING_MONTH_LOCKED");
  }

  const serviceDate = toDateOnly(input.serviceDate);
  if (!isDateWithinOperatingMonth(serviceDate, month)) {
    throw new ServiceCallDomainError("운영월 범위를 벗어난 날짜입니다.", "OPERATING_MONTH_DATE_OUT_OF_RANGE");
  }

  return { month, serviceDate };
}

async function assertActiveTimeSlot(tx: ServiceCallPrismaClient, startTime: string) {
  const slot = await tx.timeSlot.findUnique({ where: { value: startTime } });
  if (!slot || !slot.isActive) {
    throw new ServiceCallDomainError("활성 시간 슬롯을 선택하세요.", "TIME_SLOT_NOT_ACTIVE");
  }
}

async function assertActiveRoom(tx: ServiceCallPrismaClient, roomId: string) {
  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) {
    throw new ServiceCallDomainError("활성 객실을 선택하세요.", "ROOM_NOT_ACTIVE");
  }
}

async function assertActiveCourse(tx: ServiceCallPrismaClient, input: { courseId: string; monthKey: string }) {
  const course = await tx.course.findUnique({ where: { id: input.courseId } });
  if (!course || !course.isActive) {
    throw new ServiceCallDomainError("활성 코스를 선택하세요.", "COURSE_NOT_ACTIVE");
  }
  const policies = await tx.coursePolicy.findMany({ where: { courseId: input.courseId, isActive: true } });
  if (!policies.some((policy) => effectiveForMonth(policy, input.monthKey))) {
    throw new ServiceCallDomainError("선택 운영월에 적용되는 코스 정책이 없습니다.", "COURSE_POLICY_NOT_FOUND");
  }
}

async function assertActiveCode(tx: ServiceCallPrismaClient, input: { codeType: string; code: string | null | undefined; required?: boolean }) {
  if (!input.code) {
    if (input.required) {
      throw new ServiceCallDomainError("필수 코드를 선택하세요.", "REQUIRED_CODE_MISSING");
    }
    return;
  }

  const codeItem = await tx.codeItem.findUnique({
    where: { codeType_code: { codeType: input.codeType, code: input.code } }
  });
  if (!codeItem || !codeItem.isActive) {
    throw new ServiceCallDomainError("활성 코드값을 선택하세요.", "CODE_NOT_ACTIVE");
  }
}

async function assertActiveEmployee(tx: ServiceCallPrismaClient, input: { employeeId: string | null | undefined; role: ServiceCallAssignmentRole }) {
  if (!input.employeeId) {
    return;
  }

  const expectedGroup = input.role === "EARCARE" ? "EARCARE" : "THERAPIST";
  const employee = await tx.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee || !employee.isActive || employee.employeeGroup !== expectedGroup) {
    throw new ServiceCallDomainError("활성 담당 직원을 선택하세요.", "EMPLOYEE_NOT_ACTIVE_FOR_ROLE");
  }
}

async function writeAssignment(
  tx: ServiceCallPrismaClient,
  input: { serviceCallId: string; assignmentRole: ServiceCallAssignmentRole; employeeId: string | null | undefined }
) {
  if (!input.employeeId) {
    return;
  }

  const existing = (
    await tx.serviceCallAssignment.findMany({
      where: { serviceCallId: input.serviceCallId, assignmentRole: input.assignmentRole }
    })
  )[0];

  if (existing) {
    await tx.serviceCallAssignment.updateMany({
      where: { id: existing.id },
      data: { employeeId: input.employeeId }
    });
    return;
  }

  await tx.serviceCallAssignment.create({
    data: {
      serviceCallId: input.serviceCallId,
      assignmentRole: input.assignmentRole,
      employeeId: input.employeeId
    }
  });
}

async function findServiceCallWithRelations(tx: ServiceCallPrismaClient, id: string) {
  const record = await tx.serviceCall.findUnique({
    where: { id },
    include: {
      operatingMonth: true,
      room: true,
      course: { include: { policies: true } },
      assignments: { include: { employee: true } }
    }
  });

  if (!record) {
    throw new ServiceCallDomainError("콜 원장 행을 찾을 수 없습니다.", "SERVICE_CALL_NOT_FOUND");
  }

  return record;
}

export async function listServiceCallsForDate(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: ServiceCallPrismaClient;
}) {
  const parsed = serviceCallInputSchema.pick({ operatingMonthId: true, serviceDate: true }).safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "조회 조건이 올바르지 않습니다.", "INVALID_SERVICE_CALL_QUERY");
  }

  const client = getClient(input.prismaClient);
  const [records, timeSlots] = await Promise.all([
    client.serviceCall.findMany({
      where: {
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate: toDateOnly(parsed.data.serviceDate)
      },
      include: {
        operatingMonth: true,
        room: true,
        course: { include: { policies: true } },
        assignments: { include: { employee: true } }
      },
      orderBy: [{ startTime: "asc" }, { createdAt: "asc" }]
    }),
    client.timeSlot.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  ]);
  const sortOrderByTime = new Map(timeSlots.map((slot) => [slot.value, slot.sortOrder]));

  return records
    .sort((a, b) => {
      const leftOrder = sortOrderByTime.get(a.startTime) ?? 9999;
      const rightOrder = sortOrderByTime.get(b.startTime) ?? 9999;
      return leftOrder - rightOrder || a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map(toRowDto);
}

export async function saveBasicServiceCallRow(input: ServiceCallInput & { prismaClient?: ServiceCallPrismaClient }) {
  const parsed = serviceCallInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "콜 원장 입력값이 올바르지 않습니다.", "INVALID_SERVICE_CALL_INPUT");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const { month, serviceDate } = await assertWritableDate(tx, {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate
    });

    await Promise.all([
      assertActiveTimeSlot(tx, parsed.data.startTime),
      assertActiveRoom(tx, parsed.data.roomId),
      assertActiveCourse(tx, { courseId: parsed.data.courseId, monthKey: month.monthKey }),
      assertActiveCode(tx, { codeType: "SERVICE_STATUS", code: parsed.data.status, required: true }),
      assertActiveCode(tx, { codeType: "DISCOUNT_TYPE", code: parsed.data.discountTypeCode }),
      assertActiveCode(tx, { codeType: "PAYMENT_METHOD", code: parsed.data.paymentMethodCode }),
      assertActiveCode(tx, { codeType: "CONFIRMATION", code: parsed.data.confirmationCode }),
      assertActiveEmployee(tx, { role: "THERAPIST_1", employeeId: parsed.data.therapist1Id }),
      assertActiveEmployee(tx, { role: "THERAPIST_2", employeeId: parsed.data.therapist2Id }),
      assertActiveEmployee(tx, { role: "EARCARE", employeeId: parsed.data.earcareEmployeeId })
    ]);

    const data = {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      startTime: parsed.data.startTime,
      roomId: parsed.data.roomId,
      courseId: parsed.data.courseId,
      customerMemo: parsed.data.customerMemo ?? null,
      status: parsed.data.status,
      discountTypeCode: parsed.data.discountTypeCode ?? null,
      paymentMethodCode: parsed.data.paymentMethodCode ?? null,
      note: parsed.data.note ?? null,
      confirmationCode: parsed.data.confirmationCode ?? null
    };

    let serviceCall: ServiceCallRecord;
    if (parsed.data.serviceCallId) {
      const updateResult = await tx.serviceCall.updateMany({
        where: { id: parsed.data.serviceCallId, operatingMonthId: parsed.data.operatingMonthId },
        data
      });
      if (updateResult.count !== 1) {
        throw new ServiceCallDomainError("콜 원장 행을 찾을 수 없습니다.", "SERVICE_CALL_NOT_FOUND");
      }
      serviceCall = await findServiceCallWithRelations(tx, parsed.data.serviceCallId);
    } else {
      serviceCall = await tx.serviceCall.create({ data });
    }

    await Promise.all([
      writeAssignment(tx, {
        serviceCallId: serviceCall.id,
        assignmentRole: "THERAPIST_1",
        employeeId: parsed.data.therapist1Id
      }),
      writeAssignment(tx, {
        serviceCallId: serviceCall.id,
        assignmentRole: "THERAPIST_2",
        employeeId: parsed.data.therapist2Id
      }),
      writeAssignment(tx, {
        serviceCallId: serviceCall.id,
        assignmentRole: "EARCARE",
        employeeId: parsed.data.earcareEmployeeId
      })
    ]);

    return toRowDto(await findServiceCallWithRelations(tx, serviceCall.id));
  });
}

export async function listServiceCallFormOptions(input: { operatingMonthId?: string; prismaClient?: ServiceCallPrismaClient } = {}) {
  const client = getClient(input.prismaClient);
  const operatingMonths = await client.operatingMonth.findMany({ orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }] });
  const selectedMonth = input.operatingMonthId
    ? operatingMonths.find((month) => month.id === input.operatingMonthId)
    : operatingMonths[0];
  const monthKey = selectedMonth?.monthKey;

  const [rooms, timeSlots, courses, statuses, discountTypes, paymentMethods, confirmationCodes, therapists, earcareEmployees] = await Promise.all([
    listActiveRooms({ prismaClient: client as any }),
    listActiveTimeSlots({ prismaClient: client as any }),
    monthKey ? listActiveCourses({ monthKey, prismaClient: client as any }) : Promise.resolve([]),
    listActiveCodeItems({ codeType: "SERVICE_STATUS", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "DISCOUNT_TYPE", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "PAYMENT_METHOD", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "CONFIRMATION", prismaClient: client as any }),
    listActiveEmployees({ employeeGroup: "THERAPIST", prismaClient: client as any }),
    listActiveEmployees({ employeeGroup: "EARCARE", prismaClient: client as any })
  ]);

  return {
    rooms: rooms.map((room) => option(room.id, room.displayName)),
    timeSlots: timeSlots.map((slot) => option(slot.value, slot.value)),
    courses: courses.map((course) => option(course.id, `${course.code} ${course.currentPolicy.name}`)),
    statuses: statuses.map((code) => option(code.code, code.displayName)),
    discountTypes: discountTypes.map((code) => option(code.code, code.displayName)),
    paymentMethods: paymentMethods.map((code) => option(code.code, code.displayName)),
    confirmationCodes: confirmationCodes.map((code) => option(code.code, code.displayName)),
    therapists: therapists.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`)),
    earcareEmployees: earcareEmployees.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`))
  } satisfies ServiceCallFormOptions;
}
