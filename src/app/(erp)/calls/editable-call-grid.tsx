"use client";

import {
  useActionState,
  useCallback,
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
import type { ServiceCallFormOptions, ServiceCallOption, ServiceCallRowDto } from "@/modules/calls/service-call-service";
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
// column-for-column. Order matches the header arrays below.
const CALL_GRID_COLUMNS = [
  { header: "날짜", width: "5.5rem" },
  { header: "시간", width: "9rem" },
  { header: "객실", width: "9rem" },
  { header: "코스", width: "10rem" },
  { header: "고객/메모", width: "12rem" },
  { header: "마사지사1", width: "9rem" },
  { header: "마사지사2", width: "9rem" },
  { header: "귀케어 담당", width: "9rem" },
  { header: "예약상태", width: "8rem" },
  { header: "할인구분", width: "9rem" },
  { header: "결제수단", width: "9rem" },
  { header: "비고", width: "11rem" },
  { header: "확인값", width: "9rem" },
  { header: "결제금액", width: "8rem" },
  { header: "할인", width: "6rem" },
  { header: "마사지사1수당", width: "7rem", settlement: true },
  { header: "마사지사2수당", width: "7rem", settlement: true },
  { header: "귀케어풀", width: "6.5rem", settlement: true },
  { header: "콜인정", width: "6rem", settlement: true },
  { header: "저장상태", width: "10rem" }
] as const;

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
        <col key={column.header} style={{ width: column.width }} />
      ))}
    </colgroup>
  );
}

function CallGridHead({ showSettlementColumns }: { showSettlementColumns: boolean }) {
  return (
    <thead className="bg-readonly text-xs font-semibold text-foreground">
      <tr>
        {visibleCallGridColumns(showSettlementColumns).map((column) => (
          <th className="whitespace-nowrap border-b border-border px-2 py-2 align-middle" key={column.header}>
            {column.header}
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

function optionLabel(options: ServiceCallOption[], value: string | null | undefined) {
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
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCommitValue?: (value: string) => void;
  onGridKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  options: ServiceCallOption[];
  required?: boolean;
  rowIndex?: number;
  value?: string;
}) {
  const invalid = Boolean(errorMessage);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const selectedValue = isControlled ? (value ?? "") : internalValue;
  const [inputValue, setInputValue] = useState(() => optionLabel(options, selectedValue));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const skipNextBlurCommit = useRef(false);
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
    const nextLabel = option?.label ?? "";
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
    setInputValue(optionLabel(options, selectedValue));
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
          setInputValue(optionLabel(options, selectedValue));
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
              {filteredOptions.length === 0 ? <li className="px-2 py-1.5 text-muted">검색 결과 없음</li> : null}
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
                  label="시간"
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
                  label="객실"
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
                  label="코스"
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
                  label="고객/메모"
                  name="customerMemo"
                  onKeyDown={(event) => handleAddRowKeyDown("customerMemo", event)}
                  placeholder="고객/메모"
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="therapist1Id"
                  disabled={disabled}
                  label="마사지사1"
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
                  label="마사지사2"
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
                  label="귀케어 담당"
                  name="earcareEmployeeId"
                  onGridKeyDown={(event) => handleAddRowKeyDown("earcareEmployeeId", event)}
                  options={options.earcareEmployees}
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="status"
                  defaultValue="예약"
                  disabled={disabled}
                  label="상태"
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
                  label="할인구분"
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
                  label="결제수단"
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
                  label="비고"
                  name="note"
                  onKeyDown={(event) => handleAddRowKeyDown("note", event)}
                  placeholder="비고"
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border px-2 py-2">
                <SelectCell
                  columnId="confirmationCode"
                  disabled={disabled}
                  label="확인값"
                  name="confirmationCode"
                  onGridKeyDown={(event) => handleAddRowKeyDown("confirmationCode", event)}
                  options={options.confirmationCodes}
                  rowIndex={rowIndex}
                />
              </td>
              <td className="border-b border-border bg-readonly px-2 py-2" colSpan={showSettlementColumns ? 7 : 3}>
                <div className="flex flex-wrap items-center gap-2">
                  <Button className="h-8 whitespace-nowrap px-3 text-xs" disabled={disabled} type="submit">
                    새 콜 행 추가
                  </Button>
                  <InlineError state={state} />
                  {state?.ok ? <span className="text-xs text-muted">저장됨</span> : null}
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

function saveStateLabel(state: RowSaveState) {
  if (state === "saving") return "저장중";
  if (state === "saved") return "저장됨";
  if (state === "error") return "저장 보류";
  return "idle";
}

function saveStateClassName(state: RowSaveState) {
  if (state === "saving") return "text-brand";
  if (state === "saved") return "text-muted";
  if (state === "error") return "text-danger";
  return "text-muted";
}

function firstFieldError(fieldErrors: FieldErrors, field: string) {
  return fieldErrors[field]?.[0] ?? null;
}

function formatVnd(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
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
  const isStaleFailedDraft = saveStatus === "error";
  const canShowAmount = row.calculationStatus === "calculated" && !isStaleFailedDraft;
  const title = isStaleFailedDraft ? "저장 보류 중인 draft는 재계산값으로 표시하지 않습니다." : row.calculationErrorMessage ?? undefined;

  return (
    <td
      className="border-b border-border bg-readonly px-2 py-2 text-right text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-brand [font-variant-numeric:tabular-nums]"
      data-call-cell-column="paymentAmount"
      data-call-cell-row={rowIndex}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <span className="sr-only">결제금액</span>
      <span className="grid gap-0.5" title={title}>
        {canShowAmount && row.discountAmount > 0 && row.basePrice > row.paymentAmount ? (
          <span className="text-[11px] text-muted line-through">{formatVnd(row.basePrice)}</span>
        ) : null}
        <span className={canShowAmount && row.discountAmount > 0 ? "font-bold text-foreground" : ""}>
          {canShowAmount ? formatVnd(row.paymentAmount) : "—"}
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
  const isStaleFailedDraft = saveStatus === "error";
  const displayValue = row.calculationStatus === "calculated" && !isStaleFailedDraft ? formatVnd(value) : "—";
  return (
    <td
      className="border-b border-border bg-readonly px-2 py-2 text-right text-xs font-medium text-foreground outline-none focus:ring-1 focus:ring-brand [font-variant-numeric:tabular-nums]"
      data-call-cell-column={columnId}
      data-call-cell-row={rowIndex}
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <span className="sr-only">{label}</span>
      <span title={isStaleFailedDraft ? "저장 보류 중인 draft는 재계산값으로 표시하지 않습니다." : row.calculationErrorMessage ?? undefined}>
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

        setErrorMessage(result.formError ?? "콜 행 자동저장에 실패했습니다.");
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
          label="시간"
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
          label="객실"
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
          label="코스"
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
          label="고객/메모"
          name="customerMemo"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("customerMemo", nullableValue(value))}
          onKeyDown={(event) => handleGridKeyDown("customerMemo", event)}
          placeholder="고객/메모"
          rowIndex={rowIndex}
          value={draft.customerMemo ?? ""}
        />
        <span className="sr-only">{draft.customerMemo ?? ""}</span>
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="therapist1Id"
          disabled={isLocked || saveStatus === "saving"}
          label="마사지사1"
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
          label="마사지사2"
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
          label="귀케어 담당"
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
          label="상태"
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
          label="할인구분"
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
          label="결제수단"
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
          label="비고"
          name="note"
          onBlur={() => commit()}
          onChange={(value) => updateDraft("note", nullableValue(value))}
          onKeyDown={(event) => handleGridKeyDown("note", event)}
          placeholder="비고"
          rowIndex={rowIndex}
          value={draft.note ?? ""}
        />
      </td>
      <td className="border-b border-border px-2 py-2">
        <SelectCell
          columnId="confirmationCode"
          disabled={isLocked || saveStatus === "saving"}
          label="확인값"
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
        label="할인"
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
            label="마사지사1수당"
            onKeyDown={(event) => handleReadonlyKeyDown("therapist1Commission", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.therapist1Commission}
          />
          <ComputedCell
            columnId="therapist2Commission"
            label="마사지사2수당"
            onKeyDown={(event) => handleReadonlyKeyDown("therapist2Commission", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.therapist2Commission}
          />
          <ComputedCell
            columnId="earcarePoolAmount"
            label="귀케어풀"
            onKeyDown={(event) => handleReadonlyKeyDown("earcarePoolAmount", event)}
            row={serverRow}
            rowIndex={rowIndex}
            saveStatus={saveStatus}
            value={serverRow.earcarePoolAmount}
          />
          <ComputedCell
            columnId="opsCallCredit"
            label="콜인정"
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
          {saveStatus === "error" ? <span className="text-danger">저장 보류 계산 대기</span> : null}
          {serverRow.calculationStatus === "calculated" && saveStatus !== "error" ? <span>계산됨</span> : null}
          {serverRow.calculationStatus === "not_completed" && saveStatus !== "error" ? <span>비완료 제외</span> : null}
          {(serverRow.calculationStatus === "course_policy_missing" ||
            serverRow.calculationStatus === "therapist_rate_missing" ||
            serverRow.calculationStatus === "second_therapist_required") &&
          saveStatus !== "error" ? (
            <span className="text-danger">{serverRow.calculationErrorMessage ?? "정책 없음"}</span>
          ) : null}
          <span aria-live="polite" className={saveStateClassName(saveStatus)}>
            {saveStateLabel(saveStatus)}
            {saveStatus === "saved" ? ` ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
          {saveStatus === "error" ? (
            <span className="grid gap-1">
              <span className="text-danger">{errorMessage ?? "저장 보류"}</span>
              <Button className="h-7 justify-self-start px-2 text-xs" onClick={() => commit()} type="button" variant="secondary">
                재시도
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
  const columns = useMemo<ColumnDef<ServiceCallRowDto>[]>(
    () => [
      { accessorKey: "serviceDate", header: "날짜" },
      ...EDITABLE_CALL_FIELDS.map((field) => ({ accessorKey: field, header: field })),
      { accessorKey: "paymentAmount", header: "결제금액" },
      { accessorKey: "discountAmount", header: "할인" },
      ...(showSettlementColumns
        ? [
            { accessorKey: "therapist1Commission", header: "마사지사1수당" },
            { accessorKey: "therapist2Commission", header: "마사지사2수당" },
            { accessorKey: "earcarePoolAmount", header: "귀케어풀" },
            { accessorKey: "opsCallCredit", header: "콜인정" }
          ]
        : []),
      { accessorKey: "calculationStatus", header: "저장상태" }
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
          <h2 className="text-base font-semibold text-foreground">콜 원장 그리드</h2>
          {isLocked ? (
            <div className="mt-1 text-xs text-danger">
              <p className="font-medium">잠긴 운영월입니다.</p>
              <p>마감확정 또는 잠금 운영월입니다. 새 콜 행 추가와 수정이 차단됩니다.</p>
            </div>
          ) : null}
        </div>
        <span className="text-xs text-muted">{rows.length}개 행</span>
      </div>

      {rows.length === 0 ? (
        <div className="grid gap-3 px-4 py-8">
          <div>
            <p className="text-sm font-medium text-foreground">이 날짜의 콜이 없습니다</p>
            <p className="mt-1 text-xs text-muted">아래 입력 행에서 원본 실시간콜입력 A:S 의미의 기본 필드를 기록한다.</p>
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
