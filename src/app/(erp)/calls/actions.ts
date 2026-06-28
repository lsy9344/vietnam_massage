"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";
import {
  autosaveServiceCallRow,
  createDailyExpense,
  deactivateDailyExpense,
  updateDailyExpense,
  redactServiceCallSettlementAmounts,
  saveBasicServiceCallRow,
  ServiceCallDomainError,
  type DailyExpenseDto,
  type ServiceCallRowDto
} from "@/modules/calls/service-call-service";
import {
  dailyExpenseDeactivateSchema,
  dailyExpenseInputSchema,
  dailyExpenseUpdateSchema,
  serviceCallAutosaveInputSchema,
  serviceCallInputSchema,
  type ServiceCallAutosaveInput
} from "@/modules/calls/service-call-schema";

export type ServiceCallActionState = ActionResult<ServiceCallRowDto> | null;
export type DailyExpenseActionState = ActionResult<DailyExpenseDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>, locale: Locale) {
  return Object.fromEntries(
    Object.entries(fieldErrors)
      .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
      // Zod 한국어 메시지를 inline field error 표시 직전에 locale로 번역한다.
      .map(([field, messages]) => [field, messages.map((message) => resolveKoreanMessage(locale, message))])
  );
}

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function mapActionError<T>(
  error: unknown,
  locale: Locale,
  fieldMap: { dateField: "serviceDate" | "expenseDate"; handlerField?: "handledByEmployeeId" } = { dateField: "serviceDate" }
): ActionResult<T> {
  if (error instanceof ServiceCallDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);

    if (error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED") {
      return {
        ok: false,
        fieldErrors: { therapist2Id: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "INVALID_DAILY_EXPENSE_INPUT") {
      return {
        ok: false,
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "EMPLOYEE_NOT_ACTIVE" && fieldMap.handlerField) {
      return {
        ok: false,
        fieldErrors: { [fieldMap.handlerField]: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE") {
      return {
        ok: false,
        fieldErrors: { [fieldMap.dateField]: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "ROOM_REQUIRED_FOR_STATUS") {
      return {
        ok: false,
        fieldErrors: { roomId: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    return {
      ok: false,
      formError: message,
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  if (error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: t(locale, "action.error.auditFailed"),
      domainErrorCode: error.code
    };
  }

  return {
    ok: false,
    formError: t(locale, "action.error.saveFailed")
  };
}

function canViewSettlementAmounts(role: string) {
  return role === "administrator" || role === "settlement_manager";
}

function visibleServiceCallRowForRole(row: ServiceCallRowDto, role: string) {
  return canViewSettlementAmounts(role) ? row : redactServiceCallSettlementAmounts(row);
}

export async function saveBasicServiceCallRowAction(
  _previousState: ServiceCallActionState,
  formData: FormData
): Promise<ServiceCallActionState> {
  const locale = await getLocale();
  const parsed = serviceCallInputSchema.safeParse({
    serviceCallId: formValue(formData, "serviceCallId"),
    operatingMonthId: formValue(formData, "operatingMonthId"),
    serviceDate: formValue(formData, "serviceDate"),
    startTime: formValue(formData, "startTime"),
    roomId: formValue(formData, "roomId"),
    courseId: formValue(formData, "courseId"),
    customerMemo: formValue(formData, "customerMemo"),
    therapist1Id: formValue(formData, "therapist1Id"),
    therapist2Id: formValue(formData, "therapist2Id"),
    earcareEmployeeId: formValue(formData, "earcareEmployeeId"),
    status: formValue(formData, "status"),
    discountTypeCode: formValue(formData, "discountTypeCode"),
    paymentMethodCode: formValue(formData, "paymentMethodCode"),
    note: formValue(formData, "note"),
    confirmationCode: formValue(formData, "confirmationCode")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await saveBasicServiceCallRow(parsed.data);
    revalidatePath("/calls");
    return { ok: true, data: visibleServiceCallRowForRole(data, account.role) };
  } catch (error) {
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

export async function autosaveServiceCallRowAction(input: ServiceCallAutosaveInput): Promise<ActionResult<ServiceCallRowDto>> {
  const locale = await getLocale();
  const parsed = serviceCallAutosaveInputSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await autosaveServiceCallRow({
      ...parsed.data,
      actorId: account.id
    });
    revalidatePath("/calls");
    return { ok: true, data: visibleServiceCallRowForRole(data, account.role) };
  } catch (error) {
    return mapActionError<ServiceCallRowDto>(error, locale);
  }
}

export async function createDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseInputSchema.safeParse({
    operatingMonthId: formValue(formData, "operatingMonthId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    description: formValue(formData, "description"),
    handledByEmployeeId: formValue(formData, "handledByEmployeeId"),
    note: formValue(formData, "note")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await createDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}

export async function updateDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseUpdateSchema.safeParse({
    dailyExpenseId: formValue(formData, "dailyExpenseId"),
    operatingMonthId: formValue(formData, "operatingMonthId"),
    expenseDate: formValue(formData, "expenseDate"),
    amount: formValue(formData, "amount"),
    description: formValue(formData, "description"),
    handledByEmployeeId: formValue(formData, "handledByEmployeeId"),
    note: formValue(formData, "note")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await updateDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}

export async function deactivateDailyExpenseAction(
  _previousState: DailyExpenseActionState,
  formData: FormData
): Promise<DailyExpenseActionState> {
  const locale = await getLocale();
  const parsed = dailyExpenseDeactivateSchema.safeParse({
    dailyExpenseId: formValue(formData, "dailyExpenseId")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors, locale),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("call:write");
    const data = await deactivateDailyExpense({ ...parsed.data, actorId: account.id });
    revalidatePath("/calls");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<DailyExpenseDto>(error, locale, { dateField: "expenseDate", handlerField: "handledByEmployeeId" });
  }
}
