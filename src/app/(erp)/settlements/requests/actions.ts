"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import {
  approveTherapistCorrectionRequest,
  approveTherapistDayOffRequest,
  rejectTherapistRequest,
  type TherapistRequestAdminListItemDto
} from "@/modules/therapists/therapist-request-service";
import { mapTherapistRequestActionError } from "@/app/(erp)/settlements/requests/request-action-error";

export type TherapistRequestActionState = ActionResult<TherapistRequestAdminListItemDto> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

/** 휴무 신청 승인(M5, M18 `payout:write`). 정정 요청(kind="정정")은 approveTherapistCorrectionRequestAction이 맡는다. */
export async function approveTherapistDayOffRequestAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await approveTherapistDayOffRequest({ requestId: formValue(formData, "requestId"), actorId: account.id });
    revalidatePath("/settlements/requests");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistRequestActionError(error, locale);
  }
}

/**
 * 정정 요청 승인(M5, M18 `payout:write`, 티켓 09). 신청 카드가 kind로 이 액션과
 * approveTherapistDayOffRequestAction 중 하나를 고른다(request-workspace.tsx).
 */
export async function approveTherapistCorrectionRequestAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await approveTherapistCorrectionRequest({ requestId: formValue(formData, "requestId"), actorId: account.id });
    revalidatePath("/settlements/requests");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistRequestActionError(error, locale);
  }
}

/** 신청 거절(M5, M18). 사유가 필수다(스펙 D22·D23). 종류와 무관해 09의 정정 요청 거절도 그대로 쓴다. */
export async function rejectTherapistRequestAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await rejectTherapistRequest({
      requestId: formValue(formData, "requestId"),
      actorId: account.id,
      reason: formValue(formData, "reason")
    });
    revalidatePath("/settlements/requests");
    return { ok: true, data };
  } catch (error) {
    return mapTherapistRequestActionError(error, locale);
  }
}
