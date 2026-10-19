"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ScreenState } from "@/components/ui/screen-state";
import { SaveStatus } from "@/components/ui/save-status";
import { CallStatusChip, callStatusKeyOf } from "@/components/domain/call-status-chip";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { autosaveServiceCallRowAction, loadTherapistAvailabilityAction, reloadServiceCallRowAction } from "@/app/(erp)/calls/actions";
import { businessClockString, businessTodayServiceDate } from "@/lib/operating-date";
import { ledgerCallAnchorId } from "@/lib/ledger-address";
import { callRowSaveReducer, initialCallRowSave, isSaveHeld, type CallRowDraft, type RowSaveStatus } from "@/app/(erp)/calls/call-row-save";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import type { CallConflictCompareData } from "@/app/(erp)/calls/call-conflict-compare";
import { CallEditPanel, type CallPanelFocusRequest } from "@/app/(erp)/calls/call-edit-panel";
import { nullableValue, optionLabel } from "@/app/(erp)/calls/call-ledger-fields";
import { LedgerCellPicker, type LedgerPickOption } from "@/app/(erp)/calls/ledger-cell-picker";
import { usePhoneWidth } from "@/app/(erp)/calls/phone-width";
import { requestQuickBookingJoinParty } from "@/app/(erp)/calls/quick-booking-party-join";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";
import {
  freeRoomOptions,
  lateMinutes,
  ledgerEndView,
  ledgerFlowItems,
  ledgerFlowOf,
  ledgerTimeline,
  ledgerWhoLabel,
  nextLedgerAction,
  nowDividerIndex,
  partyEntryTargets,
  roomPickList,
  statusChangeTimes,
  statusCodeFor,
  therapistPickList,
  type TherapistPickVerdict
} from "@/app/(erp)/calls/ledger-flow";

export type OpenCall = (callId: string, focus?: CallPanelFocusRequest["target"]) => void;

/**
 * 일행 머리 줄이 일행 콜 줄들에 보내는 일(스펙 D14, 티켓 04). 줄마다 자기 저장 상태로 저장하므로(낡은 저장 거절,
 * 충돌 비교 그대로) 머리 줄은 저장하지 않고 할 일만 알린다. token이 바뀌면 한 번 한다.
 */
type PartyAction = { kind: "enter"; callIds: string[]; rooms: Record<string, string> } | { kind: "cancel"; callIds: string[] };
type PartyCommand = PartyAction & { token: number };
/** 일행 동작 하나(token)를 받은 손님 줄의 저장 결과. 그 뒤 사람별로 고친 저장은 알리지 않는다. */
type PartyCommandOutcome = { token: number; status: RowSaveStatus; message: string | null };

/** 오늘 영업일과 지금 시각(영업 시간대). `지금` 구분선과 `N분 늦음`(스펙 D5)은 오늘 원장에서만 보인다. */
export type LedgerClock = { today: string; time: string };

/** 서버 렌더와 첫 화면이 같도록 붙은 뒤에 시계를 읽고, 30초마다 다시 읽는다. */
function useLedgerClock(timeSlots: ServiceCallFormOptions["timeSlots"], enabled: boolean) {
  const [clock, setClock] = useState<LedgerClock | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setClock({ today: businessTodayServiceDate(timeSlots), time: businessClockString() });
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [timeSlots, enabled]);
  return clock;
}

/** 완료 묶음을 펼쳐 둔 상태는 이 기기에 남긴다(스펙 D16). 저장소를 못 쓰면 접힌 기본값이다. */
const DONE_EXPANDED_STORAGE_KEY = "calls.ledger.doneExpanded";

export function readDoneExpanded() {
  try {
    return window.localStorage.getItem(DONE_EXPANDED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDoneExpanded(expanded: boolean) {
  try {
    window.localStorage.setItem(DONE_EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
  } catch {
    // 저장소를 못 써도 이번 화면에서는 펼친 채로 둔다.
  }
}

/** 일행 손님 줄과 머리 줄은 왼쪽 세로 막대로 묶는다(스펙 D8). 고른 일행 줄은 그 막대 안쪽에 선택 막대를 더한다. */
const partyBarClass = "[box-shadow:inset_4px_0_0_var(--border-strong)]";
const selectedBarClass = "data-[selected=true]:[box-shadow:inset_3px_0_0_var(--brand)]";
const selectedPartyBarClass = "data-[selected=true]:[box-shadow:inset_4px_0_0_var(--border-strong),inset_7px_0_0_var(--brand)]";

/**
 * 윗줄의 입장·종료 시각(1018 스펙 D11): 누르면 그 자리에서 분 단위 시각 칸이 되고, Enter나 칸을 떠나면 저장한다.
 * Esc는 고치지 않고 닫는다(원장 키보드에 넘기지 않는다). 비우거나 같은 값이면 저장하지 않는다.
 */
function LedgerTimeEdit({
  children,
  disabled,
  label,
  onCommit,
  readOnly,
  value
}: {
  children: ReactNode;
  disabled: boolean;
  label: string;
  onCommit: (value: string) => void;
  readOnly: boolean;
  value: string;
}) {
  const [editing, setEditing] = useState(false);
  if (readOnly) return <>{children}</>;
  if (!editing) {
    return (
      <button
        aria-label={label}
        className="inline-flex min-h-11 items-center rounded-sm underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary disabled:no-underline"
        disabled={disabled}
        onClick={() => setEditing(true)}
        type="button"
      >
        {children}
      </button>
    );
  }
  const finish = (next: string | null) => {
    setEditing(false);
    if (next && /^([01]\d|2[0-3]):[0-5]\d$/.test(next) && next !== value) onCommit(next);
  };
  return (
    <input
      aria-label={label}
      autoFocus
      className={inputFieldClassName({ className: "h-8 w-28 px-2" })}
      defaultValue={value}
      onBlur={(event) => finish(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(event.currentTarget.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          finish(null);
        }
      }}
      type="time"
    />
  );
}

/**
 * 원장 한 줄(1018 스펙 D3): 예약 하나를 두 줄로 보인다. 윗줄은 예약시각 · 입장 → 종료 · 상태 · 주 버튼, 아랫줄은
 * 경로·예약자 · 코스 · Therapist ▾ · 객실 ▾ · 결제다. 저장은 줄마다 하나씩 보내고(callRowSaveReducer), 주 버튼과
 * 칸 안 목록과 편집 패널이 같은 저장 상태를 쓴다. 패널은 이 줄이 골라졌을 때 작업면의 패널 자리(panelHost)에
 * 그린다 — 그래서 패널을 닫거나 다른 줄로 옮겨도 이 줄의 초안과 저장 중인 요청이 그대로 남는다.
 */
function CallLedgerLine({
  clock,
  customers,
  dayStart,
  hidden,
  isLocked,
  onOpen,
  onPartyOutcome,
  onSelectRelated,
  options,
  panelFocus,
  panelHost,
  party,
  partyCommand,
  readOnly,
  row,
  rows,
  selected,
  showSettlementAmounts
}: {
  /** 오늘 원장이면 지금 시각과 영업일 시작(첫 슬롯). 늦음 표시에 쓴다. */
  clock: { time: string; dayStart: string } | null;
  customers: CustomerDto[];
  /** 영업일 시작(첫 슬롯). 상태를 고를 때 시각 비교에 쓴다. */
  dayStart: string;
  hidden: boolean;
  isLocked: boolean;
  onOpen: OpenCall;
  /** 일행 동작을 받아 저장한 결과를 머리 줄에 알린다(실패한 손님과 이유를 머리 줄이 보인다). */
  onPartyOutcome: (callId: string, outcome: PartyCommandOutcome) => void;
  onSelectRelated: (callId: string) => void;
  options: ServiceCallFormOptions;
  panelFocus: CallPanelFocusRequest | null;
  panelHost: HTMLElement | null;
  /** 일행 콜이면 하루 전체에서 본 순번과 인원("일행 2/3"). */
  party: { position: number; size: number } | null;
  partyCommand: PartyCommand | null;
  readOnly: boolean;
  row: ServiceCallRowDto;
  rows: ServiceCallRowDto[];
  selected: boolean;
  showSettlementAmounts: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [save, dispatch] = useReducer(callRowSaveReducer, row, initialCallRowSave);
  const { draft, savedRow: serverRow, status: saveStatus } = save;
  // 다른 줄을 저장하면 이 줄의 경고도 바뀐다. 원장이 다시 받은 행이 이 줄의 저장 결과보다 새로우면 그 경고를 쓴다.
  const freshestRow = row.savedAt >= serverRow.savedAt ? row : serverRow;
  // 저장 실패나 충돌 확인 필요는 떠나기 전 안내 대상이다(스펙 B07, 티켓 18).
  useUnsavedGuard(isSaveHeld(saveStatus));
  const [, startTransition] = useTransition();
  const request = save.inFlight;
  const [pickingRoom, setPickingRoom] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  // Therapist 칸 목록(스펙 D6): 열 때마다 그 콜의 시각·코스로 가능 판정을 다시 받는다. null은 불러오는 중이다.
  const [therapistChoices, setTherapistChoices] = useState<TherapistAvailabilityRowDto[] | null>(null);
  const [therapistChoicesFailed, setTherapistChoicesFailed] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<{ therapistId: string; name: string; verdict: TherapistPickVerdict } | null>(null);

  // 저장은 줄마다 하나씩 보낸다. 응답을 받으면 모아 둔 수정이 다음 저장으로 inFlight에 들어온다.
  useEffect(() => {
    if (!request) {
      return;
    }
    startTransition(() => {
      void (async () => {
        try {
          const result = await autosaveServiceCallRowAction(request);
          if (result.ok) {
            dispatch({ type: "saved", row: result.data });
          } else if ("currentRow" in result) {
            dispatch({ type: "stale", row: result.currentRow, message: result.formError });
            // 충돌 확인 필요가 되면 편집 패널에 비교 화면이 열린다(스펙 B07, 티켓 17).
            onOpen(row.id);
          } else {
            dispatch({ type: "failed", message: result.formError ?? null, fieldErrors: result.fieldErrors });
          }
        } catch {
          // 응답을 받지 못했다. 초안은 남고, 같은 초안으로 다시 시도할 수 있다.
          dispatch({ type: "failed", message: null });
        }
      })();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (pickingRoom) pickerRef.current?.querySelector<HTMLElement>("button")?.focus();
  }, [pickingRoom]);

  // 원장이 이 콜의 새 행을 받으면(자동 청소 중, 다른 화면의 저장) 고치는 중이 아닐 때 그 행을 따른다.
  useEffect(() => {
    dispatch({ type: "refreshed", row });
  }, [row]);

  function commit(changes?: Partial<CallRowDraft>) {
    if (isLocked) {
      if (changes) dispatch({ type: "edit", changes });
      return;
    }
    dispatch({ type: "commit", changes });
  }

  async function reloadLatest() {
    const result = await reloadServiceCallRowAction(row.id).catch(() => null);
    // 지금 행을 읽지 못하면 거절 때 받은 행으로 바꾼다. 그 사이 또 바뀌었으면 다음 저장이 다시 충돌로 알린다.
    const latest = result?.ok ? result.data : save.latestRow;
    if (latest) {
      dispatch({ type: "reload", row: latest });
    }
  }

  const latestRow = save.latestRow;
  const message = save.message;
  // 매 렌더 새 객체를 넘기면 비교 화면의 선택이 렌더마다 지워진다. 충돌일 때만 만들고 참조를 고정한다.
  const conflict = useMemo<CallConflictCompareData | null>(() => {
    if (saveStatus !== "conflict" || !latestRow) return null;
    return {
      rowId: row.id,
      draft,
      latestRow,
      message,
      onReapply: (changes) => dispatch({ type: "reapply", row: latestRow, changes }),
      onReloadLatest: () => void reloadLatest()
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveStatus, latestRow, draft, message, row.id]);

  const inUse = statusCodeFor(options.statuses, "inUse");
  const cleaning = statusCodeFor(options.statuses, "cleaning");
  const visitComplete = statusCodeFor(options.statuses, "visitComplete");
  const canceled = statusCodeFor(options.statuses, "canceled");
  const action = nextLedgerAction(draft.status);

  // 일행 전체 입장·취소(티켓 04). 그 사이 이 줄이 이미 입장했거나 끝났으면(초안 기준) 건드리지 않는다.
  const [appliedCommand, setAppliedCommand] = useState<number | null>(null);
  useEffect(() => {
    if (!partyCommand?.callIds.includes(row.id) || ledgerFlowOf(draft.status) !== "reserved") return;
    if (partyCommand.kind === "enter") enter(draft.roomId ? undefined : partyCommand.rooms[row.id]);
    else if (canceled) commit({ status: canceled });
    setAppliedCommand(partyCommand.token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyCommand?.token]);

  // 받은 일행 동작의 저장이 끝나면(저장됨·실패·충돌) 한 번 알린다.
  useEffect(() => {
    if (appliedCommand === null || saveStatus === "saving") return;
    onPartyOutcome(row.id, { token: appliedCommand, status: saveStatus, message });
    setAppliedCommand(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedCommand, saveStatus, message]);

  // 입장 → 종료 → 청소 끝(스펙 D11). 입장·종료는 지금(분 단위), 종료 취소는 사용중으로 되돌리고 실제 종료를 지운다(D13).
  function enter(roomId?: string) {
    if (isLocked || !inUse) return;
    const changes: Partial<CallRowDraft> = { actualEntryTime: businessClockString(), status: inUse };
    if (roomId) {
      setPickingRoom(false);
      commit({ ...changes, roomId });
      return;
    }
    // 객실이 비어 있으면 그 자리에서 빈 객실을 고르게 한다(스펙 D18). 고른 뒤에 저장한다.
    if (!draft.roomId) {
      setPickingRoom(true);
      return;
    }
    commit(changes);
  }

  function finish() {
    if (cleaning) commit({ status: cleaning, actualEndTime: businessClockString() });
  }

  function cancelFinish() {
    if (inUse) commit({ status: inUse, actualEndTime: null });
  }

  // 상태 칩으로 고르면 행 버튼과 같은 규칙으로 입장·종료 시각을 채우거나 지운다(스펙 D11). 지금은 오늘 원장에서만 쓴다.
  function changeStatus(status: string) {
    if (status === draft.status) return;
    const times = statusChangeTimes(
      status,
      { startTime: draft.startTime, actualEntryTime: draft.actualEntryTime ?? null, actualEndTime: draft.actualEndTime ?? null, displayEnd: freshestRow.displayEnd },
      clock?.time ?? null,
      dayStart
    );
    commit({ status, ...times });
  }

  async function loadTherapistChoices() {
    setTherapistChoices(null);
    setTherapistChoicesFailed(false);
    try {
      setTherapistChoices(
        await loadTherapistAvailabilityAction({
          operatingMonthId: row.operatingMonthId,
          serviceDate: row.serviceDate,
          time: draft.startTime,
          excludeCallId: row.id
        })
      );
    } catch {
      setTherapistChoices([]);
      setTherapistChoicesFailed(true);
    }
  }

  const therapistList = therapistChoices ? therapistPickList(therapistChoices, draft.courseId) : null;
  const therapistOptions: LedgerPickOption[] | null = therapistList
    ? [
        ...therapistList.map((entry) => ({
          value: entry.therapistId,
          label: entry.therapistName,
          detail:
            entry.verdict === "rate_missing"
              ? t("calls.cell.rateMissing")
              : entry.verdict === "time_short"
                ? entry.freeFrom
                  ? t("calls.cell.freeFrom", { time: entry.freeFrom })
                  : t("calls.cell.timeShort")
                : entry.attendance === "checked_out"
                  ? t("calls.availability.checkedOutTag")
                  : entry.attendance === "before_check_in"
                    ? t("calls.cell.beforeCheckIn")
                    : t("calls.cell.doneToday", { count: entry.callCounts.done }),
          muted: entry.verdict !== "possible" || entry.attendance !== "checked_in"
        })),
        { value: "", label: t("calls.cell.unassigned") }
      ]
    : null;

  // 불가한 사람은 빠른 예약과 같은 경고를 확인한 뒤 배정한다(기존 경고 후 배정 경로). 미지명 줄이면 이것이 배정이다.
  function pickTherapist(value: string) {
    const entry = therapistList?.find((candidate) => candidate.therapistId === value);
    if (entry && entry.verdict !== "possible") {
      setPendingOverride({ therapistId: entry.therapistId, name: entry.therapistName, verdict: entry.verdict });
      return;
    }
    commit({ therapist1Id: nullableValue(value) });
  }

  const roomOptions: LedgerPickOption[] = [
    ...roomPickList(options.rooms, rows, row.id).map((room) => ({
      value: room.value,
      label: room.label,
      detail: room.free ? undefined : t("calls.cell.roomBusy"),
      muted: !room.free
    })),
    { value: "", label: t("calls.placeholder.roomUnassigned") }
  ];

  const time = draft.startTime;
  const courseLabel = optionLabel(options.courses, draft.courseId) || serverRow.courseLabel;
  const therapistName = (id: string | null | undefined, assigned: ServiceCallRowDto["therapist1"]) =>
    !id ? null : assigned?.id === id ? assigned.displayName : (therapistChoices?.find((choice) => choice.therapistId === id)?.therapistName ?? (optionLabel(options.therapists, id) || id));
  const therapists = [therapistName(draft.therapist1Id, serverRow.therapist1), therapistName(draft.therapist2Id, serverRow.therapist2)]
    .filter(Boolean)
    .join(" · ");
  const roomLabel = draft.roomId ? optionLabel(options.rooms, draft.roomId) || serverRow.roomLabel : null;
  const statusKey = callStatusKeyOf(draft.status);
  const statusLabel = optionLabel(options.statuses, draft.status) || draft.status;
  const warnings = freshestRow.warnings.map((warning) => callWarningLabel(t, warning));
  const freeRooms = pickingRoom ? freeRoomOptions(options.rooms, rows, row.id) : [];
  const end = ledgerEndView({ actualEntryTime: draft.actualEntryTime ?? null, actualEndTime: draft.actualEndTime ?? null, displayEnd: freshestRow.displayEnd });
  const late = clock ? lateMinutes(draft.status, draft.startTime, clock.time, clock.dayStart) : null;
  const who = ledgerWhoLabel(
    {
      bookingChannelCode: draft.bookingChannelCode ?? null,
      bookerName: draft.bookerName ?? null,
      customerId: draft.customerId ?? null,
      customerMemo: draft.customerMemo ?? null
    },
    options.bookingChannels,
    customers
  );
  const therapistText = therapists || t("calls.cell.unassigned");
  const roomText = roomLabel ?? t("calls.placeholder.roomUnassigned");
  const paid = Boolean(draft.paymentMethodCode);
  const paymentBadge = <StatusIndicator label={paid ? t("calls.line.paid") : t("calls.line.unpaid")} size="sm" tone={paid ? "success" : "neutral"} />;
  const statusChip = statusKey ? (
    <CallStatusChip label={statusLabel} size="sm" status={statusKey} />
  ) : (
    <StatusIndicator label={statusLabel} size="sm" tone="neutral" />
  );

  return (
    // 편집 패널이 열린 줄은 선택된 줄 모양이다(design.md 6.6). 버튼이 아닌 자리를 눌러도 패널이 열린다.
    <li
      className={`grid cursor-pointer gap-1 border-b border-border px-3 py-2 transition-colors hover:bg-readonly data-[selected=true]:bg-readonly ${party ? `${partyBarClass} ${selectedPartyBarClass}` : selectedBarClass}`}
      data-ledger-line=""
      data-ledger-party-member={row.partyId ?? undefined}
      data-selected={selected}
      data-service-call-id={row.id}
      hidden={hidden}
      id={ledgerCallAnchorId(row.id)}
      onClick={(event) => {
        // 칸 안 목록은 body에 그리지만 React 이벤트는 이 줄까지 올라온다. 줄 안에서 누른 것만 패널을 연다.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("button, a, input")) return;
        onOpen(row.id);
      }}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" data-line-top="">
        <button
          aria-label={t("calls.detail.rowAria", { time })}
          className="min-h-11 rounded-sm px-1 text-lg font-semibold text-foreground [font-variant-numeric:tabular-nums] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
          data-call-open={row.id}
          onClick={() => onOpen(row.id)}
          type="button"
        >
          {time}
        </button>
        <span className="whitespace-nowrap text-sm text-foreground [font-variant-numeric:tabular-nums]" data-line-clock={end.kind}>
          {end.kind === "notEntered" ? (
            <span className="text-muted">{t("calls.line.notEntered")}</span>
          ) : (
            <>
              {draft.actualEntryTime ? (
                <LedgerTimeEdit
                  disabled={isLocked}
                  label={t("calls.line.entryEditAria", { time })}
                  onCommit={(value) => commit({ actualEntryTime: value })}
                  readOnly={readOnly}
                  value={draft.actualEntryTime}
                >
                  {t("calls.line.entry", { time: draft.actualEntryTime })}
                </LedgerTimeEdit>
              ) : null}
              {" → "}
              {end.kind === "expected" ? (
                <span className="text-faint">{t("calls.line.expectedEnd", { time: end.time })}</span>
              ) : (
                <LedgerTimeEdit
                  disabled={isLocked}
                  label={t("calls.line.endEditAria", { time })}
                  onCommit={(value) => commit({ actualEndTime: value })}
                  readOnly={readOnly}
                  value={end.time}
                >
                  <span className="font-semibold">{end.time}</span>
                </LedgerTimeEdit>
              )}
            </>
          )}
        </span>
        {late ? <StatusIndicator label={t("calls.line.late", { minutes: late })} size="sm" tone="warning" /> : null}
        {readOnly ? (
          statusChip
        ) : (
          <LedgerCellPicker
            disabled={isLocked}
            emptyText={t("calls.cell.empty")}
            field="status"
            label={t("calls.cell.statusAria", { time })}
            loadingText={t("calls.cell.loading")}
            onPick={changeStatus}
            options={options.statuses}
            value={draft.status}
          >
            {statusChip}
          </LedgerCellPicker>
        )}
        {warnings.length > 0 ? (
          // 누르는 영역은 44px(design.md 4.3)이고, 보이는 칩은 그 안의 작은 경고 칩이다.
          <button
            aria-label={t("calls.list.warningsAria", { count: warnings.length, first: warnings[0] })}
            className="inline-flex min-h-11 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
            onClick={() => onOpen(row.id)}
            title={warnings.join("\n")}
            type="button"
          >
            <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-warning-soft px-2 text-xs font-semibold text-warning">
              <span aria-hidden="true">▲︎</span>
              <span className="[font-variant-numeric:tabular-nums]">{warnings.length}</span>
            </span>
          </button>
        ) : null}
        <span data-line-save-state={saveStatus}>
          {saveStatus === "saving" || isSaveHeld(saveStatus) ? <SaveStatus locale={locale} state={saveStatus === "saving" ? "saving" : saveStatus} /> : null}
        </span>
        {/* 휴대폰 폭은 읽기 전용이라(티켓 26) 주 버튼을 두지 않는다. */}
        {readOnly || !action ? null : (
          <span className="ml-auto">
            {action === "enter" ? (
              <Button
                aria-label={t("calls.list.enterAria", { time })}
                className="h-11 px-4"
                disabled={isLocked || !inUse}
                onClick={() => enter()}
                type="button"
                variant="secondary"
              >
                {t("calls.list.enter")}
              </Button>
            ) : action === "finish" ? (
              <Button
                aria-label={t("calls.list.finishAria", { time })}
                className="h-11 px-4"
                disabled={isLocked || !cleaning}
                onClick={finish}
                type="button"
                variant="secondary"
              >
                {t("calls.list.finish")}
              </Button>
            ) : (
              <span className="flex items-center gap-1">
                <Button
                  aria-label={t("calls.list.cancelFinishAria", { time })}
                  className="h-11 px-2 text-xs text-muted"
                  disabled={isLocked || !inUse}
                  onClick={cancelFinish}
                  type="button"
                  variant="ghost"
                >
                  {t("calls.list.cancelFinish")}
                </Button>
                <Button
                  aria-label={t("calls.list.cleanDoneAria", { time })}
                  className="h-11 px-4"
                  disabled={isLocked || !visitComplete}
                  onClick={() => visitComplete && commit({ status: visitComplete })}
                  type="button"
                  variant="secondary"
                >
                  {t("calls.list.cleanDone")}
                </Button>
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground" data-line-bottom="">
        <span className="flex min-w-0 max-w-full items-center gap-1.5" data-line-who="">
          {who.channel ? <span className="shrink-0 text-xs font-semibold text-muted">{who.channel}</span> : null}
          <span className="min-w-0 truncate">{who.name ?? <span className="text-muted">-</span>}</span>
          {party ? <span className="shrink-0 text-xs text-muted">{t("calls.party.position", party)}</span> : null}
        </span>
        <span className="whitespace-nowrap">{courseLabel}</span>
        {readOnly ? (
          <>
            <span className="min-w-0 truncate">{therapistText}</span>
            <span className="whitespace-nowrap">{roomText}</span>
          </>
        ) : (
          <>
            <LedgerCellPicker
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              failedText={therapistChoicesFailed ? t("calls.cell.failed") : null}
              field="therapist1Id"
              label={t("calls.cell.therapistAria", { time })}
              loadingText={t("calls.cell.loading")}
              onOpen={() => void loadTherapistChoices()}
              onPick={pickTherapist}
              options={therapistOptions}
              value={draft.therapist1Id ?? ""}
            >
              {therapistText}
            </LedgerCellPicker>
            <LedgerCellPicker
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              field="roomId"
              label={t("calls.cell.roomAria", { time })}
              loadingText={t("calls.cell.loading")}
              onPick={(value) => commit({ roomId: nullableValue(value) })}
              options={roomOptions}
              value={draft.roomId ?? ""}
            >
              {roomText}
            </LedgerCellPicker>
          </>
        )}
        {readOnly ? (
          paymentBadge
        ) : (
          // 결제 배지(스펙 D12): 고르는 즉시 결제수단만 저장한다. 상태는 바꾸지 않는다.
          <LedgerCellPicker
            disabled={isLocked}
            emptyText={t("calls.cell.empty")}
            field="paymentMethodCode"
            label={t("calls.cell.paymentAria", { time })}
            loadingText={t("calls.cell.loading")}
            onPick={(value) => commit({ paymentMethodCode: nullableValue(value) })}
            options={[...options.paymentMethods, { value: "", label: t("calls.line.unpaid") }]}
            value={draft.paymentMethodCode ?? ""}
          >
            {paymentBadge}
          </LedgerCellPicker>
        )}
      </div>
      {pickingRoom ? (
        <div
          aria-label={t("calls.list.pickRoomAria", { time })}
          className="flex flex-wrap items-center gap-2 rounded-sm bg-readonly px-2 py-2"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setPickingRoom(false);
            }
          }}
          ref={pickerRef}
          role="group"
        >
          <span className="text-sm font-semibold text-foreground">{t("calls.list.pickRoom")}</span>
          {freeRooms.length === 0 ? <span className="text-sm text-muted">{t("calls.list.noFreeRoom")}</span> : null}
          {freeRooms.map((room) => (
            <Button className="h-11 px-4" data-entry-room={room.value} key={room.value} onClick={() => enter(room.value)} type="button" variant="secondary">
              {room.label}
            </Button>
          ))}
          <Button className="h-11 px-4" onClick={() => setPickingRoom(false)} type="button" variant="ghost">
            {t("common.confirm.cancel")}
          </Button>
        </div>
      ) : null}
      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.quickBooking.therapist.overrideAssign")}
        description={
          pendingOverride
            ? t(pendingOverride.verdict === "rate_missing" ? "calls.quickBooking.therapist.overrideRateMissing" : "calls.quickBooking.therapist.overrideTimeShort", {
                therapist: pendingOverride.name
              })
            : undefined
        }
        onConfirm={() => {
          if (pendingOverride) commit({ therapist1Id: pendingOverride.therapistId });
          setPendingOverride(null);
        }}
        onOpenChange={(open) => {
          if (!open) setPendingOverride(null);
        }}
        open={pendingOverride !== null}
        title={t("calls.quickBooking.therapist.overrideTitle")}
      />
      {selected && panelHost
        ? createPortal(
            <CallEditPanel
              conflict={conflict}
              customers={customers}
              focusRequest={panelFocus}
              isLocked={isLocked}
              onCancel={() => dispatch({ type: "cancel" })}
              onCommit={commit}
              onEdit={(changes) => dispatch({ type: "edit", changes })}
              onReload={() => void reloadLatest()}
              onRetry={() => commit()}
              onSelectCall={onSelectRelated}
              onStatusChange={changeStatus}
              options={options}
              readOnly={readOnly}
              row={serverRow}
              rows={rows}
              save={save}
              showSettlementAmounts={showSettlementAmounts}
              warningsRow={freshestRow}
            />,
            panelHost
          )
        : null}
    </li>
  );
}

/**
 * 일행 머리 줄(스펙 D14, 티켓 04; 1018 스펙 D8): "정 대표 일행 3명"과 일행 동작. 일행 손님이 하단 완료 영역으로
 * 내려가면 그 영역에도 머리 줄이 있다. 전체 입장·취소는 예약인 손님이 있는 머리 줄에, 1명 추가와 실패한 손님 안내는
 * 일행의 첫 머리 줄에 한 번만 둔다. 입장·취소 저장은 각 손님 줄이 자기 저장 상태로 한다.
 */
function CallPartyHead({
  failures,
  first,
  hidden,
  isLocked,
  lead,
  onAdd,
  onCancel,
  onEnter,
  options,
  part,
  readOnly,
  rows,
  sectionRows,
  size
}: {
  failures: Array<{ position: number; message: string | null }>;
  first: boolean;
  hidden: boolean;
  isLocked: boolean;
  lead: ServiceCallRowDto;
  onAdd: () => void;
  onCancel: (callIds: string[]) => void;
  onEnter: (callIds: string[], rooms: Record<string, string>) => void;
  options: ServiceCallFormOptions;
  /** 위 목록(open)의 머리 줄인지 하단 완료 영역(done)의 머리 줄인지. */
  part: "open" | "done";
  readOnly: boolean;
  rows: ServiceCallRowDto[];
  sectionRows: ServiceCallRowDto[];
  size: number;
}) {
  const t = useT();
  const [picking, setPicking] = useState(false);
  const [rooms, setRooms] = useState<Record<string, string>>({});
  const [confirmCancel, setConfirmCancel] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const label = lead.customerMemo ? t("calls.party.headWithMemo", { memo: lead.customerMemo, size }) : t("calls.party.head", { size });
  const targets = partyEntryTargets(sectionRows);
  const roomless = targets.filter((target) => target.needsRoom);
  const canEnter = Boolean(statusCodeFor(options.statuses, "inUse"));
  const canCancel = Boolean(statusCodeFor(options.statuses, "canceled"));

  useEffect(() => {
    if (picking) pickerRef.current?.querySelector<HTMLElement>("select")?.focus();
  }, [picking]);

  function enterAll() {
    if (roomless.length > 0) {
      setRooms({});
      setPicking(true);
      return;
    }
    onEnter(targets.map((target) => target.callId), {});
  }

  /** 빈 객실 중 일행의 다른 손님이 이미 쓰거나 이 자리에서 고른 객실은 뺀다. */
  function roomChoices(callId: string) {
    const taken = new Set([
      ...sectionRows.filter((member) => member.id !== callId && member.roomId).map((member) => member.roomId),
      ...Object.entries(rooms).filter(([id]) => id !== callId).map(([, roomId]) => roomId)
    ]);
    return freeRoomOptions(options.rooms, rows, callId).filter((room) => !taken.has(room.value));
  }

  const positionOf = (callId: string) => sectionRows.find((member) => member.id === callId)?.partyPosition ?? 0;

  return (
    <>
      <li
        className={`grid gap-2 border-b border-border bg-readonly px-3 py-2 ${partyBarClass}`}
        data-ledger-party={lead.partyId ?? ""}
        data-ledger-party-part={part}
        hidden={hidden}
      >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">{label}</span>
            {/* 휴대폰 폭은 읽기 전용이고 빠른 예약도 없어(티켓 26) 일행 동작을 두지 않는다. */}
            {readOnly ? null : (
              <span className="flex flex-wrap gap-2">
                {targets.length > 0 ? (
                  <>
                    <Button
                      aria-label={t("calls.party.enterAria", { party: label })}
                      className="h-11 px-4"
                      disabled={isLocked || !canEnter}
                      onClick={enterAll}
                      type="button"
                      variant="secondary"
                    >
                      {t("calls.party.enter")}
                    </Button>
                    <Button
                      aria-label={t("calls.party.cancelAria", { party: label })}
                      className="h-11 px-4"
                      disabled={isLocked || !canCancel}
                      onClick={() => setConfirmCancel(true)}
                      type="button"
                      variant="ghost"
                    >
                      {t("calls.party.cancel")}
                    </Button>
                  </>
                ) : null}
                {first ? (
                  <Button
                    aria-label={t("calls.party.addAria", { party: label })}
                    className="h-11 px-4"
                    disabled={isLocked}
                    onClick={onAdd}
                    type="button"
                    variant="ghost"
                  >
                    {t("calls.party.add")}
                  </Button>
                ) : null}
              </span>
            )}
          </div>
          {failures.length > 0 ? (
            <ScreenState
              className="px-3 py-3"
              description={
                <ul className="grid gap-0.5">
                  {failures.map((failure) => (
                    <li key={failure.position}>
                      {t("calls.party.failedGuest", { position: failure.position, message: failure.message ?? t("calls.party.failedFallback") })}
                    </li>
                  ))}
                </ul>
              }
              kind="error"
              label={t("common.saveState.failed")}
              title={t("calls.party.failedTitle")}
            />
          ) : null}
      {picking ? (
            <div
              aria-label={t("calls.party.pickRoomsAria", { party: label })}
              className="flex flex-wrap items-end gap-3"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  setPicking(false);
                }
              }}
              ref={pickerRef}
              role="group"
            >
              <span className="w-full text-sm font-semibold text-foreground">{t("calls.party.pickRooms")}</span>
              {roomless.map((target) => {
                const choices = roomChoices(target.callId);
                return (
                  <label className="grid gap-1 text-xs font-semibold text-muted" key={target.callId}>
                    {t("calls.party.guestRoom", { position: positionOf(target.callId) })}
                    <select
                      className={inputFieldClassName({ className: "w-40" })}
                      data-party-entry-room={target.callId}
                      onChange={(event) =>
                        setRooms((current) => {
                          const next = { ...current };
                          if (event.target.value) next[target.callId] = event.target.value;
                          else delete next[target.callId];
                          return next;
                        })
                      }
                      value={rooms[target.callId] ?? ""}
                    >
                      <option value="">{choices.length === 0 ? t("calls.list.noFreeRoom") : t("calls.party.roomPlaceholder")}</option>
                      {choices.map((room) => (
                        <option key={room.value} value={room.value}>
                          {room.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              <Button
                className="h-11 px-4"
                disabled={roomless.some((target) => !rooms[target.callId])}
                onClick={() => {
                  setPicking(false);
                  onEnter(targets.map((target) => target.callId), rooms);
                }}
                type="button"
              >
                {t("calls.party.enterConfirm")}
              </Button>
              <Button className="h-11 px-4" onClick={() => setPicking(false)} type="button" variant="ghost">
                {t("common.confirm.cancel")}
              </Button>
            </div>
      ) : null}
      </li>
      <ConfirmDialog
        cancelLabel={t("common.confirm.cancel")}
        confirmLabel={t("calls.party.cancelConfirm")}
        description={t("calls.party.cancelDescription", { party: label, count: targets.length })}
        onConfirm={() => {
          setConfirmCancel(false);
          onCancel(targets.map((target) => target.callId));
        }}
        onOpenChange={setConfirmCancel}
        open={confirmCancel}
        title={t("calls.party.cancelTitle")}
      />
    </>
  );
}

/**
 * 두 줄 원장 목록(1018 스펙 D3–D9): 예약·사용중·청소중을 예약시각순 한 목록으로 두고, 오늘이면 `지금 HH:MM`
 * 구분선을 넣는다. 방문완료·취소·노쇼는 하단 접기 영역이다. 모든 줄은 한 목록의 형제라 상태가 바뀌어 하단으로
 * 옮겨도 그 줄의 저장 상태가 새로 시작하지 않는다. 접힌 줄도 숨김(hidden)일 뿐 그대로 있어, 골라 둔 줄의 패널과
 * 저장 중인 요청이 남는다.
 */
export function CallLedgerList({
  clock: clockOverride,
  customers = [],
  isLocked,
  onOpen = () => {},
  onSelectRelated = () => {},
  options,
  panelFocus = null,
  panelHost = null,
  rows,
  selectedCallId = null,
  showSettlementAmounts,
  therapistFilter = null
}: {
  /** 시계를 정해 줄 때(테스트). 없으면 이 기기의 시계를 영업 시간대로 읽는다. */
  clock?: LedgerClock | null;
  customers?: CustomerDto[];
  isLocked: boolean;
  onOpen?: OpenCall;
  /** 패널의 관련 콜로 옮길 때. 그 줄이 보이게 스크롤한다. */
  onSelectRelated?: (callId: string) => void;
  options: ServiceCallFormOptions;
  panelFocus?: CallPanelFocusRequest | null;
  panelHost?: HTMLElement | null;
  rows: ServiceCallRowDto[];
  selectedCallId?: string | null;
  showSettlementAmounts: boolean;
  /**
   * 현황 줄의 "콜만"으로 고른 Therapist(1018 스펙 D17). 다른 Therapist의 콜은 빼지 않고 숨긴다. 숨은 줄도 저장 상태와
   * 떠나기 전 안내를 그대로 들고 있고, 일행 인원은 하루 전체로 센다. 열린 콜은 늘 보인다.
   */
  therapistFilter?: string | null;
}) {
  const t = useT();
  const filteredOut = (row: ServiceCallRowDto) =>
    therapistFilter !== null && row.id !== selectedCallId && row.therapist1?.id !== therapistFilter && row.therapist2?.id !== therapistFilter;
  // 휴대폰 폭(600px 미만)은 같은 목록을 읽기 전용으로 쓴다(스펙 D23, 티켓 26의 규칙).
  const isPhoneWidth = usePhoneWidth();
  const liveClock = useLedgerClock(options.timeSlots, clockOverride === undefined);
  const clock = clockOverride === undefined ? liveClock : clockOverride;
  const dayStart = options.timeSlots[0]?.value ?? "00:00";
  const isToday = Boolean(clock && rows[0] && rows[0].serviceDate === clock.today);
  const lineClock = isToday && clock ? { time: clock.time, dayStart } : null;
  const [doneExpanded, setDoneExpanded] = useState(false);
  // 고른 완료 콜 때문에 펼친 영역을 사용자가 다시 접었으면, 그 콜을 고른 동안은 접힌 채로 둔다.
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  useEffect(() => {
    setDoneExpanded(readDoneExpanded());
  }, []);
  const timeline = ledgerTimeline(rows);
  // 일행 동작(티켓 04): 일행마다 마지막으로 보낸 일과, 일행 콜 줄들이 알려 온 저장 상태.
  const [partyCommands, setPartyCommands] = useState<Record<string, PartyCommand>>({});
  const [partyOutcomes, setPartyOutcomes] = useState<Record<string, PartyCommandOutcome>>({});
  function sendPartyCommand(partyId: string, action: PartyAction) {
    setPartyCommands((current) => ({ ...current, [partyId]: { ...action, token: (current[partyId]?.token ?? 0) + 1 } }));
  }
  const reportPartyOutcome = (callId: string, outcome: PartyCommandOutcome) => setPartyOutcomes((current) => ({ ...current, [callId]: outcome }));
  // 주소나 관련 콜로 접힌 완료 영역의 콜을 고르면 그 영역을 펼친다(기기에 남기지는 않는다).
  const selectedIsDone = timeline.done.some((row) => row.id === selectedCallId);
  const revealSelected = selectedIsDone && foldedFor !== selectedCallId;
  const showDone = doneExpanded || revealSelected;

  function toggleDone() {
    if (showDone && revealSelected) setFoldedFor(selectedCallId);
    setDoneExpanded(!showDone);
    writeDoneExpanded(!showDone);
  }

  const headedParties = new Set<string>();
  const line = (row: ServiceCallRowDto, party: { position: number; size: number } | null, hidden: boolean) => (
    <CallLedgerLine
      clock={lineClock}
      customers={customers}
      dayStart={dayStart}
      hidden={hidden || filteredOut(row)}
      isLocked={isLocked}
      key={row.id}
      onOpen={onOpen}
      onPartyOutcome={reportPartyOutcome}
      onSelectRelated={onSelectRelated}
      options={options}
      panelFocus={row.id === selectedCallId ? panelFocus : null}
      panelHost={panelHost}
      party={party}
      partyCommand={row.partyId ? (partyCommands[row.partyId] ?? null) : null}
      readOnly={isPhoneWidth}
      row={row}
      rows={rows}
      selected={row.id === selectedCallId}
      showSettlementAmounts={showSettlementAmounts}
    />
  );
  /** 한 부분(위 목록이나 하단 완료 영역)의 줄들. 일행은 그 부분에서 처음 나오는 손님 자리에 머리 줄과 함께 붙는다. */
  const partNodes = (part: "open" | "done", partRows: ServiceCallRowDto[], hidden: boolean) =>
    ledgerFlowItems(partRows, rows).map((item) => {
      if (item.kind === "call") return { startTime: item.row.startTime, nodes: [line(item.row, null, hidden)] };
      const { partyId, size, lead } = item;
      const first = !headedParties.has(partyId);
      headedParties.add(partyId);
      const command = partyCommands[partyId];
      const failures =
        first && command
          ? command.callIds.flatMap((callId) => {
              const outcome = partyOutcomes[callId];
              if (outcome?.token !== command.token || !isSaveHeld(outcome.status)) return [];
              return [{ position: rows.find((row) => row.id === callId)?.partyPosition ?? 0, message: outcome.message }];
            })
          : [];
      return {
        startTime: item.rows[0]?.startTime ?? lead.startTime,
        nodes: [
          <CallPartyHead
            failures={failures}
            first={first}
            hidden={hidden || item.rows.every(filteredOut)}
            isLocked={isLocked}
            key={`party-${part}-${partyId}`}
            lead={lead}
            onAdd={() =>
              requestQuickBookingJoinParty({ partyId, serviceDate: lead.serviceDate, startTime: lead.startTime, customerMemo: lead.customerMemo, size })
            }
            onCancel={(callIds) => sendPartyCommand(partyId, { kind: "cancel", callIds })}
            onEnter={(callIds, rooms) => sendPartyCommand(partyId, { kind: "enter", callIds, rooms })}
            options={options}
            part={part}
            readOnly={isPhoneWidth}
            rows={rows}
            sectionRows={item.rows}
            size={size}
          />,
          ...item.rows.map((row) => line(row, { position: row.partyPosition ?? 0, size }, hidden))
        ]
      };
    });

  const openItems = partNodes("open", timeline.open, false);
  const body: ReactNode[] = openItems.flatMap((item) => item.nodes);
  if (isToday && clock) {
    const index = nowDividerIndex(
      openItems.map((item) => item.startTime),
      clock.time,
      dayStart
    );
    const at = openItems.slice(0, index).reduce((count, item) => count + item.nodes.length, 0);
    body.splice(
      at,
      0,
      <li className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-foreground" data-ledger-now="" key="now">
        <span className="whitespace-nowrap [font-variant-numeric:tabular-nums]">{t("calls.line.now", { time: clock.time })}</span>
        <span aria-hidden="true" className="h-0.5 flex-1 bg-foreground" />
      </li>
    );
  }
  const doneCount = timeline.done.filter((row) => !filteredOut(row)).length;
  if (timeline.done.length > 0) {
    body.push(
      <li className="border-b border-border px-3 pb-2 pt-4" data-ledger-done-toggle="" hidden={doneCount === 0} key="done-toggle">
        <button
          aria-expanded={showDone}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          onClick={toggleDone}
          type="button"
        >
          <span aria-hidden="true">{showDone ? "▾" : "▸"}</span>
          {t("calls.flow.doneToggle", { count: doneCount })}
        </button>
      </li>,
      ...partNodes("done", timeline.done, !showDone).flatMap((item) => item.nodes)
    );
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("calls.grid.title")}</h2>
          {isLocked ? (
            <div className="mt-1 text-xs text-danger">
              <p className="font-medium">{t("calls.grid.lockedTitle")}</p>
              <p>{t("calls.grid.lockedCallDescription")}</p>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{t("calls.grid.rowCount", { count: rows.length })}</span>
      </div>

      {rows.length === 0 ? (
        <div className="grid gap-1 px-4 py-8">
          <p className="text-sm font-medium text-foreground">{t("calls.grid.empty.title")}</p>
          {/* 휴대폰 폭에는 빠른 예약이 없다(티켓 26). */}
          {isPhoneWidth ? null : <p className="text-xs text-muted">{t("calls.grid.empty.description")}</p>}
        </div>
      ) : null}
      {/* 콜이 없어도 목록은 그대로 둔다 — 빠른 예약으로 첫 콜을 만들면 같은 자리에 줄이 생긴다. 휴대폰 폭도 같은
          두 줄 행이다(스펙 D9). */}
      <ol aria-label={t("calls.list.aria")} className="grid min-w-0" data-call-ledger-list="" hidden={rows.length === 0}>
        {body}
      </ol>
    </section>
  );
}
