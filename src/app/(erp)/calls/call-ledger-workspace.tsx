"use client";

import { useState } from "react";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { TherapistAvailabilityPanel } from "@/app/(erp)/calls/therapist-availability-panel";
import { TherapistStatusOverview } from "@/app/(erp)/calls/therapist-status-overview";
import { QuickBookingDrawer } from "@/app/(erp)/calls/quick-booking-drawer";
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

  return (
    <>
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
      <EditableCallGrid
        courseChoice={choice}
        customers={customers}
        isLocked={isLocked}
        operatingMonthId={operatingMonthId}
        options={options}
        rows={rows}
        serviceDate={serviceDate}
        showSettlementColumns={showSettlementColumns}
      />
    </>
  );
}
