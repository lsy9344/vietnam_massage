import { seatShortage } from "@/modules/calls/seat-capacity";
import type { SeatPointDto, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

// "use client"가 없는 모듈이다. 빠른 예약 ①(1018 스펙 D20·D23)의 Therapist 목록과 ②의 한 줄 요약을 정하는 순수 함수다.

const PLANNED_TO_WORK = "근무 예정";

/**
 * ①의 Therapist 목록(1018 스펙 D20·D23). 출근 기록이 있는 사람이 기본이다. "출근 전 보기"를 켜면 그날 근무표가 근무 예정인데
 * 아직 출근하지 않은 사람을 더한다. 근무표에 없거나 휴무인 사람은 나오지 않는다. 그 시각에 받을 수 있는 사람은 오늘 완료가
 * 적은 순으로 펼쳐 두고(같으면 서비스 순서), 받을 수 없거나 퇴근한 사람은 접어 둔다. 현황 줄 카드에서 연 Therapist는
 * 그 사람이 속한 묶음의 맨 위에 둔다. beforeCheckInCount는 "출근 전 보기"로 더해지는 사람 수다.
 */
export function quickBookingTherapistGroups(
  rows: TherapistAvailabilityRowDto[],
  { presetTherapistId, showBeforeCheckIn }: { presetTherapistId: string | null; showBeforeCheckIn: boolean }
) {
  const plannedBeforeCheckIn = (row: TherapistAvailabilityRowDto) =>
    row.attendance === "before_check_in" && row.plannedWorkingDayStatus === PLANNED_TO_WORK;
  // 현황 줄 카드에서 연 Therapist는 출근 전이어도 보이고, 자기 묶음(받을 수 있음 / 접어 둠)의 맨 위에 온다.
  const shown = rows.filter(
    (row) => row.therapistId === presetTherapistId || row.attendance !== "before_check_in" || (showBeforeCheckIn && plannedBeforeCheckIn(row))
  );
  const canTake = (row: TherapistAvailabilityRowDto) => row.available && row.attendance !== "checked_out";
  const presetFirst = (group: TherapistAvailabilityRowDto[]) => [
    ...group.filter((row) => row.therapistId === presetTherapistId),
    ...group.filter((row) => row.therapistId !== presetTherapistId)
  ];
  const listed = shown
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => canTake(row))
    .sort((left, right) => left.row.callCounts.finished - right.row.callCounts.finished || left.index - right.index)
    .map(({ row }) => row);
  const unavailable = shown.filter((row) => !canTake(row) && row.attendance !== "checked_out");
  const checkedOut = shown.filter((row) => row.attendance === "checked_out");
  return {
    listed: presetFirst(listed),
    unavailable: presetFirst([...unavailable, ...checkedOut]),
    beforeCheckInCount: rows.filter(plannedBeforeCheckIn).length
  };
}

/**
 * 남은 자리로 지명 줄을 다시 본다(2026-10-24 고객 제보, 스펙 D26 변경). 미지명 콜은 Therapist가 없어서 개인 가능 판정에는 안
 * 잡히지만 남은 자리를 쓴다. 그래서 출근 3명 중 2명이 D코스, 1자리가 미지명 C90이면 비어 보이는 1명도 실은 그 미지명 손님 몫이다.
 * 담은 손님 넘침 경고(quickBookingSeatShortage)와 같은 규칙으로, 그 Therapist로 그 코스를 담으면 남은 자리를 넘는 칩은 불가로
 * 바꾼다(경고를 확인하면 그래도 담긴다). 고른 시각에 남은 자리가 없으면 그 줄을 "안 되는 N명"으로 접고, 이 사람이 비어 있는 동안
 * 자리가 다시 나는 시각을 `HH:MM부터`로 보인다. 자리 점을 아직 받지 못했으면 그대로 둔다.
 */
export function quickBookingSeatLimitedRows(rows: TherapistAvailabilityRowDto[], seats: SeatPointDto[]): TherapistAvailabilityRowDto[] {
  const now = seats[0];
  if (!now) return rows;
  return rows.map((row) => {
    if (!row.available) return row;
    const short = (minutes: number, requiresSecondTherapist: boolean) =>
      seatShortage(seats, [{ minutes, therapistIds: [row.therapistId], requiresSecondTherapist }]) !== null;
    const courses = row.courses.map((course) =>
      course.verdict === "possible" && short(course.durationMinutes, course.requiresSecondTherapist) ? { ...course, verdict: "time_short" as const } : course
    );
    if (!now.freeTherapistIds.includes(row.therapistId) || now.remaining > 0) return { ...row, courses };
    const reopen = seats.find((point) => point.remaining > 0 && point.freeTherapistIds.includes(row.therapistId));
    return { ...row, courses, available: false, freeFrom: reopen?.time ?? null };
  });
}

/** Therapist 줄의 비는 시간:`~19:00 120분`, `마감까지`, `18:30부터`. 서비스가 정한 판정을 그대로 읽는다. */
export type QuickBookingFreeTime =
  | { kind: "until"; time: string; minutes: number | null }
  | { kind: "untilClose" }
  | { kind: "from"; time: string }
  | null;

export function quickBookingFreeTime(row: TherapistAvailabilityRowDto): QuickBookingFreeTime {
  if (row.attendance === "checked_out") return null;
  if (!row.available) return row.freeFrom ? { kind: "from", time: row.freeFrom } : null;
  return row.nextReservationTime ? { kind: "until", time: row.nextReservationTime, minutes: row.freeMinutes } : { kind: "untilClose" };
}

/** ②의 한 줄 요약(1018 스펙 D21): `18:00 · 2명 · 12번 C90, 미지명 C90 · 텔레그램 홍길동`. 아직 고르지 않은 것은 뺀다. */
export function quickBookingSummary(input: {
  startTime: string;
  partySizeLabel: string;
  guests: string[];
  channelLabel: string | null;
  bookerName: string | null | undefined;
}) {
  const booking = [input.channelLabel, input.bookerName?.trim()].filter(Boolean).join(" ");
  return [input.startTime, input.partySizeLabel, input.guests.join(", "), booking].filter(Boolean).join(" · ");
}

export type QuickBookingCourseColumn = { courseId: string; code: string; minutes: number; requiresSecondTherapist: boolean };

/**
 * 코스 칩의 열(1018 스펙 D20). 활성 코스를 처음 나온 순서로 한 번씩 세워, 줄마다 같은 코스가 같은 열에 오게 한다.
 * 가능 판정은 Therapist마다 활성 코스를 같은 순서로 주므로 보통 첫 줄의 순서와 같다.
 */
export function quickBookingCourseColumns(rows: TherapistAvailabilityRowDto[]): QuickBookingCourseColumn[] {
  const columns = new Map<string, QuickBookingCourseColumn>();
  for (const course of rows.flatMap((row) => row.courses)) {
    if (!columns.has(course.courseId)) {
      columns.set(course.courseId, {
        courseId: course.courseId,
        code: course.courseCode,
        minutes: course.durationMinutes,
        requiresSecondTherapist: course.requiresSecondTherapist
      });
    }
  }
  return [...columns.values()];
}

export type QuickBookingSeatShortage = { time: string; remaining: number; demand: number };

/**
 * 담은 손님이 남은 자리를 넘는지(1018 스펙 D25·D26). 손님마다 코스 길이 동안 미지명 몫 1자리(두 명 코스는 2자리)를 쓰고, 지명
 * 몫은 그 Therapist가 그때 일하면서 비어 있을 때만 남은 자리를 쓴다(지명과 미지명이 같은 남은 자리를 쓴다). 서버가 준 자리 점과
 * 견주어, 넘으면 처음 모자라는 시각과 그때의 남은 자리·필요한 자리를 돌려준다.
 */
export function quickBookingSeatShortage(
  seats: SeatPointDto[],
  columns: QuickBookingCourseColumn[],
  guests: Array<{ courseId: string; therapist1Id: string | null; therapist2Id: string | null }>
): QuickBookingSeatShortage | null {
  const demand = guests.flatMap((guest) => {
    const column = columns.find((candidate) => candidate.courseId === guest.courseId);
    if (!column) return [];
    const therapistIds = [guest.therapist1Id, guest.therapist2Id].filter((therapistId): therapistId is string => Boolean(therapistId));
    return [{ minutes: column.minutes, therapistIds, requiresSecondTherapist: column.requiresSecondTherapist }];
  });
  const shortage = seatShortage(seats, demand);
  return shortage ? { time: shortage.point.time, remaining: shortage.point.remaining, demand: shortage.demand } : null;
}
