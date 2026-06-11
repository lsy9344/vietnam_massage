import { prisma } from "@/lib/prisma";
import { recordAuditEvent } from "@/modules/audit/audit-service";
import type { AuditJsonSnapshot } from "@/modules/audit/audit-event";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import {
  createCoursePolicySchema,
  createOpsDailyIncentiveRuleSchema,
  createOpsMonthlyIncentiveRuleSchema,
  createTherapistCourseRateSchema,
  deactivateCourseSchema,
  defaultCourseSeeds,
  defaultOpsDailyIncentiveSeeds,
  defaultOpsMonthlyIncentiveSeeds,
  endTherapistCourseRateSchema,
  updateCoursePolicySchema,
  updateOpsDailyIncentiveRuleSchema,
  updateOpsMonthlyIncentiveRuleSchema,
  updateTherapistCourseRateSchema,
  type CourseCode
} from "@/modules/masters/course-schema";

type CourseRecord = {
  id: string;
  code: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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
  createdAt: Date;
  updatedAt: Date;
};

type TherapistCourseRateRecord = {
  id: string;
  therapistId: string;
  courseId: string;
  amount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OpsDailyIncentiveRuleRecord = {
  id: string;
  thresholdCallCount: number;
  personalAmount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type OpsMonthlyIncentiveRuleRecord = {
  id: string;
  thresholdCallCount: number;
  totalAmount: number;
  leadShare: number;
  counterTeamShare: number;
  waiterTeamShare: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type EmployeeRecord = {
  id: string;
  staffCode: string;
  employeeGroup: string;
  isActive: boolean;
};

type OperatingMonthRecord = {
  monthKey: string;
  status: string;
};

type CoursePrismaClient = {
  course: {
    create(args: unknown): Promise<CourseRecord>;
    findMany(args?: unknown): Promise<CourseRecord[]>;
    findUnique(args: unknown): Promise<CourseRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  coursePolicy: {
    create(args: unknown): Promise<CoursePolicyRecord>;
    findMany(args?: unknown): Promise<CoursePolicyRecord[]>;
    findUnique(args: unknown): Promise<CoursePolicyRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  therapistCourseRate: {
    create(args: unknown): Promise<TherapistCourseRateRecord>;
    findMany(args?: unknown): Promise<TherapistCourseRateRecord[]>;
    findUnique(args: unknown): Promise<TherapistCourseRateRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  opsDailyIncentiveRule: {
    create(args: unknown): Promise<OpsDailyIncentiveRuleRecord>;
    findMany(args?: unknown): Promise<OpsDailyIncentiveRuleRecord[]>;
    findUnique(args: unknown): Promise<OpsDailyIncentiveRuleRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  opsMonthlyIncentiveRule: {
    create(args: unknown): Promise<OpsMonthlyIncentiveRuleRecord>;
    findMany(args?: unknown): Promise<OpsMonthlyIncentiveRuleRecord[]>;
    findUnique(args: unknown): Promise<OpsMonthlyIncentiveRuleRecord | null>;
    updateMany(args: unknown): Promise<{ count: number }>;
  };
  employee: {
    findMany(args?: unknown): Promise<EmployeeRecord[]>;
  };
  operatingMonth: {
    findMany(args?: unknown): Promise<OperatingMonthRecord[]>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $transaction?<T>(callback: (tx: CoursePrismaClient) => Promise<T>): Promise<T>;
};

export type CoursePolicyDto = Omit<CoursePolicyRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type CourseDto = Omit<CourseRecord, "code" | "createdAt" | "updatedAt"> & {
  code: CourseCode;
  currentPolicy: CoursePolicyDto | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveCourseDto = CourseDto & {
  currentPolicy: CoursePolicyDto;
};

export type TherapistCourseRateDto = Omit<TherapistCourseRateRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type OpsDailyIncentiveRuleDto = Omit<OpsDailyIncentiveRuleRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type OpsMonthlyIncentiveRuleDto = Omit<OpsMonthlyIncentiveRuleRecord, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

type MutationBase = {
  actorId: string;
  prismaClient?: CoursePrismaClient;
};

export type CreateCoursePolicyInput = MutationBase & {
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
};

export type UpdateCoursePolicyInput = Omit<CreateCoursePolicyInput, "courseId"> & {
  policyId: string;
};

export type CreateTherapistCourseRateInput = MutationBase & {
  therapistId: string;
  courseId: string;
  amount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
};

export type UpdateTherapistCourseRateInput = MutationBase & {
  rateId: string;
  amount: number;
  effectiveFromMonth: string;
  effectiveToMonth: string | null;
};

export class CourseDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "CourseDomainError";
  }
}

function getClient(client?: CoursePrismaClient) {
  return client ?? (prisma as unknown as CoursePrismaClient);
}

async function runInTransaction<T>(client: CoursePrismaClient, callback: (tx: CoursePrismaClient) => Promise<T>) {
  if (client.$transaction) {
    return client.$transaction(callback);
  }

  return callback(client);
}

function normalizeParseError(message: string) {
  return new CourseDomainError(message, "INVALID_COURSE_INPUT");
}

function isCourseCode(value: string): value is CourseCode {
  return ["A", "B", "C", "D", "E"].includes(value);
}

function assertCourseCode(value: string): asserts value is CourseCode {
  if (!isCourseCode(value)) {
    throw new CourseDomainError("코스 코드가 올바르지 않습니다.", "INVALID_COURSE_CODE");
  }
}

function toIso(value: Date) {
  return value.toISOString();
}

function toCoursePolicyDto(record: CoursePolicyRecord): CoursePolicyDto {
  return {
    ...record,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function toTherapistCourseRateDto(record: TherapistCourseRateRecord): TherapistCourseRateDto {
  return {
    ...record,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function toDailyRuleDto(record: OpsDailyIncentiveRuleRecord): OpsDailyIncentiveRuleDto {
  return {
    ...record,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function toMonthlyRuleDto(record: OpsMonthlyIncentiveRuleRecord): OpsMonthlyIncentiveRuleDto {
  return {
    ...record,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function toCourseDto(
  record: CourseRecord,
  currentPolicy: CoursePolicyDto | null,
  options: { tolerateInvalidCode?: boolean } = {}
): CourseDto {
  // 쓰기/감사 경로는 invariant를 강제하고, 조회 경로(tolerateInvalidCode)는 비표준 코드도 통과시킨다.
  if (!options.tolerateInvalidCode) {
    assertCourseCode(record.code);
  }
  return {
    ...record,
    code: record.code as CourseCode,
    currentPolicy,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt)
  };
}

function courseSnapshot(dto: CourseDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    code: dto.code,
    isActive: dto.isActive,
    currentPolicy: dto.currentPolicy ? policySnapshot(dto.currentPolicy) : null
  };
}

function policySnapshot(dto: CoursePolicyDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    courseId: dto.courseId,
    name: dto.name,
    durationMinutes: dto.durationMinutes,
    basePrice: dto.basePrice,
    opsCallCredit: dto.opsCallCredit,
    earcarePoolAmount: dto.earcarePoolAmount,
    requiresSecondTherapist: dto.requiresSecondTherapist,
    tvDisplayName: dto.tvDisplayName,
    effectiveFromMonth: dto.effectiveFromMonth,
    effectiveToMonth: dto.effectiveToMonth,
    isActive: dto.isActive
  };
}

function rateSnapshot(dto: TherapistCourseRateDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    therapistId: dto.therapistId,
    courseId: dto.courseId,
    amount: dto.amount,
    effectiveFromMonth: dto.effectiveFromMonth,
    effectiveToMonth: dto.effectiveToMonth,
    isActive: dto.isActive
  };
}

function dailyRuleSnapshot(dto: OpsDailyIncentiveRuleDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    thresholdCallCount: dto.thresholdCallCount,
    personalAmount: dto.personalAmount,
    effectiveFromMonth: dto.effectiveFromMonth,
    effectiveToMonth: dto.effectiveToMonth,
    isActive: dto.isActive
  };
}

function monthlyRuleSnapshot(dto: OpsMonthlyIncentiveRuleDto): AuditJsonSnapshot {
  return {
    id: dto.id,
    thresholdCallCount: dto.thresholdCallCount,
    totalAmount: dto.totalAmount,
    leadShare: dto.leadShare,
    counterTeamShare: dto.counterTeamShare,
    waiterTeamShare: dto.waiterTeamShare,
    effectiveFromMonth: dto.effectiveFromMonth,
    effectiveToMonth: dto.effectiveToMonth,
    isActive: dto.isActive
  };
}

async function recordAudit(
  tx: CoursePrismaClient,
  input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    beforeValue: AuditJsonSnapshot | null;
    afterValue: AuditJsonSnapshot | null;
  }
) {
  await recordAuditEvent(input, { prismaClient: tx as any });
}

function rangesOverlap(aFrom: string, aTo: string | null, bFrom: string, bTo: string | null) {
  const aEnd = aTo ?? "9999-99";
  const bEnd = bTo ?? "9999-99";
  return aFrom <= bEnd && bFrom <= aEnd;
}

function effectiveForMonth<T extends { effectiveFromMonth: string; effectiveToMonth: string | null; isActive: boolean }>(record: T, monthKey: string) {
  return record.isActive && record.effectiveFromMonth <= monthKey && (record.effectiveToMonth === null || record.effectiveToMonth >= monthKey);
}

async function getDefaultEffectiveMonth(tx: CoursePrismaClient) {
  const months = await tx.operatingMonth.findMany({ orderBy: [{ monthKey: "asc" }] });
  return months[0]?.monthKey ?? "2026-06";
}

async function assertNoClosedOperatingMonthOverlap(
  tx: CoursePrismaClient,
  input: { effectiveFromMonth: string; effectiveToMonth: string | null }
) {
  const months = await tx.operatingMonth.findMany({});
  const conflict = months.find(
    (month) =>
      isOperatingMonthPayoutLocked(month.status) &&
      rangesOverlap(month.monthKey, month.monthKey, input.effectiveFromMonth, input.effectiveToMonth)
  );
  if (conflict) {
    throw new CourseDomainError("마감확정 또는 잠금 운영월과 겹치는 정책 범위는 수정할 수 없습니다.", "OPERATING_MONTH_LOCKED");
  }
}

async function findCourseOrThrow(tx: CoursePrismaClient, courseId: string) {
  const record = await tx.course.findUnique({ where: { id: courseId } });
  if (!record) {
    throw new CourseDomainError("코스를 찾을 수 없습니다.", "COURSE_NOT_FOUND");
  }
  return record;
}

async function findPolicyOrThrow(tx: CoursePrismaClient, policyId: string) {
  const record = await tx.coursePolicy.findUnique({ where: { id: policyId } });
  if (!record) {
    throw new CourseDomainError("코스 정책을 찾을 수 없습니다.", "COURSE_POLICY_NOT_FOUND");
  }
  return record;
}

async function findRateOrThrow(tx: CoursePrismaClient, rateId: string) {
  const record = await tx.therapistCourseRate.findUnique({ where: { id: rateId } });
  if (!record) {
    throw new CourseDomainError("수당 정책을 찾을 수 없습니다.", "THERAPIST_RATE_NOT_FOUND");
  }
  return record;
}

async function findTherapistOrThrow(tx: CoursePrismaClient, therapistId: string) {
  const records = await tx.employee.findMany({ where: { id: therapistId, employeeGroup: "THERAPIST" } });
  const therapist = records[0];
  if (!therapist) {
    throw new CourseDomainError("마사지사 직원을 찾을 수 없습니다.", "THERAPIST_NOT_FOUND");
  }
  return therapist;
}

async function assertNoCoursePolicyOverlap(
  tx: CoursePrismaClient,
  input: { courseId: string; effectiveFromMonth: string; effectiveToMonth: string | null; excludeId?: string }
) {
  const policies = await tx.coursePolicy.findMany({ where: { courseId: input.courseId, isActive: true } });
  const conflict = policies.find(
    (policy) =>
      policy.id !== input.excludeId &&
      rangesOverlap(policy.effectiveFromMonth, policy.effectiveToMonth, input.effectiveFromMonth, input.effectiveToMonth)
  );
  if (conflict) {
    throw new CourseDomainError("코스 정책 적용월 범위가 겹칩니다.", "COURSE_POLICY_OVERLAP");
  }
}

async function assertNoTherapistRateOverlap(
  tx: CoursePrismaClient,
  input: { therapistId: string; courseId: string; effectiveFromMonth: string; effectiveToMonth: string | null; excludeId?: string }
) {
  const rates = await tx.therapistCourseRate.findMany({
    where: { therapistId: input.therapistId, courseId: input.courseId, isActive: true }
  });
  const conflict = rates.find(
    (rate) =>
      rate.id !== input.excludeId &&
      rangesOverlap(rate.effectiveFromMonth, rate.effectiveToMonth, input.effectiveFromMonth, input.effectiveToMonth)
  );
  if (conflict) {
    throw new CourseDomainError("수당 정책 적용월 범위가 겹칩니다.", "THERAPIST_RATE_OVERLAP");
  }
}

async function assertNoDailyRuleOverlap(
  tx: CoursePrismaClient,
  input: { thresholdCallCount: number; effectiveFromMonth: string; effectiveToMonth: string | null; excludeId?: string }
) {
  const rules = await tx.opsDailyIncentiveRule.findMany({ where: { thresholdCallCount: input.thresholdCallCount, isActive: true } });
  const conflict = rules.find(
    (rule) =>
      rule.id !== input.excludeId &&
      rangesOverlap(rule.effectiveFromMonth, rule.effectiveToMonth, input.effectiveFromMonth, input.effectiveToMonth)
  );
  if (conflict) {
    throw new CourseDomainError("운영팀 일일 인센 정책 적용월 범위가 겹칩니다.", "OPS_DAILY_RULE_OVERLAP");
  }
}

async function assertNoMonthlyRuleOverlap(
  tx: CoursePrismaClient,
  input: { thresholdCallCount: number; effectiveFromMonth: string; effectiveToMonth: string | null; excludeId?: string }
) {
  const rules = await tx.opsMonthlyIncentiveRule.findMany({ where: { thresholdCallCount: input.thresholdCallCount, isActive: true } });
  const conflict = rules.find(
    (rule) =>
      rule.id !== input.excludeId &&
      rangesOverlap(rule.effectiveFromMonth, rule.effectiveToMonth, input.effectiveFromMonth, input.effectiveToMonth)
  );
  if (conflict) {
    throw new CourseDomainError("운영팀 월 인센 정책 적용월 범위가 겹칩니다.", "OPS_MONTHLY_RULE_OVERLAP");
  }
}

function policyValuesEqual(
  policy: CoursePolicyDto,
  input: Omit<CreateCoursePolicyInput, "actorId" | "courseId" | "prismaClient"> & { effectiveToMonth: string | null }
) {
  return (
    policy.name === input.name &&
    policy.durationMinutes === input.durationMinutes &&
    policy.basePrice === input.basePrice &&
    policy.opsCallCredit === input.opsCallCredit &&
    policy.earcarePoolAmount === input.earcarePoolAmount &&
    policy.requiresSecondTherapist === input.requiresSecondTherapist &&
    policy.tvDisplayName === input.tvDisplayName &&
    policy.effectiveFromMonth === input.effectiveFromMonth &&
    policy.effectiveToMonth === input.effectiveToMonth
  );
}

function rateValuesEqual(rate: TherapistCourseRateDto, input: { amount: number; effectiveFromMonth: string; effectiveToMonth: string | null }) {
  return rate.amount === input.amount && rate.effectiveFromMonth === input.effectiveFromMonth && rate.effectiveToMonth === input.effectiveToMonth;
}

function dailyRuleValuesEqual(
  rule: OpsDailyIncentiveRuleDto,
  input: { thresholdCallCount: number; personalAmount: number; effectiveFromMonth: string; effectiveToMonth: string | null }
) {
  return (
    rule.thresholdCallCount === input.thresholdCallCount &&
    rule.personalAmount === input.personalAmount &&
    rule.effectiveFromMonth === input.effectiveFromMonth &&
    rule.effectiveToMonth === input.effectiveToMonth
  );
}

function monthlyRuleValuesEqual(
  rule: OpsMonthlyIncentiveRuleDto,
  input: {
    thresholdCallCount: number;
    totalAmount: number;
    leadShare: number;
    counterTeamShare: number;
    waiterTeamShare: number;
    effectiveFromMonth: string;
    effectiveToMonth: string | null;
  }
) {
  return (
    rule.thresholdCallCount === input.thresholdCallCount &&
    rule.totalAmount === input.totalAmount &&
    rule.leadShare === input.leadShare &&
    rule.counterTeamShare === input.counterTeamShare &&
    rule.waiterTeamShare === input.waiterTeamShare &&
    rule.effectiveFromMonth === input.effectiveFromMonth &&
    rule.effectiveToMonth === input.effectiveToMonth
  );
}

export async function ensureDefaultCoursesAndPolicies(input: { actorId: string; prismaClient?: CoursePrismaClient }) {
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const effectiveFromMonth = await getDefaultEffectiveMonth(tx);
    let coursesCreated = 0;
    let coursePoliciesCreated = 0;
    let therapistRatesCreated = 0;
    let opsDailyRulesCreated = 0;
    let opsMonthlyRulesCreated = 0;

    const coursesByCode = new Map<CourseCode, CourseRecord>();
    for (const seed of defaultCourseSeeds) {
      let course = await tx.course.findUnique({ where: { code: seed.code } });
      if (!course) {
        course = await tx.course.create({ data: { code: seed.code, isActive: true } });
        coursesCreated += 1;
        const dto = toCourseDto(course, null);
        await recordAudit(tx, {
          actorId: input.actorId,
          action: "course.created",
          targetType: "course",
          targetId: dto.id,
          beforeValue: null,
          afterValue: courseSnapshot(dto)
        });
      }
      coursesByCode.set(seed.code, course);

      const existingPolicies = await tx.coursePolicy.findMany({ where: { courseId: course.id } });
      const hasSeedPolicy = existingPolicies.some((policy) => policy.effectiveFromMonth === effectiveFromMonth);
      if (!hasSeedPolicy) {
        const policy = await tx.coursePolicy.create({
          data: {
            courseId: course.id,
            name: seed.name,
            durationMinutes: seed.durationMinutes,
            basePrice: seed.basePrice,
            opsCallCredit: seed.opsCallCredit,
            earcarePoolAmount: seed.earcarePoolAmount,
            requiresSecondTherapist: seed.requiresSecondTherapist,
            tvDisplayName: seed.tvDisplayName,
            effectiveFromMonth,
            effectiveToMonth: null,
            isActive: true
          }
        });
        coursePoliciesCreated += 1;
        const dto = toCoursePolicyDto(policy);
        await recordAudit(tx, {
          actorId: input.actorId,
          action: "course.policy_changed",
          targetType: "course_policy",
          targetId: dto.id,
          beforeValue: null,
          afterValue: policySnapshot(dto)
        });
      }
    }

    const therapists = (await tx.employee.findMany({ where: { employeeGroup: "THERAPIST" } })).filter((employee) => {
      if (!/^THR-\d{3}$/.test(employee.staffCode)) return false;
      const numericCode = Number(employee.staffCode.slice(4));
      return numericCode >= 1 && numericCode <= 50;
    });
    const amountFor = (staffCode: string, code: CourseCode) => {
      const numericCode = Number(staffCode.slice(4));
      if (numericCode >= 1 && numericCode <= 4) {
        if (code === "A") return 700000;
        if (code === "B" || code === "C") return 900000;
      }
      return 0;
    };

    for (const therapist of therapists) {
      for (const courseSeed of defaultCourseSeeds) {
        const course = coursesByCode.get(courseSeed.code);
        if (!course) continue;
        const existingRates = await tx.therapistCourseRate.findMany({
          where: { therapistId: therapist.id, courseId: course.id }
        });
        const hasSeedRate = existingRates.some((rate) => rate.effectiveFromMonth === effectiveFromMonth);
        if (hasSeedRate) continue;

        const rate = await tx.therapistCourseRate.create({
          data: {
            therapistId: therapist.id,
            courseId: course.id,
            amount: amountFor(therapist.staffCode, courseSeed.code),
            effectiveFromMonth,
            effectiveToMonth: null,
            isActive: true
          }
        });
        therapistRatesCreated += 1;
        const dto = toTherapistCourseRateDto(rate);
        await recordAudit(tx, {
          actorId: input.actorId,
          action: "therapist_course_rate.created",
          targetType: "therapist_course_rate",
          targetId: dto.id,
          beforeValue: null,
          afterValue: rateSnapshot(dto)
        });
      }
    }

    for (const seed of defaultOpsDailyIncentiveSeeds) {
      const existing = await tx.opsDailyIncentiveRule.findMany({ where: { thresholdCallCount: seed.thresholdCallCount } });
      if (existing.some((rule) => rule.effectiveFromMonth === effectiveFromMonth)) continue;
      const rule = await tx.opsDailyIncentiveRule.create({
        data: { ...seed, effectiveFromMonth, effectiveToMonth: null, isActive: true }
      });
      opsDailyRulesCreated += 1;
      const dto = toDailyRuleDto(rule);
      await recordAudit(tx, {
        actorId: input.actorId,
        action: "ops_daily_incentive_rule.created",
        targetType: "ops_daily_incentive_rule",
        targetId: dto.id,
        beforeValue: null,
        afterValue: dailyRuleSnapshot(dto)
      });
    }

    for (const seed of defaultOpsMonthlyIncentiveSeeds) {
      const existing = await tx.opsMonthlyIncentiveRule.findMany({ where: { thresholdCallCount: seed.thresholdCallCount } });
      if (existing.some((rule) => rule.effectiveFromMonth === effectiveFromMonth)) continue;
      const rule = await tx.opsMonthlyIncentiveRule.create({
        data: { ...seed, effectiveFromMonth, effectiveToMonth: null, isActive: true }
      });
      opsMonthlyRulesCreated += 1;
      const dto = toMonthlyRuleDto(rule);
      await recordAudit(tx, {
        actorId: input.actorId,
        action: "ops_monthly_incentive_rule.created",
        targetType: "ops_monthly_incentive_rule",
        targetId: dto.id,
        beforeValue: null,
        afterValue: monthlyRuleSnapshot(dto)
      });
    }

    return { coursesCreated, coursePoliciesCreated, therapistRatesCreated, opsDailyRulesCreated, opsMonthlyRulesCreated };
  });
}

export async function listCourses(options: { monthKey?: string; prismaClient?: CoursePrismaClient } = {}) {
  const client = getClient(options.prismaClient);
  const monthKey = options.monthKey ?? (await getDefaultEffectiveMonth(client));
  const courses = await client.course.findMany({ orderBy: [{ code: "asc" }] });

  return Promise.all(
    courses.map(async (course) => {
      const policies = await client.coursePolicy.findMany({ where: { courseId: course.id } });
      const currentPolicy = policies
        .filter((policy) => effectiveForMonth(policy, monthKey))
        .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
      // 조회 경로는 코드가 표준 A~E가 아니어도 throw하지 않고 코스를 그대로 통과시킨다.
      // 단일 비표준 코드 row가 전체 목록/페이지를 깨뜨리지 않게 하기 위함이며,
      // 생성/수정 같은 쓰기 경로의 assertCourseCode 검증은 그대로 유지된다.
      return toCourseDto(course, currentPolicy ? toCoursePolicyDto(currentPolicy) : null, { tolerateInvalidCode: true });
    })
  );
}

export async function listActiveCourses(options: { monthKey?: string; prismaClient?: CoursePrismaClient } = {}) {
  const courses = await listCourses(options);
  return courses.filter((course): course is ActiveCourseDto => course.isActive && course.currentPolicy !== null);
}

export async function getCoursePolicyForMonth(input: { courseId: string; monthKey: string; prismaClient?: CoursePrismaClient }) {
  const policies = await getClient(input.prismaClient).coursePolicy.findMany({ where: { courseId: input.courseId, isActive: true } });
  const policy = policies
    .filter((record) => effectiveForMonth(record, input.monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
  if (!policy) {
    throw new CourseDomainError("코스 정책을 찾을 수 없습니다.", "COURSE_POLICY_NOT_FOUND");
  }
  return toCoursePolicyDto(policy);
}

export async function getTherapistCourseRateForMonth(input: {
  therapistId: string;
  courseId: string;
  monthKey: string;
  prismaClient?: CoursePrismaClient;
}) {
  const rates = await getClient(input.prismaClient).therapistCourseRate.findMany({
    where: { therapistId: input.therapistId, courseId: input.courseId, isActive: true }
  });
  const rate = rates
    .filter((record) => effectiveForMonth(record, input.monthKey))
    .sort((a, b) => b.effectiveFromMonth.localeCompare(a.effectiveFromMonth))[0];
  if (!rate) {
    throw new CourseDomainError("수당 정책을 찾을 수 없습니다.", "THERAPIST_RATE_NOT_FOUND");
  }
  return toTherapistCourseRateDto(rate);
}

export async function listTherapistCourseRatesForMonth(input: { monthKey: string; prismaClient?: CoursePrismaClient }) {
  const rates = await getClient(input.prismaClient).therapistCourseRate.findMany({ where: { isActive: true } });
  return rates
    .filter((rate) => effectiveForMonth(rate, input.monthKey))
    .sort((a, b) => a.therapistId.localeCompare(b.therapistId) || a.courseId.localeCompare(b.courseId))
    .map(toTherapistCourseRateDto);
}

export async function listOpsDailyIncentiveRulesForMonth(input: { monthKey: string; prismaClient?: CoursePrismaClient }) {
  const rules = await getClient(input.prismaClient).opsDailyIncentiveRule.findMany({ where: { isActive: true } });
  return rules
    .filter((rule) => effectiveForMonth(rule, input.monthKey))
    .sort((a, b) => a.thresholdCallCount - b.thresholdCallCount)
    .map(toDailyRuleDto);
}

export async function listOpsMonthlyIncentiveRulesForMonth(input: { monthKey: string; prismaClient?: CoursePrismaClient }) {
  const rules = await getClient(input.prismaClient).opsMonthlyIncentiveRule.findMany({ where: { isActive: true } });
  return rules
    .filter((rule) => effectiveForMonth(rule, input.monthKey))
    .sort((a, b) => a.thresholdCallCount - b.thresholdCallCount)
    .map(toMonthlyRuleDto);
}

export async function createCoursePolicy(input: CreateCoursePolicyInput) {
  const parsed = createCoursePolicySchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "코스 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    await findCourseOrThrow(tx, parsed.data.courseId);
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoCoursePolicyOverlap(tx, parsed.data);
    const record = await tx.coursePolicy.create({ data: { ...parsed.data, isActive: true } });
    const dto = toCoursePolicyDto(record);
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "course.policy_changed",
      targetType: "course_policy",
      targetId: dto.id,
      beforeValue: null,
      afterValue: policySnapshot(dto)
    });
    return dto;
  });
}

export async function updateCoursePolicy(input: UpdateCoursePolicyInput) {
  const parsed = updateCoursePolicySchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "코스 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const current = toCoursePolicyDto(await findPolicyOrThrow(tx, parsed.data.policyId));
    if (policyValuesEqual(current, parsed.data)) return current;
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoCoursePolicyOverlap(tx, { ...parsed.data, courseId: current.courseId, excludeId: current.id });
    await tx.coursePolicy.updateMany({
      where: { id: current.id },
      data: {
        name: parsed.data.name,
        durationMinutes: parsed.data.durationMinutes,
        basePrice: parsed.data.basePrice,
        opsCallCredit: parsed.data.opsCallCredit,
        earcarePoolAmount: parsed.data.earcarePoolAmount,
        requiresSecondTherapist: parsed.data.requiresSecondTherapist,
        tvDisplayName: parsed.data.tvDisplayName,
        effectiveFromMonth: parsed.data.effectiveFromMonth,
        effectiveToMonth: parsed.data.effectiveToMonth
      }
    });
    const after = toCoursePolicyDto(await findPolicyOrThrow(tx, current.id));
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "course.policy_changed",
      targetType: "course_policy",
      targetId: after.id,
      beforeValue: policySnapshot(current),
      afterValue: policySnapshot(after)
    });
    return after;
  });
}

export async function deactivateCourse(input: { actorId: string; courseId: string; prismaClient?: CoursePrismaClient }) {
  const parsed = deactivateCourseSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "코스 비활성 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const currentRecord = await findCourseOrThrow(tx, parsed.data.courseId);
    const currentPolicy = await getCoursePolicyForMonth({ courseId: currentRecord.id, monthKey: await getDefaultEffectiveMonth(tx), prismaClient: tx }).catch(
      () => null
    );
    const before = toCourseDto(currentRecord, currentPolicy);
    if (!before.isActive) return before;
    await tx.course.updateMany({ where: { id: before.id }, data: { isActive: false } });
    const afterRecord = await findCourseOrThrow(tx, before.id);
    const after = toCourseDto(afterRecord, currentPolicy);
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "course.deactivated",
      targetType: "course",
      targetId: after.id,
      beforeValue: courseSnapshot(before),
      afterValue: courseSnapshot(after)
    });
    return after;
  });
}

export async function createTherapistCourseRate(input: CreateTherapistCourseRateInput) {
  const parsed = createTherapistCourseRateSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "수당 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    await findCourseOrThrow(tx, parsed.data.courseId);
    await findTherapistOrThrow(tx, parsed.data.therapistId);
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoTherapistRateOverlap(tx, parsed.data);
    const record = await tx.therapistCourseRate.create({ data: { ...parsed.data, isActive: true } });
    const dto = toTherapistCourseRateDto(record);
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "therapist_course_rate.created",
      targetType: "therapist_course_rate",
      targetId: dto.id,
      beforeValue: null,
      afterValue: rateSnapshot(dto)
    });
    return dto;
  });
}

export async function updateTherapistCourseRate(input: UpdateTherapistCourseRateInput) {
  const parsed = updateTherapistCourseRateSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "수당 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const current = toTherapistCourseRateDto(await findRateOrThrow(tx, parsed.data.rateId));
    if (rateValuesEqual(current, parsed.data)) return current;
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoTherapistRateOverlap(tx, {
      therapistId: current.therapistId,
      courseId: current.courseId,
      effectiveFromMonth: parsed.data.effectiveFromMonth,
      effectiveToMonth: parsed.data.effectiveToMonth,
      excludeId: current.id
    });
    await tx.therapistCourseRate.updateMany({
      where: { id: current.id },
      data: {
        amount: parsed.data.amount,
        effectiveFromMonth: parsed.data.effectiveFromMonth,
        effectiveToMonth: parsed.data.effectiveToMonth
      }
    });
    const after = toTherapistCourseRateDto(await findRateOrThrow(tx, current.id));
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "therapist_course_rate.changed",
      targetType: "therapist_course_rate",
      targetId: after.id,
      beforeValue: rateSnapshot(current),
      afterValue: rateSnapshot(after)
    });
    return after;
  });
}

export async function endTherapistCourseRate(input: { actorId: string; rateId: string; effectiveToMonth: string; prismaClient?: CoursePrismaClient }) {
  const parsed = endTherapistCourseRateSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "수당 정책 종료월 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);

  return runInTransaction(client, async (tx) => {
    const current = toTherapistCourseRateDto(await findRateOrThrow(tx, parsed.data.rateId));
    if (parsed.data.effectiveToMonth < current.effectiveFromMonth) {
      throw new CourseDomainError("정책 종료월은 시작월보다 빠를 수 없습니다.", "THERAPIST_RATE_INVALID_END_MONTH");
    }
    if (current.effectiveToMonth === parsed.data.effectiveToMonth) return current;
    await assertNoClosedOperatingMonthOverlap(tx, {
      effectiveFromMonth: current.effectiveFromMonth,
      effectiveToMonth: parsed.data.effectiveToMonth
    });
    await tx.therapistCourseRate.updateMany({
      where: { id: current.id },
      data: { effectiveToMonth: parsed.data.effectiveToMonth }
    });
    const after = toTherapistCourseRateDto(await findRateOrThrow(tx, current.id));
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "therapist_course_rate.ended",
      targetType: "therapist_course_rate",
      targetId: after.id,
      beforeValue: rateSnapshot(current),
      afterValue: rateSnapshot(after)
    });
    return after;
  });
}

export async function createOpsDailyIncentiveRule(input: MutationBase & Omit<OpsDailyIncentiveRuleDto, "id" | "createdAt" | "updatedAt" | "isActive">) {
  const parsed = createOpsDailyIncentiveRuleSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "일일 인센 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);
  return runInTransaction(client, async (tx) => {
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoDailyRuleOverlap(tx, parsed.data);
    const dto = toDailyRuleDto(await tx.opsDailyIncentiveRule.create({ data: { ...parsed.data, isActive: true } }));
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "ops_daily_incentive_rule.created",
      targetType: "ops_daily_incentive_rule",
      targetId: dto.id,
      beforeValue: null,
      afterValue: dailyRuleSnapshot(dto)
    });
    return dto;
  });
}

export async function updateOpsDailyIncentiveRule(input: MutationBase & Omit<OpsDailyIncentiveRuleDto, "id" | "createdAt" | "updatedAt" | "isActive"> & { ruleId: string }) {
  const parsed = updateOpsDailyIncentiveRuleSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "일일 인센 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);
  return runInTransaction(client, async (tx) => {
    const currentRecord = await tx.opsDailyIncentiveRule.findUnique({ where: { id: parsed.data.ruleId } });
    if (!currentRecord) throw new CourseDomainError("일일 인센 정책을 찾을 수 없습니다.", "OPS_DAILY_RULE_NOT_FOUND");
    const current = toDailyRuleDto(currentRecord);
    if (dailyRuleValuesEqual(current, parsed.data)) return current;
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoDailyRuleOverlap(tx, { ...parsed.data, excludeId: current.id });
    await tx.opsDailyIncentiveRule.updateMany({
      where: { id: current.id },
      data: {
        thresholdCallCount: parsed.data.thresholdCallCount,
        personalAmount: parsed.data.personalAmount,
        effectiveFromMonth: parsed.data.effectiveFromMonth,
        effectiveToMonth: parsed.data.effectiveToMonth
      }
    });
    const afterRecord = await tx.opsDailyIncentiveRule.findUnique({ where: { id: current.id } });
    if (!afterRecord) throw new CourseDomainError("일일 인센 정책을 찾을 수 없습니다.", "OPS_DAILY_RULE_NOT_FOUND");
    const after = toDailyRuleDto(afterRecord);
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "ops_daily_incentive_rule.changed",
      targetType: "ops_daily_incentive_rule",
      targetId: after.id,
      beforeValue: dailyRuleSnapshot(current),
      afterValue: dailyRuleSnapshot(after)
    });
    return after;
  });
}

export async function createOpsMonthlyIncentiveRule(input: MutationBase & Omit<OpsMonthlyIncentiveRuleDto, "id" | "createdAt" | "updatedAt" | "isActive">) {
  const parsed = createOpsMonthlyIncentiveRuleSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "월 인센 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);
  return runInTransaction(client, async (tx) => {
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoMonthlyRuleOverlap(tx, parsed.data);
    const dto = toMonthlyRuleDto(await tx.opsMonthlyIncentiveRule.create({ data: { ...parsed.data, isActive: true } }));
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "ops_monthly_incentive_rule.created",
      targetType: "ops_monthly_incentive_rule",
      targetId: dto.id,
      beforeValue: null,
      afterValue: monthlyRuleSnapshot(dto)
    });
    return dto;
  });
}

export async function updateOpsMonthlyIncentiveRule(input: MutationBase & Omit<OpsMonthlyIncentiveRuleDto, "id" | "createdAt" | "updatedAt" | "isActive"> & { ruleId: string }) {
  const parsed = updateOpsMonthlyIncentiveRuleSchema.safeParse(input);
  if (!parsed.success) throw normalizeParseError(parsed.error.issues[0]?.message ?? "월 인센 정책 입력값이 올바르지 않습니다.");
  const client = getClient(input.prismaClient);
  return runInTransaction(client, async (tx) => {
    const currentRecord = await tx.opsMonthlyIncentiveRule.findUnique({ where: { id: parsed.data.ruleId } });
    if (!currentRecord) throw new CourseDomainError("월 인센 정책을 찾을 수 없습니다.", "OPS_MONTHLY_RULE_NOT_FOUND");
    const current = toMonthlyRuleDto(currentRecord);
    if (monthlyRuleValuesEqual(current, parsed.data)) return current;
    await assertNoClosedOperatingMonthOverlap(tx, parsed.data);
    await assertNoMonthlyRuleOverlap(tx, { ...parsed.data, excludeId: current.id });
    await tx.opsMonthlyIncentiveRule.updateMany({
      where: { id: current.id },
      data: {
        thresholdCallCount: parsed.data.thresholdCallCount,
        totalAmount: parsed.data.totalAmount,
        leadShare: parsed.data.leadShare,
        counterTeamShare: parsed.data.counterTeamShare,
        waiterTeamShare: parsed.data.waiterTeamShare,
        effectiveFromMonth: parsed.data.effectiveFromMonth,
        effectiveToMonth: parsed.data.effectiveToMonth
      }
    });
    const afterRecord = await tx.opsMonthlyIncentiveRule.findUnique({ where: { id: current.id } });
    if (!afterRecord) throw new CourseDomainError("월 인센 정책을 찾을 수 없습니다.", "OPS_MONTHLY_RULE_NOT_FOUND");
    const after = toMonthlyRuleDto(afterRecord);
    await recordAudit(tx, {
      actorId: input.actorId,
      action: "ops_monthly_incentive_rule.changed",
      targetType: "ops_monthly_incentive_rule",
      targetId: after.id,
      beforeValue: monthlyRuleSnapshot(current),
      afterValue: monthlyRuleSnapshot(after)
    });
    return after;
  });
}
