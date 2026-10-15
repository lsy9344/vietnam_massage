"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import { mapAttendanceActionError } from "@/app/(erp)/settlements/attendance-action-error";
import { mapPayoutConfirmationActionError } from "@/app/(erp)/settlements/payout-confirmation-action-error";
import {
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
    return mapAttendanceActionError(error, locale);
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
