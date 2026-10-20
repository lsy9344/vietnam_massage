"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DetailRow } from "@/components/ui/detail-row";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import { codeLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { saveOpsAttendanceAction, type OpsAttendanceActionState } from "@/app/(erp)/settlements/operations/actions";
import type { OpsAttendanceDto, OpsAttendanceStatusOptionDto } from "@/modules/settlements/ops-attendance-service";

function inlineError(state: OpsAttendanceActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

function attendanceLabel(locale: Locale, code: string, dbDisplayName: string) {
  return codeLabel(locale, "ATTENDANCE_STATUS", code, true, dbDisplayName);
}

/** 근무상태로 정한 지급 판정 칩. */
export function OpsEligibility({ row }: { row: Pick<OpsAttendanceDto, "isPayoutEligible" | "statusCode" | "statusDisplayName"> }) {
  const t = useT();
  const locale = useLocale();
  return row.isPayoutEligible ? (
    <StatusIndicator label={t("settlements.ops.payoutEligible")} tone="success" />
  ) : (
    <StatusIndicator label={t("settlements.ops.excluded", { reason: attendanceLabel(locale, row.statusCode, row.statusDisplayName) })} tone="neutral" />
  );
}

/** 직원 패널의 근무상태 정정(정보구조 7.1). 저장하면 같은 화면을 다시 불러 인센 요약을 맞춘다. */
export function OpsAttendanceForm({
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
  const statusErrorId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "statusCode");
  const savedRow = state?.ok && state.data.employeeId === row.employeeId ? state.data : null;

  useEffect(() => {
    if (savedRow) {
      router.refresh();
    }
  }, [router, savedRow]);

  return (
    <form action={formAction} className="grid gap-3" noValidate>
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="attendanceDate" type="hidden" value={attendanceDate} />
      <input name="employeeId" type="hidden" value={row.employeeId} />
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-foreground">{t("settlements.ops.column.workStatus")}</span>
        <ListboxSelect
          ariaDescribedBy={statusError ? statusErrorId : undefined}
          ariaLabel={t("settlements.ops.attendance.workStatusAria", { name: row.displayName })}
          defaultValue={row.statusCode}
          disabled={disabled || pending}
          invalid={Boolean(statusError)}
          name="statusCode"
          options={statusOptions.map((option) => ({
            label: attendanceLabel(locale, option.code, option.displayName),
            value: option.code
          }))}
        />
        {statusError ? (
          <span className="text-sm text-danger" id={statusErrorId} role="alert">
            {statusError}
          </span>
        ) : null}
      </label>
      <dl>
        <DetailRow label={t("settlements.ops.column.payoutDecision")} value={<OpsEligibility row={savedRow ?? row} />} />
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
