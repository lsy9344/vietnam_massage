"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { getRoleLandingPath } from "@/lib/routes";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  AccountDomainError,
  deactivateUserAccount,
  issueTherapistAccount,
  resetTherapistAccountPassword,
  resetUserAccountLock
} from "@/modules/masters/account-service";
import {
  issueTherapistAccountSchema,
  resetTherapistAccountPasswordSchema,
  suspendTherapistAccountSchema,
  unlockTherapistAccountSchema
} from "@/modules/masters/employee-schema";

/**
 * Therapist 패널의 전용 발급·초기화·정지·잠금 해제 서버 액션(티켓 02). 직원 마스터의 공용 actions.ts와
 * 일부러 분리한 파일이다 — 티켓 12(내부 메모)가 같은 패널에 자기 액션을 더할 때 같은 파일을 두 사람이
 * 고치며 충돌하지 않게 한다. "나" 메뉴·첫 로그인의 본인 비밀번호 변경 액션은 Therapist 쪽
 * (app/therapist/password/actions.ts)에 따로 둔다(세션·권한 경로가 다르다).
 */

export type TherapistAccountNoticeDto = {
  accountId: string;
  temporaryPassword: string;
  /** M22: NEXTAUTH_URL + Therapist 첫 화면 주소. 쪽지 QR과 주소 줄이 이 값을 쓴다. */
  loginUrl: string;
};

export type TherapistAccountNoticeActionState = ActionResult<TherapistAccountNoticeDto> | null;
export type TherapistAccountStatusActionState = ActionResult<{ userAccountId: string }> | null;

type ActionErrorResult = { ok: false; fieldErrors?: Record<string, string[]>; formError?: string; domainErrorCode?: string };

function toFieldErrors(fieldErrors: Partial<Record<string, string[]>>) {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0)
  );
}

function mapTherapistAccountActionError(error: unknown, locale: Locale): ActionErrorResult {
  if (error instanceof AccountDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) {
    return { ok: false, formError: t(locale, "action.error.noPermission") };
  }
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}

function therapistLoginUrl() {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  return `${base}${getRoleLandingPath("therapist")}`;
}

export async function issueTherapistAccountAction(
  _previousState: TherapistAccountNoticeActionState,
  formData: FormData
): Promise<TherapistAccountNoticeActionState> {
  const locale = await getLocale();
  const parsed = issueTherapistAccountSchema.safeParse({
    employeeId: formData.get("employeeId"),
    accountId: formData.get("accountId")
  });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };
  }

  try {
    const account = await requirePermission("employee:write");
    const { account: created, oneTimeSecret } = await issueTherapistAccount({ actorId: account.id, ...parsed.data });
    revalidatePath("/masters/employees");
    return { ok: true, data: { accountId: created.accountId, temporaryPassword: oneTimeSecret, loginUrl: therapistLoginUrl() } };
  } catch (error) {
    return mapTherapistAccountActionError(error, locale);
  }
}

export async function resetTherapistAccountPasswordAction(
  _previousState: TherapistAccountNoticeActionState,
  formData: FormData
): Promise<TherapistAccountNoticeActionState> {
  const locale = await getLocale();
  const parsed = resetTherapistAccountPasswordSchema.safeParse({ userAccountId: formData.get("userAccountId") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };
  }

  try {
    const account = await requirePermission("employee:write");
    const { account: updated, oneTimeSecret } = await resetTherapistAccountPassword({
      actorId: account.id,
      userAccountId: parsed.data.userAccountId
    });
    revalidatePath("/masters/employees");
    return { ok: true, data: { accountId: updated.accountId, temporaryPassword: oneTimeSecret, loginUrl: therapistLoginUrl() } };
  } catch (error) {
    return mapTherapistAccountActionError(error, locale);
  }
}

export async function suspendTherapistAccountAction(
  _previousState: TherapistAccountStatusActionState,
  formData: FormData
): Promise<TherapistAccountStatusActionState> {
  const locale = await getLocale();
  const parsed = suspendTherapistAccountSchema.safeParse({ userAccountId: formData.get("userAccountId") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };
  }

  try {
    const account = await requirePermission("employee:write");
    const updated = await deactivateUserAccount({ actorId: account.id, userAccountId: parsed.data.userAccountId });
    revalidatePath("/masters/employees");
    return { ok: true, data: { userAccountId: updated.id } };
  } catch (error) {
    return mapTherapistAccountActionError(error, locale);
  }
}

export async function unlockTherapistAccountAction(
  _previousState: TherapistAccountStatusActionState,
  formData: FormData
): Promise<TherapistAccountStatusActionState> {
  const locale = await getLocale();
  const parsed = unlockTherapistAccountSchema.safeParse({ userAccountId: formData.get("userAccountId") });
  if (!parsed.success) {
    return { ok: false, fieldErrors: toFieldErrors(parsed.error.flatten().fieldErrors), formError: t(locale, "action.error.invalidInput") };
  }

  try {
    const account = await requirePermission("employee:write");
    const updated = await resetUserAccountLock({ actorId: account.id, userAccountId: parsed.data.userAccountId });
    revalidatePath("/masters/employees");
    return { ok: true, data: { userAccountId: updated.id } };
  } catch (error) {
    return mapTherapistAccountActionError(error, locale);
  }
}
