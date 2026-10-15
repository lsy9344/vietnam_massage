"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import { mapPayoutConfirmationActionError } from "@/app/(erp)/settlements/payout-confirmation-action-error";
import {
  confirmOpsMonthlyIncentivePayout,
  reconfirmOpsMonthlyIncentivePayout,
  releaseOpsMonthlyIncentivePayout,
  type OpsMonthlyIncentivePayoutResultDto
} from "@/modules/settlements/ops-monthly-incentive-service";

export type OpsMonthlyIncentivePayoutActionState = ActionResult<OpsMonthlyIncentivePayoutResultDto> | null;

function formValue(formData: FormData, key: string) {
  return formData.get(key);
}

/** 확인: 사유 없이 바로 쓴다. 월 단위라 serviceDate는 읽지 않는다(폼의 hidden 자리표시자는 공용 컴포넌트가 늘 보낸다). */
export async function confirmOpsMonthlyIncentivePayoutAction(
  _previousState: OpsMonthlyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsMonthlyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await confirmOpsMonthlyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations/monthly");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function reconfirmOpsMonthlyIncentivePayoutAction(
  _previousState: OpsMonthlyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsMonthlyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await reconfirmOpsMonthlyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations/monthly");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}

export async function releaseOpsMonthlyIncentivePayoutAction(
  _previousState: OpsMonthlyIncentivePayoutActionState,
  formData: FormData
): Promise<OpsMonthlyIncentivePayoutActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await releaseOpsMonthlyIncentivePayout({
      operatingMonthId: String(formValue(formData, "operatingMonthId") ?? ""),
      employeeId: String(formValue(formData, "employeeId") ?? ""),
      reason: String(formValue(formData, "reason") ?? ""),
      actorId: account.id
    });
    revalidatePath("/settlements/operations/monthly");
    return { ok: true, data };
  } catch (error) {
    return mapPayoutConfirmationActionError(error, locale);
  }
}
