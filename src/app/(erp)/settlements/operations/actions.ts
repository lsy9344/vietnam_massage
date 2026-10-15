"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import { mapAttendanceActionError } from "@/app/(erp)/settlements/attendance-action-error";
import { mapPayoutConfirmationActionError } from "@/app/(erp)/settlements/payout-confirmation-action-error";
import {
  upsertOpsAttendance,
  type OpsAttendanceDto
} from "@/modules/settlements/ops-attendance-service";
import {
  confirmOpsDailyIncentivePayout,
  reconfirmOpsDailyIncentivePayout,
  releaseOpsDailyIncentivePayout,
  type OpsDailyIncentivePayoutResultDto
} from "@/modules/settlements/ops-daily-incentive-service";

export type OpsAttendanceActionState = ActionResult<OpsAttendanceDto> | null;
export type OpsDailyIncentivePayoutActionState = ActionResult<OpsDailyIncentivePayoutResultDto> | null;

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

export async function saveOpsAttendanceAction(
  _previousState: OpsAttendanceActionState,
  formData: FormData
): Promise<OpsAttendanceActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await upsertOpsAttendance({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      attendanceDate: String(formValue(formData, "attendanceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      statusCode: String(formValue(formData, "statusCode") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations");
    return { ok: true, data };
  } catch (error) {
    return mapAttendanceActionError(error, locale);
  }
}

export async function confirmOpsDailyIncentivePayoutAction(
  _previousState: OpsDailyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsDailyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await confirmOpsDailyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function reconfirmOpsDailyIncentivePayoutAction(
  _previousState: OpsDailyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsDailyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await reconfirmOpsDailyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function releaseOpsDailyIncentivePayoutAction(
  _previousState: OpsDailyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsDailyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await releaseOpsDailyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      serviceDate: String(formValue(formData, "serviceDate") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}
