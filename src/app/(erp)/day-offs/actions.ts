"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { requirePermission } from "@/lib/authorization";
import { getLocale } from "@/lib/i18n/server";
import {
  cancelTherapistDayOffRegistration,
  registerTherapistDayOffPeriod,
  type TherapistDayOffRegistrationResultDto
} from "@/modules/therapists/therapist-request-service";
import { mapTherapistRequestActionError } from "@/app/(erp)/settlements/requests/request-action-error";

export type DayOffRegistrationActionState = ActionResult<TherapistDayOffRegistrationResultDto> | null;
export type DayOffCancelActionState = ActionResult<{ canceledCount: number }> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

// 휴무는 근무표와 Therapist 근태 탭에 함께 보인다.
function revalidateDayOffScreens() {
  revalidatePath("/day-offs");
  revalidatePath("/settlements/schedule");
  revalidatePath("/therapist/attendance");
}

/** 휴무 기간 등록(dayoff:write — 카운터·관리자). */
export async function registerTherapistDayOffPeriodAction(_previousState: DayOffRegistrationActionState, formData: FormData): Promise<DayOffRegistrationActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("dayoff:write");
    const data = await registerTherapistDayOffPeriod({
      employeeId: formValue(formData, "employeeId"),
      kind: formValue(formData, "kind"),
      startDate: formValue(formData, "startDate"),
      endDate: formValue(formData, "endDate"),
      reason: formValue(formData, "reason") || null,
      actorId: account.id
    });
    revalidateDayOffScreens();
    return { ok: true, data };
  } catch (error) {
    return mapTherapistRequestActionError(error, locale);
  }
}

/** 휴무 등록 취소(dayoff:write). 등록을 이루는 날짜별 신청 id를 모두 받는다. */
export async function cancelTherapistDayOffRegistrationAction(_previousState: DayOffCancelActionState, formData: FormData): Promise<DayOffCancelActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("dayoff:write");
    const data = await cancelTherapistDayOffRegistration({
      requestIds: formData.getAll("requestId").map(String),
      actorId: account.id
    });
    revalidateDayOffScreens();
    return { ok: true, data };
  } catch (error) {
    return mapTherapistRequestActionError(error, locale);
  }
}
