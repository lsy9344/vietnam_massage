"use client";

import { useState } from "react";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { TherapistAvailabilityPanel } from "@/app/(erp)/calls/therapist-availability-panel";
import type { AvailabilityCourseChoice } from "@/app/(erp)/calls/therapist-availability-view";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

export function CallLedgerWorkspace({
  availabilityRows,
  availabilityTime,
  customers,
  isLocked,
  operatingMonthId,
  options,
  rows,
  serviceDate,
  showSettlementColumns
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
}) {
  const [choice, setChoice] = useState<(AvailabilityCourseChoice & { id: number }) | null>(null);

  return (
    <>
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
