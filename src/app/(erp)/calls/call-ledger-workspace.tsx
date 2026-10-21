"use client";

import { useState } from "react";
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

  const selectedRow = rows.find((r) => r.id === selectedCallId) ?? null;

  return (
    <div className="space-y-6">
      {therapistStatusOverview && therapistStatusOverview.length > 0 ? (
        <TherapistStatusOverview
          items={therapistStatusOverview}
          onSelectTherapist={(therapist) => {
            setSelectedTherapistId(therapist.therapistId);
            setIsQuickBookingOpen(true);
          }}
        />
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

      <TherapistAvailabilityPanel
        initialRows={availabilityRows}
        initialTime={availabilityTime}
        onChoose={(next) => setChoice((current) => ({ ...next, id: (current?.id ?? 0) + 1 }))}
        operatingMonthId={operatingMonthId}
        serviceDate={serviceDate}
        timeSlots={options.timeSlots}
      />

      <div className={`grid gap-6 ${selectedRow ? "xl:grid-cols-[minmax(0,1fr)_380px]" : "grid-cols-1"}`}>
        <div className="min-w-0">
          <EditableCallGrid
            courseChoice={choice}
            customers={customers}
            isLocked={isLocked}
            operatingMonthId={operatingMonthId}
            options={options}
            rows={rows}
            selectedCallId={selectedCallId}
            serviceDate={serviceDate}
            showSettlementColumns={showSettlementColumns}
            onToggleRowDetail={(callId) => {
              setSelectedCallId((prev) => (prev === callId ? null : callId));
            }}
          />
        </div>

        {selectedRow ? (
          <>
            {/* Desktop side panel (sticky) */}
            <div className="hidden xl:block">
              <div className="sticky top-6">
                <CallDetailPanel
                  customers={customers}
                  isLocked={isLocked}
                  onClose={() => setSelectedCallId(null)}
                  options={options}
                  row={selectedRow}
                />
              </div>
            </div>

            {/* Mobile/tablet slide-over */}
            <div className="fixed inset-0 z-50 flex justify-end bg-black/40 xl:hidden">
              <div className="h-full w-full max-w-md overflow-y-auto bg-surface p-4 shadow-2xl">
                <CallDetailPanel
                  customers={customers}
                  isLocked={isLocked}
                  onClose={() => setSelectedCallId(null)}
                  options={options}
                  row={selectedRow}
                />
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
