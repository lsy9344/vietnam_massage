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
import type { ServiceCallCalculationStatus, ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import type { ServiceCallAutosaveInput } from "@/modules/calls/service-call-schema";
import { autosaveServiceCallRowAction, saveBasicServiceCallRowAction, type ServiceCallActionState } from "@/app/(erp)/calls/actions";
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

// Shared fixed column widths so the data table and the add-row table align
// column-for-column. `id` is a stable English key (React key); `labelKey` points
// at the localized header text in the message catalog.
const CALL_GRID_COLUMNS = [
  { id: "date", labelKey: "calls.column.date", width: "5.5rem" },
  { id: "time", labelKey: "calls.column.time", width: "9rem" },
  { id: "room", labelKey: "calls.column.room", width: "9rem" },
  { id: "course", labelKey: "calls.column.course", width: "10rem" },
  { id: "customerMemo", labelKey: "calls.column.customerMemo", width: "12rem" },
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
  { id: "saveStatus", labelKey: "calls.column.saveStatus", width: "10rem" }
] as const satisfies ReadonlyArray<{ id: string; labelKey: MessageKey; width: string; settlement?: boolean }>;

function visibleCallGridColumns(showSettlementColumns: boolean) {
  return CALL_GRID_COLUMNS.filter((column) => showSettlementColumns || !("settlement" in column && column.settlement));
}

function callGridMinWidth(showSettlementColumns: boolean) {
  return showSettlementColumns ? "169rem" : "142rem";
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
  return (
    <thead className="bg-readonly text-xs font-semibold text-foreground">
      <tr>
        {visibleCallGridColumns(showSettlementColumns).map((column) => (
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
  value,
  errorId,
  errorMessage
}: {
  columnId?: string;
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
  value?: string;
}) {
  const t = useT();
  const invalid = Boolean(errorMessage);
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

  return (
    <label className="grid w-full gap-1">
      <span className="sr-only">{label}</span>
      <input
        aria-activedescendant={open && activeOption ? `${reactId}-option-${activeOption.value}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={invalid && errorId ? errorId : undefined}
        aria-expanded={open}
        aria-invalid={invalid ? "true" : undefined}
        aria-label={label}
        autoComplete="off"
        className={`h-8 w-full border bg-background px-2 text-xs text-foreground outline-none disabled:bg-readonly ${
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

function AddRowForm({
  existingRowCount,
  isLocked,
  operatingMonthId,
  options,
  serviceDate,
  showSettlementColumns
}: {
  existingRowCount: number;
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  serviceDate: string;
  showSettlementColumns: boolean;
}) {
  const t = useT();
  const [state, formAction, pending] = useActionState<ServiceCallActionState, FormData>(saveBasicServiceCallRowAction, null);
  const disabled = isLocked || pending;
  const rowIndex = existingRowCount;
  const rowCount = existingRowCount + 1;

  function handleAddRowKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLInputElement>) {
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
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(showSettlementColumns) }}>
          <CallGridColgroup showSettlementColumns={showSettlementColumns} />
          <CallGridHead showSettlementColumns={showSettlementColumns} />
          <tbody>
            <tr className="align-top">
              <td className="border-b border-border px-2 py-2 text-xs text-muted">{serviceDate}</td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="startTime"
                  disabled={disabled}
                  label={t("calls.column.time")}
                  name="startTime"
                  onGridKeyDown={(event) => handleAddRowKeyDown("startTime", event)}
                  options={options.timeSlots}
                  required
                  rowIndex={rowIndex}
                />
                <InlineError field="startTime" state={state} />
              </td>
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
                <InlineError field="roomId" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="courseId"
                  disabled={disabled}
                  label={t("calls.column.course")}
                  name="courseId"
                  onGridKeyDown={(event) => handleAddRowKeyDown("courseId", event)}
                  options={options.courses}
                  required
                  rowIndex={rowIndex}
                />
                <InlineError field="courseId" state={state} />
              </td>
              <td className="border-b border-border px-2 py-2">
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
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="therapist1Id"
                  disabled={disabled}
                  label={t("calls.column.therapist1")}
                  name="therapist1Id"
                  onGridKeyDown={(event) => handleAddRowKeyDown("therapist1Id", event)}
                  options={options.therapists}
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  disabled={disabled}
                  errorId="add-call-therapist2-error"
                  errorMessage={fieldError(state, "therapist2Id")}
                  columnId="therapist2Id"
                  label={t("calls.column.therapist2")}
                  name="therapist2Id"
                  onGridKeyDown={(event) => handleAddRowKeyDown("therapist2Id", event)}
                  options={options.therapists}
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
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
                <InlineError field="status" state={state} />
              </td>
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
              </td>
              <td className="border-b border-border px-2 py-2">
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
              <td className="border-b border-border px-2 py-2">
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
              <td className="border-b border-border bg-readonly px-2 py-2" colSpan={showSettlementColumns ? 7 : 3}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="h-8 whitespace-nowrap px-3 text-xs" disabled={disabled} type="submit">
                    {t("calls.addRow.submit")}
                  </Button>
                  <InlineError state={state} />
                  {state?.ok ? <span className="text-xs text-muted">{t("calls.save.saved")}</span> : null}
                </div>
              </td>
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
    operatingMonthId: row.operatingMonthId,
    serviceDate: row.serviceDate,
    startTime: row.startTime,
    roomId: row.roomId,
    courseId: row.courseId,
    customerMemo: row.customerMemo ?? null,
    therapist1Id: row.therapist1?.id ?? null,
    therapist2Id: row.therapist2?.id ?? null,
    earcareEmployeeId: row.earcare?.id ?? null,
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

// 서비스가 만든 한국어 calculationErrorMessage 대신, 안정적인 calculationStatus(kind)로
// 번역 키를 골라 표시한다. 화면이 i18n 경계를 직접 통과시키도록 한다.
function calcMessage(t: (key: MessageKey) => string, status: ServiceCallCalculationStatus) {
  if (status === "course_policy_missing") return t("calls.calc.coursePolicyMissing");
  if (status === "therapist_rate_missing") return t("calls.calc.therapistRateMissing");
  if (status === "second_therapist_required") return t("calls.calc.secondTherapistRequired");
  return t("calls.calc.policyMissing");
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
  isLocked,
  options,
  row,
  rowCount,
  rowIndex,
  showSettlementColumns
}: {
  isLocked: boolean;
  options: ServiceCallFormOptions;
  row: ServiceCallRowDto;
  rowCount: number;
  rowIndex: number;
  showSettlementColumns: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const [draft, setDraft] = useState<ServiceCallAutosaveInput>(() => draftFromRow(row));
  const [serverRow, setServerRow] = useState<ServiceCallRowDto>(row);
  const [saveStatus, setSaveStatus] = useState<RowSaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savedAt, setSavedAt] = useState(row.savedAt);
  const [, startTransition] = useTransition();
  const navigableFields = useMemo(
    () => [
      ...EDITABLE_CALL_FIELDS,
      "paymentAmount",
      "discountAmount",
      ...(showSettlementColumns ? ["therapist1Commission", "therapist2Commission", "earcarePoolAmount", "opsCallCredit"] : []),
      "calculationStatus"
    ],
    [showSettlementColumns]
  );

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
        setFieldErrors(result.fieldErrors ?? {});
        setSaveStatus("error");
      })();
    });
  }

  function handleGridKeyDown(columnId: EditableCallField, event: KeyboardEvent<HTMLInputElement>) {
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

  return (
    <tr className="align-top" data-service-call-id={row.id}>
      <td className="border-b border-border px-2 py-2 text-xs">
        {draft.serviceDate}
        <input name="serviceCallId" type="hidden" value={draft.serviceCallId} />
      </td>
      <td className="border-b border-border px-2 py-2">
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
      </td>
      <td className="border-b border-border px-2 py-2">
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
      <td className="border-b border-border px-2 py-2">
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
      </td>
      <td className="border-b border-border px-2 py-2">
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
        <span className="sr-only">{draft.customerMemo ?? ""}</span>
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="therapist1Id"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="therapist2Id"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="earcareEmployeeId"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
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
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="discountTypeCode"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="paymentMethodCode"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
        <TextCell
          columnId="note"
          disabled={isLocked || saveStatus === "saving"}
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
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="confirmationCode"
          disabled={isLocked || saveStatus === "saving"}
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
      <PaymentAmountCell
        onKeyDown={(event) => handleReadonlyKeyDown("paymentAmount", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
      />
      <ComputedCell
        columnId="discountAmount"
        label={t("calls.column.discount")}
        onKeyDown={(event) => handleReadonlyKeyDown("discountAmount", event)}
        row={serverRow}
        rowIndex={rowIndex}
        saveStatus={saveStatus}
        value={serverRow.discountAmount}
      />
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
          <ComputedCell
            columnId="earcarePoolAmount"
            label={t("calls.column.earcarePool")}
            onKeyDown={(event) => handleReadonlyKeyDown("earcarePoolAmount", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.earcarePoolAmount}
          />
          <ComputedCell
            columnId="opsCallCredit"
            label={t("calls.column.opsCallCredit")}
            onKeyDown={(event) => handleReadonlyKeyDown("opsCallCredit", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.opsCallCredit}
          />
        </>
      ) : null}
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
    </tr>
  );
}

export function EditableCallGrid({
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate,
  showSettlementColumns
}: {
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  serviceDate: string;
  showSettlementColumns: boolean;
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
    <section className="border border-border bg-surface">
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
        <div className="grid gap-3 px-4 py-8">
          <div>
            <p className="text-sm font-medium text-foreground">{t("calls.grid.empty.title")}</p>
            <p className="mt-1 text-xs text-muted">{t("calls.grid.empty.description")}</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-left text-sm" style={{ minWidth: callGridMinWidth(showSettlementColumns) }}>
            <CallGridColgroup showSettlementColumns={showSettlementColumns} />
            <CallGridHead showSettlementColumns={showSettlementColumns} />
            <tbody>
              {table.getRowModel().rows.map((tableRow, index) => (
                <EditableCallRow
                  isLocked={isLocked}
                  key={tableRow.original.id}
                  options={options}
                  row={tableRow.original}
                  rowCount={table.getRowModel().rows.length + 1}
                  rowIndex={index}
                  showSettlementColumns={showSettlementColumns}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddRowForm
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
