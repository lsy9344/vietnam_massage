"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { TherapistRequestDomainError, cancelTherapistDayOffRequestForDate, requestTherapistDayOff, type TherapistRequestSelfDto } from "@/modules/therapists/therapist-request-service";

export type TherapistRequestActionState = ActionResult<TherapistRequestSelfDto> | null;

/**
 * 휴무 신청(스펙 D22). employeeId는 requireTherapistAccess()가 돌려준 값만 쓴다(M3) — 요청에서
 * 직원 id를 받지 않는다. 날짜는 근태 달력이 고른 날짜 그대로 넘어온다.
 */
export async function requestTherapistDayOffAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  const { employeeId } = await requireTherapistAccess();
  try {
    const data = await requestTherapistDayOff({
      employeeId,
      date: String(formData.get("date") ?? ""),
      kind: String(formData.get("kind") ?? "day_off"),
      reason: String(formData.get("reason") ?? "") || null
    });
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

/**
 * 신청 취소(스펙 D22). 승인 전에만, 기한이 지나지 않았을 때만 본인이 취소할 수 있다. 근태 달력은
 * 신청 id를 보여주지 않으므로(06의 TherapistAttendanceDayRequestStatus) 날짜로 찾아 취소한다.
 */
export async function cancelTherapistRequestAction(_previousState: TherapistRequestActionState, formData: FormData): Promise<TherapistRequestActionState> {
  const locale = await getLocale();
  const { employeeId, accountId } = await requireTherapistAccess();
  try {
    const data = await cancelTherapistDayOffRequestForDate({ employeeId, date: String(formData.get("date") ?? ""), actorAccountId: accountId });
    revalidatePath("/therapist/attendance");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof TherapistRequestDomainError) {
      return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
    }
    return { ok: false, formError: t(locale, "action.error.saveFailed") };
  }
}
