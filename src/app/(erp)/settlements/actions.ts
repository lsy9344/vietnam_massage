"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { parseTherapistDailySettlementPaymentIsPaid } from "@/app/(erp)/settlements/payment-action-input";
import { mapTherapistDailySettlementPaymentActionError } from "@/app/(erp)/settlements/payment-action-error";
import {
  TherapistAttendanceDomainError,
  deactivateTherapistAttendance,
  upsertTherapistAttendance,
  type TherapistAttendanceDto
} from "@/modules/settlements/therapist-attendance-service";
import { setTherapistDailySettlementPayment } from "@/modules/settlements/therapist-daily-settlement-service";

export type TherapistAttendanceActionState = ActionResult<TherapistAttendanceDto> | null;
type TherapistDailySettlementPaymentActionData = Awaited<ReturnType<typeof setTherapistDailySettlementPayment>>;
export type TherapistDailySettlementPaymentActionState = ActionResult<TherapistDailySettlementPaymentActionData> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function mapActionError(error: unknown, locale: Locale): ActionResult<TherapistAttendanceDto> {
  if (error instanceof TherapistAttendanceDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);

    if (error.code === "OPERATING_MONTH_DATE_OUT_OF_RANGE") {
      return {
        ok: false,
        fieldErrors: { attendanceDate: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "THERAPIST_EMPLOYEE_NOT_FOUND") {
      return {
        ok: false,
        fieldErrors: { employeeId: [message] },
        formError: message,
        domainErrorCode: error.code
      };
    }

    if (error.code === "INVALID_THERAPIST_ATTENDANCE_INPUT") {
      // Map the error to the specific field that failed; only fall back to both time
      // inputs when the failing field is genuinely ambiguous.
      const fieldErrors = error.field
        ? { [error.field]: [message] }
        : { checkInTime: [message], checkOutTime: [message] };
      return {
        ok: false,
        fieldErrors,
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

function mapPaymentActionError(error: unknown, locale: Locale): ActionResult<TherapistDailySettlementPaymentActionData> {
  return mapTherapistDailySettlementPaymentActionError(error, locale);
}

export async function saveTherapistAttendanceAction(
  _previousState: TherapistAttendanceActionState,
  formData: FormData
): Promise<TherapistAttendanceActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await upsertTherapistAttendance({
      operatingMonthId: formValue(formData, "operatingMonthId"),
      attendanceDate: formValue(formData, "attendanceDate"),
      employeeId: formValue(formData, "employeeId"),
      checkInTime: formValue(formData, "checkInTime"),
      checkOutTime: formValue(formData, "checkOutTime"),
      actorId: account.id
    });
    revalidatePath("/settlements");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}

export async function deactivateTherapistAttendanceAction(
  _previousState: TherapistAttendanceActionState,
  formData: FormData
): Promise<TherapistAttendanceActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await deactivateTherapistAttendance({
      operatingMonthId: formValue(formData, "operatingMonthId"),
      attendanceDate: formValue(formData, "attendanceDate"),
      employeeId: formValue(formData, "employeeId"),
      actorId: account.id
    });
    revalidatePath("/settlements");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}

export async function setTherapistDailySettlementPaymentAction(
  _previousState: TherapistDailySettlementPaymentActionState,
  formData: FormData
): Promise<TherapistDailySettlementPaymentActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await setTherapistDailySettlementPayment({
      operatingMonthId: formValue(formData, "operatingMonthId"),
      serviceDate: formValue(formData, "serviceDate"),
      employeeId: formValue(formData, "employeeId"),
      isPaid: parseTherapistDailySettlementPaymentIsPaid(formValue(formData, "isPaid")),
      actorId: account.id
    });
    revalidatePath("/settlements");
    return { ok: true, data };
  } catch (error) {
    return mapPaymentActionError(error, locale);
  }
}
