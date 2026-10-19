"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/lib/i18n/client";
import type { ServiceCallOption } from "@/modules/calls/service-call-service";
import { spokenClock } from "@/app/(erp)/calls/call-warning-label";

/**
 * 원장 편집 패널(티켓 03)의 입력칸. 예전 원장 표의 type-ahead 선택칸(Story 2.6)을 그대로 옮겨 패널 크기(44px)로
 * 그린다. 칸마다 `data-call-field`에 저장 필드 이름을 달아 패널의 첫 칸 찾기와 E2E가 쓴다.
 */

const fieldClass =
  "h-11 w-full rounded-sm border bg-surface px-3 text-sm text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary disabled:bg-readonly disabled:text-muted";

export function FieldErrorMessage({ id, message }: { id: string; message: string | null }) {
  if (!message) {
    return null;
  }

  return (
    <span className="flex items-start gap-1 text-sm font-medium text-danger" id={id} role="alert">
      <span aria-hidden="true" className="font-bold">
        !
      </span>
      <span>{message}</span>
    </span>
  );
}

export function optionLabel(options: ServiceCallOption[], value: string | null | undefined, emptyLabel = "") {
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

const LISTBOX_MAX_HEIGHT = 240; // px
const LISTBOX_GAP = 4; // px gap between the input and the popup.

// 패널은 세로로 스크롤되는 상자라 그 안에 절대 위치로 띄운 목록은 잘린다. 입력칸의 화면 위치에 맞춰 body에
// 그리고(portal), 화면 아래쪽에서는 입력칸 위로 뒤집어 스크롤 없이 항목이 보이게 한다. 원장 줄의 칸 안 목록
// (ledger-cell-picker.tsx)도 같은 자리 재기를 쓴다.
export function measureListboxPosition(anchor: HTMLElement): ListboxPosition {
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

// 첫 위치는 목록 자신의 callback ref(measureRef)가 재고, 열려 있는 동안은 scroll·resize가 따라가게 한다.
// setState를 effect 본문에서 바로 부르지 않고 이벤트 콜백에서만 부른다.
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

/**
 * type-ahead 선택칸(role=combobox). 글자를 치면 목록을 거르고, ↓로 열고 ↑↓로 고르고 Enter로 정한다. Esc는 열린
 * 목록만 닫고(preventDefault) 그 밖에서는 원장 키보드(목록으로 돌아가기)에 넘긴다. 고르면 onCommitValue로 바로
 * 저장하고, 고르지 않고 떠나면 onBlur로 지금 초안을 저장한다.
 */
export function SelectField({
  describedBy,
  disabled,
  emptyLabel,
  errorMessage,
  field,
  hint,
  label,
  onBlur,
  onChange,
  onCommitValue,
  options,
  required,
  value
}: {
  describedBy?: string;
  disabled: boolean;
  emptyLabel?: string;
  errorMessage?: string | null;
  field: string;
  hint?: ReactNode;
  label: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  onCommitValue?: (value: string) => void;
  options: ServiceCallOption[];
  required?: boolean;
  value: string;
}) {
  const t = useT();
  const invalid = Boolean(errorMessage);
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const errorId = `${reactId}-error`;
  const describedByIds = [describedBy, invalid ? errorId : null].filter(Boolean).join(" ");
  const [inputValue, setInputValue] = useState(() => optionLabel(options, value, emptyLabel));
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const skipNextBlurCommit = useRef(false);
  // 언어 전환(router.refresh)이나 바깥에서 값이 바뀌면, 목록이 닫혀 있을 때 표시값을 지금 라벨로 다시 맞춘다.
  const resolvedLabel = optionLabel(options, value, emptyLabel);
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

  function selectOption(option: ServiceCallOption | null) {
    const nextValue = option?.value ?? "";
    setInputValue(option?.label ?? emptyLabel ?? "");
    setOpen(false);
    setActiveIndex(0);
    onChange?.(nextValue);
    if (onCommitValue) {
      skipNextBlurCommit.current = true;
      onCommitValue(nextValue);
    }
  }

  // 표시값은 목록이 닫힐 때 위 effect가 지금 값의 라벨로 되돌린다. 여기서 라벨을 직접 넣으면 blur 지연(120ms)
  // 사이에 바깥에서 바뀐 값(다시 불러오기 등)을 그 전 값으로 덮는다.
  function closeAndRestore() {
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => Math.min(Math.max(current + direction, 0), Math.max(filteredOptions.length - 1, 0)));
      return;
    }

    if (open && event.key === "Enter") {
      event.preventDefault();
      if (!activeOption) {
        // 거른 결과가 없으면 지금 값을 지우지 않고 목록만 닫는다.
        closeAndRestore();
        return;
      }
      selectOption(activeOption);
      return;
    }

    if (open && event.key === "Escape") {
      event.preventDefault();
      closeAndRestore();
      return;
    }

    if (event.key === "ArrowDown" && !open) {
      event.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-muted" htmlFor={`${reactId}-input`}>
        {label}
      </label>
      <input
        aria-activedescendant={open && activeOption ? `${reactId}-option-${activeOption.value}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-describedby={describedByIds || undefined}
        aria-expanded={open}
        aria-invalid={invalid ? "true" : undefined}
        autoComplete="off"
        className={`${fieldClass} ${invalid ? "border-danger ring-1 ring-danger" : "border-border-strong"}`}
        data-call-field={field}
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
          // 누르면 지금 값만이 아니라 모든 항목을 바로 보인다. 아무것도 고르지 않고 떠나면 지금 값으로 돌아간다.
          setInputValue("");
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={(event) => {
          setInputValue(optionLabel(options, value, emptyLabel));
          event.currentTarget.select();
        }}
        onKeyDown={handleKeyDown}
        ref={setInputEl}
        required={required}
        role="combobox"
        value={inputValue}
      />
      {hint}
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              className="fixed z-50 overflow-auto rounded-lg border border-border bg-surface-float p-1.5 text-sm shadow-[var(--shadow-float)]"
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
                  aria-selected={value === ""}
                  className="flex min-h-11 cursor-pointer items-center rounded-sm px-3 hover:bg-readonly"
                  id={`${reactId}-option-empty`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(null);
                  }}
                  role="option"
                >
                  -
                </li>
              ) : null}
              {filteredOptions.map((option, index) => (
                <li
                  aria-selected={option.value === value}
                  className={`flex min-h-11 cursor-pointer items-center rounded-sm px-3 hover:bg-readonly ${index === activeIndex ? "bg-readonly" : ""}`}
                  id={`${reactId}-option-${option.value}`}
                  key={option.value}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  role="option"
                >
                  {option.label}
                </li>
              ))}
              {filteredOptions.length === 0 ? <li className="flex min-h-11 items-center px-3 text-muted">{t("calls.placeholder.searchEmpty")}</li> : null}
            </ul>,
            document.body
          )
        : null}
      <FieldErrorMessage id={errorId} message={errorMessage ?? null} />
    </div>
  );
}

export function TextField({
  disabled,
  field,
  label,
  maxLength,
  onBlur,
  onChange,
  value
}: {
  disabled: boolean;
  field: string;
  label: string;
  maxLength?: number;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  value: string;
}) {
  const reactId = useId();
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-muted" htmlFor={reactId}>
        {label}
      </label>
      <input
        className={`${fieldClass} border-border-strong`}
        data-call-field={field}
        disabled={disabled}
        id={reactId}
        maxLength={maxLength ?? 500}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        value={value}
      />
    </div>
  );
}

/**
 * 분 단위 시각 칸(1018 스펙 D11). 실제입장·실제 종료가 쓴다. 고치는 동안은 초안만 바꾸고 칸을 떠나면 저장한다.
 */
export function ClockTimeField({
  describedBy,
  disabled,
  errorMessage,
  field,
  hint,
  label,
  onBlur,
  onChange,
  value
}: {
  describedBy?: string;
  disabled: boolean;
  errorMessage?: string | null;
  field: string;
  hint?: ReactNode;
  label: string;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  value: string;
}) {
  const reactId = useId();
  const errorId = `${reactId}-error`;
  const invalid = Boolean(errorMessage);
  const describedByIds = [describedBy, invalid ? errorId : null].filter(Boolean).join(" ");
  return (
    <div className="grid gap-1.5">
      <label className="text-xs font-semibold text-muted" htmlFor={reactId}>
        {label}
      </label>
      <input
        aria-describedby={describedByIds || undefined}
        aria-invalid={invalid ? "true" : undefined}
        className={`${fieldClass} ${invalid ? "border-danger ring-1 ring-danger" : "border-border-strong"}`}
        data-call-field={field}
        disabled={disabled}
        id={reactId}
        onBlur={onBlur}
        onChange={(event) => onChange?.(event.target.value)}
        type="time"
        value={value}
      />
      {hint}
      <FieldErrorMessage id={errorId} message={errorMessage ?? null} />
    </div>
  );
}

/** 실제입장 칸. 예약시각은 그대로라는 안내, 표시 종료, 다음 예약에 양보해야 하는 시각 경고를 칸 아래에 둔다. */
export function ActualEntryField({
  disabled,
  displayEnd,
  errorMessage,
  onBlur,
  onChange,
  value,
  warningTime
}: {
  disabled: boolean;
  displayEnd?: string | null;
  errorMessage?: string | null;
  onBlur?: () => void;
  onChange?: (value: string) => void;
  value: string;
  warningTime?: string | null;
}) {
  const t = useT();
  const reactId = useId();
  const helpId = `${reactId}-actual-entry-help`;
  const warningId = `${reactId}-actual-entry-warning`;
  const warning = warningTime ? t("calls.actualEntry.warning", { time: spokenClock(warningTime) }) : null;

  return (
    <ClockTimeField
      describedBy={[helpId, warning ? warningId : null].filter(Boolean).join(" ")}
      disabled={disabled}
      errorMessage={errorMessage}
      field="actualEntryTime"
      hint={
        <>
          <p className="text-xs text-muted" id={helpId}>
            {t("calls.actualEntry.helper")}
          </p>
          {displayEnd ? <p className="text-xs text-foreground">{t("calls.actualEntry.displayEnd", { time: displayEnd })}</p> : null}
          {warning ? (
            <p className="text-xs text-danger" id={warningId}>
              {warning}
            </p>
          ) : null}
        </>
      }
      label={t("calls.column.actualEntry")}
      onBlur={onBlur}
      onChange={onChange}
      value={value}
    />
  );
}

export function nullableValue(value: string) {
  return value.trim() === "" ? null : value;
}

export function firstFieldError(fieldErrors: Record<string, string[]>, field: string) {
  return fieldErrors[field]?.[0] ?? null;
}
