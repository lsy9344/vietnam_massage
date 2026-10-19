"use client";

import { useMemo, useState } from "react";
import type { TherapistStatusOverviewDto } from "@/modules/calls/service-call-service";
import { useLocale } from "@/lib/i18n/client";
import { StatusIndicator } from "@/components/ui/status-indicator";

type SortOption = "available_first" | "least_completed" | "least_remaining" | "therapist_number";
type StatusFilter = "all" | "available" | "in_use" | "scheduled";

export function TherapistStatusOverview({
  items,
  onSelectTherapist
}: {
  items: TherapistStatusOverviewDto[];
  onSelectTherapist?: (therapist: TherapistStatusOverviewDto) => void;
}) {
  const locale = useLocale();
  const [sortOption, setSortOption] = useState<SortOption>("available_first");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [collapsed, setCollapsed] = useState(false);

  const isKo = locale !== "vi";

  // Summary counts
  const counts = useMemo(() => {
    let available = 0;
    let inUse = 0;
    let scheduled = 0;
    let standby = 0;

    for (const item of items) {
      if (item.currentStatus === "available") available++;
      else if (item.currentStatus === "in_use") inUse++;
      else if (item.currentStatus === "scheduled") scheduled++;
      else standby++;
    }

    return { available, inUse, scheduled, standby, total: items.length };
  }, [items]);

  // Filtered and sorted items
  const displayItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "available") return item.currentStatus === "available";
      if (statusFilter === "in_use") return item.currentStatus === "in_use";
      if (statusFilter === "scheduled") return item.currentStatus === "scheduled";
      return true;
    });

    return filtered.sort((a, b) => {
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
  }, [items, sortOption, statusFilter]);

  if (items.length === 0) {
    return null;
  }

  return (
    <section
      aria-label={isKo ? "관리사별 현황" : "Tình trạng Therapist"}
      className="mb-4 rounded-lg border border-border bg-surface p-4"
    >
      {/* Overview Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {isKo ? "관리사별 현황" : "Tình trạng Therapist"}
            <span className="ml-1.5 text-xs font-normal text-muted tabular-nums">({items.length}명)</span>
          </h2>

          {/* Quick status summary chips */}
          <div className="flex flex-wrap items-center gap-1.5 ml-1">
            <span className="inline-flex items-center rounded-full border border-border bg-surface-float px-2.5 py-0.5 text-xs font-semibold tabular-nums text-foreground">
              {isKo ? `전체 ${counts.total}` : `Tổng ${counts.total}`}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-success">
              <span aria-hidden="true">●</span>
              <span>{isKo ? `가능 ${counts.available}` : `Rảnh ${counts.available}`}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-info">
              <span aria-hidden="true">◆</span>
              <span>{isKo ? `사용중 ${counts.inUse}` : `Bận ${counts.inUse}`}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-warning">
              <span aria-hidden="true">▲</span>
              <span>{isKo ? `예정 ${counts.scheduled}` : `Sắp vào ${counts.scheduled}`}</span>
            </span>
          </div>

          <button
            aria-expanded={!collapsed}
            className="ml-2 inline-flex h-8 items-center rounded-full border border-border bg-surface-float px-3 text-xs font-semibold text-muted hover:bg-readonly hover:text-foreground transition-colors"
            onClick={() => setCollapsed(!collapsed)}
            type="button"
          >
            {collapsed ? (isKo ? "펼치기" : "Mở rộng") : (isKo ? "접기" : "Thu gọn")}
          </button>
        </div>

        {!collapsed ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Filter buttons */}
            <span className="text-xs text-muted mr-1">{isKo ? "보기:" : "Lọc:"}</span>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                statusFilter === "all"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setStatusFilter("all")}
              type="button"
            >
              {isKo ? `전체 (${counts.total})` : `Tất cả (${counts.total})`}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                statusFilter === "available"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setStatusFilter("available")}
              type="button"
            >
              {isKo ? `지금 가능 (${counts.available})` : `Có thể ngay (${counts.available})`}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                statusFilter === "in_use"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setStatusFilter("in_use")}
              type="button"
            >
              {isKo ? `사용 중 (${counts.inUse})` : `Đang làm (${counts.inUse})`}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                statusFilter === "scheduled"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setStatusFilter("scheduled")}
              type="button"
            >
              {isKo ? `출근 예정 (${counts.scheduled})` : `Sắp vào (${counts.scheduled})`}
            </button>

            <span className="text-border mx-1">|</span>

            {/* Sort buttons */}
            <span className="text-xs text-muted mr-1">{isKo ? "정렬:" : "Xếp:"}</span>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                sortOption === "available_first"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setSortOption("available_first")}
              type="button"
            >
              {isKo ? "지금 가능한 순" : "Có thể ngay"}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                sortOption === "least_completed"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setSortOption("least_completed")}
              type="button"
            >
              {isKo ? "완료 콜 적은 순" : "Ít ca nhất"}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                sortOption === "least_remaining"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setSortOption("least_remaining")}
              type="button"
            >
              {isKo ? "남은 예약 적은 순" : "Ít đặt trước"}
            </button>
            <button
              className={`h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                sortOption === "therapist_number"
                  ? "bg-brand text-brand-foreground border-brand"
                  : "bg-surface-float text-foreground border-border hover:border-border-strong hover:bg-readonly"
              }`}
              onClick={() => setSortOption("therapist_number")}
              type="button"
            >
              {isKo ? "번호순" : "Số thứ tự"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Cards container: limited height with scroll to ensure the ledger table remains the protagonist */}
      {!collapsed ? (
        <div className="mt-3 max-h-56 overflow-y-auto pr-1">
          {displayItems.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              {isKo ? "해당 조건의 관리사가 없습니다." : "Không có Therapist phù hợp."}
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {displayItems.map((therapist) => {
                const isAvail = therapist.currentStatus === "available";
                const isInUse = therapist.currentStatus === "in_use";
                const isScheduled = therapist.currentStatus === "scheduled";

                return (
                  <button
                    className="group relative flex flex-col justify-between rounded-md border border-border bg-surface-float p-2.5 text-left transition-colors hover:border-border-strong hover:bg-readonly cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-secondary"
                    key={therapist.therapistId}
                    onClick={() => onSelectTherapist?.(therapist)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-1 w-full mb-1">
                      <span className="font-semibold text-foreground truncate text-xs">
                        {therapist.displayName}
                      </span>
                      {isAvail ? (
                        <StatusIndicator label={isKo ? "지금 가능" : "Có thể"} tone="success" />
                      ) : isInUse ? (
                        <StatusIndicator label={isKo ? "사용 중" : "Đang làm"} tone="info" />
                      ) : isScheduled ? (
                        <StatusIndicator
                          label={
                            therapist.checkInTime
                              ? (isKo ? `출근 ${therapist.checkInTime}` : `Vào ${therapist.checkInTime}`)
                              : (isKo ? "출근 예정" : "Sắp vào")
                          }
                          tone="warning"
                        />
                      ) : (
                        <StatusIndicator label={isKo ? "대기" : "Chờ"} tone="neutral" />
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted py-0.5 tabular-nums w-full">
                      <span>{isKo ? `완료 ${therapist.completedCallsCount}` : `Xong ${therapist.completedCallsCount}`}</span>
                      <span>·</span>
                      <span>{isKo ? `예약 ${therapist.remainingReservationsCount}` : `Đặt ${therapist.remainingReservationsCount}`}</span>
                    </div>

                    <div className="mt-1 text-xs font-medium text-foreground truncate tabular-nums w-full">
                      {therapist.nextEventLabel ?? (isKo ? "종일 가능" : "Cả ngày")}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
