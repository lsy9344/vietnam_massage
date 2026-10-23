"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { measureListboxPosition } from "@/app/(erp)/calls/call-ledger-fields";
import { measureScrollbarWidth } from "@/components/ui/listbox-position";
import { cn } from "@/lib/utils";

export type LedgerPickOption = {
  value: string;
  label: string;
  /** 이름 옆의 작은 설명(완료 수, 불가 이유, 사용 중 등). */
  detail?: string;
  /** 불가·사용 중처럼 아래로 내린 항목. 고를 수는 있다. */
  muted?: boolean;
};

type Position = { left: number; top?: number; bottom?: number; width?: number; maxHeight: number };

/** 목록이 폭에 묶이지 않았을 때의 안쪽 폭(가장 긴 항목과 부가 정보). 잠깐 폭을 풀어 재고 되돌린다(그리기 전이라 보이지 않는다). */
function naturalWidth(list: HTMLElement) {
  const previous = list.style.width;
  list.style.width = "max-content";
  const width = list.scrollWidth;
  list.style.width = previous;
  return width;
}

// 위아래 자리와 폭은 공용 선택 칸과 같이 잰다(measureListboxPosition, design.md 6.4): 폭은 칸 폭 이상이고 가장 긴 항목에
// 맞춰 넓어지며(최대 24rem) 화면 가장자리 안쪽으로 밀어 넣는다. 예전에는 256px로 고정해 "301 호실"·"없음" 같은 짧은 목록의
// 오른쪽이 비었다(2026-10-23 "드롭다운 여백"). 목록이 아직 없으면(처음 열 때) 폭을 주지 않아 내용만큼 펴진 뒤 다시 잰다.
// contentWidth는 그렇게 잰 안쪽 폭이다. 스크롤·화면 크기에 따라 다시 잴 때는 잰 값을 그대로 써 레이아웃을 매번 다시 계산하지 않는다.
function measure(anchor: HTMLElement, list: HTMLElement | null, contentWidth?: number): Position {
  const { left, top, width, maxHeight, placement } = measureListboxPosition(
    anchor,
    list?.scrollHeight ?? 0,
    list ? { width: contentWidth ?? naturalWidth(list), scrollbar: measureScrollbarWidth() } : undefined
  );
  const across = list ? { left, width } : { left };
  return placement === "above" ? { ...across, bottom: window.innerHeight - top, maxHeight } : { ...across, top, maxHeight };
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

  // 열린 뒤(그리고 목록을 다 받아 항목이 바뀐 뒤) 내용 폭·높이로 다시 잰다. 열려 있는 동안 칸이 움직이면 따라간다.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const anchor = triggerRef.current;
    const list = listRef.current;
    const contentWidth = list ? naturalWidth(list) : undefined;
    const update = () => setPosition(measure(anchor, list, contentWidth));
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, options, failedText]);

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
          if (triggerRef.current) setPosition(measure(triggerRef.current, null));
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
              style={position ?? { visibility: "hidden", top: 0, left: 0 }}
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
