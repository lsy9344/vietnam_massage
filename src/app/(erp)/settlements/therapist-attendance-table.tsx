"use client";

import { useActionState, useId, useRef } from "react";
import { useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import {
  deactivateTherapistAttendanceAction,
  saveTherapistAttendanceAction,
  type TherapistAttendanceActionState
} from "@/app/(erp)/settlements/actions";
import type { TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";

function inlineError(state: TherapistAttendanceActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

function RecognitionBadge({ row, t }: { row: TherapistAttendanceDto; t: Translator }) {
  if (!row.isComplete) {
    return (
      <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
        {row.incompleteReason ?? t("settlements.therapist.attendance.checkInMissing")}
      </span>
    );
  }

  if (row.isFullAttendanceRecognized) {
    return (
      <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">
        {t("settlements.therapist.attendance.fullRecognized", { minutes: row.standbyMinutes ?? 0 })}
      </span>
    );
  }

  return (
    <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
      {t("settlements.therapist.attendance.fullNotRecognized", { minutes: row.standbyMinutes ?? 0 })}
    </span>
  );
}

function TherapistAttendanceRowForm({
  attendanceDate,
  disabled,
  operatingMonthId,
  row
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  row: TherapistAttendanceDto;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TherapistAttendanceActionState, FormData>(saveTherapistAttendanceAction, null);
  const [clearState, clearAction, clearPending] = useActionState<TherapistAttendanceActionState, FormData>(
    deactivateTherapistAttendanceAction,
    null
  );
  // Track which action most recently resolved so a clear after a save (or vice versa)
  // in the same mount does not show stale state from the earlier action.
  const lastAction = useRef<"save" | "clear" | null>(null);
  const formId = useId();
  const clearFormId = useId();
  const checkInErrorId = useId();
  const checkOutErrorId = useId();
  const wrappedSaveAction = (formData: FormData) => {
    lastAction.current = "save";
    return formAction(formData);
  };
  const wrappedClearAction = (formData: FormData) => {
    lastAction.current = "clear";
    return clearAction(formData);
  };
  const formError = lastAction.current === "save" ? inlineError(state) : null;
  const clearError = lastAction.current === "clear" ? inlineError(clearState) : null;
  const checkInError = lastAction.current === "save" ? inlineError(state, "checkInTime") : null;
  const checkOutError = lastAction.current === "save" ? inlineError(state, "checkOutTime") : null;
  const savedRow = state?.ok && state.data.employeeId === row.employeeId ? state.data : null;
  const clearedRow = clearState?.ok && clearState.data.employeeId === row.employeeId ? clearState.data : null;
  // The most recent successful action wins; otherwise fall back to the persisted row.
  const displayRow =
    lastAction.current === "clear" ? clearedRow ?? savedRow ?? row : savedRow ?? clearedRow ?? row;
  const busy = pending || clearPending;
  const canClear = !disabled && displayRow.isComplete;

  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="px-3 py-2">
        <form action={wrappedSaveAction} id={formId} noValidate>
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="attendanceDate" type="hidden" value={attendanceDate} />
          <input name="employeeId" type="hidden" value={row.employeeId} />
        </form>
        <form action={wrappedClearAction} id={clearFormId} noValidate>
          <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
          <input name="attendanceDate" type="hidden" value={attendanceDate} />
          <input name="employeeId" type="hidden" value={row.employeeId} />
        </form>
        <div className="font-semibold text-foreground">{row.displayName}</div>
        <div className="text-xs text-muted">{row.staffCode}</div>
      </td>
      <td className="px-3 py-2">
        <label className="grid max-w-32 gap-1">
          <span className="sr-only">{t("settlements.therapist.attendance.checkInTimeAria", { name: row.displayName })}</span>
          <input
            aria-describedby={checkInError ? checkInErrorId : undefined}
            aria-invalid={checkInError ? "true" : undefined}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none disabled:bg-readonly disabled:text-muted focus:border-brand"
            defaultValue={displayRow.checkInTime ?? ""}
            disabled={disabled || busy}
            form={formId}
            name="checkInTime"
            type="time"
          />
          {checkInError ? (
            <span className="text-xs text-danger" id={checkInErrorId} role="alert">
              {checkInError}
            </span>
          ) : null}
        </label>
      </td>
      <td className="px-3 py-2">
        <label className="grid max-w-32 gap-1">
          <span className="sr-only">{t("settlements.therapist.attendance.checkOutTimeAria", { name: row.displayName })}</span>
          <input
            aria-describedby={checkOutError ? checkOutErrorId : undefined}
            aria-invalid={checkOutError ? "true" : undefined}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none disabled:bg-readonly disabled:text-muted focus:border-brand"
            defaultValue={displayRow.checkOutTime ?? ""}
            disabled={disabled || busy}
            form={formId}
            name="checkOutTime"
            type="time"
          />
          {checkOutError ? (
            <span className="text-xs text-danger" id={checkOutErrorId} role="alert">
              {checkOutError}
            </span>
          ) : null}
        </label>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted">{displayRow.standbyMinutes ?? "—"}</td>
      <td className="px-3 py-2">
        <RecognitionBadge row={displayRow} t={t} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
            disabled={disabled || busy}
            form={formId}
            type="submit"
          >
            {pending ? t("settlements.therapist.attendance.action.saving") : formError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.save")}
          </button>
          {canClear ? (
            <button
              className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-muted hover:bg-readonly hover:text-foreground disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
              disabled={disabled || busy}
              form={clearFormId}
              type="submit"
            >
              {clearPending ? t("settlements.therapist.attendance.action.clearing") : clearError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.clear")}
            </button>
          ) : null}
          <span className="min-w-16 text-right text-xs text-muted" aria-live="polite">
            {busy
              ? t("settlements.therapist.attendance.action.saving")
              : lastAction.current === "clear" && clearedRow
                ? t("settlements.therapist.attendance.status.cleared")
                : lastAction.current === "save" && savedRow
                  ? t("settlements.therapist.attendance.status.saved")
                  : clearedRow
                    ? t("settlements.therapist.attendance.status.cleared")
                    : savedRow
                      ? t("settlements.therapist.attendance.status.saved")
                      : disabled
                        ? t("settlements.therapist.attendance.status.locked")
                        : t("settlements.therapist.attendance.status.waiting")}
          </span>
        </div>
        {formError ? (
          <div className="mt-1 text-right text-xs text-danger" role="alert">
            {t("settlements.therapist.attendance.saveFailed", { message: formError })}
          </div>
        ) : null}
        {clearError ? (
          <div className="mt-1 text-right text-xs text-danger" role="alert">
            {t("settlements.therapist.attendance.clearFailed", { message: clearError })}
          </div>
        ) : null}
      </td>
    </tr>
  );
}

export function TherapistAttendanceTable({
  attendanceDate,
  disabled,
  operatingMonthId,
  rows
}: {
  attendanceDate: string;
  disabled: boolean;
  operatingMonthId: string;
  rows: TherapistAttendanceDto[];
}) {
  const t = useT();
  if (rows.length === 0) {
    return (
      <section className="border border-border bg-surface px-4 py-8">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.therapist.attendance.empty.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.therapist.attendance.empty.description")}</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.therapist.attendance.title")}</h2>
        <p className="mt-1 text-sm text-muted">
          {t("settlements.therapist.attendance.description")}
        </p>
      </div>
      <table className="min-w-[820px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">{t("settlements.therapist.attendance.column.therapist")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.therapist.attendance.column.checkIn")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.therapist.attendance.column.checkOut")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.attendance.column.standbyMinutes")}</th>
            <th className="border-b border-border px-3 py-2">{t("settlements.therapist.attendance.column.recognition")}</th>
            <th className="border-b border-border px-3 py-2 text-right">{t("settlements.therapist.attendance.column.saveStatus")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <TherapistAttendanceRowForm
              // Key on the persisted state so a successful save/clear + revalidation
              // remounts the row, clearing useActionState and resetting time inputs.
              key={`${row.employeeId}:${attendanceDate}:${row.id ?? "none"}:${row.checkInTime ?? ""}:${row.checkOutTime ?? ""}`}
              attendanceDate={attendanceDate}
              disabled={disabled}
              operatingMonthId={operatingMonthId}
              row={row}
            />
          ))}
        </tbody>
      </table>
    </section>
  );
}
