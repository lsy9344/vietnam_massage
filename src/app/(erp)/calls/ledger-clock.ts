import { useEffect, useState } from "react";
import { businessClockString, businessTodayServiceDateFromActiveSlots } from "@/lib/operating-date";
import type { ServiceCallFormOptions } from "@/modules/calls/service-call-service";

/** 오늘 영업일과 지금 시각(영업 시간대). `지금` 구분선과 `N분 늦음`(스펙 D5), 현황 줄의 지금 상태는 오늘 원장에서만 시계를 따른다. */
export type LedgerClock = { today: string; time: string };

/** 서버 렌더와 첫 화면이 같도록 붙은 뒤에 시계를 읽고, 30초마다 다시 읽는다. 원장 목록과 Therapist 현황 줄이 함께 쓴다. */
export function useLedgerClock(timeSlots: ServiceCallFormOptions["timeSlots"], enabled: boolean) {
  const [clock, setClock] = useState<LedgerClock | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setClock({ today: businessTodayServiceDateFromActiveSlots(timeSlots), time: businessClockString() });
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, [timeSlots, enabled]);
  return clock;
}
