"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { codeLabel } from "@/lib/i18n/codes";
import { saveOpsAttendanceAction, type OpsAttendanceActionState } from "@/app/(erp)/settlements/operations/actions";
import type { OpsAttendanceDto, OpsAttendanceStatusOptionDto } from "@/modules/settlements/ops-attendance-service";

function inlineError(state: OpsAttendanceActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

function attendanceLabel(locale: Locale, code: string, dbDisplayName: string) {
  return codeLabel(locale, "ATTENDANCE_STATUS", code, true, dbDisplayName);
}

function EligibilityBadge({ row, t, locale }: { row: OpsAttendanceDto; t: Translator; locale: Locale }) {
  if (row.isPayoutEligible) {
    return <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">{t("settlements.ops.payoutEligible")}</span>;
  }

  return (
    <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
      {t("settlements.ops.excluded", { reason: attendanceLabel(locale, row.statusCode, row.statusDisplayName) })}
    </span>
  );
}

function OpsAttendanceRowForm({
  attendanceDate,
  disabled,
  operatingMonthId,
  row,
  statusOptions
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  row: OpsAttendanceDto;
  statusOptions: OpsAttendanceStatusOptionDto[];
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<OpsAttendanceActionState, FormData>(saveOpsAttendanceAction, null);
  const router = useRouter();
  const formId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "statusCode");
  const savedRow = state?.ok && state.data.employeeId === row.employeeId ? state.data : null;

  useEffect(() => {
    if (savedRow) {
      router.refresh();
    }
  }, [router, savedRow]);

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
      <td className="px-3 py-2">{row.position}</td>
      <td className="px-3 py-2">
        <label className="grid max-w-48 gap-1">
          <span className="sr-only">{t("settlements.ops.attendance.workStatusAria", { name: row.displayName })}</span>
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
                {attendanceLabel(locale, option.code, option.displayName)}
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
        <EligibilityBadge row={savedRow ?? row} t={t} locale={locale} />
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

export function OpsAttendanceTable({
  attendanceDate,
  disabled,
  operatingMonthId,
  rows,
  statusOptions
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  rows: OpsAttendanceDto[];
  statusOptions: OpsAttendanceStatusOptionDto[];
}) {
  const t = useT();
  if (rows.length === 0) {
    return (
      <section className="border border-border bg-surface px-4 py-8">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.ops.attendance.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.ops.attendance.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto border border-border bg-surface">
      <table className="min-w-[860px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.opsStaff")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.position")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.workStatus")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.ops.column.payoutDecision")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.ops.column.saveStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OpsAttendanceRowForm
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
