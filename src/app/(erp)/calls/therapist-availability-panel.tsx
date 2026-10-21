"use client";

import { useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { loadTherapistAvailabilityAction } from "@/app/(erp)/calls/actions";
import {
  TherapistAvailabilityView,
  type AvailabilityCourseChoice
} from "@/app/(erp)/calls/therapist-availability-view";
import { useLocale } from "@/lib/i18n/client";
import type { ServiceCallOption, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

export function TherapistAvailabilityPanel({
  initialRows,
  initialTime,
  onChoose,
  operatingMonthId,
  serviceDate,
  timeSlots
}: {
  initialRows: TherapistAvailabilityRowDto[];
  initialTime: string;
  onChoose: (choice: AvailabilityCourseChoice) => void;
  operatingMonthId: string;
  serviceDate: string;
  timeSlots: ServiceCallOption[];
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(initialTime);
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  async function changeTime(next: string) {
    setTime(next);
    setFailed(false);
    const id = ++requestId.current;
    if (!next) {
      setRows([]);
      setPending(false);
      return;
    }
    setPending(true);
    try {
      const nextRows = await loadTherapistAvailabilityAction({ operatingMonthId, serviceDate, time: next });
      if (requestId.current === id) setRows(nextRows.rows);
    } catch (error) {
      unstable_rethrow(error);
      if (requestId.current === id) setFailed(true);
    } finally {
      if (requestId.current === id) setPending(false);
    }
  }

  return (
    <TherapistAvailabilityView
      failed={failed}
      locale={locale}
      onChoose={onChoose}
      onTimeChange={changeTime}
      onToggle={() => setOpen((current) => !current)}
      open={open}
      pending={pending}
      rows={rows}
      time={time}
      timeSlots={timeSlots}
    />
  );
}
