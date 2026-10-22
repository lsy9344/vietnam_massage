"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import { inputFieldClassName } from "@/components/ui/input-field";
import { measureListboxPosition, measureScrollbarWidth, type ListboxPosition } from "@/components/ui/listbox-position";
import { cn } from "@/lib/utils";

/**
 * 선택칸(design.md 6.4). 목록을 DOM으로 그린다.
 *
 * 왜 네이티브 `<select>`를 안 쓰는가, 모양·키보드·접근성 규칙은 `design.md` 6.4와 6.12에 있다.
 * 여기서 다시 적지 않는다. 다만 다음 둘은 코드에 남긴다.
 *
 * - 포커스는 트리거에 남는다. 목록은 body에 portal로 뜨고 항목은 mousedown을 막아서, 모달 안에서 열려도
 *   포커스가 트리거를 떠나지 않는다(Radix Dialog의 포커스 가두기와 겹치지 않게).
 * - 초기값은 네이티브 select와 같은 규칙(아래 `initialValue`).
 *
 * 폼: `name`을 주면 숨은 input으로 값을 보낸다(서버 액션·GET 필터 모두 이 값을 읽는다).
 */

export type ListboxSelectOption = {
  value: string;
  label: string;
  /** 같은 그룹의 항목은 목록에서 묶어 머리말로 보여준다(native `<optgroup>` 자리). */
  group?: string;
  disabled?: boolean;
};

export type ListboxSelectProps = {
  ariaDescribedBy?: string;
  ariaLabel?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  listboxLabel?: string;
  name?: string;
  onChange?: (value: string) => void;
  options: ListboxSelectOption[];
  placeholder?: string;
  /** 다른 속성(data-*)을 트리거 버튼에 그대로 넘길 때 쓴다. */
  triggerProps?: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className" | "id" | "onClick" | "onKeyDown" | "role" | "type"> &
    Record<`data-${string}`, string>;
  /** 값이 비어 있으면 폼을 보내지 않는다(네이티브 select의 required 자리). */
  required?: boolean;
  value?: string;
  variant?: "field" | "capsule";
};

const capsuleClass =
  "h-11 rounded-full border border-border-strong bg-surface px-4 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:bg-readonly disabled:text-muted";

export function ListboxSelect({
  ariaDescribedBy,
  ariaLabel,
  className,
  defaultValue,
  disabled = false,
  id,
  invalid = false,
  listboxLabel,
  name,
  onChange,
  options,
  placeholder,
  triggerProps,
  required = false,
  value,
  variant = "field"
}: ListboxSelectProps) {
  const reactId = useId();
  const triggerId = id ?? `${reactId}-trigger`;
  const listboxId = `${reactId}-listbox`;
  const controlled = value !== undefined;
  // 네이티브 select와 같은 초기값 규칙: 고른 값이 목록에 있으면 그 값, 없으면 첫 항목을 고른다.
  // (native select는 defaultValue가 없거나 목록에 없는 값이면 첫 항목을 보여 준다. 새 직원 폼의 재직상태처럼
  //  목록 첫 항목이 기본값이 되는 자리를 비워 두면 서버가 "재직상태가 올바르지 않습니다"로 거절한다.)
  const initialValue = useMemo(() => {
    if (defaultValue !== undefined && options.some((option) => option.value === defaultValue)) {
      return defaultValue;
    }
    return options[0]?.value ?? "";
  }, [defaultValue, options]);
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);
  const selectedValue = controlled ? value : uncontrolledValue;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<ListboxPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? placeholder ?? "";

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const openList = useCallback(
    (start: "first" | "last" = "first") => {
      if (disabled) return;
      const selected = options.findIndex((option) => option.value === selectedValue);
      const fallback = selected === -1 ? 0 : selected;
      setActiveIndex(start === "last" ? options.length - 1 : fallback);
      setOpen(true);
    },
    [disabled, options, selectedValue]
  );

  // 열려 있는 동안 기준 앵커가 움직이면(스크롤·화면 크기·레이아웃 변화) 목록도 따라간다.
  // 목록이 얼마나 높은지(내용 높이)를 함께 재서, 아래에 다 들어갈 자리가 있으면 아래에 연다.
  // 내용 폭도 재서, 기준 칸이 좁아도(빠른 예약의 시간 칸 83px 등) 가장 긴 항목이 잘리지 않게 목록을 넓힌다.
  // 처음 그릴 때는 폭을 주지 않은 숨은 상태라 목록이 내용만큼 자연스럽게 펴진다.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const update = () => {
      const anchor = triggerRef.current;
      if (!anchor) return;
      const list = listRef.current;
      setPosition(
        measureListboxPosition(
          anchor,
          list?.scrollHeight ?? 0,
          list ? { width: list.scrollWidth, scrollbar: measureScrollbarWidth() } : undefined
        )
      );
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // 목록 밖을 누르면 닫는다. 목록 항목은 mousedown을 막아서 포커스가 트리거에 남는다.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && (listRef.current?.contains(target) || triggerRef.current?.contains(target))) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  // 목록이 열려 있는 동안의 Escape는 목록만 닫아야 한다. Radix Dialog는 document의 캡처 단계에서
  // Escape를 듣고(포커스 가두기·일행 묶음도 문서 키 리스너를 쓴다) 닫아 버린다. 캡처는 window가 document보다
  // 먼저이므로, window 캡처에서 막아 위쪽으로 전파되지 않게 한다.
  useEffect(() => {
    if (!open) return;
    const onKeyDownCapture = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKeyDownCapture, true);
    return () => window.removeEventListener("keydown", onKeyDownCapture, true);
  }, [open, close]);

  // required: 값이 비어 있으면 폼을 보내지 않는다(네이티브 select의 required 자리).
  // noValidate 폼은 브라우저 검증을 끄는 자리이므로(지출 폼) native select도 막지 않았다. 거기서도 막지 않는다.
  const selectedValueRef = useRef(selectedValue);
  selectedValueRef.current = selectedValue;
  useEffect(() => {
    if (!required) return;
    const form = triggerRef.current?.closest("form");
    if (!form || form.noValidate) return;
    const onSubmit = (event: Event) => {
      if (selectedValueRef.current !== "") return;
      event.preventDefault();
      triggerRef.current?.focus();
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [required]);

  const choose = (option: ListboxSelectOption | undefined) => {
    if (!option || option.disabled) return;
    if (controlled) {
      onChange?.(option.value);
    } else {
      setUncontrolledValue(option.value);
    }
    close();
  };

  const moveActive = (step: number) => {
    setActiveIndex((current) => {
      let next = current;
      for (let attempt = 0; attempt < options.length; attempt += 1) {
        next = (next + step + options.length) % options.length;
        if (!options[next]?.disabled) return next;
      }
      return current;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        openList(event.key === "ArrowUp" ? "last" : "first");
        return;
      }
      moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      if (!open) return;
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : options.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!open) {
        openList();
        return;
      }
      choose(options[activeIndex]);
      return;
    }
    if (event.key === "Tab") {
      // Tab은 닫고 포커스를 그대로 다음 칸으로 보낸다(네이티브 select의 목록도 Tab으로 닫힌다).
      if (open) close();
      return;
    }
    // Escape는 목록이 열려 있는 동안 window 캡처 단계에서 처리한다(위 효과). 모달이 같이 닫히지 않게.
  };

  const triggerClassName =
    variant === "capsule"
      ? cn(capsuleClass, "flex items-center justify-between gap-2 text-left", className)
      : inputFieldClassName({ invalid, className: cn("flex items-center justify-between gap-2 text-left", className) });

  const activeOption = options[activeIndex];
  const listStyle: CSSProperties = position
    ? {
        left: position.left,
        maxHeight: position.maxHeight,
        width: position.width,
        ...(position.placement === "above" ? { bottom: window.innerHeight - position.top } : { top: position.top })
      }
    : { left: 0, top: 0, visibility: "hidden" };

  return (
    <>
      <button
        aria-activedescendant={open && activeOption ? `${listboxId}-option-${activeIndex}` : undefined}
        aria-controls={listboxId}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-invalid={invalid ? true : undefined}
        aria-label={ariaLabel}
        aria-required={required ? true : undefined}
        className={triggerClassName}
        disabled={disabled}
        id={triggerId}
        onClick={() => (open ? close() : openList())}
        onBlur={(event) => {
          if (!open) return;
          const next = event.relatedTarget as Node | null;
          if (next && listRef.current?.contains(next)) return;
          close();
        }}
        onKeyDown={handleKeyDown}
        ref={triggerRef}
        role="combobox"
        type="button"
        {...triggerProps}
      >
        <span className="truncate">{selectedLabel}</span>
        <span aria-hidden="true" className="shrink-0 text-xs text-muted">
          ▾
        </span>
      </button>
      {name ? <input name={name} type="hidden" value={selectedValue} /> : null}
      {open && typeof document !== "undefined"
        ? createPortal(
            <ul
              aria-label={listboxLabel ?? ariaLabel}
              className="pointer-events-auto fixed z-50 overflow-auto rounded-lg border border-border bg-surface-float p-1.5 text-sm shadow-[var(--shadow-float)] outline-none"
              id={listboxId}
              onKeyDown={handleKeyDown}
              ref={listRef}
              role="listbox"
              style={listStyle}
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const previous = options[index - 1];
                const showGroup = Boolean(option.group) && option.group !== previous?.group;
                return (
                  <Fragment key={option.value}>
                    {showGroup ? (
                      <li className="px-3 pb-1 pt-2 text-xs font-semibold text-muted" role="presentation">
                        {option.group}
                      </li>
                    ) : null}
                    <li
                      aria-disabled={option.disabled ? true : undefined}
                      aria-selected={option.value === selectedValue}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center rounded-sm px-3 text-foreground hover:bg-readonly",
                        option.disabled ? "cursor-not-allowed text-muted" : "",
                        index === activeIndex ? "bg-readonly font-semibold shadow-[inset_3px_0_0_var(--brand)]" : ""
                      )}
                      data-value={option.value}
                      id={`${listboxId}-option-${index}`}
                      onClick={() => choose(option)}
                      onMouseDown={(event) => event.preventDefault()}
                      role="option"
                    >
                      <span className="truncate">{option.label}</span>
                    </li>
                  </Fragment>
                );
              })}
            </ul>,
            document.body
          )
        : null}
    </>
  );
}
