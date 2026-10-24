"use client";

import { useEffect, useMemo, useReducer, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { inputFieldClassName } from "@/components/ui/input-field";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { ScreenState } from "@/components/ui/screen-state";
import { SaveStatus } from "@/components/ui/save-status";
import { CallStatusChip, callStatusKeyOf } from "@/components/domain/call-status-chip";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";
import { loadTherapistAvailability } from "./call-queries";
import { autosaveServiceCallRowAction, reloadServiceCallRowAction } from "@/app/(erp)/calls/actions";
import { useLedgerClock, type LedgerClock } from "@/app/(erp)/calls/ledger-clock";
import { businessClockString } from "@/lib/operating-date";
import { ledgerCallAnchorId } from "@/lib/ledger-address";
import { callRowSaveReducer, initialCallRowSave, isSaveHeld, type CallRowDraft, type RowSaveStatus } from "@/app/(erp)/calls/call-row-save";
import { useUnsavedGuard } from "@/app/(erp)/calls/unsaved-guard";
import type { CallConflictCompareData } from "@/app/(erp)/calls/call-conflict-compare";
import { CallEditPanel, type CallPanelFocusRequest } from "@/app/(erp)/calls/call-edit-panel";
import { nullableValue, optionLabel } from "@/app/(erp)/calls/call-ledger-fields";
import { LedgerCellPicker, type LedgerPickOption } from "@/app/(erp)/calls/ledger-cell-picker";
import { usePhoneWidth } from "@/app/(erp)/calls/phone-width";
import { clockMinutes } from "@/app/(erp)/calls/quick-booking-now-slot";
import { requestQuickBookingJoinParty } from "@/app/(erp)/calls/quick-booking-party-join";
import { callWarningLabel } from "@/app/(erp)/calls/call-warning-label";
import { BookingChannelIcon } from "@/app/(erp)/calls/booking-channel-icons";
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

const LEDGER_HEAD_KEYS = [
  "calls.list.head.time",
  "calls.list.head.entry",
  "calls.list.head.end",
  "calls.list.head.customer",
  "calls.list.head.course",
  "calls.list.head.therapist",
  "calls.list.head.room",
  "calls.list.head.status",
  "calls.list.head.discount",
  "calls.list.head.payment",
  "calls.list.head.action"
] as const;

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
 * 원장 줄의 칸 배치(2026-10-22 고객 시안 111.png, 순서는 2026-10-23 시안 123.png). 모든 줄이 같은 열을 써서 예약자·코스 글자
 * 길이가 달라도 칸이 줄마다 같은 자리에 오고, 넘치는 글자는 칸 안에서 말줄임으로 자른다. 열은 화면 폭이 아니라 원장 폭(컨테이너
 * 쿼리)을 따른다. 줄 안의 칸(마크업)도 이 순서라 Tab 순서와 칸 사이 세로줄이 머리 줄과 맞는다.
 * - 81rem 이상: 예약시간 · 입장 · 종료 · 고객 정보 · 코스 · 관리사 · 객실 · 상태 · 할인 · 결제 · 조치 한 줄(머리 줄과 같은 열),
 *   칸 사이에 세로줄을 긋는 표이고 칸 안의 내용은 가운데 정렬이다(2026-10-23 고객 요청).
 *   81rem은 열의 최소 폭 합계(칸 사이 간격 10px×10, 줄 안쪽 여백 0.5rem×2 포함)라 1366px 화면에서도 한 줄이다. 최소 폭은 가장
 *   긴 베트남어로 쟀다(2026-10-23): 상태 칩 "Đang sử dụng ▾"와 결제 칩 "Chưa xác nhận ▾"가 133px라 8.5rem, 입장·종료 칸은
 *   시각 칸(LedgerTimeEdit)이 들어가는 5.5rem이다.
 *   남는 폭은 시안 123.png의 비율대로 모든 칸이 나눠 갖는다(고객 정보·관리사·결제가 넓다). 예전에는 선택 칸 열만 늘어나 ▾ 칸
 *   안이 비었다(2026-10-23 "드롭다운 여백").
 * - 48rem 이상(편집·빠른 예약 패널이 열려 좁아졌을 때): 윗줄 예약시간 · 입장 · 종료 · 상태 · 조치, 아랫줄 고객 · 코스 · 관리사 · 객실 · 할인 · 결제
 *   (한 줄 표와 같은 순서, 왼쪽 정렬).
 * - 그보다 좁으면(휴대폰 읽기 전용) 세 칸씩 여러 줄.
 */
const ledgerWideColumns =
  "@[81rem]:grid-cols-[minmax(3.5rem,1fr)_minmax(5.5rem,1fr)_minmax(5.5rem,1fr)_minmax(8.5rem,2.2fr)_minmax(5.75rem,1.1fr)_minmax(8rem,2.1fr)_minmax(6rem,1fr)_minmax(8.5rem,1fr)_minmax(6rem,1fr)_minmax(8.5rem,1.9fr)_minmax(8rem,1.15fr)]";
/** 한 줄 11칸의 칸 사이 간격과 줄 안쪽 여백. 머리 줄과 원장 줄이 같아야 열이 맞는다. */
const ledgerWideSpacing = "@[81rem]:gap-x-2.5 @[81rem]:px-2";
const ledgerLineAreas = [
  "grid-cols-3 [grid-template-areas:'time_status_status'_'entry_end_end'_'who_who_who'_'course_course_course'_'therapist_room_pay'_'discount_action_action']",
  "@3xl:grid-cols-[4rem_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]",
  // 상태는 두 열(1fr+0.7fr)을 차지해 베트남어 칩 "Đang sử dụng ▾"(133px)이 48rem 원장에서도 잘리지 않는다(예전 1.3fr 한 열보다 넓다).
  "@3xl:[grid-template-areas:'time_entry_end_status_status_action_action'_'who_who_course_therapist_room_discount_pay']",
  ledgerWideColumns,
  "@[81rem]:[grid-template-areas:'time_entry_end_who_course_therapist_room_status_discount_pay_action']"
].join(" ");
/**
 * 한 줄 11칸일 때 칸은 줄 높이를 다 채우고(위아래 여백은 줄이 아니라 칸이 갖는다), 둘째 칸부터 왼쪽 간격 가운데에 1px 세로줄을
 * 긋는다(2026-10-23 고객 요청, 시안 111.png). 선은 행 구분선보다 진한 --grid-line이다. 두 줄·휴대폰 배치에는 선이 없다. 칸 안의 내용은 각 칸이 세로·가로 가운데로
 * 세운다(가로 가운데는 시안 123.png, 한 줄 표에서만 — 두 줄 배치는 왼쪽부터 읽는다).
 */
const wideCellClass = "@[81rem]:self-stretch @[81rem]:py-2.5";
/**
 * 한 줄 표에서 칸 안의 내용을 가로 가운데로 둔다. flex 칸은 justify-content, grid 칸은 justify-items를 쓴다. 말줄임 글자만 든
 * 칸(코스)은 justify-items를 쓰지 않고 text-center만 둔다 — 항목이 글자 폭으로 줄어 말줄임이 안 되고 옆 칸으로 넘친다.
 */
const wideCenterFlex = "@[81rem]:justify-center";
const wideCenterGrid = "@[81rem]:justify-items-center @[81rem]:text-center";
/**
 * 고객 정보 칸만 한 줄 표에서도 왼쪽부터 쓴다(2026-10-23 고객 요청 ledger-grid-request-1023.png ①). 가운데 정렬이면 예약자 글자
 * 길이에 따라 경로 기호가 줄마다 옆으로 밀렸다. 칸 왼쪽에서 고정 여백만 두어 모든 줄의 기호와 글자가 같은 자리에서 시작하고,
 * 머리 글자도 같은 여백에서 시작한다. 칸 안 내용은 justify 기본값(왼쪽)이라 왼쪽 여백만 준다.
 */
const wideStartPadding = "@[81rem]:pl-3";
const wideStartHeadClass = `@[81rem]:text-left ${wideStartPadding}`;
const wideDividerClass =
  "relative @[81rem]:before:absolute @[81rem]:before:inset-y-0 @[81rem]:before:-left-[5px] @[81rem]:before:w-px @[81rem]:before:bg-grid-line @[81rem]:before:content-['']";
const lineCellClass = `${wideCellClass} ${wideDividerClass}`;
const headCellClass = "truncate py-2 text-center font-bold";
/**
 * 원장 줄 안의 선택 칸: 칸 폭을 채우고 ▾를 오른쪽 끝에 둔다(시안의 드롭다운 칸). 아주 넓은 화면에서도 글자 옆이 비지 않게 12rem에서
 * 멈춘다(2026-10-23 "드롭다운 여백"). 바탕은 거의 흰 --surface-field라 베이지 줄 위에서 조작 칸이 드러난다(2026-10-23 고객 요청).
 */
const pickerFieldClass = "h-10 w-full max-w-48 justify-between rounded-sm bg-surface-field px-2.5";
/** 조치 칸의 입장·종료 버튼(시안 111.png): 칸 폭을 채우는 채운 알약. */
const actionButtonClass = "w-full max-w-36 justify-center";
type TherapistSlot = "therapist1Id" | "therapist2Id";

/** 예약시각부터 예약 종료까지의 분(코스 길이). 자정을 넘으면 다음 날로 센다. */
function clockSpanMinutes(from: string, to: string) {
  return (clockMinutes(to) - clockMinutes(from) + 24 * 60) % (24 * 60) || null;
}

/**
 * 윗줄의 입장·종료 시각(1018 스펙 D11): 누르면 그 자리에서 분 단위 시각 칸이 되고, Enter나 칸을 떠나면 저장한다.
 * Esc는 고치지 않고 닫는다(원장 키보드에 넘기지 않는다). 비우거나 같은 값이면 저장하지 않는다.
 * 시각 칸은 칸 폭 안에 들어간다(2026-10-22: 112px 고정이라 5rem 입장 칸을 넘어 종료 칸을 덮었다). 12시간제 브라우저의
 * "오전 11:05"가 가장 넓은데, 시계 아이콘을 숨기고 좌우 여백을 줄이면 86px라 5.5rem(88px) 칸에 들어간다.
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
      className={inputFieldClassName({ className: "h-8 w-full min-w-0 px-1 [&::-webkit-calendar-picker-indicator]:hidden" })}
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
  onClose,
  onOpen,
  onPartyOutcome,
  onSaved,
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
  /** 열린 편집 패널을 닫는다. 골라 둔 줄을 다시 누르면 닫힌다(2026-10-23 고객 요청). */
  onClose: () => void;
  onOpen: OpenCall;
  /** 일행 동작을 받아 저장한 결과를 머리 줄에 알린다(실패한 손님과 이유를 머리 줄이 보인다). */
  onPartyOutcome: (callId: string, outcome: PartyCommandOutcome) => void;
  /** 저장이 받아들여졌다. 저장 응답은 이 줄만 돌려주므로 작업면이 나머지 화면을 새로 고친다. */
  onSaved: (row: ServiceCallRowDto) => void;
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
  const [pendingOverride, setPendingOverride] = useState<{ therapistId: string; name: string; verdict: TherapistPickVerdict; slot: TherapistSlot } | null>(null);

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
            onSaved(result.data);
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

  const therapistChoicesController = useRef<AbortController | null>(null);
  useEffect(() => () => therapistChoicesController.current?.abort(), [row.serviceDate, draft.startTime]);
  async function loadTherapistChoices() {
    therapistChoicesController.current?.abort();
    const controller = new AbortController();
    therapistChoicesController.current = controller;
    setTherapistChoices(null);
    setTherapistChoicesFailed(false);
    try {
      const { rows } = await loadTherapistAvailability({
        operatingMonthId: row.operatingMonthId,
        serviceDate: row.serviceDate,
        time: draft.startTime,
        excludeCallId: row.id
      }, controller.signal);
      if (!controller.signal.aborted) setTherapistChoices(rows);
    } catch {
      if (controller.signal.aborted) return;
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
  function pickTherapist(value: string, slot: TherapistSlot) {
    const entry = therapistList?.find((candidate) => candidate.therapistId === value);
    if (entry && entry.verdict !== "possible") {
      setPendingOverride({ therapistId: entry.therapistId, name: entry.therapistName, verdict: entry.verdict, slot });
      return;
    }
    commit({ [slot]: nullableValue(value) });
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
  // 코스 칸은 시안(111.png)처럼 "C 90분"을 굵게, 코스 이름을 그 아래 흐리게 둔다. 길이는 저장된 예약 종료에서 잰다.
  const courseCode = draft.courseId === serverRow.courseId ? serverRow.courseCode : courseLabel.split(" ")[0];
  const courseName = courseLabel.startsWith(`${courseCode} `) ? courseLabel.slice(courseCode.length + 1) : courseLabel;
  const courseMinutes = draft.courseId === serverRow.courseId ? clockSpanMinutes(serverRow.startTime, freshestRow.reservedEnd) : null;
  const therapistName = (id: string | null | undefined, assigned: ServiceCallRowDto["therapist1"]) =>
    !id ? null : assigned?.id === id ? assigned.displayName : (therapistChoices?.find((choice) => choice.therapistId === id)?.therapistName ?? (optionLabel(options.therapists, id) || id));
  const therapist1Text = therapistName(draft.therapist1Id, serverRow.therapist1) ?? t("calls.cell.unassigned");
  // 두 명 코스면 두 번째 Therapist가 비어 있어도 칸을 둔다(빈 칸은 미지명). 다른 코스는 사람이 있을 때만 둔다.
  const showSecondTherapist = Boolean(draft.therapist2Id) || options.secondTherapistCourseIds.includes(draft.courseId);
  const therapist2Text = showSecondTherapist ? (therapistName(draft.therapist2Id, serverRow.therapist2) ?? t("calls.cell.unassigned")) : null;
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
  // 고객 칸 둘째 줄(고객 시안 111.png): 예약자 ID / 연락처(2026-10-23, 전화 예약은 번호), 없으면 이은 고객의 전화번호, 그것도 없으면 예약 경로 이름.
  const contact =
    draft.bookerHandle?.trim() || (draft.customerId ? customers.find((customer) => customer.id === draft.customerId)?.phone : null) || who.channel;
  const roomText = roomLabel ?? t("calls.placeholder.roomUnassigned");
  const paid = Boolean(draft.paymentMethodCode);
  const paymentLabel = paid ? t("calls.line.paid") : t("calls.line.unpaid");
  const paymentMethodLabel = draft.paymentMethodCode ? optionLabel(options.paymentMethods, draft.paymentMethodCode) : null;
  // 칩은 머리("결제") 아래라 짧게 쓴다(2026-10-23). 다 쓴 말은 칸의 title과 목록 항목에 남는다.
  const paymentBadge = <StatusIndicator label={paid ? paymentLabel : t("calls.line.unpaidShort")} size="sm" tone={paid ? "success" : "warning"} />;
  const discountText = draft.discountTypeCode ? optionLabel(options.discountTypes, draft.discountTypeCode) || draft.discountTypeCode : t("calls.line.noDiscount");
  const statusChip = statusKey ? (
    <CallStatusChip label={statusLabel} size="sm" status={statusKey} />
  ) : (
    <StatusIndicator label={statusLabel} size="sm" tone="neutral" />
  );
  const timeEditClass = "text-base font-semibold";
  // 줄(과 예약시간 버튼)을 누르면 편집 패널이 열리고, 열린 줄을 다시 누르면 닫힌다(2026-10-23 고객 요청).
  const toggle = () => (selected ? onClose() : onOpen(row.id));

  return (
    // 편집 패널이 열린 줄은 선택된 줄 모양이다(design.md 6.6). 버튼이 아닌 자리를 눌러도 패널이 열린다.
    // 원장 폭이 넓으면 시안(111.png)처럼 한 줄 11칸, 좁으면 두 줄, 휴대폰 폭이면 여러 줄로 같은 칸을 접는다(ledgerLineAreas).
    <li
      className={`grid cursor-pointer items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2.5 transition-colors hover:bg-readonly data-[selected=true]:bg-readonly @[81rem]:py-0 ${ledgerWideSpacing} ${ledgerLineAreas} ${party ? `${partyBarClass} ${selectedPartyBarClass}` : selectedBarClass}`}
      data-ledger-line=""
      data-ledger-party-member={party ? (row.partyId ?? undefined) : undefined}
      data-selected={selected}
      data-service-call-id={row.id}
      hidden={hidden}
      id={ledgerCallAnchorId(row.id)}
      onClick={(event) => {
        // 칸 안 목록은 body에 그리지만 React 이벤트는 이 줄까지 올라온다. 줄 안에서 누른 것만 패널을 연다.
        if (!event.currentTarget.contains(event.target as Node)) return;
        if ((event.target as HTMLElement).closest("button, a, input")) return;
        toggle();
      }}
    >
      <span className={`flex items-center ${wideCenterFlex} [grid-area:time] ${wideCellClass}`} data-line-cell="time">
        <button
          aria-label={t("calls.detail.rowAria", { time })}
          className="min-h-11 rounded-sm px-1 text-lg font-semibold text-foreground [font-variant-numeric:tabular-nums] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
          aria-expanded={selected}
          data-call-open={row.id}
          onClick={toggle}
          type="button"
        >
          {time}
        </button>
      </span>
      <span
        className={`grid min-w-0 content-center justify-items-start ${wideCenterGrid} text-sm text-foreground [font-variant-numeric:tabular-nums] [grid-area:entry] ${lineCellClass}`}
        data-line-cell="entry"
        data-line-clock={end.kind}
      >
        {end.kind === "notEntered" ? (
          <span className="w-fit whitespace-nowrap rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">{t("calls.line.notEntered")}</span>
        ) : draft.actualEntryTime ? (
          <LedgerTimeEdit
            disabled={isLocked}
            label={t("calls.line.entryEditAria", { time })}
            onCommit={(value) => commit({ actualEntryTime: value })}
            readOnly={readOnly}
            value={draft.actualEntryTime}
          >
            <span className={timeEditClass}>{draft.actualEntryTime}</span>
          </LedgerTimeEdit>
        ) : (
          <span className="text-muted">-</span>
        )}
        {/* 늦음 칩("Trễ 30 phút")은 입장 칸이 최소 폭(5.5rem)일 때 한 줄로 두면 종료 칸을 덮어서, 칸 안에서 줄을 바꾼다. */}
        {late ? (
          <StatusIndicator className="max-w-full whitespace-normal leading-tight" label={t("calls.line.late", { minutes: late })} size="sm" tone="warning" />
        ) : null}
      </span>
      <span className={`flex min-w-0 items-center ${wideCenterFlex} text-sm text-foreground [font-variant-numeric:tabular-nums] [grid-area:end] ${lineCellClass}`} data-line-cell="end">
        {end.kind === "notEntered" ? (
          <span className="text-muted">-</span>
        ) : end.kind === "expected" ? (
          // 베트남어 "Dự kiến 13:00"은 5.5rem 칸을 넘을 수 있어 옆 칸을 덮지 않고 두 줄로 접는다.
          <span className="text-faint">{t("calls.line.expectedEnd", { time: end.time })}</span>
        ) : (
          <LedgerTimeEdit
            disabled={isLocked}
            label={t("calls.line.endEditAria", { time })}
            onCommit={(value) => commit({ actualEndTime: value })}
            readOnly={readOnly}
            value={end.time}
          >
            <span className={timeEditClass}>{end.time}</span>
          </LedgerTimeEdit>
        )}
      </span>
      <span className={`flex w-full min-w-0 items-center gap-2.5 ${wideStartPadding} [grid-area:who] ${lineCellClass}`} data-line-cell="who" data-line-who="">
        <BookingChannelIcon channel={draft.bookingChannelCode ?? who.channel ?? ""} className="h-9 w-9 shrink-0" />
        <span className="grid min-w-0">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate text-sm font-semibold text-foreground" title={who.name ?? undefined}>
              {who.name ?? <span className="text-muted">-</span>}
            </span>
            {party ? <span className="shrink-0 text-xs text-muted">{t("calls.party.position", party)}</span> : null}
          </span>
          {contact ? (
            <span className="min-w-0 truncate text-xs text-muted" title={contact}>
              {contact}
            </span>
          ) : null}
        </span>
      </span>
      <span className={`grid w-full min-w-0 content-center @[81rem]:text-center [grid-area:course] ${lineCellClass}`} data-line-cell="course" title={courseLabel}>
        <span className="truncate text-sm font-semibold text-foreground">
          {courseMinutes ? t("calls.line.courseMinutes", { code: courseCode, minutes: courseMinutes }) : courseCode}
        </span>
        <span className="truncate text-xs text-muted">{courseName}</span>
      </span>
      {readOnly ? (
        <>
          <span className="w-full min-w-0 truncate text-sm [grid-area:therapist]" data-line-cell="therapist" title={[therapist1Text, therapist2Text].filter(Boolean).join(" · ")}>
            {[therapist1Text, therapist2Text].filter(Boolean).join(" · ")}
          </span>
          <span className="w-full min-w-0 truncate text-sm [grid-area:room]" data-line-cell="room" title={roomText}>
            {roomText}
          </span>
        </>
      ) : (
        <>
          {/* 두 번째 Therapist가 있으면 시안처럼 두 칸을 나란히 둔다. */}
          <span className={`flex w-full min-w-0 items-center gap-1 ${wideCenterFlex} [grid-area:therapist] ${lineCellClass}`} data-line-cell="therapist">
            <LedgerCellPicker
              className={therapist2Text ? `${pickerFieldClass} px-2` : pickerFieldClass}
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              failedText={therapistChoicesFailed ? t("calls.cell.failed") : null}
              field="therapist1Id"
              label={t("calls.cell.therapistAria", { time })}
              loadingText={t("calls.cell.loading")}
              onOpen={() => void loadTherapistChoices()}
              onPick={(value) => pickTherapist(value, "therapist1Id")}
              options={therapistOptions}
              title={therapist1Text}
              value={draft.therapist1Id ?? ""}
            >
              {therapist1Text}
            </LedgerCellPicker>
            {showSecondTherapist ? (
              <LedgerCellPicker
                className={`${pickerFieldClass} px-2`}
                disabled={isLocked}
                emptyText={t("calls.cell.empty")}
                failedText={therapistChoicesFailed ? t("calls.cell.failed") : null}
                field="therapist2Id"
                label={t("calls.cell.therapist2Aria", { time })}
                loadingText={t("calls.cell.loading")}
                onOpen={() => void loadTherapistChoices()}
                onPick={(value) => pickTherapist(value, "therapist2Id")}
                options={therapistOptions?.filter((option) => !option.value || option.value !== draft.therapist1Id) ?? null}
                title={therapist2Text ?? undefined}
                value={draft.therapist2Id ?? ""}
              >
                {therapist2Text}
              </LedgerCellPicker>
            ) : null}
          </span>
          <span className={`flex w-full min-w-0 items-center ${wideCenterFlex} [grid-area:room] ${lineCellClass}`} data-line-cell="room">
            <LedgerCellPicker
              className={pickerFieldClass}
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              field="roomId"
              label={t("calls.cell.roomAria", { time })}
              loadingText={t("calls.cell.loading")}
              onPick={(value) => commit({ roomId: nullableValue(value) })}
              options={roomOptions}
              title={roomText}
              value={draft.roomId ?? ""}
            >
              {roomText}
            </LedgerCellPicker>
          </span>
        </>
      )}
      <span className={`flex min-w-0 flex-wrap content-center items-center gap-1 @[81rem]:flex-col @[81rem]:flex-nowrap @[81rem]:justify-center [grid-area:status] ${lineCellClass}`} data-line-cell="status">
        {/* 경고 칩은 상태 칩 오른쪽에 한 줄로 붙고, 둘을 한 묶음으로 칸 가운데에 둔다(2026-10-23 고객 요청 ledger-grid-request-1023.png).
            예전에는 칩 아래에 두어 경고가 있는 줄만 높아졌다. 가장 긴 베트남어 칩("Đang sử dụng ▾" 133px)과 경고 칩은 상태 칸 최소 폭
            (8.5rem)에 함께 들어가지 않아, 그때만 경고가 아래로 내려간다(칩 글자를 말줄임으로 자르지 않는다). */}
        <span className="inline-flex min-w-0 max-w-full flex-wrap items-center justify-center gap-1" data-line-status-group="">
          {readOnly ? (
            statusChip
          ) : (
            <LedgerCellPicker
              className="h-10 border-transparent px-1"
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              field="status"
              label={t("calls.cell.statusAria", { time })}
              loadingText={t("calls.cell.loading")}
              onPick={changeStatus}
              options={options.statuses}
              title={statusLabel}
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
        </span>
        {/* 한 줄 표는 상태 묶음을 칸 가운데에 두므로(세로로 쌓은 칸에서 items-center가 가로 가운데다), 저장 표시가 칩 옆에
            붙으면 칩이 저장할 때마다 옆으로 밀린다. 그래서 한 줄 표에서는 묶음 아래에 둔다. 저장 표시가 없으면 자리도 비우지 않는다. */}
        <span className="@[81rem]:empty:hidden" data-line-save-state={saveStatus}>
          {saveStatus === "saving" || isSaveHeld(saveStatus) ? <SaveStatus locale={locale} state={saveStatus === "saving" ? "saving" : saveStatus} /> : null}
        </span>
      </span>
      <span className={`flex w-full min-w-0 items-center ${wideCenterFlex} [grid-area:discount] ${lineCellClass}`} data-line-cell="discount">
        {readOnly ? (
          <span className="min-w-0 truncate text-sm" title={discountText}>
            {discountText}
          </span>
        ) : (
          <LedgerCellPicker
            className={pickerFieldClass}
            disabled={isLocked}
            emptyText={t("calls.cell.empty")}
            field="discountTypeCode"
            label={t("calls.cell.discountAria", { time })}
            loadingText={t("calls.cell.loading")}
            onPick={(value) => commit({ discountTypeCode: nullableValue(value) })}
            options={[...options.discountTypes, { value: "", label: t("calls.line.noDiscount") }]}
            title={discountText}
            value={draft.discountTypeCode ?? ""}
          >
            {discountText}
          </LedgerCellPicker>
        )}
      </span>
      <span
        className={`grid min-w-0 content-center justify-items-start ${wideCenterGrid} [grid-area:pay] ${lineCellClass}`}
        data-line-cell="pay"
        title={paymentMethodLabel ? `${paymentLabel} · ${paymentMethodLabel}` : paymentLabel}
      >
        {readOnly ? (
          paymentBadge
        ) : (
          // 결제 배지(스펙 D12): 누르면 결제수단 목록이 뜨고, 고르는 즉시 결제수단만 저장한다. 상태는 바꾸지 않는다.
          <LedgerCellPicker
            className="h-10 border-transparent px-1"
            disabled={isLocked}
            emptyText={t("calls.cell.empty")}
            field="paymentMethodCode"
            label={t("calls.cell.paymentAria", { time })}
            loadingText={t("calls.cell.loading")}
            onPick={(value) => commit({ paymentMethodCode: nullableValue(value) })}
            options={[...options.paymentMethods, { value: "", label: t("calls.line.unpaid") }]}
            title={paymentLabel}
            value={draft.paymentMethodCode ?? ""}
          >
            {paymentBadge}
          </LedgerCellPicker>
        )}
        {paymentMethodLabel ? <span className="max-w-full truncate px-1 text-xs text-muted">{paymentMethodLabel}</span> : null}
      </span>
      <span className={`flex w-full min-w-0 items-center justify-end ${wideCenterFlex} [grid-area:action] ${lineCellClass}`} data-line-cell="action">
        {/* 휴대폰 폭은 읽기 전용이라(티켓 26) 주 버튼을 두지 않는다. */}
        {readOnly || !action ? null : action === "enter" ? (
          <Button
            aria-label={t("calls.list.enterAria", { time })}
            className={`${actionButtonClass} bg-info text-info-foreground hover:bg-info`}
            disabled={isLocked || !inUse}
            onClick={() => enter()}
            type="button"
          >
            {t("calls.list.enter")}
          </Button>
        ) : action === "finish" ? (
          <Button
            aria-label={t("calls.list.finishAria", { time })}
            className={`${actionButtonClass} bg-danger text-danger-foreground hover:bg-danger`}
            disabled={isLocked || !cleaning}
            onClick={finish}
            type="button"
          >
            {t("calls.list.finish")}
          </Button>
        ) : (
          // 청소 끝(시안 444.png): 앞 버튼은 바로 방문완료, ▾는 청소 끝·종료 취소를 고르는 목록이다.
          <span className="inline-flex w-full max-w-36 items-stretch rounded-full border border-border-strong">
            <Button
              aria-label={t("calls.list.cleanDoneAria", { time })}
              className="min-w-0 flex-1 justify-center rounded-l-full rounded-r-none px-3"
              disabled={isLocked || !visitComplete}
              onClick={() => visitComplete && commit({ status: visitComplete })}
              type="button"
              variant="ghost"
            >
              <span className="text-sm font-semibold text-foreground">{t("calls.list.cleanDone")}</span>
            </Button>
            <LedgerCellPicker
              className="h-11 rounded-l-none rounded-r-full border-0 border-l border-l-border px-2.5"
              disabled={isLocked}
              emptyText={t("calls.cell.empty")}
              field="cleaningAction"
              label={t("calls.list.cleaningMenuAria", { time })}
              loadingText={t("calls.cell.loading")}
              onPick={(value) => {
                if (value === "cleanDone" && visitComplete) commit({ status: visitComplete });
                if (value === "cancelFinish") cancelFinish();
              }}
              options={[
                // 기준정보에 상태 코드가 없으면 그 항목은 두지 않는다(앞 버튼도 꺼진다).
                ...(visitComplete ? [{ value: "cleanDone", label: t("calls.list.cleanDoneVisit") }] : []),
                ...(inUse ? [{ value: "cancelFinish", label: t("calls.list.cancelFinish") }] : [])
              ]}
              value=""
            >
              {null}
            </LedgerCellPicker>
          </span>
        )}
      </span>
      {pickingRoom ? (
        <div
          aria-label={t("calls.list.pickRoomAria", { time })}
          className="flex flex-wrap items-center gap-2 rounded-sm bg-readonly px-2 py-2 [grid-column:1/-1]"
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
          if (pendingOverride) commit({ [pendingOverride.slot]: pendingOverride.therapistId });
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
  positionOf,
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
  /** 콜이 이 일행(같은 시각)에서 몇 번째 손님인지. */
  positionOf: (callId: string) => number;
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
    // 객실 칸은 네이티브 select가 아니라 공용 listbox(role=combobox) 버튼이다.
    if (picking) pickerRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.focus();
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
                    <ListboxSelect
                      className="w-40"
                      onChange={(nextValue) =>
                        setRooms((current) => {
                          const next = { ...current };
                          if (nextValue) next[target.callId] = nextValue;
                          else delete next[target.callId];
                          return next;
                        })
                      }
                      options={[
                        {
                          label: choices.length === 0 ? t("calls.list.noFreeRoom") : t("calls.party.roomPlaceholder"),
                          value: ""
                        },
                        ...choices.map((room) => ({ label: room.label, value: room.value }))
                      ]}
                      triggerProps={{ "data-party-entry-room": target.callId }}
                      value={rooms[target.callId] ?? ""}
                    />
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
  onClose = () => {},
  onOpen = () => {},
  onRowSaved = () => {},
  onSelectRelated = () => {},
  options,
  panelFocus = null,
  panelHost = null,
  phoneWidth,
  rows,
  selectedCallId = null,
  showSettlementAmounts,
  therapistFilter = null
}: {
  /** 시계를 정해 줄 때(테스트). 없으면 이 기기의 시계를 영업 시간대로 읽는다. */
  clock?: LedgerClock | null;
  /** 휴대폰 폭인지 정해 줄 때(테스트). 없으면 이 기기의 화면 폭을 읽는다. */
  phoneWidth?: boolean;
  customers?: CustomerDto[];
  isLocked: boolean;
  /** 열린 편집 패널을 닫는다(고른 줄을 다시 누를 때). */
  onClose?: () => void;
  onOpen?: OpenCall;
  /** 한 줄의 저장이 받아들여졌을 때. 현황 줄 같은 나머지 화면을 새로 고치는 데 쓴다. */
  onRowSaved?: (row: ServiceCallRowDto) => void;
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
  const livePhoneWidth = usePhoneWidth();
  const isPhoneWidth = phoneWidth ?? livePhoneWidth;
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
  // 일행 동작(티켓 04): 일행(ledgerFlowItems의 key)마다 마지막으로 보낸 일과, 일행 콜 줄들이 알려 온 저장 상태.
  const [partyCommands, setPartyCommands] = useState<Record<string, PartyCommand>>({});
  const [partyOutcomes, setPartyOutcomes] = useState<Record<string, PartyCommandOutcome>>({});
  function sendPartyCommand(key: string, action: PartyAction) {
    setPartyCommands((current) => ({ ...current, [key]: { ...action, token: (current[key]?.token ?? 0) + 1 } }));
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
  const line = (row: ServiceCallRowDto, party: { key: string; position: number; size: number } | null, hidden: boolean) => (
    <CallLedgerLine
      clock={lineClock}
      customers={customers}
      dayStart={dayStart}
      hidden={hidden || filteredOut(row)}
      isLocked={isLocked}
      key={row.id}
      onClose={onClose}
      onOpen={onOpen}
      onPartyOutcome={reportPartyOutcome}
      onSaved={onRowSaved}
      onSelectRelated={onSelectRelated}
      options={options}
      panelFocus={row.id === selectedCallId ? panelFocus : null}
      panelHost={panelHost}
      party={party ? { position: party.position, size: party.size } : null}
      partyCommand={party ? (partyCommands[party.key] ?? null) : null}
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
      const { key, partyId, size, lead, positionOf } = item;
      const first = !headedParties.has(key);
      headedParties.add(key);
      const command = partyCommands[key];
      const failures =
        first && command
          ? command.callIds.flatMap((callId) => {
              const outcome = partyOutcomes[callId];
              if (outcome?.token !== command.token || !isSaveHeld(outcome.status)) return [];
              return [{ position: positionOf(callId), message: outcome.message }];
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
            key={`party-${part}-${key}`}
            lead={lead}
            onAdd={() =>
              requestQuickBookingJoinParty({
                partyId,
                serviceDate: lead.serviceDate,
                startTime: lead.startTime,
                customerMemo: lead.customerMemo,
                bookingChannelCode: lead.bookingChannelCode,
                bookerName: lead.bookerName,
                bookerHandle: lead.bookerHandle,
                size
              })
            }
            onCancel={(callIds) => sendPartyCommand(key, { kind: "cancel", callIds })}
            onEnter={(callIds, rooms) => sendPartyCommand(key, { kind: "enter", callIds, rooms })}
            options={options}
            part={part}
            positionOf={positionOf}
            readOnly={isPhoneWidth}
            rows={rows}
            sectionRows={item.rows}
            size={size}
          />,
          ...item.rows.map((row) => line(row, { key, position: positionOf(row.id), size }, hidden))
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
    <section className="@container overflow-hidden rounded-md border border-border bg-surface">
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
      {/* 한 줄 11칸일 때만 표 머리처럼 칸 이름을 둔다(design.md 6.6의 머리 모양). 줄과 같은 열을 쓴다. */}
      {rows.length > 0 ? (
        <div
          aria-hidden="true"
          className={`hidden border-b border-grid-line bg-readonly text-xs text-foreground @[81rem]:grid ${ledgerWideColumns} ${ledgerWideSpacing}`}
          data-ledger-head=""
        >
          {LEDGER_HEAD_KEYS.map((key, index) => (
            // 머리 글자는 가운데 정렬·굵게(2026-10-23 시안 123.png). 고객 정보만 그 칸처럼 왼쪽 여백에서 시작한다.
            <span
              className={[headCellClass, index > 0 ? wideDividerClass : "", key === "calls.list.head.customer" ? wideStartHeadClass : ""].filter(Boolean).join(" ")}
              key={key}
              title={t(key)}
            >
              {t(key)}
            </span>
          ))}
        </div>
      ) : null}
      {/* 콜이 없어도 목록은 그대로 둔다 — 빠른 예약으로 첫 콜을 만들면 같은 자리에 줄이 생긴다. 휴대폰 폭도 같은
          칸을 접은 행이다(스펙 D9). 줄의 열은 화면 폭이 아니라 원장 폭을 따른다(편집·빠른 예약 패널이 열리면 좁아진다). */}
      <ol aria-label={t("calls.list.aria")} className="grid min-w-0" data-call-ledger-list="" hidden={rows.length === 0}>
        {body}
      </ol>
    </section>
  );
}
