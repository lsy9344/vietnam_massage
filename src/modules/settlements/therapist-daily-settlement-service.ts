import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  listServiceCallsForDate,
  type ServiceCallAssigneeDto,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import { assertOperatingMonthPayoutWritable } from "@/modules/closing/month-lock-guard";

const courseCodes = ["A", "B", "C", "D", "E"] as const;
const assignmentRoles = ["THERAPIST_1", "THERAPIST_2"] as const;

type CourseCode = (typeof courseCodes)[number];
type TherapistAssignmentRole = (typeof assignmentRoles)[number];
type TherapistRateStatus = "applied" | "zero_policy" | "missing_policy";

type OperatingMonthRecord = {
  id: string;
  monthKey: string;
  startDate: Date;
  endDate: Date;
  status: string;
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
  sortOrder?: number;
  isActive: boolean;
};

type TherapistDailySettlementPaymentRecord = {
  id: string;
  operatingMonthId: string;
  serviceDate: Date;
  employeeId: string;
  isPaid: boolean;
  paidAt: Date | null;
  paidByAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type TherapistDailySettlementPrismaClient = {
  operatingMonth: {
    findUnique(args: unknown): Promise<OperatingMonthRecord | null>;
  };
  therapistCourseRate: {
    findMany(args?: unknown): Promise<TherapistCourseRateRecord[]>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
    findUnique?(args: unknown): Promise<EmployeeRecord | null>;
  };
  therapistDailySettlementPayment?: {
    findMany(args?: unknown): Promise<TherapistDailySettlementPaymentRecord[]>;
    upsert(args: unknown): Promise<TherapistDailySettlementPaymentRecord>;
  };
};

type TherapistRateLookup = Map<string, TherapistCourseRateRecord[]>;

export type TherapistCourseSettlementSummary = {
  courseCode: CourseCode;
  callCount: number;
  commissionAmount: number;
};

export type TherapistAssignmentEvidenceDto = {
  serviceCallId: string;
  courseId: string;
  courseCode: string;
  role: TherapistAssignmentRole;
  employeeId: string;
  commissionAmount: number;
  rateStatus: TherapistRateStatus;
};

export type TherapistDailySettlementDto = {
  employeeId: string;
  displayName: string;
  staffCode: string;
  sortOrder: number;
  totalCallCount: number;
  totalCommissionAmount: number;
  courseBreakdown: Record<CourseCode, TherapistCourseSettlementSummary>;
  assignmentEvidence: TherapistAssignmentEvidenceDto[];
  warningCounts: {
    zeroPolicy: number;
    missingPolicy: number;
  };
  paymentStatus: {
    isPaid: boolean;
    paidAt: string | null;
    paidByAccountId: string | null;
  };
};

export type TherapistDailySettlementResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  settlements: TherapistDailySettlementDto[];
  warningCounts: {
    coursePolicyMissing: number;
    therapistRateMissing: number;
    secondTherapistRequired: number;
  };
  excludedCallCount: number;
};

const settlementQuerySchema = z.object({
  operatingMonthId: z.string().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

const settlementPaymentSchema = settlementQuerySchema.extend({
  employeeId: z.string().min(1, "마사지사를 선택하세요."),
  isPaid: z.boolean(),
  actorId: z.string().min(1, "처리자를 확인할 수 없습니다.")
});

function getClient(client?: TherapistDailySettlementPrismaClient) {
  return client ?? (prisma as unknown as TherapistDailySettlementPrismaClient);
}

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function isDateWithinOperatingMonth(serviceDate: Date, month: OperatingMonthRecord) {
  return serviceDate >= month.startDate && serviceDate <= month.endDate;
}

function emptyCourseBreakdown(): Record<CourseCode, TherapistCourseSettlementSummary> {
  return Object.fromEntries(
    courseCodes.map((courseCode) => [courseCode, { courseCode, callCount: 0, commissionAmount: 0 }])
  ) as Record<CourseCode, TherapistCourseSettlementSummary>;
}

function isCourseCode(value: string): value is CourseCode {
  return courseCodes.includes(value as CourseCode);
}

function isCompletedStatus(status: string) {
  return status === "방문완료" || status === "VISIT_COMPLETE";
}

function effectiveForMonth(rate: TherapistCourseRateRecord, monthKey: string) {
  return rate.isActive && rate.effectiveFromMonth <= monthKey && (rate.effectiveToMonth === null || rate.effectiveToMonth >= monthKey);
}

function firstCurrentRate(rates: TherapistCourseRateRecord[], monthKey: string) {
  return [...rates]
    .filter((rate) => effectiveForMonth(rate, monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0] ?? null;
}

function rateLookupKey(employeeId: string, courseId: string) {
  return `${employeeId}::${courseId}`;
}

function createRateLookup(rates: TherapistCourseRateRecord[]) {
  const lookup: TherapistRateLookup = new Map();
  for (const rate of rates) {
    const key = rateLookupKey(rate.therapistId, rate.courseId);
    const current = lookup.get(key) ?? [];
    current.push(rate);
    lookup.set(key, current);
  }
  return lookup;
}

function getRoleRate(input: {
  rateLookup: TherapistRateLookup;
  employeeId: string;
  courseId: string;
  monthKey: string;
}) {
  return firstCurrentRate(input.rateLookup.get(rateLookupKey(input.employeeId, input.courseId)) ?? [], input.monthKey);
}

function assigneeForRole(row: ServiceCallRowDto, role: TherapistAssignmentRole): ServiceCallAssigneeDto | null {
  return role === "THERAPIST_1" ? row.therapist1 : row.therapist2;
}

function calculatedCommissionForRole(row: ServiceCallRowDto, role: TherapistAssignmentRole) {
  return role === "THERAPIST_1" ? row.therapist1Commission : row.therapist2Commission;
}

function employeeFallback(assignee: ServiceCallAssigneeDto): EmployeeRecord {
  return {
    id: assignee.id,
    displayName: assignee.displayName,
    staffCode: assignee.staffCode,
    employeeGroup: "THERAPIST",
    sortOrder: 9999,
    isActive: true
  };
}

function createSettlement(employee: EmployeeRecord): TherapistDailySettlementDto {
  return {
    employeeId: employee.id,
    displayName: employee.displayName,
    staffCode: employee.staffCode,
    sortOrder: employee.sortOrder ?? 9999,
    totalCallCount: 0,
    totalCommissionAmount: 0,
    courseBreakdown: emptyCourseBreakdown(),
    assignmentEvidence: [],
    warningCounts: {
      zeroPolicy: 0,
      missingPolicy: 0
    },
    paymentStatus: {
      isPaid: false,
      paidAt: null,
      paidByAccountId: null
    }
  };
}

function toPaymentStatus(record: TherapistDailySettlementPaymentRecord | null): TherapistDailySettlementDto["paymentStatus"] {
  return {
    isPaid: record?.isPaid ?? false,
    paidAt: record?.paidAt?.toISOString() ?? null,
    paidByAccountId: record?.paidByAccountId ?? null
  };
}

async function attachPaymentStatuses(input: {
  client: TherapistDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  settlements: TherapistDailySettlementDto[];
}) {
  if (!input.client.therapistDailySettlementPayment || input.settlements.length === 0) {
    return input.settlements;
  }

  const records = await input.client.therapistDailySettlementPayment.findMany({
    where: {
      operatingMonthId: input.operatingMonthId,
      serviceDate: toDateOnly(input.serviceDate),
      employeeId: { in: input.settlements.map((settlement) => settlement.employeeId) }
    }
  });
  const byEmployeeId = new Map(records.map((record) => [record.employeeId, record]));

  return input.settlements.map((settlement) => ({
    ...settlement,
    paymentStatus: toPaymentStatus(byEmployeeId.get(settlement.employeeId) ?? null)
  }));
}

function evidenceForRole(input: {
  rateLookup: TherapistRateLookup;
  monthKey: string;
  row: ServiceCallRowDto;
  role: TherapistAssignmentRole;
  assignee: ServiceCallAssigneeDto;
}): TherapistAssignmentEvidenceDto {
  if (input.row.calculationStatus === "course_policy_missing") {
    return {
      serviceCallId: input.row.id,
      courseId: input.row.courseId,
      courseCode: input.row.courseCode,
      role: input.role,
      employeeId: input.assignee.id,
      commissionAmount: 0,
      rateStatus: "missing_policy"
    };
  }

  const rate = getRoleRate({
    rateLookup: input.rateLookup,
    employeeId: input.assignee.id,
    courseId: input.row.courseId,
    monthKey: input.monthKey
  });
  if (!rate) {
    return {
      serviceCallId: input.row.id,
      courseId: input.row.courseId,
      courseCode: input.row.courseCode,
      role: input.role,
      employeeId: input.assignee.id,
      commissionAmount: 0,
      rateStatus: "missing_policy"
    };
  }

  const commissionAmount = input.row.calculationStatus === "calculated" ? calculatedCommissionForRole(input.row, input.role) : rate.amount;
  return {
    serviceCallId: input.row.id,
    courseId: input.row.courseId,
    courseCode: input.row.courseCode,
    role: input.role,
    employeeId: input.assignee.id,
    commissionAmount,
    rateStatus: commissionAmount === 0 ? "zero_policy" : "applied"
  };
}

async function loadApplicableRates(client: TherapistDailySettlementPrismaClient, rows: ServiceCallRowDto[]) {
  const therapistIds = new Set<string>();
  const courseIds = new Set<string>();
  for (const row of rows) {
    if (!isCompletedStatus(row.status) || row.calculationStatus === "second_therapist_required") continue;
    if (!["calculated", "therapist_rate_missing", "course_policy_missing"].includes(row.calculationStatus)) continue;
    for (const role of assignmentRoles) {
      const assignee = assigneeForRole(row, role);
      if (!assignee) continue;
      therapistIds.add(assignee.id);
      courseIds.add(row.courseId);
    }
  }

  if (therapistIds.size === 0 || courseIds.size === 0) {
    return createRateLookup([]);
  }

  const rates = await client.therapistCourseRate.findMany({
    where: {
      therapistId: { in: [...therapistIds] },
      courseId: { in: [...courseIds] },
      isActive: true
    }
  });
  return createRateLookup(rates);
}

export async function listTherapistDailySettlements(input: {
  operatingMonthId: string;
  serviceDate: string;
  prismaClient?: TherapistDailySettlementPrismaClient;
}): Promise<TherapistDailySettlementResultDto> {
  const parsed = settlementQuerySchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "정산 조회 조건이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  const [operatingMonth, therapistEmployees, rows] = await Promise.all([
    client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } }),
    client.employee.findMany({ where: { employeeGroup: "THERAPIST", isActive: true }, orderBy: [{ sortOrder: "asc" }, { staffCode: "asc" }] }),
    listServiceCallsForDate({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: client as Parameters<typeof listServiceCallsForDate>[0]["prismaClient"]
    })
  ]);

  if (!operatingMonth) {
    throw new Error("운영월을 찾을 수 없습니다.");
  }

  const employeesById = new Map(therapistEmployees.map((employee) => [employee.id, employee]));
  const rateLookup = await loadApplicableRates(client, rows);
  const settlementsByEmployeeId = new Map<string, TherapistDailySettlementDto>();
  const warningCounts = {
    coursePolicyMissing: 0,
    therapistRateMissing: 0,
    secondTherapistRequired: 0
  };
  let excludedCallCount = 0;

  for (const row of rows) {
    if (!isCompletedStatus(row.status)) {
      excludedCallCount += 1;
      continue;
    }

    if (row.calculationStatus === "course_policy_missing") warningCounts.coursePolicyMissing += 1;
    if (row.calculationStatus === "therapist_rate_missing") warningCounts.therapistRateMissing += 1;
    if (row.calculationStatus === "second_therapist_required") warningCounts.secondTherapistRequired += 1;

    if (row.calculationStatus === "second_therapist_required") {
      excludedCallCount += 1;
      continue;
    }

    if (!["calculated", "therapist_rate_missing", "course_policy_missing"].includes(row.calculationStatus)) {
      excludedCallCount += 1;
      continue;
    }

    for (const role of assignmentRoles) {
      const assignee = assigneeForRole(row, role);
      if (!assignee) continue;

      const employee = employeesById.get(assignee.id) ?? employeeFallback(assignee);
      if (!settlementsByEmployeeId.has(employee.id)) {
        settlementsByEmployeeId.set(employee.id, createSettlement(employee));
      }

      const settlement = settlementsByEmployeeId.get(employee.id);
      if (!settlement) continue;

      const evidence = evidenceForRole({
        rateLookup,
        monthKey: operatingMonth.monthKey,
        row,
        role,
        assignee
      });

      settlement.assignmentEvidence.push(evidence);
      settlement.totalCallCount += 1;
      settlement.totalCommissionAmount += evidence.commissionAmount;
      if (evidence.rateStatus === "zero_policy") settlement.warningCounts.zeroPolicy += 1;
      if (evidence.rateStatus === "missing_policy") settlement.warningCounts.missingPolicy += 1;

      if (isCourseCode(evidence.courseCode)) {
        settlement.courseBreakdown[evidence.courseCode].callCount += 1;
        settlement.courseBreakdown[evidence.courseCode].commissionAmount += evidence.commissionAmount;
      }
    }
  }

  const settlements = [...settlementsByEmployeeId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    settlements: await attachPaymentStatuses({
      client,
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      settlements
    }),
    warningCounts,
    excludedCallCount
  };
}

export async function setTherapistDailySettlementPayment(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  isPaid: boolean;
  actorId: string;
  prismaClient?: TherapistDailySettlementPrismaClient;
}) {
  const parsed = settlementPaymentSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급완료 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  if (!client.therapistDailySettlementPayment) {
    throw new Error("지급완료 저장소를 사용할 수 없습니다.");
  }

  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new Error("운영월을 찾을 수 없습니다.");
  }
  assertOperatingMonthPayoutWritable(operatingMonth, "마감확정 또는 잠금 운영월의 지급완료 상태는 변경할 수 없습니다.");

  const serviceDate = toDateOnly(parsed.data.serviceDate);
  if (!isDateWithinOperatingMonth(serviceDate, operatingMonth)) {
    throw new Error("운영월 범위를 벗어난 날짜입니다.");
  }

  if (client.employee.findUnique) {
    const employee = await client.employee.findUnique({ where: { id: parsed.data.employeeId } });
    if (!employee) {
      throw new Error("마사지사를 찾을 수 없습니다.");
    }
    if (!employee.isActive || employee.employeeGroup !== "THERAPIST") {
      throw new Error("활성 마사지사만 지급완료 상태를 변경할 수 있습니다.");
    }
  }

  // 지급완료(true)는 해당 날짜에 실제 정산 대상(담당 방문완료 콜)이 있는 마사지사에만 허용한다.
  // 정산 행이 없는 직원에게 지급완료가 미리 찍히는 것을 막는다.
  // 해제(false)는 잘못 저장된 기록 정리를 위해 정산 행 여부와 무관하게 허용한다.
  if (parsed.data.isPaid) {
    const { settlements } = await listTherapistDailySettlements({
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: input.prismaClient
    });
    const hasSettlement = settlements.some(
      (settlement) => settlement.employeeId === parsed.data.employeeId && settlement.totalCallCount > 0
    );
    if (!hasSettlement) {
      throw new Error("해당 날짜에 정산 대상 콜이 없는 마사지사는 지급완료로 표시할 수 없습니다.");
    }
  }

  const now = new Date();
  const record = await client.therapistDailySettlementPayment.upsert({
    where: {
      operatingMonthId_serviceDate_employeeId: {
        operatingMonthId: parsed.data.operatingMonthId,
        serviceDate,
        employeeId: parsed.data.employeeId
      }
    },
    update: {
      isPaid: parsed.data.isPaid,
      paidAt: parsed.data.isPaid ? now : null,
      paidByAccountId: parsed.data.isPaid ? parsed.data.actorId : null
    },
    create: {
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate,
      employeeId: parsed.data.employeeId,
      isPaid: parsed.data.isPaid,
      paidAt: parsed.data.isPaid ? now : null,
      paidByAccountId: parsed.data.isPaid ? parsed.data.actorId : null
    }
  });

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    paymentStatus: toPaymentStatus(record)
  };
}
