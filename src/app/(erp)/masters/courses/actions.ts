"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  CourseDomainError,
  createCoursePolicy,
  createOpsDailyIncentiveRule,
  createOpsMonthlyIncentiveRule,
  createTherapistCourseRate,
  deactivateCourse,
  endTherapistCourseRate,
  updateCoursePolicy,
  updateOpsDailyIncentiveRule,
  updateOpsMonthlyIncentiveRule,
  updateTherapistCourseRate,
  type CourseDto,
  type CoursePolicyDto,
  type OpsDailyIncentiveRuleDto,
  type OpsMonthlyIncentiveRuleDto,
  type TherapistCourseRateDto
} from "@/modules/masters/course-service";
import {
  createCoursePolicySchema,
  createOpsDailyIncentiveRuleSchema,
  createOpsMonthlyIncentiveRuleSchema,
  createTherapistCourseRateSchema,
  deactivateCourseSchema,
  endTherapistCourseRateSchema,
  updateCoursePolicySchema,
  updateOpsDailyIncentiveRuleSchema,
  updateOpsMonthlyIncentiveRuleSchema,
  updateTherapistCourseRateSchema
} from "@/modules/masters/course-schema";

export type CourseActionState = ActionResult<CourseDto | CoursePolicyDto | TherapistCourseRateDto | OpsDailyIncentiveRuleDto | OpsMonthlyIncentiveRuleDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function coursePolicyPayload(formData: FormData) {
  return {
    policyId: formData.get("policyId"),
    courseId: formData.get("courseId"),
    name: formData.get("name"),
    durationMinutes: formData.get("durationMinutes"),
    basePrice: formData.get("basePrice"),
    opsCallCredit: formData.get("opsCallCredit"),
    earcarePoolAmount: formData.get("earcarePoolAmount"),
    requiresSecondTherapist: formData.get("requiresSecondTherapist"),
    tvDisplayName: formData.get("tvDisplayName"),
    effectiveFromMonth: formData.get("effectiveFromMonth"),
    effectiveToMonth: formData.get("effectiveToMonth")
  };
}

function therapistRatePayload(formData: FormData) {
  return {
    rateId: formData.get("rateId"),
    therapistId: formData.get("therapistId"),
    courseId: formData.get("courseId"),
    amount: formData.get("amount"),
    effectiveFromMonth: formData.get("effectiveFromMonth"),
    effectiveToMonth: formData.get("effectiveToMonth")
  };
}

function dailyRulePayload(formData: FormData) {
  return {
    ruleId: formData.get("ruleId"),
    thresholdCallCount: formData.get("thresholdCallCount"),
    personalAmount: formData.get("personalAmount"),
    effectiveFromMonth: formData.get("effectiveFromMonth"),
    effectiveToMonth: formData.get("effectiveToMonth")
  };
}

function monthlyRulePayload(formData: FormData) {
  return {
    ruleId: formData.get("ruleId"),
    thresholdCallCount: formData.get("thresholdCallCount"),
    totalAmount: formData.get("totalAmount"),
    leadShare: formData.get("leadShare"),
    counterTeamShare: formData.get("counterTeamShare"),
    waiterTeamShare: formData.get("waiterTeamShare"),
    effectiveFromMonth: formData.get("effectiveFromMonth"),
    effectiveToMonth: formData.get("effectiveToMonth")
  };
}

function mapCourseActionError(error: unknown, locale: Locale): CourseActionState {
  if (error instanceof CourseDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: t(locale, "action.error.noPermission") };
  }
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}

async function withPolicyPermission<T>(callback: (actorId: string) => Promise<T>) {
  const account = await requirePermission("employee:write");
  const data = await callback(account.id);
  revalidatePath("/masters/courses");
  return { ok: true, data } as const;
}

export async function createCoursePolicyAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = createCoursePolicySchema.safeParse(coursePolicyPayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => createCoursePolicy({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function updateCoursePolicyAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = updateCoursePolicySchema.safeParse(coursePolicyPayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => updateCoursePolicy({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function deactivateCourseAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = deactivateCourseSchema.safeParse({ courseId: formData.get("courseId") });
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => deactivateCourse({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function createTherapistCourseRateAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = createTherapistCourseRateSchema.safeParse(therapistRatePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => createTherapistCourseRate({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function updateTherapistCourseRateAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = updateTherapistCourseRateSchema.safeParse(therapistRatePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => updateTherapistCourseRate({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function endTherapistCourseRateAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = endTherapistCourseRateSchema.safeParse({ rateId: formData.get("rateId"), effectiveToMonth: formData.get("effectiveToMonth") });
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => endTherapistCourseRate({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function createOpsDailyIncentiveRuleAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = createOpsDailyIncentiveRuleSchema.safeParse(dailyRulePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => createOpsDailyIncentiveRule({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function updateOpsDailyIncentiveRuleAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = updateOpsDailyIncentiveRuleSchema.safeParse(dailyRulePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => updateOpsDailyIncentiveRule({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function createOpsMonthlyIncentiveRuleAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = createOpsMonthlyIncentiveRuleSchema.safeParse(monthlyRulePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => createOpsMonthlyIncentiveRule({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}

export async function updateOpsMonthlyIncentiveRuleAction(_previousState: CourseActionState, formData: FormData): Promise<CourseActionState> {
  const locale = await getLocale();
  const parsed = updateOpsMonthlyIncentiveRuleSchema.safeParse(monthlyRulePayload(formData));
  if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };

  try {
    return await withPolicyPermission((actorId) => updateOpsMonthlyIncentiveRule({ actorId, ...parsed.data }));
  } catch (error) {
    return mapCourseActionError(error, locale);
  }
}
