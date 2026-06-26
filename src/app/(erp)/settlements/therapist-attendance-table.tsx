"use client";

import { useActionState, useId, useRef } from "react";
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

function RecognitionBadge({ row }: { row: TherapistAttendanceDto }) {
  if (!row.isComplete) {
    return (
      <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
        {row.incompleteReason ?? "출퇴근 미입력"}
      </span>
    );
  }

  if (row.isFullAttendanceRecognized) {
    return (
      <span className="inline-flex border border-success bg-success/10 px-2 py-1 text-xs font-semibold text-success">
        만근 인정 ({row.standbyMinutes}분)
      </span>
    );
  }

  return (
    <span className="inline-flex border border-border bg-readonly px-2 py-1 text-xs font-semibold text-muted">
      만근 미인정 ({row.standbyMinutes}분)
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
          <span className="sr-only">{row.displayName} 출근시간</span>
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
          <span className="sr-only">{row.displayName} 퇴근시간</span>
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
        <RecognitionBadge row={displayRow} />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
            disabled={disabled || busy}
            form={formId}
            type="submit"
          >
            {pending ? "저장중" : formError ? "재시도" : "저장"}
          </button>
          {canClear ? (
            <button
              className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-muted hover:bg-readonly hover:text-foreground disabled:cursor-not-allowed disabled:bg-readonly disabled:text-muted"
              disabled={disabled || busy}
              form={clearFormId}
              type="submit"
            >
              {clearPending ? "비우는 중" : clearError ? "재시도" : "비우기"}
            </button>
          ) : null}
          <span className="min-w-16 text-right text-xs text-muted" aria-live="polite">
            {busy
              ? "저장중"
              : lastAction.current === "clear" && clearedRow
                ? "비워짐"
                : lastAction.current === "save" && savedRow
                  ? "저장됨"
                  : clearedRow
                    ? "비워짐"
                    : savedRow
                      ? "저장됨"
                      : disabled
                        ? "잠금"
                        : "대기"}
          </span>
        </div>
        {formError ? (
          <div className="mt-1 text-right text-xs text-danger" role="alert">
            저장 실패: {formError}
          </div>
        ) : null}
        {clearError ? (
          <div className="mt-1 text-right text-xs text-danger" role="alert">
            비우기 실패: {clearError}
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
  if (rows.length === 0) {
    return (
      <section className="border border-border bg-surface px-4 py-8">
        <h2 className="text-base font-semibold text-foreground">활성 마사지사가 없습니다</h2>
        <p className="mt-2 text-sm text-muted">직원 마스터에서 마사지사를 활성화한 뒤 다시 조회하세요.</p>
      </section>
    );
  }

  return (
    <section className="overflow-x-auto border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">마사지사 출퇴근 입력</h2>
        <p className="mt-1 text-sm text-muted">
          출근/퇴근 시간을 저장하면 대기시간과 만근 인정 여부가 계산되어 저장된다. 대기시간 8시간(480분) 이상이면 만근 인정이다.
        </p>
      </div>
      <table className="min-w-[820px] w-full border-collapse text-sm">
        <thead className="bg-readonly text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="border-b border-border px-3 py-2">마사지사</th>
            <th className="border-b border-border px-3 py-2">출근시간</th>
            <th className="border-b border-border px-3 py-2">퇴근시간</th>
            <th className="border-b border-border px-3 py-2 text-right">대기시간(분)</th>
            <th className="border-b border-border px-3 py-2">만근 판정</th>
            <th className="border-b border-border px-3 py-2 text-right">저장 상태</th>
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
