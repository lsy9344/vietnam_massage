"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { inputFieldClassName } from "@/components/ui/input-field";
import { useLocale, useT } from "@/lib/i18n/client";
import { scheduleStatusLabel } from "@/lib/i18n/codes";
import { setPlannedWorkingDayAction, type ScheduleActionState } from "@/app/(erp)/settlements/schedule/actions";
import { ALL_SCHEDULE_CELL_STATUSES } from "@/app/(erp)/settlements/schedule/schedule-view-model";
import type { PlannedWorkingDayCellStatus } from "@/modules/settlements/schedule-service";

function inlineError(state: ScheduleActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

/**
 * 근무표 패널의 요일 한 줄(티켓 27). 고른 직원의 패널 안에 요일마다 하나씩 쌓인다.
 * 선택·저장만 하고, 그 칸에 배정된 콜 목록(휴무 영향 콜)은 28에서 더한다.
 */
export function ScheduleCellForm({
  employeeId,
  employeeName,
  date,
  weekdayLabel,
  status
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  weekdayLabel: string;
  status: PlannedWorkingDayCellStatus;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<ScheduleActionState, FormData>(setPlannedWorkingDayAction, null);
  const statusErrorId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "status");
  const saved = state?.ok && state.data.employeeId === employeeId && state.data.date === date;

  return (
    <form action={formAction} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-2 border-b border-border py-2 last:border-b-0" noValidate>
      <input name="employeeId" type="hidden" value={employeeId} />
      <input name="date" type="hidden" value={date} />
      <span className="text-sm font-semibold text-foreground">
        {weekdayLabel}
        <span className="block text-xs font-normal text-muted">{date.slice(5)}</span>
      </span>
      <label className="grid gap-1">
        <span className="sr-only">{t("settlements.schedule.cell.statusLabel")}</span>
        <select
          aria-describedby={statusError ? statusErrorId : undefined}
          aria-invalid={statusError ? "true" : undefined}
          aria-label={t("settlements.schedule.cell.statusAria", { name: employeeName, date })}
          className={inputFieldClassName({ invalid: Boolean(statusError) })}
          defaultValue={status}
          disabled={pending}
          name="status"
        >
          {ALL_SCHEDULE_CELL_STATUSES.map((value) => (
            <option key={value} value={value}>
              {scheduleStatusLabel(locale, value)}
            </option>
          ))}
        </select>
      </label>
      <div className="grid justify-items-end gap-1">
        <Button disabled={pending} type="submit">
          {pending
            ? t("settlements.therapist.attendance.action.saving")
            : formError
              ? t("settlements.therapist.attendance.action.retry")
              : t("settlements.therapist.attendance.action.save")}
        </Button>
        <span aria-live="polite" className="text-xs text-muted">
          {pending
            ? t("settlements.therapist.attendance.action.saving")
            : saved
              ? t("settlements.therapist.attendance.status.saved")
              : null}
        </span>
      </div>
      {statusError ? (
        <span className="col-span-3 text-sm text-danger" id={statusErrorId} role="alert">
          {statusError}
        </span>
      ) : formError ? (
        <p className="col-span-3 text-sm text-danger" role="alert">
          {t("settlements.therapist.attendance.saveFailed", { message: formError })}
        </p>
      ) : null}
    </form>
  );
}
