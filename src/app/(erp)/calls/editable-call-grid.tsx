"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import { getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatDateTime, formatNumber } from "@/lib/i18n/format";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerDto, ServiceCallCalculationStatus, ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import type { ServiceCallAutosaveInput } from "@/modules/calls/service-call-schema";
import {
  autosaveServiceCallRowAction,
  finishCleaningCallAction,
  saveBasicServiceCallRowAction,
  type ServiceCallActionState
} from "@/app/(erp)/calls/actions";
import { BookingChannelIcon, parseCustomerCallInfo } from "@/app/(erp)/calls/booking-channel-icons";
import type { AvailabilityCourseChoice } from "@/app/(erp)/calls/therapist-availability-view";
import { calculationErrorMessageKey } from "@/app/(erp)/calls/calculation-status-message";
import { ledgerCallAnchorId } from "@/app/(erp)/calls/ledger-address";
import {
  EDITABLE_CALL_FIELDS,
  cancelCellDraft,
  isEditableCallField,
  moveAdjacentCell,
  moveEnterCell,
  moveTabCell,
  type ArrowNavigationKey,
  type EditableCallField
} from "@/app/(erp)/calls/call-ledger-keyboard";

type RowSaveState = "idle" | "saving" | "saved" | "error";
type FieldErrors = Record<string, string[]>;

function shortTherapistLabel(nameOrLabel: string | null | undefined): string {
  if (!nameOrLabel) return "-";
  const match = nameOrLabel.match(/(?:마사지사|Therapist|마)\s*(\d+)/i);
  if (match) return `마 ${match[1]}`;
  return nameOrLabel.length > 5 ? nameOrLabel.slice(0, 4) : nameOrLabel;
}

function cleanSingleTherapistLabel(nameOrLabel: string | null | undefined): string {
  if (!nameOrLabel || nameOrLabel === "-") return "선택";
  const match = nameOrLabel.match(/(?:마사지사|Therapist|마)\s*(\d+)/i);
  if (match) return `마사지사${match[1]}`;
  return nameOrLabel.split("(")[0].trim() || nameOrLabel;
}

export function normalizeCallStatus(status: string): "RESERVED" | "IN_USE" | "CLEANING" | "COMPLETED" | "NO_SHOW" | "CANCELLED" {
  const s = (status || "").trim().toUpperCase();
  if (s === "RESERVED" || s === "예약") return "RESERVED";
  if (s === "IN_USE" || s === "사용중" || s === "사용 중") return "IN_USE";
  if (s === "CLEANING" || s === "청소중" || s === "청소 중") return "CLEANING";
  if (s === "COMPLETED" || s === "VISIT_COMPLETE" || s === "방문완료" || s === "완료") return "COMPLETED";
  if (s === "NO_SHOW" || s === "노쇼") return "NO_SHOW";
  if (s === "CANCELLED" || s === "CANCELED" || s === "취소") return "CANCELLED";
  return "RESERVED";
}

export function statusBadgeInfo(status: string) {
  const norm = normalizeCallStatus(status);
  switch (norm) {
    case "RESERVED":
      return { label: "예약", className: "bg-[#DCEBFF] text-[#1E6BFF]" };
    case "IN_USE":
      return { label: "사용 중", className: "bg-[#DCF5E3] text-[#1CA84C]" };
    case "CLEANING":
      return { label: "청소 중", className: "bg-[#FEF3C7] text-[#D97706]" };
    case "COMPLETED":
      return { label: "방문완료", className: "bg-[#DCF5E3] text-[#1CA84C]" };
    case "NO_SHOW":
      return { label: "노쇼", className: "bg-[#FEE2E2] text-[#DC2626]" };
    case "CANCELLED":
      return { label: "취소", className: "bg-[#F3F4F6] text-[#4B5563]" };
  }
}

function resolveStatusOptionValue(options: ServiceCallOption[], target: "RESERVED" | "IN_USE" | "CLEANING" | "COMPLETED") {
  const match = options.find((opt) => {
    const val = opt.value.toUpperCase();
    const lbl = opt.label;
    if (target === "RESERVED") return val === "RESERVED" || lbl === "예약";
    if (target === "IN_USE") return val === "IN_USE" || lbl === "사용중" || lbl === "사용 중";
    if (target === "CLEANING") return val === "CLEANING" || lbl === "청소중" || lbl === "청소 중";
    if (target === "COMPLETED") return val === "COMPLETED" || val === "VISIT_COMPLETE" || lbl === "방문완료";
    return false;
  });
  return match?.value ?? (target === "RESERVED" ? "RESERVED" : target === "IN_USE" ? "IN_USE" : target === "CLEANING" ? "CLEANING" : "COMPLETED");
}

function parseCourseDisplay(courseLabel?: string | null) {
  if (!courseLabel || courseLabel === "-" || courseLabel === "") {
    return { line1: "-", line2: null };
  }
  const match = courseLabel.match(/^([A-Z]\s*(?:\d+분)?(?:\s*\([^)]+\))?)\s*(.+)?$/i);
  if (match) {
    return {
      line1: match[1].trim(),
      line2: match[2]?.trim() || null
    };
  }
  return { line1: courseLabel, line2: null };
}

// 11-column grid layout requested by user and mockups:
// 예약시간 -> 상태 -> 고객정보 -> 코스 -> 관리사 -> 객실 -> 입장 -> 종료 -> 결제 -> 할인 -> 조치
// (Settlement columns are appended at the end when showSettlementColumns is active)
const CALL_GRID_COLUMNS = [
  { id: "startTime", labelKey: "calls.column.time", width: "5.5rem" },
  { id: "status", labelKey: "calls.column.status", width: "6.5rem" },
  { id: "customerMemo", labelKey: "calls.column.customerMemo", width: "12.5rem" },
  { id: "courseId", labelKey: "calls.column.course", width: "12rem" },
  { id: "therapist", labelKey: "calls.column.therapist", width: "11rem" },
  { id: "roomId", labelKey: "calls.column.room", width: "7.5rem" },
  { id: "actualEntryTime", labelKey: "calls.column.actualEntry", width: "6.5rem" },
  { id: "displayEnd", labelKey: "calls.column.displayEnd", width: "6rem" },
  { id: "confirmationCode", labelKey: "calls.column.payment", width: "6.5rem" },
  { id: "discountTypeCode", labelKey: "calls.column.discountType", width: "7.5rem" },
  { id: "action", labelKey: "calls.column.action", width: "7.5rem" },
  { id: "therapist1Commission", labelKey: "calls.column.therapist1Commission", width: "7rem", settlement: true },
  { id: "therapist2Commission", labelKey: "calls.column.therapist2Commission", width: "7rem", settlement: true },
  { id: "saveStatus", labelKey: "calls.column.saveStatus", width: "10rem", settlement: true }
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey; width: string; settlement?: boolean }>;

function visibleCallGridColumns(showSettlementColumns: boolean) {
  return CALL_GRID_COLUMNS.filter((column) => showSettlementColumns || !("settlement" in column && column.settlement));
}

function callGridMinWidth(showSettlementColumns: boolean) {
  return showSettlementColumns ? "125rem" : "89rem";
}

function CallGridColgroup({ showSettlementColumns }: { showSettlementColumns: boolean }) {
  return (
    <colgroup>
      {visibleCallGridColumns(showSettlementColumns).map((column) => (
        <col key={column.id} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

function CallGridHead({ showSettlementColumns }: { showSettlementColumns: boolean }) {
  const t = useT();
  const locale = useLocale();
  const isKo = locale !== "vi";

  return (
    <thead className="bg-[#FAF7F2] text-xs font-semibold text-gray-700 border-b border-[#EADBCE]">
      <tr>
        {visibleCallGridColumns(showSettlementColumns).map((column) => {
          let label = t(column.labelKey);
          if (isKo) {
            if (column.id === "startTime") label = "예약시간";
            if (column.id === "customerMemo") label = "고객 정보";
            if (column.id === "actualEntryTime") label = "입장";
            if (column.id === "discountTypeCode") label = "할인";
          }
          const isLeft = column.id === "customerMemo" || column.id === "courseId";
          return (
            <th
              className={`whitespace-nowrap px-3 py-3 align-middle ${isLeft ? "text-left" : "text-center"}`}
              key={column.id}
            >
              <span>{label}</span>
              {column.id === "actualEntryTime" ? <span className="sr-only">실제입장</span> : null}
            </th>
          );
        })}
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
  return options.find((option) => option.value === value || option.label === value)?.label ?? value;
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

  function closeAndRestore() {
    setOpen(false);
    setActiveIndex(0);
    setInputValue(optionLabel(options, selectedValue, emptyLabel));
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

  const isTimeColumn = columnId === "startTime";

  return (
    <label className="relative flex w-full items-center">
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
        className={`${tall ? "h-11" : "h-9"} w-full rounded-xl border ${
          isTimeColumn
            ? "border-transparent bg-transparent px-1 text-center font-bold text-sm text-gray-900 tabular-nums hover:border-gray-300 focus:bg-white focus:border-blue-500"
            : "border-[#D5CDC2] bg-white px-2.5 pr-6 font-semibold text-xs text-gray-800 shadow-2xs hover:border-gray-400 focus:border-blue-500"
        } outline-none transition-colors disabled:bg-gray-100 ${
          invalid ? "border-danger ring-1 ring-danger focus:border-danger" : ""
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
      {!isTimeColumn ? (
        <span aria-hidden="true" className="pointer-events-none absolute right-2 text-[10px] text-muted">
          ▾
        </span>
      ) : null}
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

function spokenClock(value: string) {
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || minute === undefined) return value;
  const spokenHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${spokenHour}:${minute}`;
}

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
    <div className="flex flex-col items-center justify-center text-center">
      {!value ? (
        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-[#FEECEC] text-[#FF4D4D]">
          미입장
        </span>
      ) : (
        <span className="font-bold text-sm text-gray-900 tabular-nums text-center block">
          {value}
        </span>
      )}
      <div className="sr-only">
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
        <p className="text-xs text-muted" id={helpId}>
          {t("calls.actualEntry.helper")}
        </p>
        {displayEnd ? (
          <p className="text-xs text-foreground [font-variant-numeric:tabular-nums]">
            {t("calls.actualEntry.displayEnd", { time: displayEnd })}
          </p>
        ) : null}
      </div>
      {warning ? (
        <p className="text-xs text-danger font-semibold [font-variant-numeric:tabular-nums] mt-0.5" id={warningId}>
          {warning}
        </p>
      ) : null}
    </div>
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
  showSettlementColumns
}: {
  courseChoice: (AvailabilityCourseChoice & { id: number }) | null;
  customers: CustomerDto[];
  existingRowCount: number;
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
  showSettlementColumns: boolean;
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

  function handleAddRowKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLElement>) {
    if (disabled) {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextCell = moveTabCell({ rowIndex, columnId }, rowCount, event.shiftKey);
      focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      return;
    }

    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      const nextCell = moveAdjacentCell({ rowIndex, columnId }, rowCount, event.key as ArrowNavigationKey, EDITABLE_CALL_FIELDS);
      if (isEditableCallField(nextCell.columnId)) {
        focusLedgerCell(nextCell.rowIndex, nextCell.columnId);
      }
    }
  }

  return (
    <form action={formAction} className="border-t border-border bg-surface">
      <input name="operatingMonthId" type="hidden" value={operatingMonthId} />
      <input name="serviceDate" type="hidden" value={serviceDate} />
      <div className="relative overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(showSettlementColumns) }}>
          <CallGridColgroup showSettlementColumns={showSettlementColumns} />
          <CallGridHead showSettlementColumns={showSettlementColumns} />
          <tbody>
            <tr className="align-top">
              {/* 1. 예약시간 */}
              <td className="border-b border-border px-2 py-2">
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

              {/* 2. 상태 */}
              <td className="border-b border-border px-2 py-2">
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

              {/* 3. 고객정보 */}
              <td className="border-b border-border px-2 py-2">
                <div className="flex flex-col gap-1">
                  <TextCell
                    columnId="customerMemo"
                    disabled={disabled}
                    label={t("calls.column.customerMemo")}
                    name="customerMemo"
                    onKeyDown={(event) => handleAddRowKeyDown("customerMemo", event)}
                    placeholder={t("calls.column.customerMemo")}
                    rowIndex={rowIndex}
                  />
                  <CustomerLinkSelect
                    columnId="customerId"
                    customers={customers}
                    disabled={disabled}
                    name="customerId"
                    onKeyDown={(event) => handleAddRowKeyDown("customerId", event)}
                    rowIndex={rowIndex}
                  />
                </div>
              </td>

              {/* 4. 코스 */}
              <td className="border-b border-border px-2 py-2">
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

              {/* 5. 관리사 */}
              <td className="border-b border-border px-2 py-2">
                <div className="flex items-center gap-1">
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
                  <SelectCell
                    columnId="therapist2Id"
                    disabled={disabled}
                    errorId="add-call-therapist2-error"
                    errorMessage={fieldError(rowState, "therapist2Id")}
                    label={t("calls.column.therapist2")}
                    name="therapist2Id"
                    onGridKeyDown={(event) => handleAddRowKeyDown("therapist2Id", event)}
                    options={options.therapists}
                    rowIndex={rowIndex}
                  />
                </div>
              </td>

              {/* 6. 객실 */}
              <td className="border-b border-border px-2 py-2">
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

              {/* 7. 입장 */}
              <td className="border-b border-border px-2 py-2">
                <ActualEntryCell
                  disabled={disabled}
                  onGridKeyDown={(event) => handleAddRowKeyDown("actualEntryTime", event)}
                  rowIndex={rowIndex}
                />
                <InlineError field="actualEntryTime" state={rowState} />
              </td>

              {/* 8. 종료 */}
              <td className="border-b border-border px-2 py-2 text-center text-xs text-muted">
                -
              </td>

              {/* 9. 결제 */}
              <td className="border-b border-border px-2 py-2">
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

              {/* 10. 할인 */}
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="discountTypeCode"
                  disabled={disabled}
                  label={t("calls.column.discountType")}
                  name="discountTypeCode"
                  onGridKeyDown={(event) => handleAddRowKeyDown("discountTypeCode", event)}
                  options={options.discountTypes}
                  rowIndex={rowIndex}
                />
                <input name="paymentMethodCode" type="hidden" value="CASH" />
                <input name="note" type="hidden" value="" />
              </td>

              {/* 11. 조치 */}
              <td className="border-b border-border px-2 py-2 text-center">
                <div className="flex flex-col items-center gap-1">
                  <Button className="h-8 whitespace-nowrap px-3 text-xs" disabled={disabled} type="submit">
                    {t("calls.addRow.submit")}
                  </Button>
                  <InlineError state={rowState} />
                  {rowState?.ok ? <span className="text-xs text-muted">{t("calls.save.saved")}</span> : null}
                </div>
              </td>

              {showSettlementColumns ? (
                <td className="border-b border-border bg-readonly px-2 py-2" colSpan={5} />
              ) : null}
            </tr>
          </tbody>
        </table>
      </div>
    </form>
  );
}

function draftFromRow(row: ServiceCallRowDto): ServiceCallAutosaveInput {
  return {
    serviceCallId: row.id,
    expectedUpdatedAt: row.savedAt,
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    actualEntryTime: row.actualEntryTime,
    roomId: row.roomId,
    courseId: row.courseId,
    customerMemo: row.customerMemo ?? null,
    customerId: row.customerId ?? null,
    therapist1Id: row.therapist1?.id ?? null,
    therapist2Id: row.therapist2?.id ?? null,
    status: row.status,
    discountTypeCode: row.discountTypeCode ?? null,
    paymentMethodCode: row.paymentMethodCode ?? null,
    note: row.note ?? null,
    confirmationCode: row.confirmationCode ?? null
  };
}

function nullableValue(value: string) {
  return value.trim() === "" ? null : value;
}

function saveStateLabel(state: RowSaveState, t: (key: MessageKey) => string) {
  if (state === "saving") return t("calls.save.saving");
  if (state === "saved") return t("calls.save.saved");
  if (state === "error") return t("calls.save.error");
  return "idle";
}

function saveStateClassName(state: RowSaveState) {
  if (state === "saving") return "text-brand";
  if (state === "saved") return "text-muted";
  if (state === "error") return "text-danger";
  return "text-muted";
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
  saveStatus: RowSaveState;
}) {
  const t = useT();
  const locale = useLocale();
  const isStaleFailedDraft = saveStatus === "error";
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
  saveStatus: RowSaveState;
  value: number;
}) {
  const t = useT();
  const locale = useLocale();
  const isStaleFailedDraft = saveStatus === "error";
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
  options,
  row,
  rowCount,
  rowIndex,
  showSettlementColumns,
  isSelected = false,
  onToggleRowDetail
}: {
  customers: CustomerDto[];
  isLocked: boolean;
  options: ServiceCallFormOptions;
  row: ServiceCallRowDto;
  rowCount: number;
  rowIndex: number;
  showSettlementColumns: boolean;
  isSelected?: boolean;
  onToggleRowDetail?: (callId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<ServiceCallAutosaveInput>(() => draftFromRow(row));
  const [serverRow, setServerRow] = useState<ServiceCallRowDto>(row);
  const [saveStatus, setSaveStatus] = useState<RowSaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAt, setSavedAt] = useState(row.savedAt);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  const customerInfo = parseCustomerCallInfo(row, customers);
  const isDualTherapist =
    Boolean(draft.therapist2Id) ||
    draft.courseId?.toLowerCase().includes("course-d") ||
    draft.courseId?.toLowerCase().includes("2:1");

  const navigableFields = useMemo(
    () => [
      ...EDITABLE_CALL_FIELDS,
      "paymentAmount",
      "discountAmount",
      ...(showSettlementColumns ? ["therapist1Commission", "therapist2Commission"] : []),
      "calculationStatus"
    ],
    [showSettlementColumns]
  );

  const singleTherapistOptions = useMemo(() => {
    return options.therapists.map((o) => {
      const match = o.label.match(/(?:마사지사|Therapist|마)\s*(\d+)/i);
      return {
        ...o,
        label: match ? `마사지사${match[1]}` : o.label.split("(")[0].trim() || o.label
      };
    });
  }, [options.therapists]);

  const shortTherapistOptions = useMemo(() => {
    return options.therapists.map((o) => ({
      ...o,
      label: shortTherapistLabel(o.label)
    }));
  }, [options.therapists]);

  function updateDraft<Key extends keyof ServiceCallAutosaveInput>(key: Key, value: ServiceCallAutosaveInput[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateDraftAndCommit<Key extends keyof ServiceCallAutosaveInput>(key: Key, value: ServiceCallAutosaveInput[Key]) {
    const nextDraft = { ...draft, [key]: value };
    setDraft(nextDraft);
    commit(nextDraft);
  }

  function commit(nextDraft = draft) {
    if (isLocked || saveStatus === "saving") {
      return;
    }

    setSaveStatus("saving");
    setErrorMessage(null);
    setFieldErrors({});
    startTransition(() => {
      void (async () => {
        const result = await autosaveServiceCallRowAction(nextDraft);
        if (result.ok) {
          setDraft(draftFromRow(result.data));
          setServerRow(result.data);
          setSavedAt(result.data.savedAt);
          setSaveStatus("saved");
          setFieldErrors({});
          return;
        }

        setErrorMessage(result.formError ?? t("calls.save.autosaveFailed"));
        setFieldErrors((result.fieldErrors as FieldErrors | undefined) ?? {});
        setSaveStatus("error");
      })();
    });
  }

  function handleEnterService() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(Math.floor(now.getMinutes() / 10) * 10).padStart(2, "0");
    const currentEntry = `${hh}:${mm}`;
    const nextStatus = resolveStatusOptionValue(options.statuses, "IN_USE");
    const nextDraft = {
      ...draft,
      status: nextStatus,
      actualEntryTime: currentEntry
    };
    setDraft(nextDraft);
    commit(nextDraft);
  }

  function handleEarlyFinish() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const finishTime = `${hh}:${mm}`;
    const cleanNote = (draft.note ?? "").replace(/\[종료\s*(([01]\d|2[0-3]):[0-5]\d)\]/g, "").trim();
    const nextNote = cleanNote ? `${cleanNote} [종료 ${finishTime}]` : `[종료 ${finishTime}]`;
    const nextStatus = resolveStatusOptionValue(options.statuses, "CLEANING");
    const nextDraft = {
      ...draft,
      status: nextStatus,
      note: nextNote
    };
    setDraft(nextDraft);
    commit(nextDraft);
  }

  function handleUndoFinish() {
    const nextNote = (draft.note ?? "").replace(/\[종료\s*(([01]\d|2[0-3]):[0-5]\d)\]/g, "").trim() || null;
    const nextStatus = resolveStatusOptionValue(options.statuses, "IN_USE");
    const nextDraft = {
      ...draft,
      status: nextStatus,
      note: nextNote
    };
    setDraft(nextDraft);
    commit(nextDraft);
  }

  function handleFinishCleaning() {
    const completedStatus = resolveStatusOptionValue(options.statuses, "COMPLETED");
    startTransition(() => {
      void (async () => {
        const result = await finishCleaningCallAction({
          serviceCallId: row.id,
          operatingMonthId: draft.operatingMonthId ?? row.operatingMonthId ?? ""
        });
        if (result.ok) {
          setDraft((prev) => ({ ...prev, status: completedStatus }));
          setServerRow((prev) => ({ ...prev, status: completedStatus }));
        }
      })();
    });
  }

  function handleTogglePayment() {
    const nextCode = draft.confirmationCode === "Y" ? "N" : "Y";
    updateDraftAndCommit("confirmationCode", nextCode);
  }

  function handleGridKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLElement>) {
    if (isLocked || saveStatus === "saving") {
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      const nextCell = moveTabCell({ rowIndex, columnId }, rowCount, event.shiftKey);
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
      setDraft(cancelCellDraft(draft, draftFromRow(serverRow)));
      setErrorMessage(null);
      setFieldErrors({});
      setSaveStatus("idle");
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

  const currentStatus = normalizeCallStatus(draft.status);
  const statusBadge = statusBadgeInfo(draft.status);

  // Parse early finish time in note e.g. [종료 15:10]
  const noteText = draft.note ?? serverRow.note ?? "";
  const earlyFinishMatch = noteText.match(/\[종료\s*(([01]\d|2[0-3]):[0-5]\d)\]/);
  let displayEndTimeContent = null;
  if (currentStatus === "RESERVED") {
    displayEndTimeContent = <span className="text-gray-400 font-medium">-</span>;
  } else if (earlyFinishMatch) {
    displayEndTimeContent = (
      <span className="font-bold text-sm text-gray-900 tabular-nums">
        {earlyFinishMatch[1]}
      </span>
    );
  } else if (serverRow.displayEnd) {
    displayEndTimeContent = (
      <span className="font-bold text-sm text-gray-900 tabular-nums">{serverRow.displayEnd}</span>
    );
  } else {
    displayEndTimeContent = <span className="text-gray-400 font-medium">-</span>;
  }

  return (
    <tr
      className={`align-middle border-b border-[#F0EAE1] transition-colors cursor-pointer ${
        isSelected
          ? "bg-[#EBF3FF] ring-2 ring-inset ring-[#0066FF]"
          : rowIndex % 2 === 0
            ? "bg-white hover:bg-[#F7F3EB]"
            : "bg-[#FAF7F2] hover:bg-[#F2ECE0]"
      }`}
      data-service-call-id={row.id}
      id={ledgerCallAnchorId(row.id)}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest("button, select, input, textarea, a, [role='listbox']")) {
          return;
        }
        onToggleRowDetail?.(row.id);
      }}
    >
      {/* 1. 예약시간 */}
      <td className="px-2 py-3 text-center align-middle">
        <SelectCell
          columnId="startTime"
          disabled={isLocked || saveStatus === "saving"}
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
        <input name="serviceCallId" type="hidden" value={draft.serviceCallId} />
        <input name="serviceDate" type="hidden" value={draft.serviceDate} />
      </td>

      {/* 2. 상태 */}
      <td className="px-2 py-3 text-center align-middle">
        <div className="inline-flex items-center justify-center">
          <span
            className={`inline-flex items-center justify-center min-w-[64px] px-3.5 py-1.5 rounded-lg text-xs font-bold ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
          <div className="sr-only">
            <SelectCell
              columnId="status"
              disabled={isLocked || saveStatus === "saving"}
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
          </div>
        </div>
      </td>

      {/* 3. 고객정보 */}
      <td className="border-b border-border px-2.5 py-2.5">
        <div className="flex items-center gap-2">
          <BookingChannelIcon channel={customerInfo.channel} className="w-7 h-7 rounded-full shrink-0 shadow-2xs" />
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <span className="font-bold text-xs text-foreground truncate" title={customerInfo.name || "-"}>
              {customerInfo.name || "-"}
            </span>
            <span className="text-[11px] text-muted font-mono truncate" title={customerInfo.contact || "-"}>
              {customerInfo.contact || "-"}
            </span>
          </div>
        </div>
        <div className="sr-only">
          <CustomerLinkSelect
            columnId="customerId"
            customers={customers}
            disabled={isLocked || saveStatus === "saving"}
            onChange={(value) => updateDraftAndCommit("customerId", nullableValue(value))}
            onKeyDown={(event) => handleGridKeyDown("customerId", event)}
            rowIndex={rowIndex}
            value={draft.customerId ?? ""}
          />
          <TextCell
            columnId="customerMemo"
            disabled={isLocked || saveStatus === "saving"}
            label={t("calls.column.customerMemo")}
            name="customerMemo"
            onBlur={() => commit()}
            onChange={(value) => updateDraft("customerMemo", nullableValue(value))}
            onKeyDown={(event) => handleGridKeyDown("customerMemo", event)}
            placeholder={t("calls.column.customerMemo")}
            rowIndex={rowIndex}
            value={draft.customerMemo ?? ""}
          />
        </div>
      </td>

      {/* 4. 코스 */}
      <td className="border-b border-border px-2.5 py-2.5">
        <div className="flex flex-col justify-center min-w-0">
          {draft.courseId ? (
            (() => {
              const selectedCourse = options.courses.find((c) => c.value === draft.courseId);
              const { line1, line2 } = parseCourseDisplay(selectedCourse?.label);
              return (
                <div className="flex flex-col justify-center leading-tight">
                  <span className="font-bold text-xs text-foreground truncate" title={line1}>
                    {line1}
                  </span>
                  {line2 ? (
                    <span className="text-[11px] text-muted truncate" title={line2}>
                      {line2}
                    </span>
                  ) : null}
                </div>
              );
            })()
          ) : (
            <span className="text-muted text-xs font-medium">-</span>
          )}
          <div className="sr-only">
            <SelectCell
              columnId="courseId"
              disabled={isLocked || saveStatus === "saving"}
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
          </div>
        </div>
      </td>

      {/* 5. 관리사 */}
      <td className="border-b border-border px-2 py-2.5">
        {isDualTherapist ? (
          <div className="flex items-center gap-1 w-full">
            <div className="w-1/2 min-w-0">
              <SelectCell
                columnId="therapist1Id"
                disabled={isLocked || saveStatus === "saving"}
                emptyLabel="선택"
                label={t("calls.column.therapist1")}
                name="therapist1Id"
                onBlur={() => commit()}
                onChange={(value) => updateDraft("therapist1Id", nullableValue(value))}
                onCommitValue={(value) => updateDraftAndCommit("therapist1Id", nullableValue(value))}
                onGridKeyDown={(event) => handleGridKeyDown("therapist1Id", event)}
                options={shortTherapistOptions}
                rowIndex={rowIndex}
                value={draft.therapist1Id ?? ""}
              />
            </div>
            <div className="w-1/2 min-w-0">
              <SelectCell
                columnId="therapist2Id"
                disabled={isLocked || saveStatus === "saving"}
                emptyLabel="선택"
                errorId={`call-${row.id}-therapist2-error`}
                errorMessage={firstFieldError(fieldErrors, "therapist2Id")}
                label={t("calls.column.therapist2")}
                name="therapist2Id"
                onBlur={() => commit()}
                onChange={(value) => updateDraft("therapist2Id", nullableValue(value))}
                onCommitValue={(value) => updateDraftAndCommit("therapist2Id", nullableValue(value))}
                onGridKeyDown={(event) => handleGridKeyDown("therapist2Id", event)}
                options={shortTherapistOptions}
                rowIndex={rowIndex}
                value={draft.therapist2Id ?? ""}
              />
            </div>
          </div>
        ) : (
          <div className="w-full min-w-0">
            <SelectCell
              columnId="therapist1Id"
              disabled={isLocked || saveStatus === "saving"}
              emptyLabel="선택"
              label={t("calls.column.therapist1")}
              name="therapist1Id"
              onBlur={() => commit()}
              onChange={(value) => updateDraft("therapist1Id", nullableValue(value))}
              onCommitValue={(value) => updateDraftAndCommit("therapist1Id", nullableValue(value))}
              onGridKeyDown={(event) => handleGridKeyDown("therapist1Id", event)}
              options={singleTherapistOptions}
              rowIndex={rowIndex}
              value={draft.therapist1Id ?? ""}
            />
            <div className="sr-only">
              <SelectCell
                columnId="therapist2Id"
                disabled={isLocked || saveStatus === "saving"}
                label={t("calls.column.therapist2")}
                name="therapist2Id"
                options={options.therapists}
                rowIndex={rowIndex}
                value={draft.therapist2Id ?? ""}
              />
            </div>
          </div>
        )}
      </td>

      {/* 6. 객실 */}
      <td className="border-b border-border px-2 py-2.5">
        <SelectCell
          columnId="roomId"
          disabled={isLocked || saveStatus === "saving"}
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

      {/* 7. 입장 */}
      <td className="border-b border-border px-2 py-2.5 text-center">
        <ActualEntryCell
          disabled={isLocked || saveStatus === "saving"}
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

      {/* 8. 종료 */}
      <td className="border-b border-border px-2 py-2.5 text-center text-xs [font-variant-numeric:tabular-nums]">
        {displayEndTimeContent}
      </td>

      {/* 9. 결제 */}
      <td className="px-2 py-3 text-center align-middle">
        <div className="inline-flex items-center justify-center">
          <button
            className={`inline-flex items-center justify-center min-w-[70px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              draft.confirmationCode === "Y"
                ? "bg-[#DCF5E3] text-[#1CA84C] hover:bg-[#cff0d7]"
                : "bg-[#FDF3E7] text-[#C27D38] hover:bg-[#faebd8]"
            }`}
            onClick={handleTogglePayment}
            type="button"
          >
            {draft.confirmationCode === "Y"
              ? (locale !== "vi" ? "결제완료" : "Đã thanh toán")
              : (locale !== "vi" ? "미확인" : "Chưa TT")}
          </button>
          <div className="sr-only">
            <PaymentAmountCell
              onKeyDown={(event) => handleReadonlyKeyDown("paymentAmount", event)}
              row={serverRow}
              rowIndex={rowIndex}
              saveStatus={saveStatus}
            />
            <SelectCell
              columnId="confirmationCode"
              disabled={isLocked || saveStatus === "saving"}
              label={t("calls.column.confirmation")}
              name="confirmationCode"
              options={options.confirmationCodes}
              rowIndex={rowIndex}
              value={draft.confirmationCode ?? ""}
            />
          </div>
        </div>
      </td>

      {/* 10. 할인 */}
      <td className="px-2 py-3 align-middle">
        <SelectCell
          columnId="discountTypeCode"
          disabled={isLocked || saveStatus === "saving"}
          emptyLabel="없음"
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
        {serverRow.discountAmount > 0 ? (
          <span className="text-[11px] font-semibold text-rose-600 block mt-0.5 text-center">
            -{formatVnd(locale, serverRow.discountAmount)}
          </span>
        ) : null}
        <div className="sr-only">
          <ComputedCell
            columnId="discountAmount"
            label={t("calls.column.discount")}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.discountAmount}
          />
          <SelectCell
            columnId="paymentMethodCode"
            disabled={isLocked || saveStatus === "saving"}
            label={t("calls.column.paymentMethod")}
            name="paymentMethodCode"
            options={options.paymentMethods}
            rowIndex={rowIndex}
            value={draft.paymentMethodCode ?? ""}
          />
          <TextCell
            columnId="note"
            disabled={isLocked || saveStatus === "saving"}
            label={t("calls.column.note")}
            name="note"
            onBlur={() => commit()}
            onChange={(value) => updateDraft("note", nullableValue(value))}
            placeholder={t("calls.column.note")}
            rowIndex={rowIndex}
            value={draft.note ?? ""}
          />
        </div>
      </td>

      {/* 11. 조치 */}
      <td className="px-2 py-3 text-center align-middle relative">
        {currentStatus === "RESERVED" ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#0066FF] px-3.5 text-xs font-bold text-white hover:bg-[#0052CC] active:scale-95 transition-all shadow-xs cursor-pointer"
            onClick={handleEnterService}
            type="button"
          >
            {locale !== "vi" ? "입장" : "Vào"}
          </button>
        ) : currentStatus === "IN_USE" ? (
          <button
            className="inline-flex h-9 w-full items-center justify-center rounded-xl bg-[#FF1F48] px-3.5 text-xs font-bold text-white hover:bg-[#E01038] active:scale-95 transition-all shadow-xs cursor-pointer"
            onClick={handleEarlyFinish}
            type="button"
          >
            {locale !== "vi" ? "종료" : "Kết thúc"}
          </button>
        ) : currentStatus === "CLEANING" ? (
          <div className="relative inline-flex h-9 w-full rounded-xl overflow-hidden shadow-2xs border border-[#BED9FF] bg-[#E3EFFF]">
            <button
              className="flex-1 py-1.5 px-2 text-xs font-bold text-[#0055FF] hover:bg-[#D5E6FF] transition-colors cursor-pointer text-center"
              onClick={handleFinishCleaning}
              type="button"
            >
              {locale !== "vi" ? "청소 끝" : "Xong dọn"}
            </button>
            <button
              className="px-2 border-l border-[#BED9FF] text-[#0055FF] hover:bg-[#D5E6FF] transition-colors cursor-pointer flex items-center justify-center"
              onClick={() => setActionMenuOpen(!actionMenuOpen)}
              type="button"
            >
              <svg className={`w-3.5 h-3.5 transition-transform ${actionMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {actionMenuOpen ? (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-36 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 text-left shadow-xl"
                onMouseLeave={() => setActionMenuOpen(false)}
              >
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setActionMenuOpen(false);
                    handleFinishCleaning();
                  }}
                  type="button"
                >
                  <span className="text-sm">🧹</span>
                  <span>{locale !== "vi" ? "청소 끝" : "Xong dọn"}</span>
                </button>
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                  onClick={() => {
                    setActionMenuOpen(false);
                    handleUndoFinish();
                  }}
                  type="button"
                >
                  <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>{locale !== "vi" ? "종료 취소" : "Hủy kết thúc"}</span>
                </button>
              </div>
            ) : null}
          </div>
        ) : currentStatus === "COMPLETED" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
            ✓ {locale !== "vi" ? "완료" : "Hoàn tất"}
          </span>
        ) : currentStatus === "NO_SHOW" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-600">
            ✕ {locale !== "vi" ? "노쇼" : "No-show"}
          </span>
        ) : currentStatus === "CANCELLED" ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-neutral-500">
            ⊖ {locale !== "vi" ? "취소" : "Đã hủy"}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>

      {/* 정산 열 (showSettlementColumns=true 일 때만 표시) */}
      {showSettlementColumns ? (
        <>
          <ComputedCell
            columnId="therapist1Commission"
            label={t("calls.column.therapist1Commission")}
            onKeyDown={(event) => handleReadonlyKeyDown("therapist1Commission", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.therapist1Commission}
          />
          <ComputedCell
            columnId="therapist2Commission"
            label={t("calls.column.therapist2Commission")}
            onKeyDown={(event) => handleReadonlyKeyDown("therapist2Commission", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.therapist2Commission}
          />
        </>
      ) : null}

      {/* 저장 상태 (정산 열 켜져 있을 때만 포함) */}
      {showSettlementColumns ? (
        <td
          className="border-b border-border bg-readonly px-2 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-brand"
          data-call-cell-column="calculationStatus"
          data-call-cell-row={rowIndex}
          onKeyDown={(event) => handleReadonlyKeyDown("calculationStatus", event)}
          tabIndex={-1}
        >
          <div className="grid w-full gap-1">
            {saveStatus === "error" ? <span className="text-danger">{t("calls.calc.errorPending")}</span> : null}
            {serverRow.calculationStatus === "calculated" && saveStatus !== "error" ? <span>{t("calls.calc.calculated")}</span> : null}
            {serverRow.calculationStatus === "not_completed" && saveStatus !== "error" ? <span>{t("calls.calc.notCompleted")}</span> : null}
            {(serverRow.calculationStatus === "course_policy_missing" ||
              serverRow.calculationStatus === "therapist_rate_missing" ||
              serverRow.calculationStatus === "second_therapist_required") &&
            saveStatus !== "error" ? (
              <span className="text-danger">{calcMessage(t, serverRow.calculationStatus)}</span>
            ) : null}
            <span aria-live="polite" className={saveStateClassName(saveStatus)}>
              {saveStateLabel(saveStatus, t)}
              {saveStatus === "saved" ? ` ${formatDateTime(locale, savedAt, { hour: "2-digit", minute: "2-digit" })}` : ""}
            </span>
            {saveStatus === "error" ? (
              <span className="grid gap-1">
                <span className="text-danger">{errorMessage ?? t("calls.save.error")}</span>
                <Button className="h-7 justify-self-start px-2 text-xs" onClick={() => commit()} type="button" variant="secondary">
                  {t("calls.save.retry")}
                </Button>
              </span>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

export function EditableCallGrid({
  courseChoice = null,
  customers = [],
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate,
  showSettlementColumns,
  selectedCallId = null,
  onToggleRowDetail
}: {
  courseChoice?: (AvailabilityCourseChoice & { id: number }) | null;
  customers?: CustomerDto[];
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  serviceDate: string;
  showSettlementColumns: boolean;
  selectedCallId?: string | null;
  onToggleRowDetail?: (callId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [showCompletedSection, setShowCompletedSection] = useState(true);

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

  const isCompletedStatus = (status: string) => {
    const norm = normalizeCallStatus(status);
    return norm === "COMPLETED" || norm === "NO_SHOW" || norm === "CANCELLED";
  };
  const activeRows = table.getRowModel().rows.filter((r) => !isCompletedStatus(r.original.status));
  const completedRows = table.getRowModel().rows.filter((r) => isCompletedStatus(r.original.status));

  const completedCount = completedRows.filter((r) => normalizeCallStatus(r.original.status) === "COMPLETED").length;
  const canceledCount = completedRows.filter((r) => normalizeCallStatus(r.original.status) === "CANCELLED").length;
  const noShowCount = completedRows.filter((r) => normalizeCallStatus(r.original.status) === "NO_SHOW").length;

  return (
    <section className="w-full min-w-0">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">
          원장 그리드
          <span className="sr-only">콜 원장 그리드</span>
        </h2>
        {isLocked ? (
          <div className="text-xs text-rose-600">
            <span className="font-semibold">{t("calls.grid.lockedTitle")}: </span>
            <span>{t("calls.grid.lockedCallDescription")}</span>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#E5E0D8] bg-white shadow-xs">
        {rows.length === 0 ? (
          <div className="grid gap-3 px-4 py-8 text-center">
            <p className="text-sm font-medium text-gray-700">{t("calls.grid.empty.title")}</p>
            <p className="mt-1 text-xs text-gray-500">{t("calls.grid.empty.description")}</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(showSettlementColumns) }}>
              <CallGridColgroup showSettlementColumns={showSettlementColumns} />
              <CallGridHead showSettlementColumns={showSettlementColumns} />
              <tbody>
                {(activeRows.length > 0 ? activeRows : table.getRowModel().rows).map((tableRow) => (
                  <EditableCallRow
                    customers={customers}
                    isLocked={isLocked}
                    isSelected={selectedCallId === tableRow.original.id}
                    key={tableRow.original.id}
                    onToggleRowDetail={onToggleRowDetail}
                    options={options}
                    row={tableRow.original}
                    rowCount={table.getRowModel().rows.length + 1}
                    rowIndex={tableRow.index}
                    showSettlementColumns={showSettlementColumns}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {completedRows.length > 0 ? (
        <div className="mt-3">
          {/* Bottom Collapsible Bar (222.png) */}
          <div
            className="flex items-center justify-between rounded-2xl border border-[#EADBCE] bg-[#FAF7F2] px-5 py-3.5 shadow-2xs hover:bg-[#F3EFE6] transition-colors cursor-pointer"
            onClick={() => setShowCompletedSection((prev) => !prev)}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A] text-white text-xs font-bold">✓</span>
                <span>완료 {completedCount}건</span>
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-xs font-bold">⊖</span>
                <span>취소 {canceledCount}건</span>
              </span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#DC2626] text-white text-xs font-bold">✕</span>
                <span>노쇼 {noShowCount}건</span>
              </span>
            </div>
            <div className="text-gray-500">
              <svg
                className={`h-5 w-5 transition-transform duration-200 ${showCompletedSection ? "rotate-180" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
              </svg>
            </div>
          </div>

          {showCompletedSection ? (
            <div className="mt-2 overflow-hidden rounded-2xl border border-[#E5E0D8] bg-white shadow-xs">
              <div className="relative overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(showSettlementColumns) }}>
                  <CallGridColgroup showSettlementColumns={showSettlementColumns} />
                  <CallGridHead showSettlementColumns={showSettlementColumns} />
                  <tbody>
                    {completedRows.map((tableRow) => (
                      <EditableCallRow
                        customers={customers}
                        isLocked={isLocked}
                        isSelected={selectedCallId === tableRow.original.id}
                        key={tableRow.original.id}
                        onToggleRowDetail={onToggleRowDetail}
                        options={options}
                        row={tableRow.original}
                        rowCount={table.getRowModel().rows.length + 1}
                        rowIndex={tableRow.index}
                        showSettlementColumns={showSettlementColumns}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <AddRowForm
        courseChoice={courseChoice}
        customers={customers}
        existingRowCount={table.getRowModel().rows.length}
        isLocked={isLocked}
        operatingMonthId={operatingMonthId}
        options={options}
        serviceDate={serviceDate}
        showSettlementColumns={showSettlementColumns}
      />
    </section>
  );
}
