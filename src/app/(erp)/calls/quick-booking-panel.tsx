"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailRow } from "@/components/ui/detail-row";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ModalPanel } from "@/components/ui/panel";
import { ScreenState } from "@/components/ui/screen-state";
import { CustomerCandidateCompare } from "@/components/domain/customer-candidate-compare";
import { CustomerVisitCounts } from "@/components/domain/customer-visit-counts";
import {
  createQuickBookingPartyAction,
  createQuickBookingServiceCallAction,
  loadCustomerVisitSummaryAction,
  loadTherapistAvailabilityAction,
  searchCustomerLinkCandidatesAction
} from "@/app/(erp)/calls/actions";
import { firstVisible } from "@/app/(erp)/calls/call-ledger-workspace";
import type { NewRowSaveStatus } from "@/app/(erp)/calls/call-new-row-save";
import { newRequestId } from "@/app/(erp)/calls/call-request-id";
import { NewCallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import {
  QUICK_BOOKING_STEPS,
  guestFieldErrors,
  initialQuickBookingState,
  isQuickBookingLocked,
  otherGuestTherapistIds,
  quickBookingGuestPosition,
  quickBookingGuests,
  quickBookingPartyRequest,
  quickBookingReducer,
  quickBookingStepOfField,
  type QuickBookingGuest,
  type QuickBookingState,
  type QuickBookingStep
} from "@/app/(erp)/calls/quick-booking-draft";
import { nowClockString, selectNowSlot } from "@/app/(erp)/calls/quick-booking-now-slot";
import {
  AvailabilityRow,
  availabilityRowWarnings,
  filterByAttendance,
  sortAvailabilityRows,
  TherapistAvailabilityView,
  type AvailabilityCourseChoice,
  type AvailabilityCourseOverrideChoice,
  type AvailabilityRowExpansion
} from "@/app/(erp)/calls/therapist-availability-view";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import { CUSTOMER_SEARCH_DEBOUNCE_MS, customerScreenHref } from "@/app/(erp)/customers/customer-search";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";
import { QUICK_BOOKING_PARTY_MAX_GUESTS } from "@/modules/calls/service-call-schema";
import { businessTodayIsoDate } from "@/lib/operating-date";
import type {
  CustomerDto,
  CustomerVisitCandidateDto,
  CustomerVisitCountsDto,
  CustomerVisitHistoryRowDto,
  ServiceCallFormOptions,
  TherapistAvailabilityRowDto
} from "@/modules/calls/service-call-service";

/** 새 콜 저장 응답을 이만큼 기다려도 오지 않으면 "저장 여부 확인 중"이 된다(티켓 16). */
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

/**
 * 저장 직후 새 콜 줄을 골라 편집 패널을 연다(티켓 03). 서버 액션 뒤 자동 라우터 새로고침은 비동기라 줄이
 * 원장 목록에 나타날 때까지 짧게 재시도하며 찾는다. 줄의 여는 버튼을 누른 것과 같아 포커스도 그 줄에 남는다.
 */
function focusCreatedRow(serviceCallId: string, attemptsLeft = 20) {
  const opener = firstVisible<HTMLElement>(`[data-call-open="${CSS.escape(serviceCallId)}"]`);
  if (opener) {
    opener.scrollIntoView({ block: "center" });
    opener.click();
    opener.focus();
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
              candidate === step ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-readonly"
            }`}
            disabled={disabled}
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
  onJump: (step: QuickBookingStep, guestPosition: number | null) => void;
}) {
  const t = useT();
  const entries = Object.entries(fieldErrors).filter(([, messages]) => messages.length > 0);
  // 일행 저장의 손님별 오류(티켓 02)는 손님 번호를 붙여 보이고, 누르면 그 손님으로 간다.
  const guestOf = quickBookingGuestPosition;
  if (!message && entries.length === 0) return null;

  return (
    <ScreenState className="mb-4" kind="error" label={t("calls.quickBooking.errorSummary.title")} title={message ?? t("calls.quickBooking.errorSummary.title")} action={entries.length > 0 ? (
        <ul className="grid gap-1">
          {entries.map(([field, messages]) => (
            <li key={field}>
              <button
                className="text-left text-sm text-danger underline underline-offset-2"
                onClick={() => onJump(quickBookingStepOfField(field) ?? "review", guestOf(field))}
                type="button"
              >
                {guestOf(field) ? `${t("calls.quickBooking.party.guest", { position: guestOf(field)! })} · ${messages[0]}` : messages[0]}
              </button>
            </li>
          ))}
        </ul>
      ) : null} />
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

/** 빈 새 고객 초안(F01, 티켓 24). 이름만 비어 있고 나머지는 저장 전까지 선택이다. */
function blankNewCustomer() {
  return { name: "", phone: null, memo: null, preferenceNote: null };
}

type CustomerStepProps = StepProps & {
  /** 디바운스 검색 결과(22의 비교 정보를 그대로 받는다. kind: "memo" 후보는 이 정정 대상이 아니라 미리 뺀다). */
  candidates: CustomerVisitCandidateDto[];
  locale: Locale;
  onPartySizeChange?: (size: number) => void;
  onQueryChange: (value: string) => void;
  onSelectCandidate: (candidate: CustomerVisitCandidateDto) => void;
  /** 일행 인원 수(스펙 D10, 티켓 02). 1이면 한 명 예약이다. */
  partySize?: number;
  query: string;
  /**
   * 고른 고객의 방문완료·노쇼·취소 건수와 가장 최근 방문(B09, 스토리 71-73), 같은 연락처 경고(S5).
   * 고른 고객이 없으면 null이다.
   */
  visitSummary: { counts: CustomerVisitCountsDto; recentVisit: CustomerVisitHistoryRowDto | null; sharedPhone: boolean } | null;
};

/**
 * 최근 방문에서 코스·Therapist·방문별 요청 중 체크한 것만 가져온다(B09, 스토리 71-73, 티켓 24). 자동
 * 복사는 없다 — 체크 상태는 지금 초안 값이 그 방문의 값과 같은지로만 판단한다. 지금 비활성이거나 유효하지
 * 않은 값(options에 없는 코스·Therapist)은 가져올 수 없음으로 표시하고 체크할 수 없다. 이 화면이 막더라도
 * 실제 저장 거절은 그대로 서비스(assertActiveCourse/assertActiveEmployee)가 한다 — 현재 기준 검사를
 * 우회하지 않는다.
 */
function RecentVisitImport({
  disabled,
  draft,
  onEdit,
  options,
  visit
}: {
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  onEdit: StepProps["onEdit"];
  options: ServiceCallFormOptions;
  visit: CustomerVisitHistoryRowDto;
}) {
  const t = useT();
  const courseActive = options.courses.some((course) => course.value === visit.courseId);
  const courseChecked = draft.courseId === visit.courseId;
  const hasTherapist = Boolean(visit.therapist1Id || visit.therapist2Id);
  const therapistActive =
    (!visit.therapist1Id || options.therapists.some((therapist) => therapist.value === visit.therapist1Id)) &&
    (!visit.therapist2Id || options.therapists.some((therapist) => therapist.value === visit.therapist2Id));
  const therapistChecked = hasTherapist && draft.therapist1Id === visit.therapist1Id && (draft.therapist2Id ?? null) === (visit.therapist2Id ?? null);
  const hasVisitRequest = Boolean(visit.visitRequest && visit.visitRequest.trim() !== "");
  const visitRequestChecked = hasVisitRequest && draft.visitRequest === visit.visitRequest;

  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-foreground">
        {t("calls.quickBooking.customer.recentVisitTitle", { date: `${visit.serviceDate} ${visit.startTime}` })}
      </p>
      <label className="flex min-h-11 items-center gap-2">
        <input
          checked={courseChecked}
          className="h-5 w-5 accent-brand"
          disabled={disabled || !courseActive}
          onChange={(event) => onEdit("courseId", event.target.checked ? visit.courseId : "")}
          type="checkbox"
        />
        <span className="text-sm text-foreground">{t("calls.quickBooking.customer.importCourse", { value: visit.courseLabel })}</span>
        {!courseActive ? <span className="text-xs text-muted">{t("calls.quickBooking.customer.cannotImport")}</span> : null}
      </label>
      {hasTherapist ? (
        <label className="flex min-h-11 items-center gap-2">
          <input
            checked={therapistChecked}
            className="h-5 w-5 accent-brand"
            disabled={disabled || !therapistActive}
            onChange={(event) => {
              onEdit("therapist1Id", event.target.checked ? visit.therapist1Id : null);
              onEdit("therapist2Id", event.target.checked ? visit.therapist2Id : null);
            }}
            type="checkbox"
          />
          <span className="text-sm text-foreground">{t("calls.quickBooking.customer.importTherapist", { value: visit.therapistLabel })}</span>
          {!therapistActive ? <span className="text-xs text-muted">{t("calls.quickBooking.customer.cannotImport")}</span> : null}
        </label>
      ) : null}
      {hasVisitRequest ? (
        <label className="flex min-h-11 items-center gap-2">
          <input
            checked={visitRequestChecked}
            className="h-5 w-5 accent-brand"
            disabled={disabled}
            onChange={(event) => onEdit("visitRequest", event.target.checked ? visit.visitRequest : null)}
            type="checkbox"
          />
          <span className="text-sm text-foreground">{t("calls.quickBooking.customer.importVisitRequest", { value: visit.visitRequest ?? "" })}</span>
        </label>
      ) : null}
    </div>
  );
}

export function CustomerStep({
  candidates,
  customers,
  disabled,
  draft,
  fieldErrors,
  locale,
  onEdit,
  onPartySizeChange,
  onQueryChange,
  onSelectCandidate,
  options,
  partySize = 1,
  query,
  visitSummary
}: CustomerStepProps) {
  const t = useT();
  const linked = draft.customerId ? (customers.find((customer) => customer.id === draft.customerId) ?? null) : null;
  // 패널에서 고객 화면으로 바로 간다(스토리 91). 고른 고객이 있으면 그 고객, 없으면 고객/메모로 연다.
  const customerScreenTarget = draft.customerId
    ? customerScreenHref({ customerQuery: "", visitCustomer: draft.customerId })
    : draft.customerMemo
      ? customerScreenHref({ customerQuery: "", visitMemo: draft.customerMemo })
      : customerScreenHref({ customerQuery: "" });

  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.customer")}</StepHeading>
      <a
        className="justify-self-start text-sm font-semibold text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
        href={customerScreenTarget}
      >
        {t("calls.detail.customerLink.goToCustomerScreen")}
      </a>

      {draft.customerId ? (
        <div className="grid gap-3">
          <Field label={t("calls.quickBooking.customer.searchLabel")}>
            <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
              <span className="text-sm font-semibold text-foreground">
                {[linked?.name, linked?.phone].filter((part) => part && part.trim() !== "").join(" · ")}
              </span>
              <Button disabled={disabled} onClick={() => onEdit("customerId", null)} type="button" variant="secondary">
                {t("calls.quickBooking.customer.clear")}
              </Button>
            </div>
          </Field>
          {/* S5: 검색 목록이 아니라 고른 고객 칸에서도 같은 연락처 경고를 보인다(스펙 F01 단계 1). */}
          {visitSummary?.sharedPhone ? (
            <ScreenState kind="warning" label={t("customers.duplicatePhone.chip")} title={t("customers.duplicatePhone.title")} />
          ) : null}
          {visitSummary ? (
            <div className="grid gap-3 rounded-md border border-border bg-surface p-3">
              <CustomerVisitCounts counts={visitSummary.counts} locale={locale} />
              {visitSummary.recentVisit ? (
                <RecentVisitImport disabled={disabled} draft={draft} onEdit={onEdit} options={options} visit={visitSummary.recentVisit} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : draft.newCustomer ? (
        <div className="grid gap-3 rounded-md border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{t("calls.quickBooking.customer.createNew")}</span>
            <Button disabled={disabled} onClick={() => onEdit("newCustomer", null)} type="button" variant="secondary">
              {t("calls.quickBooking.customer.backToSearch")}
            </Button>
          </div>
          <Field error={fieldErrors.newCustomer?.[0] ?? null} label={t("calls.customer.field.name")}>
            <input
              className={inputFieldClassName({ className: "w-full", invalid: Boolean(fieldErrors.newCustomer?.[0]) })}
              disabled={disabled}
              maxLength={200}
              onChange={(event) => onEdit("newCustomer", { ...draft.newCustomer!, name: event.target.value })}
              type="text"
              value={draft.newCustomer.name}
            />
          </Field>
          <Field label={t("calls.customer.field.phone")}>
            <input
              className={inputFieldClassName({ className: "w-full" })}
              disabled={disabled}
              maxLength={500}
              onChange={(event) => onEdit("newCustomer", { ...draft.newCustomer!, phone: event.target.value === "" ? null : event.target.value })}
              type="text"
              value={draft.newCustomer.phone ?? ""}
            />
          </Field>
          <Field label={t("calls.customer.field.preferenceNote")}>
            <textarea
              className={inputFieldClassName({ className: "h-20 w-full py-2" })}
              disabled={disabled}
              maxLength={500}
              onChange={(event) =>
                onEdit("newCustomer", { ...draft.newCustomer!, preferenceNote: event.target.value === "" ? null : event.target.value })
              }
              value={draft.newCustomer.preferenceNote ?? ""}
            />
          </Field>
        </div>
      ) : (
        <Field label={t("calls.quickBooking.customer.searchLabel")}>
          <input
            aria-controls={candidates.length > 0 ? "quick-booking-customer-matches" : undefined}
            aria-expanded={candidates.length > 0}
            autoComplete="off"
            className={inputFieldClassName({ className: "w-full" })}
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("calls.search.label")}
            role="combobox"
            type="text"
            value={query}
          />
          {candidates.length > 0 ? (
            candidates.some((candidate) => candidate.sharedPhone) ? (
              <CustomerCandidateCompare
                activeIndex={-1}
                candidates={candidates}
                label={t("calls.quickBooking.customer.searchLabel")}
                listboxId="quick-booking-customer-matches"
                locale={locale}
                onSelect={onSelectCandidate}
                selectedCustomerId={draft.customerId ?? null}
                selectedMemo={null}
              />
            ) : (
              <ul aria-label={t("calls.quickBooking.customer.searchLabel")} className="grid gap-1.5" id="quick-booking-customer-matches" role="listbox">
                {candidates.map((candidate) => (
                  <li key={`${candidate.kind}:${candidate.customerId ?? ""}:${candidate.label}`} role="presentation">
                    <button
                      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-readonly"
                      disabled={disabled}
                      onClick={() => onSelectCandidate(candidate)}
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
          <Button
            className="justify-self-start"
            disabled={disabled}
            onClick={() => onEdit("newCustomer", blankNewCustomer())}
            type="button"
            variant="secondary"
          >
            {t("calls.quickBooking.customer.createNew")}
          </Button>
        </Field>
      )}

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

      {/* 일행 인원(스펙 D10, 티켓 02). 고객은 대표 한 명이고, 2명 이상이면 다음 단계에서 손님마다 고른다. */}
      <Field label={t("calls.quickBooking.customer.partySize")}>
        <select
          className={inputFieldClassName({ className: "w-28" })}
          disabled={disabled}
          onChange={(event) => onPartySizeChange?.(Number(event.target.value))}
          value={partySize}
        >
          {Array.from({ length: QUICK_BOOKING_PARTY_MAX_GUESTS }, (_, index) => index + 1).map((count) => (
            <option key={count} value={count}>
              {t("calls.quickBooking.customer.partySizeOption", { count })}
            </option>
          ))}
        </select>
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

/**
 * 일행 손님을 차례로 고르는 줄(스펙 D10, 티켓 02). 손님마다 고른 코스·Therapist 요약이 붙고, 저장 오류가 난
 * 손님에는 "!"가 붙는다(색만으로 알리지 않는다).
 */
export function PartyGuestNav({
  active,
  disabled,
  errorPositions,
  guests,
  onSelect
}: {
  active: number;
  disabled: boolean;
  errorPositions: ReadonlySet<number>;
  guests: Array<{ position: number; summary: string | null }>;
  onSelect: (position: number) => void;
}) {
  const t = useT();
  return (
    <div aria-label={t("calls.quickBooking.party.guestsAria")} className="flex flex-wrap gap-2" role="group">
      {guests.map((guest) => (
        <button
          aria-pressed={guest.position === active}
          className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-left text-xs font-semibold transition-colors ${
            guest.position === active ? "border-brand bg-brand text-brand-foreground" : "border-border text-foreground hover:bg-readonly"
          }`}
          disabled={disabled}
          key={guest.position}
          onClick={() => onSelect(guest.position)}
          type="button"
        >
          {`${t("calls.quickBooking.party.guest", { position: guest.position })} · ${guest.summary ?? t("calls.quickBooking.review.unset")}`}
          {errorPositions.has(guest.position) ? (
            <span aria-hidden="true" className="font-bold text-danger">
              !
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** 시간 부족·수당 없음 코스를 "경고 확인 후 배정"으로 받기 전에 먼저 보여줄 경고(스펙 F01, 티켓 21). */
type PendingTherapistOverride =
  | { kind: "first"; choice: AvailabilityCourseOverrideChoice; therapistName: string }
  | { kind: "second"; therapistId: string; therapistName: string; verdict: "time_short" | "rate_missing" };

export function TherapistStep({
  availabilityFailed,
  availabilityPending,
  availabilityRows,
  availabilityTime,
  courseId,
  courseLabel,
  disabled,
  excludedTherapistIds,
  fieldErrors,
  guestNav,
  locale,
  onChoose,
  onChooseSecond,
  onClear,
  onClearSecond,
  onTimeChange,
  options,
  therapist1Id,
  therapist2Label,
  therapistLabel
}: {
  availabilityFailed: boolean;
  availabilityPending: boolean;
  availabilityRows: TherapistAvailabilityRowDto[];
  availabilityTime: string;
  courseId: string;
  courseLabel: string | null;
  disabled: boolean;
  /** 일행의 다른 손님이 이미 고른 Therapist(티켓 02). 한 사람을 두 손님에게 고르지 못하게 목록에서 뺀다. */
  excludedTherapistIds?: ReadonlySet<string>;
  fieldErrors: Record<string, string[]>;
  /** 일행이면 손님을 차례로 고르는 줄(PartyGuestNav). 한 명 예약이면 없다. */
  guestNav?: ReactNode;
  locale: Locale;
  onChoose: (choice: AvailabilityCourseChoice) => void;
  /** 두 번째 Therapist를 고른다(티켓 21). 코스·시각은 첫 번째 선택으로 이미 고정돼 있어 id만 받는다. */
  onChooseSecond: (therapistId: string) => void;
  onClear: () => void;
  onClearSecond: () => void;
  onTimeChange: (time: string) => void;
  options: ServiceCallFormOptions;
  therapist1Id: string | null | undefined;
  therapist2Label: string | null;
  therapistLabel: string | null;
}) {
  const t = useT();
  // 경고 확인 후 배정은 버튼을 누른 즉시 적용하지 않고, 경고 문장을 먼저 보여준 뒤 확인을 받는다(스펙 F01).
  const [pendingOverride, setPendingOverride] = useState<PendingTherapistOverride | null>(null);
  // 기본은 출근 시각이 입력된 Therapist만 보인다. 출근 전 Therapist는 체크하면 함께 보인다.
  const [showBeforeCheckIn, setShowBeforeCheckIn] = useState(false);
  // 두 번째 후보 목록에서 펼친 줄(불가 칩의 이유, 경고 문구). 첫 목록과 따로 둔다.
  const [secondExpanded, setSecondExpanded] = useState<{ therapistId: string; expansion: AvailabilityRowExpansion } | null>(null);
  const choosableRows = excludedTherapistIds
    ? availabilityRows.filter((row) => !excludedTherapistIds.has(row.therapistId))
    : availabilityRows;
  const attendance = filterByAttendance(choosableRows, showBeforeCheckIn);

  // 코스 정책상 두 번째 Therapist가 필요한지는 가능 코스 행이 코스마다 함께 알려준다(티켓 11). 같은 코스는
  // 어느 행에서 찾아도 같은 값이다.
  const requiresSecondTherapist = Boolean(
    courseId &&
      availabilityRows
        .flatMap((row) => row.courses)
        .find((course) => course.courseId === courseId)?.requiresSecondTherapist
  );
  // 같은 사람을 Therapist 1·2로 고르는 것은 저장 오류라, 후보 목록에서 이미 고른 첫 번째 Therapist는 뺀다.
  // 첫 번째 목록과 같은 출근 기준으로 거른다.
  const secondCandidates = attendance.rows.filter((row) => row.therapistId !== therapist1Id);
  const secondReserveWarningSlot = secondCandidates.some((candidate) => availabilityRowWarnings(locale, candidate).length > 0);

  const overrideVerdict = pendingOverride ? (pendingOverride.kind === "first" ? pendingOverride.choice.verdict : pendingOverride.verdict) : null;
  const overrideTherapistName = pendingOverride?.therapistName ?? "";

  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.therapist")}</StepHeading>
      {guestNav}
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
      {fieldErrors.therapist1Id?.[0] ? (
        <span className="text-xs text-danger" role="alert">
          {fieldErrors.therapist1Id[0]}
        </span>
      ) : null}
      {/*
        가능 코스 화면(TherapistAvailabilityView, 티켓 10–12)을 그대로 재사용한다. 원장 위에 늘 펼쳐 두던
        자리(티켓 20 이전)와 달리 이 단계에서는 늘 펼친 채로 두고(open 고정, onToggle은 no-op), 시각은
        "날짜·예약시각" 단계와 같은 값을 공유한다. 가능 버튼은 Therapist와 코스만 채운다(스펙 F01).
        시간 부족·수당 없음 코스는 onOverride로 "경고 확인 후 배정" 경로를 더한다(티켓 21).
      */}
      <TherapistAvailabilityView
        attendanceFilter={{
          hiddenCount: attendance.hiddenCount,
          nobodyAttended: attendance.nobodyAttended,
          onShowAllChange: setShowBeforeCheckIn,
          showAll: showBeforeCheckIn
        }}
        failed={availabilityFailed}
        locale={locale}
        onChoose={onChoose}
        onOverride={(choice) => {
          const therapistName = availabilityRows.find((row) => row.therapistId === choice.therapistId)?.therapistName ?? choice.therapistId;
          setPendingOverride({ kind: "first", choice, therapistName });
        }}
        onTimeChange={onTimeChange}
        onToggle={() => {}}
        open
        pending={availabilityPending}
        rows={attendance.rows}
        time={availabilityTime}
        timeSlots={options.timeSlots}
      />

      {/* 두 명 코스는 두 번째 Therapist를 따로 고른다(스펙 F01, 티켓 21). 코스가 그 정책일 때만 보인다. */}
      {requiresSecondTherapist ? (
        <div className="grid gap-3 rounded-lg border border-border bg-surface p-4">
          <h3 className="text-[0.9375rem] font-semibold text-foreground">{t("calls.quickBooking.therapist.secondTitle")}</h3>
          {therapist2Label ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <span className="text-sm font-semibold text-foreground">{therapist2Label}</span>
              <Button disabled={disabled} onClick={onClearSecond} type="button" variant="secondary">
                {t("calls.quickBooking.customer.clear")}
              </Button>
            </div>
          ) : secondCandidates.length === 0 ? (
            <p className="text-sm text-muted">{t("calls.quickBooking.therapist.secondEmpty")}</p>
          ) : (
            <>
              <p className="text-sm text-muted">{t("calls.quickBooking.therapist.secondUnset")}</p>
              <ul className="grid">
                {sortAvailabilityRows(secondCandidates, availabilityTime).map((row) => {
                  const course = row.courses.find((candidate) => candidate.courseId === courseId);
                  if (!course) return null;
                  return (
                    <AvailabilityRow
                      courses={[course]}
                      disabled={disabled}
                      expansion={secondExpanded?.therapistId === row.therapistId ? secondExpanded.expansion : null}
                      key={row.therapistId}
                      locale={locale}
                      onChoose={(choice) => onChooseSecond(choice.therapistId)}
                      onExpansionChange={(expansion) => setSecondExpanded(expansion ? { therapistId: row.therapistId, expansion } : null)}
                      onOverride={(choice) =>
                        setPendingOverride({ kind: "second", therapistId: row.therapistId, therapistName: row.therapistName, verdict: choice.verdict })
                      }
                      reserveWarningSlot={secondReserveWarningSlot}
                      row={row}
                      second
                      time={availabilityTime}
                    />
                  );
                })}
              </ul>
            </>
          )}
          {fieldErrors.therapist2Id?.[0] ? (
            <span className="text-xs text-danger" role="alert">
              {fieldErrors.therapist2Id[0]}
            </span>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.quickBooking.therapist.overrideAssign")}
        description={
          overrideVerdict
            ? t(
                overrideVerdict === "rate_missing" ? "calls.quickBooking.therapist.overrideRateMissing" : "calls.quickBooking.therapist.overrideTimeShort",
                { therapist: overrideTherapistName }
              )
            : undefined
        }
        onConfirm={() => {
          if (!pendingOverride) return;
          if (pendingOverride.kind === "first") {
            onChoose(pendingOverride.choice);
          } else {
            onChooseSecond(pendingOverride.therapistId);
          }
          setPendingOverride(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingOverride(null);
        }}
        open={pendingOverride !== null}
        title={t("calls.quickBooking.therapist.overrideTitle")}
      />
    </div>
  );
}

function RoomSelect({
  disabled,
  error,
  label,
  onChange,
  options,
  value
}: {
  disabled: boolean;
  error: string | null;
  label: string;
  onChange: (roomId: string | null) => void;
  options: ServiceCallFormOptions;
  value: string | null;
}) {
  const t = useT();
  return (
    <Field error={error} label={label}>
      <select
        className={inputFieldClassName({ invalid: Boolean(error) })}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        value={value ?? ""}
      >
        <option value="">{t("calls.placeholder.roomUnassigned")}</option>
        {options.rooms.map((room) => (
          <option key={room.value} value={room.value}>
            {room.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function RoomStep({
  disabled,
  draft,
  fieldErrors,
  guests,
  onEdit,
  onGuestRoomChange,
  options
}: StepProps & {
  /** 일행이면 손님 1…N(티켓 02). 손님마다 객실을 고르거나 비운다. 같은 객실은 원장의 객실 겹침 경고로 남는다. */
  guests?: QuickBookingGuest[];
  onGuestRoomChange?: (position: number, roomId: string | null) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-4">
      <StepHeading>{t("calls.quickBooking.step.room")}</StepHeading>
      {guests && guests.length > 1 ? (
        <div className="flex flex-wrap gap-3">
          {guests.map((guest, index) => (
            <RoomSelect
              disabled={disabled}
              error={guestFieldErrors(fieldErrors, index + 1).roomId?.[0] ?? null}
              key={index}
              label={t("calls.quickBooking.party.guestRoom", { position: index + 1 })}
              onChange={(roomId) => onGuestRoomChange?.(index + 1, roomId)}
              options={options}
              value={guest.roomId}
            />
          ))}
        </div>
      ) : (
        <RoomSelect
          disabled={disabled}
          error={fieldErrors.roomId?.[0] ?? null}
          label={t("calls.column.room")}
          onChange={(roomId) => onEdit("roomId", roomId)}
          options={options}
          value={draft.roomId ?? null}
        />
      )}
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

type GuestSummary = {
  position: number;
  courseLabel: string | null;
  therapistLabel: string | null;
  therapist2Label: string | null;
  roomLabel: string | null;
};

export function ReviewStep({
  courseLabel,
  customerLabel,
  disabled,
  draft,
  guestSummaries,
  message,
  notice,
  onCancel,
  onRetry,
  onSave,
  roomLabel,
  status,
  therapist2Label,
  therapistLabel
}: {
  courseLabel: string | null;
  customerLabel: string | null;
  disabled: boolean;
  draft: QuickBookingState["save"]["draft"];
  /** 일행이면 손님별 요약(티켓 02). 두 명 이상일 때만 한 명 요약 대신 보인다. */
  guestSummaries?: GuestSummary[];
  message: string | null;
  notice: string | null;
  onCancel: () => void;
  onRetry: () => void;
  onSave: () => void;
  roomLabel: string | null;
  status: NewRowSaveStatus;
  therapist2Label: string | null;
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
        {guestSummaries && guestSummaries.length > 1 ? (
          <>
            <DetailRow
              label={t("calls.quickBooking.customer.partySize")}
              value={t("calls.quickBooking.customer.partySizeOption", { count: guestSummaries.length })}
            />
            {guestSummaries.map((guest) => (
              <DetailRow
                key={guest.position}
                label={t("calls.quickBooking.party.guest", { position: guest.position })}
                value={[
                  guest.courseLabel ?? t("calls.quickBooking.review.unset"),
                  guest.therapistLabel ?? t("calls.quickBooking.review.unset"),
                  guest.therapist2Label,
                  guest.roomLabel ?? t("calls.placeholder.roomUnassigned")
                ]
                  .filter((part): part is string => Boolean(part))
                  .join(" · ")}
              />
            ))}
          </>
        ) : (
          <>
            <DetailRow label={t("calls.column.course")} value={courseLabel ?? t("calls.quickBooking.review.unset")} />
            <DetailRow label={t("calls.column.therapist1")} value={therapistLabel ?? t("calls.quickBooking.review.unset")} />
            {therapist2Label ? <DetailRow label={t("calls.column.therapist2")} value={therapist2Label} /> : null}
            <DetailRow label={t("calls.column.room")} value={roomLabel ?? t("calls.placeholder.roomUnassigned")} />
          </>
        )}
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
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const ledger = useMemo(() => ({ operatingMonthId, serviceDate }), [operatingMonthId, serviceDate]);
  const [state, dispatch] = useReducer(quickBookingReducer, ledger, (initial) => initialQuickBookingState(initial, newRequestId()));
  const { step, save, touched, partyGuests } = state;
  // 일행(티켓 02)에서 Therapist·코스 단계가 지금 고르는 손님. 1은 저장 초안의 칸이다.
  const [activeGuest, setActiveGuest] = useState(1);
  const partySize = partyGuests.length + 1;
  const guests = quickBookingGuests(save.draft, partyGuests);
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

  // 고객 검색(22의 비교 정보를 재사용, 티켓 24). 고객 화면·고객 연결 정정과 같은 디바운스 상수를 쓴다.
  // 메모만 있는 후보(kind: "memo")는 연결할 customerId가 없어 미리 뺀다.
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerCandidates, setCustomerCandidates] = useState<CustomerVisitCandidateDto[]>([]);
  useEffect(() => {
    const trimmed = customerQuery.trim();
    if (!trimmed) {
      setCustomerCandidates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void searchCustomerLinkCandidatesAction(trimmed).then((results) => {
        setCustomerCandidates(results.filter((candidate) => candidate.kind === "customer"));
      });
    }, CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [customerQuery]);

  function selectCustomerCandidate(candidate: CustomerVisitCandidateDto) {
    if (candidate.kind !== "customer" || !candidate.customerId) return;
    edit("customerId", candidate.customerId);
    edit("newCustomer", null);
    setCustomerQuery("");
  }

  // 고른 고객의 방문완료·노쇼·취소 건수와 가장 최근 방문(B09, 스토리 71-73, 티켓 24), 같은 연락처
  // 경고(S5). 고른 고객이 바뀔 때마다 다시 불러온다. 고객을 고르지 않았으면(해제 포함) null이다.
  const [visitSummary, setVisitSummary] = useState<{
    counts: CustomerVisitCountsDto;
    recentVisit: CustomerVisitHistoryRowDto | null;
    sharedPhone: boolean;
  } | null>(null);
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

  function pressNow() {
    const today = businessTodayIsoDate();
    const slot = selectNowSlot(options.timeSlots, nowClockString());
    setSchedule(today, slot);
    dispatch({ type: "step", step: "therapist" });
  }

  /** 손님 position의 코스·Therapist를 고친다. 손님 1은 저장 초안을, 손님 2…N은 일행 목록을 고친다. */
  function chooseForGuest(position: number, changes: Partial<QuickBookingGuest>) {
    dispatch(position === 1 ? { type: "choose", changes } : { type: "guest", position, changes });
  }

  /**
   * 일행은 손님을 차례로 고른다(티켓 02). 한 손님을 다 고르면 아직 고르지 않은 다음 손님으로 넘어간다. 이미 고른
   * 손님을 다시 고쳤으면 그 자리에 둔다.
   */
  function advanceGuest(position: number) {
    if (position < partySize && !guests[position].therapist1Id) setActiveGuest(position + 1);
  }

  function courseRequiresSecond(courseId: string) {
    return availabilityRows.some((row) => row.courses.some((course) => course.courseId === courseId && course.requiresSecondTherapist));
  }

  function chooseCourse(choice: AvailabilityCourseChoice) {
    // 가능 버튼은 패널의 Therapist와 코스만 채운다(스펙 F01, 티켓 20). 시각은 이미 이 단계의 예약시각과
    // 같아(가능 목록 자체가 그 시각 기준) 다시 쓰지 않는다. 코스·첫 번째 Therapist를 새로 고르면 앞서
    // 고른 두 번째 Therapist는 그 짝과 맞지 않을 수 있어 함께 비운다(티켓 21).
    chooseForGuest(activeGuest, { courseId: choice.courseId, therapist1Id: choice.therapistId, therapist2Id: null });
    if (!courseRequiresSecond(choice.courseId)) advanceGuest(activeGuest);
  }

  // 두 명 코스의 두 번째 Therapist(티켓 21). 코스·시각은 이미 고정돼 있어 id만 받는다.
  function chooseSecondTherapist(therapistId: string) {
    chooseForGuest(activeGuest, { therapist2Id: therapistId });
    advanceGuest(activeGuest);
  }

  function clearSecondTherapist() {
    chooseForGuest(activeGuest, { therapist2Id: null });
  }

  function changePartySize(size: number) {
    dispatch({ type: "partySize", size });
    setActiveGuest(1);
  }

  /** 저장 거절의 칸 오류로 그 단계(일행이면 그 손님)로 간다. */
  function jumpToError(field: string | undefined) {
    dispatch({ type: "step", step: field ? (quickBookingStepOfField(field) ?? "review") : "review" });
    const guestPosition = field ? quickBookingGuestPosition(field) : null;
    if (guestPosition) setActiveGuest(guestPosition);
  }

  // 응답을 받지 못하면(네트워크 오류, 시간 초과) 초안과 요청 id를 둔 채 "저장 여부 확인 중"이 된다(티켓 16).
  useEffect(() => {
    if (!request) return;
    startTransition(() => {
      void (async () => {
        const giveUp = window.setTimeout(() => dispatch({ type: "lost", request }), QUICK_BOOKING_SAVE_TIMEOUT_MS);
        try {
          // 일행(2명 이상)은 손님마다 콜을 한 번에 만드는 일행 저장으로 보낸다. 보내는 동안 일행은 잠겨 있어
          // 지금 손님 목록이 이 요청을 만든 그 목록이다. 1명이면 지금까지의 한 건 저장과 같다.
          const result =
            partyGuests.length > 0
              ? await createQuickBookingPartyAction(quickBookingPartyRequest(request, partyGuests))
              : await createQuickBookingServiceCallAction(request);
          if (result.ok) {
            const createdId = Array.isArray(result.data) ? result.data[0]?.id : result.data.id;
            setSavedNotice(result.notice ?? null);
            dispatch({ type: "saved", request, notice: result.notice ?? null, nextRequestId: newRequestId() });
            setOpen(false);
            setActiveGuest(1);
            if (createdId) focusCreatedRow(createdId);
          } else {
            dispatch({ type: "failed", request, message: result.formError ?? null, fieldErrors: result.fieldErrors });
            jumpToError(Object.keys(result.fieldErrors ?? {})[0]);
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
      const target = quickBookingStepOfField(field);
      if (target) steps.add(target);
    }
    return steps;
  }, [fieldErrors]);
  const errorGuests = new Set(
    Object.keys(fieldErrors).flatMap((field) => {
      const position = quickBookingGuestPosition(field);
      return position ? [position] : [];
    })
  );

  const stepProps: StepProps = { customers, disabled: locked, draft, fieldErrors, monthEndDate, monthStartDate, onEdit: edit, options };
  const labelOf = (list: { value: string; label: string }[], value: string | null | undefined) =>
    value ? (list.find((option) => option.value === value)?.label ?? value) : null;
  // 코스를 고르지 않은 손님은 손님 1의 코스를 쓴다(스펙 D10). 요약과 저장 요청이 같은 규칙이다.
  const guestSummaries = guests.map((guest, index) => ({
    position: index + 1,
    courseLabel: labelOf(options.courses, guest.courseId || draft.courseId),
    therapistLabel: labelOf(options.therapists, guest.therapist1Id),
    therapist2Label: labelOf(options.therapists, guest.therapist2Id),
    roomLabel: labelOf(options.rooms, guest.roomId)
  }));
  const courseLabel = labelOf(options.courses, draft.courseId);
  const therapistLabel = labelOf(options.therapists, draft.therapist1Id);
  const therapist2Label = labelOf(options.therapists, draft.therapist2Id);
  const roomLabel = labelOf(options.rooms, draft.roomId);
  const active = guests[Math.min(activeGuest, partySize) - 1];
  // 코스를 고르지 않은 손님은 손님 1의 코스로 저장된다. 두 번째 Therapist가 필요한지와 그 오류도 그 코스로 본다.
  const activeCourseId = active.courseId || draft.courseId;
  const activeSummary = guestSummaries[Math.min(activeGuest, partySize) - 1];
  const customerLabel = draft.customerId
    ? (customers.find((customer) => customer.id === draft.customerId)?.name ?? draft.customerId)
    : (draft.newCustomer?.name || null);

  return (
    <>
      <div aria-live="polite" className={savedNotice ? "text-sm text-foreground" : "sr-only"} role="status">{savedNotice}</div>
      <ModalPanel
        description={t("calls.quickBooking.description")}
        onOpenChange={(next) => {
          if (next) {
            setSavedNotice(null);
            setOpen(true);
            return;
          }
          requestClose();
        }}
        open={open}
        title={t("calls.quickBooking.title")}
        trigger={
          // 빠른 예약은 원장 탭 머리의 주요 버튼이다(명세 F08). 휴대폰 폭에서는 제공하지 않는다(티켓 20).
          // 원장 목록의 N 단축키(티켓 03)가 data-quick-booking-trigger로 이 버튼을 찾아 누른다.
          // ModalPanel의 trigger로 등록해야 Radix가 이 버튼을 패널의 Dialog.Trigger로 알아, 패널을
          // 닫을 때 포커스를 여기로 돌려준다(S3, 스토리 70) — 트리거 없이 따로 둔 버튼은 그 연결이 없어
          // 닫은 뒤 포커스가 body로 빠졌다.
          <Button aria-haspopup="dialog" className="hidden min-[600px]:inline-flex" data-quick-booking-trigger="" disabled={isLocked} type="button">
            {t("calls.quickBooking.open")}
          </Button>
        }
      >
        <StepperNav disabled={locked} errorSteps={errorSteps} onSelect={(next) => dispatch({ type: "step", step: next })} step={step} />
        <ErrorSummary
          fieldErrors={fieldErrors}
          message={message}
          onJump={(next, guestPosition) => {
            dispatch({ type: "step", step: next });
            if (guestPosition) setActiveGuest(guestPosition);
          }}
        />

        {step === "customer" ? (
          <CustomerStep
            {...stepProps}
            candidates={customerCandidates}
            locale={locale}
            onPartySizeChange={changePartySize}
            onQueryChange={setCustomerQuery}
            onSelectCandidate={selectCustomerCandidate}
            partySize={partySize}
            query={customerQuery}
            visitSummary={visitSummary}
          />
        ) : null}
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
            courseId={activeCourseId}
            courseLabel={labelOf(options.courses, activeCourseId)}
            disabled={locked}
            excludedTherapistIds={partySize > 1 ? otherGuestTherapistIds(guests, activeGuest) : undefined}
            fieldErrors={partySize > 1 ? guestFieldErrors(fieldErrors, activeGuest) : fieldErrors}
            guestNav={
              partySize > 1 ? (
                <PartyGuestNav
                  active={activeGuest}
                  disabled={locked}
                  errorPositions={errorGuests}
                  guests={guestSummaries.map((guest, index) => ({
                    position: guest.position,
                    // 아직 고르지 않은 손님은 "선택 안 함"이다. 손님 1의 코스는 저장할 때 기본값으로만 쓴다.
                    summary: guests[index].therapist1Id
                      ? [guest.courseLabel, guest.therapistLabel, guest.therapist2Label].filter(Boolean).join(" · ")
                      : null
                  }))}
                  onSelect={setActiveGuest}
                />
              ) : undefined
            }
            locale={locale}
            onChoose={chooseCourse}
            onChooseSecond={chooseSecondTherapist}
            onClear={() =>
              activeGuest === 1
                ? dispatch({ type: "edit", changes: { courseId: "", therapist1Id: null, therapist2Id: null } })
                : chooseForGuest(activeGuest, { courseId: "", therapist1Id: null, therapist2Id: null })
            }
            onClearSecond={clearSecondTherapist}
            onTimeChange={(next) => setSchedule(draft.serviceDate, next)}
            options={options}
            therapist1Id={active.therapist1Id}
            therapist2Label={activeSummary.therapist2Label}
            therapistLabel={activeSummary.therapistLabel}
          />
        ) : null}
        {step === "room" ? (
          <RoomStep
            {...stepProps}
            guests={guests}
            onGuestRoomChange={(position, roomId) =>
              position === 1 ? edit("roomId", roomId) : dispatch({ type: "guest", position, changes: { roomId } })
            }
          />
        ) : null}
        {step === "review" ? (
          <ReviewStep
            courseLabel={courseLabel}
            customerLabel={customerLabel}
            disabled={locked}
            draft={draft}
            guestSummaries={guestSummaries}
            message={message}
            notice={save.notice}
            onCancel={requestClose}
            onRetry={() => dispatch({ type: "submit" })}
            onSave={() => dispatch({ type: "submit" })}
            roomLabel={roomLabel}
            status={save.status}
            therapist2Label={therapist2Label}
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
          setActiveGuest(1);
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
