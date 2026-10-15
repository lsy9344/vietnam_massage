"use client";

import { useActionState, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
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

function recognitionText(row: TherapistAttendanceDto, t: Translator) {
  if (!row.isComplete) {
    // Check-in-only row: standby is unknown until checkout is saved.
    return row.checkInTime ? t("settlements.therapist.attendance.checkOutMissing") : t("settlements.therapist.attendance.checkInMissing");
  }
  return row.isFullAttendanceRecognized
    ? t("settlements.therapist.attendance.fullRecognized", { minutes: row.standbyMinutes ?? 0 })
    : t("settlements.therapist.attendance.fullNotRecognized", { minutes: row.standbyMinutes ?? 0 });
}

/** 만근 판정 칩. 직원 비교 표의 행과 직원 패널이 함께 쓴다. */
export function AttendanceRecognition({ row }: { row: TherapistAttendanceDto }) {
  const t = useT();
  return <StatusIndicator label={recognitionText(row, t)} tone={row.isComplete && row.isFullAttendanceRecognized ? "success" : "neutral"} />;
}

/**
 * 직원 패널의 출퇴근 정정(정보구조 7.1: 출퇴근 정정은 직원 패널에서 한다). 저장하면 대기시간과 만근 판정이 다시 계산된다.
 * 부르는 쪽은 저장된 값이 바뀌면 다시 마운트되도록 key를 준다.
 */
export function TherapistAttendanceForm({
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
  // Clearable while a persisted row exists — even a check-in-only row (isComplete=false).
  const canClear = !disabled && displayRow.id !== null;

  return (
    <div className="grid gap-3">
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
      <div className="grid grid-cols-2 gap-3">
        <label className="grid content-start gap-1.5">
          <span className="text-sm font-semibold text-foreground">{t("settlements.therapist.attendance.column.checkIn")}</span>
          <input
            aria-describedby={checkInError ? checkInErrorId : undefined}
            aria-invalid={checkInError ? "true" : undefined}
            aria-label={t("settlements.therapist.attendance.checkInTimeAria", { name: row.displayName })}
            className={inputFieldClassName({ invalid: Boolean(checkInError) })}
            defaultValue={displayRow.checkInTime ?? ""}
            disabled={disabled || busy}
            form={formId}
            name="checkInTime"
            type="time"
          />
          {checkInError ? (
            <span className="text-sm text-danger" id={checkInErrorId} role="alert">
              {checkInError}
            </span>
          ) : null}
        </label>
        <label className="grid content-start gap-1.5">
          <span className="text-sm font-semibold text-foreground">{t("settlements.therapist.attendance.column.checkOut")}</span>
          <input
            aria-describedby={checkOutError ? checkOutErrorId : undefined}
            aria-invalid={checkOutError ? "true" : undefined}
            aria-label={t("settlements.therapist.attendance.checkOutTimeAria", { name: row.displayName })}
            className={inputFieldClassName({ invalid: Boolean(checkOutError) })}
            defaultValue={displayRow.checkOutTime ?? ""}
            disabled={disabled || busy}
            form={formId}
            name="checkOutTime"
            type="time"
          />
          {checkOutError ? (
            <span className="text-sm text-danger" id={checkOutErrorId} role="alert">
              {checkOutError}
            </span>
          ) : null}
        </label>
      </div>
      <dl>
        <DetailRow label={t("settlements.therapist.attendance.column.standbyMinutes")} value={displayRow.standbyMinutes ?? "—"} />
        <DetailRow label={t("settlements.therapist.attendance.column.recognition")} value={<AttendanceRecognition row={displayRow} />} />
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={disabled || busy} form={formId} type="submit">
          {pending ? t("settlements.therapist.attendance.action.saving") : formError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.save")}
        </Button>
        {canClear ? (
          <Button disabled={disabled || busy} form={clearFormId} type="submit" variant="secondary">
            {clearPending ? t("settlements.therapist.attendance.action.clearing") : clearError ? t("settlements.therapist.attendance.action.retry") : t("settlements.therapist.attendance.action.clear")}
          </Button>
        ) : null}
        <span aria-live="polite" className="text-sm text-muted">
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
        <p className="text-sm text-danger" role="alert">
          {t("settlements.therapist.attendance.saveFailed", { message: formError })}
        </p>
      ) : null}
      {clearError ? (
        <p className="text-sm text-danger" role="alert">
          {t("settlements.therapist.attendance.clearFailed", { message: clearError })}
        </p>
      ) : null}
    </div>
  );
}
