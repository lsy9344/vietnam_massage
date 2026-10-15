import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  listServiceCallsForDate,
  type ServiceCallAssigneeDto,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import { settlementEvidenceCall, type SettlementEvidenceCallDto } from "@/modules/settlements/settlement-evidence-call";
import {
  confirmPayoutConfirmation,
  listActivelyConfirmedUnitEmployeeIds,
  derivePayoutConfirmationStatus,
  attachPayoutConfirmationsToRows,
  toPayoutConfirmationPrismaClient,
  reconfirmPayoutConfirmation,
  releasePayoutConfirmation,
  type PayoutConfirmationDto
} from "@/modules/settlements/payout-confirmation-service";

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

type TherapistDailySettlementPrismaClient = {
  $transaction?<T>(callback: (tx: TherapistDailySettlementPrismaClient) => Promise<T>, options?: unknown): Promise<T>;
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
  payoutConfirmationEvent?: {
    findMany(args?: unknown): Promise<unknown[]>;
    create(args: unknown): Promise<unknown>;
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
  call: SettlementEvidenceCallDto;
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
  /** 지급 확인(ADR 0004, 티켓 30). 이 값은 송금이 아니라 "확인했다는 사실"이다. */
  payoutConfirmation: PayoutConfirmationDto;
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

/** Therapist 일별 지급 확인 한 단위를 가리키는 서버 액션 결과. */
export type TherapistDailySettlementPayoutResultDto = {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

const settlementQuerySchema = z.object({
  operatingMonthId: z.string().min(1, "운영월을 선택하세요."),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.")
});

const payoutUnitSchema = settlementQuerySchema.extend({
  employeeId: z.string().min(1, "마사지사를 선택하세요."),
  actorId: z.string().min(1, "처리자를 확인할 수 없습니다.")
});

function getClient(client?: TherapistDailySettlementPrismaClient) {
  return client ?? (prisma as unknown as TherapistDailySettlementPrismaClient);
}

function toDateOnly(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
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

/** S7: 확인 사건은 있는데 직원 조회(findUnique)조차 없는(그 double이 흉내 내지 않는) 드문 자리에서 id만으로 행을 만든다. */
function fallbackEmployeeForId(employeeId: string): EmployeeRecord {
  return {
    id: employeeId,
    displayName: employeeId,
    staffCode: employeeId,
    employeeGroup: "THERAPIST",
    sortOrder: 9999,
    isActive: false
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
    // attachPayoutConfirmations가 실제 지급 확인으로 덮어쓴다. 여기 값은 그 전까지만 쓰는 자리표시자다.
    payoutConfirmation: derivePayoutConfirmationStatus([], 0, "작성중")
  };
}

/** 지급 확인을 쓰려는(확인/재확인/해제) 마사지사가 활성 THERAPIST인지 확인한다. */
async function assertActiveTherapist(input: { client: TherapistDailySettlementPrismaClient; employeeId: string }) {
  if (!input.client.employee.findUnique) return;

  const employee = await input.client.employee.findUnique({ where: { id: input.employeeId } });
  if (!employee) {
    throw new Error("마사지사를 찾을 수 없습니다.");
  }
  if (!employee.isActive || employee.employeeGroup !== "THERAPIST") {
    throw new Error("활성 마사지사만 지급 확인을 변경할 수 있습니다.");
  }
}

/** 그날 이 마사지사의 담당 콜 정산(현재 계산 금액)을 다시 읽는다. 확인/재확인은 이 금액을 사건에 남긴다. */
async function therapistDailySettlement(input: {
  client: TherapistDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const { settlements } = await listTherapistDailySettlements({
    operatingMonthId: input.operatingMonthId,
    serviceDate: input.serviceDate,
    prismaClient: input.client
  });
  return settlements.find((settlement) => settlement.employeeId === input.employeeId) ?? null;
}

async function assertPayoutHasSettlement(input: {
  client: TherapistDailySettlementPrismaClient;
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
}) {
  const settlement = await therapistDailySettlement(input);
  if (!settlement || settlement.totalCallCount === 0) {
    throw new Error("해당 날짜에 정산 대상 콜이 없는 마사지사는 지급 확인을 할 수 없습니다.");
  }
  return settlement;
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
      rateStatus: "missing_policy",
      call: settlementEvidenceCall(input.row)
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
      rateStatus: "missing_policy",
      call: settlementEvidenceCall(input.row)
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
    rateStatus: commissionAmount === 0 ? "zero_policy" : "applied",
    call: settlementEvidenceCall(input.row)
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

  // S7(ADR 0004): 확인 사건이 있는 단위는 그날 완료 콜이 없어도(콜이 취소·노쇼로 정정되거나 마사지사가
  // 비활성되어도) 금액 0인 행으로 남긴다. 그래야 attachPayoutConfirmations가 "지급 재확인 필요"로
  // 가리고, 마감 점검도 이 차이를 막을 수 있다.
  if (client.payoutConfirmationEvent) {
    const confirmedEmployeeIds = await listActivelyConfirmedUnitEmployeeIds({
      unitType: "THERAPIST_DAILY",
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      prismaClient: toPayoutConfirmationPrismaClient(client)
    });
    for (const employeeId of confirmedEmployeeIds) {
      if (settlementsByEmployeeId.has(employeeId)) continue;
      const employee = employeesById.get(employeeId) ?? (await client.employee.findUnique?.({ where: { id: employeeId } })) ?? null;
      settlementsByEmployeeId.set(employeeId, createSettlement(employee ?? fallbackEmployeeForId(employeeId)));
    }
  }

  const settlements = [...settlementsByEmployeeId.values()].sort((a, b) => a.sortOrder - b.sortOrder || a.staffCode.localeCompare(b.staffCode));

  return {
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    settlements: await attachPayoutConfirmationsToRows({
      unitType: "THERAPIST_DAILY",
      currentAmount: (row) => row.totalCommissionAmount,
      client,
      operatingMonthId: parsed.data.operatingMonthId,
      serviceDate: parsed.data.serviceDate,
      operatingMonthStatus: operatingMonth.status,
      rows: settlements
    }),
    warningCounts,
    excludedCallCount
  };
}

/** 운영월의 날짜 하나와 그 날짜의 마사지사별 지급 확인 상태(월 전체 집계용, 티켓 32·33). */
export type TherapistDailyPayoutConfirmationDto = {
  serviceDate: string;
  employeeId: string;
  payoutConfirmation: PayoutConfirmationDto;
};

/**
 * 이 운영월의 모든 날짜·마사지사 지급 확인 상태를 한 번에 돌려준다. 월 명세서(티켓 32)와 마감 점검의
 * "지급 재확인 미처리" 집계(티켓 33)가 쓴다. 날짜마다 listTherapistDailySettlements를 다시 계산해 현재
 * 지급액과 비교하므로(지급 재확인 필요 판정에 필요) 운영월 전체를 도는 비용이 있다(귀케어·운영팀의
 * listEarcareDailyPayoutConfirmationsForMonth·listOpsDailyPayoutConfirmationsForMonth와 같은 패턴, 티켓 31).
 */
export async function listTherapistDailyPayoutConfirmationsForMonth(input: {
  operatingMonthId: string;
  prismaClient?: TherapistDailySettlementPrismaClient;
}): Promise<TherapistDailyPayoutConfirmationDto[]> {
  const parsed = z.object({ operatingMonthId: z.string().trim().min(1, "운영월을 선택하세요.") }).safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "운영월을 선택하세요.");
  }

  const client = getClient(input.prismaClient);
  const operatingMonth = await client.operatingMonth.findUnique({ where: { id: parsed.data.operatingMonthId } });
  if (!operatingMonth) {
    throw new Error("운영월을 찾을 수 없습니다.");
  }

  const results: TherapistDailyPayoutConfirmationDto[] = [];
  for (let cursor = operatingMonth.startDate; cursor <= operatingMonth.endDate; cursor = new Date(cursor.getTime() + 86400000)) {
    const serviceDate = toIsoDate(cursor);
    const dayResult = await listTherapistDailySettlements({ operatingMonthId: parsed.data.operatingMonthId, serviceDate, prismaClient: client });
    for (const settlement of dayResult.settlements) {
      results.push({ serviceDate, employeeId: settlement.employeeId, payoutConfirmation: settlement.payoutConfirmation });
    }
  }
  return results;
}

/** 확인: 그날 계산된 금액을 지급 확인 사건으로 남긴다. 아직 확인된 사건이 없는 단위에만 쓸 수 있다. */
export async function confirmTherapistDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason?: string | null;
  prismaClient?: TherapistDailySettlementPrismaClient;
}): Promise<TherapistDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveTherapist({ client, employeeId: parsed.data.employeeId });
  const settlement = await assertPayoutHasSettlement({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await confirmPayoutConfirmation({
    unitType: "THERAPIST_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    amount: settlement.totalCommissionAmount,
    actorId: parsed.data.actorId,
    reason: input.reason ?? null,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 재확인: 금액이 바뀌어 지급 재확인 필요(또는 확인 금액 미기록)인 단위를 현재 금액으로 다시 확인한다. 사유는 필수다. */
export async function reconfirmTherapistDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: TherapistDailySettlementPrismaClient;
}): Promise<TherapistDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 재확인 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveTherapist({ client, employeeId: parsed.data.employeeId });
  const settlement = await assertPayoutHasSettlement({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await reconfirmPayoutConfirmation({
    unitType: "THERAPIST_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    amount: settlement.totalCommissionAmount,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}

/** 해제: 확인을 취소해 미확인으로 되돌린다. 정산 대상 콜 여부와 무관하게 허용한다(잘못 확인한 기록 정리). 사유는 필수다. */
export async function releaseTherapistDailySettlementPayout(input: {
  operatingMonthId: string;
  serviceDate: string;
  employeeId: string;
  actorId: string;
  reason: string;
  prismaClient?: TherapistDailySettlementPrismaClient;
}): Promise<TherapistDailySettlementPayoutResultDto> {
  const parsed = payoutUnitSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "지급 확인 해제 입력값이 올바르지 않습니다.");
  }

  const client = getClient(input.prismaClient);
  await assertActiveTherapist({ client, employeeId: parsed.data.employeeId });
  const settlement = await therapistDailySettlement({
    client,
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId
  });

  const payoutConfirmation = await releasePayoutConfirmation({
    unitType: "THERAPIST_DAILY",
    operatingMonthId: parsed.data.operatingMonthId,
    serviceDate: parsed.data.serviceDate,
    employeeId: parsed.data.employeeId,
    currentAmount: settlement?.totalCommissionAmount ?? 0,
    actorId: parsed.data.actorId,
    reason: input.reason,
    prismaClient: toPayoutConfirmationPrismaClient(client)
  });

  return { operatingMonthId: parsed.data.operatingMonthId, serviceDate: parsed.data.serviceDate, employeeId: parsed.data.employeeId, payoutConfirmation };
}
