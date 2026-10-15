"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import { codeLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { saveEarcareAttendanceAction, type EarcareAttendanceActionState } from "@/app/(erp)/settlements/earcare/actions";
import type { AttendanceStatusOptionDto, EarcareAttendanceDto } from "@/modules/settlements/earcare-attendance-service";

function inlineError(state: EarcareAttendanceActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

function attendanceLabel(locale: Locale, code: string, dbDisplayName: string) {
  return codeLabel(locale, "ATTENDANCE_STATUS", code, true, dbDisplayName);
}

/** 지급 판정 칩. 직원 비교 표의 행과 직원 패널이 함께 쓴다. */
export function EarcareEligibility({ row }: { row: Pick<EarcareAttendanceDto, "isPayoutEligible" | "statusCode" | "statusDisplayName"> }) {
  const t = useT();
  const locale = useLocale();
  return row.isPayoutEligible ? (
    <StatusIndicator label={t("settlements.earcare.payoutEligible")} tone="success" />
  ) : (
    <StatusIndicator label={t("settlements.earcare.excluded", { reason: attendanceLabel(locale, row.statusCode, row.statusDisplayName) })} tone="neutral" />
  );
}

/** 직원 패널의 근무상태 정정(정보구조 7.1). 저장하면 같은 화면의 풀 분배가 다시 계산된다. */
export function EarcareAttendanceForm({
  attendanceDate,
  disabled,
  operatingMonthId,
  row,
  statusOptions
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  row: EarcareAttendanceDto;
  statusOptions: AttendanceStatusOptionDto[];
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<EarcareAttendanceActionState, FormData>(saveEarcareAttendanceAction, null);
  const statusErrorId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "statusCode");
  const savedRow = state?.ok && state.data.employeeId === row.employeeId ? state.data : null;

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="attendanceDate" type="hidden" value={attendanceDate} />
      <input name="employeeId" type="hidden" value={row.employeeId} />
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-foreground">{t("settlements.earcare.attendance.column.workStatus")}</span>
        <select
          aria-describedby={statusError ? statusErrorId : undefined}
          aria-invalid={statusError ? "true" : undefined}
          aria-label={t("settlements.earcare.attendance.workStatusAria", { name: row.displayName })}
          className={inputFieldClassName({ invalid: Boolean(statusError) })}
          defaultValue={row.statusCode}
          disabled={disabled || pending}
          name="statusCode"
        >
          {statusOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {attendanceLabel(locale, option.code, option.displayName)}
            </option>
          ))}
        </select>
        {statusError ? (
          <span className="text-sm text-danger" id={statusErrorId} role="alert">
            {statusError}
          </span>
        ) : null}
      </label>
      <dl>
        <DetailRow label={t("settlements.earcare.attendance.column.payoutDecision")} value={<EarcareEligibility row={savedRow ?? row} />} />
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disabled || pending} type="submit">
          {pending ? t("settlements.therapist.attendance.action.saving") : formError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.save")}
        </Button>
        <span aria-live="polite" className="text-sm text-muted">
          {pending ? t("settlements.therapist.attendance.action.saving") : savedRow ? t("settlements.therapist.attendance.status.saved") : disabled ? t("settlements.therapist.attendance.status.locked") : t("settlements.therapist.attendance.status.waiting")}
        </span>
      </div>
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {t("settlements.therapist.attendance.saveFailed", { message: formError })}
        </p>
      ) : null}
    </form>
  );
}
