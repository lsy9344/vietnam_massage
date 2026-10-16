"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SidePanel } from "@/components/ui/panel";
import { useT } from "@/lib/i18n/client";
import { CallLedgerList } from "@/app/(erp)/calls/call-ledger-list";
import type { CallPanelFocusRequest } from "@/app/(erp)/calls/call-edit-panel";
import { ledgerListKey } from "@/app/(erp)/calls/ledger-flow";
import { CALL_PARAM } from "@/lib/ledger-address";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

/**
 * 같은 콜 id의 속성을 가진 여러 노드 중 실제로 보이는 것 하나를 고른다. 휴대폰 폭의 카드 목록과
 * 태블릿 이상의 목록은 같은 `data-service-call-id`/`data-call-open`을 CSS로만 서로 숨겨 쓰는데(티켓 26),
 * `querySelector`는 숨은 쪽을 먼저 찾을 수 있어 스크롤·포커스 복귀가 틀린 노드를 집는다. 빠른 예약 패널이
 * 저장 직후 새 줄을 고를 때도 같은 함정이 있어(티켓 20) 그쪽에서도 이 함수를 그대로 가져다 쓴다.
 */
export function firstVisible<T extends Element>(selector: string): T | null {
  const nodes = document.querySelectorAll<T>(selector);
  for (const node of nodes) {
    if (node instanceof HTMLElement && node.offsetParent !== null) {
      return node;
    }
  }
  return nodes[0] ?? null;
}

/**
 * 열린 편집 패널은 주소의 call 매개변수 하나로만 들고, history.replaceState로 바꾼다(서버를 다시 부르지 않는다).
 * 주소가 바뀌면(다른 화면의 링크) 패널도 따라 열리고 닫힌다. 원장 목록은 패널과 상관없이 같은 자리에 있어
 * 날짜와 입력 중인 초안이 그대로다. 닫으면 패널을 처음 연 줄로 포커스를 돌려준다.
 */
function useCallSelection() {
  // 앱 라우터 밖(정적 렌더 테스트)에서는 useSearchParams가 null을 돌려준다.
  const selected = useSearchParams()?.get(CALL_PARAM) ?? null;
  // 화면 안에서 눌러 연 패널은 화면을 옮기지 않는다. 주소로 열렸거나 관련 콜로 옮겼을 때만 그 줄이 보이게 한다.
  const openedHere = useRef(false);
  const reveal = useRef<string | null>(null);
  // 닫으면 패널을 처음 연 줄로 돌아간다. 관련 콜로 옮겨 다녀도 같다.
  const origin = useRef<string | null>(null);
  const closing = useRef<string | null>(null);

  useEffect(() => {
    if (selected) {
      const scroll = !openedHere.current || reveal.current === selected;
      reveal.current = null;
      if (scroll) {
        firstVisible<HTMLElement>(`[data-service-call-id="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: "center" });
      }
      return;
    }
    openedHere.current = false;
    const id = closing.current;
    closing.current = null;
    origin.current = null;
    if (!id) return;
    // 패널은 처음 연 자리로 포커스를 돌려주므로(SidePanel), 그 뒤에 그 콜의 줄로 옮긴다.
    firstVisible<HTMLElement>(`[data-call-open="${CSS.escape(id)}"]`)?.focus();
  }, [selected]);

  function select(id: string | null, { scrollToRow = false }: { scrollToRow?: boolean } = {}) {
    if (id === null) {
      closing.current = origin.current ?? selected;
    } else {
      openedHere.current = true;
      if (selected === null) origin.current = id;
      if (scrollToRow) reveal.current = id;
    }
    const url = new URL(window.location.href);
    if (id) url.searchParams.set(CALL_PARAM, id);
    else url.searchParams.delete(CALL_PARAM);
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return { selected, select };
}

/** 입력칸 안에서는 원장 단축키가 글자 입력을 막지 않는다(스펙 D21). */
const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';

export function CallLedgerWorkspace({
  customers,
  isLocked,
  options,
  rows,
  showSettlementColumns
}: {
  customers?: CustomerDto[];
  isLocked: boolean;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  showSettlementColumns: boolean;
}) {
  const t = useT();
  const { selected, select } = useCallSelection();
  const selectedRow = selected ? (rows.find((row) => row.id === selected) ?? null) : null;
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [panelFocus, setPanelFocus] = useState<CallPanelFocusRequest | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  function open(id: string, focus?: CallPanelFocusRequest["target"]) {
    select(id);
    setPanelFocus(focus ? { target: focus, token: Date.now() } : null);
  }

  // 원장 키보드(스펙 D21): ↑↓ 줄 이동, Enter 패널 첫 칸, Esc 그 줄로 돌아가기, N 빠른 예약.
  // 포커스가 아무 데도 없을 때도 N이 들어야 해서 문서에 건다. 빠른 예약 같은 대화상자 안에서는 쓰지 않는다.
  // 칸 안의 Esc는 편집 패널이 먼저 그 입력을 되돌린다(call-edit-panel.tsx).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('[role="dialog"], [role="alertdialog"]')) return;
      const command = ledgerListKey({
        key: event.key,
        inField: Boolean(target?.closest(FIELD_SELECTOR)),
        modified: event.altKey || event.ctrlKey || event.metaKey
      });
      if (!command) return;
      const line = target?.closest<HTMLElement>("[data-ledger-line]") ?? null;
      const inList = Boolean(line && listRef.current?.contains(line));

      switch (command) {
        case "quickBooking": {
          // 원장에서만 쓴다(스펙 D21): 목록·패널 안이나 포커스가 아무 데도 없을 때. 도구줄·도크의 링크에서는 쓰지 않는다.
          const onLedger = !target || target === document.body || Boolean(listRef.current?.contains(target) || panelRef.current?.contains(target));
          if (!onLedger) return;
          const trigger = firstVisible<HTMLButtonElement>("[data-quick-booking-trigger]");
          if (!trigger || trigger.disabled || trigger.offsetParent === null) return;
          event.preventDefault();
          trigger.click();
          return;
        }
        case "next":
        case "previous": {
          if (!line || !inList) return;
          const lines = [...(listRef.current?.querySelectorAll<HTMLElement>("[data-ledger-line]") ?? [])].filter(
            (candidate) => candidate.offsetParent !== null
          );
          const next = lines[lines.indexOf(line) + (command === "next" ? 1 : -1)];
          if (!next) return;
          event.preventDefault();
          next.querySelector<HTMLElement>("[data-call-open]")?.focus();
          return;
        }
        case "open": {
          const id = target?.getAttribute("data-call-open");
          if (!id || !inList) return;
          event.preventDefault();
          open(id, "first");
          return;
        }
        case "back": {
          if (!selected || !target || !panelRef.current?.contains(target)) return;
          event.preventDefault();
          firstVisible<HTMLElement>(`[data-call-open="${CSS.escape(selected)}"]`)?.focus();
          return;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const title = selectedRow
    ? selectedRow.customerMemo
      ? t("calls.detail.titleWithMemo", { time: selectedRow.startTime, memo: selectedRow.customerMemo })
      : t("calls.detail.title", { time: selectedRow.startTime })
    : t("calls.detail.fallbackTitle");

  return (
    // 원장 위에서 저장하지 않은 입력이 있는 동안 떠나기 전 안내를 받으려면(스펙 B07, 티켓 18) 이 컴포넌트는
    // page.tsx가 CallLeaveGuard 안에서 그려야 한다 — 빠른 예약 패널은 원장 탭 머리의 주요 버튼이라 이 컴포넌트
    // 밖(같은 탭의 형제)에 있으므로, 안내는 여기 말고 그 공통 조상에서 건다.
    // 목록은 패널이 열려도 같은 자리에 둔다(초안 유지). 1200px 미만에서는 패널이 목록 위에 쌓인다.
    <div className={selected ? "grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid grid-cols-1"}>
      <div className="min-w-0" ref={listRef}>
        <CallLedgerList
          customers={customers}
          isLocked={isLocked}
          onOpen={open}
          onSelectRelated={(id) => {
            select(id, { scrollToRow: true });
            setPanelFocus(null);
          }}
          options={options}
          panelFocus={panelFocus}
          panelHost={panelHost}
          rows={rows}
          selectedCallId={selected}
          showSettlementAmounts={showSettlementColumns}
        />
      </div>
      {selected ? (
        <div className="order-first min-w-0 min-[1200px]:sticky min-[1200px]:top-4 min-[1200px]:order-none" ref={panelRef}>
          {/* 패널 틀은 여기 하나다. 내용은 고른 줄(CallLedgerLine)이 자기 저장 상태와 함께 이 자리에 그린다. */}
          <SidePanel onClose={() => select(null)} title={title}>
            {selectedRow ? (
              <div ref={setPanelHost} />
            ) : (
              <p className="text-sm text-muted" role="status">
                {t("calls.detail.notFound")}
              </p>
            )}
          </SidePanel>
        </div>
      ) : null}
    </div>
  );
}
