"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SidePanel } from "@/components/ui/panel";
import { useT } from "@/lib/i18n/client";
import { CallLedgerList } from "@/app/(erp)/calls/call-ledger-list";
import { firstVisible } from "@/app/(erp)/calls/first-visible";
import type { CallPanelFocusRequest } from "@/app/(erp)/calls/call-edit-panel";
import { mergeConfirmedRows } from "./confirmed-rows";
import { startTimeOrder } from "@/modules/calls/start-time-order";
import { ledgerListKey } from "@/app/(erp)/calls/ledger-flow";
import { usePhoneWidth } from "@/app/(erp)/calls/phone-width";
import { QuickBookingPanel } from "@/app/(erp)/calls/quick-booking-panel";
import { requestQuickBookingOpen } from "@/app/(erp)/calls/quick-booking-party-join";
import { CALL_PARAM, replaceAddressParam, THERAPIST_FILTER_PARAM } from "@/lib/ledger-address";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

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

  function select(id: string | null, { scrollToRow = false, restoreFocus = true }: { scrollToRow?: boolean; restoreFocus?: boolean } = {}) {
    if (id === null) {
      // 빠른 예약을 열려고 닫을 때는 포커스를 줄로 돌리지 않는다. 포커스는 빠른 예약 패널로 간다.
      closing.current = restoreFocus ? (origin.current ?? selected) : null;
    } else {
      openedHere.current = true;
      if (selected === null) origin.current = id;
      if (scrollToRow) reveal.current = id;
    }
    replaceAddressParam(CALL_PARAM, id);
  }

  return { selected, select };
}

/** 줄 저장이 잇따라 끝나면(일행 입장) 마지막 저장 뒤 이만큼 기다렸다가 한 번만 새로 고친다. */
const REFRESH_AFTER_SAVE_MS = 300;

/**
 * 줄 저장은 그 줄의 행만 돌려받는다(서버가 원장 화면을 다시 그리지 않아 "저장 중"이 바로 걷힌다). 현황 줄·상태 칸·다른 줄의
 * 경고는 저장이 잦아든 뒤 화면을 한 번 새로 고쳐 맞춘다(2026-10-23 고객 요청).
 */
function useRefreshAfterSave() {
  const router = useRouter();
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );
  return () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      router.refresh();
    }, REFRESH_AFTER_SAVE_MS);
  };
}

/** 입력칸 안에서는 원장 단축키가 글자 입력을 막지 않는다(스펙 D21). */
const FIELD_SELECTOR = 'input, textarea, select, [contenteditable="true"], [role="combobox"]';

/** 빠른 예약 옆 패널(1018 스펙 D19)이 받는 값. 원장 날짜의 운영월 범위와 처음 보일 가능 판정이다. */
export type CallLedgerQuickBooking = {
  initialAvailabilityRows: TherapistAvailabilityRowDto[];
  initialAvailabilityTime: string;
  monthEndDate: string;
  monthStartDate: string;
  operatingMonthId: string;
  serviceDate: string;
};

export function CallLedgerWorkspace({
  customers,
  isLocked,
  options,
  quickBooking,
  rows: serverRows,
  showSettlementColumns
}: {
  customers?: CustomerDto[];
  isLocked: boolean;
  options: ServiceCallFormOptions;
  /** 주면 빠른 예약을 이 작업면의 옆 패널로 연다. */
  quickBooking?: CallLedgerQuickBooking;
  rows: ServiceCallRowDto[];
  showSettlementColumns: boolean;
}) {
  const t = useT();
  const [confirmed, setConfirmed] = useState<ServiceCallRowDto[]>([]);
  const order = startTimeOrder(options.timeSlots.map((slot, sortOrder) => ({ ...slot, sortOrder })));
  const scope = quickBooking ?? serverRows[0];
  const rows = mergeConfirmedRows(serverRows, confirmed, order).filter(
    (row) => !scope || (row.operatingMonthId === scope.operatingMonthId && row.serviceDate === scope.serviceDate)
  );
  const { selected, select } = useCallSelection();
  const refreshAfterSave = useRefreshAfterSave();
  function acceptSaved(saved: ServiceCallRowDto[]) {
    setConfirmed((previous) => mergeConfirmedRows(previous, saved, order));
    refreshAfterSave();
  }
  useEffect(() => {
    window.addEventListener("calls:refresh", refreshAfterSave);
    return () => window.removeEventListener("calls:refresh", refreshAfterSave);
  }, [refreshAfterSave]);
  const selectedRow = selected ? (rows.find((row) => row.id === selected) ?? null) : null;
  // 현황 줄 카드의 "콜만" 버튼(1018 스펙 D17)이 주소에 남긴 Therapist. 목록은 그 Therapist가 맡은 콜과 열린 콜만 보인다.
  const therapistFilter = useSearchParams()?.get(THERAPIST_FILTER_PARAM) ?? null;
  // 현황 줄 카드와 같은 표시 이름이다(기준정보 선택지 이름에는 직원 코드가 붙는다).
  const filteredName = therapistFilter
    ? (rows.flatMap((row) => [row.therapist1, row.therapist2]).find((therapist) => therapist?.id === therapistFilter)?.displayName ??
      options.therapists.find((option) => option.value === therapistFilter)?.label ??
      therapistFilter)
    : null;
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [panelFocus, setPanelFocus] = useState<CallPanelFocusRequest | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // 휴대폰 폭(600px 미만)에서 패널은 목록을 덮는 전체 화면 시트다(스펙 D23).
  const isPhoneWidth = usePhoneWidth();
  // 빠른 예약은 편집 패널과 같은 옆 자리를 쓴다(1018 스펙 D19). 콜을 열면 편집 패널이 그 자리를 쓰고, 빠른 예약은 쓰던
  // 값을 둔 채 숨었다가 편집 패널을 닫으면 다시 보인다.
  const [quickBookingOpen, setQuickBookingOpen] = useState(false);
  const sideOpen = Boolean(selected) || quickBookingOpen;

  // 시트가 목록을 덮으므로 열리면 포커스를 시트 안(닫기 버튼)으로 옮긴다. 닫으면 SidePanel과 useCallSelection이
  // 연 줄로 돌려준다.
  useEffect(() => {
    if (selected && isPhoneWidth) panelRef.current?.querySelector<HTMLElement>("aside button")?.focus();
  }, [selected, isPhoneWidth]);

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
          // 머리 버튼은 패널이 보이면 닫는다(2026-10-23). N은 늘 여는 키라 버튼을 누르지 않고 열기만 요청한다.
          requestQuickBookingOpen();
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
          // 휴대폰 시트 뒤의 줄은 보이지 않으므로 시트를 닫는다.
          if (isPhoneWidth) {
            select(null);
            return;
          }
          firstVisible<HTMLElement>(`[data-call-open="${CSS.escape(selected)}"]`)?.focus();
          return;
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, isPhoneWidth]);

  const title = selectedRow
    ? selectedRow.customerMemo
      ? t("calls.detail.titleWithMemo", { time: selectedRow.startTime, memo: selectedRow.customerMemo })
      : t("calls.detail.title", { time: selectedRow.startTime })
    : t("calls.detail.fallbackTitle");

  return (
    // 원장 위에서 저장하지 않은 입력이 있는 동안 떠나기 전 안내를 받으려면(스펙 B07, 티켓 18) 이 컴포넌트는
    // page.tsx가 CallLeaveGuard 안에서 그려야 한다. 행 저장·콜 상세·빠른 예약이 모두 그 안내에 등록된다.
    // 목록은 패널이 열려도 같은 자리에 둔다(초안 유지). 1200px 미만에서는 패널이 목록 위에 쌓이고, 600px 미만에서는
    // 전체 화면 시트로 목록과 도크를 덮는다(스펙 D23).
    <div className={sideOpen ? "grid grid-cols-1 items-start gap-6 min-[1200px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]" : "grid grid-cols-1"}>
      <div className="min-w-0" ref={listRef}>
        {filteredName ? (
          <p className="mb-3 flex flex-wrap items-center gap-3 rounded-md bg-readonly px-3 py-2 text-sm font-semibold text-foreground" data-therapist-filter={therapistFilter ?? ""}>
            {t("calls.therapistStatus.filtered", { name: filteredName })}
            <button className="screen-step" onClick={() => replaceAddressParam(THERAPIST_FILTER_PARAM, null)} type="button">
              {t("calls.therapistStatus.showAll")}
            </button>
          </p>
        ) : null}
        <CallLedgerList
          customers={customers}
          isLocked={isLocked}
          onClose={() => select(null)}
          onOpen={open}
          onRowSaved={(row) => acceptSaved([row])}
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
          therapistFilter={therapistFilter}
        />
      </div>
      {/* 빠른 예약은 닫혀 있어도 머리 버튼·현황 줄 카드·"1명 추가"의 요청을 받아야 해 늘 같은 자리에 붙여 둔다. 닫혀 있으면
          이 칸은 자리를 차지하지 않는다(display: contents). */}
      <div className={sideOpen ? "order-first min-w-0 min-[1200px]:sticky min-[1200px]:top-4 min-[1200px]:order-none" : "contents"}>
        {quickBooking ? (
          <QuickBookingPanel
            {...quickBooking}
            customers={customers ?? []}
            hidden={Boolean(selected)}
            isLocked={isLocked}
            onOpenChange={(next) => {
              if (next && selected) select(null, { restoreFocus: false });
              setQuickBookingOpen(next);
            }}
            onRowsSaved={acceptSaved}
            open={quickBookingOpen}
            options={options}
          />
        ) : null}
        {selected ? (
          <div ref={panelRef}>
            {/* 패널 틀은 여기 하나다. 내용은 고른 줄(CallLedgerLine)이 자기 저장 상태와 함께 이 자리에 그린다. */}
            <SidePanel
              className="max-[599px]:fixed max-[599px]:inset-0 max-[599px]:z-50 max-[599px]:max-h-none max-[599px]:rounded-none max-[599px]:border-0"
              onClose={() => select(null)}
              title={title}
            >
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
    </div>
  );
}
