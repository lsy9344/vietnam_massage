"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { DateCapsule } from "@/components/ui/date-capsule";
import { inputFieldClassName } from "@/components/ui/input-field";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { ledgerCallHref } from "@/app/(erp)/calls/ledger-address";
import { useLocale, useT } from "@/lib/i18n/client";
import { scheduleStatusLabel, serviceStatusLabel } from "@/lib/i18n/codes";
import { setPlannedWorkingDayAction, type ScheduleActionState } from "@/app/(erp)/settlements/schedule/actions";
import { ALL_SCHEDULE_CELL_STATUSES } from "@/app/(erp)/settlements/schedule/schedule-view-model";
import type { AssignedServiceCallSummaryDto } from "@/modules/calls/service-call-service";
import type { PlannedWorkingDayCellStatus } from "@/modules/settlements/schedule-service";

function inlineError(state: ScheduleActionState, field?: string) {
  if (!state || state.ok) return null;
  return field ? state.fieldErrors?.[field]?.[0] ?? null : state.formError ?? null;
}

const impactItemClassName = "block min-h-14 rounded-md border border-border bg-surface px-4 py-2.5 text-sm";

/**
 * 휴무로 바꾼 칸에 그 직원이 어느 배정 역할로든 들어 있는 콜이 있을 때의 안내(스토리 102, 148).
 * 원장에 들어갈 수 있는 역할(관리자)에게는 항목 전체가 원장의 그 날짜·그 콜로 가는 링크이고, 원장
 * 권한이 없는 정산 담당에게는 링크 없이 같은 자리의 콜 요약(날짜, 예약시각, 코스, 상태)만 보인다.
 * 어느 쪽도 콜의 예약시각·배정·상태를 바꾸지 않는다.
 */
export function DayOffImpactNotice({
  calls,
  employeeName,
  date,
  canOpenLedger
}: {
  calls: AssignedServiceCallSummaryDto[];
  employeeName: string;
  date: string;
  canOpenLedger: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  if (calls.length === 0) return null;

  return (
    <div className="col-span-3 grid gap-2 rounded-md border border-border bg-surface-float p-3">
      <StatusIndicator label={t("settlements.schedule.dayOff.impact.count", { count: calls.length })} tone="warning" />
      <p className="text-sm text-muted">{t("settlements.schedule.dayOff.impact.guidance")}</p>
      <ul aria-label={t("settlements.schedule.dayOff.impact.listAria", { name: employeeName, date })} className="grid gap-2">
        {calls.map((call) => {
          const body = (
            <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                <DateCapsule>{`${call.serviceDate} ${call.startTime}`}</DateCapsule>
                <span className="font-semibold">{call.courseCode}</span>
                <span className="text-muted">{serviceStatusLabel(locale, call.status)}</span>
              </span>
              {canOpenLedger ? (
                <span className="font-semibold text-foreground underline underline-offset-4">{t("settlements.evidenceCall.openLedger")}</span>
              ) : null}
            </span>
          );
          return (
            <li key={call.serviceCallId}>
              {canOpenLedger ? (
                <Link
                  className={`${impactItemClassName} transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary`}
                  href={ledgerCallHref({ operatingMonthId: call.operatingMonthId, serviceDate: call.serviceDate, serviceCallId: call.serviceCallId })}
                >
                  {body}
                </Link>
              ) : (
                <div className={impactItemClassName}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 근무표 패널의 요일 한 줄(티켓 27). 고른 직원의 패널 안에 요일마다 하나씩 쌓인다.
 * 휴무로 저장되면 그 칸에 배정된 콜(휴무 영향 콜)을 DayOffImpactNotice로 보여준다(28).
 */
export function ScheduleCellForm({
  employeeId,
  employeeName,
  date,
  weekdayLabel,
  status,
  canOpenLedger
}: {
  employeeId: string;
  employeeName: string;
  date: string;
  weekdayLabel: string;
  status: PlannedWorkingDayCellStatus;
  canOpenLedger: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<ScheduleActionState, FormData>(setPlannedWorkingDayAction, null);
  const statusErrorId = useId();
  const formError = inlineError(state);
  const statusError = inlineError(state, "status");
  const saved = state?.ok && state.data.employeeId === employeeId && state.data.date === date;
  const impactedCalls = state?.ok && state.data.employeeId === employeeId && state.data.date === date ? state.data.impactedCalls : [];

  // S8: <select>를 비제어(defaultValue)로 두면 지난주 복사처럼 이 줄 바깥에서 status prop이 바뀌어도
  // 화면이 갱신되지 않는다(이 컴포넌트는 key가 date뿐이라 다시 마운트되지 않는다, schedule-view.tsx).
  // 그 상태로 저장하면 브라우저가 들고 있던 옛 값을 보내 복사한 값을 지운다. 제어 상태로 두고 status
  // prop이 바뀔 때만(복사 등 바깥 변경) 다시 맞춘다 — 저장 직후 반영되는 값도 결국 같은 값이라
  // "저장됨" 표시(state, 별도 hook)에는 영향이 없다.
  const [selectedStatus, setSelectedStatus] = useState<PlannedWorkingDayCellStatus>(status);
  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

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
          disabled={pending}
          name="status"
          onChange={(event) => setSelectedStatus(event.target.value as PlannedWorkingDayCellStatus)}
          value={selectedStatus}
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
      <DayOffImpactNotice calls={impactedCalls} canOpenLedger={canOpenLedger} date={date} employeeName={employeeName} />
    </form>
  );
}
