"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { TherapistMemoDomainError, addTherapistMemo, type TherapistMemoDto } from "@/modules/therapists/therapist-memo-service";
import { addTherapistMemoSchema } from "@/modules/therapists/therapist-memo-schema";

export type TherapistMemoActionState = ActionResult<TherapistMemoDto> | null;

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapTherapistMemoActionError(error: unknown, locale: Locale): ActionResult<TherapistMemoDto> {
  if (error instanceof TherapistMemoDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: t(locale, "action.error.noPermission") };
  }
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}

/**
 * D27/M18: `therapist:manage`를 가진 관리자만 메모를 쓴다. 메모 대상 직원 id는 폼이 보내지만,
 * 작성 계정(actorId)은 언제나 이 액션이 확인한 세션 계정이다(화면이 꾸밀 수 없음).
 */
export async function addTherapistMemoAction(_previousState: TherapistMemoActionState, formData: FormData): Promise<TherapistMemoActionState> {
  const locale = await getLocale();
  const parsed = addTherapistMemoSchema.safeParse({
    employeeId: formData.get("employeeId"),
    body: formData.get("body")
  });
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors),
      formError: t(locale, "action.error.invalidInput")
    };
  }

  try {
    const account = await requirePermission("therapist:manage");
    const data = await addTherapistMemo({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistMemoActionError(error, locale);
  }
}
