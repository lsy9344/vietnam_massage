"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { SidePanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { CustomerCandidateCompare } from "@/components/domain/customer-candidate-compare";
import { CustomerVisitCounts } from "@/components/domain/customer-visit-counts";
import {
  createQuickBookingPartyAction,
  createQuickBookingServiceCallAction,
  loadCustomerVisitSummaryAction,
  loadTherapistAvailabilityAction,
  searchCustomerLinkCandidatesAction
} from "@/app/(erp)/calls/actions";
import { firstVisible } from "@/app/(erp)/calls/first-visible";
import type { NewRowSaveStatus } from "@/app/(erp)/calls/call-new-row-save";
import { newRequestId } from "@/app/(erp)/calls/call-request-id";
import { NewCallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import {
  quickBookingCourseColumns,
  quickBookingFreeTime,
  quickBookingSeatShortage,
  quickBookingSummary,
  quickBookingTherapistGroups,
  type QuickBookingCourseColumn,
  type QuickBookingSeatShortage
} from "@/app/(erp)/calls/quick-booking-conditions";
import {
  QUICK_BOOKING_STEPS,
  guestFieldErrors,
  initialQuickBookingState,
  isQuickBookingLocked,
  joinsParty,
  quickBookingGuestPosition,
  quickBookingPartyRequest,
  quickBookingReducer,
  quickBookingStepOfField,
  takenTherapistIds,
  type QuickBookingGuest,
  type QuickBookingJoinParty,
  type QuickBookingState,
  type QuickBookingStep
} from "@/app/(erp)/calls/quick-booking-draft";
import { nowClockString, selectNowSlot } from "@/app/(erp)/calls/quick-booking-now-slot";
import { TherapistCallCount } from "@/app/(erp)/calls/therapist-call-counts";
import {
  announceQuickBookingShown,
  isQuickBookingShown,
  onQuickBookingJoinParty,
  onQuickBookingOpen,
  onQuickBookingWithTherapist,
  requestQuickBookingOpen,
  subscribeQuickBookingShown
} from "@/app/(erp)/calls/quick-booking-party-join";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import { CALL_PARAM } from "@/lib/ledger-address";
import { CUSTOMER_SEARCH_DEBOUNCE_MS } from "@/app/(erp)/customers/customer-search";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { cn } from "@/lib/utils";
import { QUICK_BOOKING_PARTY_MAX_GUESTS } from "@/modules/calls/service-call-schema";
import type {
  CustomerDto,
  CustomerVisitCandidateDto,
  CustomerVisitCountsDto,
  CustomerVisitHistoryRowDto,
  SeatPointDto,
  ServiceCallFormOptions,
  ServiceCallOption,
  TherapistAvailabilityRowDto
} from "@/modules/calls/service-call-service";

/** 새 콜 저장 응답을 이만큼 기다려도 오지 않으면 "저장 여부 확인 중"이 된다(티켓 16). */
const QUICK_BOOKING_SAVE_TIMEOUT_MS = 15_000;

const stepLabelKey: Record<QuickBookingStep, MessageKey> = {
  conditions: "calls.quickBooking.step.conditions",
  customer: "calls.quickBooking.step.customer"
};

/**
 * 저장 직후 새 콜 줄을 골라 편집 패널을 연다(1018 스펙 D19). 원장을 다시 그리는 것은 비동기라 줄이 원장 목록에
 * 나타날 때까지 재시도하며 찾는다(최대 약 30초). 줄의 여는 버튼을 누른 것과 같아 포커스도 그 줄에 남는다. 그사이
 * 빠른 예약을 다시 열었으면(stillWanted가 false) 그만둔다. 쓰는 중인 새 예약을 늦게 찾은 줄이 가리지 않게 한다.
 */
function focusCreatedRow(serviceCallId: string, stillWanted: () => boolean, attemptsLeft = 120) {
  if (!stillWanted()) return;
  const opener = firstVisible<HTMLElement>(`[data-call-open="${CSS.escape(serviceCallId)}"]`);
  if (opener) {
    opener.scrollIntoView({ block: "center" });
    opener.click();
    opener.focus();
    return;
  }
  if (attemptsLeft <= 0) return;
  window.setTimeout(() => focusCreatedRow(serviceCallId, stillWanted, attemptsLeft - 1), 250);
}

/** 오늘 원장이면 지금 시각 칸, 아니면 첫 시각으로 연다. */
function defaultStartTime(serviceDate: string, timeSlots: ServiceCallOption[]) {
  return serviceDate === businessTodayIsoDate() ? selectNowSlot(timeSlots, nowClockString()) : (timeSlots[0]?.value ?? "");
}

/**
 * 담은 손님의 글자("12번 C90", Therapist가 없으면 "미지명 C90"). ①의 담은 목록과 ②의 한 줄 요약이 같이 쓴다. Therapist 이름은
 * 가능 판정 행, 없으면 기준정보 선택지에서 찾고, 코스 글자는 칩과 같다.
 */
function guestTextOf(t: ReturnType<typeof useT>, rows: TherapistAvailabilityRowDto[], options: ServiceCallFormOptions) {
  const columns = quickBookingCourseColumns(rows);
  const therapist = (therapistId: string | null) =>
    therapistId
      ? (rows.find((row) => row.therapistId === therapistId)?.therapistName ??
        options.therapists.find((option) => option.value === therapistId)?.label ??
        therapistId)
      : t("calls.quickBooking.unassigned");
  const course = (courseId: string) => {
    const column = columns.find((candidate) => candidate.courseId === courseId);
    return column
      ? t("calls.quickBooking.chip", { code: column.code, minutes: column.minutes })
      : (options.courses.find((option) => option.value === courseId)?.label ?? courseId);
  };
  return { therapist, guest: (guest: QuickBookingGuest) => `${therapist(guest.therapist1Id)} ${course(guest.courseId)}` };
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

/**
 * 원장 탭 머리의 주요 버튼(명세 F08). 패널은 원장 옆에 열린다(1018 스펙 D19). 휴대폰 폭에서는 제공하지 않는다(티켓 20).
 * 원장 목록의 N 단축키(티켓 03)가 data-quick-booking-trigger로 이 버튼을 찾아 누른다.
 */
export function QuickBookingTrigger({ isLocked }: { isLocked: boolean }) {
  const t = useT();
  // 화면의 주 버튼은 하나다(design.md). 패널이 보이는 동안은 패널의 "다음"·"예약 저장"이 주 버튼이라 테두리 버튼이 된다.
  const shown = useSyncExternalStore(subscribeQuickBookingShown, isQuickBookingShown, () => false);
  return (
    <Button
      aria-controls="quick-booking-panel"
      aria-expanded={shown}
      className="hidden min-[600px]:inline-flex"
      data-quick-booking-trigger=""
      disabled={isLocked}
      onClick={requestQuickBookingOpen}
      type="button"
      variant={shown ? "secondary" : "default"}
    >
      {t("calls.quickBooking.open")}
    </Button>
  );
}

export function StepperNav({
  customerReady,
  disabled,
  errorSteps,
  onSelect,
  step
}: {
  /** 인원만큼 담아야 ② 고객으로 넘어간다. */
  customerReady: boolean;
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
            className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors disabled:opacity-50 ${
              candidate === step ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-readonly"
            }`}
            disabled={disabled || (candidate === "customer" && !customerReady)}
            onClick={() => onSelect(candidate)}
            type="button"
          >
            <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full bg-readonly text-foreground text-xs font-bold">
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
    <ScreenState
      action={
        entries.length > 0 ? (
          <ul className="grid gap-1">
            {entries.map(([field, messages]) => {
              // 일행 저장의 손님별 오류(티켓 02)는 손님 번호를 붙여 보인다.
              const position = quickBookingGuestPosition(field);
              return (
                <li key={field}>
                  <button
                    className="text-left text-sm text-danger underline underline-offset-2"
                    onClick={() => onJump(quickBookingStepOfField(field) ?? "customer")}
                    type="button"
                  >
                    {position ? `${t("calls.quickBooking.party.guest", { position })} · ${messages[0]}` : messages[0]}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null
      }
      className="mb-4"
      kind="error"
      label={t("calls.quickBooking.errorSummary.title")}
      title={message ?? t("calls.quickBooking.errorSummary.title")}
    />
  );
}

/** 칩 한 칸의 폭. 줄마다 같은 코스가 같은 열에 오도록 모든 칩을 같은 폭으로 둔다(1018 스펙 D20). */
const chipClassName = "h-11 w-[4.5rem] shrink-0 justify-center gap-0.5 overflow-hidden whitespace-nowrap px-1";
const nameColumnClassName = "grid w-36 shrink-0 gap-0.5";

/** 칩 하나의 판정. 이 줄에 그 코스가 없으면 null이고 빈 칸으로 둔다. */
type ChipVerdict = TherapistAvailabilityRowDto["courses"][number]["verdict"] | null;

/** 불가 칩을 경고 확인 후 담기 전에 먼저 보여줄 경고(티켓 21과 같은 확인 창). */
type PendingPick =
  | { kind: "first"; courseId: string; therapistId: string; therapistName: string; verdict: "time_short" | "rate_missing" }
  | { kind: "second"; index: number; therapistId: string; therapistName: string; verdict: "time_short" | "rate_missing" };

/** 남은 자리 경고 문구의 값(1018 스펙 D26). ①의 경고와 ②로 넘어갈 때의 확인 창이 같이 쓴다. */
function seatShortageText(locale: Locale, shortage: QuickBookingSeatShortage) {
  return { time: shortage.time, remaining: formatNumber(locale, shortage.remaining), demand: formatNumber(locale, shortage.demand) };
}

function FreeTimeText({ row }: { row: TherapistAvailabilityRowDto }) {
  const t = useT();
  const free = quickBookingFreeTime(row);
  if (!free) return null;
  const text =
    free.kind === "until"
      ? t(free.minutes === null ? "calls.quickBooking.free.untilTime" : "calls.quickBooking.free.until", { time: free.time, minutes: free.minutes ?? 0 })
      : free.kind === "untilClose"
        ? t("calls.quickBooking.free.untilClose")
        : t("calls.quickBooking.free.from", { time: free.time });
  return <span className="text-xs text-muted">{text}</span>;
}

/**
 * ①의 한 줄: 이름 · 비는 시간 · 코스 칩(1018 스펙 D20). 칩은 열마다 같은 자리에 오고 줄을 바꾸지 않는다. 미지명 줄은
 * therapistId가 null이다.
 */
function PickLine({
  chips,
  columns,
  count,
  disabled,
  name,
  note,
  onPick,
  preset = false,
  tag,
  therapistId
}: {
  chips: (courseId: string) => ChipVerdict;
  columns: QuickBookingCourseColumn[];
  /** 그날 한 것 +예약(Therapist 줄만). */
  count?: ReactNode;
  disabled: boolean;
  name: string;
  note?: ReactNode;
  onPick: (column: QuickBookingCourseColumn, verdict: Exclude<ChipVerdict, null>) => void;
  preset?: boolean;
  tag?: string | null;
  therapistId: string | null;
}) {
  const t = useT();
  return (
    <li
      aria-current={preset ? "true" : undefined}
      className={cn("flex min-w-max items-center gap-1.5 border-b border-border py-1.5 last:border-b-0", preset && "rounded-md bg-readonly px-1")}
      data-quick-booking-line={therapistId ?? "unassigned"}
    >
      <span className={nameColumnClassName}>
        <span className="flex items-baseline gap-1.5 text-sm">
          <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{name}</span>
          {tag ? <span className="shrink-0 text-xs text-muted">{tag}</span> : null}
          {count}
        </span>
        {note}
      </span>
      {columns.map((column) => {
        const verdict = chips(column.courseId);
        if (!verdict) return <span aria-hidden="true" className="w-[4.5rem] shrink-0" key={column.courseId} />;
        const text = t("calls.quickBooking.chip", { code: column.code, minutes: column.minutes });
        const possible = verdict === "possible";
        return (
          <Button
            aria-label={t(possible ? "calls.quickBooking.pickPossible" : "calls.quickBooking.pickImpossible", { name, course: text })}
            className={cn(chipClassName, possible ? "border-border-strong" : "border-dashed text-muted")}
            data-course-id={column.courseId}
            data-therapist-id={therapistId ?? ""}
            disabled={disabled}
            key={column.courseId}
            onClick={() => onPick(column, verdict)}
            variant="secondary"
          >
            {possible ? null : <span aria-hidden="true">{"○︎"}</span>}
            <span className="truncate text-sm font-semibold">{text}</span>
          </Button>
        );
      })}
    </li>
  );
}

export type QuickBookingAvailability = {
  rows: TherapistAvailabilityRowDto[];
  /** 고른 시각부터의 자리 수와 남은 자리(1018 스펙 D25). 아직 받지 못했으면 비어 있다. */
  seats: SeatPointDto[];
  pending: boolean;
  failed: boolean;
};

/**
 * ① 조건(1018 스펙 D20·D23): 날짜·시각·인원, 맨 위 "미지명" 줄과 Therapist 줄의 코스 칩, 그 시각에 안 되는 사람을 접어 둔 "N명",
 * 담은 손님 목록. 칩을 누르면 손님이 담긴다. 불가 칩은 경고를 확인한 뒤 담긴다. D코스는 두 번째 Therapist를 고른다.
 * 목록 위에 `HH:MM 남은 자리 n / N`을 보이고, 담은 손님이 남은 자리를 넘으면 담은 손님 목록에 경고를 보인다(스펙 D25·D26). 담기는
 * 막지 않는다. `그래도 예약` 확인은 ② 고객으로 넘어갈 때 패널이 묻는다.
 */
export function ConditionsStep({
  availability,
  disabled,
  draft,
  fieldErrors,
  guests,
  joining,
  monthEndDate,
  monthStartDate,
  onAddGuest,
  onNow,
  onNext,
  onPartySizeChange,
  onRemoveGuest,
  onScheduleChange,
  onSecondTherapist,
  options,
  partySize,
  presetTherapistId,
  showBeforeCheckIn,
  onShowBeforeCheckInChange
}: {
  availability: QuickBookingAvailability;
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  fieldErrors: Record<string, string[]>;
  guests: QuickBookingGuest[];
  /** 원장의 "1명 추가"로 열었다(티켓 04). 인원은 1명이고 날짜는 일행의 날이다. 시각을 바꾸면 별도 예약이 된다(1018 스펙 D29). */
  joining: boolean;
  monthEndDate: string;
  monthStartDate: string;
  onAddGuest: (guest: { courseId: string; therapist1Id: string | null }) => void;
  onNow: () => void;
  onNext: () => void;
  onPartySizeChange: (size: number) => void;
  onRemoveGuest: (index: number) => void;
  /** 날짜·시각은 바뀔 때마다 그 조합으로 가능 판정을 다시 불러와야 해 일반 편집 대신 전용 콜백을 쓴다. */
  onScheduleChange: (serviceDate: string, startTime: string) => void;
  onSecondTherapist: (index: number, therapistId: string | null) => void;
  options: ServiceCallFormOptions;
  partySize: number;
  presetTherapistId: string | null;
  /** "출근 전 보기". ②에 갔다 와도 남도록 패널이 든다. */
  showBeforeCheckIn: boolean;
  onShowBeforeCheckInChange: (show: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const { rows, seats, pending, failed } = availability;
  const columns = quickBookingCourseColumns(rows);
  const groups = quickBookingTherapistGroups(rows, { presetTherapistId, showBeforeCheckIn });
  const taken = takenTherapistIds(guests);
  const full = guests.length >= partySize;
  const text = guestTextOf(t, rows, options);
  const verdictOf = (row: TherapistAvailabilityRowDto) => (courseId: string) =>
    row.courses.find((course) => course.courseId === courseId)?.verdict ?? null;

  const seatsNow = seats[0] ?? null;
  const shortage = quickBookingSeatShortage(seats, columns, guests);

  function pickFor(row: TherapistAvailabilityRowDto) {
    return (column: QuickBookingCourseColumn, verdict: Exclude<ChipVerdict, null>) => {
      if (verdict === "possible") {
        onAddGuest({ courseId: column.courseId, therapist1Id: row.therapistId });
        return;
      }
      setPendingPick({ kind: "first", courseId: column.courseId, therapistId: row.therapistId, therapistName: row.therapistName, verdict });
    };
  }

  const therapistLine = (row: TherapistAvailabilityRowDto) => (
    <PickLine
      chips={verdictOf(row)}
      columns={columns}
      count={<TherapistCallCount locale={locale} row={row} />}
      disabled={disabled || full || taken.has(row.therapistId)}
      key={row.therapistId}
      name={row.therapistName}
      note={<FreeTimeText row={row} />}
      onPick={pickFor(row)}
      preset={row.therapistId === presetTherapistId}
      tag={
        taken.has(row.therapistId)
          ? t("calls.quickBooking.takenTag")
          : row.attendance === "checked_out"
            ? t("calls.availability.checkedOutTag")
            : row.attendance === "before_check_in"
              ? t("calls.quickBooking.beforeCheckInTag")
              : null
      }
      therapistId={row.therapistId}
    />
  );

  const pendingVerdict = pendingPick?.verdict ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field error={fieldErrors.serviceDate?.[0] ?? null} label={t("common.queryDate")}>
          <input
            className={inputFieldClassName({ invalid: Boolean(fieldErrors.serviceDate?.[0]) })}
            disabled={disabled || joining}
            max={monthEndDate}
            min={monthStartDate}
            onChange={(event) => onScheduleChange(event.target.value, draft.startTime)}
            type="date"
            value={draft.serviceDate}
          />
        </Field>
        <Field error={fieldErrors.startTime?.[0] ?? null} label={t("calls.column.time")}>
          <ListboxSelect
            disabled={disabled}
            id="quick-booking-time"
            invalid={Boolean(fieldErrors.startTime?.[0])}
            onChange={(next) => onScheduleChange(draft.serviceDate, next)}
            options={[
              { label: t("calls.placeholder.searchEmpty"), value: "" },
              ...options.timeSlots.map((slot) => ({ label: slot.label, value: slot.value }))
            ]}
            value={draft.startTime}
          />
        </Field>
        <Button disabled={disabled} onClick={onNow} type="button" variant="secondary">
          {t("calls.quickBooking.schedule.now")}
        </Button>
        {joining ? null : (
          <Field label={t("calls.quickBooking.customer.partySize")}>
            <ListboxSelect
              className="w-24"
              disabled={disabled}
              onChange={(next) => onPartySizeChange(Number(next))}
              options={Array.from({ length: QUICK_BOOKING_PARTY_MAX_GUESTS }, (_, index) => index + 1).map((count) => ({
                label: t("calls.quickBooking.customer.partySizeOption", { count }),
                value: String(count)
              }))}
              value={String(partySize)}
            />
          </Field>
        )}
      </div>

      <section aria-label={t("calls.quickBooking.pickList")} className="grid gap-2">
        {seatsNow ? (
          <p className="text-sm font-semibold text-foreground" data-quick-booking-seats={`${seatsNow.remaining}/${seatsNow.capacity}`}>
            {t("calls.quickBooking.seats.remaining", {
              time: seatsNow.time,
              remaining: formatNumber(locale, seatsNow.remaining),
              capacity: formatNumber(locale, seatsNow.capacity)
            })}
          </p>
        ) : null}
        {groups.beforeCheckInCount > 0 ? (
          <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
            <input
              checked={showBeforeCheckIn}
              className="h-5 w-5 accent-brand"
              onChange={(event) => onShowBeforeCheckInChange(event.target.checked)}
              type="checkbox"
            />
            {t("calls.quickBooking.showBeforeCheckIn", { count: groups.beforeCheckInCount })}
          </label>
        ) : null}
        {pending ? <p className="text-sm text-muted">{t("calls.availability.loading")}</p> : null}
        {failed ? <p className="text-sm text-danger">{t("calls.availability.loadError")}</p> : null}
        {!pending && !failed ? (
          // 칩 열이 패널 폭보다 넓으면 이 목록만 옆으로 밀린다. 화면 전체는 가로로 넘치지 않는다(1018 스펙 D7).
          <div className="overflow-x-auto">
            <ul className="grid min-w-max">
              <PickLine
                chips={() => "possible"}
                columns={columns}
                disabled={disabled || full}
                name={t("calls.quickBooking.unassigned")}
                note={<span className="text-xs text-muted">{t("calls.quickBooking.unassignedNote")}</span>}
                onPick={(column) => onAddGuest({ courseId: column.courseId, therapist1Id: null })}
                therapistId={null}
              />
              {groups.listed.map(therapistLine)}
            </ul>
            {groups.listed.length === 0 ? <p className="py-2 text-sm text-muted">{t("calls.quickBooking.nobodyListed")}</p> : null}
            {groups.unavailable.length > 0 ? (
              <details className="mt-1" data-quick-booking-unavailable="">
                <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted">
                  {t("calls.quickBooking.unavailableCount", { count: groups.unavailable.length })}
                </summary>
                <ul className="grid min-w-max">{groups.unavailable.map(therapistLine)}</ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </section>

      <section aria-label={t("calls.quickBooking.guests.aria")} className="grid gap-2 rounded-md border border-border bg-surface p-3">
        <p className="text-sm font-semibold text-foreground" data-quick-booking-picked={`${guests.length}/${partySize}`}>
          {t("calls.quickBooking.guests.count", { count: guests.length, size: partySize })}
        </p>
        {guests.length === 0 ? <p className="text-sm text-muted">{t("calls.quickBooking.guests.empty")}</p> : null}
        {shortage ? (
          <div data-quick-booking-seat-shortage="">
            <StatusIndicator label={t("calls.quickBooking.seats.short", seatShortageText(locale, shortage))} tone="warning" />
          </div>
        ) : null}
        <ol className="grid gap-1.5">
          {guests.map((guest, index) => {
            const needsSecond = Boolean(guest.therapist1Id) && columns.some((column) => column.courseId === guest.courseId && column.requiresSecondTherapist);
            const errors = guestFieldErrors(fieldErrors, index + 1);
            const secondCandidates = [...groups.listed, ...groups.unavailable].filter(
              (row) => row.therapistId !== guest.therapist1Id && !takenTherapistIds(guests, index).has(row.therapistId)
            );
            const error = errors.therapist2Id?.[0] ?? errors.therapist1Id?.[0] ?? errors.courseId?.[0] ?? null;
            return (
              <li className="grid gap-1.5" data-quick-booking-guest={index + 1} key={index}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm text-foreground">
                    {`${t("calls.quickBooking.party.guest", { position: index + 1 })} · ${text.guest(guest)}`}
                    {guest.therapist2Id ? ` + ${text.therapist(guest.therapist2Id)}` : ""}
                  </span>
                  <Button disabled={disabled} onClick={() => onRemoveGuest(index)} type="button" variant="ghost">
                    {t("calls.quickBooking.guests.remove")}
                  </Button>
                </div>
                {needsSecond ? (
                  <label className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                    {t("calls.quickBooking.therapist.secondTitle")}
                    <ListboxSelect
                      className="min-w-40"
                      disabled={disabled}
                      invalid={!guest.therapist2Id}
                      onChange={(next) => {
                        const therapistId = next || null;
                        const candidate = secondCandidates.find((row) => row.therapistId === therapistId);
                        const verdict = candidate?.courses.find((course) => course.courseId === guest.courseId)?.verdict ?? "possible";
                        if (!candidate || verdict === "possible") {
                          onSecondTherapist(index, therapistId);
                          return;
                        }
                        setPendingPick({ kind: "second", index, therapistId: candidate.therapistId, therapistName: candidate.therapistName, verdict });
                      }}
                      options={[
                        { label: t("calls.quickBooking.therapist.secondUnset"), value: "" },
                        ...secondCandidates.map((row) => {
                          const verdict = row.courses.find((course) => course.courseId === guest.courseId)?.verdict ?? "possible";
                          return {
                            label: verdict === "possible" ? row.therapistName : `${row.therapistName} · ${t("calls.quickBooking.secondImpossible")}`,
                            value: row.therapistId
                          };
                        })
                      ]}
                      value={guest.therapist2Id ?? ""}
                    />
                  </label>
                ) : null}
                {error ? (
                  <span className="text-xs text-danger" role="alert">
                    {error}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
        <Button disabled={disabled || guests.length !== partySize} onClick={onNext} type="button">
          {t("calls.quickBooking.next")}
        </Button>
      </div>

      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.quickBooking.therapist.overrideAssign")}
        description={
          pendingVerdict
            ? t(pendingVerdict === "rate_missing" ? "calls.quickBooking.therapist.overrideRateMissing" : "calls.quickBooking.therapist.overrideTimeShort", {
                therapist: pendingPick?.therapistName ?? ""
              })
            : undefined
        }
        onConfirm={() => {
          if (!pendingPick) return;
          if (pendingPick.kind === "first") onAddGuest({ courseId: pendingPick.courseId, therapist1Id: pendingPick.therapistId });
          else onSecondTherapist(pendingPick.index, pendingPick.therapistId);
          setPendingPick(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingPick(null);
        }}
        open={pendingPick !== null}
        title={t("calls.quickBooking.therapist.overrideTitle")}
      />
    </div>
  );
}

type VisitSummary = { counts: CustomerVisitCountsDto; recentVisit: CustomerVisitHistoryRowDto | null; sharedPhone: boolean };

/**
 * ② 고객(1018 스펙 D21–D22): 예약 경로 버튼, 예약자명(같은 이름 고객 후보), 기존 고객 검색, 메모, 한 줄 요약, 저장.
 * 고객을 고르지 않았고 예약자명이 있으면 저장할 때 새 고객이 생긴다. 일행에 더하는 손님은 고객을 잇지 않는다(스펙 D12).
 */
export function CustomerStep({
  bookerCandidates,
  customers,
  disabled,
  draft,
  fieldErrors,
  joining,
  locale,
  message,
  notice,
  onClearCustomer,
  onEdit,
  onPrevious,
  onQueryChange,
  onRetry,
  onSave,
  onSelectCustomer,
  options,
  query,
  searchCandidates,
  status,
  summary,
  visitSummary
}: {
  /** 예약자명과 같은 이름의 고객(최근 방문 날짜와 함께). */
  bookerCandidates: CustomerVisitCandidateDto[];
  customers: CustomerDto[];
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  fieldErrors: Record<string, string[]>;
  /** 일행에 붙는 손님이라 고객을 잇지 않는다(스펙 D12). "1명 추가"에서 시각을 바꿨으면 false다. */
  joining: boolean;
  locale: Locale;
  message: string | null;
  notice: string | null;
  onClearCustomer: () => void;
  onEdit: <Key extends keyof QuickBookingState["save"]["draft"]>(key: Key, value: QuickBookingState["save"]["draft"][Key]) => void;
  onPrevious: () => void;
  onQueryChange: (value: string) => void;
  onRetry: () => void;
  onSave: () => void;
  onSelectCustomer: (candidate: CustomerVisitCandidateDto) => void;
  options: ServiceCallFormOptions;
  query: string;
  /** 기존 고객 검색 결과(22의 비교 정보를 그대로 받는다. kind: "memo" 후보는 미리 뺀다). */
  searchCandidates: CustomerVisitCandidateDto[];
  status: NewRowSaveStatus;
  summary: string;
  /** 고른 고객의 방문완료·노쇼·취소 건수(B09)와 같은 연락처 경고(S5). 고른 고객이 없으면 null이다. */
  visitSummary: VisitSummary | null;
}) {
  const t = useT();
  const linked = draft.customerId ? (customers.find((customer) => customer.id === draft.customerId) ?? null) : null;

  return (
    <div className="grid gap-4">
      <div aria-label={t("calls.quickBooking.channel")} className="grid gap-1.5" role="group">
        <span className="text-sm font-semibold text-foreground">{t("calls.quickBooking.channel")}</span>
        <div className="flex flex-wrap gap-1.5">
          {options.bookingChannels.map((channel) => {
            const pressed = draft.bookingChannelCode === channel.value;
            return (
              <button
                aria-pressed={pressed}
                className={cn(
                  "min-h-11 rounded-full border px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                  pressed ? "border-brand bg-brand text-brand-foreground" : "border-border text-foreground hover:bg-readonly"
                )}
                data-booking-channel={channel.value}
                disabled={disabled}
                key={channel.value}
                onClick={() => onEdit("bookingChannelCode", pressed ? null : channel.value)}
                type="button"
              >
                {channel.label}
              </button>
            );
          })}
        </div>
        {fieldErrors.bookingChannelCode?.[0] ? (
          <span className="text-xs text-danger" role="alert">
            {fieldErrors.bookingChannelCode[0]}
          </span>
        ) : null}
      </div>

      <Field error={fieldErrors.bookerName?.[0] ?? fieldErrors.newCustomer?.[0] ?? null} label={t("calls.quickBooking.bookerName")}>
        <input
          autoComplete="off"
          className={inputFieldClassName({ className: "w-full", invalid: Boolean(fieldErrors.bookerName?.[0] ?? fieldErrors.newCustomer?.[0]) })}
          disabled={disabled}
          maxLength={200}
          onChange={(event) => onEdit("bookerName", event.target.value === "" ? null : event.target.value)}
          placeholder={t("calls.quickBooking.bookerNamePlaceholder")}
          type="text"
          value={draft.bookerName ?? ""}
        />
      </Field>
      {!joining && !linked && bookerCandidates.length > 0 ? (
        <ul aria-label={t("calls.quickBooking.sameNameCustomers")} className="grid gap-1.5">
          {bookerCandidates.map((candidate) => (
            <li key={candidate.customerId ?? candidate.label}>
              <button
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                data-booker-candidate={candidate.customerId ?? ""}
                disabled={disabled}
                onClick={() => onSelectCustomer(candidate)}
                type="button"
              >
                <span className="font-semibold text-foreground">{[candidate.label, candidate.phone].filter(Boolean).join(" · ")}</span>
                <span className="text-xs text-muted">
                  {candidate.latestVisitDate
                    ? t("calls.quickBooking.latestVisit", { date: candidate.latestVisitDate })
                    : t("calls.quickBooking.noVisit")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {joining ? null : linked ? (
        <div className="grid gap-3">
          <Field label={t("calls.quickBooking.customer.linked")}>
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{[linked.name, linked.phone].filter((part) => part && part.trim() !== "").join(" · ")}</span>
              <Button disabled={disabled} onClick={onClearCustomer} type="button" variant="secondary">
                {t("calls.quickBooking.customer.clear")}
              </Button>
            </div>
          </Field>
          {visitSummary?.sharedPhone ? (
            <ScreenState kind="warning" label={t("customers.duplicatePhone.chip")} title={t("customers.duplicatePhone.title")} />
          ) : null}
          {visitSummary ? <CustomerVisitCounts counts={visitSummary.counts} locale={locale} /> : null}
        </div>
      ) : (
        <Field label={t("calls.quickBooking.customer.searchLabel")}>
          <input
            aria-controls={searchCandidates.length > 0 ? "quick-booking-customer-matches" : undefined}
            aria-expanded={searchCandidates.length > 0}
            autoComplete="off"
            className={inputFieldClassName({ className: "w-full" })}
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("calls.search.label")}
            role="combobox"
            type="text"
            value={query}
          />
          {searchCandidates.length > 0 ? (
            searchCandidates.some((candidate) => candidate.sharedPhone) ? (
              <CustomerCandidateCompare
                activeIndex={-1}
                candidates={searchCandidates}
                label={t("calls.quickBooking.customer.searchLabel")}
                listboxId="quick-booking-customer-matches"
                locale={locale}
                onSelect={onSelectCustomer}
                selectedCustomerId={draft.customerId ?? null}
                selectedMemo={null}
              />
            ) : (
              <ul aria-label={t("calls.quickBooking.customer.searchLabel")} className="grid gap-1.5" id="quick-booking-customer-matches" role="listbox">
                {searchCandidates.map((candidate) => (
                  <li key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`} role="presentation">
                    <button
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                      disabled={disabled}
                      onClick={() => onSelectCustomer(candidate)}
                      role="option"
                      type="button"
                    >
                      <span className="font-semibold text-foreground">{candidate.label}</span>
                      <span className="text-xs text-muted">{candidate.phone ?? ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Field>
      )}

      {/* 메모는 이 방문의 요청(F06, 티켓 23)으로 저장한다(1018 스펙 D21). */}
      <Field error={fieldErrors.visitRequest?.[0] ?? null} label={t("calls.quickBooking.memo")}>
        <textarea
          className={inputFieldClassName({ className: "h-20 w-full py-2", invalid: Boolean(fieldErrors.visitRequest?.[0]) })}
          disabled={disabled}
          maxLength={500}
          onChange={(event) => onEdit("visitRequest", event.target.value === "" ? null : event.target.value)}
          value={draft.visitRequest ?? ""}
        />
      </Field>

      <p className="rounded-md bg-readonly px-3 py-2 text-sm font-semibold text-foreground" data-quick-booking-summary="">
        {summary}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <Button disabled={disabled} onClick={onPrevious} type="button" variant="secondary">
          {t("calls.quickBooking.previous")}
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <NewCallRowSaveStatus message={message} notice={notice} onRetry={onRetry} state={status} />
          <Button aria-busy={status === "saving"} disabled={disabled} onClick={onSave} type="button">
            {t("calls.quickBooking.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** 이름이 같은 고객 후보(1018 스펙 D21). 글자 앞뒤 공백과 대소문자는 같게 본다. */
function sameName(candidate: CustomerVisitCandidateDto, name: string) {
  return candidate.kind === "customer" && candidate.label.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase();
}

/** 디바운스 고객 검색(고객 화면·고객 연결 정정과 같은 상수). 연결할 customerId가 없는 메모 후보는 뺀다. */
function useCustomerSearch(query: string, enabled = true) {
  const [candidates, setCandidates] = useState<CustomerVisitCandidateDto[]>([]);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || !enabled) {
      setCandidates([]);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      void searchCustomerLinkCandidatesAction(trimmed).then((results) => {
        if (active) setCandidates(results.filter((candidate) => candidate.kind === "customer"));
      });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, enabled]);
  return candidates;
}

/**
 * 빠른 예약 옆 패널(1018 스펙 D19). 편집 패널과 같은 비모달 옆 패널이라 원장이 왼쪽으로 줄어든다. 휴대폰 폭에서는 전체 화면
 * 시트다. 패널은 원장 작업면이 그리고, 열고 닫는 것도 작업면이 정한다(open, onOpenChange). 원장의 콜을 열면 그 편집 패널이
 * 이 자리를 쓰고, 이 패널은 쓰던 값을 둔 채 숨는다(hidden). 닫으면 SidePanel이 연 자리로 포커스를 돌려준다.
 */
export function QuickBookingPanel({
  customers,
  hidden = false,
  initialAvailabilityRows,
  initialAvailabilityTime,
  isLocked,
  monthEndDate,
  monthStartDate,
  onOpenChange,
  open,
  operatingMonthId,
  options,
  serviceDate
}: {
  customers: CustomerDto[];
  hidden?: boolean;
  initialAvailabilityRows: TherapistAvailabilityRowDto[];
  initialAvailabilityTime: string;
  isLocked: boolean;
  monthEndDate: string;
  monthStartDate: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const ledger = useMemo(() => ({ operatingMonthId, serviceDate }), [operatingMonthId, serviceDate]);
  const [state, dispatch] = useReducer(quickBookingReducer, ledger, (initial) => initialQuickBookingState(initial, newRequestId()));
  const { step, save, touched, guests, partySize, joinParty, presetTherapistId } = state;
  // 패널을 닫지 않고 다른 화면으로 옮기거나 브라우저를 닫으려 하면(티켓 18) 같은 안내를 받는다.
  useUnsavedGuard(touched);
  const { draft, fieldErrors, message } = save;
  const locked = isLocked || isQuickBookingLocked(state);
  const [, startTransition] = useTransition();
  const request = save.inFlight;

  const [availabilityRows, setAvailabilityRows] = useState(initialAvailabilityRows);
  const [seats, setSeats] = useState<SeatPointDto[]>([]);
  const [confirmSeats, setConfirmSeats] = useState(false);
  const [showBeforeCheckIn, setShowBeforeCheckIn] = useState(false);
  const [availabilityPending, setAvailabilityPending] = useState(false);
  const [availabilityFailed, setAvailabilityFailed] = useState(false);
  const availabilityRequestId = useRef(0);

  async function loadAvailability(date: string, time: string) {
    // 열 때마다 다시 읽는다. 앞서 저장한 예약이 가능 판정에 바로 들어가야 한다.
    const id = ++availabilityRequestId.current;
    setAvailabilityFailed(false);
    // 다른 시각의 남은 자리로 경고하지 않게 새로 받을 때까지 비운다.
    setSeats([]);
    if (!time) {
      setAvailabilityRows([]);
      return;
    }
    setAvailabilityPending(true);
    try {
      const result = await loadTherapistAvailabilityAction({ operatingMonthId, serviceDate: date, time });
      if (availabilityRequestId.current === id) {
        setAvailabilityRows(result.rows);
        setSeats(result.seats);
      }
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

  const [customerQuery, setCustomerQuery] = useState("");
  const searchCandidates = useCustomerSearch(customerQuery);
  const bookerName = draft.bookerName?.trim() ?? "";
  // "1명 추가"에서 시각을 바꾸면 일행이 아닌 별도 예약이라(1018 스펙 D29) 고객 단계가 보통 예약과 같다.
  const joining = joinsParty(state);
  const bookerMatches = useCustomerSearch(bookerName, !joining && !draft.customerId);
  const bookerCandidates = bookerMatches.filter((candidate) => sameName(candidate, bookerName));

  function selectCustomer(candidate: CustomerVisitCandidateDto) {
    if (candidate.kind !== "customer" || !candidate.customerId) return;
    edit("customerId", candidate.customerId);
    if (!draft.bookerName?.trim()) edit("bookerName", candidate.label);
    setCustomerQuery("");
  }

  const [visitSummary, setVisitSummary] = useState<VisitSummary | null>(null);
  useEffect(() => {
    const customerId = draft.customerId;
    if (!customerId) {
      setVisitSummary(null);
      return;
    }
    let active = true;
    void loadCustomerVisitSummaryAction(customerId).then((summary) => {
      if (active) setVisitSummary(summary);
    });
    return () => {
      active = false;
    };
  }, [draft.customerId]);

  function setSchedule(nextDate: string, nextTime: string) {
    dispatch({ type: "edit", changes: { serviceDate: nextDate, startTime: nextTime } });
    void loadAvailability(nextDate, nextTime);
  }

  // 저장한 새 줄 찾기(focusCreatedRow)의 순번. 빠른 예약을 다시 열면 올려서 앞 찾기를 멈춘다.
  const createdRowFocus = useRef(0);

  // 응답을 받지 못하면(네트워크 오류, 시간 초과) 초안과 요청 id를 둔 채 "저장 여부 확인 중"이 된다(티켓 16).
  useEffect(() => {
    if (!request) return;
    startTransition(() => {
      void (async () => {
        const giveUp = window.setTimeout(() => dispatch({ type: "lost", request }), QUICK_BOOKING_SAVE_TIMEOUT_MS);
        try {
          // 일행(2명 이상)은 손님마다 콜을 한 번에 만드는 일행 저장으로 보낸다. 보내는 동안 손님은 잠겨 있어
          // 지금 손님 목록이 이 요청을 만든 그 목록이다. 1명이면 한 건 저장이다.
          const result =
            guests.length > 1
              ? await createQuickBookingPartyAction(quickBookingPartyRequest(request, guests.slice(1)))
              : await createQuickBookingServiceCallAction(request);
          if (result.ok) {
            const createdId = Array.isArray(result.data) ? result.data[0]?.id : result.data.id;
            setSavedNotice(result.notice ?? null);
            dispatch({ type: "saved", request, notice: result.notice ?? null, nextRequestId: newRequestId() });
            onOpenChange(false);
            // 저장한 뒤에는 새 행이 골라진다(1018 스펙 D19). 서버 액션 뒤 원장이 저절로 다시 그려지지 않을 때가 있어
            // (router.refresh도 결과가 화면에 붙지 않는 때가 있었다), 새 콜을 고른 주소로 옮겨 원장을 다시 받는다.
            // 주소의 call 매개변수가 그 줄의 편집 패널을 연다.
            if (createdId) {
              const address = new URL(window.location.href);
              address.searchParams.set(CALL_PARAM, createdId);
              router.replace(`${address.pathname}${address.search}`, { scroll: false });
            }
            const token = ++createdRowFocus.current;
            if (createdId) focusCreatedRow(createdId, () => createdRowFocus.current === token);
          } else {
            dispatch({ type: "failed", request, message: result.formError ?? null, fieldErrors: result.fieldErrors });
            const field = Object.keys(result.fieldErrors ?? {})[0];
            dispatch({ type: "step", step: field ? (quickBookingStepOfField(field) ?? "customer") : "customer" });
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

  // 머리 버튼, 원장의 "일행에 1명 추가"(티켓 04), Therapist 현황 줄의 카드(1018 스펙 D17). 쓰던 초안이 있으면 머리 버튼은
  // 그 초안을 그대로 다시 보이고, 나머지는 버릴지 먼저 묻는다(패널을 닫을 때와 같은 안내).
  type PendingStart = { kind: "join"; join: QuickBookingJoinParty } | { kind: "therapist"; therapistId: string };
  const [pendingStart, setPendingStart] = useState<PendingStart | null>(null);
  function start(next: PendingStart | null) {
    createdRowFocus.current += 1;
    if (next?.kind === "join") {
      dispatch({ type: "joinParty", join: next.join, nextRequestId: newRequestId() });
      void loadAvailability(next.join.serviceDate, next.join.startTime);
    } else {
      const time = defaultStartTime(serviceDate, options.timeSlots);
      dispatch({ type: "start", serviceDate, startTime: time, presetTherapistId: next?.therapistId ?? null, nextRequestId: newRequestId() });
      void loadAvailability(serviceDate, time);
    }
    setSavedNotice(null);
    setCustomerQuery("");
    setShowBeforeCheckIn(false);
    onOpenChange(true);
  }
  const startRef = useRef(start);
  startRef.current = start;
  const touchedRef = useRef(touched);
  touchedRef.current = touched;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  useEffect(() => {
    const request = (next: PendingStart | null) => {
      if (isLocked) return;
      if (!touchedRef.current) startRef.current(next);
      else if (next) setPendingStart(next);
      else onOpenChangeRef.current(true);
    };
    const stopOpen = onQuickBookingOpen(() => request(null));
    const stopJoin = onQuickBookingJoinParty((join) => request({ kind: "join", join }));
    const stopTherapist = onQuickBookingWithTherapist((therapistId) => request({ kind: "therapist", therapistId }));
    return () => {
      stopOpen();
      stopJoin();
      stopTherapist();
    };
  }, [isLocked]);

  // 머리 버튼이 주 버튼일지 정하도록 패널이 보이는지 알린다. 콜을 열어 편집 패널이 이 자리를 쓰면(hidden) 보이지 않는다.
  useEffect(() => {
    announceQuickBookingShown(open && !hidden);
  }, [open, hidden]);
  useEffect(() => () => announceQuickBookingShown(false), []);

  // 열면 시각 칸으로 포커스를 옮긴다. 휴대폰 시트는 목록을 덮으므로 닫기 버튼으로 옮긴다.
  const panelRef = useRef<HTMLDivElement>(null);
  // 열 때만 옮긴다. 편집 패널이 닫혀 다시 보일 때는 포커스를 편집하던 줄에 둔다.
  useEffect(() => {
    if (!open) return;
    const target =
      panelRef.current?.querySelector<HTMLElement>(window.innerWidth < 600 ? "aside button" : "#quick-booking-time") ??
      panelRef.current?.querySelector<HTMLElement>("aside button");
    target?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function requestClose() {
    if (touched) {
      setConfirmClose(true);
      return;
    }
    onOpenChange(false);
  }

  const errorSteps = useMemo(() => {
    const steps = new Set<QuickBookingStep>();
    for (const field of Object.keys(fieldErrors)) {
      const target = quickBookingStepOfField(field);
      if (target) steps.add(target);
    }
    return steps;
  }, [fieldErrors]);

  const full = guests.length > 0 && guests.length === partySize;
  // ② 고객으로 넘어갈 때 담은 손님이 남은 자리를 넘으면 `그래도 예약`을 먼저 묻는다(1018 스펙 D26). 담은 뒤 시각을 바꿔 넘치게 된
  // 것도 여기서 걸린다. 담기 자체는 막지 않는다.
  const seatShortage = quickBookingSeatShortage(seats, quickBookingCourseColumns(availabilityRows), guests);
  function goToStep(next: QuickBookingStep) {
    if (next === "customer" && seatShortage) {
      setConfirmSeats(true);
      return;
    }
    dispatch({ type: "step", step: next });
  }
  const text = guestTextOf(t, availabilityRows, options);
  const summary = quickBookingSummary({
    startTime: draft.startTime,
    partySizeLabel: t("calls.quickBooking.customer.partySizeOption", { count: partySize }),
    guests: guests.map(text.guest),
    channelLabel: options.bookingChannels.find((channel) => channel.value === draft.bookingChannelCode)?.label ?? null,
    bookerName: draft.bookerName
  });

  return (
    <>
      <div aria-live="polite" className={savedNotice ? "text-sm text-foreground" : "sr-only"} role="status">
        {savedNotice}
      </div>
      {open ? (
        <div hidden={hidden} id="quick-booking-panel" ref={panelRef}>
          <SidePanel
            className="max-[599px]:fixed max-[599px]:inset-0 max-[599px]:z-50 max-[599px]:max-h-none max-[599px]:rounded-none max-[599px]:border-0"
            onClose={requestClose}
            title={t("calls.quickBooking.title")}
          >
            <StepperNav
              customerReady={full}
              disabled={locked}
              errorSteps={errorSteps}
              onSelect={goToStep}
              step={step}
            />
            {/* 시각을 바꿔 일행에서 별도 예약으로 넘어가는 것을 읽어 주도록 상태 영역으로 둔다. */}
            {joinParty ? (
              <p
                className="mb-4 rounded-md bg-readonly px-3 py-2 text-sm font-semibold text-foreground"
                data-quick-booking-join-party={joining ? joinParty.partyId : undefined}
                data-quick-booking-separate-booking={joining ? undefined : ""}
                role="status"
              >
                {!joining
                  ? t("calls.quickBooking.joinParty.separate")
                  : joinParty.customerMemo
                    ? t("calls.quickBooking.joinParty.noticeWithMemo", { memo: joinParty.customerMemo, size: joinParty.size })
                    : t("calls.quickBooking.joinParty.notice", { size: joinParty.size })}
              </p>
            ) : null}
            <ErrorSummary fieldErrors={fieldErrors} message={message} onJump={(next) => dispatch({ type: "step", step: next })} />

            {step === "conditions" ? (
              <ConditionsStep
                availability={{ rows: availabilityRows, seats, pending: availabilityPending, failed: availabilityFailed }}
                disabled={locked}
                draft={draft}
                fieldErrors={fieldErrors}
                guests={guests}
                joining={joinParty !== null}
                monthEndDate={monthEndDate}
                monthStartDate={monthStartDate}
                onAddGuest={(guest) => dispatch({ type: "addGuest", guest })}
                onNext={() => goToStep("customer")}
                onShowBeforeCheckInChange={setShowBeforeCheckIn}
                onNow={() => setSchedule(businessTodayIsoDate(), selectNowSlot(options.timeSlots, nowClockString()))}
                onPartySizeChange={(size) => dispatch({ type: "partySize", size })}
                onRemoveGuest={(index) => dispatch({ type: "removeGuest", index })}
                onScheduleChange={setSchedule}
                onSecondTherapist={(index, therapistId) => dispatch({ type: "secondTherapist", index, therapistId })}
                options={options}
                partySize={partySize}
                presetTherapistId={presetTherapistId}
                showBeforeCheckIn={showBeforeCheckIn}
              />
            ) : (
              <CustomerStep
                bookerCandidates={bookerCandidates}
                customers={customers}
                disabled={locked}
                draft={draft}
                fieldErrors={fieldErrors}
                joining={joining}
                locale={locale}
                message={message}
                notice={save.notice}
                onClearCustomer={() => edit("customerId", null)}
                onEdit={edit}
                onPrevious={() => dispatch({ type: "step", step: "conditions" })}
                onQueryChange={setCustomerQuery}
                onRetry={() => dispatch({ type: "submit" })}
                onSave={() => dispatch({ type: "submit" })}
                onSelectCustomer={selectCustomer}
                options={options}
                query={customerQuery}
                searchCandidates={searchCandidates}
                status={save.status}
                summary={summary}
                visitSummary={visitSummary}
              />
            )}
          </SidePanel>
        </div>
      ) : null}

      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.quickBooking.seats.overrideConfirm")}
        description={seatShortage ? t("calls.quickBooking.seats.overrideDescription", seatShortageText(locale, seatShortage)) : undefined}
        onConfirm={() => {
          setConfirmSeats(false);
          dispatch({ type: "step", step: "customer" });
        }}
        onOpenChange={setConfirmSeats}
        open={confirmSeats}
        title={t("calls.quickBooking.seats.overrideTitle")}
      />
      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.leaveGuard.confirm")}
        description={t("calls.leaveGuard.description")}
        onConfirm={() => {
          setConfirmClose(false);
          // 확인 창이 먼저 닫혀 포커스를 "닫기" 버튼에 돌려준 뒤에 패널을 닫는다. 같은 때 닫으면 두 포커스 복귀가 겹쳐
          // 포커스가 아무 데도 남지 않는다. 패널이 닫히면 SidePanel이 연 자리로 돌려준다.
          window.setTimeout(() => onOpenChange(false), 0);
          // 저장 없이 닫기로 확정하면 초안을 버린다. 다음에 다시 열면 새 요청 id로 처음부터 시작한다.
          dispatch({ type: "discard", nextRequestId: newRequestId() });
        }}
        onOpenChange={setConfirmClose}
        open={confirmClose}
        title={t("calls.leaveGuard.title")}
      />
      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t(pendingStart?.kind === "therapist" ? "calls.quickBooking.presetTherapist.discardConfirm" : "calls.quickBooking.joinParty.discardConfirm")}
        description={t("calls.leaveGuard.description")}
        onConfirm={() => {
          const next = pendingStart;
          setPendingStart(null);
          if (next) start(next);
        }}
        onOpenChange={(next) => {
          if (!next) setPendingStart(null);
        }}
        open={pendingStart !== null}
        title={t("calls.leaveGuard.title")}
      />
    </>
  );
}
