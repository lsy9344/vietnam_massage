"use client";

import { useMemo, useState } from "react";
import type { TherapistStatusOverviewDto } from "@/modules/calls/service-call-service";
import { useLocale } from "@/lib/i18n/client";
import { StatusIndicator } from "@/components/ui/status-indicator";

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

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      if (sortOption === "available_first") {
        const score = (t: TherapistStatusOverviewDto) => {
          if (t.currentStatus === "available") return 0;
          if (t.currentStatus === "scheduled") return 1;
          if (t.currentStatus === "in_use") return 2;
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

  if (items.length === 0) {
    return null;
  }

  const isKo = locale !== "vi";

  return (
    <section aria-label={isKo ? "관리사별 현황" : "Tình trạng Therapist"} className="mb-4 rounded-lg border border-border bg-surface p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isKo ? "관리사별 현황" : "Tình trạng Therapist"}
            <span className="ml-1.5 text-xs font-normal text-muted tabular-nums">({items.length}명)</span>
          </h2>
          <button
            aria-expanded={!collapsed}
            className="text-xs text-muted hover:text-foreground underline ml-2"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
          >
            {collapsed ? (isKo ? "펼치기" : "Mở rộng") : (isKo ? "접기" : "Thu gọn")}
          </button>
        </div>

        {!collapsed ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted mr-1">{isKo ? "정렬:" : "Sắp xếp:"}</span>
            <button
              className={`h-7 px-2.5 text-xs rounded-full border transition-colors ${
                sortOption === "available_first"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong"
              }`}
              onClick={() => setSortOption("available_first")}
              type="button"
            >
              {isKo ? "지금 가능한 순" : "Có thể ngay"}
            </button>
            <button
              className={`h-7 px-2.5 text-xs rounded-full border transition-colors ${
                sortOption === "least_completed"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong"
              }`}
              onClick={() => setSortOption("least_completed")}
              type="button"
            >
              {isKo ? "완료 콜 적은 순" : "Ít ca nhất"}
            </button>
            <button
              className={`h-7 px-2.5 text-xs rounded-full border transition-colors ${
                sortOption === "least_remaining"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong"
              }`}
              onClick={() => setSortOption("least_remaining")}
              type="button"
            >
              {isKo ? "남은 예약 적은 순" : "Ít đặt trước"}
            </button>
            <button
              className={`h-7 px-2.5 text-xs rounded-full border transition-colors ${
                sortOption === "therapist_number"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong"
              }`}
              onClick={() => setSortOption("therapist_number")}
              type="button"
            >
              {isKo ? "번호순" : "Số thứ tự"}
            </button>
          </div>
        ) : null}
      </div>

      {!collapsed ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2 pt-2 border-t border-border">
          {sortedItems.map((therapist) => {
            const isAvail = therapist.currentStatus === "available";
            const isInUse = therapist.currentStatus === "in_use";
            const isScheduled = therapist.currentStatus === "scheduled";

            return (
              <div
                className="group relative flex flex-col justify-between rounded-md border border-border bg-surface-float p-2.5 text-left transition-colors hover:border-brand cursor-pointer focus-within:ring-2 focus-within:ring-brand-secondary"
                key={therapist.therapistId}
                onClick={() => onSelectTherapist?.(therapist)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelectTherapist?.(therapist);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-semibold text-foreground truncate text-xs">
                    {therapist.displayName}
                  </span>
                  {isAvail ? (
                    <StatusIndicator label={isKo ? "지금 가능" : "Có thể"} tone="success" />
                  ) : isInUse ? (
                    <StatusIndicator label={isKo ? "사용 중" : "Đang làm"} tone="info" />
                  ) : isScheduled ? (
                    <StatusIndicator
                      label={therapist.checkInTime ? (isKo ? `출근 ${therapist.checkInTime}` : `Vào ${therapist.checkInTime}`) : (isKo ? "출근 예정" : "Sắp vào")}
                      tone="warning"
                    />
                  ) : (
                    <StatusIndicator label={isKo ? "대기" : "Chờ"} tone="neutral" />
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted py-0.5 tabular-nums">
                  <span>{isKo ? `완료 ${therapist.completedCallsCount}` : `Xong ${therapist.completedCallsCount}`}</span>
                  <span>·</span>
                  <span>{isKo ? `예약 ${therapist.remainingReservationsCount}` : `Đặt ${therapist.remainingReservationsCount}`}</span>
                </div>

                <div className="mt-1 text-[11px] font-medium text-foreground truncate tabular-nums">
                  {therapist.nextEventLabel ?? (isKo ? "종일 가능" : "Cả ngày")}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
