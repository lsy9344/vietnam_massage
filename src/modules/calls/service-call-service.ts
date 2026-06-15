import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { assertOperatingMonthPayoutWritable } from "@/modules/closing/month-lock-guard";
import { listActiveCodeItems, listActiveTimeSlots } from "@/modules/masters/code-service";
import { listActiveCourses } from "@/modules/masters/course-service";
import { listActiveEmployees } from "@/modules/masters/employee-service";
import { listActiveRooms } from "@/modules/masters/room-service";
import {
  assignmentRoles,
  dailyExpenseDeactivateSchema,
  dailyExpenseInputSchema,
  dailyExpenseUpdateSchema,
  serviceCallAutosaveInputSchema,
  serviceCallInputSchema,
  type DailyExpenseDeactivateInput,
  type DailyExpenseInput,
  type DailyExpenseUpdateInput,
  type ServiceCallAssignmentRole,
  type ServiceCallAutosaveInput,
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
  durationMinutes: number;
  basePrice: number;
  opsCallCredit: number;
  earcarePoolAmount: number;
  requiresSecondTherapist: boolean;
  tvDisplayName: string;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

type TherapistCourseRateRecord = {
  id: string;
  therapistId: string;
  courseId: string;
  amount: number;
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
  isActive?: boolean;
  employee?: EmployeeRecord;
};

type ServiceCallStatusHistoryRecord = {
  id: string;
  serviceCallId: string;
  previousStatus: string;
  newStatus: string;
  changedByAccountId: string;
  changedAt: Date;
  createdAt: Date;
};

type DailyExpenseRecord = {
  id: string;
  operatingMonthId: string;
  operatingMonth?: OperatingMonthRecord;
  expenseDate: Date;
  amount: number;
  description: string;
  handledByEmployeeId: string;
  handledByEmployee?: EmployeeRecord;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type ServiceCallRecord = {
  id: string;
  operatingMonthId: string;
  operatingMonth?: OperatingMonthRecord;
  serviceDate: Date;
  startTime: string;
  roomId: string | null;
  room?: RoomRecord | null;
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
  therapistCourseRate: {
    findMany(args?: unknown): Promise<TherapistCourseRateRecord[]>;
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
  serviceCallStatusHistory: {
    create(args: unknown): Promise<ServiceCallStatusHistoryRecord>;
    findMany(args?: unknown): Promise<ServiceCallStatusHistoryRecord[]>;
  };
  dailyExpense: {
    create(args: unknown): Promise<DailyExpenseRecord>;
    findMany(args?: unknown): Promise<DailyExpenseRecord[]>;
    findUnique(args: unknown): Promise<DailyExpenseRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
    findMany(args?: unknown): Promise<unknown[]>;
  };
  $transaction?<T>(callback: (tx: ServiceCallPrismaClient) => Promise<T>): Promise<T>;
};

export type ServiceCallAssigneeDto = {
  id: string;
  displayName: string;
  staffCode: string;
};

export type ServiceCallCalculationStatus =
  | "not_completed"
  | "calculated"
  | "course_policy_missing"
  | "therapist_rate_missing"
  | "second_therapist_required";

export type ServiceCallRowDto = {
  id: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  roomId: string | null;
  roomLabel: string;
  courseId: string;
  courseCode: string;
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
  basePrice: number;
  paymentAmount: number;
  discountAmount: number;
  therapist1Commission: number;
  therapist2Commission: number;
  earcarePoolAmount: number;
  opsCallCredit: number;
  calculationStatus: ServiceCallCalculationStatus;
  calculationErrorCode: string | null;
  calculationErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  savedAt: string;
};

export type DailyExpenseDto = {
  id: string;
  operatingMonthId: string;
  expenseDate: string;
  amount: number;
  description: string;
  handledByEmployee: ServiceCallAssigneeDto;
  note: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DailyCourseSummaryDto = {
  courseCode: "A" | "B" | "C" | "D" | "E";
  completedCount: number;
  discountCount: number;
  therapistAssignmentCount: number;
};

export type DailyCallLedgerSummaryDto = {
  reservationCount: number;
  inUseCount: number;
  cleaningCount: number;
  completedCount: number;
  noShowCount: number;
  canceledCount: number;
  paymentTotal: number;
  therapistCommissionTotal: number;
  earcarePoolTotal: number;
  discountTotal: number;
  expenseTotal: number;
  netSales: number;
  paymentMethodTotals: {
    cash: number;
    card: number;
    bank: number;
    other: number;
  };
  courseSummaries: DailyCourseSummaryDto[];
  warningCounts: {
    coursePolicyMissing: number;
    therapistRateMissing: number;
    secondTherapistRequired: number;
  };
};

export type CompletedServiceCallCalculationDto = {
  serviceCallId: string;
  serviceDate: string;
  courseId: string;
  courseCode: string;
  basePrice: number;
  paymentAmount: number;
  discountAmount: number;
  earcarePoolAmount: number;
  opsCallCredit: number;
  therapistAssignments: Array<{
    role: "THERAPIST_1" | "THERAPIST_2";
    employeeId: string;
    commissionAmount: number;
  }>;
};

export type ServiceCallStatusHistoryDto = {
  id: string;
  serviceCallId: string;
  previousStatus: string;
  newStatus: string;
  changedByAccountId: string;
  changedAt: string;
  createdAt: string;
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
  expenseHandlers: ServiceCallOption[];
};

export class ServiceCallDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ServiceCallDomainError";
  }
}

function isCompletedServiceCallStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function isReservationStatus(status: string) {
  return status === "예약" || status === "RESERVED";
}

function isInUseStatus(status: string) {
  return status === "사용중" || status === "IN_USE" || status === "USING";
}

function isCleaningStatus(status: string) {
  return status === "청소중" || status === "CLEANING";
}

function isNoShowStatus(status: string) {
  return status === "노쇼" || status === "NO_SHOW";
}

function isCanceledStatus(status: string) {
  return status === "취소" || status === "CANCELED";
}

function requiresAssignedRoom(status: string) {
  return isInUseStatus(status) || isCleaningStatus(status) || isCompletedServiceCallStatus(status);
}

function recognizesRevenue(record: ServiceCallRecord) {
  if (isNoShowStatus(record.status) || isCanceledStatus(record.status)) {
    return false;
  }

  return isCompletedServiceCallStatus(record.status) || isInUseStatus(record.status) || Boolean(record.paymentMethodCode);
}

function paymentMethodBucket(code: string | null): keyof DailyCallLedgerSummaryDto["paymentMethodTotals"] {
  if (!code) return "other";

  const normalized = code.trim().toUpperCase();
  if (code === "현금" || normalized === "CASH") return "cash";
  if (code === "카드" || normalized === "CARD" || normalized === "CREDIT_CARD") return "card";
  if (code === "계좌" || normalized === "BANK" || normalized === "TRANSFER" || normalized === "BANK_TRANSFER" || normalized === "ACCOUNT_TRANSFER") {
    return "bank";
  }

  return "other";
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

function effectiveForMonth(record: { isActive: boolean; effectiveFromMonth: string; effectiveToMonth: string | null }, monthKey: string) {
  return record.isActive && record.effectiveFromMonth <= monthKey && (record.effectiveToMonth === null || record.effectiveToMonth >= monthKey);
}

function firstCurrentPolicy(course: CourseRecord, monthKey: string) {
  return [...(course.policies ?? [])]
    .filter((policy) => effectiveForMonth(policy, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
}

function firstCurrentRate(rates: TherapistCourseRateRecord[], monthKey: string) {
  return [...rates]
    .filter((rate) => effectiveForMonth(rate, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
}

function emptyCalculation(status: ServiceCallCalculationStatus, error?: { code: string; message: string }) {
  return {
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 0,
    calculationStatus: status,
    calculationErrorCode: error?.code ?? null,
    calculationErrorMessage: error?.message ?? null
  };
}

async function findCoursePolicyForCalculation(tx: ServiceCallPrismaClient, record: ServiceCallRecord, monthKey: string) {
  const includedPolicy = record.course ? firstCurrentPolicy(record.course, monthKey) : null;
  if (includedPolicy) {
    return includedPolicy;
  }

  const policies = await tx.coursePolicy.findMany({ where: { courseId: record.courseId, isActive: true } });
  return [...policies]
    .filter((policy) => effectiveForMonth(policy, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0] ?? null;
}

async function findTherapistCourseRateForCalculation(
  tx: ServiceCallPrismaClient,
  input: { therapistId: string; courseId: string; monthKey: string }
) {
  const rates = await tx.therapistCourseRate.findMany({
    where: { therapistId: input.therapistId, courseId: input.courseId, isActive: true }
  });
  return firstCurrentRate(rates, input.monthKey) ?? null;
}

async function calculateServiceCallCompletion(tx: ServiceCallPrismaClient, record: ServiceCallRecord) {
  if (!recognizesRevenue(record)) {
    return emptyCalculation("not_completed");
  }

  const monthKey = record.operatingMonth?.monthKey;
  if (!monthKey) {
    return emptyCalculation("course_policy_missing", {
      code: "OPERATING_MONTH_NOT_FOUND",
      message: "운영월을 찾을 수 없어 계산할 수 없습니다."
    });
  }

  const policy = await findCoursePolicyForCalculation(tx, record, monthKey);
  if (!policy) {
    return emptyCalculation("course_policy_missing", {
      code: "COURSE_POLICY_NOT_FOUND",
      message: "선택 운영월에 적용되는 코스 정책이 없습니다."
    });
  }

  const discountAmount = record.discountTypeCode === null ? 0 : 100000;
  const baseCalculation = {
    basePrice: policy.basePrice,
    paymentAmount: Math.max(policy.basePrice - discountAmount, 0),
    discountAmount,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: policy.earcarePoolAmount,
    opsCallCredit: policy.opsCallCredit,
    calculationStatus: "calculated" as ServiceCallCalculationStatus,
    calculationErrorCode: null,
    calculationErrorMessage: null
  };
  const therapist1 = assignmentByRole(record, "THERAPIST_1");
  const therapist2 = assignmentByRole(record, "THERAPIST_2");

  if (!isCompletedServiceCallStatus(record.status)) {
    return {
      ...baseCalculation,
      therapist1Commission: 0,
      therapist2Commission: 0,
      earcarePoolAmount: 0,
      opsCallCredit: 0
    };
  }

  if (policy.requiresSecondTherapist && !therapist2) {
    return emptyCalculation("second_therapist_required", {
      code: "D_COURSE_SECOND_THERAPIST_REQUIRED",
      message: "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다."
    });
  }

  if (therapist1) {
    const rate = await findTherapistCourseRateForCalculation(tx, {
      therapistId: therapist1.employeeId,
      courseId: record.courseId,
      monthKey
    });
    if (!rate) {
      return {
        ...baseCalculation,
        calculationStatus: "therapist_rate_missing" as ServiceCallCalculationStatus,
        calculationErrorCode: "THERAPIST_RATE_NOT_FOUND",
        calculationErrorMessage: "마사지사1 수당 정책을 찾을 수 없습니다."
      };
    }
    baseCalculation.therapist1Commission = rate.amount;
  }

  if (therapist2) {
    const rate = await findTherapistCourseRateForCalculation(tx, {
      therapistId: therapist2.employeeId,
      courseId: record.courseId,
      monthKey
    });
    if (!rate) {
      return {
        ...baseCalculation,
        calculationStatus: "therapist_rate_missing" as ServiceCallCalculationStatus,
        calculationErrorCode: "THERAPIST_RATE_NOT_FOUND",
        calculationErrorMessage: "마사지사2 수당 정책을 찾을 수 없습니다."
      };
    }
    baseCalculation.therapist2Commission = rate.amount;
  }

  return baseCalculation;
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
    return assignment.assignmentRole === role && assignment.isActive !== false;
  });
}

async function toRowDto(tx: ServiceCallPrismaClient, record: ServiceCallRecord): Promise<ServiceCallRowDto> {
  const operatingMonth = record.operatingMonth;
  const course = record.course;
  const policy = operatingMonth && course ? firstCurrentPolicy(course, operatingMonth.monthKey) : null;
  const therapist1 = assignmentByRole(record, "THERAPIST_1")?.employee ?? null;
  const therapist2 = assignmentByRole(record, "THERAPIST_2")?.employee ?? null;
  const earcare = assignmentByRole(record, "EARCARE")?.employee ?? null;
  const calculation = await calculateServiceCallCompletion(tx, record);

  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    serviceDate: toIsoDateOnly(record.serviceDate),
    startTime: record.startTime,
    roomId: record.roomId,
    roomLabel: record.room?.displayName ?? "미배정",
    courseId: record.courseId,
    courseCode: course?.code ?? "",
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
    ...calculation,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    savedAt: record.updatedAt.toISOString()
  };
}

function toHistoryDto(record: ServiceCallStatusHistoryRecord): ServiceCallStatusHistoryDto {
  return {
    id: record.id,
    serviceCallId: record.serviceCallId,
    previousStatus: record.previousStatus,
    newStatus: record.newStatus,
    changedByAccountId: record.changedByAccountId,
    changedAt: record.changedAt.toISOString(),
    createdAt: record.createdAt.toISOString()
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
  try {
    assertOperatingMonthPayoutWritable(month, "마감확정 또는 잠금 운영월입니다. 콜 원장을 수정할 수 없습니다.");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "OPERATING_MONTH_LOCKED") {
      throw new ServiceCallDomainError(error.message, "OPERATING_MONTH_LOCKED");
    }
    throw error;
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

async function assertActiveRoom(tx: ServiceCallPrismaClient, roomId: string | null | undefined) {
  if (!roomId) {
    return;
  }

  const room = await tx.room.findUnique({ where: { id: roomId } });
  if (!room || !room.isActive) {
    throw new ServiceCallDomainError("활성 객실을 선택하세요.", "ROOM_NOT_ACTIVE");
  }
}

function assertRoomRequiredForStatus(input: { roomId: string | null | undefined; status: string }) {
  if (!input.roomId && requiresAssignedRoom(input.status)) {
    throw new ServiceCallDomainError("사용중, 청소중, 방문완료 상태는 객실을 선택해야 합니다.", "ROOM_REQUIRED_FOR_STATUS");
  }
}

async function assertActiveCourse(tx: ServiceCallPrismaClient, input: { courseId: string; monthKey: string }) {
  const course = await tx.course.findUnique({ where: { id: input.courseId } });
  if (!course || !course.isActive) {
    throw new ServiceCallDomainError("활성 코스를 선택하세요.", "COURSE_NOT_ACTIVE");
  }
  const policies = await tx.coursePolicy.findMany({ where: { courseId: input.courseId, isActive: true } });
  const policy = [...policies]
    .filter((record) => effectiveForMonth(record, input.monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
  if (!policy) {
    throw new ServiceCallDomainError("선택 운영월에 적용되는 코스 정책이 없습니다.", "COURSE_POLICY_NOT_FOUND");
  }
  return policy;
}

function assertSecondTherapistRequirement(input: { policy: CoursePolicyRecord; therapist2Id: string | null | undefined }) {
  if (!input.policy.requiresSecondTherapist || input.therapist2Id) {
    return;
  }

  throw new ServiceCallDomainError(
    "D코스는 마사지사2 필수입니다. 마사지사2를 배정해야 저장됩니다.",
    "D_COURSE_SECOND_THERAPIST_REQUIRED"
  );
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

async function assertActiveExpenseHandler(tx: ServiceCallPrismaClient, employeeId: string) {
  const employee = await tx.employee.findUnique({ where: { id: employeeId } });
  if (!employee || !employee.isActive) {
    throw new ServiceCallDomainError("활성 담당 직원을 선택하세요.", "EMPLOYEE_NOT_ACTIVE");
  }
}

async function writeAssignment(
  tx: ServiceCallPrismaClient,
  input: { serviceCallId: string; assignmentRole: ServiceCallAssignmentRole; employeeId: string | null | undefined }
) {
  const existing = (
    await tx.serviceCallAssignment.findMany({
      where: { serviceCallId: input.serviceCallId, assignmentRole: input.assignmentRole }
    })
  )[0];

  if (!input.employeeId) {
    if (existing && existing.isActive !== false) {
      await tx.serviceCallAssignment.updateMany({
        where: { id: existing.id },
        data: { isActive: false }
      });
    }
    return;
  }

  if (existing) {
    await tx.serviceCallAssignment.updateMany({
      where: { id: existing.id },
      data: { employeeId: input.employeeId, isActive: true }
    });
    return;
  }

  await tx.serviceCallAssignment.create({
    data: {
      serviceCallId: input.serviceCallId,
      assignmentRole: input.assignmentRole,
      employeeId: input.employeeId,
      isActive: true
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

function assignmentEmployeeId(record: ServiceCallRecord, role: ServiceCallAssignmentRole) {
  return assignmentByRole(record, role)?.employeeId ?? null;
}

function toAuditSnapshot(record: ServiceCallRecord): AuditJsonSnapshot {
  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    serviceDate: toIsoDateOnly(record.serviceDate),
    startTime: record.startTime,
    roomId: record.roomId,
    courseId: record.courseId,
    customerMemo: record.customerMemo,
    status: record.status,
    discountTypeCode: record.discountTypeCode,
    paymentMethodCode: record.paymentMethodCode,
    note: record.note,
    confirmationCode: record.confirmationCode,
    assignments: {
      therapist1Id: assignmentEmployeeId(record, "THERAPIST_1"),
      therapist2Id: assignmentEmployeeId(record, "THERAPIST_2"),
      earcareEmployeeId: assignmentEmployeeId(record, "EARCARE")
    },
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toDailyExpenseAuditSnapshot(record: DailyExpenseRecord): AuditJsonSnapshot {
  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    expenseDate: toIsoDateOnly(record.expenseDate),
    amount: record.amount,
    description: record.description,
    handledByEmployeeId: record.handledByEmployeeId,
    note: record.note,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function toDailyExpenseDto(record: DailyExpenseRecord): DailyExpenseDto {
  const handledByEmployee = record.handledByEmployee;
  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    expenseDate: toIsoDateOnly(record.expenseDate),
    amount: record.amount,
    description: record.description,
    handledByEmployee: handledByEmployee
      ? toAssigneeDto(handledByEmployee)
      : {
          id: record.handledByEmployeeId,
          displayName: record.handledByEmployeeId,
          staffCode: record.handledByEmployeeId
        },
    note: record.note,
    isActive: record.isActive,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function hasSensitiveRowChange(before: ServiceCallRecord, after: ServiceCallRecord) {
  return (
    before.discountTypeCode !== after.discountTypeCode ||
    before.paymentMethodCode !== after.paymentMethodCode ||
    before.confirmationCode !== after.confirmationCode ||
    assignmentEmployeeId(before, "THERAPIST_1") !== assignmentEmployeeId(after, "THERAPIST_1") ||
    assignmentEmployeeId(before, "THERAPIST_2") !== assignmentEmployeeId(after, "THERAPIST_2") ||
    assignmentEmployeeId(before, "EARCARE") !== assignmentEmployeeId(after, "EARCARE")
  );
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

  return Promise.all(
    records
      .sort((a, b) => {
        const leftOrder = sortOrderByTime.get(a.startTime) ?? 9999;
        const rightOrder = sortOrderByTime.get(b.startTime) ?? 9999;
        return leftOrder - rightOrder || a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((record) => toRowDto(client, record))
  );
}

export async function listServiceCallsForOperatingMonth(input: {
  operatingMonthId: string;
  startDate: string;
  endDate: string;
  prismaClient?: ServiceCallPrismaClient;
}) {
  const parsed = serviceCallInputSchema
    .pick({ operatingMonthId: true, serviceDate: true })
    .safeParse({ operatingMonthId: input.operatingMonthId, serviceDate: input.startDate });
  const endDateParsed = serviceCallInputSchema.pick({ serviceDate: true }).safeParse({ serviceDate: input.endDate });
  if (!parsed.success || !endDateParsed.success) {
    throw new ServiceCallDomainError("월별 콜 원장 조회 조건이 올바르지 않습니다.", "INVALID_SERVICE_CALL_MONTH_QUERY");
  }

  const client = getClient(input.prismaClient);
  const [records, timeSlots] = await Promise.all([
    client.serviceCall.findMany({
      where: {
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate: {
          gte: toDateOnly(parsed.data.serviceDate),
          lte: toDateOnly(endDateParsed.data.serviceDate)
        }
      },
      include: {
        operatingMonth: true,
        room: true,
        course: { include: { policies: true } },
        assignments: { include: { employee: true } }
      },
      orderBy: [{ serviceDate: "asc" }, { startTime: "asc" }, { createdAt: "asc" }]
    }),
    client.timeSlot.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] })
  ]);
  const sortOrderByTime = new Map(timeSlots.map((slot) => [slot.value, slot.sortOrder]));

  return Promise.all(
    records
      .sort((a, b) => {
        const dateDiff = a.serviceDate.getTime() - b.serviceDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        const leftOrder = sortOrderByTime.get(a.startTime) ?? 9999;
        const rightOrder = sortOrderByTime.get(b.startTime) ?? 9999;
        return leftOrder - rightOrder || a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((record) => toRowDto(client, record))
  );
}

export async function saveBasicServiceCallRow(input: ServiceCallInput & { prismaClient?: ServiceCallPrismaClient }) {
  const parsed = serviceCallInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "콜 원장 입력값이 올바르지 않습니다.", "INVALID_SERVICE_CALL_INPUT");
  }
  assertRoomRequiredForStatus({ roomId: parsed.data.roomId, status: parsed.data.status });

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const { month, serviceDate } = await assertWritableDate(tx, {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate
    });

    const [, , coursePolicy] = await Promise.all([
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
    assertSecondTherapistRequirement({ policy: coursePolicy, therapist2Id: parsed.data.therapist2Id });

    const data = {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      startTime: parsed.data.startTime,
      roomId: parsed.data.roomId ?? null,
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

    return toRowDto(tx, await findServiceCallWithRelations(tx, serviceCall.id));
  });
}

export async function autosaveServiceCallRow(
  input: ServiceCallAutosaveInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }
) {
  const parsed = serviceCallAutosaveInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "콜 원장 입력값이 올바르지 않습니다.", "INVALID_SERVICE_CALL_INPUT");
  }
  assertRoomRequiredForStatus({ roomId: parsed.data.roomId, status: parsed.data.status });

  const actorId = input.actorId?.trim();
  if (!actorId) {
    throw new ServiceCallDomainError("저장 행위자를 확인할 수 없습니다.", "ACTOR_REQUIRED");
  }

  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const { month, serviceDate } = await assertWritableDate(tx, {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate
    });

    const [, , coursePolicy] = await Promise.all([
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
    assertSecondTherapistRequirement({ policy: coursePolicy, therapist2Id: parsed.data.therapist2Id });

    const before = await findServiceCallWithRelations(tx, parsed.data.serviceCallId);
    const data = {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      startTime: parsed.data.startTime,
      roomId: parsed.data.roomId ?? null,
      courseId: parsed.data.courseId,
      customerMemo: parsed.data.customerMemo ?? null,
      status: parsed.data.status,
      discountTypeCode: parsed.data.discountTypeCode ?? null,
      paymentMethodCode: parsed.data.paymentMethodCode ?? null,
      note: parsed.data.note ?? null,
      confirmationCode: parsed.data.confirmationCode ?? null
    };

    const updateResult = await tx.serviceCall.updateMany({
      where: { id: parsed.data.serviceCallId, operatingMonthId: parsed.data.operatingMonthId },
      data
    });
    if (updateResult.count !== 1) {
      throw new ServiceCallDomainError("콜 원장 행을 찾을 수 없습니다.", "SERVICE_CALL_NOT_FOUND");
    }

    await Promise.all([
      writeAssignment(tx, {
        serviceCallId: parsed.data.serviceCallId,
        assignmentRole: "THERAPIST_1",
        employeeId: parsed.data.therapist1Id
      }),
      writeAssignment(tx, {
        serviceCallId: parsed.data.serviceCallId,
        assignmentRole: "THERAPIST_2",
        employeeId: parsed.data.therapist2Id
      }),
      writeAssignment(tx, {
        serviceCallId: parsed.data.serviceCallId,
        assignmentRole: "EARCARE",
        employeeId: parsed.data.earcareEmployeeId
      })
    ]);

    const after = await findServiceCallWithRelations(tx, parsed.data.serviceCallId);
    const beforeSnapshot = toAuditSnapshot(before);
    const afterSnapshot = toAuditSnapshot(after);

    if (before.status !== after.status) {
      await tx.serviceCallStatusHistory.create({
        data: {
          serviceCallId: after.id,
          previousStatus: before.status,
          newStatus: after.status,
          changedByAccountId: actorId
        }
      });
      await recordAuditEvent(
        {
          actorId,
          action: "service_call.status_changed",
          targetType: "service_call",
          targetId: after.id,
          beforeValue: beforeSnapshot,
          afterValue: afterSnapshot
        },
        { prismaClient: tx as any }
      );
    }

    if (hasSensitiveRowChange(before, after)) {
      await recordAuditEvent(
        {
          actorId,
          action: "service_call.row_changed",
          targetType: "service_call",
          targetId: after.id,
          beforeValue: beforeSnapshot,
          afterValue: afterSnapshot
        },
        { prismaClient: tx as any }
      );
    }

    return toRowDto(tx, after);
  });
}

async function findDailyExpenseWithRelations(tx: ServiceCallPrismaClient, id: string) {
  const record = await tx.dailyExpense.findUnique({
    where: { id },
    include: { operatingMonth: true, handledByEmployee: true }
  });

  if (!record) {
    throw new ServiceCallDomainError("일별 지출 항목을 찾을 수 없습니다.", "DAILY_EXPENSE_NOT_FOUND");
  }

  return record;
}

function assertActiveDailyExpense(record: DailyExpenseRecord) {
  if (!record.isActive) {
    throw new ServiceCallDomainError("비활성 지출 항목은 수정할 수 없습니다.", "DAILY_EXPENSE_NOT_ACTIVE");
  }
}

function requireActor(actorId: string | null | undefined) {
  const id = actorId?.trim();
  if (!id) {
    throw new ServiceCallDomainError("저장 행위자를 확인할 수 없습니다.", "ACTOR_REQUIRED");
  }
  return id;
}

export async function createDailyExpense(input: DailyExpenseInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = dailyExpenseInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "일별 지출 입력값이 올바르지 않습니다.", "INVALID_DAILY_EXPENSE_INPUT");
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const { serviceDate } = await assertWritableDate(tx, {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.expenseDate
    });
    await assertActiveExpenseHandler(tx, parsed.data.handledByEmployeeId);

    const record = await tx.dailyExpense.create({
      data: {
        operatingMonthId: parsed.data.operatingMonthId,
        expenseDate: serviceDate,
        amount: parsed.data.amount,
        description: parsed.data.description,
        handledByEmployeeId: parsed.data.handledByEmployeeId,
        note: parsed.data.note ?? null,
        isActive: true
      },
      include: { handledByEmployee: true }
    });

    await recordAuditEvent(
      {
        actorId,
        action: "daily_expense.created",
        targetType: "daily_expense",
        targetId: record.id,
        beforeValue: null,
        afterValue: toDailyExpenseAuditSnapshot(record)
      },
      { prismaClient: tx as any }
    );

    return toDailyExpenseDto(record);
  });
}

export async function updateDailyExpense(input: DailyExpenseUpdateInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = dailyExpenseUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "일별 지출 입력값이 올바르지 않습니다.", "INVALID_DAILY_EXPENSE_INPUT");
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const before = await findDailyExpenseWithRelations(tx, parsed.data.dailyExpenseId);
    assertActiveDailyExpense(before);
    await assertWritableDate(tx, {
      operatingMonthId: before.operatingMonthId,
      serviceDate: toIsoDateOnly(before.expenseDate)
    });
    const { serviceDate } = await assertWritableDate(tx, {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.expenseDate
    });
    await assertActiveExpenseHandler(tx, parsed.data.handledByEmployeeId);

    const updateResult = await tx.dailyExpense.updateMany({
      where: { id: parsed.data.dailyExpenseId, operatingMonthId: parsed.data.operatingMonthId, isActive: true },
      data: {
        expenseDate: serviceDate,
        amount: parsed.data.amount,
        description: parsed.data.description,
        handledByEmployeeId: parsed.data.handledByEmployeeId,
        note: parsed.data.note ?? null
      }
    });
    if (updateResult.count !== 1) {
      throw new ServiceCallDomainError("일별 지출 항목을 찾을 수 없습니다.", "DAILY_EXPENSE_NOT_FOUND");
    }

    const after = await findDailyExpenseWithRelations(tx, parsed.data.dailyExpenseId);
    await recordAuditEvent(
      {
        actorId,
        action: "daily_expense.changed",
        targetType: "daily_expense",
        targetId: after.id,
        beforeValue: toDailyExpenseAuditSnapshot(before),
        afterValue: toDailyExpenseAuditSnapshot(after)
      },
      { prismaClient: tx as any }
    );

    return toDailyExpenseDto(after);
  });
}

export async function deactivateDailyExpense(input: DailyExpenseDeactivateInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = dailyExpenseDeactivateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "일별 지출 입력값이 올바르지 않습니다.", "INVALID_DAILY_EXPENSE_INPUT");
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const before = await findDailyExpenseWithRelations(tx, parsed.data.dailyExpenseId);
    assertActiveDailyExpense(before);
    await assertWritableDate(tx, {
      operatingMonthId: before.operatingMonthId,
      serviceDate: toIsoDateOnly(before.expenseDate)
    });

    const updateResult = await tx.dailyExpense.updateMany({
      where: { id: before.id, operatingMonthId: before.operatingMonthId, isActive: true },
      data: { isActive: false }
    });
    if (updateResult.count !== 1) {
      throw new ServiceCallDomainError("일별 지출 항목을 찾을 수 없습니다.", "DAILY_EXPENSE_NOT_FOUND");
    }

    const after = await findDailyExpenseWithRelations(tx, before.id);
    await recordAuditEvent(
      {
        actorId,
        action: "daily_expense.deactivated",
        targetType: "daily_expense",
        targetId: after.id,
        beforeValue: toDailyExpenseAuditSnapshot(before),
        afterValue: toDailyExpenseAuditSnapshot(after)
      },
      { prismaClient: tx as any }
    );

    return toDailyExpenseDto(after);
  });
}

export async function listDailyExpensesForDate(input: {
  operatingMonthId: string;
  expenseDate: string;
  prismaClient?: ServiceCallPrismaClient;
}) {
  const parsed = dailyExpenseInputSchema.pick({ operatingMonthId: true, expenseDate: true }).safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "일별 지출 조회 조건이 올바르지 않습니다.", "INVALID_DAILY_EXPENSE_QUERY");
  }

  const client = getClient(input.prismaClient);
  const records = await client.dailyExpense.findMany({
    where: {
      operatingMonthId: parsed.data.operatingMonthId,
      expenseDate: toDateOnly(parsed.data.expenseDate),
      isActive: true
    },
    include: { handledByEmployee: true },
    orderBy: [{ createdAt: "asc" }]
  });

  return records.map(toDailyExpenseDto);
}

function emptyCourseSummaries(): DailyCourseSummaryDto[] {
  return (["A", "B", "C", "D", "E"] as const).map((courseCode) => ({
    courseCode,
    completedCount: 0,
    discountCount: 0,
    therapistAssignmentCount: 0
  }));
}

export async function getDailyCallLedgerSummary(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<DailyCallLedgerSummaryDto> {
  const rows = await listServiceCallsForDate(input);
  const expenses = await listDailyExpensesForDate({
    operatingMonthId: input.operatingMonthId,
    expenseDate: input.serviceDate,
    prismaClient: input.prismaClient
  });
  const courseSummaries = emptyCourseSummaries();
  const courseSummaryByCode = new Map(courseSummaries.map((summary) => [summary.courseCode, summary]));
  const paymentMethodTotals: DailyCallLedgerSummaryDto["paymentMethodTotals"] = {
    cash: 0,
    card: 0,
    bank: 0,
    other: 0
  };

  let paymentTotal = 0;
  let therapistCommissionTotal = 0;
  let earcarePoolTotal = 0;
  let discountTotal = 0;
  const warningCounts = {
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0
  };

  for (const row of rows) {
    if (row.calculationStatus === "course_policy_missing") warningCounts.coursePolicyMissing += 1;
    if (row.calculationStatus === "therapist_rate_missing") warningCounts.therapistRateMissing += 1;
    if (row.calculationStatus === "second_therapist_required") warningCounts.secondTherapistRequired += 1;

    if (row.calculationStatus !== "calculated") {
      continue;
    }

    paymentTotal += row.paymentAmount;
    discountTotal += row.discountAmount;
    paymentMethodTotals[paymentMethodBucket(row.paymentMethodCode)] += row.paymentAmount;

    if (!isCompletedServiceCallStatus(row.status)) {
      continue;
    }

    therapistCommissionTotal += row.therapist1Commission + row.therapist2Commission;
    earcarePoolTotal += row.earcarePoolAmount;

    const courseSummary = courseSummaryByCode.get(row.courseCode as DailyCourseSummaryDto["courseCode"]);
    if (courseSummary) {
      courseSummary.completedCount += 1;
      courseSummary.discountCount += row.discountAmount > 0 ? 1 : 0;
      courseSummary.therapistAssignmentCount += (row.therapist1 ? 1 : 0) + (row.therapist2 ? 1 : 0);
    }
  }

  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  return {
    reservationCount: rows.length,
    inUseCount: rows.filter((row) => isInUseStatus(row.status)).length,
    cleaningCount: rows.filter((row) => isCleaningStatus(row.status)).length,
    completedCount: rows.filter((row) => isCompletedServiceCallStatus(row.status)).length,
    noShowCount: rows.filter((row) => isNoShowStatus(row.status)).length,
    canceledCount: rows.filter((row) => isCanceledStatus(row.status)).length,
    paymentTotal,
    therapistCommissionTotal,
    earcarePoolTotal,
    discountTotal,
    expenseTotal,
    netSales: paymentTotal - expenseTotal,
    paymentMethodTotals,
    courseSummaries,
    warningCounts
  };
}

export function completedServiceCallCalculationsFromRows(rows: ServiceCallRowDto[]): CompletedServiceCallCalculationDto[] {
  return rows
    .filter((row) => row.calculationStatus === "calculated" && isCompletedServiceCallStatus(row.status))
    .map((row) => ({
      serviceCallId: row.id,
      serviceDate: row.serviceDate,
      courseId: row.courseId,
      courseCode: row.courseCode,
      basePrice: row.basePrice,
      paymentAmount: row.paymentAmount,
      discountAmount: row.discountAmount,
      earcarePoolAmount: row.earcarePoolAmount,
      opsCallCredit: row.opsCallCredit,
      therapistAssignments: [
        ...(row.therapist1
          ? [
              {
                role: "THERAPIST_1" as const,
                employeeId: row.therapist1.id,
                commissionAmount: row.therapist1Commission
              }
            ]
          : []),
        ...(row.therapist2
          ? [
              {
                role: "THERAPIST_2" as const,
                employeeId: row.therapist2.id,
                commissionAmount: row.therapist2Commission
              }
            ]
          : [])
      ]
    }));
}

export function redactServiceCallSettlementAmounts(row: ServiceCallRowDto): ServiceCallRowDto {
  return {
    ...row,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 0
  };
}

export async function listCompletedServiceCallCalculationsForDate(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<CompletedServiceCallCalculationDto[]> {
  const rows = await listServiceCallsForDate(input);
  return completedServiceCallCalculationsFromRows(rows);
}

export async function listCompletedServiceCallCalculationsForOperatingMonth(input: {
  operatingMonthId: string;
  startDate: string;
  endDate: string;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<CompletedServiceCallCalculationDto[]> {
  const rows = await listServiceCallsForOperatingMonth(input);
  return completedServiceCallCalculationsFromRows(rows);
}

export async function listServiceCallStatusHistory(
  serviceCallId: string,
  input: { prismaClient?: ServiceCallPrismaClient } = {}
) {
  const id = serviceCallId.trim();
  if (!id) {
    throw new ServiceCallDomainError("콜 행 ID가 올바르지 않습니다.", "SERVICE_CALL_ID_REQUIRED");
  }

  const client = getClient(input.prismaClient);
  const records = await client.serviceCallStatusHistory.findMany({
    where: { serviceCallId: id },
    orderBy: { changedAt: "asc" }
  });

  return records.map(toHistoryDto);
}

export async function listServiceCallFormOptions(input: { operatingMonthId?: string; prismaClient?: ServiceCallPrismaClient } = {}) {
  const client = getClient(input.prismaClient);
  const operatingMonths = await client.operatingMonth.findMany({ orderBy: [{ monthKey: "desc" }, { createdAt: "desc" }] });
  const selectedMonth = input.operatingMonthId
    ? operatingMonths.find((month) => month.id === input.operatingMonthId)
    : operatingMonths[0];
  const monthKey = selectedMonth?.monthKey;

  const [rooms, timeSlots, courses, statuses, discountTypes, paymentMethods, confirmationCodes, therapists, earcareEmployees, expenseHandlers] = await Promise.all([
    listActiveRooms({ prismaClient: client as any }),
    listActiveTimeSlots({ prismaClient: client as any }),
    monthKey ? listActiveCourses({ monthKey, prismaClient: client as any }) : Promise.resolve([]),
    listActiveCodeItems({ codeType: "SERVICE_STATUS", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "DISCOUNT_TYPE", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "PAYMENT_METHOD", prismaClient: client as any }),
    listActiveCodeItems({ codeType: "CONFIRMATION", prismaClient: client as any }),
    listActiveEmployees({ employeeGroup: "THERAPIST", prismaClient: client as any }),
    listActiveEmployees({ employeeGroup: "EARCARE", prismaClient: client as any }),
    listActiveEmployees({ prismaClient: client as any })
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
    earcareEmployees: earcareEmployees.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`)),
    expenseHandlers: expenseHandlers.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`))
  } satisfies ServiceCallFormOptions;
}
