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
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import { autosaveServiceCallRowAction, reloadServiceCallRowAction } from "@/app/(erp)/calls/actions";
import { ledgerCallAnchorId } from "@/lib/ledger-address";
import { callRowSaveReducer, initialCallRowSave, isSaveHeld, type CallRowDraft, type RowSaveStatus } from "@/app/(erp)/calls/call-row-save";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import type { CallConflictCompareData } from "@/app/(erp)/calls/call-conflict-compare";
import { CallEditPanel, type CallPanelFocusRequest } from "@/app/(erp)/calls/call-edit-panel";
import { optionLabel } from "@/app/(erp)/calls/call-ledger-fields";
import { usePhoneWidth } from "@/app/(erp)/calls/phone-width";
import { nowClockString } from "@/app/(erp)/calls/quick-booking-now-slot";
import { requestQuickBookingJoinParty } from "@/app/(erp)/calls/quick-booking-party-join";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";
import {
  entryClock,
  freeRoomOptions,
  ledgerFlowItems,
  ledgerFlowOf,
  ledgerFlowSections,
  nextLedgerAction,
  partyEntryTargets,
  statusCodeFor,
  type LedgerFlow
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

const FLOW_TITLE_KEY: Record<LedgerFlow, MessageKey> = {
  active: "calls.flow.active",
  reserved: "calls.flow.reserved",
  done: "calls.flow.done"
};

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

// 열 너비: 고객/메모만 남는 폭을 받고 나머지는 고정이다. 1280px에서 패널을 열어도(목록 약 50rem) 가로 스크롤이 없다.
const COLUMNS: Array<{ id: string; labelKey: MessageKey; width?: string }> = [
  { id: "time", labelKey: "calls.column.time", width: "4rem" },
  { id: "customerMemo", labelKey: "calls.column.customerMemo" },
  { id: "course", labelKey: "calls.column.course", width: "5.5rem" },
  { id: "therapists", labelKey: "calls.list.therapists", width: "7.5rem" },
  { id: "room", labelKey: "calls.column.room", width: "6rem" },
  { id: "status", labelKey: "calls.column.status", width: "8rem" },
  { id: "signals", labelKey: "calls.list.signals", width: "4.5rem" },
  { id: "action", labelKey: "calls.list.action", width: "6rem" }
];

const cellClass = "border-b border-border px-2 py-2 align-middle max-[599px]:border-0 max-[599px]:px-1 max-[599px]:py-0.5";

/**
 * 휴대폰 폭(600px 미만, 스펙 D23)은 같은 표를 줄마다 세 줄 격자로 그린다: 시간은 왼쪽에 세로로 걸치고,
 * 고객/메모 → 코스·매니저·객실 → 상태·경고·할 일 순서다. 칸은 DOM 순서대로 자리를 채운다.
 */
const phoneLineClass =
  "max-[599px]:grid max-[599px]:grid-cols-[3.5rem_repeat(3,minmax(0,1fr))] max-[599px]:items-center max-[599px]:gap-x-1 max-[599px]:border-b max-[599px]:border-border max-[599px]:px-1 max-[599px]:py-1.5 [&>td:first-child]:max-[599px]:row-span-3 [&>td:first-child]:max-[599px]:self-start [&>td:nth-child(2)]:max-[599px]:col-span-3";
/** 휴대폰 폭에서 줄이 아닌 행(묶음 머리, 일행 머리, 객실 고르기)은 한 칸짜리 블록이다. */
const phoneBlockRowClass = "max-[599px]:block [&>*]:max-[599px]:block";

/**
 * 원장 한 줄(스펙 D17)과 그 콜의 저장 상태. 저장은 줄마다 하나씩 보내고(callRowSaveReducer), 입장 버튼과
 * 편집 패널이 같은 저장 상태를 쓴다. 패널은 이 줄이 골라졌을 때 작업면의 패널 자리(panelHost)에 그린다 —
 * 그래서 패널을 닫거나 다른 줄로 옮겨도 이 줄의 초안과 저장 중인 요청이 그대로 남는다.
 */
function CallLedgerLine({
  customers,
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
  customers: CustomerDto[];
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

  function enter(roomId?: string) {
    if (isLocked || !inUse) return;
    const changes: Partial<CallRowDraft> = { actualEntryTime: entryClock(nowClockString()), status: inUse };
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

  const time = draft.startTime;
  const courseLabel = optionLabel(options.courses, draft.courseId) || serverRow.courseLabel;
  const therapistName = (id: string | null | undefined, assigned: ServiceCallRowDto["therapist1"]) =>
    !id ? null : assigned?.id === id ? assigned.displayName : optionLabel(options.therapists, id) || id;
  const therapists = [therapistName(draft.therapist1Id, serverRow.therapist1), therapistName(draft.therapist2Id, serverRow.therapist2)]
    .filter(Boolean)
    .join(" · ");
  const roomLabel = draft.roomId ? optionLabel(options.rooms, draft.roomId) || serverRow.roomLabel : null;
  const statusKey = callStatusKeyOf(draft.status);
  const statusLabel = optionLabel(options.statuses, draft.status) || draft.status;
  const warnings = freshestRow.warnings.map((warning) => callWarningLabel(t, warning));
  const freeRooms = pickingRoom ? freeRoomOptions(options.rooms, rows, row.id) : [];

  return (
    <>
      {/* 편집 패널이 열린 줄은 선택된 줄 모양이다(design.md 6.6). 버튼이 아닌 자리를 눌러도 패널이 열린다. */}
      <tr
        className={`cursor-pointer transition-colors hover:bg-readonly data-[selected=true]:bg-readonly [&[data-selected=true]>td:first-child]:[box-shadow:inset_3px_0_0_var(--brand)] ${phoneLineClass}`}
        data-ledger-line=""
        data-selected={selected}
        data-service-call-id={row.id}
        hidden={hidden}
        id={ledgerCallAnchorId(row.id)}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest("button, a, input")) return;
          onOpen(row.id);
        }}
      >
        <td className={cellClass}>
          <button
            aria-label={t("calls.detail.rowAria", { time })}
            className="min-h-11 rounded-sm px-1 text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
            data-call-open={row.id}
            onClick={() => onOpen(row.id)}
            type="button"
          >
            {time}
          </button>
        </td>
        <td className={`${cellClass} text-sm text-foreground`}>
          <span className="grid">
            <span className="truncate">{draft.customerMemo ?? <span className="text-muted">-</span>}</span>
            {party ? <span className="truncate text-xs text-muted">{t("calls.party.position", party)}</span> : null}
          </span>
        </td>
        <td className={`${cellClass} truncate text-sm text-foreground`}>{courseLabel}</td>
        <td className={`${cellClass} truncate text-sm text-foreground`}>{therapists || <span className="text-muted">-</span>}</td>
        <td className={`${cellClass} truncate text-sm text-foreground`}>
          {roomLabel ?? <span className="text-muted">{t("calls.placeholder.roomUnassigned")}</span>}
        </td>
        <td className={cellClass}>
          <span className="grid justify-items-start gap-0.5">
            {statusKey ? (
              <CallStatusChip label={statusLabel} size="sm" status={statusKey} />
            ) : (
              <StatusIndicator label={statusLabel} size="sm" tone="neutral" />
            )}
            {draft.note ? <span className="max-w-full truncate text-xs text-muted">{draft.note}</span> : null}
          </span>
        </td>
        <td className={cellClass}>
          <span className="grid justify-items-start gap-0.5" data-line-save-state={saveStatus}>
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
            {saveStatus === "saving" || isSaveHeld(saveStatus) ? <SaveStatus locale={locale} state={saveStatus === "saving" ? "saving" : saveStatus} /> : null}
          </span>
        </td>
        <td className={`${cellClass} text-right`}>
          {/* 휴대폰 폭은 읽기 전용이라(티켓 26) 할 일 버튼을 두지 않는다. */}
          {readOnly ? null : action === "enter" ? (
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
          ) : action === "pay" ? (
            <Button
              aria-label={t("calls.list.payAria", { time })}
              className="h-11 px-4"
              disabled={isLocked}
              onClick={() => onOpen(row.id, "payment")}
              type="button"
              variant="secondary"
            >
              {t("calls.list.pay")}
            </Button>
          ) : null}
        </td>
      </tr>
      {pickingRoom ? (
        <tr className={phoneBlockRowClass} hidden={hidden}>
          <td className={`${cellClass} bg-readonly`} colSpan={COLUMNS.length}>
            <div
              aria-label={t("calls.list.pickRoomAria", { time })}
              className="flex flex-wrap items-center gap-2"
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
          </td>
        </tr>
      ) : null}
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
    </>
  );
}

/**
 * 일행 머리 줄(스펙 D14, 티켓 04): "정 대표 일행 3명"과 일행 동작. 일행 콜이 여러 흐름 묶음에 흩어지면 묶음마다
 * 머리 줄이 있다. 전체 입장·취소는 예약인 손님이 있는 머리 줄에, 1명 추가와 실패한 손님 안내는 일행의 첫 머리
 * 줄에 한 번만 둔다. 입장·취소 저장은 각 손님 줄이 자기 저장 상태로 한다.
 */
function CallPartyHead({
  failures,
  first,
  flow,
  hidden,
  isLocked,
  lead,
  onAdd,
  onCancel,
  onEnter,
  options,
  readOnly,
  rows,
  sectionRows,
  size
}: {
  failures: Array<{ position: number; message: string | null }>;
  first: boolean;
  flow: LedgerFlow;
  hidden: boolean;
  isLocked: boolean;
  lead: ServiceCallRowDto;
  onAdd: () => void;
  onCancel: (callIds: string[]) => void;
  onEnter: (callIds: string[], rooms: Record<string, string>) => void;
  options: ServiceCallFormOptions;
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
      <tr className={phoneBlockRowClass} data-ledger-party={lead.partyId ?? ""} data-ledger-party-flow={flow} hidden={hidden}>
        <td className={`${cellClass} bg-readonly`} colSpan={COLUMNS.length}>
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
              className="mt-2 px-3 py-3"
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
        </td>
      </tr>
      {picking ? (
        <tr className={phoneBlockRowClass} hidden={hidden}>
          <td className={`${cellClass} bg-readonly`} colSpan={COLUMNS.length}>
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
          </td>
        </tr>
      ) : null}
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
 * 흐름별 원장 목록(스펙 D15–D17, 티켓 03): 지금 이용 중 → 예약 → 완료·취소·노쇼. 모든 줄은 한 tbody의 형제라
 * 상태가 바뀌어 다른 묶음으로 옮겨도 그 줄의 저장 상태가 새로 시작하지 않는다. 접힌 완료 묶음의 줄도 숨김(hidden)일
 * 뿐 그대로 있어, 골라 둔 줄의 패널과 저장 중인 요청이 남는다.
 */
export function CallLedgerList({
  customers = [],
  isLocked,
  onOpen = () => {},
  onSelectRelated = () => {},
  options,
  panelFocus = null,
  panelHost = null,
  rows,
  selectedCallId = null,
  showSettlementAmounts
}: {
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
}) {
  const t = useT();
  // 휴대폰 폭(600px 미만)은 같은 목록을 읽기 전용으로 쓴다(스펙 D23, 티켓 26의 규칙).
  const isPhoneWidth = usePhoneWidth();
  const [doneExpanded, setDoneExpanded] = useState(false);
  // 고른 완료 콜 때문에 펼친 묶음을 사용자가 다시 접었으면, 그 콜을 고른 동안은 접힌 채로 둔다.
  const [foldedFor, setFoldedFor] = useState<string | null>(null);
  useEffect(() => {
    setDoneExpanded(readDoneExpanded());
  }, []);
  const sections = ledgerFlowSections(rows);
  // 일행 동작(티켓 04): 일행마다 마지막으로 보낸 일과, 일행 콜 줄들이 알려 온 저장 상태.
  const [partyCommands, setPartyCommands] = useState<Record<string, PartyCommand>>({});
  const [partyOutcomes, setPartyOutcomes] = useState<Record<string, PartyCommandOutcome>>({});
  const commandToken = useRef(0);
  function sendPartyCommand(partyId: string, action: PartyAction) {
    commandToken.current += 1;
    setPartyCommands((current) => ({ ...current, [partyId]: { ...action, token: commandToken.current } }));
  }
  const reportPartyOutcome = (callId: string, outcome: PartyCommandOutcome) => setPartyOutcomes((current) => ({ ...current, [callId]: outcome }));
  // 실패 안내는 일행 입장·취소 버튼이 있는 예약 묶음의 머리 줄에 둔다. 예약이 남지 않았으면 일행의 첫 머리 줄에 둔다.
  const reservedParties = new Set(rows.filter((row) => row.partyId && ledgerFlowOf(row.status) === "reserved").map((row) => row.partyId));
  // 주소나 관련 콜로 접힌 완료 묶음의 콜을 고르면 그 묶음을 펼친다(기기에 남기지는 않는다).
  const selectedIsDone = rows.some((row) => row.id === selectedCallId && ledgerFlowOf(row.status) === "done");
  const revealSelected = selectedIsDone && foldedFor !== selectedCallId;
  const showDone = doneExpanded || revealSelected;

  function toggleDone() {
    if (showDone && revealSelected) setFoldedFor(selectedCallId);
    setDoneExpanded(!showDone);
    writeDoneExpanded(!showDone);
  }

  const body: ReactNode[] = [];
  const headedParties = new Set<string>();
  for (const section of sections) {
    const collapsed = section.flow === "done" && !showDone;
    body.push(
      <tr className={phoneBlockRowClass} data-ledger-flow={section.flow} key={`flow-${section.flow}`}>
        <th className="border-b border-border bg-surface px-2 pb-2 pt-4 text-left align-bottom" colSpan={COLUMNS.length} scope="colgroup">
          {section.flow === "done" ? (
            <button
              aria-expanded={showDone}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
              onClick={toggleDone}
              type="button"
            >
              <span aria-hidden="true">{showDone ? "▾" : "▸"}</span>
              {t("calls.flow.doneToggle", { count: section.rows.length })}
            </button>
          ) : (
            <span className="text-[0.9375rem] font-semibold text-foreground">
              {t(FLOW_TITLE_KEY[section.flow])} <span className="text-sm text-muted">{t("calls.flow.count", { count: section.rows.length })}</span>
            </span>
          )}
        </th>
      </tr>
    );
    const line = (row: ServiceCallRowDto, party: { position: number; size: number } | null) => (
      <CallLedgerLine
        customers={customers}
        hidden={collapsed}
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
    for (const item of ledgerFlowItems(section.rows, rows)) {
      if (item.kind === "call") {
        body.push(line(item.row, null));
        continue;
      }
      const { partyId, size, lead } = item;
      const first = !headedParties.has(partyId);
      headedParties.add(partyId);
      const command = partyCommands[partyId];
      const showsFailures = section.flow === "reserved" || (first && !reservedParties.has(partyId));
      const failures =
        showsFailures && command
          ? command.callIds.flatMap((callId) => {
              const outcome = partyOutcomes[callId];
              if (outcome?.token !== command.token || !isSaveHeld(outcome.status)) return [];
              return [{ position: rows.find((row) => row.id === callId)?.partyPosition ?? 0, message: outcome.message }];
            })
          : [];
      body.push(
        <CallPartyHead
          failures={failures}
          first={first}
          flow={section.flow}
          hidden={collapsed}
          isLocked={isLocked}
          key={`party-${section.flow}-${partyId}`}
          lead={lead}
          onAdd={() =>
            requestQuickBookingJoinParty({ partyId, serviceDate: lead.serviceDate, startTime: lead.startTime, customerMemo: lead.customerMemo, size })
          }
          onCancel={(callIds) => sendPartyCommand(partyId, { kind: "cancel", callIds })}
          onEnter={(callIds, rooms) => sendPartyCommand(partyId, { kind: "enter", callIds, rooms })}
          options={options}
          readOnly={isPhoneWidth}
          rows={rows}
          sectionRows={item.rows}
          size={size}
        />
      );
      for (const row of item.rows) body.push(line(row, { position: row.partyPosition ?? 0, size }));
    }
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
      {/* 콜이 없어도 줄 구조는 그대로 둔다 — 빠른 예약으로 첫 콜을 만들면 같은 자리에 줄이 생긴다. 휴대폰 폭은
          같은 표를 블록과 줄 격자로 그린다(스펙 D23). */}
      <table
        aria-label={t("calls.list.aria")}
        className="w-full table-fixed border-collapse text-left max-[599px]:block"
        data-call-ledger-list=""
        hidden={rows.length === 0}
      >
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.id} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead className="bg-readonly text-xs font-semibold text-muted max-[599px]:hidden">
          <tr>
            {COLUMNS.map((column) => (
              <th className="whitespace-nowrap border-b border-border px-2 py-2 text-left" key={column.id} scope="col">
                {column.id === "action" ? <span className="sr-only">{t(column.labelKey)}</span> : t(column.labelKey)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="max-[599px]:block">{body}</tbody>
      </table>
    </section>
  );
}
