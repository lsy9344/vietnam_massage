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
  in_use: 1,
  before_check_in: 2,
  checked_out: 3
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
