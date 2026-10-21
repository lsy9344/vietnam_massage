import type { StatusTone } from "@/components/ui/status-indicator";
import type { MessageKey } from "@/lib/i18n";
import type { EmployeeGroup } from "@/modules/masters/employee-schema";
import type { PlannedWorkingDayCellStatus, PlannedWorkingDayWeekDto } from "@/modules/settlements/schedule-service";

/**
 * 근무표 화면(티켓 27)의 서버 페이지와 클라 뷰가 함께 쓰는 순수 값. "use client" 파일에 두면
 * 서버 페이지에서는 값이 아니라 클라이언트 참조가 되므로(use-client-constant-pitfall) 여기에 둔다.
 */

/** 월요일부터 순서대로. week.dates의 인덱스와 짝을 맞춘다. */
export const SCHEDULE_WEEKDAY_MESSAGE_KEYS: readonly MessageKey[] = [
  "settlements.schedule.weekday.mon",
  "settlements.schedule.weekday.tue",
  "settlements.schedule.weekday.wed",
  "settlements.schedule.weekday.thu",
  "settlements.schedule.weekday.fri",
  "settlements.schedule.weekday.sat",
  "settlements.schedule.weekday.sun"
];

/** 직원 마스터(masters.employees.group.*)와 같은 직군 라벨 key를 재사용한다. */
export const EMPLOYEE_GROUP_MESSAGE_KEYS: Record<EmployeeGroup, MessageKey> = {
  OPERATIONS: "masters.employees.group.OPERATIONS",
  THERAPIST: "masters.employees.group.THERAPIST"
};

/**
 * 칸 상태 세 가지(근무 예정/휴무/미입력). schedule-service.ts의 `workPlanStatuses`는 값으로
 * import하면 그 파일의 prisma 의존까지 클라이언트 번들에 끌려오므로(use-client-constant-pitfall과
 * 같은 종류의 함정), 화면이 쓰는 목록은 이 순수 파일에 따로 둔다.
 */
export const ALL_SCHEDULE_CELL_STATUSES: readonly PlannedWorkingDayCellStatus[] = ["근무 예정", "휴무", "미입력"];

/** 주 탐색(이전주/다음주/오늘)이 가리키는 날짜를 그대로 날짜 매개변수에 싣는다. */
export function scheduleHref(date: string) {
  return `/settlements/schedule?date=${date}`;
}

export function scheduleStatusTone(status: PlannedWorkingDayCellStatus): StatusTone {
  if (status === "근무 예정") return "success";
  if (status === "휴무") return "info";
  return "neutral";
}

export type ScheduleWeekSummary = {
  plannedCount: number;
  dayOffCount: number;
  unsetCount: number;
};

/** 표시 중인 주 전체(모든 직군·직원·요일)의 상태별 칸 수. */
export function scheduleWeekSummary(week: PlannedWorkingDayWeekDto): ScheduleWeekSummary {
  const summary: ScheduleWeekSummary = { plannedCount: 0, dayOffCount: 0, unsetCount: 0 };
  for (const group of week.groups) {
    for (const employee of group.employees) {
      for (const day of employee.days) {
        if (day.status === "근무 예정") summary.plannedCount += 1;
        else if (day.status === "휴무") summary.dayOffCount += 1;
        else summary.unsetCount += 1;
      }
    }
  }
  return summary;
}
