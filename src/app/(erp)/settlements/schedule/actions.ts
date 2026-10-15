"use server";

import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError, requirePermission } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import {
  ScheduleDomainError,
  setPlannedWorkingDay,
  type PlannedWorkingDayCellResultDto,
  type PlannedWorkingDayCellStatus
} from "@/modules/settlements/schedule-service";

export type ScheduleActionState = ActionResult<PlannedWorkingDayCellResultDto> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function mapActionError(error: unknown, locale: Locale): ActionResult<PlannedWorkingDayCellResultDto> {
  if (error instanceof ScheduleDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);
    if (error.field) {
      return {
        ok: false,
        fieldErrors: { [error.field]: [message] },
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

/**
 * 근무표 칸 하나를 설정한다(티켓 27). 편집은 관리자와 정산 담당만(payout:write) 할 수 있고,
 * 다른 역할이 이 액션을 직접 호출해도 서버에서 거절된다.
 */
export async function setPlannedWorkingDayAction(
  _previousState: ScheduleActionState,
  formData: FormData
): Promise<ScheduleActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await setPlannedWorkingDay({
      employeeId: formValue(formData, "employeeId"),
      date: formValue(formData, "date"),
      status: formValue(formData, "status") as PlannedWorkingDayCellStatus,
      actorId: account.id
    });
    revalidatePath("/settlements/schedule");
    return { ok: true, data };
  } catch (error) {
    return mapActionError(error, locale);
  }
}
