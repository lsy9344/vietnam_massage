"use client";

import { useMemo, useState } from "react";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { TherapistAvailabilityPanel } from "@/app/(erp)/calls/therapist-availability-panel";
import { TherapistStatusOverview } from "@/app/(erp)/calls/therapist-status-overview";
import { QuickBookingDrawer } from "@/app/(erp)/calls/quick-booking-drawer";
import { CallDetailPanel } from "@/app/(erp)/calls/call-detail-panel";
import type { AvailabilityCourseChoice } from "@/app/(erp)/calls/therapist-availability-view";
import type {
  CustomerDto,
  ServiceCallFormOptions,
  ServiceCallRowDto,
  TherapistAvailabilityRowDto,
  TherapistStatusOverviewDto
} from "@/modules/calls/service-call-service";

export function CallLedgerWorkspace({
  availabilityRows,
  availabilityTime,
  customers,
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate,
  showSettlementColumns,
  therapistStatusOverview = []
}: {
  availabilityRows: TherapistAvailabilityRowDto[];
  availabilityTime: string;
  customers?: CustomerDto[];
  isLocked: boolean;
  operatingMonthId: string;
  options: ServiceCallFormOptions;
  rows: ServiceCallRowDto[];
  serviceDate: string;
  showSettlementColumns: boolean;
  therapistStatusOverview?: TherapistStatusOverviewDto[];
}) {
  const [choice, setChoice] = useState<(AvailabilityCourseChoice & { id: number }) | null>(null);
  const [isQuickBookingOpen, setIsQuickBookingOpen] = useState(false);
  const [selectedTherapistId, setSelectedTherapistId] = useState<string | null>(null);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [filterTherapistId, setFilterTherapistId] = useState<string | null>(null);

  const selectedRow = rows.find((r) => r.id === selectedCallId) ?? null;

  const filteredTherapistName = useMemo(() => {
    if (!filterTherapistId) return null;
    const found = therapistStatusOverview.find((t) => t.therapistId === filterTherapistId);
    return found?.displayName ?? "선택된 마사지사";
  }, [filterTherapistId, therapistStatusOverview]);

  const displayedRows = useMemo(() => {
    if (!filterTherapistId) return rows;
    return rows.filter((r) => r.therapist1?.id === filterTherapistId || r.therapist2?.id === filterTherapistId);
  }, [rows, filterTherapistId]);

  return (
    <div className="space-y-4">
      {therapistStatusOverview && therapistStatusOverview.length > 0 ? (
        <TherapistStatusOverview
          activeFilterTherapistId={filterTherapistId}
          items={therapistStatusOverview}
          onFilterTherapist={(therapistId) => {
            setFilterTherapistId((prev) => (prev === therapistId ? null : therapistId));
          }}
          onSelectTherapist={(therapist) => {
            setSelectedTherapistId(therapist.therapistId);
            setIsQuickBookingOpen(true);
          }}
        />
      ) : null}

      {/* Filter indicator banner if "콜만" filter is active */}
      {filterTherapistId ? (
        <div className="flex items-center justify-between rounded-xl border border-brand bg-brand/5 px-4 py-2 text-xs font-semibold text-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-brand" />
            <span>
              <strong>{filteredTherapistName}</strong>의 콜만 원장 그리드에 표시 중입니다. ({displayedRows.length}건)
            </span>
          </div>
          <button
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-bold text-foreground transition-colors hover:bg-readonly cursor-pointer"
            onClick={() => setFilterTherapistId(null)}
            type="button"
          >
            ✕ 전체 보기 (필터 해제)
          </button>
        </div>
      ) : null}

      {isQuickBookingOpen ? (
        <QuickBookingDrawer
          courses={options.courses}
          customers={customers}
          initialTherapistId={selectedTherapistId}
          onClose={() => {
            setIsQuickBookingOpen(false);
            setSelectedTherapistId(null);
          }}
          open={isQuickBookingOpen}
          operatingMonthId={operatingMonthId}
          serviceDate={serviceDate}
          timeSlots={options.timeSlots}
        />
      ) : null}

      <div className="hidden">
        <TherapistAvailabilityPanel
          initialRows={availabilityRows}
          initialTime={availabilityTime}
          onChoose={(next) => setChoice((current) => ({ ...next, id: (current?.id ?? 0) + 1 }))}
          operatingMonthId={operatingMonthId}
          serviceDate={serviceDate}
          timeSlots={options.timeSlots}
        />
      </div>

      {/* Main Grid: ALWAYS full-width so 11 columns never squish or compress */}
      <div className="w-full min-w-0">
        <EditableCallGrid
          courseChoice={choice}
          customers={customers}
          isLocked={isLocked}
          operatingMonthId={operatingMonthId}
          options={options}
          rows={displayedRows}
          selectedCallId={selectedCallId}
          serviceDate={serviceDate}
          showSettlementColumns={showSettlementColumns}
          onToggleRowDetail={(callId) => {
            setSelectedCallId((prev) => (prev === callId ? null : callId));
          }}
        />
      </div>

      {/* Call Detail Panel: Slide-over overlay drawer from right (Q2 shared decision) */}
      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Subtle backdrop */}
          <div
            aria-hidden="true"
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-200"
            onClick={() => setSelectedCallId(null)}
          />

          {/* Slide-over panel */}
          <div className="relative z-10 h-full w-full max-w-md overflow-y-auto border-l border-border bg-surface p-5 shadow-2xl transition-transform animate-in slide-in-from-right duration-200">
            <CallDetailPanel
              customers={customers}
              isLocked={isLocked}
              onClose={() => setSelectedCallId(null)}
              options={options}
              row={selectedRow}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
