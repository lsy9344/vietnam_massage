"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { masterItemHref } from "@/app/(erp)/masters/master-view-model";
import { masterCellClassName } from "@/app/(erp)/masters/master-parts";
import { cn } from "@/lib/utils";

/**
 * 고른 항목을 화면 상태로 들고, 주소는 history.replaceState로만 맞춘다(행을 옮길 때마다 서버를 다시 부르지 않는다).
 * 키보드로 고르면 포커스를 패널로 옮겨 긴 목록을 Tab으로 다 지나지 않아도 편집 칸에 닿는다.
 * 마우스로 고르면 포커스는 그 자리에 두고, 좁은 폭에서만 표 아래에 쌓인 패널로 내려간다.
 */
export function useMasterSelection(initialItem: string | null) {
  const [selected, setSelected] = useState(initialItem);
  const [seenInitialItem, setSeenInitialItem] = useState(initialItem);
  const panelRef = useRef<HTMLDivElement>(null);
  const reveal = useRef<"keyboard" | "pointer" | null>(null);
  // 도구줄의 추가 서랍처럼 작업면 밖에서 주소로 항목을 고르면(router.replace) 서버가 새 initialItem을 준다.
  if (initialItem !== seenInitialItem) {
    setSeenInitialItem(initialItem);
    setSelected(initialItem);
  }

  useEffect(() => {
    const how = reveal.current;
    reveal.current = null;
    const panel = panelRef.current;
    if (!how || !selected || !panel) return;
    if (how === "keyboard") panel.focus();
    else if (!window.matchMedia("(min-width: 840px)").matches) panel.scrollIntoView({ block: "start" });
  }, [selected]);

  function select(item: string | null, viaKeyboard = false) {
    if (item !== null && item === selected) {
      if (viaKeyboard) panelRef.current?.focus();
      return;
    }
    reveal.current = item === null ? null : viaKeyboard ? "keyboard" : "pointer";
    setSelected(item);
    window.history.replaceState(null, "", masterItemHref(window.location.href, item));
  }

  return { selected, select, panelRef };
}

/** 작업면 밖(도구줄의 추가 서랍)에서 새로 만든 항목을 고른다. 서버가 그 항목을 initialItem으로 다시 그린다. */
export function useSelectCreatedItem() {
  const router = useRouter();
  return (item: string) => router.replace(masterItemHref(window.location.href, item), { scroll: false });
}

/**
 * 기준정보 작업면: 목록과, 고른 항목의 비모달 편집 패널(정보구조 9절, design.md 6.6·6.11).
 * 840px 이상에서는 목록 옆에 패널을 두고, 미만에서는 목록 아래에 쌓는다.
 */
export function MasterSplit({
  panel,
  panelRef,
  hint,
  children
}: {
  panel: ReactNode;
  panelRef: RefObject<HTMLDivElement | null>;
  /** 패널이 닫혀 있을 때 목록 위에 두는 안내. */
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className={panel ? "grid grid-cols-1 items-start gap-6 min-[840px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "grid gap-6"}>
      <div className="grid min-w-0 gap-6">
        {panel ? null : <p className="text-sm text-muted">{hint}</p>}
        {children}
      </div>
      {panel ? (
        <div className="min-w-0 outline-none min-[840px]:sticky min-[840px]:top-4" ref={panelRef} tabIndex={-1}>
          {panel}
        </div>
      ) : null}
    </div>
  );
}

/** 목록 행의 첫 칸. 이 버튼이나 행을 누르면 그 항목의 패널이 열린다. 키보드로 누르면 포커스가 패널로 간다. */
export function SelectableRow({
  selected,
  onSelect,
  label,
  sublabel,
  className,
  children
}: {
  selected: boolean;
  onSelect: (viaKeyboard: boolean) => void;
  label: ReactNode;
  sublabel?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <tr className={cn("cursor-pointer transition-colors hover:bg-readonly", selected && "bg-readonly", className)} onClick={() => onSelect(false)}>
      {/* 선택된 행의 왼쪽 검정 막대(design.md 6.6). 표 행에는 그림자가 그려지지 않는 브라우저가 있어 첫 칸에 둔다. */}
      <th className={cn(masterCellClassName, selected && "[box-shadow:inset_3px_0_0_var(--brand)]")} scope="row">
        <button
          aria-pressed={selected}
          className="flex min-h-11 flex-col items-start justify-center rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
          onClick={(event) => {
            event.stopPropagation();
            // Enter·Space로 누른 클릭은 detail이 0이다.
            onSelect(event.detail === 0);
          }}
          type="button"
        >
          <span className="font-semibold text-foreground">{label}</span>
          {sublabel ? <span className="text-xs font-normal text-muted">{sublabel}</span> : null}
        </button>
      </th>
      {children}
    </tr>
  );
}
