"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { measureListboxPosition } from "@/app/(erp)/calls/call-ledger-fields";
import { cn } from "@/lib/utils";

export type LedgerPickOption = {
  value: string;
  label: string;
  /** 이름 옆의 작은 설명(완료 수, 불가 이유, 사용 중 등). */
  detail?: string;
  /** 불가·사용 중처럼 아래로 내린 항목. 고를 수는 있다. */
  muted?: boolean;
};

const LIST_WIDTH = 256; // px

type Position = { left: number; top?: number; bottom?: number; maxHeight: number };

// 위아래 자리는 편집 패널의 선택칸과 같이 잰다(measureListboxPosition). 목록이 칸보다 넓으므로 오른쪽 끝을 넘지
// 않게 왼쪽으로 당긴다.
function measure(anchor: HTMLElement): Position {
  const { left, top, maxHeight, placement } = measureListboxPosition(anchor);
  const clamped = Math.max(8, Math.min(left, window.innerWidth - LIST_WIDTH - 8));
  return placement === "above" ? { left: clamped, bottom: window.innerHeight - top, maxHeight } : { left: clamped, top, maxHeight };
}

/**
 * 원장 아랫줄의 `▾` 칸(1018 스펙 D6): 누르면 그 자리에서 목록이 뜬다. Enter·Space로 열고, ↑↓로 옮기고, Enter로
 * 고르고, Esc로 닫으면 칸으로 돌아간다. 목록은 body에 그리므로 원장 줄 이동(↑↓)과 줄 클릭(패널 열기)에 걸리지 않는다.
 * `options`가 null이면 불러오는 중이다.
 */
export function LedgerCellPicker({
  children,
  className,
  disabled,
  emptyText,
  failedText,
  field,
  label,
  loadingText,
  onOpen,
  onPick,
  options,
  title,
  value
}: {
  children: ReactNode;
  /** 칸 모양을 덧씌운다(원장 한 줄의 선택 칸은 칸 폭을 채우고, 상태·결제 칩 칸은 테두리 없이). */
  className?: string;
  disabled: boolean;
  emptyText: string;
  failedText?: string | null;
  field: string;
  label: string;
  loadingText: string;
  onOpen?: () => void;
  onPick: (value: string) => void;
  options: LedgerPickOption[] | null;
  /** 칸이 좁아 말줄임으로 잘릴 때 전체를 보일 글자. */
  title?: string;
  value: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  // 옮기기 전에는 지금 값(없으면 첫 항목)에 있다. 목록을 늦게 받아도 그 값을 가리킨다.
  const [moved, setMoved] = useState<number | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const items = options ?? [];

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const anchor = triggerRef.current;
    const update = () => setPosition(measure(anchor));
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  const current = items.findIndex((option) => option.value === value);
  const active = moved ?? (current === -1 ? 0 : current);
  const setActive = (next: (index: number) => number) => setMoved(next(active));

  function close(refocus: boolean) {
    setOpen(false);
    setPosition(null);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(option: LedgerPickOption | undefined) {
    if (!option) return;
    close(true);
    onPick(option.value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive((current) => Math.min(Math.max(current + step, 0), Math.max(items.length - 1, 0)));
        return;
      }
      case "Home":
      case "End":
        event.preventDefault();
        setMoved(event.key === "Home" ? 0 : Math.max(items.length - 1, 0));
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        pick(items[active]);
        return;
      case "Escape":
        event.preventDefault();
        close(true);
        return;
      case "Tab":
        close(false);
        return;
    }
  }

  return (
    <>
      <button
        aria-controls={open ? `${id}-list` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={label}
        className={cn(
          "inline-flex h-8 min-w-0 max-w-full items-center gap-1 rounded-sm border border-border-strong px-2 text-sm text-foreground transition-colors hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent",
          className
        )}
        data-cell-picker={field}
        disabled={disabled}
        onClick={() => {
          if (open) {
            close(true);
            return;
          }
          onOpen?.();
          setMoved(null);
          // 처음 그릴 때 이미 제자리여야 포커스가 들어간다(숨긴 목록에는 포커스가 가지 않는다).
          if (triggerRef.current) setPosition(measure(triggerRef.current));
          setOpen(true);
        }}
        ref={triggerRef}
        title={title}
        type="button"
      >
        {/* 버튼 글자는 font: inherit에 덮이므로(globals.css) 글자 크기는 안쪽 span에 준다. */}
        <span className="min-w-0 truncate text-sm">{children}</span>
        <span aria-hidden="true" className="text-xs text-muted">
          ▾
        </span>
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              aria-activedescendant={items[active] ? `${id}-option-${active}` : undefined}
              aria-label={label}
              aria-busy={options === null}
              className="fixed z-50 overflow-auto rounded-lg border border-border bg-surface-float p-1.5 text-sm shadow-[var(--shadow-float)] outline-none"
              data-cell-picker-list={field}
              id={`${id}-list`}
              onBlur={(event) => {
                // 목록 밖으로 포커스가 나가면(다른 곳을 눌렀을 때) 닫는다.
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(false);
              }}
              onKeyDown={handleKeyDown}
              ref={listRef}
              role="listbox"
              style={position ? { ...position, width: LIST_WIDTH } : { visibility: "hidden", top: 0, left: 0, width: LIST_WIDTH }}
              tabIndex={-1}
            >
              {options === null ? <li className="flex min-h-11 items-center px-3 text-muted">{loadingText}</li> : null}
              {failedText ? <li className="flex min-h-11 items-center px-3 text-danger">{failedText}</li> : null}
              {options !== null && !failedText && items.length === 0 ? <li className="flex min-h-11 items-center px-3 text-muted">{emptyText}</li> : null}
              {items.map((option, index) => (
                <li
                  aria-selected={option.value === value}
                  className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-sm px-3 hover:bg-readonly aria-selected:font-semibold ${index === active ? "bg-readonly" : ""} ${option.muted ? "text-muted" : "text-foreground"}`}
                  data-pick-value={option.value}
                  id={`${id}-option-${index}`}
                  key={option.value || "none"}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => pick(option)}
                  role="option"
                >
                  <span className="min-w-0 truncate">{option.label}</span>
                  {option.detail ? <span className="shrink-0 text-xs text-muted">{option.detail}</span> : null}
                </li>
              ))}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}
