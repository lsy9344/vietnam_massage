// "use client"가 없는 순수 모듈이다(prisma를 가져오지 않는다). 빠른 예약 ①의 남은 자리(1018 스펙 D24–D27)를 계산한다.
// 시각은 모두 영업일 분(첫 슬롯 앞의 새벽은 다음 날로 센 분)이다.

/** 그 시각에 일하는 Therapist의 일하는 구간 [from, until). null은 그쪽 끝이 없다는 뜻이다. */
export type SeatTherapist = { therapistId: string; from: number | null; until: number | null };

/** 자리를 잡는 콜 하나. [start, end) 동안 배정된 Therapist를 잡고, 비어 있는 자리 수만큼 미지명 자리를 잡는다. */
export type SeatCall = { start: number; end: number; therapistIds: readonly string[]; requiresSecondTherapist: boolean };

export type SeatFacts = { therapists: SeatTherapist[]; calls: SeatCall[] };

/** 한 시각의 자리 수, 남은 자리, 그리고 일하면서 배정된 콜이 없는 Therapist(지명 손님이 자리를 쓰는지 가릴 때 쓴다). */
export type SeatPoint = { offsetMinutes: number; capacity: number; remaining: number; freeTherapistIds: string[] };

/** 손님 1명은 1자리, 두 명 코스(D)는 2자리다(D24). */
export function courseSeats(requiresSecondTherapist: boolean) {
  return requiresSecondTherapist ? 2 : 1;
}

// 콜(또는 담은 손님)이 쓰는 자리: pool에 있는 Therapist에게 배정된 몫은 그 사람의 자리를, 아직 Therapist가 없는 몫은 미지명
// 자리를 쓴다. pool 밖의 사람(콜에는 일하지 않는 사람, 담은 손님에게는 바쁘거나 일하지 않는 사람)의 몫은 남은 자리를 쓰지 않는다.
function seatsTaken(calls: ReadonlyArray<Pick<SeatCall, "therapistIds" | "requiresSecondTherapist">>, pool: ReadonlySet<string>) {
  const named = new Set<string>();
  let unassigned = 0;
  for (const call of calls) {
    const assigned = new Set(call.therapistIds);
    for (const therapistId of assigned) if (pool.has(therapistId)) named.add(therapistId);
    unassigned += Math.max(0, courseSeats(call.requiresSecondTherapist) - assigned.size);
  }
  return named.size + unassigned;
}

function seatsAt(facts: SeatFacts, minute: number) {
  const covering = facts.calls.filter((call) => call.start <= minute && minute < call.end);
  const working = facts.therapists.filter(
    (therapist) => (therapist.from === null || therapist.from <= minute) && (therapist.until === null || minute < therapist.until)
  );
  const workingIds = new Set(working.map((therapist) => therapist.therapistId));
  const taken = seatsTaken(covering, workingIds);
  const busy = new Set(covering.flatMap((call) => call.therapistIds));
  return {
    capacity: working.length,
    remaining: working.length - taken,
    freeTherapistIds: working.filter((therapist) => !busy.has(therapist.therapistId)).map((therapist) => therapist.therapistId)
  };
}

/**
 * [at, at+span) 동안의 자리 수와 남은 자리(D25). 첫 점은 at이고, 그 뒤로 값이 바뀌는 시각마다 점이 하나씩 온다.
 * 자리 수는 그 시각에 일하는 Therapist 수이고, 남은 자리는 그중 배정된 콜이 없는 사람 수에서 그 시각에 걸친 미지명 자리를 뺀
 * 값이다. 일하지 않는 Therapist에게 배정된 콜은 자리 수에 없던 사람이라 빼지 않는다. 미지명 콜에 Therapist를 배정하면 그 자리는
 * 개인 배정이 되고 미지명 자리에서는 빠지므로, 같은 콜을 두 번 빼지 않는다(D27).
 */
export function seatTimeline(facts: SeatFacts, at: number, span: number): SeatPoint[] {
  const end = at + span;
  const marks = new Set([at]);
  const mark = (minute: number | null) => {
    if (minute !== null && minute > at && minute < end) marks.add(minute);
  };
  for (const therapist of facts.therapists) {
    mark(therapist.from);
    mark(therapist.until);
  }
  for (const call of facts.calls) {
    mark(call.start);
    mark(call.end);
  }
  const points = [...marks].sort((left, right) => left - right).map((minute) => ({ offsetMinutes: minute - at, ...seatsAt(facts, minute) }));
  const sameAs = (point: SeatPoint, previous: SeatPoint) =>
    point.capacity === previous.capacity &&
    point.remaining === previous.remaining &&
    point.freeTherapistIds.join() === previous.freeTherapistIds.join();
  return points.filter((point, index) => index === 0 || !sameAs(point, points[index - 1]));
}

/** 담은 손님 한 명. 모두 같은 시각에 시작해 코스 길이 동안 자리를 쓴다. 지명이면 그 Therapist를 담는다. */
export type SeatGuest = { minutes: number; therapistIds: readonly string[]; requiresSecondTherapist: boolean };

/**
 * 담은 손님이 남은 자리를 넘는 첫 점(D25·D26). 손님마다 콜과 같은 규칙으로 자리를 쓴다: 미지명 몫은 1자리(두 명 코스는 2자리),
 * 지명 몫은 그 Therapist가 그 시각에 일하면서 비어 있을 때만 1자리다. 손님은 모두 at에 시작하므로 필요한 자리는 시간이 갈수록
 * 줄고, 남은 자리는 점과 점 사이에 같으니 점마다 한 번만 보면 된다. 넘지 않으면 null이다.
 */
export function seatShortage<Point extends SeatPoint>(timeline: Point[], guests: SeatGuest[]): { point: Point; demand: number } | null {
  for (const point of timeline) {
    const active = guests.filter((guest) => point.offsetMinutes < guest.minutes);
    if (active.length === 0) break;
    const demand = seatsTaken(active, new Set(point.freeTherapistIds));
    if (demand > point.remaining) return { point, demand };
  }
  return null;
}
