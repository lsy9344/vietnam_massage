import { prisma } from "@/lib/prisma";
import { BUSINESS_TIME_ZONE_OFFSET_MINUTES } from "@/lib/business-time";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { codeLabel } from "@/lib/i18n/codes";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { assertOperatingMonthPayoutWritable } from "@/modules/closing/month-lock-guard";
import { listActiveCodeItems, listActiveTimeSlots } from "@/modules/masters/code-service";
import { listActiveCourses } from "@/modules/masters/course-service";
import { listActiveEmployees } from "@/modules/masters/employee-service";
import { listActiveRooms } from "@/modules/masters/room-service";
import { listPlannedWorkingDayStatusesForDate, type PlannedWorkingDayCellStatus } from "@/modules/settlements/schedule-service";
import {
  assignmentRoles,
  customerInputSchema,
  customerUpdateSchema,
  dailyExpenseDeactivateSchema,
  dailyExpenseInputSchema,
  dailyExpenseUpdateSchema,
  savedVersionMessage,
  serviceCallAutosaveInputSchema,
  serviceCallCreateInputSchema,
  serviceCallCustomerLinkCorrectionSchema,
  serviceCallInputSchema,
  type CustomerInput,
  type CustomerUpdateInput,
  type DailyExpenseDeactivateInput,
  type DailyExpenseInput,
  type DailyExpenseUpdateInput,
  type ServiceCallAssignmentRole,
  type ServiceCallAutosaveInput,
  type ServiceCallCreateInput,
  type ServiceCallCustomerLinkCorrectionInput,
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
  sortOrder?: number;
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
  method?: string | null;
  handledByEmployeeId: string;
  handledByEmployee?: EmployeeRecord;
  note: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  preferenceNote: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ServiceCallRecord = {
  id: string;
  operatingMonthId: string;
  operatingMonth?: OperatingMonthRecord;
  serviceDate: Date;
  startTime: string;
  actualEntryTime?: string | null;
  roomId: string | null;
  room?: RoomRecord | null;
  courseId: string;
  course?: CourseRecord;
  customerId?: string | null;
  customerMemo: string | null;
  status: string;
  discountTypeCode: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  visitRequest: string | null;
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
  customer: {
    create(args: unknown): Promise<CustomerRecord>;
    findMany(args?: unknown): Promise<CustomerRecord[]>;
    findUnique(args: unknown): Promise<CustomerRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  therapistAttendance: {
    findMany(args?: unknown): Promise<TherapistAttendanceRecord[]>;
  };
  // listPlannedWorkingDayStatusesForDate(settlements/schedule-service.ts)가 요구하는 좁은 모양만 둔다. 실제로는
  // 같은 prisma 클라이언트라 근무표 서비스가 이 콜 테이블 조회와 함께 근무표 테이블을 읽을 수 있다(티켓 29).
  plannedWorkingDay: {
    findMany(args?: unknown): Promise<Array<{ employeeId: string; planStatus: string }>>;
  };
  $transaction?<T>(callback: (tx: ServiceCallPrismaClient) => Promise<T>): Promise<T>;
};

type TherapistAttendanceRecord = {
  employeeId: string;
  operatingMonthId: string;
  attendanceDate: Date;
  checkOutMinute: number | null;
  isActive: boolean;
};

export type CustomerDto = {
  id: string;
  name: string;
  phone: string | null;
  memo: string | null;
  /** 고객 공통 선호·주의사항(F06, 티켓 23). memo(고객 메모)와는 다른 칸이다. */
  preferenceNote: string | null;
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

/**
 * 원장 행 경고 코드. 배열 순서가 곧 우선순위다(스펙 B02): 앞 시술 미완료 → 객실 겹침 → 양보 → 계산 오류.
 */
export const CALL_ROW_WARNING_ORDER = [
  "previous_service_unfinished",
  "room_overlap",
  "yield_to_reservation",
  "calculation_error"
] as const;

export type CallRowWarningCode = (typeof CALL_ROW_WARNING_ORDER)[number];

export type CallRowWarningDto = {
  code: CallRowWarningCode;
  /** 경고가 말하는 시각(HH:mm). 앞 시술 미완료는 앞 콜의 표시 종료, 객실 겹침은 가장 이른 상대의 예약시각, 양보는 다음 예약시각. */
  relatedTime: string | null;
  relatedCallIds: string[];
};

export type ServiceCallRowDto = {
  id: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  actualEntryTime: string | null;
  displayEnd: string;
  warningTime: string | null;
  /** 우선순위 순서의 경고 목록. 비어 있으면 경고가 없다. */
  warnings: CallRowWarningDto[];
  roomId: string | null;
  roomLabel: string;
  courseId: string;
  courseCode: string;
  courseLabel: string;
  customerId: string | null;
  customerMemo: string | null;
  therapist1: ServiceCallAssigneeDto | null;
  therapist2: ServiceCallAssigneeDto | null;
  earcare: ServiceCallAssigneeDto | null;
  status: string;
  discountTypeCode: string | null;
  paymentMethodCode: string | null;
  note: string | null;
  /** 이번 콜의 방문별 요청(F06, 티켓 23). note(비고)와는 다른 칸이다. */
  visitRequest: string | null;
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

export type ExpenseMethod = "cash" | "bank";

export type DailyExpenseDto = {
  id: string;
  operatingMonthId: string;
  expenseDate: string;
  amount: number;
  method: ExpenseMethod;
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

export type TillBalanceDto = {
  cashReceipts: number;
  cashExpenses: number;
  cashBalance: number;
  bankReceipts: number;
  bankExpenses: number;
  bankBalance: number;
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
  till: {
    day: TillBalanceDto;
    month: TillBalanceDto;
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

// rate_missing: 이 운영월에 유효한 수당이 없다(두 명 코스는 수당을 가진 다른 활성 Therapist도 없다). 시간보다 앞선다.
// time_short: 수당은 있으나 이 Therapist나 수당을 가진 짝이 코스 길이만큼 비어 있지 않다.
export type TherapistAvailabilityCourseVerdict = "possible" | "time_short" | "rate_missing";

export type TherapistAvailabilityCourseDto = {
  courseId: string;
  courseCode: string;
  courseName: string;
  durationMinutes: number;
  verdict: TherapistAvailabilityCourseVerdict;
  // 코스 정책상 두 번째 Therapist가 필요한지(티켓 21). 빠른 예약 패널이 두 번째 Therapist 선택을 보일지 정한다.
  requiresSecondTherapist: boolean;
};

export type TherapistAvailabilityRowDto = {
  therapistId: string;
  therapistName: string;
  // 그날의 출근 기록: 없으면 출근 전, 퇴근 시각이 없으면 출근, 있으면 퇴근(현재 퇴근). 판정과 코스 버튼은 바꾸지 않는다.
  attendance: "before_check_in" | "checked_in" | "checked_out";
  // 고른 날짜가 오늘이고 고른 시각이 지금보다 30분을 넘겨 뒤인데 출근 상태가 아니다.
  shiftCheck: boolean;
  available: boolean;
  // 불가 사유. in_service_past_display_end는 예약 점유가 아니라 추가 점유만으로 불가가 된 경우다.
  unavailableReason: "booked" | "in_service_past_display_end" | null;
  inServiceDisplayEnd: string | null;
  freeFrom: string | null;
  nextReservationTime: string | null;
  freeMinutes: number | null;
  // 오늘 표시 종료를 넘긴 사용중 콜이 있다: 가능 후보는 시간표상 가능일 뿐 앞 시술 종료 확인이 필요하다.
  priorServiceEndCheck: boolean;
  // 근무표(27)에 적힌 그날의 근무 예정. 실제 출근(attendance)과는 다른 테이블이라 서로 다른 값일 수 있고,
  // 가능 판정·코스 버튼을 바꾸지 않는 안내일 뿐이다(스토리 12–13, 60, 104, V07).
  plannedWorkingDayStatus: PlannedWorkingDayCellStatus;
  courses: TherapistAvailabilityCourseDto[];
};

export class ServiceCallDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "ServiceCallDomainError";
  }
}

/**
 * 오래된 저장(STALE_CALL). 화면이 읽은 뒤에 다른 저장이 먼저 들어왔다. 아무것도 쓰지 않았고,
 * 화면이 다시 불러올 수 있게 지금의 행(currentRow)을 함께 돌려준다.
 */
export class StaleServiceCallError extends ServiceCallDomainError {
  constructor(public readonly currentRow: ServiceCallRowDto) {
    super("다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.", "STALE_CALL");
    this.name = "StaleServiceCallError";
  }
}

function isCompletedServiceCallStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function isReservationStatus(status: string) {
  return status === "예약" || status === "RESERVED";
}

export const IN_USE_SERVICE_CALL_STATUSES: readonly string[] = ["사용중", "IN_USE", "USING"];

function isInUseStatus(status: string) {
  return IN_USE_SERVICE_CALL_STATUSES.includes(status);
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

function recognizesRevenue(record: { status: string; paymentMethodCode: string | null }) {
  // REQ-007 선결제: 매출 반영 단일 기준은 "결제수단 선택 시점"이다.
  // - 취소/노쇼는 결제수단이 남아 있어도 매출에서 즉시 제외한다(차감 정책).
  // - 결제수단을 고른 순간부터(예약/사용중 등 방문완료 이전이라도) 선결제 매출로 반영한다.
  // - 결제수단이 비어 있으면 "사용중"이어도 매출에 잡지 않아 "기타" 버킷 오염을 막는다.
  if (isNoShowStatus(record.status) || isCanceledStatus(record.status)) {
    return false;
  }

  return Boolean(record.paymentMethodCode);
}

function requiresCalculation(record: { status: string; paymentMethodCode: string | null }) {
  return recognizesRevenue(record) || isCompletedServiceCallStatus(record.status);
}

function storedExpenseMethod(method: string | null | undefined): ExpenseMethod {
  return method === "bank" ? "bank" : "cash";
}

function emptyTill(): TillBalanceDto {
  return {
    cashReceipts: 0,
    cashExpenses: 0,
    cashBalance: 0,
    bankReceipts: 0,
    bankExpenses: 0,
    bankBalance: 0
  };
}

function tillFromReceipts(
  receipts: { cash: number; bank: number },
  expenses: Array<{ amount: number; method?: string | null }>
): TillBalanceDto {
  let cashExpenses = 0;
  let bankExpenses = 0;
  for (const expense of expenses) {
    if (storedExpenseMethod(expense.method) === "bank") bankExpenses += expense.amount;
    else cashExpenses += expense.amount;
  }
  return {
    cashReceipts: receipts.cash,
    cashExpenses,
    cashBalance: receipts.cash - cashExpenses,
    bankReceipts: receipts.bank,
    bankExpenses,
    bankBalance: receipts.bank - bankExpenses
  };
}

function recognizedReceipts(rows: ServiceCallRowDto[]) {
  const totals = { cash: 0, bank: 0 };
  for (const row of rows) {
    if (row.calculationStatus !== "calculated" || !recognizesRevenue(row)) continue;
    const bucket = paymentMethodBucket(row.paymentMethodCode);
    if (bucket === "cash" || bucket === "bank") totals[bucket] += row.paymentAmount;
  }
  return totals;
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

// 목록 조회는 행마다 정책/수당을 다시 조회하면 하루치만으로도 수십 번의 DB 왕복이 생긴다.
// 배치 조회 결과를 이 묶음으로 넘겨 행 단위 조회를 없앤다. 단건 저장 경로는 넘기지 않으므로
// 기존처럼 그때그때 조회한다.
type ServiceCallCalculationSources = {
  policiesByCourseId: Map<string, CoursePolicyRecord[]>;
  ratesByTherapistCourse: Map<string, TherapistCourseRateRecord[]>;
};

function rateSourceKey(therapistId: string, courseId: string) {
  return `${therapistId}::${courseId}`;
}

async function prefetchCalculationSources(
  tx: ServiceCallPrismaClient,
  records: ServiceCallRecord[]
): Promise<ServiceCallCalculationSources> {
  const courseIdsWithoutPolicy = new Set<string>();
  const therapistIds = new Set<string>();
  const rateCourseIds = new Set<string>();

  for (const record of records) {
    if (!requiresCalculation(record)) continue;
    const monthKey = record.operatingMonth?.monthKey;
    if (!monthKey) continue;
    if (!record.course || !firstCurrentPolicy(record.course, monthKey)) {
      courseIdsWithoutPolicy.add(record.courseId);
    }
    if (!isCompletedServiceCallStatus(record.status)) continue;
    for (const role of ["THERAPIST_1", "THERAPIST_2"] as const) {
      const assignment = assignmentByRole(record, role);
      if (!assignment) continue;
      therapistIds.add(assignment.employeeId);
      rateCourseIds.add(record.courseId);
    }
  }

  const [policies, rates] = await Promise.all([
    courseIdsWithoutPolicy.size === 0
      ? Promise.resolve([] as CoursePolicyRecord[])
      : tx.coursePolicy.findMany({ where: { courseId: { in: [...courseIdsWithoutPolicy] }, isActive: true } }),
    therapistIds.size === 0 || rateCourseIds.size === 0
      ? Promise.resolve([] as TherapistCourseRateRecord[])
      : tx.therapistCourseRate.findMany({
          where: { therapistId: { in: [...therapistIds] }, courseId: { in: [...rateCourseIds] }, isActive: true }
        })
  ]);

  const policiesByCourseId = new Map<string, CoursePolicyRecord[]>();
  for (const policy of policies) {
    const current = policiesByCourseId.get(policy.courseId) ?? [];
    current.push(policy);
    policiesByCourseId.set(policy.courseId, current);
  }
  return { policiesByCourseId, ratesByTherapistCourse: groupRatesByTherapistCourse(rates) };
}

function groupRatesByTherapistCourse(rates: TherapistCourseRateRecord[]) {
  const ratesByTherapistCourse = new Map<string, TherapistCourseRateRecord[]>();
  for (const rate of rates) {
    const key = rateSourceKey(rate.therapistId, rate.courseId);
    const current = ratesByTherapistCourse.get(key) ?? [];
    current.push(rate);
    ratesByTherapistCourse.set(key, current);
  }
  return ratesByTherapistCourse;
}

async function findCoursePolicyForCalculation(
  tx: ServiceCallPrismaClient,
  record: ServiceCallRecord,
  monthKey: string,
  sources?: ServiceCallCalculationSources
) {
  const includedPolicy = record.course ? firstCurrentPolicy(record.course, monthKey) : null;
  if (includedPolicy) {
    return includedPolicy;
  }

  const policies = sources
    ? sources.policiesByCourseId.get(record.courseId) ?? []
    : await tx.coursePolicy.findMany({ where: { courseId: record.courseId, isActive: true } });
  return [...policies]
    .filter((policy) => effectiveForMonth(policy, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0] ?? null;
}

async function findTherapistCourseRateForCalculation(
  tx: ServiceCallPrismaClient,
  input: { therapistId: string; courseId: string; monthKey: string },
  sources?: ServiceCallCalculationSources
) {
  const rates = sources
    ? sources.ratesByTherapistCourse.get(rateSourceKey(input.therapistId, input.courseId)) ?? []
    : await tx.therapistCourseRate.findMany({
        where: { therapistId: input.therapistId, courseId: input.courseId, isActive: true }
      });
  return firstCurrentRate(rates, input.monthKey) ?? null;
}

async function calculateServiceCallCompletion(
  tx: ServiceCallPrismaClient,
  record: ServiceCallRecord,
  sources?: ServiceCallCalculationSources
) {
  if (!requiresCalculation(record)) {
    return emptyCalculation("not_completed");
  }

  const monthKey = record.operatingMonth?.monthKey;
  if (!monthKey) {
    return emptyCalculation("course_policy_missing", {
      code: "OPERATING_MONTH_NOT_FOUND",
      message: "운영월을 찾을 수 없어 계산할 수 없습니다."
    });
  }

  const policy = await findCoursePolicyForCalculation(tx, record, monthKey, sources);
  if (!policy) {
    return emptyCalculation("course_policy_missing", {
      code: "COURSE_POLICY_NOT_FOUND",
      message: "선택 운영월에 적용되는 코스 정책이 없습니다."
    });
  }

  const hasRevenue = recognizesRevenue(record);
  const discountAmount = hasRevenue && record.discountTypeCode !== null ? 100000 : 0;
  const baseCalculation = {
    basePrice: policy.basePrice,
    paymentAmount: hasRevenue ? Math.max(policy.basePrice - discountAmount, 0) : 0,
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
    const rate = await findTherapistCourseRateForCalculation(
      tx,
      { therapistId: therapist1.employeeId, courseId: record.courseId, monthKey },
      sources
    );
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
    const rate = await findTherapistCourseRateForCalculation(
      tx,
      { therapistId: therapist2.employeeId, courseId: record.courseId, monthKey },
      sources
    );
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

async function toRowDto(
  tx: ServiceCallPrismaClient,
  record: ServiceCallRecord,
  sources?: ServiceCallCalculationSources,
  displayContext?: DisplayEndContext,
  now: Date = new Date()
): Promise<ServiceCallRowDto> {
  const operatingMonth = record.operatingMonth;
  const course = record.course;
  const policy = operatingMonth && course ? firstCurrentPolicy(course, operatingMonth.monthKey) : null;
  const therapist1 = assignmentByRole(record, "THERAPIST_1")?.employee ?? null;
  const therapist2 = assignmentByRole(record, "THERAPIST_2")?.employee ?? null;
  const earcare = assignmentByRole(record, "EARCARE")?.employee ?? null;
  const calculation = await calculateServiceCallCompletion(tx, record, sources);
  const context = displayContext ?? (await displayEndContextFor(tx, record));
  const display = deriveDisplayEnd(record, context);

  return {
    id: record.id,
    operatingMonthId: record.operatingMonthId,
    serviceDate: toIsoDateOnly(record.serviceDate),
    startTime: record.startTime,
    actualEntryTime: display.actualEntryTime,
    displayEnd: display.displayEnd,
    warningTime: display.warningTime,
    warnings: deriveRowWarnings(record, context, display, calculation.calculationStatus, now),
    roomId: record.roomId,
    roomLabel: record.room?.displayName ?? "미배정",
    courseId: record.courseId,
    courseCode: course?.code ?? "",
    courseLabel: policy ? `${course?.code ?? ""} ${policy.name}`.trim() : record.courseId,
    customerId: linkedCustomerId(record),
    customerMemo: record.customerMemo,
    therapist1: therapist1 ? toAssigneeDto(therapist1) : null,
    therapist2: therapist2 ? toAssigneeDto(therapist2) : null,
    earcare: earcare ? toAssigneeDto(earcare) : null,
    status: record.status,
    discountTypeCode: record.discountTypeCode,
    paymentMethodCode: record.paymentMethodCode,
    note: record.note,
    visitRequest: record.visitRequest,
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

/**
 * 기존 행을 화면이 읽은 버전(expectedUpdatedAt)일 때만 고친다. 버전 확인과 쓰기가 한 번의 조건부 갱신이라
 * 그 사이에 다른 저장이 끼어들 수 없다. 고친 행이 없으면 행이 없는지, 다른 저장이 먼저 들어왔는지 가린다.
 */
async function updateServiceCallAtVersion(
  tx: ServiceCallPrismaClient,
  target: { serviceCallId: string; operatingMonthId: string; expectedUpdatedAt: string },
  data: Record<string, unknown>
) {
  const updateResult = await tx.serviceCall.updateMany({
    where: { id: target.serviceCallId, operatingMonthId: target.operatingMonthId, updatedAt: new Date(target.expectedUpdatedAt) },
    data
  });
  if (updateResult.count === 1) {
    return;
  }

  const current = await findServiceCallWithRelations(tx, target.serviceCallId);
  if (current.operatingMonthId !== target.operatingMonthId) {
    throw new ServiceCallDomainError("콜 원장 행을 찾을 수 없습니다.", "SERVICE_CALL_NOT_FOUND");
  }
  throw new StaleServiceCallError(await toRowDto(tx, current));
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
    actualEntryTime: storedActualEntryTime(record),
    roomId: record.roomId,
    courseId: record.courseId,
    customerId: linkedCustomerId(record),
    customerMemo: record.customerMemo,
    status: record.status,
    discountTypeCode: record.discountTypeCode,
    paymentMethodCode: record.paymentMethodCode,
    note: record.note,
    visitRequest: record.visitRequest,
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
    method: storedExpenseMethod(record.method),
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
    method: storedExpenseMethod(record.method),
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
    assignmentEmployeeId(before, "EARCARE") !== assignmentEmployeeId(after, "EARCARE") ||
    linkedCustomerId(before) !== linkedCustomerId(after) ||
    storedActualEntryTime(before) !== storedActualEntryTime(after)
  );
}

function linkedCustomerId(record: { customerId?: string | null }) {
  return record.customerId ?? null;
}

function toCustomerDto(record: CustomerRecord): CustomerDto {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    memo: record.memo,
    preferenceNote: record.preferenceNote
  };
}

function toCustomerAuditSnapshot(record: CustomerRecord): AuditJsonSnapshot {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    memo: record.memo,
    preferenceNote: record.preferenceNote
  };
}

async function requireCustomer(tx: ServiceCallPrismaClient, customerId: string) {
  const customer = await tx.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    throw new ServiceCallDomainError("고객을 찾을 수 없습니다.", "CUSTOMER_NOT_FOUND");
  }
  return customer;
}

// A phone number never selects a customer. Only an id the caller chose is stored.
async function resolveLinkedCustomerId(
  tx: ServiceCallPrismaClient,
  requested: string | null | undefined,
  existing: string | null | undefined
) {
  if (requested === undefined) {
    return existing ?? null;
  }
  if (!requested) {
    return null;
  }
  const customer = await requireCustomer(tx, requested);
  return customer.id;
}

export async function listServiceCallsForDate(input: {
  operatingMonthId: string;
  serviceDate: string;
  /** 앞 시술 미완료를 판정하는 지금 시각. 없으면 서버 시각이다. */
  now?: Date;
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
  const sources = await prefetchCalculationSources(client, records);
  const displayContext = { dayCalls: records, dayStart: dayStartFromSlots(timeSlots) };

  return Promise.all(
    records
      .sort((a, b) => {
        const leftOrder = sortOrderByTime.get(a.startTime) ?? 9999;
        const rightOrder = sortOrderByTime.get(b.startTime) ?? 9999;
        return leftOrder - rightOrder || a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((record) => toRowDto(client, record, sources, displayContext, input.now))
  );
}

const AVAILABILITY_DAY_MINUTES = 24 * 60;
const AVAILABILITY_DEFAULT_DAY_START = 11 * 60;
// 오늘 지금보다 이만큼을 넘겨 뒤의 시각이면 출근 상태가 아닌 Therapist에게 근무 확인 필요를 붙인다. 정확히 30분은 붙이지 않는다.
const AVAILABILITY_SHIFT_CHECK_MINUTES = 30;

function occupiesAvailability(status: string) {
  return isReservationStatus(status) || isInUseStatus(status) || isCleaningStatus(status) || isCompletedServiceCallStatus(status);
}

function clockMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

// 영업일 슬롯은 저녁을 지나 다음 달력날 새벽까지 이어진다. 첫 슬롯보다 이른 시각은 그 영업일의 뒤로 본다.
function businessMinute(value: string, dayStart: number) {
  const minutes = clockMinutes(value);
  return minutes < dayStart ? minutes + AVAILABILITY_DAY_MINUTES : minutes;
}

function formatBusinessMinute(value: number) {
  const minutes = ((value % AVAILABILITY_DAY_MINUTES) + AVAILABILITY_DAY_MINUTES) % AVAILABILITY_DAY_MINUTES;
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

const TEN_MINUTE_TIME = /^([01]\d|2[0-3]):(00|10|20|30|40|50)$/;

type DisplayEndContext = {
  dayCalls: ServiceCallRecord[];
  dayStart: number;
};

function dayStartFromSlots(slots: TimeSlotRecord[]) {
  const first = [...slots].filter((slot) => slot.isActive).sort((left, right) => left.sortOrder - right.sortOrder)[0];
  return first ? clockMinutes(first.value) : AVAILABILITY_DEFAULT_DAY_START;
}

function storedActualEntryTime(record: { actualEntryTime?: string | null }) {
  const value = record.actualEntryTime?.trim() ?? "";
  return TEN_MINUTE_TIME.test(value) ? value : null;
}

function actualEntryForWrite(requested: string | null | undefined, existing: string | null | undefined) {
  if (requested === undefined) return storedActualEntryTime({ actualEntryTime: existing });
  return requested;
}

function assignedTherapistIds(record: ServiceCallRecord) {
  const ids: string[] = [];
  for (const assignment of record.assignments ?? []) {
    if (assignment.isActive === false) continue;
    if (assignment.assignmentRole !== "THERAPIST_1" && assignment.assignmentRole !== "THERAPIST_2") continue;
    ids.push(assignment.employeeId);
  }
  return ids;
}

function courseDurationMinutes(record: ServiceCallRecord) {
  const monthKey = record.operatingMonth?.monthKey;
  if (!monthKey || !record.course) return 0;
  return firstCurrentPolicy(record.course, monthKey)?.durationMinutes ?? 0;
}

// 기준 시각은 실제입장이 있으면 그 시각이고, 없으면 예약시각이다.
// 다음 예약은 이 콜의 예약시각보다 늦은, 같은 Therapist의 콜이다. 노쇼와 취소는 빠진다.
// 그 예약시각이 제안 종료보다 먼저일 때만 양보하고, 맞닿으면 경고가 없다.
function displayEndChoice(record: ServiceCallRecord, context: DisplayEndContext) {
  const actualEntryTime = storedActualEntryTime(record);
  const reference = actualEntryTime ?? record.startTime;
  const proposed = businessMinute(reference, context.dayStart) + courseDurationMinutes(record);
  const therapists = new Set(assignedTherapistIds(record));
  const reservationStart = /^([01]\d|2[0-3]):[0-5]\d$/.test(record.startTime)
    ? businessMinute(record.startTime, context.dayStart)
    : null;
  let next: number | null = null;
  let nextIds: string[] = [];
  if (reservationStart !== null && therapists.size > 0) {
    for (const other of context.dayCalls) {
      if (other.id === record.id) continue;
      if (isNoShowStatus(other.status) || isCanceledStatus(other.status)) continue;
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(other.startTime)) continue;
      if (!assignedTherapistIds(other).some((id) => therapists.has(id))) continue;
      const start = businessMinute(other.startTime, context.dayStart);
      if (start <= reservationStart) continue;
      if (next === null || start < next) {
        next = start;
        nextIds = [other.id];
      } else if (start === next) {
        nextIds.push(other.id);
      }
    }
  }
  if (next !== null && next < proposed) {
    return { actualEntryTime, minute: next, yielded: true, yieldedToIds: nextIds };
  }
  return { actualEntryTime, minute: proposed, yielded: false, yieldedToIds: [] as string[] };
}

const CLOCK_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// 같은 날 같은 Therapist(두 배정 역할 모두)의 사용중 콜이 이 콜의 예약시각까지 끝났어야 하는데
// 지금이 그 표시 종료를 넘겼으면 앞 시술 미완료다. 이 콜의 표시 종료와 예약시각은 바꾸지 않는다.
function previousServiceUnfinished(record: ServiceCallRecord, context: DisplayEndContext, now: Date): CallRowWarningDto | null {
  if (isNoShowStatus(record.status) || isCanceledStatus(record.status)) return null;
  if (!CLOCK_TIME.test(record.startTime)) return null;
  const therapists = new Set(assignedTherapistIds(record));
  if (therapists.size === 0) return null;
  const reservationStart = businessMinute(record.startTime, context.dayStart);
  const serviceDate = toIsoDateOnly(record.serviceDate);
  const unfinished: Array<{ id: string; endMinute: number }> = [];
  for (const other of context.dayCalls) {
    if (other.id === record.id) continue;
    if (!isInUseStatus(other.status)) continue;
    if (!CLOCK_TIME.test(other.startTime)) continue;
    if (!assignedTherapistIds(other).some((id) => therapists.has(id))) continue;
    const endMinute = displayEndChoice(other, context).minute;
    if (endMinute > reservationStart) continue;
    if (now.getTime() <= instantFromBusinessMinute(serviceDate, endMinute).getTime()) continue;
    unfinished.push({ id: other.id, endMinute });
  }
  if (unfinished.length === 0) return null;
  const latestEnd = Math.max(...unfinished.map((item) => item.endMinute));
  return {
    code: "previous_service_unfinished",
    relatedTime: formatBusinessMinute(latestEnd),
    relatedCallIds: unfinished.map((item) => item.id)
  };
}

/** 객실 겹침 판정 결과. 원장 행 경고와 객실 상태 서비스가 같은 값을 쓴다(스펙 B06). */
export type RoomOverlapDto = {
  callId: string;
  roomId: string;
  /** 가장 이른 상대의 예약시각(HH:mm). */
  relatedTime: string;
  /** 겹치는 상대 콜 id 전체. 예약시각이 이른 순서다. */
  relatedCallIds: string[];
};

// 예약 점유 구간 [예약시각, 예약시각 + 코스 길이). 실제입장과 표시 종료는 쓰지 않는다.
// 노쇼, 취소, 객실이 없는 콜은 점유하지 않는다. 운영월에 유효한 코스 정책이 없으면 길이를 몰라
// 판정하지 않는다(가능 코스의 점유도 정책이 없는 콜을 세지 않는다).
function roomReservationInterval(record: ServiceCallRecord, context: DisplayEndContext) {
  if (!record.roomId) return null;
  if (isNoShowStatus(record.status) || isCanceledStatus(record.status)) return null;
  if (!CLOCK_TIME.test(record.startTime)) return null;
  const duration = courseDurationMinutes(record);
  if (duration <= 0) return null;
  const start = businessMinute(record.startTime, context.dayStart);
  return { roomId: record.roomId, start, end: start + duration };
}

// 같은 날 같은 객실의 반열린 구간이 겹치면 양쪽에 붙는다. 맞닿으면 겹치지 않는다. 어느 예약시각도 밀지 않는다.
function roomOverlapFor(record: ServiceCallRecord, context: DisplayEndContext): RoomOverlapDto | null {
  const own = roomReservationInterval(record, context);
  if (!own) return null;
  const partners: Array<{ id: string; start: number }> = [];
  for (const other of context.dayCalls) {
    if (other.id === record.id) continue;
    const interval = roomReservationInterval(other, context);
    if (!interval || interval.roomId !== own.roomId) continue;
    if (interval.start < own.end && own.start < interval.end) partners.push({ id: other.id, start: interval.start });
  }
  if (partners.length === 0) return null;
  partners.sort((left, right) => left.start - right.start || left.id.localeCompare(right.id));
  return {
    callId: record.id,
    roomId: own.roomId,
    relatedTime: formatBusinessMinute(partners[0].start),
    relatedCallIds: partners.map((partner) => partner.id)
  };
}

function deriveRowWarnings(
  record: ServiceCallRecord,
  context: DisplayEndContext,
  display: { warningTime: string | null },
  calculationStatus: ServiceCallCalculationStatus,
  now: Date
): CallRowWarningDto[] {
  const byCode = new Map<CallRowWarningCode, CallRowWarningDto>();
  const unfinished = previousServiceUnfinished(record, context, now);
  if (unfinished) byCode.set(unfinished.code, unfinished);
  const overlap = roomOverlapFor(record, context);
  if (overlap) {
    byCode.set("room_overlap", { code: "room_overlap", relatedTime: overlap.relatedTime, relatedCallIds: overlap.relatedCallIds });
  }
  const choice = displayEndChoice(record, context);
  if (choice.yielded && display.warningTime) {
    byCode.set("yield_to_reservation", {
      code: "yield_to_reservation",
      relatedTime: display.warningTime,
      relatedCallIds: choice.yieldedToIds
    });
  }
  if (isCalculationWarningStatus(calculationStatus)) {
    byCode.set("calculation_error", { code: "calculation_error", relatedTime: null, relatedCallIds: [] });
  }
  return CALL_ROW_WARNING_ORDER.flatMap((code) => byCode.get(code) ?? []);
}

function deriveDisplayEnd(record: ServiceCallRecord, context: DisplayEndContext) {
  const choice = displayEndChoice(record, context);
  const time = formatBusinessMinute(choice.minute);
  return { actualEntryTime: choice.actualEntryTime, displayEnd: time, warningTime: choice.yielded ? time : null };
}

// 영업일 분은 11:00을 0으로 두지 않고, 자정을 넘는 시각에 1440을 더해 둔 시계 분이다.
// 그 값을 하루로 나눈 몫이 서비스 날짜로부터의 달력날이다.
function instantFromBusinessMinute(serviceDate: string, minute: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(serviceDate);
  if (!match) {
    throw new ServiceCallDomainError("서비스 날짜 형식이 올바르지 않습니다.", "INVALID_SERVICE_CALL_QUERY");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dayOffset = Math.floor(minute / AVAILABILITY_DAY_MINUTES);
  const within = ((minute % AVAILABILITY_DAY_MINUTES) + AVAILABILITY_DAY_MINUTES) % AVAILABILITY_DAY_MINUTES;
  const hour = Math.floor(within / 60);
  const min = within % 60;
  const utcMillis =
    Date.UTC(year, month - 1, day + dayOffset, hour, min, 0, 0) - BUSINESS_TIME_ZONE_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMillis);
}

type DisplayEndReadClient = {
  serviceCall: { findMany(args?: unknown): Promise<unknown[]> };
  timeSlot: { findMany(args?: unknown): Promise<unknown[]> };
};

async function loadDisplayEndContext(
  tx: DisplayEndReadClient,
  where: { operatingMonthId: string; serviceDate: Date }
): Promise<DisplayEndContext> {
  const [dayCalls, slots] = await Promise.all([
    tx.serviceCall.findMany({
      where,
      include: {
        operatingMonth: true,
        course: { include: { policies: true } },
        assignments: true
      }
    }) as Promise<ServiceCallRecord[]>,
    tx.timeSlot.findMany({}) as Promise<TimeSlotRecord[]>
  ]);
  return { dayCalls, dayStart: dayStartFromSlots(slots) };
}

type DayFactsInput = {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: DisplayEndReadClient;
};

/**
 * 객실 상태 서비스가 쓰는 그 날짜의 표시 종료와 객실 겹침. 콜을 한 번 읽어 둘 다 판정한다.
 * 겹침은 원장 행의 room_overlap 경고와 같은 판정이며, 겹침이 없는 콜은 roomOverlaps에서 빠진다.
 * roomOverlaps는 영업일 예약시각 순서다(첫 슬롯보다 이른 시각은 그날의 뒤). 소비자는 이 순서를 그대로 쓴다.
 */
export async function roomFloorFactsForDate(
  input: DayFactsInput
): Promise<{ displayEnds: Map<string, Date>; roomOverlaps: Map<string, RoomOverlapDto> }> {
  const client = input.prismaClient ?? getClient();
  const context = await loadDisplayEndContext(client, {
    operatingMonthId: input.operatingMonthId,
    serviceDate: toDateOnly(input.serviceDate)
  });
  const displayEnds = new Map<string, Date>();
  const roomOverlaps = new Map<string, RoomOverlapDto>();
  for (const record of context.dayCalls) {
    displayEnds.set(record.id, instantFromBusinessMinute(input.serviceDate, displayEndChoice(record, context).minute));
  }
  const byReservation = context.dayCalls
    .map((record) => ({ record, interval: roomReservationInterval(record, context) }))
    .filter((entry): entry is { record: ServiceCallRecord; interval: NonNullable<typeof entry.interval> } => entry.interval !== null)
    .sort((left, right) => left.interval.start - right.interval.start || left.record.id.localeCompare(right.record.id));
  for (const { record } of byReservation) {
    const overlap = roomOverlapFor(record, context);
    if (overlap) roomOverlaps.set(record.id, overlap);
  }
  return { displayEnds, roomOverlaps };
}

async function displayEndContextFor(tx: ServiceCallPrismaClient, record: ServiceCallRecord): Promise<DisplayEndContext> {
  return loadDisplayEndContext(tx, {
    operatingMonthId: record.operatingMonthId,
    serviceDate: record.serviceDate
  });
}

function currentPolicyForCourse(policies: CoursePolicyRecord[], courseId: string, monthKey: string) {
  return policies
    .filter((policy) => policy.courseId === courseId && effectiveForMonth(policy, monthKey))
    .sort((left, right) => right.effectiveFromMonth.localeCompare(left.effectiveFromMonth))[0] ?? null;
}

type AvailabilityInterval = { start: number; end: number };

// 점유는 [예약시각, 예약시각 + 코스 길이)다. 끝나는 시각과 같은 시작은 비어 있다.
function coveringEnd(intervals: AvailabilityInterval[], at: number) {
  const sorted = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
  let cursor = at;
  let occupied = false;
  for (const interval of sorted) {
    if (interval.end <= at) continue;
    if (interval.start > cursor) break;
    occupied = true;
    cursor = Math.max(cursor, interval.end);
  }
  return occupied ? cursor : null;
}

function nextIntervalStart(intervals: AvailabilityInterval[], at: number) {
  let next: number | null = null;
  for (const interval of intervals) {
    if (interval.start <= at) continue;
    if (next === null || interval.start < next) next = interval.start;
  }
  return next;
}

function intervalOverlaps(intervals: AvailabilityInterval[], start: number, end: number) {
  return intervals.some((interval) => interval.start < end && interval.end > start);
}

export async function listTherapistAvailability(input: {
  operatingMonthId: string;
  serviceDate: string;
  time: string;
  now?: Date;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<TherapistAvailabilityRowDto[]> {
  const parsed = serviceCallInputSchema.pick({ operatingMonthId: true, serviceDate: true, startTime: true }).safeParse({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    startTime: input.time
  });
  if (!parsed.success || !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.data.startTime)) {
    throw new ServiceCallDomainError(parsed.success ? "시간은 HH:mm 형식이어야 합니다." : parsed.error.issues[0]?.message ?? "조회 조건이 올바르지 않습니다.", "INVALID_SERVICE_CALL_QUERY");
  }

  const client = getClient(input.prismaClient);
  const month = await requireOperatingMonth(client, parsed.data.operatingMonthId);
  const [therapists, courses, policies, rates, slots, attendances, calls] = await Promise.all([
    client.employee.findMany({
      where: { isActive: true, employeeGroup: "THERAPIST" },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }]
    }),
    client.course.findMany(),
    client.coursePolicy.findMany({ where: { isActive: true } }),
    client.therapistCourseRate.findMany({
      where: {
        isActive: true,
        effectiveFromMonth: { lte: month.monthKey },
        OR: [{ effectiveToMonth: null }, { effectiveToMonth: { gte: month.monthKey } }],
        therapist: { isActive: true, employeeGroup: "THERAPIST" }
      }
    }),
    client.timeSlot.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    client.therapistAttendance.findMany({
      where: {
        operatingMonthId: month.id,
        attendanceDate: toDateOnly(parsed.data.serviceDate),
        isActive: true
      }
    }),
    client.serviceCall.findMany({
      where: {
        operatingMonthId: month.id,
        serviceDate: toDateOnly(parsed.data.serviceDate)
      },
      include: { operatingMonth: true, course: { include: { policies: true } }, assignments: true }
    })
  ]);

  const activeSlots = [...slots].filter((slot) => slot.isActive).sort((left, right) => left.sortOrder - right.sortOrder);
  const dayStart = activeSlots[0] ? clockMinutes(activeSlots[0].value) : AVAILABILITY_DEFAULT_DAY_START;
  const dayEnd = activeSlots.length > 0 ? businessMinute(activeSlots[activeSlots.length - 1].value, dayStart) : null;
  const at = businessMinute(parsed.data.startTime, dayStart);
  const attendanceByTherapist = new Map(
    attendances
      .filter((attendance) => attendance.isActive)
      .map((attendance) => [attendance.employeeId, attendance.checkOutMinute === null ? "checked_in" as const : "checked_out" as const])
  );
  const offeredCourses = [...courses]
    .filter((course) => course.isActive)
    .sort((left, right) => left.code.localeCompare(right.code))
    .flatMap((course) => {
      const policy = currentPolicyForCourse(policies, course.id, month.monthKey);
      if (!policy) return [];
      return [{
        courseId: course.id,
        courseCode: course.code,
        courseName: policy.name,
        durationMinutes: policy.durationMinutes,
        requiresSecondTherapist: policy.requiresSecondTherapist
      }];
    });

  const intervalsByTherapist = new Map<string, AvailabilityInterval[]>();
  for (const call of calls) {
    if (!occupiesAvailability(call.status) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(call.startTime)) continue;
    const policy = currentPolicyForCourse(policies, call.courseId, month.monthKey);
    if (!policy) continue;
    const start = businessMinute(call.startTime, dayStart);
    const interval = { start, end: start + policy.durationMinutes };
    for (const assignment of call.assignments ?? []) {
      if (assignment.isActive === false) continue;
      if (assignment.assignmentRole !== "THERAPIST_1" && assignment.assignmentRole !== "THERAPIST_2") continue;
      const current = intervalsByTherapist.get(assignment.employeeId) ?? [];
      current.push(interval);
      intervalsByTherapist.set(assignment.employeeId, current);
    }
  }

  // 지금이 고른 날짜의 영업일(첫 슬롯부터 다음 날 첫 슬롯 전까지, Asia/Ho_Chi_Minh) 안이고 사용중인 콜이 표시 종료를 넘겼으면
  // [표시 종료, 지금)이 그 Therapist의 추가 점유다. 표시 종료, 뒤 콜, 코스, 금액은 그대로 두고 가능 판정에만 쓴다.
  const now = input.now ?? new Date();
  const nowMinute = Math.floor((now.getTime() - instantFromBusinessMinute(parsed.data.serviceDate, 0).getTime()) / 60_000);
  const overrunsByTherapist = new Map<string, Array<AvailabilityInterval & { displayEnd: string }>>();
  const isToday = nowMinute >= dayStart && nowMinute < dayStart + AVAILABILITY_DAY_MINUTES;
  const pastShiftCheckWindow = isToday && at - nowMinute > AVAILABILITY_SHIFT_CHECK_MINUTES;
  if (isToday) {
    const displayContext = { dayCalls: calls, dayStart };
    for (const call of calls) {
      if (!isInUseStatus(call.status) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(call.startTime)) continue;
      const displayEnd = displayEndChoice(call, displayContext).minute;
      if (nowMinute <= displayEnd) continue;
      const overrun = { start: displayEnd, end: nowMinute, displayEnd: formatBusinessMinute(displayEnd) };
      for (const therapistId of assignedTherapistIds(call)) {
        const current = overrunsByTherapist.get(therapistId) ?? [];
        current.push(overrun);
        overrunsByTherapist.set(therapistId, current);
      }
    }
  }
  const occupancyOf = (therapistId: string) => [
    ...(intervalsByTherapist.get(therapistId) ?? []),
    ...(overrunsByTherapist.get(therapistId) ?? [])
  ];

  const activeTherapists = [...therapists]
    .filter((therapist) => therapist.isActive && therapist.employeeGroup === "THERAPIST")
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.displayName.localeCompare(right.displayName));

  // 근무표(27)의 그날 근무 예정. 읽기만 하고, 가능 판정·코스 버튼에는 쓰지 않는다(티켓 29).
  const plannedWorkingDayStatuses = await listPlannedWorkingDayStatusesForDate({
    employeeIds: activeTherapists.map((therapist) => therapist.id),
    date: parsed.data.serviceDate,
    prismaClient: client
  });
  const plannedWorkingDayStatusByTherapist = new Map(
    plannedWorkingDayStatuses.map((status) => [status.employeeId, status.status])
  );

  // 방문완료 금액 계산과 같은 firstCurrentRate로 고른다. 0 VND도 수당이다.
  const ratesByTherapistCourse = groupRatesByTherapistCourse(rates);
  const hasRate = (therapistId: string, courseId: string) =>
    firstCurrentRate(ratesByTherapistCourse.get(rateSourceKey(therapistId, courseId)) ?? [], month.monthKey) !== undefined;
  const rateHoldersByCourse = new Map(
    offeredCourses.map((course) => [course.courseId, activeTherapists.filter((therapist) => hasRate(therapist.id, course.courseId))])
  );

  return activeTherapists.map((therapist) => {
    const booked = intervalsByTherapist.get(therapist.id) ?? [];
    const overruns = overrunsByTherapist.get(therapist.id) ?? [];
    const intervals = [...booked, ...overruns];
    const occupiedUntil = coveringEnd(intervals, at);
    const available = occupiedUntil === null;
    // 예약 점유가 덮지 않는데 불가라면 추가 점유가 덮은 것이다. 겹치면 가장 이른 표시 종료를 말한다.
    const overrunAt = !available && coveringEnd(booked, at) === null
      ? overruns
          .filter((overrun) => overrun.start <= at && at < overrun.end)
          .sort((left, right) => left.start - right.start)[0] ?? null
      : null;
    const nextReservation = nextIntervalStart(booked, at);
    const nextStart = nextIntervalStart(intervals, at);
    const freeMinutes = available ? Math.max((nextStart ?? dayEnd ?? at) - at, 0) : null;
    const attendance = attendanceByTherapist.get(therapist.id) ?? "before_check_in";
    return {
      therapistId: therapist.id,
      therapistName: therapist.displayName,
      attendance,
      shiftCheck: pastShiftCheckWindow && attendance !== "checked_in",
      available,
      unavailableReason: available ? null : overrunAt ? "in_service_past_display_end" as const : "booked" as const,
      inServiceDisplayEnd: overrunAt?.displayEnd ?? null,
      freeFrom: occupiedUntil === null ? null : formatBusinessMinute(occupiedUntil),
      nextReservationTime: nextReservation === null ? null : formatBusinessMinute(nextReservation),
      freeMinutes,
      priorServiceEndCheck: overruns.length > 0,
      plannedWorkingDayStatus: plannedWorkingDayStatusByTherapist.get(therapist.id) ?? "미입력",
      courses: offeredCourses.map((course) => {
        const fits = available && freeMinutes !== null && course.durationMinutes <= freeMinutes;
        const rateHolders = rateHoldersByCourse.get(course.courseId) ?? [];
        const partners = course.requiresSecondTherapist ? rateHolders.filter((other) => other.id !== therapist.id) : [];
        const partnerFree = partners.some((other) => !intervalOverlaps(occupancyOf(other.id), at, at + course.durationMinutes));
        const verdict: TherapistAvailabilityCourseVerdict =
          !rateHolders.some((holder) => holder.id === therapist.id) || (course.requiresSecondTherapist && partners.length === 0)
            ? "rate_missing"
            : fits && (!course.requiresSecondTherapist || partnerFree)
              ? "possible"
              : "time_short";
        return {
          courseId: course.courseId,
          courseCode: course.courseCode,
          courseName: course.courseName,
          durationMinutes: course.durationMinutes,
          verdict,
          requiresSecondTherapist: course.requiresSecondTherapist
        };
      })
    };
  });
}

async function listServiceCallsInOperatingMonth(
  client: ServiceCallPrismaClient,
  operatingMonthId: string,
  serviceDate?: { gte: Date; lte: Date }
) {
  const [records, timeSlots] = await Promise.all([
    client.serviceCall.findMany({
      where: {
        operatingMonthId,
        ...(serviceDate ? { serviceDate } : {})
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
  const sources = await prefetchCalculationSources(client, records);
  const dayStart = dayStartFromSlots(timeSlots);
  const callsByDate = new Map<string, ServiceCallRecord[]>();
  for (const record of records) {
    const key = toIsoDateOnly(record.serviceDate);
    const current = callsByDate.get(key) ?? [];
    current.push(record);
    callsByDate.set(key, current);
  }

  return Promise.all(
    records
      .sort((a, b) => {
        const dateDiff = a.serviceDate.getTime() - b.serviceDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        const leftOrder = sortOrderByTime.get(a.startTime) ?? 9999;
        const rightOrder = sortOrderByTime.get(b.startTime) ?? 9999;
        return leftOrder - rightOrder || a.createdAt.getTime() - b.createdAt.getTime();
      })
      .map((record) =>
        toRowDto(client, record, sources, {
          dayCalls: callsByDate.get(toIsoDateOnly(record.serviceDate)) ?? [record],
          dayStart
        })
      )
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

  return listServiceCallsInOperatingMonth(getClient(input.prismaClient), parsed.data.operatingMonthId, {
    gte: toDateOnly(parsed.data.serviceDate),
    lte: toDateOnly(endDateParsed.data.serviceDate)
  });
}

/** 콜 한 줄을 지금 저장된 그대로 읽는다. 저장이 거절된 화면이 "최신 내용으로 다시 불러오기"에 쓴다. */
export async function getServiceCallRow(input: { serviceCallId: string; prismaClient?: ServiceCallPrismaClient }) {
  const client = getClient(input.prismaClient);
  return toRowDto(client, await findServiceCallWithRelations(client, input.serviceCallId));
}

export async function saveBasicServiceCallRow(input: ServiceCallInput & { actorId?: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = serviceCallInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "콜 원장 입력값이 올바르지 않습니다.", "INVALID_SERVICE_CALL_INPUT");
  }
  // 기존 행을 고치는 저장은 화면이 읽은 버전을 함께 보내야 한다. 없으면 다른 저장을 덮을 수 있다.
  if (parsed.data.serviceCallId && !parsed.data.expectedUpdatedAt) {
    throw new ServiceCallDomainError(savedVersionMessage, "INVALID_SERVICE_CALL_INPUT");
  }

  const client = getClient(input.prismaClient);
  return runInTransaction(client, (tx) => writeServiceCallRow(tx, parsed.data, { actorId: input.actorId }));
}

export type ServiceCallCreateResult = {
  row: ServiceCallRowDto;
  /** 같은 요청 id로 이미 만든 콜을 돌려줬다. 이번 요청은 아무것도 쓰지 않았다. */
  alreadySaved: boolean;
};

/**
 * 원장 새 행을 만든다(스펙 B07). 같은 요청 id로 이미 만든 콜이 있으면 새로 만들지 않고 그 콜을 돌려준다.
 * 같은 요청 id의 생성이 동시에 들어와 유일성 위반으로 실패한 쪽도 먼저 만든 콜을 같은 응답으로 받는다.
 * 그래서 응답을 받지 못한 화면이 다시 보내도 콜과 생성 감사 기록은 하나다.
 */
export async function createServiceCallRow(
  input: ServiceCallCreateInput & { actorId?: string; prismaClient?: ServiceCallPrismaClient }
): Promise<ServiceCallCreateResult> {
  const parsed = serviceCallCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "콜 원장 입력값이 올바르지 않습니다.", "INVALID_SERVICE_CALL_INPUT");
  }
  const { requestId, newCustomer, ...row } = parsed.data;
  const client = getClient(input.prismaClient);

  try {
    return await runInTransaction(client, async (tx) => {
      // 이미 만든 콜을 돌려주는 것은 쓰기가 아니다. 그 사이 운영월이 잠겼어도 같은 답을 준다. 이미 만든
      // 콜이 있으면 새 고객도 만들지 않는다 — 다시 보낸 요청이 고객을 두 번 만들지 않게 하는 핵심이다.
      const existing = await findServiceCallRowByRequestId(tx, requestId);
      if (existing) {
        return { row: existing, alreadySaved: true };
      }
      // 빠른 예약의 새 고객(F01, 티켓 24): 콜과 같은 트랜잭션에서 만든다. 뒤의 콜 생성이 실패하면(동시
      // 요청의 유일성 위반 등) 트랜잭션 전체가 롤백되어 고객만 남는 부분 성공이 생기지 않는다.
      const customerId = newCustomer
        ? (await createCustomerRecord(tx, newCustomer, requireActor(input.actorId))).id
        : row.customerId;
      return { row: await writeServiceCallRow(tx, { ...row, customerId }, { actorId: input.actorId, requestId }), alreadySaved: false };
    });
  } catch (error) {
    // 같은 요청 id의 생성이 동시에 들어와 이쪽이 유일성 위반으로 실패했다. 먼저 만든 콜을 같은 응답으로 돌려준다.
    const existing = isUniqueConstraintError(error) ? await findServiceCallRowByRequestId(client, requestId) : null;
    if (!existing) {
      throw error;
    }
    return { row: existing, alreadySaved: true };
  }
}

// 같은 사람을 Therapist 1·2에 두 번 고르는 것은 빠른 예약에서만 저장 오류다(스펙 F01, 티켓 21).
// 원장 직접 입력(createServiceCallRow를 그대로 쓰는 새 행 입력)과 과거 데이터에는 소급하지 않는다.
function assertDistinctTherapists(input: { therapist1Id?: string | null; therapist2Id?: string | null }) {
  const therapist1Id = input.therapist1Id?.trim() || null;
  const therapist2Id = input.therapist2Id?.trim() || null;
  if (therapist1Id && therapist2Id && therapist1Id === therapist2Id) {
    throw new ServiceCallDomainError(
      "Therapist 1과 Therapist 2는 서로 다른 사람이어야 합니다.",
      "D_QUICK_BOOKING_DUPLICATE_THERAPIST"
    );
  }
}

/**
 * 빠른 예약 저장(F01, 티켓 21). createServiceCallRow와 같은 콜 생성 하나이지만, 같은 사람을
 * Therapist 1·2로 두 번 고르는 것을 빠른 예약에서만 저장 오류로 더 막는다. 필수인 두 번째
 * Therapist가 비어 있는 검사는 createServiceCallRow(writeServiceCallRow)가 이미 원장 직접
 * 입력과 똑같이 한다.
 */
export async function createQuickBookingServiceCall(
  input: ServiceCallCreateInput & { actorId?: string; prismaClient?: ServiceCallPrismaClient }
): Promise<ServiceCallCreateResult> {
  assertDistinctTherapists(input);
  return createServiceCallRow(input);
}

async function findServiceCallRowByRequestId(client: ServiceCallPrismaClient, requestId: string) {
  const record = await client.serviceCall.findUnique({ where: { requestId } });
  return record ? toRowDto(client, await findServiceCallWithRelations(client, record.id)) : null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

/**
 * 콜 한 줄을 검사하고 쓴다. serviceCallId가 있으면 화면이 읽은 버전일 때만 고치고, 없으면 새로 만든다.
 * 새로 만들 때 요청 id가 있으면 함께 적는다.
 */
async function writeServiceCallRow(
  tx: ServiceCallPrismaClient,
  input: ServiceCallInput,
  options: { actorId?: string; requestId?: string }
) {
  assertRoomRequiredForStatus({ roomId: input.roomId, status: input.status });
  const { month, serviceDate } = await assertWritableDate(tx, {
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate
  });

  const [, , coursePolicy] = await Promise.all([
    assertActiveTimeSlot(tx, input.startTime),
    assertActiveRoom(tx, input.roomId),
    assertActiveCourse(tx, { courseId: input.courseId, monthKey: month.monthKey }),
    assertActiveCode(tx, { codeType: "SERVICE_STATUS", code: input.status, required: true }),
    assertActiveCode(tx, { codeType: "DISCOUNT_TYPE", code: input.discountTypeCode }),
    assertActiveCode(tx, { codeType: "PAYMENT_METHOD", code: input.paymentMethodCode }),
    assertActiveCode(tx, { codeType: "CONFIRMATION", code: input.confirmationCode }),
    assertActiveEmployee(tx, { role: "THERAPIST_1", employeeId: input.therapist1Id }),
    assertActiveEmployee(tx, { role: "THERAPIST_2", employeeId: input.therapist2Id }),
    assertActiveEmployee(tx, { role: "EARCARE", employeeId: input.earcareEmployeeId })
  ]);
  assertSecondTherapistRequirement({ policy: coursePolicy, therapist2Id: input.therapist2Id });

  const beforeRecord = input.serviceCallId
    ? await tx.serviceCall.findUnique({ where: { id: input.serviceCallId } })
    : null;
  const beforeLinked = beforeRecord ? await findServiceCallWithRelations(tx, beforeRecord.id) : null;
  const customerId = await resolveLinkedCustomerId(tx, input.customerId, beforeLinked?.customerId);
  const linkChanged = linkedCustomerId(beforeLinked ?? {}) !== customerId;
  // A link change is a sensitive call edit. Reject it before the write when no actor can be audited.
  const actorId = linkChanged ? requireActor(options.actorId) : options.actorId?.trim() || "";
  const data = {
    operatingMonthId: input.operatingMonthId,
    serviceDate,
    startTime: input.startTime,
    actualEntryTime: actualEntryForWrite(input.actualEntryTime, beforeLinked?.actualEntryTime),
    roomId: input.roomId ?? null,
    courseId: input.courseId,
    customerId,
    customerMemo: input.customerMemo ?? null,
    status: input.status,
    discountTypeCode: input.discountTypeCode ?? null,
    paymentMethodCode: input.paymentMethodCode ?? null,
    note: input.note ?? null,
    visitRequest: input.visitRequest ?? null,
    confirmationCode: input.confirmationCode ?? null
  };

  let serviceCall: ServiceCallRecord;
  if (input.serviceCallId && input.expectedUpdatedAt) {
    await updateServiceCallAtVersion(
      tx,
      {
        serviceCallId: input.serviceCallId,
        operatingMonthId: input.operatingMonthId,
        expectedUpdatedAt: input.expectedUpdatedAt
      },
      data
    );
    serviceCall = await findServiceCallWithRelations(tx, input.serviceCallId);
  } else {
    serviceCall = await tx.serviceCall.create({ data: { ...data, requestId: options.requestId ?? null } });
  }

  await Promise.all([
    writeAssignment(tx, {
      serviceCallId: serviceCall.id,
      assignmentRole: "THERAPIST_1",
      employeeId: input.therapist1Id
    }),
    writeAssignment(tx, {
      serviceCallId: serviceCall.id,
      assignmentRole: "THERAPIST_2",
      employeeId: input.therapist2Id
    }),
    writeAssignment(tx, {
      serviceCallId: serviceCall.id,
      assignmentRole: "EARCARE",
      employeeId: input.earcareEmployeeId
    })
  ]);

  const after = await findServiceCallWithRelations(tx, serviceCall.id);
  if (linkChanged) {
    await recordAuditEvent(
      {
        actorId,
        action: "service_call.row_changed",
        targetType: "service_call",
        targetId: after.id,
        beforeValue: beforeLinked ? toAuditSnapshot(beforeLinked) : null,
        afterValue: toAuditSnapshot(after)
      },
      { prismaClient: tx as any }
    );
  }

  return toRowDto(tx, after);
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
    const customerId = await resolveLinkedCustomerId(tx, parsed.data.customerId, before.customerId);
    const data = {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      startTime: parsed.data.startTime,
      actualEntryTime: actualEntryForWrite(parsed.data.actualEntryTime, before.actualEntryTime),
      roomId: parsed.data.roomId ?? null,
      courseId: parsed.data.courseId,
      customerId,
      customerMemo: parsed.data.customerMemo ?? null,
      status: parsed.data.status,
      discountTypeCode: parsed.data.discountTypeCode ?? null,
      paymentMethodCode: parsed.data.paymentMethodCode ?? null,
      note: parsed.data.note ?? null,
      visitRequest: parsed.data.visitRequest ?? null,
      confirmationCode: parsed.data.confirmationCode ?? null
    };

    await updateServiceCallAtVersion(tx, parsed.data, data);

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

/**
 * 잘못 연결된 콜의 고객을 사유와 함께 바로잡거나 연결을 해제한다(F06, ADR 0003, 스토리 81-83).
 * 원장 행 저장(saveBasicServiceCallRow/autosaveServiceCallRow)과는 별개의 전용 작업이다: 콜의
 * 고객/메모(customerMemo)는 건드리지 않고 customerId 연결만 바꾸며, 사유가 항상 필수이고 감사에
 * 이전 고객·새 고객·사유·처리자가 남는다. 마감확정·잠금 운영월은 거절되고(관리자 재오픈 후에만
 * 가능), 화면이 마지막으로 읽은 updatedAt이 아니면 STALE_CALL로 거절되며 이때는 쓰기와 감사가 없다.
 */
export async function correctServiceCallCustomerLink(
  input: ServiceCallCustomerLinkCorrectionInput & { actorId?: string; prismaClient?: ServiceCallPrismaClient }
) {
  const parsed = serviceCallCustomerLinkCorrectionSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const code =
      issue?.path[0] === "reason" ? "SERVICE_CALL_CUSTOMER_LINK_REASON_REQUIRED" : "INVALID_SERVICE_CALL_CUSTOMER_LINK_INPUT";
    throw new ServiceCallDomainError(issue?.message ?? "고객 연결 정정 입력값이 올바르지 않습니다.", code);
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const before = await findServiceCallWithRelations(tx, parsed.data.serviceCallId);
    const month = await requireOperatingMonth(tx, before.operatingMonthId);
    try {
      assertOperatingMonthPayoutWritable(month, "마감확정 또는 잠금 운영월입니다. 고객 연결을 정정할 수 없습니다.");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "OPERATING_MONTH_LOCKED") {
        throw new ServiceCallDomainError(error.message, "OPERATING_MONTH_LOCKED");
      }
      throw error;
    }

    const beforeCustomerId = linkedCustomerId(before);
    const newCustomerId = parsed.data.customerId ? (await requireCustomer(tx, parsed.data.customerId)).id : null;

    await updateServiceCallAtVersion(
      tx,
      {
        serviceCallId: parsed.data.serviceCallId,
        operatingMonthId: before.operatingMonthId,
        expectedUpdatedAt: parsed.data.expectedUpdatedAt
      },
      { customerId: newCustomerId }
    );

    const after = await findServiceCallWithRelations(tx, parsed.data.serviceCallId);

    await recordAuditEvent(
      {
        actorId,
        action: "service_call.customer_link_corrected",
        targetType: "service_call",
        targetId: after.id,
        beforeValue: { serviceCallId: after.id, customerId: beforeCustomerId },
        afterValue: { serviceCallId: after.id, customerId: linkedCustomerId(after) },
        reason: parsed.data.reason
      },
      { prismaClient: tx as any }
    );

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

// 고객 레코드를 만들고 생성 감사를 남긴다. createCustomer(단독 등록)와 createServiceCallRow의 새 고객
// 가져오기(F01, 티켓 24, 콜과 한 트랜잭션)가 같이 쓴다. 입력은 이미 검증된 값이어야 한다.
async function createCustomerRecord(tx: ServiceCallPrismaClient, input: CustomerInput, actorId: string) {
  const record = await tx.customer.create({
    data: {
      name: input.name,
      phone: input.phone ?? null,
      memo: input.memo ?? null,
      preferenceNote: input.preferenceNote ?? null
    }
  });
  await recordAuditEvent(
    {
      actorId,
      action: "customer.created",
      targetType: "customer",
      targetId: record.id,
      beforeValue: null,
      afterValue: toCustomerAuditSnapshot(record)
    },
    { prismaClient: tx as any }
  );
  return record;
}

export async function createCustomer(input: CustomerInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = customerInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "고객 입력값이 올바르지 않습니다.", "INVALID_CUSTOMER_INPUT");
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const record = await createCustomerRecord(tx, parsed.data, actorId);
    return toCustomerDto(record);
  });
}

export async function updateCustomer(input: CustomerUpdateInput & { actorId: string; prismaClient?: ServiceCallPrismaClient }) {
  const parsed = customerUpdateSchema.safeParse(input);
  if (!parsed.success) {
    throw new ServiceCallDomainError(parsed.error.issues[0]?.message ?? "고객 입력값이 올바르지 않습니다.", "INVALID_CUSTOMER_INPUT");
  }

  const actorId = requireActor(input.actorId);
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const before = await requireCustomer(tx, parsed.data.customerId);
    const data = {
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      memo: parsed.data.memo ?? null,
      preferenceNote: parsed.data.preferenceNote ?? null
    };
    const updated = await tx.customer.updateMany({ where: { id: before.id }, data });
    if (updated.count !== 1) {
      throw new ServiceCallDomainError("고객을 찾을 수 없습니다.", "CUSTOMER_NOT_FOUND");
    }
    const after = await requireCustomer(tx, before.id);
    await recordAuditEvent(
      {
        actorId,
        action: "customer.changed",
        targetType: "customer",
        targetId: after.id,
        beforeValue: toCustomerAuditSnapshot(before),
        afterValue: toCustomerAuditSnapshot(after)
      },
      { prismaClient: tx as any }
    );
    return toCustomerDto(after);
  });
}

export async function listCustomers(input: { prismaClient?: ServiceCallPrismaClient } = {}) {
  const client = getClient(input.prismaClient);
  const records = await client.customer.findMany();
  return records
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    .map(toCustomerDto);
}

export type CustomerVisitSelection =
  | { kind: "customer"; customerId: string }
  | { kind: "memo"; customerMemo: string };

export type CustomerVisitHistoryRowDto = {
  serviceCallId: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  courseId: string;
  courseLabel: string;
  therapist1Id: string | null;
  therapist2Id: string | null;
  therapistLabel: string;
  status: string;
  customerMemo: string | null;
  /** 이 방문의 방문별 요청(F06, 티켓 23). 빠른 예약 고객 단계의 최근 방문 가져오기(티켓 24)가 쓴다. */
  visitRequest: string | null;
};

export type CustomerVisitCandidateDto = {
  kind: "customer" | "memo";
  customerId: string | null;
  label: string;
  phone: string | null;
  latestVisitDate: string | null;
  /** 이 후보의 방문완료 건수(0건 포함). 후보 비교 표(B09)가 이름·연락처·최근 방문일과 나란히 보인다. */
  completedVisitCount: number;
  /** 다른 후보와 연락처를 숫자만 비교했을 때 같으면 true다(국가번호는 해석하지 않는다). 연락처가 없으면 항상 false다. */
  sharedPhone: boolean;
};

// 방문완료가 먼저다. 같은 상태 안에서는 늦은 날짜, 그다음 늦은 예약시각이 먼저다.
function visitStatusGroup(status: string) {
  if (isCompletedServiceCallStatus(status)) return "0";
  if (isReservationStatus(status)) return "1";
  if (isInUseStatus(status)) return "2";
  if (isCleaningStatus(status)) return "3";
  if (isNoShowStatus(status)) return "4";
  if (isCanceledStatus(status)) return "5";
  return `6:${status}`;
}

function compareVisitHistory(left: ServiceCallRecord, right: ServiceCallRecord, sortOrderByTime: Map<string, number>) {
  const group = visitStatusGroup(left.status).localeCompare(visitStatusGroup(right.status));
  if (group !== 0) return group;
  const date = right.serviceDate.getTime() - left.serviceDate.getTime();
  if (date !== 0) return date;
  const leftOrder = sortOrderByTime.get(left.startTime) ?? -1;
  const rightOrder = sortOrderByTime.get(right.startTime) ?? -1;
  if (leftOrder !== rightOrder) return rightOrder - leftOrder;
  return right.createdAt.getTime() - left.createdAt.getTime();
}

function visitCourseLabel(record: ServiceCallRecord) {
  const monthKey = record.operatingMonth?.monthKey;
  const course = record.course;
  const policy = monthKey && course ? firstCurrentPolicy(course, monthKey) : null;
  if (policy) {
    return `${course?.code ?? ""} ${policy.name}`.trim();
  }
  return record.courseId;
}

function visitTherapistLabel(record: ServiceCallRecord) {
  return (["THERAPIST_1", "THERAPIST_2"] as const)
    .map((role) => assignmentByRole(record, role)?.employee?.displayName)
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

function toVisitHistoryRow(record: ServiceCallRecord): CustomerVisitHistoryRowDto {
  return {
    serviceCallId: record.id,
    operatingMonthId: record.operatingMonthId,
    serviceDate: toIsoDateOnly(record.serviceDate),
    startTime: record.startTime,
    courseId: record.courseId,
    courseLabel: visitCourseLabel(record),
    therapist1Id: assignmentEmployeeId(record, "THERAPIST_1"),
    therapist2Id: assignmentEmployeeId(record, "THERAPIST_2"),
    therapistLabel: visitTherapistLabel(record),
    status: record.status,
    customerMemo: record.customerMemo,
    visitRequest: record.visitRequest
  };
}

function loadVisitCalls(client: ServiceCallPrismaClient) {
  return client.serviceCall.findMany({
    include: {
      operatingMonth: true,
      course: { include: { policies: true } },
      assignments: { include: { employee: true } }
    }
  });
}

export async function listCustomerVisitHistory(
  input: CustomerVisitSelection & { prismaClient?: ServiceCallPrismaClient }
): Promise<CustomerVisitHistoryRowDto[]> {
  const client = getClient(input.prismaClient);
  const [records, timeSlots] = await Promise.all([loadVisitCalls(client), client.timeSlot.findMany()]);
  const sortOrderByTime = new Map(timeSlots.map((slot) => [slot.value, slot.sortOrder]));
  const matched = records.filter((record) => {
    if (input.kind === "customer") {
      return (record.customerId ?? null) === input.customerId;
    }
    return (record.customerId ?? null) === null && (record.customerMemo ?? "") === input.customerMemo;
  });
  return matched
    .slice()
    .sort((left, right) => compareVisitHistory(left, right, sortOrderByTime))
    .map(toVisitHistoryRow);
}

export type CustomerVisitCountsDto = {
  completedCount: number;
  noShowCount: number;
  canceledCount: number;
};

// 고객 화면의 열린 방문 이력 위 건수(B09, 스토리 76-77). 예약·사용중·청소중은 이 건수에 넣지 않지만 이력 표에는 그대로 남는다.
export function customerVisitCountsFromRows(rows: CustomerVisitHistoryRowDto[]): CustomerVisitCountsDto {
  const count = (matches: (status: string) => boolean) => rows.filter((row) => matches(row.status)).length;
  return {
    completedCount: count(isCompletedServiceCallStatus),
    noShowCount: count(isNoShowStatus),
    canceledCount: count(isCanceledStatus)
  };
}

/**
 * 날짜·예약시각 기준으로 가장 최근 방문(상태와 상관없이). 빠른 예약 고객 단계가 그 방문의 코스·Therapist·
 * 방문별 요청 중 체크한 항목만 가져온다(B09, 스토리 71-73, 티켓 24). 방문 이력이 없으면 null이다.
 */
export function mostRecentCustomerVisit(rows: CustomerVisitHistoryRowDto[]): CustomerVisitHistoryRowDto | null {
  let latest: CustomerVisitHistoryRowDto | null = null;
  for (const row of rows) {
    if (!latest || `${row.serviceDate}T${row.startTime}` > `${latest.serviceDate}T${latest.startTime}`) {
      latest = row;
    }
  }
  return latest;
}

function textIncludes(value: string | null | undefined, query: string) {
  return (value ?? "").toLowerCase().includes(query.toLowerCase());
}

function completedVisitCount(records: ServiceCallRecord[]) {
  return records.filter((record) => isCompletedServiceCallStatus(record.status)).length;
}

// 연락처를 숫자만 남겨 비교한다(공백·하이픈 등 서식은 무시, 국가번호는 해석하지 않는다). 숫자가 없으면 비교 대상이 아니다.
function phoneDigits(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "");
}

function latestVisitDate(records: ServiceCallRecord[]) {
  let latest: Date | null = null;
  for (const record of records) {
    if (!latest || record.serviceDate.getTime() > latest.getTime()) {
      latest = record.serviceDate;
    }
  }
  return latest ? toIsoDateOnly(latest) : null;
}

// 후보에 보이는 손님 표기는 콜의 고객/메모다. 최근 방문의 표기를 먼저 보고, 비어 있으면 그보다 앞선 표기를 쓴다.
function latestCallMemo(records: ServiceCallRecord[]) {
  const sorted = records.slice().sort((left, right) => {
    const date = right.serviceDate.getTime() - left.serviceDate.getTime();
    if (date !== 0) return date;
    return right.startTime.localeCompare(left.startTime);
  });
  for (const record of sorted) {
    const memo = record.customerMemo?.trim() ?? "";
    if (memo) return memo;
  }
  return "";
}

export async function searchCustomerVisitCandidates(input: {
  query: string;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<CustomerVisitCandidateDto[]> {
  const query = input.query.trim();
  if (!query) return [];

  const client = getClient(input.prismaClient);
  const [customers, calls] = await Promise.all([client.customer.findMany(), loadVisitCalls(client)]);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));
  const callsByCustomer = new Map<string, ServiceCallRecord[]>();
  const unlinkedByMemo = new Map<string, ServiceCallRecord[]>();

  for (const call of calls) {
    const customerId = call.customerId ?? null;
    if (customerId) {
      const linked = callsByCustomer.get(customerId) ?? [];
      linked.push(call);
      callsByCustomer.set(customerId, linked);
    } else {
      const key = call.customerMemo ?? "";
      const grouped = unlinkedByMemo.get(key) ?? [];
      grouped.push(call);
      unlinkedByMemo.set(key, grouped);
    }
  }

  const customerIds = new Set<string>();
  for (const customer of customers) {
    if (textIncludes(customer.name, query) || textIncludes(customer.phone, query) || textIncludes(customer.memo, query)) {
      customerIds.add(customer.id);
    }
  }
  for (const call of calls) {
    const customerId = call.customerId ?? null;
    if (!customerId || !customersById.has(customerId)) continue;
    if (textIncludes(call.customerMemo, query) || textIncludes(call.note, query)) {
      customerIds.add(customerId);
    }
  }

  const memoKeys = new Set<string>();
  for (const call of calls) {
    if (call.customerId) continue;
    if (textIncludes(call.customerMemo, query) || textIncludes(call.note, query)) {
      memoKeys.add(call.customerMemo ?? "");
    }
  }

  const candidates: CustomerVisitCandidateDto[] = [];
  for (const customerId of customerIds) {
    const customer = customersById.get(customerId);
    if (!customer) continue;
    const calls = callsByCustomer.get(customerId) ?? [];
    const memo = latestCallMemo(calls);
    candidates.push({
      kind: "customer",
      customerId: customer.id,
      label: memo || customer.name,
      phone: customer.phone,
      latestVisitDate: latestVisitDate(calls),
      completedVisitCount: completedVisitCount(calls),
      sharedPhone: false
    });
  }
  for (const key of memoKeys) {
    const calls = unlinkedByMemo.get(key) ?? [];
    candidates.push({
      kind: "memo",
      customerId: null,
      label: key,
      phone: null,
      latestVisitDate: latestVisitDate(calls),
      completedVisitCount: completedVisitCount(calls),
      sharedPhone: false
    });
  }

  // 숫자만 비교한 연락처가 둘 이상의 후보에서 같으면 모두 표시한다(B09, 스토리 78-80). 빈 연락처는 비교하지 않는다.
  const candidatesByPhoneDigits = new Map<string, CustomerVisitCandidateDto[]>();
  for (const candidate of candidates) {
    const digits = phoneDigits(candidate.phone);
    if (!digits) continue;
    const group = candidatesByPhoneDigits.get(digits) ?? [];
    group.push(candidate);
    candidatesByPhoneDigits.set(digits, group);
  }
  for (const group of candidatesByPhoneDigits.values()) {
    if (group.length < 2) continue;
    for (const candidate of group) candidate.sharedPhone = true;
  }

  candidates.sort((left, right) => {
    if (left.latestVisitDate === right.latestVisitDate) {
      return left.label.localeCompare(right.label, "ko") || (left.customerId ?? "").localeCompare(right.customerId ?? "");
    }
    if (left.latestVisitDate === null) return 1;
    if (right.latestVisitDate === null) return -1;
    return left.latestVisitDate < right.latestVisitDate ? 1 : -1;
  });
  return candidates;
}

/**
 * 고객을 이미 고른 상태(고객 화면 visitCustomer= 직접 진입, 빠른 예약 고객 선택 후)에서도 같은 연락처
 * 경고를 보이기 위한 질의다(S5, 스펙 F08·F01 단계 1). searchCustomerVisitCandidates의 sharedPhone은
 * 그 검색 결과 안에서만 비교해, 쿼리 없이 바로 연 고객에게는 경고를 줄 수 없었다 — 여기서는 전체 고객을
 * 대상으로 숫자만 비교한다(phoneDigits와 같은 기준).
 */
export async function customerSharedPhone(input: { customerId: string; prismaClient?: ServiceCallPrismaClient }): Promise<boolean> {
  const client = getClient(input.prismaClient);
  const customers = await client.customer.findMany();
  const target = customers.find((customer) => customer.id === input.customerId);
  const digits = phoneDigits(target?.phone ?? null);
  if (!digits) return false;
  return customers.some((customer) => customer.id !== input.customerId && phoneDigits(customer.phone) === digits);
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
        method: parsed.data.method,
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
        method: parsed.data.method,
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
  return findActiveExpenses(client, {
    operatingMonthId: parsed.data.operatingMonthId,
    expenseDate: toDateOnly(parsed.data.expenseDate)
  });
}

async function findActiveExpenses(
  client: ServiceCallPrismaClient,
  where: { operatingMonthId: string; expenseDate?: Date | { gte: Date; lte: Date } }
) {
  const records = await client.dailyExpense.findMany({
    where: { ...where, isActive: true },
    include: { handledByEmployee: true },
    orderBy: [{ createdAt: "asc" }]
  });
  return records.map(toDailyExpenseDto);
}

async function monthTillFor(client: ServiceCallPrismaClient, operatingMonthId: string): Promise<TillBalanceDto> {
  const month = await client.operatingMonth.findUnique({ where: { id: operatingMonthId } });
  const range = month
    ? { gte: toDateOnly(toIsoDateOnly(month.startDate)), lte: toDateOnly(toIsoDateOnly(month.endDate)) }
    : undefined;
  const [monthRows, monthExpenses] = await Promise.all([
    listServiceCallsInOperatingMonth(client, operatingMonthId, range),
    findActiveExpenses(client, range ? { operatingMonthId, expenseDate: range } : { operatingMonthId })
  ]);
  return tillFromReceipts(recognizedReceipts(monthRows), monthExpenses);
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
  includeMonthTill?: boolean;
  prismaClient?: ServiceCallPrismaClient;
}): Promise<DailyCallLedgerSummaryDto> {
  const client = getClient(input.prismaClient);
  const rows = await listServiceCallsForDate({ ...input, prismaClient: client });
  const expenses = await listDailyExpensesForDate({
    operatingMonthId: input.operatingMonthId,
    expenseDate: input.serviceDate,
    prismaClient: client
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

    if (recognizesRevenue(row)) {
      paymentTotal += row.paymentAmount;
      discountTotal += row.discountAmount;
      paymentMethodTotals[paymentMethodBucket(row.paymentMethodCode)] += row.paymentAmount;
    }

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
  const dayTill = tillFromReceipts({ cash: paymentMethodTotals.cash, bank: paymentMethodTotals.bank }, expenses);
  // 시재를 그리지 않는 화면은 날짜마다 운영월 전체를 다시 읽지 않는다.
  const monthTill = input.includeMonthTill === false ? emptyTill() : await monthTillFor(client, input.operatingMonthId);
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
    till: { day: dayTill, month: monthTill },
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

export type LedgerStatusCountsDto = {
  totalCount: number;
  reservedCount: number;
  inUseCount: number;
  cleaningCount: number;
  completedCount: number;
  noShowCount: number;
  canceledCount: number;
};

// 원장 탭 머리의 상태별 건수(명세 F08). totalCount는 하루 요약의 reservationCount와 같은 그날의 콜 수다.
export function ledgerStatusCountsFromRows(rows: ServiceCallRowDto[]): LedgerStatusCountsDto {
  const count = (matches: (status: string) => boolean) => rows.filter((row) => matches(row.status)).length;
  return {
    totalCount: rows.length,
    reservedCount: count(isReservationStatus),
    inUseCount: count(isInUseStatus),
    cleaningCount: count(isCleaningStatus),
    completedCount: count(isCompletedServiceCallStatus),
    noShowCount: count(isNoShowStatus),
    canceledCount: count(isCanceledStatus)
  };
}

export type CalculationWarningStatus = Extract<
  ServiceCallCalculationStatus,
  "course_policy_missing" | "therapist_rate_missing" | "second_therapist_required"
>;

export type CalculationWarningCallDto = {
  serviceCallId: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  customerMemo: string | null;
  calculationStatus: CalculationWarningStatus;
};

function isCalculationWarningStatus(status: ServiceCallCalculationStatus): status is CalculationWarningStatus {
  return status === "course_policy_missing" || status === "therapist_rate_missing" || status === "second_therapist_required";
}

// 하루 요약의 계산 경고 건수(warningCounts)와 같은 행이다. 원장 순서를 그대로 둔다.
export function calculationWarningCallsFromRows(rows: ServiceCallRowDto[]): CalculationWarningCallDto[] {
  return rows.flatMap((row) =>
    isCalculationWarningStatus(row.calculationStatus)
      ? [
          {
            serviceCallId: row.id,
            operatingMonthId: row.operatingMonthId,
            serviceDate: row.serviceDate,
            startTime: row.startTime,
            customerMemo: row.customerMemo,
            calculationStatus: row.calculationStatus
          }
        ]
      : []
  );
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

export async function listServiceCallFormOptions(
  input: { operatingMonthId?: string; locale?: Locale; prismaClient?: ServiceCallPrismaClient } = {}
) {
  const client = getClient(input.prismaClient);
  const locale = input.locale ?? defaultLocale;
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
    statuses: statuses.map((code) => option(code.code, codeLabel(locale, code.codeType, code.code, code.isSystemDefault, code.displayName))),
    discountTypes: discountTypes.map((code) => option(code.code, codeLabel(locale, code.codeType, code.code, code.isSystemDefault, code.displayName))),
    paymentMethods: paymentMethods.map((code) => option(code.code, codeLabel(locale, code.codeType, code.code, code.isSystemDefault, code.displayName))),
    confirmationCodes: confirmationCodes.map((code) => option(code.code, codeLabel(locale, code.codeType, code.code, code.isSystemDefault, code.displayName))),
    therapists: therapists.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`)),
    earcareEmployees: earcareEmployees.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`)),
    expenseHandlers: expenseHandlers.map((employee) => option(employee.id, `${employee.displayName} (${employee.staffCode})`))
  } satisfies ServiceCallFormOptions;
}

/** 근무표(28)가 휴무 영향 콜을 보여줄 때 쓰는 콜 하나의 요약. 고객/메모, 연락처, 금액은 담지 않는다. */
export type AssignedServiceCallSummaryDto = {
  serviceCallId: string;
  operatingMonthId: string;
  serviceDate: string;
  startTime: string;
  courseCode: string;
  status: string;
};

type AssignedCallRecord = {
  id: string;
  operatingMonthId: string;
  serviceDate: Date;
  startTime: string;
  status: string;
  course?: { code: string } | null;
  assignments?: Array<{ employeeId: string; isActive?: boolean }>;
};

// roomFloorFactsForDate(DisplayEndReadClient)와 같은 방식: 근무표 서비스가 자기 클라이언트를
// 그대로 넘길 수 있도록 serviceCall.findMany만 요구하는 좁은 타입이다.
type AssignedCallReadClient = {
  serviceCall: { findMany(args?: unknown): Promise<unknown[]> };
};

/**
 * 그 직원이 그 날짜에 어느 배정 역할로든 배정된 콜(노쇼·취소 제외) 요약. 근무표(28)가 칸을 휴무로
 * 바꿀 때 영향받는 콜을 보여주는 데 쓴다(스토리 102). 조회만 하며 콜의 예약시각·배정·상태는
 * 건드리지 않는다.
 */
export async function listAssignedServiceCallsForEmployeeOnDate(input: {
  employeeId: string;
  date: string;
  prismaClient?: AssignedCallReadClient;
}): Promise<AssignedServiceCallSummaryDto[]> {
  const employeeId = input.employeeId.trim();
  if (!employeeId) {
    throw new ServiceCallDomainError("직원을 선택하세요.", "INVALID_SERVICE_CALL_QUERY");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    throw new ServiceCallDomainError("날짜는 YYYY-MM-DD 형식이어야 합니다.", "INVALID_SERVICE_CALL_QUERY");
  }

  const client = input.prismaClient ?? getClient();
  const records = (await client.serviceCall.findMany({
    where: { serviceDate: toDateOnly(input.date) },
    include: { course: true, assignments: true }
  })) as AssignedCallRecord[];

  return records
    .filter((record) => (record.assignments ?? []).some((assignment) => assignment.employeeId === employeeId && assignment.isActive !== false))
    .filter((record) => !isNoShowStatus(record.status) && !isCanceledStatus(record.status))
    .map((record) => ({
      serviceCallId: record.id,
      operatingMonthId: record.operatingMonthId,
      serviceDate: toIsoDateOnly(record.serviceDate),
      startTime: record.startTime,
      courseCode: record.course?.code ?? "",
      status: record.status
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.serviceCallId.localeCompare(b.serviceCallId));
}
