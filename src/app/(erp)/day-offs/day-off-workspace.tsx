"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DateCapsule } from "@/components/ui/date-capsule";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { therapistRequestKindLabel } from "@/lib/i18n/codes";
import { useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import { formatDateTime } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { DayOffImpactNotice } from "@/app/(erp)/settlements/schedule/schedule-cell-form";
import {
  cancelTherapistDayOffRegistrationAction,
  registerTherapistDayOffPeriodAction,
  type DayOffCancelActionState,
  type DayOffRegistrationActionState
} from "@/app/(erp)/day-offs/actions";
import type { TherapistDayOffEmployeeOptionDto, TherapistDayOffRegistrationDto } from "@/modules/therapists/therapist-request-service";

// 소중한날 휴가는 보통 3–5일이라(고객 요청) 시작일에서 그 길이를 바로 고르게 한다.
const QUICK_LENGTHS = [1, 3, 4, 5] as const;

function addDays(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayCount(startDate: string, endDate: string) {
  if (!startDate || !endDate || endDate < startDate) return 0;
  return Math.round((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
}

// 등록 카드의 날짜는 월-일만 보인다(연도는 목록이 최근 것뿐이라 뺀다).
function shortDate(isoDate: string) {
  return isoDate.slice(5).replace("-", ".");
}

function fieldError(state: DayOffRegistrationActionState, field: string) {
  return state && !state.ok ? state.fieldErrors?.[field]?.[0] ?? null : null;
}

function RegisterForm({
  employees,
  today,
  canOpenLedger
}: {
  employees: TherapistDayOffEmployeeOptionDto[];
  today: string;
  canOpenLedger: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<DayOffRegistrationActionState, FormData>(registerTherapistDayOffPeriodAction, null);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("special_day_off");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(addDays(today, 2));
  const [reason, setReason] = useState("");
  const [savedKey, setSavedKey] = useState<unknown>(null);
  const titleId = useId();
  const employeeFieldId = useId();
  const kindId = useId();
  const startId = useId();
  const endId = useId();
  const reasonId = useId();
  const errorId = useId();

  // 저장되면 다음 등록을 위해 Therapist·사유만 비운다(기간은 이어서 다른 사람에게 쓰는 일이 많지 않아 그대로 둔다).
  if (state?.ok && savedKey !== state) {
    setSavedKey(state);
    setEmployeeId("");
    setReason("");
  }

  const total = dayCount(startDate, endDate);
  const startError = fieldError(state, "startDate");
  const endError = fieldError(state, "endDate");
  const employeeError = fieldError(state, "employeeId");
  const formError = state && !state.ok && !startError && !endError && !employeeError ? state.formError : null;
  const saved = state?.ok ? state.data : null;

  return (
    <section aria-labelledby={titleId} className="grid gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="grid gap-1">
        <h2 className="text-base font-semibold text-foreground" id={titleId}>
          {t("settlements.dayOffs.form.title")}
        </h2>
        <p className="text-sm text-muted">{t("settlements.dayOffs.form.description")}</p>
      </div>

      <form action={formAction} className="grid gap-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={employeeFieldId}>
            {t("settlements.dayOffs.form.employeeLabel")}
            <ListboxSelect
              ariaDescribedBy={employeeError ? errorId : undefined}
              disabled={pending}
              id={employeeFieldId}
              invalid={Boolean(employeeError)}
              name="employeeId"
              onChange={setEmployeeId}
              options={employees.map((employee) => ({ value: employee.employeeId, label: `${employee.staffCode} · ${employee.displayName}` }))}
              placeholder={t("settlements.dayOffs.form.employeePlaceholder")}
              required
              value={employeeId}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={kindId}>
            {t("settlements.dayOffs.form.kindLabel")}
            <ListboxSelect
              disabled={pending}
              id={kindId}
              name="kind"
              onChange={setKind}
              options={[
                { value: "special_day_off", label: t("therapistRequestKind.special_day_off") },
                { value: "day_off", label: t("therapistRequestKind.day_off") }
              ]}
              value={kind}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={startId}>
            {t("settlements.dayOffs.form.startLabel")}
            <input
              aria-describedby={startError ? errorId : undefined}
              aria-invalid={startError ? "true" : undefined}
              className={inputFieldClassName({ invalid: Boolean(startError) })}
              disabled={pending}
              id={startId}
              name="startDate"
              onChange={(event) => {
                const next = event.target.value;
                // 기간 길이를 지키며 종료일을 따라 옮긴다(시작일을 바꿨을 때 종료일이 앞에 남지 않게).
                const length = Math.max(dayCount(startDate, endDate), 1);
                setStartDate(next);
                if (next) setEndDate(addDays(next, length - 1));
              }}
              required
              type="date"
              value={startDate}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={endId}>
            {t("settlements.dayOffs.form.endLabel")}
            <input
              aria-describedby={endError ? errorId : undefined}
              aria-invalid={endError ? "true" : undefined}
              className={inputFieldClassName({ invalid: Boolean(endError) })}
              disabled={pending}
              id={endId}
              min={startDate || undefined}
              name="endDate"
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div aria-label={t("settlements.dayOffs.form.quickLengthAria")} className="flex flex-wrap gap-2" role="group">
            {QUICK_LENGTHS.map((length) => {
              const active = total === length;
              return (
                <button
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-9 min-w-14 items-center justify-center rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:opacity-50",
                    active ? "border-brand bg-brand text-brand-foreground" : "border-border-strong text-foreground hover:bg-readonly"
                  )}
                  disabled={pending || !startDate}
                  key={length}
                  onClick={() => setEndDate(addDays(startDate, length - 1))}
                  type="button"
                >
                  {t("settlements.dayOffs.form.quickLength", { count: length })}
                </button>
              );
            })}
          </div>
          <span aria-live="polite" className="text-sm font-semibold text-foreground">
            {total > 0 ? t("settlements.dayOffs.form.total", { count: total }) : null}
          </span>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold text-foreground" htmlFor={reasonId}>
          {t("settlements.dayOffs.form.reasonLabel")}
          <textarea
            className={inputFieldClassName({ className: "h-auto min-h-20 py-2" })}
            disabled={pending}
            id={reasonId}
            maxLength={500}
            name="reason"
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("settlements.dayOffs.form.reasonPlaceholder")}
            value={reason}
          />
        </label>

        {employeeError || startError || endError || formError ? (
          <p className="text-sm text-danger" id={errorId} role="alert">
            {employeeError ?? startError ?? endError ?? formError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={pending || employees.length === 0} type="submit">
            {pending ? t("settlements.dayOffs.form.submitting") : t("settlements.dayOffs.form.submit")}
          </Button>
          {saved && !pending ? (
            <StatusIndicator
              label={t("settlements.dayOffs.form.saved", {
                name: saved.registration.displayName,
                start: shortDate(saved.registration.startDate),
                end: shortDate(saved.registration.endDate)
              })}
              tone="success"
            />
          ) : null}
        </div>
      </form>

      {saved ? (
        <DayOffImpactNotice
          calls={saved.impactedCalls}
          canOpenLedger={canOpenLedger}
          date={`${saved.registration.startDate}~${saved.registration.endDate}`}
          employeeName={saved.registration.displayName}
        />
      ) : null}
    </section>
  );
}

function RegistrationCard({ locale, registration }: { locale: Locale; registration: TherapistDayOffRegistrationDto }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<DayOffCancelActionState, FormData>(cancelTherapistDayOffRegistrationAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const canceled = state?.ok === true;
  const cancelError = state && !state.ok ? state.formError : null;

  return (
    <li className={cn("grid gap-2 rounded-md border border-border bg-surface px-4 py-3", canceled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        <DateCapsule>
          {t("settlements.dayOffs.row.period", { start: shortDate(registration.startDate), end: shortDate(registration.endDate), count: registration.dayCount })}
        </DateCapsule>
        <StatusIndicator
          label={therapistRequestKindLabel(locale, registration.kind)}
          size="sm"
          tone={registration.kind === "special_day_off" ? "danger" : "neutral"}
        />
        <span className="text-sm font-semibold text-foreground">
          {registration.staffCode} · {registration.displayName}
        </span>
        {canceled ? <StatusIndicator label={t("settlements.dayOffs.action.canceled")} size="sm" tone="neutral" /> : null}
      </div>
      <dl className="grid gap-0">
        <DetailRow label={t("settlements.dayOffs.row.reasonLabel")} value={registration.reason ?? t("settlements.dayOffs.row.noReason")} />
        {registration.registeredByName && registration.registeredAt ? (
          <DetailRow
            label={t("settlements.dayOffs.row.registeredLabel")}
            value={t("settlements.dayOffs.row.registeredBy", {
              name: registration.registeredByName,
              time: `${formatDateTime(locale, registration.registeredAt, { dateStyle: "short" })} · ${formatDateTime(locale, registration.registeredAt, { timeStyle: "short" })}`
            })}
          />
        ) : null}
      </dl>
      {!canceled ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2" ref={formRef}>
          {registration.requestIds.map((id) => (
            <input key={id} name="requestId" type="hidden" value={id} />
          ))}
          <ConfirmDialog
            confirmLabel={t("settlements.dayOffs.action.cancelSubmit")}
            cancelLabel={t("settlements.dayOffs.action.cancelDismiss")}
            description={t("settlements.dayOffs.action.cancelConfirm")}
            onConfirm={() => formRef.current?.requestSubmit()}
            onOpenChange={setConfirmOpen}
            open={confirmOpen}
            title={`${registration.displayName} · ${t("settlements.dayOffs.row.period", {
              start: shortDate(registration.startDate),
              end: shortDate(registration.endDate),
              count: registration.dayCount
            })}`}
            trigger={
              <Button disabled={pending} variant="secondary">
                {pending ? t("settlements.dayOffs.action.canceling") : t("settlements.dayOffs.action.cancel")}
              </Button>
            }
          />
          {cancelError ? (
            <span className="text-sm text-danger" role="alert">
              {cancelError}
            </span>
          ) : null}
        </form>
      ) : null}
    </li>
  );
}

/**
 * 휴무 등록 작업면: 위에 등록 폼, 아래에 진행 중·예정 휴무와 지난 휴무(최근 31일) 목록. 등록·취소는
 * 근무표의 그 날짜들을 바로 휴무/미입력으로 바꾼다(therapist-request-service.ts).
 */
export function DayOffWorkspace({
  locale,
  employees,
  upcoming,
  past,
  today,
  canOpenLedger
}: {
  locale: Locale;
  employees: TherapistDayOffEmployeeOptionDto[];
  upcoming: TherapistDayOffRegistrationDto[];
  past: TherapistDayOffRegistrationDto[];
  today: string;
  canOpenLedger: boolean;
}) {
  const t = useT();
  return (
    <div className="grid gap-6">
      <RegisterForm canOpenLedger={canOpenLedger} employees={employees} today={today} />

      <section className="grid gap-3">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.dayOffs.list.upcomingTitle")}</h2>
        {upcoming.length === 0 ? (
          <ScreenState
            description={t("settlements.dayOffs.list.empty.description")}
            kind="empty"
            label={t("common.screenState.empty")}
            title={t("settlements.dayOffs.list.empty.title")}
          />
        ) : (
          <ul className="grid gap-3">
            {upcoming.map((registration) => (
              <RegistrationCard key={registration.requestIds.join(",")} locale={locale} registration={registration} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section className="grid gap-3">
          <h2 className="text-base font-semibold text-foreground">{t("settlements.dayOffs.list.pastTitle")}</h2>
          <ul className="grid gap-3">
            {past.map((registration) => (
              <RegistrationCard key={registration.requestIds.join(",")} locale={locale} registration={registration} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
