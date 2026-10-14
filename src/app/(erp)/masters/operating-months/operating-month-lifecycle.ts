import type { StatusTone } from "@/components/ui/status-indicator";
import { operatingMonthStatuses, type OperatingMonthStatus } from "@/modules/masters/operating-month-schema";

export type LifecycleStepState = "done" | "current" | "upcoming";

/**
 * 운영월 단계(operating-month-schema의 한국어 stable key 순서). 검토 시작 뒤의 확정·잠금·재오픈은
 * 월마감 서비스가 바꾼다(monthly-closing-service). 이 화면이 바꾸는 것은 작성중 → 검토중뿐이다.
 */
export function lifecycleSteps(status: string): Array<{ status: OperatingMonthStatus; state: LifecycleStepState }> {
  const currentIndex = (operatingMonthStatuses as readonly string[]).indexOf(status);
  return operatingMonthStatuses.map((step, index) => ({
    status: step,
    state: currentIndex < 0 || index > currentIndex ? "upcoming" : index === currentIndex ? "current" : "done"
  }));
}

const tones: Record<OperatingMonthStatus, StatusTone> = {
  작성중: "neutral",
  검토중: "warning",
  마감확정: "success",
  잠금: "info"
};

export function operatingMonthTone(status: string): StatusTone {
  return (tones as Record<string, StatusTone>)[status] ?? "neutral";
}
