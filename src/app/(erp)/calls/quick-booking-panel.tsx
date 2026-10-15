"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { createServiceCallRowAction, loadTherapistAvailabilityAction } from "@/app/(erp)/calls/actions";
import { firstVisible } from "@/app/(erp)/calls/call-ledger-workspace";
import type { NewRowSaveStatus } from "@/app/(erp)/calls/call-new-row-save";
import { newRequestId } from "@/app/(erp)/calls/call-request-id";
import { NewCallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import {
  QUICK_BOOKING_STEPS,
  QUICK_BOOKING_STEP_OF_FIELD,
  initialQuickBookingState,
  isQuickBookingLocked,
  quickBookingReducer,
  type QuickBookingState,
  type QuickBookingStep
} from "@/app/(erp)/calls/quick-booking-draft";
import { selectNowSlot } from "@/app/(erp)/calls/quick-booking-now-slot";
import { TherapistAvailabilityView, type AvailabilityCourseChoice } from "@/app/(erp)/calls/therapist-availability-view";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";
import { businessTodayIsoDate } from "@/lib/operating-date";
import type { CustomerDto, ServiceCallFormOptions, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

/** 새 콜 저장 응답을 이만큼 기다려도 오지 않으면 "저장 여부 확인 중"이 된다(editable-call-grid.tsx의 새 행과 같은 값). */
const QUICK_BOOKING_SAVE_TIMEOUT_MS = 15_000;

const stepLabelKey: Record<QuickBookingStep, MessageKey> = {
  customer: "calls.quickBooking.step.customer",
  schedule: "calls.quickBooking.step.schedule",
  therapist: "calls.quickBooking.step.therapist",
  room: "calls.quickBooking.step.room",
  review: "calls.quickBooking.step.review"
};

function stepIndex(step: QuickBookingStep) {
  return QUICK_BOOKING_STEPS.indexOf(step);
}

/** "지금" 버튼이 selectNowSlot에 넘길 지금 시각(HH:mm, 로컬 시계). */
function nowClockString(date = new Date()) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 저장 직후 새 행이 원장 표에 나타날 때까지(서버 액션 뒤 자동 라우터 새로고침은 비동기) 짧게 재시도하며 찾아 스크롤·포커스한다. */
function focusCreatedRow(serviceCallId: string, attemptsLeft = 20) {
  const row = firstVisible<HTMLElement>(`[data-service-call-id="${CSS.escape(serviceCallId)}"]`);
  if (row) {
    row.scrollIntoView({ block: "center" });
    // date 칸의 serviceCallId 숨은 입력(EditableCallRow)은 포커스를 받을 수 없어 건너뛴다.
    (row.querySelector<HTMLElement>('input:not([type="hidden"]), select, button, a, [tabindex]') ?? row).focus();
    return;
  }
  if (attemptsLeft <= 0) return;
  window.setTimeout(() => focusCreatedRow(serviceCallId, attemptsLeft - 1), 150);
}

function StepHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-[0.9375rem] font-semibold text-foreground">{children}</h3>;
}

function Field({ label, children, error }: { label: string; children: ReactNode; error?: string | null }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}

export function StepperNav({
  disabled,
  errorSteps,
  onSelect,
  step
}: {
  disabled: boolean;
  errorSteps: ReadonlySet<QuickBookingStep>;
  onSelect: (step: QuickBookingStep) => void;
  step: QuickBookingStep;
}) {
  const t = useT();
  return (
    <ol aria-label={t("calls.quickBooking.stepper.aria")} className="mb-4 flex flex-wrap gap-2">
      {QUICK_BOOKING_STEPS.map((candidate, index) => (
        <li key={candidate}>
          <button
            aria-current={candidate === step ? "step" : undefined}
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
              candidate === step ? "border-brand bg-brand/10 text-foreground" : "border-border text-muted hover:bg-readonly"
            }`}
            disabled={disabled}
            onClick={() => onSelect(candidate)}
            type="button"
          >
            <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full bg-readonly text-[11px] font-bold">
              {index + 1}
            </span>
            {t(stepLabelKey[candidate])}
            {errorSteps.has(candidate) ? (
              <span aria-hidden="true" className="font-bold text-danger">
                !
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ol>
  );
}

export function ErrorSummary({
  fieldErrors,
  message,
  onJump
}: {
  fieldErrors: Record<string, string[]>;
  message: string | null;
  onJump: (step: QuickBookingStep) => void;
}) {
  const t = useT();
  const entries = Object.entries(fieldErrors).filter(([, messages]) => messages.length > 0);
  if (!message && entries.length === 0) return null;

  return (
    <div className="mb-4 grid gap-2 rounded-md border border-danger bg-danger/5 p-3" role="alert">
      <p className="text-sm font-semibold text-danger">{t("calls.quickBooking.errorSummary.title")}</p>
      {message ? <p className="text-sm text-danger">{message}</p> : null}
      {entries.length > 0 ? (
        <ul className="grid gap-1">
          {entries.map(([field, messages]) => (
            <li key={field}>
              <button
                className="text-left text-sm text-danger underline underline-offset-2"
                onClick={() => onJump(QUICK_BOOKING_STEP_OF_FIELD[field] ?? "review")}
                type="button"
              >
                {messages[0]}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

type StepProps = {
  customers: CustomerDto[];
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  fieldErrors: Record<string, string[]>;
  monthEndDate: string;
  monthStartDate: string;
  onEdit: <Key extends keyof QuickBookingState["save"]["draft"]>(key: Key, value: QuickBookingState["save"]["draft"][Key]) => void;
  options: ServiceCallFormOptions;
};

export function CustomerStep({ customers, disabled, draft, fieldErrors, onEdit }: StepProps) {
  const t = useT();
  const [query, setQuery] = useState("");
  const linked = draft.customerId ? (customers.find((customer) => customer.id === draft.customerId) ?? null) : null;
  const matches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return customers.filter((customer) => `${customer.name} ${customer.phone ?? ""}`.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [customers, query]);

  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.customer")}</StepHeading>
      <Field label={t("calls.quickBooking.customer.searchLabel")}>
        {linked ? (
          <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <span className="text-sm font-semibold text-foreground">
              {[linked.name, linked.phone].filter((part) => part && part.trim() !== "").join(" · ")}
            </span>
            <Button disabled={disabled} onClick={() => onEdit("customerId", null)} type="button" variant="secondary">
              {t("calls.quickBooking.customer.clear")}
            </Button>
          </div>
        ) : (
          <>
            <input
              aria-controls={matches.length > 0 ? "quick-booking-customer-matches" : undefined}
              aria-expanded={matches.length > 0}
              autoComplete="off"
              className={inputFieldClassName({ className: "w-full" })}
              disabled={disabled}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("calls.search.label")}
              role="combobox"
              type="text"
              value={query}
            />
            {matches.length > 0 ? (
              <ul aria-label={t("calls.quickBooking.customer.searchLabel")} className="grid gap-1.5" id="quick-booking-customer-matches" role="listbox">
                {matches.map((customer) => (
                  <li key={customer.id} role="presentation">
                    <button
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-readonly"
                      disabled={disabled}
                      onClick={() => {
                        onEdit("customerId", customer.id);
                        setQuery("");
                      }}
                      role="option"
                      type="button"
                    >
                      <span className="font-semibold text-foreground">{customer.name}</span>
                      <span className="text-xs text-muted">{customer.phone ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        )}
      </Field>
      <Field error={fieldErrors.customerMemo?.[0] ?? null} label={t("calls.column.customerMemo")}>
        <input
          className={inputFieldClassName({ className: "w-full", invalid: Boolean(fieldErrors.customerMemo?.[0]) })}
          disabled={disabled}
          maxLength={500}
          onChange={(event) => onEdit("customerMemo", event.target.value === "" ? null : event.target.value)}
          placeholder={t("calls.quickBooking.customer.memoPlaceholder")}
          type="text"
          value={draft.customerMemo ?? ""}
        />
      </Field>
    </div>
  );
}

export function ScheduleStep({
  disabled,
  draft,
  fieldErrors,
  monthEndDate,
  monthStartDate,
  onNow,
  onScheduleChange,
  options
}: {
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  fieldErrors: Record<string, string[]>;
  monthEndDate: string;
  monthStartDate: string;
  /** 날짜·시각은 바뀔 때마다 그 조합으로 가능 코스 목록을 다시 불러와야 해 일반 onEdit 대신 전용 콜백을 쓴다. */
  onNow: () => void;
  onScheduleChange: (serviceDate: string, startTime: string) => void;
  options: ServiceCallFormOptions;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.schedule")}</StepHeading>
      <div className="flex flex-wrap items-end gap-3">
        <Field error={fieldErrors.serviceDate?.[0] ?? null} label={t("common.queryDate")}>
          <input
            className={inputFieldClassName({ invalid: Boolean(fieldErrors.serviceDate?.[0]) })}
            disabled={disabled}
            max={monthEndDate}
            min={monthStartDate}
            onChange={(event) => onScheduleChange(event.target.value, draft.startTime)}
            type="date"
            value={draft.serviceDate}
          />
        </Field>
        <Field error={fieldErrors.startTime?.[0] ?? null} label={t("calls.column.time")}>
          <select
            className={inputFieldClassName({ invalid: Boolean(fieldErrors.startTime?.[0]) })}
            disabled={disabled}
            onChange={(event) => onScheduleChange(draft.serviceDate, event.target.value)}
            value={draft.startTime}
          >
            <option value="">{t("calls.placeholder.searchEmpty")}</option>
            {options.timeSlots.map((slot) => (
              <option key={slot.value} value={slot.value}>
                {slot.label}
              </option>
            ))}
          </select>
        </Field>
        <Button disabled={disabled} onClick={onNow} type="button" variant="secondary">
          {t("calls.quickBooking.schedule.now")}
        </Button>
      </div>
    </div>
  );
}

export function TherapistStep({
  availabilityFailed,
  availabilityPending,
  availabilityRows,
  availabilityTime,
  courseLabel,
  disabled,
  fieldErrors,
  locale,
  onChoose,
  onClear,
  onTimeChange,
  options,
  therapistLabel
}: {
  availabilityFailed: boolean;
  availabilityPending: boolean;
  availabilityRows: TherapistAvailabilityRowDto[];
  availabilityTime: string;
  courseLabel: string | null;
  disabled: boolean;
  fieldErrors: Record<string, string[]>;
  locale: Locale;
  onChoose: (choice: AvailabilityCourseChoice) => void;
  onClear: () => void;
  onTimeChange: (time: string) => void;
  options: ServiceCallFormOptions;
  therapistLabel: string | null;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.therapist")}</StepHeading>
      {courseLabel || therapistLabel ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
          <span className="text-sm font-semibold text-foreground">
            {t("calls.quickBooking.therapist.chosen", { course: courseLabel ?? "—", therapist: therapistLabel ?? "—" })}
          </span>
          <Button disabled={disabled} onClick={onClear} type="button" variant="secondary">
            {t("calls.quickBooking.customer.clear")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("calls.quickBooking.therapist.unset")}</p>
      )}
      {fieldErrors.courseId?.[0] ? (
        <span className="text-xs text-danger" role="alert">
          {fieldErrors.courseId[0]}
        </span>
      ) : null}
      {/*
        가능 코스 화면(TherapistAvailabilityView, 티켓 10–12)을 그대로 재사용한다. 원장 위에 늘 펼쳐 두던
        자리(티켓 20 이전)와 달리 이 단계에서는 늘 펼친 채로 두고(open 고정, onToggle은 no-op), 시각은
        "날짜·예약시각" 단계와 같은 값을 공유한다. 가능 버튼은 Therapist와 코스만 채운다(스펙 F01).
      */}
      <TherapistAvailabilityView
        failed={availabilityFailed}
        locale={locale}
        onChoose={onChoose}
        onTimeChange={onTimeChange}
        onToggle={() => {}}
        open
        pending={availabilityPending}
        rows={availabilityRows}
        time={availabilityTime}
        timeSlots={options.timeSlots}
      />
    </div>
  );
}

export function RoomStep({ disabled, draft, fieldErrors, onEdit, options }: StepProps) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.room")}</StepHeading>
      <Field error={fieldErrors.roomId?.[0] ?? null} label={t("calls.column.room")}>
        <select
          className={inputFieldClassName({ invalid: Boolean(fieldErrors.roomId?.[0]) })}
          disabled={disabled}
          onChange={(event) => onEdit("roomId", event.target.value === "" ? null : event.target.value)}
          value={draft.roomId ?? ""}
        >
          <option value="">{t("calls.placeholder.roomUnassigned")}</option>
          {options.rooms.map((room) => (
            <option key={room.value} value={room.value}>
              {room.label}
            </option>
          ))}
        </select>
      </Field>
      <Field error={fieldErrors.note?.[0] ?? null} label={t("calls.column.note")}>
        <textarea
          className={inputFieldClassName({ className: "h-24 py-2", invalid: Boolean(fieldErrors.note?.[0]) })}
          disabled={disabled}
          maxLength={500}
          onChange={(event) => onEdit("note", event.target.value === "" ? null : event.target.value)}
          value={draft.note ?? ""}
        />
      </Field>
      {/* 방문별 요청(F06, 티켓 23). 비고(note)와는 다른 칸이라 나란히 두되 하나로 합치지 않는다. */}
      <Field error={fieldErrors.visitRequest?.[0] ?? null} label={t("calls.column.visitRequest")}>
        <textarea
          className={inputFieldClassName({ className: "h-24 py-2", invalid: Boolean(fieldErrors.visitRequest?.[0]) })}
          disabled={disabled}
          maxLength={500}
          onChange={(event) => onEdit("visitRequest", event.target.value === "" ? null : event.target.value)}
          value={draft.visitRequest ?? ""}
        />
      </Field>
    </div>
  );
}

export function ReviewStep({
  courseLabel,
  customerLabel,
  disabled,
  draft,
  message,
  notice,
  onCancel,
  onRetry,
  onSave,
  roomLabel,
  status,
  therapistLabel
}: {
  courseLabel: string | null;
  customerLabel: string | null;
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  message: string | null;
  notice: string | null;
  onCancel: () => void;
  onRetry: () => void;
  onSave: () => void;
  roomLabel: string | null;
  status: NewRowSaveStatus;
  therapistLabel: string | null;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.review")}</StepHeading>
      <dl className="rounded-md border border-border bg-surface px-3">
        <DetailRow
          label={t("calls.quickBooking.step.customer")}
          value={customerLabel ?? draft.customerMemo ?? t("calls.quickBooking.review.customerNone")}
        />
        <DetailRow label={t("calls.quickBooking.step.schedule")} value={`${draft.serviceDate} ${draft.startTime || "—"}`} />
        <DetailRow label={t("calls.column.course")} value={courseLabel ?? t("calls.quickBooking.review.unset")} />
        <DetailRow label={t("calls.column.therapist1")} value={therapistLabel ?? t("calls.quickBooking.review.unset")} />
        <DetailRow label={t("calls.column.room")} value={roomLabel ?? t("calls.placeholder.roomUnassigned")} />
      </dl>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={disabled} onClick={onCancel} type="button" variant="secondary">
          {t("common.confirm.cancel")}
        </Button>
        <Button aria-busy={status === "saving"} disabled={disabled} onClick={onSave} type="button">
          {t("calls.quickBooking.save")}
        </Button>
        <NewCallRowSaveStatus message={message} notice={notice} onRetry={onRetry} state={status} />
      </div>
    </div>
  );
}

export function QuickBookingPanel({
  customers,
  initialAvailabilityRows,
  initialAvailabilityTime,
  isLocked,
  monthEndDate,
  monthStartDate,
  operatingMonthId,
  options,
  serviceDate
}: {
  customers: CustomerDto[];
  initialAvailabilityRows: TherapistAvailabilityRowDto[];
  initialAvailabilityTime: string;
  isLocked: boolean;
  monthEndDate: string;
  monthStartDate: string;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const ledger = useMemo(() => ({ operatingMonthId, serviceDate }), [operatingMonthId, serviceDate]);
  const [state, dispatch] = useReducer(quickBookingReducer, ledger, (initial) => initialQuickBookingState(initial, newRequestId()));
  const { step, save, touched } = state;
  // 패널을 닫지 않고 다른 화면으로 옮기거나 브라우저를 닫으려 하면(티켓 18) 같은 안내를 받는다. 패널
  // 자체를 닫을 때의 안내(스토리 51)는 아래 onOpenChange/ConfirmDialog가 따로 맡는다.
  useUnsavedGuard(touched);
  const { draft, fieldErrors, message } = save;
  const locked = isLocked || isQuickBookingLocked(state);
  const [, startTransition] = useTransition();
  const request = save.inFlight;

  const [availabilityRows, setAvailabilityRows] = useState(initialAvailabilityRows);
  const [availabilityTime, setAvailabilityTime] = useState(initialAvailabilityTime);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const availabilityRequestId = useRef(0);

  async function loadAvailability(date: string, time: string) {
    const id = ++availabilityRequestId.current;
    setAvailabilityTime(time);
    setAvailabilityFailed(false);
    if (!time) {
      setAvailabilityRows([]);
      return;
    }
    setAvailabilityPending(true);
    try {
      const rows = await loadTherapistAvailabilityAction({ operatingMonthId, serviceDate: date, time });
      if (availabilityRequestId.current === id) setAvailabilityRows(rows);
    } catch (error) {
      unstable_rethrow(error);
      if (availabilityRequestId.current === id) setAvailabilityFailed(true);
    } finally {
      if (availabilityRequestId.current === id) setAvailabilityPending(false);
    }
  }

  function edit<Key extends keyof typeof draft>(key: Key, value: (typeof draft)[Key]) {
    dispatch({ type: "edit", changes: { [key]: value } as Partial<typeof draft> });
  }

  function setSchedule(nextDate: string, nextTime: string) {
    dispatch({ type: "edit", changes: { serviceDate: nextDate, startTime: nextTime } });
    void loadAvailability(nextDate, nextTime);
  }

  function pressNow() {
    const today = businessTodayIsoDate();
    const slot = selectNowSlot(options.timeSlots, nowClockString());
    setSchedule(today, slot);
    dispatch({ type: "step", step: "therapist" });
  }

  function chooseCourse(choice: AvailabilityCourseChoice) {
    // 가능 버튼은 패널의 Therapist와 코스만 채운다(스펙 F01, 티켓 20). 시각은 이미 이 단계의 예약시각과
    // 같아(가능 목록 자체가 그 시각 기준) 다시 쓰지 않는다.
    dispatch({ type: "choose", changes: { courseId: choice.courseId, therapist1Id: choice.therapistId } });
  }

  // 응답을 받지 못하면(네트워크 오류, 시간 초과) 초안과 요청 id를 둔 채 "저장 여부 확인 중"이 된다(티켓 16).
  useEffect(() => {
    if (!request) return;
    startTransition(() => {
      void (async () => {
        const giveUp = window.setTimeout(() => dispatch({ type: "lost", request }), QUICK_BOOKING_SAVE_TIMEOUT_MS);
        try {
          const result = await createServiceCallRowAction(request);
          if (result.ok) {
            const createdId = result.data.id;
            dispatch({ type: "saved", request, notice: result.notice ?? null, nextRequestId: newRequestId() });
            setOpen(false);
            focusCreatedRow(createdId);
          } else {
            dispatch({ type: "failed", request, message: result.formError ?? null, fieldErrors: result.fieldErrors });
            const firstField = Object.keys(result.fieldErrors ?? {})[0];
            dispatch({ type: "step", step: firstField ? (QUICK_BOOKING_STEP_OF_FIELD[firstField] ?? "review") : "review" });
          }
        } catch {
          dispatch({ type: "lost", request });
        } finally {
          window.clearTimeout(giveUp);
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  function requestClose() {
    if (touched) {
      setConfirmClose(true);
      return;
    }
    setOpen(false);
  }

  const errorSteps = useMemo(() => {
    const steps = new Set<QuickBookingStep>();
    for (const field of Object.keys(fieldErrors)) {
      const target = QUICK_BOOKING_STEP_OF_FIELD[field];
      if (target) steps.add(target);
    }
    return steps;
  }, [fieldErrors]);

  const stepProps: StepProps = { customers, disabled: locked, draft, fieldErrors, monthEndDate, monthStartDate, onEdit: edit, options };
  const courseLabel = options.courses.find((option) => option.value === draft.courseId)?.label ?? null;
  const therapistLabel = draft.therapist1Id ? (options.therapists.find((option) => option.value === draft.therapist1Id)?.label ?? draft.therapist1Id) : null;
  const roomLabel = draft.roomId ? (options.rooms.find((option) => option.value === draft.roomId)?.label ?? draft.roomId) : null;
  const customerLabel = draft.customerId ? (customers.find((customer) => customer.id === draft.customerId)?.name ?? draft.customerId) : null;

  return (
    <>
      {/* 빠른 예약은 원장 탭 머리의 주요 버튼이다(명세 F08). 휴대폰 폭에서는 제공하지 않는다(티켓 20). */}
      <div className="hidden min-[600px]:block">
        <Button aria-haspopup="dialog" disabled={isLocked} onClick={() => setOpen(true)} type="button">
          {t("calls.quickBooking.open")}
        </Button>
      </div>

      <ModalPanel
        description={t("calls.quickBooking.description")}
        onOpenChange={(next) => {
          if (next) {
            setOpen(true);
            return;
          }
          requestClose();
        }}
        open={open}
        title={t("calls.quickBooking.title")}
      >
        <StepperNav disabled={locked} errorSteps={errorSteps} onSelect={(next) => dispatch({ type: "step", step: next })} step={step} />
        <ErrorSummary fieldErrors={fieldErrors} message={message} onJump={(next) => dispatch({ type: "step", step: next })} />

        {step === "customer" ? <CustomerStep {...stepProps} /> : null}
        {step === "schedule" ? (
          <ScheduleStep
            disabled={locked}
            draft={draft}
            fieldErrors={fieldErrors}
            monthEndDate={monthEndDate}
            monthStartDate={monthStartDate}
            onNow={pressNow}
            onScheduleChange={setSchedule}
            options={options}
          />
        ) : null}
        {step === "therapist" ? (
          <TherapistStep
            availabilityFailed={availabilityFailed}
            availabilityPending={availabilityPending}
            availabilityRows={availabilityRows}
            availabilityTime={availabilityTime}
            courseLabel={courseLabel}
            disabled={locked}
            fieldErrors={fieldErrors}
            locale={locale}
            onChoose={chooseCourse}
            onClear={() => dispatch({ type: "edit", changes: { courseId: "", therapist1Id: null } })}
            onTimeChange={(next) => setSchedule(draft.serviceDate, next)}
            options={options}
            therapistLabel={therapistLabel}
          />
        ) : null}
        {step === "room" ? <RoomStep {...stepProps} /> : null}
        {step === "review" ? (
          <ReviewStep
            courseLabel={courseLabel}
            customerLabel={customerLabel}
            disabled={locked}
            draft={draft}
            message={message}
            notice={save.notice}
            onCancel={requestClose}
            onRetry={() => dispatch({ type: "submit" })}
            onSave={() => dispatch({ type: "submit" })}
            roomLabel={roomLabel}
            status={save.status}
            therapistLabel={therapistLabel}
          />
        ) : null}

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-4">
          <Button
            disabled={locked || stepIndex(step) === 0}
            onClick={() => dispatch({ type: "step", step: QUICK_BOOKING_STEPS[stepIndex(step) - 1] })}
            type="button"
            variant="secondary"
          >
            {t("calls.quickBooking.previous")}
          </Button>
          {step !== "review" ? (
            <Button disabled={locked} onClick={() => dispatch({ type: "step", step: QUICK_BOOKING_STEPS[stepIndex(step) + 1] })} type="button">
              {t("calls.quickBooking.next")}
            </Button>
          ) : null}
        </div>
      </ModalPanel>

      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.leaveGuard.confirm")}
        description={t("calls.leaveGuard.description")}
        onConfirm={() => {
          setConfirmClose(false);
          setOpen(false);
          // 저장 없이 닫기로 확정하면 초안을 버린다. 다음에 다시 열면 새 요청 id로 처음부터 시작한다.
          dispatch({ type: "discard", nextRequestId: newRequestId() });
        }}
        onOpenChange={setConfirmClose}
        open={confirmClose}
        title={t("calls.leaveGuard.title")}
      />
    </>
  );
}
