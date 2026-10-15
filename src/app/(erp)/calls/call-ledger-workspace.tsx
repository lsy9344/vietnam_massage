"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { CallDetailPanel } from "@/app/(erp)/calls/call-detail-panel";
import { CallConflictProvider } from "@/app/(erp)/calls/call-conflict-compare";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { CALL_PARAM, type LedgerView } from "@/app/(erp)/calls/ledger-address";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

/**
 * 같은 콜 id의 속성을 가진 여러 노드 중 실제로 보이는 것 하나를 고른다. 휴대폰 폭의 카드 목록과
 * 태블릿 이상의 표는 같은 `data-service-call-id`/`data-call-open`을 CSS로만 서로 숨겨 쓰는데(티켓 26),
 * `querySelector`는 숨은 쪽을 먼저 찾을 수 있어 스크롤·포커스 복귀가 틀린 노드를 집는다. 빠른 예약 패널이
 * 저장 직후 새 행에 포커스를 줄 때도 같은 함정이 있어(티켓 20) 그쪽에서도 이 함수를 그대로 가져다 쓴다.
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
 * 열린 콜 상세는 주소의 call 매개변수 하나로만 들고, history.replaceState로 바꾼다(서버를 다시 부르지 않는다).
 * 주소가 바뀌면(다른 화면의 링크) 패널도 따라 열리고 닫힌다. 원장 표는 패널과 상관없이 같은 자리에 있어
 * 날짜와 입력 중인 초안이 그대로다. 닫으면 패널을 처음 연 행으로 포커스를 돌려준다.
 */
function useCallSelection() {
  // 앱 라우터 밖(정적 렌더 테스트)에서는 useSearchParams가 null을 돌려준다.
  const selected = useSearchParams()?.get(CALL_PARAM) ?? null;
  // 화면 안에서 눌러 연 패널은 화면을 옮기지 않는다. 주소로 열렸거나 관련 콜로 옮겼을 때만 그 행이 보이게 한다.
  const openedHere = useRef(false);
  const reveal = useRef<string | null>(null);
  // 닫으면 패널을 처음 연 행으로 돌아간다. 관련 콜로 옮겨 다녀도 같다.
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
    // 패널은 처음 연 자리로 포커스를 돌려주므로(SidePanel), 그 뒤에 그 콜의 행으로 옮긴다.
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

export function CallLedgerWorkspace({
  customers,
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate,
  showSettlementColumns,
  view = "all"
}: {
  customers?: CustomerDto[];
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  serviceDate: string;
  showSettlementColumns: boolean;
  /** 원장 보기(명세 F02, 티켓 19). page.tsx가 주소의 view 매개변수에서 읽어 넘긴다. 기본은 전체(기존 동작). */
  view?: LedgerView;
}) {
  const { selected, select } = useCallSelection();
  const selectedRow = selected ? (rows.find((row) => row.id === selected) ?? null) : null;

  return (
    // 원장 위에서 저장하지 않은 입력이 있는 동안 떠나기 전 안내를 받으려면(스펙 B07, 티켓 18) 이 컴포넌트는
    // page.tsx가 CallLeaveGuard 안에서 그려야 한다 — 빠른 예약 패널(20)은 원장 탭 머리의 주요 버튼이라
    // 이 컴포넌트 밖(같은 탭의 형제)에 있으므로, 안내는 여기 말고 그 공통 조상에서 건다.
    // 가능 코스 영역은 티켓 20에서 빠른 예약 패널 안으로 옮겼다(명세 F08) — 여기에는 더 없다.
    // 원장 행의 저장 충돌(conflict) 데이터는 그리드에서 콜 상세 패널로 전해야 해서(스펙 B07, 티켓 17)
    // 이 둘을 함께 감싸는 여기에 Provider를 둔다.
    <CallConflictProvider>
      {/* 표는 패널이 열려도 같은 자리에 둔다(초안 유지). 1200px 미만에서는 패널이 표 위에 쌓인다. */}
      <div className={selected ? "grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid grid-cols-1"}>
        <div className="min-w-0">
          <EditableCallGrid
            customers={customers}
            isLocked={isLocked}
            onOpenDetail={(id) => select(id)}
            operatingMonthId={operatingMonthId}
            options={options}
            rows={rows}
            selectedCallId={selected}
            serviceDate={serviceDate}
            showSettlementColumns={showSettlementColumns}
            view={view}
          />
        </div>
        {selected ? (
          <div className="order-first min-w-0 min-[1200px]:sticky min-[1200px]:top-4 min-[1200px]:order-none">
            <CallDetailPanel
              customers={customers ?? []}
              isLocked={isLocked}
              onClose={() => select(null)}
              onSelectCall={(id) => select(id, { scrollToRow: true })}
              options={options}
              row={selectedRow}
              rows={rows}
            />
          </div>
        ) : null}
      </div>
    </CallConflictProvider>
  );
}
