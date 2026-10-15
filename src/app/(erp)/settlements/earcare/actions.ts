"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { mapPayoutConfirmationActionError } from "@/app/(erp)/settlements/payout-confirmation-action-error";
import {
  EarcareAttendanceDomainError,
  upsertEarcareAttendance,
  type EarcareAttendanceDto
} from "@/modules/settlements/earcare-attendance-service";
import {
  confirmEarcareDailySettlementPayout,
  reconfirmEarcareDailySettlementPayout,
  releaseEarcareDailySettlementPayout,
  type EarcareDailySettlementPayoutResultDto
} from "@/modules/settlements/earcare-daily-settlement-service";

export type EarcareAttendanceActionState = ActionResult<EarcareAttendanceDto> | null;
export type EarcareDailySettlementPayoutActionState = ActionResult<EarcareDailySettlementPayoutResultDto> | null;

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

function mapActionError(error: unknown, locale: Locale): ActionResult<EarcareAttendanceDto> {
  if (error instanceof EarcareAttendanceDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);

    if (error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE") {
      return {
        ok: false,
        fieldErrors: { attendanceDate: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "ATTENDANCE_STATUS_NOT_FOUND") {
      return {
        ok: false,
        fieldErrors: { statusCode: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "EARCARE_EMPLOYEE_NOT_FOUND") {
      return {
        ok: false,
        fieldErrors: { employeeId: [message] },
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

export async function saveEarcareAttendanceAction(
  _previousState: EarcareAttendanceActionState,
  formData: FormData
): Promise<EarcareAttendanceActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await upsertEarcareAttendance({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      attendanceDate: String(formValue(formData, "attendanceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      statusCode: String(formValue(formData, "statusCode") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/earcare");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}

export async function confirmEarcareDailySettlementPayoutAction(
  _previousState: EarcareDailySettlementPayoutActionState,
  formData: FormData
): Promise<EarcareDailySettlementPayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await confirmEarcareDailySettlementPayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/earcare");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function reconfirmEarcareDailySettlementPayoutAction(
  _previousState: EarcareDailySettlementPayoutActionState,
  formData: FormData
): Promise<EarcareDailySettlementPayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await reconfirmEarcareDailySettlementPayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/earcare");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function releaseEarcareDailySettlementPayoutAction(
  _previousState: EarcareDailySettlementPayoutActionState,
  formData: FormData
): Promise<EarcareDailySettlementPayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await releaseEarcareDailySettlementPayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/earcare");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}
