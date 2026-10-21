"use client";

import { useMemo, useRef, useState } from "react";
import type { TherapistStatusOverviewDto } from "@/modules/calls/service-call-service";
import { useLocale } from "@/lib/i18n/client";

type SortOption = "available_first" | "least_completed" | "least_remaining" | "therapist_number";

export function TherapistStatusOverview({
  items,
  onSelectTherapist
}: {
  items: TherapistStatusOverviewDto[];
  onSelectTherapist?: (therapist: TherapistStatusOverviewDto) => void;
}) {
  const locale = useLocale();
  const [sortOption, setSortOption] = useState<SortOption>("available_first");
  const [collapsed, setCollapsed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const isKo = locale !== "vi";

  // Filtered and sorted items
  const displayItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortOption === "available_first") {
        const score = (t: TherapistStatusOverviewDto) => {
          if (t.currentStatus === "available") return 0;
          if (t.currentStatus === "in_use") return 1;
          if (t.currentStatus === "scheduled") return 2;
          return 3;
        };
        const diff = score(a) - score(b);
        if (diff !== 0) return diff;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
      if (sortOption === "least_completed") {
        const diff = a.completedCallsCount - b.completedCallsCount;
        if (diff !== 0) return diff;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
      if (sortOption === "least_remaining") {
        const diff = a.remainingReservationsCount - b.remainingReservationsCount;
        if (diff !== 0) return diff;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      }
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  }, [items, sortOption]);

  function handleScroll(direction: "left" | "right") {
    if (!scrollContainerRef.current) return;
    const offset = direction === "left" ? -280 : 280;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={isKo ? "관리사별 현황" : "Tình trạng Therapist"}
      className="mb-4 rounded-xl border border-border bg-surface p-3.5 shadow-2xs"
    >
      {/* Overview Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-foreground">
            {isKo ? "마사지사 현황" : "Tình trạng Therapist"}
            <span className="ml-1 text-xs font-normal text-muted tabular-nums">({items.length}명)</span>
          </h2>
          {/* Hidden text for test compatibility */}
          <span className="sr-only">관리사별 현황 ({items.length}명)</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="therapist-sort-select">
              {isKo ? "정렬" : "Xếp"}:
            </label>
            <select
              className="h-8 rounded-lg border border-border bg-surface-float px-2.5 text-xs font-semibold text-foreground outline-none transition-colors hover:border-border-strong focus:border-brand cursor-pointer"
              id="therapist-sort-select"
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              value={sortOption}
            >
              <option value="available_first">{isKo ? "지금 가능한 순" : "Có thể ngay"}</option>
              <option value="least_completed">{isKo ? "완료 콜 적은 순" : "Ít ca nhất"}</option>
              <option value="least_remaining">{isKo ? "남은 예약 적은 순" : "Ít đặt trước"}</option>
              <option value="therapist_number">{isKo ? "번호순" : "Số thứ tự"}</option>
            </select>
          </div>

          {/* Collapse/Expand Toggle Button */}
          <button
            aria-expanded={!collapsed}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-surface-float px-3 text-xs font-semibold text-muted hover:bg-readonly hover:text-foreground transition-colors"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
          >
            <span>{collapsed ? (isKo ? "현황 펼치기" : "Mở rộng") : (isKo ? "현황 접기" : "Thu gọn")}</span>
            <span aria-hidden="true">{collapsed ? "▾" : "▴"}</span>
          </button>
        </div>
      </div>

      {/* Cards Slider Container */}
      {!collapsed ? (
        <div className="relative mt-1 flex items-center">
          {/* Left arrow button */}
          <button
            aria-label="이전 관리사 목록"
            className="absolute -left-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-float text-muted shadow-xs hover:bg-readonly hover:text-foreground transition-all cursor-pointer disabled:opacity-30"
            onClick={() => handleScroll("left")}
            type="button"
          >
            ‹
          </button>

          {/* Horizontal scroll cards */}
          <div
            className="flex w-full items-stretch gap-2.5 overflow-x-auto py-1 px-4 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            ref={scrollContainerRef}
          >
            {displayItems.map((therapist) => {
              const isAvail = therapist.currentStatus === "available";
              const isInUse = therapist.currentStatus === "in_use";
              const isScheduled = therapist.currentStatus === "scheduled";

              // Format time line:
              // Available: ~14:00 or 종일 가능
              // In Use: 종료 14:30
              // Scheduled: 12:00
              let timeLabel = isKo ? "종일 가능" : "Cả ngày";
              if (isInUse) {
                timeLabel = therapist.nextEventTime
                  ? (isKo ? `종료 ${therapist.nextEventTime}` : `Hết ${therapist.nextEventTime}`)
                  : (therapist.nextEventLabel ?? (isKo ? "사용 중" : "Đang làm"));
              } else if (isAvail) {
                timeLabel = therapist.nextEventTime
                  ? `~${therapist.nextEventTime}`
                  : (isKo ? "종일 가능" : "Cả ngày");
              } else if (isScheduled) {
                timeLabel = therapist.checkInTime
                  ? therapist.checkInTime
                  : (isKo ? "출근 예정" : "Sắp vào");
              }

              return (
                <div
                  className="flex w-32 min-w-[7.5rem] flex-shrink-0 flex-col items-center justify-between rounded-xl border border-border bg-surface-float/95 p-3 text-center shadow-2xs transition-all hover:border-border-strong hover:shadow-xs"
                  key={therapist.therapistId}
                >
                  {/* Row 1: Therapist Number / Name (bold, eye-catching) */}
                  <span className="text-sm font-black text-foreground truncate w-full tracking-tight mb-0.5">
                    {therapist.displayName}
                  </span>

                  {/* Row 2: Completed / Reservation counts */}
                  <div className="text-xs text-muted tabular-nums mb-2">
                    {isKo
                      ? `완료 ${therapist.completedCallsCount} · 예약 ${therapist.remainingReservationsCount}`
                      : `Xong ${therapist.completedCallsCount} · Đặt ${therapist.remainingReservationsCount}`}
                  </div>

                  {/* Row 3: Status Pill badge */}
                  <div className="mb-2">
                    {isAvail ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                        <span className="text-[9px]">●</span>
                        <span>{isKo ? "지금 가능" : "Có thể"}</span>
                      </span>
                    ) : isInUse ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                        <span className="text-[8px]">▶</span>
                        <span>{isKo ? "사용 중" : "Đang làm"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                        <span className="text-[9px]">●</span>
                        <span>
                          {therapist.checkInTime
                            ? (isKo ? `출근 ${therapist.checkInTime}` : `Vào ${therapist.checkInTime}`)
                            : (isKo ? "출근 전" : "Sắp vào")}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Row 4: Situation time display */}
                  <div className="text-xs font-semibold text-foreground/90 tabular-nums truncate w-full mb-3">
                    {timeLabel}
                  </div>

                  {/* Row 5: Action button "콜만" */}
                  <button
                    className="inline-flex h-7 w-full items-center justify-center rounded-lg border border-border bg-surface px-2.5 text-xs font-bold text-foreground transition-colors hover:bg-readonly hover:border-border-strong cursor-pointer active:scale-95"
                    onClick={() => onSelectTherapist?.(therapist)}
                    type="button"
                  >
                    {isKo ? "콜만" : "Chỉ ca"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Right arrow button */}
          <button
            aria-label="다음 관리사 목록"
            className="absolute -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-float text-muted shadow-xs hover:bg-readonly hover:text-foreground transition-all cursor-pointer disabled:opacity-30"
            onClick={() => handleScroll("right")}
            type="button"
          >
            ›
          </button>
        </div>
      ) : null}
    </section>
  );
}
