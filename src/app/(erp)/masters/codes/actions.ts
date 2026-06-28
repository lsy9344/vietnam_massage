"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  CodeDomainError,
  createCodeItem,
  createTimeSlot,
  deactivateCodeItem,
  deactivateTimeSlot,
  updateCodeItemDisplayName,
  updateCodeItemSortOrder,
  updateTimeSlotSortOrder,
  updateTimeSlotValue,
  type CodeItemDto,
  type TimeSlotDto
} from "@/modules/masters/code-service";
import {
  createCodeItemSchema,
  createTimeSlotSchema,
  deactivateCodeItemSchema,
  deactivateTimeSlotSchema,
  updateCodeItemDisplayNameSchema,
  updateCodeItemSortOrderSchema,
  updateTimeSlotSortOrderSchema,
  updateTimeSlotValueSchema
} from "@/modules/masters/code-schema";

export type CodeActionState = ActionResult<CodeItemDto> | null;
export type TimeSlotActionState = ActionResult<TimeSlotDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapCodeActionError(error: unknown, locale: Locale): ActionResult<CodeItemDto> {
  if (error instanceof CodeDomainError) {
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

function mapTimeSlotActionError(error: unknown, locale: Locale): ActionResult<TimeSlotDto> {
  if (error instanceof CodeDomainError) {
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

export async function createCodeItemAction(_previousState: CodeActionState, formData: FormData): Promise<CodeActionState> {
  const locale = await getLocale();
  const parsed = createCodeItemSchema.safeParse({
    codeType: formData.get("codeType"),
    code: formData.get("code"),
    displayName: formData.get("displayName"),
    sortOrder: formData.get("sortOrder")
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
    const data = await createCodeItem({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error, locale);
  }
}

export async function updateCodeItemDisplayNameAction(
  _previousState: CodeActionState,
  formData: FormData
): Promise<CodeActionState> {
  const locale = await getLocale();
  const parsed = updateCodeItemDisplayNameSchema.safeParse({
    codeItemId: formData.get("codeItemId"),
    displayName: formData.get("displayName")
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
    const data = await updateCodeItemDisplayName({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error, locale);
  }
}

export async function updateCodeItemSortOrderAction(
  _previousState: CodeActionState,
  formData: FormData
): Promise<CodeActionState> {
  const locale = await getLocale();
  const parsed = updateCodeItemSortOrderSchema.safeParse({
    codeItemId: formData.get("codeItemId"),
    sortOrder: formData.get("sortOrder")
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
    const data = await updateCodeItemSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error, locale);
  }
}

export async function deactivateCodeItemAction(_previousState: CodeActionState, formData: FormData): Promise<CodeActionState> {
  const locale = await getLocale();
  const parsed = deactivateCodeItemSchema.safeParse({
    codeItemId: formData.get("codeItemId")
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
    const data = await deactivateCodeItem({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapCodeActionError(error, locale);
  }
}

export async function createTimeSlotAction(_previousState: TimeSlotActionState, formData: FormData): Promise<TimeSlotActionState> {
  const locale = await getLocale();
  const parsed = createTimeSlotSchema.safeParse({
    value: formData.get("value"),
    sortOrder: formData.get("sortOrder")
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
    const data = await createTimeSlot({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error, locale);
  }
}

export async function updateTimeSlotValueAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const locale = await getLocale();
  const parsed = updateTimeSlotValueSchema.safeParse({
    timeSlotId: formData.get("timeSlotId"),
    value: formData.get("value")
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
    const data = await updateTimeSlotValue({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error, locale);
  }
}

export async function updateTimeSlotSortOrderAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const locale = await getLocale();
  const parsed = updateTimeSlotSortOrderSchema.safeParse({
    timeSlotId: formData.get("timeSlotId"),
    sortOrder: formData.get("sortOrder")
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
    const data = await updateTimeSlotSortOrder({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error, locale);
  }
}

export async function deactivateTimeSlotAction(
  _previousState: TimeSlotActionState,
  formData: FormData
): Promise<TimeSlotActionState> {
  const locale = await getLocale();
  const parsed = deactivateTimeSlotSchema.safeParse({
    timeSlotId: formData.get("timeSlotId")
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
    const data = await deactivateTimeSlot({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/codes");
    return { ok: true, data };
  } catch (error) {
    return mapTimeSlotActionError(error, locale);
  }
}
