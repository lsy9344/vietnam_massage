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
  copyLastWeekSchedule,
  ScheduleDomainError,
  setPlannedWorkingDay,
  type PlannedWorkingDayCellResultDto,
  type PlannedWorkingDayCellStatus,
  type PlannedWorkingDayCopyResultDto
} from "@/modules/settlements/schedule-service";

export type ScheduleActionState = ActionResult<PlannedWorkingDayCellResultDto> | null;
export type ScheduleCopyActionState = ActionResult<PlannedWorkingDayCopyResultDto> | null;

function formValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function mapActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
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
      plannedStartTime: formValue(formData, "plannedStartTime"),
      actorId: account.id
    });
    revalidatePath("/settlements/schedule");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<PlannedWorkingDayCellResultDto>(error, locale);
  }
}

/**
 * 지난주 복사(티켓 28). 이 날짜가 속한 주의 미입력 칸만 바로 앞 7일의 값으로 채우고,
 * 채운 칸 수를 돌려준다. 이미 입력된 근무 예정·휴무는 덮지 않는다. 편집은 setPlannedWorkingDayAction과
 * 같은 권한(payout:write)만 할 수 있다.
 */
export async function copyLastWeekScheduleAction(
  _previousState: ScheduleCopyActionState,
  formData: FormData
): Promise<ScheduleCopyActionState> {
  const locale = await getLocale();
  try {
    const account = await requirePermission("payout:write");
    const data = await copyLastWeekSchedule({
      date: formValue(formData, "date"),
      actorId: account.id
    });
    revalidatePath("/settlements/schedule");
    return { ok: true, data };
  } catch (error) {
    return mapActionError<PlannedWorkingDayCopyResultDto>(error, locale);
  }
}
