"use client";

import { useActionState, useId } from "react";
import { useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import { saveEarcareAttendanceAction, type EarcareAttendanceActionState } from "@/app/(erp)/settlements/earcare/actions";
import type { AttendanceStatusOptionDto, EarcareAttendanceDto } from "@/modules/settlements/earcare-attendance-service";

function inlineError(state: EarcareAttendanceActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

function EligibilityBadge({ row, t }: { row: EarcareAttendanceDto; t: Translator }) {
  if (row.isPayoutEligible) {
    return <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{t("settlements.earcare.payoutEligible")}</span>;
  }

  return (
    <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
      {t("settlements.earcare.excluded", { reason: row.exclusionReason ?? row.statusDisplayName })}
    </span>
  );
}

function EarcareAttendanceRowForm({
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
  const [state, formAction, pending] = useActionState<EarcareAttendanceActionState, FormData>(saveEarcareAttendanceAction, null);
  const formId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "statusCode");
  const savedRow = state?.ok && state.data.employeeId === row.employeeId ? state.data : null;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2">
        <form action={formAction} id={formId} noValidate>
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="attendanceDate" type="hidden" value={attendanceDate} />
          <input name="employeeId" type="hidden" value={row.employeeId} />
        </form>
          <div className="font-semibold text-foreground">{row.displayName}</div>
          <div className="text-xs text-muted">{row.staffCode}</div>
      </td>
      <td className="px-3 py-2">
        <label className="grid max-w-48 gap-1">
          <span className="sr-only">{t("settlements.earcare.attendance.workStatusAria", { name: row.displayName })}</span>
          <select
            aria-invalid={statusError ? "true" : undefined}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none disabled:bg-readonly disabled:text-muted focus:border-brand"
            defaultValue={row.statusCode}
            disabled={disabled || pending}
            form={formId}
            name="statusCode"
          >
            {statusOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.displayName}
              </option>
            ))}
          </select>
          {statusError ? (
            <span className="text-xs text-danger" role="alert">
              {statusError}
            </span>
          ) : null}
        </label>
      </td>
      <td className="px-3 py-2">
        <EligibilityBadge row={savedRow ?? row} t={t} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
            disabled={disabled || pending}
            form={formId}
            type="submit"
          >
            {pending ? t("settlements.therapist.attendance.action.saving") : formError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.save")}
          </button>
          <span className="min-w-16 text-right text-xs text-muted" aria-live="polite">
            {pending ? t("settlements.therapist.attendance.action.saving") : savedRow ? t("settlements.therapist.attendance.status.saved") : disabled ? t("settlements.therapist.attendance.status.locked") : t("settlements.therapist.attendance.status.waiting")}
          </span>
        </div>
        {formError ? (
          <div className="mt-1 text-right text-xs text-danger" role="alert">
            {t("settlements.therapist.attendance.saveFailed", { message: formError })}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export function EarcareAttendanceTable({
  attendanceDate,
  disabled,
  operatingMonthId,
  rows,
  statusOptions
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  rows: EarcareAttendanceDto[];
  statusOptions: AttendanceStatusOptionDto[];
}) {
  const t = useT();
  if (rows.length === 0) {
    return (
      <section className="border border-border bg-surface px-4 py-8">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.attendance.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.earcare.attendance.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto border border-border bg-surface">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.attendance.column.earcareStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.attendance.column.workStatus")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.earcare.attendance.column.payoutDecision")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.earcare.attendance.column.saveStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <EarcareAttendanceRowForm
              key={row.employeeId}
              attendanceDate={attendanceDate}
              disabled={disabled}
              operatingMonthId={operatingMonthId}
              row={row}
              statusOptions={statusOptions}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}
