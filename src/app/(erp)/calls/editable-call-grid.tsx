"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerDto, ServiceCallCalculationStatus, ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import {
  autosaveServiceCallRowAction,
  reloadServiceCallRowAction,
  saveBasicServiceCallRowAction,
  type ServiceCallActionState
} from "@/app/(erp)/calls/actions";
import type { AvailabilityCourseChoice } from "@/app/(erp)/calls/therapist-availability-view";
import { calculationErrorMessageKey } from "@/app/(erp)/calls/calculation-status-message";
import {
  callRowSaveReducer,
  isSaveHeld,
  initialCallRowSave,
  type CallRowDraft,
  type RowSaveStatus
} from "@/app/(erp)/calls/call-row-save";
import { CallRowSaveStatus } from "@/app/(erp)/calls/call-row-save-status";
import { CallPhoneCardList } from "@/app/(erp)/calls/call-phone-card-list";
import { ledgerCallAnchorId, type LedgerView } from "@/app/(erp)/calls/ledger-address";
import { CallWarningCell } from "@/app/(erp)/calls/call-warning-cell";
import { spokenClock } from "@/app/(erp)/calls/call-warning-label";
import {
  EDITABLE_CALL_FIELDS,
  isEditableCallField,
  moveAdjacentCell,
  moveEnterCell,
  moveTabCell,
  type ArrowNavigationKey,
  type EditableCallField
} from "@/app/(erp)/calls/call-ledger-keyboard";

type FieldErrors = Record<string, string[]>;

// Shared fixed column widths so the data table and the add-row table align
// column-for-column. `id` is a stable English key (React key); `labelKey` points
// at the localized header text in the message catalog.
const CALL_GRID_COLUMNS = [
  { id: "date", labelKey: "calls.column.date", width: "5.5rem" },
  { id: "time", labelKey: "calls.column.time", width: "9rem" },
  { id: "actualEntry", labelKey: "calls.column.actualEntry", width: "12rem" },
  { id: "room", labelKey: "calls.column.room", width: "9rem" },
  { id: "course", labelKey: "calls.column.course", width: "10rem" },
  { id: "customerMemo", labelKey: "calls.column.customerMemo", width: "12rem" },
  { id: "customer", labelKey: "calls.column.customer", width: "14rem" },
  { id: "therapist1", labelKey: "calls.column.therapist1", width: "9rem" },
  { id: "therapist2", labelKey: "calls.column.therapist2", width: "9rem" },
  { id: "earcare", labelKey: "calls.column.earcare", width: "9rem" },
  { id: "reservationStatus", labelKey: "calls.column.reservationStatus", width: "8rem" },
  { id: "discountType", labelKey: "calls.column.discountType", width: "9rem" },
  { id: "paymentMethod", labelKey: "calls.column.paymentMethod", width: "9rem" },
  { id: "note", labelKey: "calls.column.note", width: "11rem" },
  { id: "confirmation", labelKey: "calls.column.confirmation", width: "9rem" },
  { id: "paymentAmount", labelKey: "calls.column.paymentAmount", width: "8rem" },
  { id: "discount", labelKey: "calls.column.discount", width: "6rem" },
  { id: "therapist1Commission", labelKey: "calls.column.therapist1Commission", width: "7rem", settlement: true },
  { id: "therapist2Commission", labelKey: "calls.column.therapist2Commission", width: "7rem", settlement: true },
  { id: "earcarePool", labelKey: "calls.column.earcarePool", width: "6.5rem", settlement: true },
  { id: "opsCallCredit", labelKey: "calls.column.opsCallCredit", width: "6rem", settlement: true },
  { id: "warnings", labelKey: "calls.column.warnings", width: "13rem" },
  { id: "saveStatus", labelKey: "calls.column.saveStatus", width: "10rem" }
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey; width: string; settlement?: boolean }>;

// 원장 보기 세 가지(명세 F02, 티켓 19)의 열 묶음. date·saveStatus는 보기와 무관하게 항상 있고,
// time·customerMemo·reservationStatus는 모든 보기에서 이 자리(앞쪽)에 고정된다. all은 보기가 없던
// 때의 순서 그대로 둔다(기존 E2E의 키보드 이동 순서를 그대로 지키기 위해 다시 묶지 않는다).
const LEDGER_VIEW_COLUMN_IDS = {
  booking: [
    "date",
    "time",
    "customerMemo",
    "reservationStatus",
    "actualEntry",
    "room",
    "course",
    "therapist1",
    "therapist2",
    "earcare",
    "warnings",
    "saveStatus"
  ],
  settlement: [
    "date",
    "time",
    "customerMemo",
    "reservationStatus",
    "discountType",
    "paymentMethod",
    "paymentAmount",
    "confirmation",
    "note",
    "therapist1Commission",
    "therapist2Commission",
    "earcarePool",
    "opsCallCredit",
    "saveStatus"
  ],
  all: CALL_GRID_COLUMNS.map((column) => column.id)
} as const satisfies Record<LedgerView, readonly (typeof CALL_GRID_COLUMNS)[number]["id"][]>;

// 각 열 머리 id가 쓰는 실제 필드 이름(EditableCallField나 읽기전용 계산 필드). date·warnings는 이
// 커스텀 키보드 이동 체계 밖(날짜는 글자뿐, 경고는 CallWarningCell의 네이티브 버튼)이라 null이다.
const CALL_GRID_COLUMN_FIELD: Record<(typeof CALL_GRID_COLUMNS)[number]["id"], string | null> = {
  date: null,
  time: "startTime",
  actualEntry: "actualEntryTime",
  room: "roomId",
  course: "courseId",
  customerMemo: "customerMemo",
  customer: "customerId",
  therapist1: "therapist1Id",
  therapist2: "therapist2Id",
  earcare: "earcareEmployeeId",
  reservationStatus: "status",
  discountType: "discountTypeCode",
  paymentMethod: "paymentMethodCode",
  note: "note",
  confirmation: "confirmationCode",
  paymentAmount: "paymentAmount",
  discount: "discountAmount",
  therapist1Commission: "therapist1Commission",
  therapist2Commission: "therapist2Commission",
  earcarePool: "earcarePoolAmount",
  opsCallCredit: "opsCallCredit",
  warnings: null,
  saveStatus: "calculationStatus"
};

function visibleCallGridColumns(view: LedgerView, showSettlementColumns: boolean) {
  const columnById = new Map(CALL_GRID_COLUMNS.map((column) => [column.id, column] as const));
  return LEDGER_VIEW_COLUMN_IDS[view]
    .map((id) => columnById.get(id))
    .filter((column): column is (typeof CALL_GRID_COLUMNS)[number] => column !== undefined)
    .filter((column) => showSettlementColumns || !("settlement" in column && column.settlement));
}

/** 보이는 열의 너비 합. 보기마다 열 수가 달라 더 이상 고정값 하나로 둘 수 없다. */
function callGridMinWidth(view: LedgerView, showSettlementColumns: boolean) {
  const total = visibleCallGridColumns(view, showSettlementColumns).reduce((sum, column) => sum + Number.parseFloat(column.width), 0);
  return `${total}rem`;
}

/** 키보드 이동 순서(편집 칸 + 읽기전용 계산 칸)는 보이는 열의 순서를 따른다(명세 F02 기준). */
function navigableFieldsForView(view: LedgerView, showSettlementColumns: boolean): string[] {
  return visibleCallGridColumns(view, showSettlementColumns)
    .map((column) => CALL_GRID_COLUMN_FIELD[column.id])
    .filter((field): field is string => field !== null);
}

function editableFieldsForView(view: LedgerView, showSettlementColumns: boolean): EditableCallField[] {
  return navigableFieldsForView(view, showSettlementColumns).filter(isEditableCallField);
}

function CallGridColgroup({ showSettlementColumns, view }: { showSettlementColumns: boolean; view: LedgerView }) {
  return (
    <colgroup>
      {visibleCallGridColumns(view, showSettlementColumns).map((column) => (
        <col key={column.id} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

function CallGridHead({ showSettlementColumns, view }: { showSettlementColumns: boolean; view: LedgerView }) {
  const t = useT();
  return (
    <thead className="bg-readonly text-xs font-semibold text-foreground">
      <tr>
        {visibleCallGridColumns(view, showSettlementColumns).map((column) => (
          <th className="whitespace-nowrap border-b border-border px-2 py-2 align-middle" key={column.id}>
            {t(column.labelKey)}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function fieldError(state: ServiceCallActionState, field: string) {
  if (!state || state.ok) {
    return null;
  }
  return state.fieldErrors?.[field]?.[0] ?? null;
}

function InlineError({ state, field }: { state: ServiceCallActionState; field?: string }) {
  if (!state || state.ok) {
    return null;
  }

  const message = field ? fieldError(state, field) : state.formError;
  if (!message) {
    return null;
  }

  return (
    <span className="text-xs text-danger" role="alert">
      {message}
    </span>
  );
}

function FieldErrorMessage({ id, message }: { id: string; message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <span className="flex items-start gap-1 text-xs font-medium text-danger" id={id} role="alert">
      <span aria-hidden="true" className="font-bold">
        !
      </span>
      <span>{message}</span>
    </span>
  );
}

function focusLedgerCell(rowIndex: number, columnId: string) {
  window.requestAnimationFrame(() => {
    const selector = `[data-call-cell-row="${rowIndex}"][data-call-cell-column="${columnId}"]`;
    const target = document.querySelector<HTMLElement>(selector);
    target?.focus();
    target?.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
}

function optionLabel(options: ServiceCallOption[], value: string | null | undefined, emptyLabel = "") {
  if (!value) return emptyLabel;
  return options.find((option) => option.value === value)?.label ?? "";
}

type ListboxPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "below" | "above";
};

const LISTBOX_MAX_HEIGHT = 240; // px, matches the prior max-h-60-ish popup cap.
const LISTBOX_GAP = 4; // px gap between the input and the popup.

// The grid lives inside an `overflow-x-auto` scroll container, which clips any
// absolutely-positioned popup. Anchoring the listbox to the input's viewport
// rect (rendered through a portal) lets it escape the clip, and flipping it
// above the input near the bottom of the page keeps options visible without
// scrolling.
function measureListboxPosition(anchor: HTMLElement): ListboxPosition {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - LISTBOX_GAP;
  const spaceAbove = rect.top - LISTBOX_GAP;
  const openAbove = spaceBelow < Math.min(LISTBOX_MAX_HEIGHT, spaceAbove) && spaceAbove > spaceBelow;
  const maxHeight = Math.max(120, Math.min(LISTBOX_MAX_HEIGHT, openAbove ? spaceAbove : spaceBelow));
  return {
    left: rect.left,
    top: openAbove ? rect.top - LISTBOX_GAP : rect.bottom + LISTBOX_GAP,
    width: rect.width,
    maxHeight,
    placement: openAbove ? "above" : "below"
  };
}

// Tracks the popup position relative to its anchor. The initial measurement is
// taken by the listbox's own callback ref (`measureRef`) on mount, and scroll /
// resize listeners keep it pinned while open — keeping all setState calls in
// event callbacks rather than synchronously inside an effect body.
function useListboxPosition(anchor: HTMLElement | null, open: boolean) {
  const [position, setPosition] = useState<ListboxPosition | null>(null);

  const measureRef = useCallback(
    (node: HTMLElement | null) => {
      if (node && anchor) {
        setPosition(measureListboxPosition(anchor));
      }
    },
    [anchor]
  );

  useLayoutEffect(() => {
    if (!open || !anchor) {
      return;
    }
    const update = () => setPosition(measureListboxPosition(anchor));
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      setPosition(null);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, anchor]);

  return { position: open ? position : null, measureRef };
}

function SelectCell({
  columnId,
  describedBy,
  disabled,
  defaultValue,
  rowIndex,
  label,
  name,
  emptyLabel,
  onBlur,
  onChange,
  onCommitValue,
  onGridKeyDown,
  options,
  required,
  tall,
  value,
  errorId,
  errorMessage
}: {
  columnId?: string;
  describedBy?: string;
  disabled: boolean;
  defaultValue?: string;
  errorId?: string;
  errorMessage?: string | null;
  label: string;
  name: string;
  emptyLabel?: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCommitValue?: (value: string) => void;
  onGridKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  options: ServiceCallOption[];
  required?: boolean;
  rowIndex?: number;
  tall?: boolean;
  value?: string;
}) {
  const t = useT();
  const invalid = Boolean(errorMessage);
  const describedByIds = [describedBy, invalid && errorId ? errorId : null].filter(Boolean).join(" ");
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = isControlled ? (value ?? "") : internalValue;
  const [inputValue, setInputValue] = useState(() => optionLabel(options, selectedValue, emptyLabel));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const skipNextBlurCommit = useRef(false);
  // 언어 전환(router.refresh) 등으로 options의 표시 라벨이나 selectedValue가 바뀌면,
  // 팝업이 닫혀 있고 사용자가 입력 중이 아닐 때 표시값을 현재 라벨로 다시 동기화한다.
  const resolvedLabel = optionLabel(options, selectedValue, emptyLabel);
  useEffect(() => {
    if (!open) {
      setInputValue(resolvedLabel);
    }
    // open 중에는 사용자의 타이핑/필터를 덮어쓰지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedLabel, open]);
  const [inputEl, setInputEl] = useState<HTMLInputElement | null>(null);
  const { position: listboxPosition, measureRef } = useListboxPosition(inputEl, open);
  const filteredOptions = options.filter((option) => {
    const query = inputValue.trim().toLowerCase();
    if (!query) return true;
    return `${option.label} ${option.value}`.toLowerCase().includes(query);
  });
  const activeOption = filteredOptions[Math.min(activeIndex, Math.max(filteredOptions.length - 1, 0))];

  function selectOption(option: ServiceCallOption | null, commit: boolean) {
    const nextValue = option?.value ?? "";
    const nextLabel = option?.label ?? emptyLabel ?? "";
    setInputValue(nextLabel);
    setOpen(false);
    setActiveIndex(0);
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
    if (commit) {
      skipNextBlurCommit.current = true;
      onCommitValue?.(nextValue);
    }
  }

  // 표시값은 팝업이 닫힐 때 위 effect가 지금 고른 값의 라벨로 되돌린다. 여기서 라벨을 직접 넣으면
  // blur 지연(120ms) 사이에 바깥에서 바뀐 값(다시 불러오기 등)을 그 전 값으로 덮는다.
  function closeAndRestore() {
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => {
        const next = current + direction;
        return Math.min(Math.max(next, 0), Math.max(filteredOptions.length - 1, 0));
      });
      return;
    }

    if (open && event.key === "Enter") {
      event.preventDefault();
      if (!activeOption) {
        // No filtered match: close the popup without wiping the existing value.
        closeAndRestore();
        return;
      }
      selectOption(activeOption, true);
      return;
    }

    if (open && event.key === "Escape") {
      event.preventDefault();
      closeAndRestore();
      return;
    }

    if (event.key === "ArrowDown" && !open) {
      setOpen(true);
      return;
    }

    onGridKeyDown?.(event);
  }

  return (
    <label className="grid w-full gap-1">
      <span className="sr-only">{label}</span>
      <input
        aria-activedescendant={open && activeOption ? `${reactId}-option-${activeOption.value}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={describedByIds || undefined}
        aria-expanded={open}
        aria-invalid={invalid ? "true" : undefined}
        aria-label={label}
        autoComplete="off"
        className={`${tall ? "h-11" : "h-8"} w-full border bg-background px-2 text-xs text-foreground outline-none disabled:bg-readonly ${
          invalid ? "border-danger ring-1 ring-danger focus:border-danger" : "border-border focus:border-brand"
        }`}
        data-call-cell-column={columnId}
        data-call-cell-row={rowIndex}
        disabled={disabled}
        id={`${reactId}-input`}
        onBlur={() => {
          window.setTimeout(() => {
            closeAndRestore();
            if (skipNextBlurCommit.current) {
              skipNextBlurCommit.current = false;
              return;
            }
            onBlur?.();
          }, 120);
        }}
        onChange={(event) => {
          setInputValue(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onClick={() => {
          // Pointer activation opens the full option list immediately. Clearing
          // the query shows every option (not just the current value); the prior
          // value is restored on blur if nothing new is picked. Keyboard focus
          // deliberately does not auto-open so arrow keys keep navigating between
          // grid cells (ArrowDown still opens the list — see handleKeyDown).
          setInputValue("");
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setInputValue(optionLabel(options, selectedValue, emptyLabel));
          event.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        ref={setInputEl}
        role="combobox"
        required={required}
        value={inputValue}
      />
      <input name={name} type="hidden" value={selectedValue} />
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              className="fixed z-50 overflow-auto border border-border bg-surface text-xs shadow-lg"
              id={listboxId}
              ref={measureRef}
              role="listbox"
              style={
                listboxPosition
                  ? {
                      left: listboxPosition.left,
                      width: listboxPosition.width,
                      maxHeight: listboxPosition.maxHeight,
                      ...(listboxPosition.placement === "above"
                        ? { bottom: window.innerHeight - listboxPosition.top }
                        : { top: listboxPosition.top })
                    }
                  : { visibility: "hidden", top: 0, left: 0 }
              }
            >
          {!required ? (
            <li
              aria-selected={selectedValue === ""}
              className="cursor-pointer px-2 py-1.5 hover:bg-readonly"
              id={`${reactId}-option-empty`}
              onMouseDown={(event) => {
                event.preventDefault();
                selectOption(null, Boolean(onCommitValue));
              }}
              role="option"
            >
              -
            </li>
          ) : null}
          {filteredOptions.map((option, index) => (
            <li
              aria-selected={option.value === selectedValue}
              className={`cursor-pointer px-2 py-1.5 hover:bg-readonly ${index === activeIndex ? "bg-readonly" : ""}`}
              id={`${reactId}-option-${option.value}`}
              key={option.value}
              onMouseDown={(event) => {
                event.preventDefault();
                selectOption(option, Boolean(onCommitValue));
              }}
              role="option"
            >
              <span aria-hidden="true" className="mr-1 inline-block size-2 border border-border bg-brand/20" />
              <span>{option.label}</span>
            </li>
          ))}
              {filteredOptions.length === 0 ? <li className="px-2 py-1.5 text-muted">{t("calls.placeholder.searchEmpty")}</li> : null}
            </ul>,
            document.body
          )
        : null}
      {errorId ? <FieldErrorMessage id={errorId} message={errorMessage ?? null} /> : null}
    </label>
  );
}

function TextCell({
  columnId,
  disabled,
  label,
  maxLength,
  name,
  onBlur,
  onChange,
  onKeyDown,
  placeholder,
  rowIndex,
  value
}: {
  columnId?: string;
  disabled: boolean;
  label: string;
  maxLength?: number;
  name: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  rowIndex?: number;
  value?: string;
}) {
  return (
    <label className="grid w-full gap-1">
      <span className="sr-only">{label}</span>
      <input
        className="h-8 w-full border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly"
        data-call-cell-column={columnId}
        data-call-cell-row={rowIndex}
        disabled={disabled}
        maxLength={maxLength ?? 500}
        name={name}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        {...(value === undefined ? {} : { value })}
      />
    </label>
  );
}

function customerChoiceLabel(customer: CustomerDto) {
  return [customer.name, customer.phone, customer.memo].filter((part) => part && part.trim() !== "").join(" · ");
}

function CustomerLinkSelect({
  columnId,
  customers,
  disabled,
  name,
  onChange,
  onKeyDown,
  rowIndex,
  value
}: {
  columnId: EditableCallField;
  customers: CustomerDto[];
  disabled: boolean;
  name?: string;
  onChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLSelectElement>) => void;
  rowIndex: number;
  value?: string;
}) {
  const t = useT();
  const options = (
    <>
      <option value="">{t("calls.customer.unlinked")}</option>
      {customers.map((customer) => (
        <option key={customer.id} value={customer.id}>
          {customerChoiceLabel(customer)}
        </option>
      ))}
    </>
  );
  const className = "h-8 w-full border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-brand disabled:bg-readonly";
  if (value === undefined) {
    return (
      <select
        aria-label={t("calls.column.customer")}
        className={className}
        data-call-cell-column={columnId}
        data-call-cell-row={rowIndex}
        defaultValue=""
        disabled={disabled}
        name={name}
        onKeyDown={onKeyDown}
      >
        {options}
      </select>
    );
  }
  return (
    <select
      aria-label={t("calls.column.customer")}
      className={className}
      data-call-cell-column={columnId}
      data-call-cell-row={rowIndex}
      disabled={disabled}
      name={name}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      onKeyDown={onKeyDown}
      value={value}
    >
      {options}
    </select>
  );
}

const TEN_MINUTE_ENTRY_OPTIONS: ServiceCallOption[] = Array.from({ length: 24 * 6 }, (_, index) => {
  const hour = Math.floor(index / 6);
  const minute = (index % 6) * 10;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return { value, label: value };
});

function ActualEntryCell({
  disabled,
  displayEnd,
  errorMessage,
  onBlur,
  onChange,
  onCommitValue,
  onGridKeyDown,
  rowIndex,
  value,
  warningTime
}: {
  disabled: boolean;
  displayEnd?: string | null;
  errorMessage?: string | null;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCommitValue?: (value: string) => void;
  onGridKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  rowIndex: number;
  value?: string;
  warningTime?: string | null;
}) {
  const t = useT();
  const reactId = useId();
  const helpId = `${reactId}-actual-entry-help`;
  const warningId = `${reactId}-actual-entry-warning`;
  const warning = warningTime ? t("calls.actualEntry.warning", { time: spokenClock(warningTime) }) : null;

  return (
    <>
      <SelectCell
        columnId="actualEntryTime"
        describedBy={[helpId, warning ? warningId : null].filter(Boolean).join(" ")}
        disabled={disabled}
        errorId={errorMessage ? `${reactId}-actual-entry-error` : undefined}
        errorMessage={errorMessage}
        label={t("calls.column.actualEntry")}
        name="actualEntryTime"
        onBlur={onBlur}
        onChange={onChange}
        onCommitValue={onCommitValue}
        onGridKeyDown={onGridKeyDown}
        options={TEN_MINUTE_ENTRY_OPTIONS}
        rowIndex={rowIndex}
        tall
        {...(value === undefined ? {} : { value })}
      />
      <p className="text-[11px] text-muted" id={helpId}>
        {t("calls.actualEntry.helper")}
      </p>
      {displayEnd ? (
        <p className="text-[11px] text-foreground [font-variant-numeric:tabular-nums]">
          {t("calls.actualEntry.displayEnd", { time: displayEnd })}
        </p>
      ) : null}
      {warning ? (
        <p className="text-[11px] text-danger [font-variant-numeric:tabular-nums]" id={warningId}>{warning}</p>
      ) : null}
    </>
  );
}

function AddRowForm({
  courseChoice,
  customers,
  existingRowCount,
  isLocked,
  operatingMonthId,
  options,
  serviceDate,
  showSettlementColumns,
  view
}: {
  courseChoice: (AvailabilityCourseChoice & { id: number }) | null;
  customers: CustomerDto[];
  existingRowCount: number;
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
  showSettlementColumns: boolean;
  view: LedgerView;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ServiceCallActionState, FormData>(saveBasicServiceCallRowAction, null);
  const choiceId = courseChoice?.id ?? 0;
  const [seenChoiceId, setSeenChoiceId] = useState(choiceId);
  const [hiddenState, setHiddenState] = useState<ServiceCallActionState>(null);
  // A course choice fills three fields. It is not a save, so the previous result stays off the row.
  if (seenChoiceId !== choiceId) {
    setSeenChoiceId(choiceId);
    setHiddenState(state);
  }
  const rowState = state === hiddenState ? null : state;
  const disabled = isLocked || pending;
  const rowIndex = existingRowCount;
  const rowCount = existingRowCount + 1;
  const rowEditableFields = useMemo(() => editableFieldsForView(view, showSettlementColumns), [view, showSettlementColumns]);

  function handleAddRowKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextCell = moveTabCell({ rowIndex, columnId }, rowCount, event.shiftKey, rowEditableFields);
      focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const nextCell = moveAdjacentCell({ rowIndex, columnId }, rowCount, event.key as ArrowNavigationKey, rowEditableFields);
      if (isEditableCallField(nextCell.columnId)) {
        focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      }
    }
  }

  const visibleColumns = visibleCallGridColumns(view, showSettlementColumns);

  // 수납·정산 보기에는 코스 열이 없고 코스는 필수 입력이라, 그 보기에서는 새 행을 만들 수 없다.
  // 예약·현장이나 전체 보기로 바꿔서 추가하라는 안내만 둔다(가정: 새 콜 만들기는 예약 때 하는 일이다).
  if (view === "settlement") {
    return (
      <div className="border-t border-border bg-surface">
        <div className="relative overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(view, showSettlementColumns) }}>
            <CallGridColgroup showSettlementColumns={showSettlementColumns} view={view} />
            <CallGridHead showSettlementColumns={showSettlementColumns} view={view} />
            <tbody>
              <tr>
                <td className="px-2 py-3 text-xs text-muted" colSpan={visibleColumns.length}>
                  {t("calls.addRow.settlementViewHint")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // 보이는 열 순서대로 그릴 칸들. date부터 편집 칸까지는 보기마다 자리가 달라 순서대로 꺼내 쓰고,
  // 그 뒤(계산 칸·경고·저장상태 자리)는 아직 저장되지 않은 행이라 쓸 내용이 없어 제출 버튼 한 칸으로 묶는다.
  const cells: Record<string, ReactNode> = {
    date: (
      <td className="border-b border-border px-2 py-2 text-xs text-muted" key="date">
        {serviceDate}
      </td>
    ),
    time: (
      <td className="border-b border-border px-2 py-2" key="time">
        <SelectCell
          columnId="startTime"
          defaultValue={courseChoice?.startTime}
          disabled={disabled}
          key={courseChoice ? `choice-${courseChoice.id}` : "blank"}
          label={t("calls.column.time")}
          name="startTime"
          onGridKeyDown={(event) => handleAddRowKeyDown("startTime", event)}
          options={options.timeSlots}
          required
          rowIndex={rowIndex}
        />
        <InlineError field="startTime" state={rowState} />
      </td>
    ),
    actualEntry: (
      <td className="border-b border-border px-2 py-2" key="actualEntry">
        <ActualEntryCell disabled={disabled} onGridKeyDown={(event) => handleAddRowKeyDown("actualEntryTime", event)} rowIndex={rowIndex} />
        <InlineError field="actualEntryTime" state={rowState} />
      </td>
    ),
    room: (
      <td className="border-b border-border px-2 py-2" key="room">
        <SelectCell
          columnId="roomId"
          disabled={disabled}
          emptyLabel={t("calls.placeholder.roomUnassigned")}
          label={t("calls.column.room")}
          name="roomId"
          onGridKeyDown={(event) => handleAddRowKeyDown("roomId", event)}
          options={options.rooms}
          rowIndex={rowIndex}
        />
        <InlineError field="roomId" state={rowState} />
      </td>
    ),
    course: (
      <td className="border-b border-border px-2 py-2" key="course">
        <SelectCell
          columnId="courseId"
          defaultValue={courseChoice?.courseId}
          disabled={disabled}
          key={courseChoice ? `choice-${courseChoice.id}` : "blank"}
          label={t("calls.column.course")}
          name="courseId"
          onGridKeyDown={(event) => handleAddRowKeyDown("courseId", event)}
          options={options.courses}
          required
          rowIndex={rowIndex}
        />
        <InlineError field="courseId" state={rowState} />
      </td>
    ),
    customerMemo: (
      <td className="border-b border-border px-2 py-2" key="customerMemo">
        <TextCell
          columnId="customerMemo"
          disabled={disabled}
          label={t("calls.column.customerMemo")}
          name="customerMemo"
          onKeyDown={(event) => handleAddRowKeyDown("customerMemo", event)}
          placeholder={t("calls.column.customerMemo")}
          rowIndex={rowIndex}
        />
      </td>
    ),
    customer: (
      <td className="border-b border-border px-2 py-2" key="customer">
        <CustomerLinkSelect
          columnId="customerId"
          customers={customers}
          disabled={disabled}
          name="customerId"
          onKeyDown={(event) => handleAddRowKeyDown("customerId", event)}
          rowIndex={rowIndex}
        />
      </td>
    ),
    therapist1: (
      <td className="border-b border-border px-2 py-2" key="therapist1">
        <SelectCell
          columnId="therapist1Id"
          defaultValue={courseChoice?.therapistId}
          disabled={disabled}
          key={courseChoice ? `choice-${courseChoice.id}` : "blank"}
          label={t("calls.column.therapist1")}
          name="therapist1Id"
          onGridKeyDown={(event) => handleAddRowKeyDown("therapist1Id", event)}
          options={options.therapists}
          rowIndex={rowIndex}
        />
      </td>
    ),
    therapist2: (
      <td className="border-b border-border px-2 py-2" key="therapist2">
        <SelectCell
          disabled={disabled}
          errorId="add-call-therapist2-error"
          errorMessage={fieldError(rowState, "therapist2Id")}
          columnId="therapist2Id"
          label={t("calls.column.therapist2")}
          name="therapist2Id"
          onGridKeyDown={(event) => handleAddRowKeyDown("therapist2Id", event)}
          options={options.therapists}
          rowIndex={rowIndex}
        />
      </td>
    ),
    earcare: (
      <td className="border-b border-border px-2 py-2" key="earcare">
        <SelectCell
          columnId="earcareEmployeeId"
          disabled={disabled}
          label={t("calls.column.earcare")}
          name="earcareEmployeeId"
          onGridKeyDown={(event) => handleAddRowKeyDown("earcareEmployeeId", event)}
          options={options.earcareEmployees}
          rowIndex={rowIndex}
        />
      </td>
    ),
    reservationStatus: (
      <td className="border-b border-border px-2 py-2" key="reservationStatus">
        <SelectCell
          columnId="status"
          defaultValue="RESERVED"
          disabled={disabled}
          label={t("calls.column.status")}
          name="status"
          onGridKeyDown={(event) => handleAddRowKeyDown("status", event)}
          options={options.statuses}
          required
          rowIndex={rowIndex}
        />
        <InlineError field="status" state={rowState} />
      </td>
    ),
    discountType: (
      <td className="border-b border-border px-2 py-2" key="discountType">
        <SelectCell
          columnId="discountTypeCode"
          disabled={disabled}
          label={t("calls.column.discountType")}
          name="discountTypeCode"
          onGridKeyDown={(event) => handleAddRowKeyDown("discountTypeCode", event)}
          options={options.discountTypes}
          rowIndex={rowIndex}
        />
      </td>
    ),
    paymentMethod: (
      <td className="border-b border-border px-2 py-2" key="paymentMethod">
        <SelectCell
          columnId="paymentMethodCode"
          disabled={disabled}
          label={t("calls.column.paymentMethod")}
          name="paymentMethodCode"
          onGridKeyDown={(event) => handleAddRowKeyDown("paymentMethodCode", event)}
          options={options.paymentMethods}
          rowIndex={rowIndex}
        />
      </td>
    ),
    note: (
      <td className="border-b border-border px-2 py-2" key="note">
        <TextCell
          columnId="note"
          disabled={disabled}
          label={t("calls.column.note")}
          name="note"
          onKeyDown={(event) => handleAddRowKeyDown("note", event)}
          placeholder={t("calls.column.note")}
          rowIndex={rowIndex}
        />
      </td>
    ),
    confirmation: (
      <td className="border-b border-border px-2 py-2" key="confirmation">
        <SelectCell
          columnId="confirmationCode"
          disabled={disabled}
          label={t("calls.column.confirmation")}
          name="confirmationCode"
          onGridKeyDown={(event) => handleAddRowKeyDown("confirmationCode", event)}
          options={options.confirmationCodes}
          rowIndex={rowIndex}
        />
      </td>
    )
  };

  // 보이는 열 중 date와 그 보기의 편집 칸들은 앞쪽에 그대로 있다(all·booking 모두 그렇다. settlement는
  // 위에서 이미 안내 행으로 갈렸다). 그 뒤 계산·경고·저장상태 자리는 제출 버튼 한 칸으로 묶는다.
  const leadingColumns = visibleColumns.slice(0, 1 + rowEditableFields.length);
  const trailingCount = visibleColumns.length - leadingColumns.length;

  return (
    <form action={formAction} className="border-t border-border bg-surface">
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <div className="relative overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(view, showSettlementColumns) }}>
          <CallGridColgroup showSettlementColumns={showSettlementColumns} view={view} />
          <CallGridHead showSettlementColumns={showSettlementColumns} view={view} />
          <tbody>
            <tr className="align-top">
              {leadingColumns.map((column) => cells[column.id])}
              <td className="border-b border-border bg-readonly px-2 py-2" colSpan={trailingCount} key="submit">
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="h-8 whitespace-nowrap px-3 text-xs" disabled={disabled} type="submit">
                    {t("calls.addRow.submit")}
                  </Button>
                  <InlineError state={rowState} />
                  {rowState?.ok ? <span className="text-xs text-muted">{t("calls.save.saved")}</span> : null}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}

function nullableValue(value: string) {
  return value.trim() === "" ? null : value;
}

function calcMessage(t: (key: MessageKey) => string, status: ServiceCallCalculationStatus) {
  return t(calculationErrorMessageKey(status));
}

function firstFieldError(fieldErrors: FieldErrors, field: string) {
  return fieldErrors[field]?.[0] ?? null;
}

function formatVnd(locale: Locale, value: number) {
  return formatNumber(locale, value);
}

function PaymentAmountCell({
  onKeyDown,
  row,
  rowIndex,
  saveStatus
}: {
  onKeyDown?: (event: KeyboardEvent<HTMLTableCellElement>) => void;
  row: ServiceCallRowDto;
  rowIndex: number;
  saveStatus: RowSaveStatus;
}) {
  const t = useT();
  const locale = useLocale();
  const isStaleFailedDraft = isSaveHeld(saveStatus);
  const canShowAmount = row.calculationStatus === "calculated" && !isStaleFailedDraft;
  const title = isStaleFailedDraft
    ? t("calls.calc.staleDraftTitle")
    : row.calculationStatus === "calculated" || row.calculationStatus === "not_completed"
      ? undefined
      : calcMessage(t, row.calculationStatus);

  return (
    <td
      className="border-b border-border bg-readonly px-2 py-2 text-right text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-brand [font-variant-numeric:tabular-nums]"
      data-call-cell-column="paymentAmount"
      data-call-cell-row={rowIndex}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <span className="sr-only">{t("calls.column.paymentAmount")}</span>
      <span className="grid gap-0.5" title={title}>
        {canShowAmount && row.discountAmount > 0 && row.basePrice > row.paymentAmount ? (
          <span className="text-[11px] text-muted line-through">{formatVnd(locale, row.basePrice)}</span>
        ) : null}
        <span className={canShowAmount && row.discountAmount > 0 ? "font-bold text-foreground" : ""}>
          {canShowAmount ? formatVnd(locale, row.paymentAmount) : "—"}
        </span>
      </span>
    </td>
  );
}

function ComputedCell({
  columnId,
  label,
  onKeyDown,
  row,
  rowIndex,
  saveStatus,
  value
}: {
  columnId: string;
  label: string;
  onKeyDown?: (event: KeyboardEvent<HTMLTableCellElement>) => void;
  row: ServiceCallRowDto;
  rowIndex: number;
  saveStatus: RowSaveStatus;
  value: number;
}) {
  const t = useT();
  const locale = useLocale();
  const isStaleFailedDraft = isSaveHeld(saveStatus);
  const displayValue = row.calculationStatus === "calculated" && !isStaleFailedDraft ? formatVnd(locale, value) : "—";
  return (
    <td
      className="border-b border-border bg-readonly px-2 py-2 text-right text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-brand [font-variant-numeric:tabular-nums]"
      data-call-cell-column={columnId}
      data-call-cell-row={rowIndex}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <span className="sr-only">{label}</span>
      <span
        title={
          isStaleFailedDraft
            ? t("calls.calc.staleDraftTitle")
            : row.calculationStatus === "calculated" || row.calculationStatus === "not_completed"
              ? undefined
              : calcMessage(t, row.calculationStatus)
        }
      >
        {displayValue}
      </span>
    </td>
  );
}

function EditableCallRow({
  customers,
  isLocked,
  onOpenDetail,
  options,
  row,
  rowCount,
  rowIndex,
  selected,
  showSettlementColumns,
  view
}: {
  customers: CustomerDto[];
  isLocked: boolean;
  onOpenDetail: (callId: string) => void;
  options: ServiceCallFormOptions;
  row: ServiceCallRowDto;
  rowCount: number;
  rowIndex: number;
  selected: boolean;
  showSettlementColumns: boolean;
  view: LedgerView;
}) {
  const t = useT();
  const [save, dispatch] = useReducer(callRowSaveReducer, row, initialCallRowSave);
  const { draft, fieldErrors, savedRow: serverRow, status: saveStatus } = save;
  // 다른 행을 저장하면 이 행의 경고도 바뀐다. 저장 뒤 서버가 다시 준 행(row)이 이 행의 저장 결과보다 새로우면 그 경고를 쓴다.
  const freshestRow = row.savedAt >= serverRow.savedAt ? row : serverRow;
  const saveHeld = isSaveHeld(saveStatus);
  const [, startTransition] = useTransition();
  const request = save.inFlight;
  // 키보드 이동 순서는 보이는 열의 순서를 따른다(명세 F02 기준, 티켓 19). 보기가 바뀌면 다시 계산한다.
  const navigableFields = useMemo(() => navigableFieldsForView(view, showSettlementColumns), [view, showSettlementColumns]);
  const editableNavigableFields = useMemo(() => navigableFields.filter(isEditableCallField), [navigableFields]);

  // 저장은 행마다 하나씩 보낸다. 응답을 받으면 모아 둔 수정이 다음 저장으로 inFlight에 들어온다(callRowSaveReducer).
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
          } else {
            dispatch({ type: "failed", message: result.formError ?? null, fieldErrors: result.fieldErrors });
          }
        } catch {
          // 응답을 받지 못했다. 초안은 남고, 같은 초안으로 다시 시도할 수 있다.
          dispatch({ type: "failed", message: null });
        }
      })();
    });
  }, [request]);

  function updateDraft<Key extends keyof CallRowDraft>(key: Key, value: CallRowDraft[Key]) {
    dispatch({ type: "edit", changes: { [key]: value } });
  }

  function updateDraftAndCommit<Key extends keyof CallRowDraft>(key: Key, value: CallRowDraft[Key]) {
    if (isLocked) {
      updateDraft(key, value);
      return;
    }
    dispatch({ type: "commit", changes: { [key]: value } });
  }

  function commit() {
    if (isLocked) {
      return;
    }
    dispatch({ type: "commit" });
  }

  async function reloadLatest() {
    const result = await reloadServiceCallRowAction(row.id).catch(() => null);
    // 지금 행을 읽지 못하면 거절 때 받은 행으로 바꾼다. 그 사이 또 바뀌었으면 다음 저장이 다시 충돌로 알린다.
    const latest = result?.ok ? result.data : save.latestRow;
    if (latest) {
      dispatch({ type: "reload", row: latest });
    }
  }

  function handleGridKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLElement>) {
    if (isLocked) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextCell = moveTabCell({ rowIndex, columnId }, rowCount, event.shiftKey, editableNavigableFields);
      focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      const nextCell = moveEnterCell({ rowIndex, columnId }, rowCount);
      focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "cancel" });
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const nextCell = moveAdjacentCell({ rowIndex, columnId }, rowCount, event.key as ArrowNavigationKey, navigableFields);
      focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
    }
  }

  function handleReadonlyKeyDown(columnId: string, event: KeyboardEvent<HTMLTableCellElement>) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const nextCell = moveAdjacentCell({ rowIndex, columnId }, rowCount, event.key as ArrowNavigationKey, navigableFields);
    focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
  }

  // 보기마다 보이는 열과 그 순서가 다르므로(명세 F02, 티켓 19), 칸은 열 머리 id로 모아 두고
  // 보이는 열 목록을 따라 그 순서로 늘어놓는다. 각 칸의 내용·핸들러는 보기와 상관없이 그대로다.
  const cells: Record<string, ReactNode> = {
    date: (
      <td className="border-b border-border px-2 py-2 text-xs" key="date">
        {draft.serviceDate}
        <input name="serviceCallId" type="hidden" value={draft.serviceCallId} />
      </td>
    ),
    time: (
      <td className="border-b border-border px-2 py-2" key="time">
        <SelectCell
          columnId="startTime"
          disabled={isLocked}
          label={t("calls.column.time")}
          name="startTime"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("startTime", value)}
          onCommitValue={(value) => updateDraftAndCommit("startTime", value)}
          onGridKeyDown={(event) => handleGridKeyDown("startTime", event)}
          options={options.timeSlots}
          required
          rowIndex={rowIndex}
          value={draft.startTime}
        />
      </td>
    ),
    actualEntry: (
      <td className="border-b border-border px-2 py-2" key="actualEntry">
        <ActualEntryCell
          disabled={isLocked}
          displayEnd={serverRow.displayEnd}
          errorMessage={firstFieldError(fieldErrors, "actualEntryTime")}
          onBlur={() => commit()}
          onChange={(value) => updateDraft("actualEntryTime", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("actualEntryTime", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("actualEntryTime", event)}
          rowIndex={rowIndex}
          value={draft.actualEntryTime ?? ""}
          warningTime={serverRow.warningTime}
        />
      </td>
    ),
    room: (
      <td className="border-b border-border px-2 py-2" key="room">
        <SelectCell
          columnId="roomId"
          disabled={isLocked}
          emptyLabel={t("calls.placeholder.roomUnassigned")}
          label={t("calls.column.room")}
          name="roomId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("roomId", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("roomId", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("roomId", event)}
          options={options.rooms}
          rowIndex={rowIndex}
          value={draft.roomId ?? ""}
        />
      </td>
    ),
    course: (
      <td className="border-b border-border px-2 py-2" key="course">
        <SelectCell
          columnId="courseId"
          disabled={isLocked}
          label={t("calls.column.course")}
          name="courseId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("courseId", value)}
          onCommitValue={(value) => updateDraftAndCommit("courseId", value)}
          onGridKeyDown={(event) => handleGridKeyDown("courseId", event)}
          options={options.courses}
          required
          rowIndex={rowIndex}
          value={draft.courseId}
        />
      </td>
    ),
    customerMemo: (
      <td className="border-b border-border px-2 py-2" key="customerMemo">
        <TextCell
          columnId="customerMemo"
          disabled={isLocked}
          label={t("calls.column.customerMemo")}
          name="customerMemo"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("customerMemo", nullableValue(value))}
          onKeyDown={(event) => handleGridKeyDown("customerMemo", event)}
          placeholder={t("calls.column.customerMemo")}
          rowIndex={rowIndex}
          value={draft.customerMemo ?? ""}
        />
        <span className="sr-only">{draft.customerMemo ?? ""}</span>
      </td>
    ),
    customer: (
      <td className="border-b border-border px-2 py-2" key="customer">
        <CustomerLinkSelect
          columnId="customerId"
          customers={customers}
          disabled={isLocked}
          onChange={(value) => updateDraftAndCommit("customerId", nullableValue(value))}
          onKeyDown={(event) => handleGridKeyDown("customerId", event)}
          rowIndex={rowIndex}
          value={draft.customerId ?? ""}
        />
      </td>
    ),
    therapist1: (
      <td className="border-b border-border px-2 py-2" key="therapist1">
        <SelectCell
          columnId="therapist1Id"
          disabled={isLocked}
          label={t("calls.column.therapist1")}
          name="therapist1Id"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("therapist1Id", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("therapist1Id", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("therapist1Id", event)}
          options={options.therapists}
          rowIndex={rowIndex}
          value={draft.therapist1Id ?? ""}
        />
      </td>
    ),
    therapist2: (
      <td className="border-b border-border px-2 py-2" key="therapist2">
        <SelectCell
          columnId="therapist2Id"
          disabled={isLocked}
          errorId={`call-${row.id}-therapist2-error`}
          errorMessage={firstFieldError(fieldErrors, "therapist2Id")}
          label={t("calls.column.therapist2")}
          name="therapist2Id"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("therapist2Id", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("therapist2Id", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("therapist2Id", event)}
          options={options.therapists}
          rowIndex={rowIndex}
          value={draft.therapist2Id ?? ""}
        />
      </td>
    ),
    earcare: (
      <td className="border-b border-border px-2 py-2" key="earcare">
        <SelectCell
          columnId="earcareEmployeeId"
          disabled={isLocked}
          label={t("calls.column.earcare")}
          name="earcareEmployeeId"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("earcareEmployeeId", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("earcareEmployeeId", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("earcareEmployeeId", event)}
          options={options.earcareEmployees}
          rowIndex={rowIndex}
          value={draft.earcareEmployeeId ?? ""}
        />
      </td>
    ),
    reservationStatus: (
      <td className="border-b border-border px-2 py-2" key="reservationStatus">
        <SelectCell
          columnId="status"
          disabled={isLocked}
          label={t("calls.column.status")}
          name="status"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("status", value)}
          onCommitValue={(value) => updateDraftAndCommit("status", value)}
          onGridKeyDown={(event) => handleGridKeyDown("status", event)}
          options={options.statuses}
          required
          rowIndex={rowIndex}
          value={draft.status}
        />
      </td>
    ),
    discountType: (
      <td className="border-b border-border px-2 py-2" key="discountType">
        <SelectCell
          columnId="discountTypeCode"
          disabled={isLocked}
          label={t("calls.column.discountType")}
          name="discountTypeCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("discountTypeCode", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("discountTypeCode", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("discountTypeCode", event)}
          options={options.discountTypes}
          rowIndex={rowIndex}
          value={draft.discountTypeCode ?? ""}
        />
      </td>
    ),
    paymentMethod: (
      <td className="border-b border-border px-2 py-2" key="paymentMethod">
        <SelectCell
          columnId="paymentMethodCode"
          disabled={isLocked}
          label={t("calls.column.paymentMethod")}
          name="paymentMethodCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("paymentMethodCode", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("paymentMethodCode", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("paymentMethodCode", event)}
          options={options.paymentMethods}
          rowIndex={rowIndex}
          value={draft.paymentMethodCode ?? ""}
        />
      </td>
    ),
    note: (
      <td className="border-b border-border px-2 py-2" key="note">
        <TextCell
          columnId="note"
          disabled={isLocked}
          label={t("calls.column.note")}
          name="note"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("note", nullableValue(value))}
          onKeyDown={(event) => handleGridKeyDown("note", event)}
          placeholder={t("calls.column.note")}
          rowIndex={rowIndex}
          value={draft.note ?? ""}
        />
      </td>
    ),
    confirmation: (
      <td className="border-b border-border px-2 py-2" key="confirmation">
        <SelectCell
          columnId="confirmationCode"
          disabled={isLocked}
          label={t("calls.column.confirmation")}
          name="confirmationCode"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("confirmationCode", nullableValue(value))}
          onCommitValue={(value) => updateDraftAndCommit("confirmationCode", nullableValue(value))}
          onGridKeyDown={(event) => handleGridKeyDown("confirmationCode", event)}
          options={options.confirmationCodes}
          rowIndex={rowIndex}
          value={draft.confirmationCode ?? ""}
        />
      </td>
    ),
    paymentAmount: (
      <PaymentAmountCell
        key="paymentAmount"
        onKeyDown={(event) => handleReadonlyKeyDown("paymentAmount", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
      />
    ),
    discount: (
      <ComputedCell
        columnId="discountAmount"
        key="discount"
        label={t("calls.column.discount")}
        onKeyDown={(event) => handleReadonlyKeyDown("discountAmount", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.discountAmount}
      />
    ),
    therapist1Commission: (
      <ComputedCell
        columnId="therapist1Commission"
        key="therapist1Commission"
        label={t("calls.column.therapist1Commission")}
        onKeyDown={(event) => handleReadonlyKeyDown("therapist1Commission", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.therapist1Commission}
      />
    ),
    therapist2Commission: (
      <ComputedCell
        columnId="therapist2Commission"
        key="therapist2Commission"
        label={t("calls.column.therapist2Commission")}
        onKeyDown={(event) => handleReadonlyKeyDown("therapist2Commission", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.therapist2Commission}
      />
    ),
    earcarePool: (
      <ComputedCell
        columnId="earcarePoolAmount"
        key="earcarePool"
        label={t("calls.column.earcarePool")}
        onKeyDown={(event) => handleReadonlyKeyDown("earcarePoolAmount", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.earcarePoolAmount}
      />
    ),
    opsCallCredit: (
      <ComputedCell
        columnId="opsCallCredit"
        key="opsCallCredit"
        label={t("calls.column.opsCallCredit")}
        onKeyDown={(event) => handleReadonlyKeyDown("opsCallCredit", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.opsCallCredit}
      />
    ),
    warnings: (
      <td className="border-b border-border px-2 py-2" data-call-cell-column="warnings" key="warnings">
        <CallWarningCell callId={row.id} onOpen={onOpenDetail} startTime={serverRow.startTime} warnings={freshestRow.warnings} />
      </td>
    ),
    saveStatus: (
      <td
        className="border-b border-border bg-readonly px-2 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand"
        data-call-cell-column="calculationStatus"
        data-call-cell-row={rowIndex}
        key="saveStatus"
        onKeyDown={(event) => handleReadonlyKeyDown("calculationStatus", event)}
        tabIndex={-1}
      >
        <div className="grid w-full gap-1">
          {saveHeld ? <span className="text-danger">{t("calls.calc.errorPending")}</span> : null}
          {serverRow.calculationStatus === "calculated" && !saveHeld ? <span>{t("calls.calc.calculated")}</span> : null}
          {serverRow.calculationStatus === "not_completed" && !saveHeld ? <span>{t("calls.calc.notCompleted")}</span> : null}
          {(serverRow.calculationStatus === "course_policy_missing" ||
            serverRow.calculationStatus === "therapist_rate_missing" ||
            serverRow.calculationStatus === "second_therapist_required") &&
          !saveHeld ? (
            <span className="text-danger">{calcMessage(t, serverRow.calculationStatus)}</span>
          ) : null}
          <CallRowSaveStatus
            message={save.message}
            onReload={() => void reloadLatest()}
            onRetry={() => commit()}
            savedAt={serverRow.savedAt}
            state={saveStatus}
          />
        </div>
      </td>
    )
  };

  return (
    // 콜 상세 패널이 열린 행은 선택된 행 모양이 된다(design.md 6.6). 입력칸·버튼이 아닌 자리를 누르면 패널이 열린다.
    <tr
      className="align-top data-[selected=true]:bg-readonly [&[data-selected=true]>td:first-child]:[box-shadow:inset_3px_0_0_var(--brand)]"
      data-selected={selected}
      data-service-call-id={row.id}
      id={ledgerCallAnchorId(row.id)}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("input, select, textarea, button, a, [role='option'], [role='combobox']")) return;
        onOpenDetail(row.id);
      }}
    >
      {visibleCallGridColumns(view, showSettlementColumns).map((column) => cells[column.id])}
    </tr>
  );
}

export function EditableCallGrid({
  courseChoice = null,
  customers = [],
  isLocked,
  onOpenDetail = () => {},
  operatingMonthId,
  options,
  rows,
  selectedCallId = null,
  serviceDate,
  showSettlementColumns,
  view = "all"
}: {
  courseChoice?: (AvailabilityCourseChoice & { id: number }) | null;
  customers?: CustomerDto[];
  isLocked: boolean;
  /** 행이나 경고를 눌렀을 때. 콜 상세 패널을 여는 쪽이 정한다. */
  onOpenDetail?: (callId: string) => void;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  selectedCallId?: string | null;
  serviceDate: string;
  showSettlementColumns: boolean;
  /** 원장 보기(명세 F02, 티켓 19): 예약·현장/수납·정산/전체가 다른 열 묶음을 보여 준다. 기본은 전체(기존 동작). */
  view?: LedgerView;
}) {
  const t = useT();
  // TanStack column defs back the row model only; visible header text is rendered
  // by <CallGridHead> from the localized CALL_GRID_COLUMNS catalog, so these
  // `header` values are never shown — accessorKey stays the stable field name.
  const columns = useMemo<ColumnDef<ServiceCallRowDto>[]>(
    () => [
      { accessorKey: "serviceDate", header: "serviceDate" },
      ...EDITABLE_CALL_FIELDS.map((field) => ({ accessorKey: field, header: field })),
      { accessorKey: "paymentAmount", header: "paymentAmount" },
      { accessorKey: "discountAmount", header: "discountAmount" },
      ...(showSettlementColumns
        ? [
            { accessorKey: "therapist1Commission", header: "therapist1Commission" },
            { accessorKey: "therapist2Commission", header: "therapist2Commission" },
            { accessorKey: "earcarePoolAmount", header: "earcarePoolAmount" },
            { accessorKey: "opsCallCredit", header: "opsCallCredit" }
          ]
        : []),
      { accessorKey: "calculationStatus", header: "calculationStatus" }
    ],
    [showSettlementColumns]
  );
  const table = useReactTable({
    columns,
    data: rows,
    getCoreRowModel: getCoreRowModel()
  });

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

      {/* 휴대폰 폭(600px 미만): 넓은 표를 축소하지 않고 짧은 카드 목록을 대신 보여 준다(명세 F08, 티켓 26). */}
      <div className="min-[600px]:hidden">
        <CallPhoneCardList onOpenDetail={onOpenDetail} options={options} rows={rows} selectedCallId={selectedCallId} />
      </div>

      {/* 태블릿 폭 이상: 넓은 표와 새 행 직접 입력(표 편집). 휴대폰에서는 이 블록 전체가 카드 목록으로 대체된다. */}
      <div className="hidden min-[600px]:block">
        {rows.length === 0 ? (
          <div className="grid gap-3 px-4 py-8">
            <div>
              <p className="text-sm font-medium text-foreground">{t("calls.grid.empty.title")}</p>
              <p className="mt-1 text-xs text-muted">{t("calls.grid.empty.description")}</p>
            </div>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(view, showSettlementColumns) }}>
              <CallGridColgroup showSettlementColumns={showSettlementColumns} view={view} />
              <CallGridHead showSettlementColumns={showSettlementColumns} view={view} />
              <tbody>
                {table.getRowModel().rows.map((tableRow, index) => (
                  <EditableCallRow
                    customers={customers}
                    isLocked={isLocked}
                    key={tableRow.original.id}
                    onOpenDetail={onOpenDetail}
                    options={options}
                    row={tableRow.original}
                    rowCount={table.getRowModel().rows.length + 1}
                    rowIndex={index}
                    selected={tableRow.original.id === selectedCallId}
                    showSettlementColumns={showSettlementColumns}
                    view={view}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AddRowForm
          courseChoice={courseChoice}
          customers={customers}
          existingRowCount={table.getRowModel().rows.length}
          isLocked={isLocked}
          operatingMonthId={operatingMonthId}
          options={options}
          serviceDate={serviceDate}
          showSettlementColumns={showSettlementColumns}
          view={view}
        />
      </div>
    </section>
  );
}
