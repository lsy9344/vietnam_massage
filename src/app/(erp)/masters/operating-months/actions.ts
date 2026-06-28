"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  changeOperatingMonthStatus,
  createOperatingMonth,
  OperatingMonthDomainError,
  type OperatingMonthDto
} from "@/modules/masters/operating-month-service";
import {
  changeOperatingMonthStatusSchema,
  createOperatingMonthSchema
} from "@/modules/masters/operating-month-schema";

export type OperatingMonthActionState = ActionResult<OperatingMonthDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapActionError(error: unknown, locale: Locale): ActionResult<OperatingMonthDto> {
  if (error instanceof OperatingMonthDomainError) {
    return {
      ok: false,
      formError: resolveDomainErrorMessage(locale, error.code, error.message),
      domainErrorCode: error.code
    };
  }

  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  return {
    ok: false,
    formError: t(locale, "action.error.saveFailed")
  };
}

export async function createOperatingMonthAction(
  _previousState: OperatingMonthActionState,
  formData: FormData
): Promise<OperatingMonthActionState> {
  const locale = await getLocale();
  const parsed = createOperatingMonthSchema.safeParse({
    monthKey: formData.get("monthKey")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await createOperatingMonth({
      actorId: account.id,
      monthKey: parsed.data.monthKey
    });
    revalidatePath("/masters/operating-months");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}

export async function changeOperatingMonthStatusAction(
  _previousState: OperatingMonthActionState,
  formData: FormData
): Promise<OperatingMonthActionState> {
  const locale = await getLocale();
  const parsed = changeOperatingMonthStatusSchema.safeParse({
    monthKey: formData.get("monthKey"),
    status: formData.get("status")
  });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("employee:write");
    const data = await changeOperatingMonthStatus({
      actorId: account.id,
      monthKey: parsed.data.monthKey,
      status: parsed.data.status
    });
    revalidatePath("/masters/operating-months");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}
