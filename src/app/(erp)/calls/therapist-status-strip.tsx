"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ListboxSelect } from "@/components/ui/listbox-select";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import { replaceAddressParam, THERAPIST_FILTER_PARAM } from "@/lib/ledger-address";
import { cn } from "@/lib/utils";
import { requestQuickBookingWithTherapist } from "@/app/(erp)/calls/quick-booking-party-join";
import {
  isTherapistStatusSort,
  sortTherapistStatusRows,
  THERAPIST_STATUS_SORTS,
  therapistStatusRows,
  type TherapistStatusSort
} from "@/app/(erp)/calls/therapist-status";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

/** 줄을 접었는지 기기에 기억한다(1018 스펙 D17). */
const COLLAPSED_STORAGE_KEY = "calls.therapistStatus.collapsed";

const stateDisplay: Record<TherapistAvailabilityRowDto["current"]["state"], { labelKey: MessageKey; tone: StatusTone }> = {
  available: { labelKey: "calls.therapistStatus.state.available", tone: "success" },
  in_use: { labelKey: "calls.therapistStatus.state.inUse", tone: "info" },
  before_check_in: { labelKey: "calls.therapistStatus.state.beforeCheckIn", tone: "neutral" },
  checked_out: { labelKey: "calls.therapistStatus.state.checkedOut", tone: "neutral" }
};

const sortLabelKeys: Record<TherapistStatusSort, MessageKey> = {
  available: "calls.therapistStatus.sort.available",
  finished: "calls.therapistStatus.sort.finished",
  reserved: "calls.therapistStatus.sort.reserved",
  number: "calls.therapistStatus.sort.number"
};

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(COLLAPSED_STORAGE_KEY, "1");
    else window.localStorage.removeItem(COLLAPSED_STORAGE_KEY);
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 접힌다.
  }
}

/**
 * 원장 탭 상태 카드 아래의 Therapist 현황 줄(1018 스펙 D17). 가로로 넘기는 작은 카드에 번호 · 완료 · 남은 예약 ·
 * 지금 상태 · 다음 시각을 보인다. 카드를 누르면 그 Therapist를 미리 고른 빠른 예약이 열리고, 카드 안 작은 버튼은 원장을
 * 그 Therapist의 콜만 보이게 거른다(주소의 therapist 매개변수). 객실·청소 정보는 넣지 않고, 끝에 미지명 예약 수를 둔다.
 */
export function TherapistStatusStrip({
  canBook,
  rows,
  unassignedCount
}: {
  /** 빠른 예약을 열 수 있는지. 잠긴 운영월이면 카드는 누를 수 없는 글자다. */
  canBook: boolean;
  /** 원장 날짜의 가능 판정 행. 출근 상태·콜 수·지금 상태를 쓴다. */
  rows: TherapistAvailabilityRowDto[];
  /** 예약 상태인데 첫 번째 Therapist가 빈 콜 수. */
  unassignedCount: number;
}) {
  const t = useT();
  const locale = useLocale();
  // 앱 라우터 밖(정적 렌더 테스트)에서는 useSearchParams가 null을 돌려준다.
  const filtered = useSearchParams()?.get(THERAPIST_FILTER_PARAM) ?? null;
  const [sort, setSort] = useState<TherapistStatusSort>("available");
  const [collapsed, setCollapsed] = useState(false);
  // 서버 HTML은 펼친 채로 그리고, 기기에 기억한 값은 붙은 뒤에 읽는다(원장 목록의 완료 접기와 같다).
  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const stripRows = sortTherapistStatusRows(therapistStatusRows(rows), sort);
  if (stripRows.length === 0 && unassignedCount === 0) return null;

  const count = (value: number) => formatNumber(locale, value);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
  }

  function nextTimeText(row: TherapistAvailabilityRowDto) {
    const { current } = row;
    if (current.state === "available" && current.nextReservationTime && current.freeMinutes !== null) {
      return t("calls.therapistStatus.freeUntil", { time: current.nextReservationTime, minutes: count(current.freeMinutes) });
    }
    if (current.state === "in_use" && current.expectedEnd) return t("calls.therapistStatus.expectedEnd", { time: current.expectedEnd });
    if (current.state === "before_check_in") return row.plannedStartTime;
    return null;
  }

  return (
    <section aria-label={t("calls.therapistStatus.aria")} className="mb-4 grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-sm font-semibold text-foreground">
          {t("calls.therapistStatus.title", { count: count(stripRows.filter((row) => row.attendance === "checked_in").length) })}
        </h2>
        <button
          aria-expanded={!collapsed}
          className="screen-step"
          onClick={toggleCollapsed}
          type="button"
        >
          {t(collapsed ? "calls.therapistStatus.expand" : "calls.therapistStatus.collapse")}
        </button>
        {collapsed ? null : (
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-muted">
            {t("calls.therapistStatus.sort.label")}
            <ListboxSelect
              ariaLabel={t("calls.therapistStatus.sort.label")}
              className="font-normal"
              onChange={(next) => {
                if (isTherapistStatusSort(next)) setSort(next);
              }}
              options={THERAPIST_STATUS_SORTS.map((option) => ({ label: t(sortLabelKeys[option]), value: option }))}
              value={sort}
            />
          </label>
        )}
      </div>
      {collapsed ? null : (
        <ul className="flex gap-2 overflow-x-auto pb-1">
          {stripRows.map((row) => {
            const display = stateDisplay[row.current.state];
            const checkedOut = row.current.state === "checked_out";
            const nextTime = nextTimeText(row);
            const pressed = filtered === row.therapistId;
            // 시안(111.png)처럼 세로 카드: 번호 · 완료·예약 · 지금 상태 · 다음 시각, 맨 아래 "콜만".
            const body = (
              <>
                <span className={cn("truncate text-base font-semibold", !checkedOut && "text-foreground")}>{row.therapistName}</span>
                <span className="text-xs">
                  {t("calls.therapistStatus.counts", { finished: count(row.callCounts.finished), reserved: count(row.callCounts.reserved) })}
                </span>
                <StatusIndicator label={t(display.labelKey)} size="sm" tone={display.tone} />
                <span className="min-h-4 text-sm font-semibold [font-variant-numeric:tabular-nums]">{nextTime ?? ""}</span>
              </>
            );
            return (
              <li
                className={cn(
                  "flex w-36 shrink-0 flex-col items-stretch rounded-md border bg-surface text-sm",
                  pressed ? "border-brand" : "border-border",
                  checkedOut && "text-muted"
                )}
                data-therapist-status={row.therapistId}
                data-therapist-status-state={row.current.state}
                key={row.therapistId}
              >
                {canBook ? (
                  <button
                    className="grid flex-1 justify-items-start gap-1.5 rounded-t-md px-3 pb-2 pt-3 text-left hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary"
                    data-therapist-status-book=""
                    onClick={() => requestQuickBookingWithTherapist(row.therapistId)}
                    title={t("calls.therapistStatus.book", { name: row.therapistName })}
                    type="button"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="grid flex-1 justify-items-start gap-1.5 px-3 pb-2 pt-3">{body}</div>
                )}
                <span className="px-3 pb-3">
                  <button
                    aria-label={t("calls.therapistStatus.filter", { name: row.therapistName })}
                    aria-pressed={pressed}
                    className={cn(
                      "min-h-11 w-full rounded-full border border-border text-xs font-semibold hover:bg-readonly focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary",
                      pressed && "border-brand bg-brand text-brand-foreground hover:bg-brand-strong"
                    )}
                    data-therapist-status-filter=""
                    onClick={() => replaceAddressParam(THERAPIST_FILTER_PARAM, pressed ? null : row.therapistId)}
                    type="button"
                  >
                    {t("calls.therapistStatus.filterShort")}
                  </button>
                </span>
              </li>
            );
          })}
          {unassignedCount > 0 ? (
            <li className="flex w-36 shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-dashed border-border-strong bg-surface px-3 py-2 text-sm font-semibold text-foreground" data-unassigned-call-count="">
              {t("calls.therapistStatus.unassigned", { count: count(unassignedCount) })}
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}
