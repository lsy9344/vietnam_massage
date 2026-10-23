import { businessMinuteOf } from "@/app/(erp)/calls/ledger-flow";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

// "use client"가 없는 모듈이다. 원장 Therapist 현황 줄(1018 스펙 D17)의 대상 고르기와 정렬을 순수 함수로 둔다.

type StatusRow = Pick<TherapistAvailabilityRowDto, "therapistName" | "attendance" | "plannedWorkingDayStatus" | "callCounts" | "current">;

/** 현황 줄의 정렬. 한 번에 하나만 고르고, 지금 가능 순이 기본이다. */
export const THERAPIST_STATUS_SORTS = ["available", "finished", "reserved", "number"] as const;
export type TherapistStatusSort = (typeof THERAPIST_STATUS_SORTS)[number];

export function isTherapistStatusSort(value: string): value is TherapistStatusSort {
  return (THERAPIST_STATUS_SORTS as readonly string[]).includes(value);
}

const hasCalls = (row: StatusRow) => row.callCounts.done + row.callCounts.reserved > 0;

/**
 * 현황 줄에 올릴 Therapist. 출근 기록이 있거나 그날 근무표가 근무 예정인 사람이다. 퇴근한 사람은 그날 콜이 있을 때만
 * 올린다. 출근 전이라도 그날 콜이 이미 잡혀 있으면 올린다(가정: 근무표를 비워 둔 날에도 잡힌 예약이 줄에서 사라지지 않게).
 * 가능 판정이 준 순서(직원 정렬 순서)를 그대로 둔다.
 */
export function therapistStatusRows<Row extends StatusRow>(rows: Row[]) {
  return rows.filter((row) => {
    if (row.attendance === "checked_in") return true;
    if (row.attendance === "checked_out") return hasCalls(row);
    return row.plannedWorkingDayStatus === "근무 예정" || hasCalls(row);
  });
}

const stateRank: Record<TherapistAvailabilityRowDto["current"]["state"], number> = {
  available: 0,
  reserved_soon: 1,
  in_use: 2,
  before_check_in: 3,
  checked_out: 4
};

const numberOrder = (left: StatusRow, right: StatusRow) =>
  left.therapistName.localeCompare(right.therapistName, undefined, { numeric: true });

/** 고른 정렬로 줄을 세운다. 같으면 받은 순서를 지킨다(Array.prototype.sort는 안정 정렬이다). */
export function sortTherapistStatusRows<Row extends StatusRow>(rows: Row[], sort: TherapistStatusSort) {
  const compare: Record<TherapistStatusSort, (left: Row, right: Row) => number> = {
    available: (left, right) =>
      stateRank[left.current.state] - stateRank[right.current.state] || left.callCounts.finished - right.callCounts.finished,
    finished: (left, right) => left.callCounts.finished - right.callCounts.finished,
    reserved: (left, right) => left.callCounts.reserved - right.callCounts.reserved,
    number: numberOrder
  };
  return [...rows].sort(compare[sort]);
}

/**
 * 서버가 화면을 그린 시각에 정한 지금 상태를 이 기기의 지금 시각(now, 영업 시간대 HH:MM)으로 다시 맞춘다(2026-10-23 고객 요청).
 * 원장 화면은 저장이 없으면 다시 그려지지 않아, 13:50에 그린 "지금 가능 ~15:00 (70분)"이 14:03에도 남았다. 지금 가능·곧 예약이고
 * 다음 예약이 있으면 남은 분을 다시 재고, 서버와 같은 기준(그 사람이 수당을 가진 가장 짧은 코스)으로 곧 예약인지 정한다.
 * 다른 상태는 다음 저장·새로 고침까지 서버 값을 그대로 둔다.
 */
export function liveTherapistCurrent(
  row: Pick<TherapistAvailabilityRowDto, "current" | "courses">,
  now: string,
  dayStart: string
): TherapistAvailabilityRowDto["current"] {
  const { current } = row;
  if ((current.state !== "available" && current.state !== "reserved_soon") || !current.nextReservationTime) return current;
  const freeMinutes = Math.max(businessMinuteOf(current.nextReservationTime, dayStart) - businessMinuteOf(now, dayStart), 0);
  const rated = row.courses.filter((course) => course.verdict !== "rate_missing").map((course) => course.durationMinutes);
  const shortestCourse = rated.length === 0 ? 0 : Math.min(...rated);
  return { ...current, state: freeMinutes < shortestCourse ? "reserved_soon" : "available", freeMinutes };
}
