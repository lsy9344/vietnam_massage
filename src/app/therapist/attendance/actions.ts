"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { requireTherapistAccess } from "@/app/therapist/require-therapist-access";
import {
  TherapistRequestDomainError,
  requestTherapistCorrection,
  type TherapistRequestSelfDto
} from "@/modules/therapists/therapist-request-service";

export type TherapistRequestActionState = ActionResult<TherapistRequestSelfDto> | null;

/**
 * 정정 요청(스펙 D23, 티켓 09). employeeId는 requireTherapistAccess()가 돌려준 값만 쓴다(M3).
 * 요청으로 이어지는 두 자리(05의 "이미 찍음", 06의 "퇴근 미입력")가 "오늘"·근태 탭 양쪽에 있어
 * 둘 다 다시 읽는다.
 */
export async function requestTherapistCorrectionAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  const { employeeId } = await requireTherapistAccess();
  try {
    const data = await requestTherapistCorrection({
      employeeId,
      date: String(formData.get("date") ?? ""),
      requestedCheckInTime: String(formData.get("requestedCheckInTime") ?? "") || null,
      requestedCheckOutTime: String(formData.get("requestedCheckOutTime") ?? "") || null,
      reason: String(formData.get("reason") ?? "")
    });
    revalidatePath("/therapist");
    revalidatePath("/therapist/attendance");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof TherapistRequestDomainError) {
      const message = resolveDomainErrorMessage(locale, error.code, error.message);
      return { ok: false, ...(error.field ? { fieldErrors: { [error.field]: [message] } } : {}), formError: message, domainErrorCode: error.code };
    }
    return { ok: false, formError: t(locale, "action.error.saveFailed") };
  }
}
