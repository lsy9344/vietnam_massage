/**
 * 원장 목록(스펙 D16–D18, 티켓 03; 1018 스펙 D3–D10)의 규칙. 화면 없이 돌아가는 순수 함수만 둔다.
 * 상태 코드는 기준정보 코드(RESERVED 등)와 옛 한국어 값(예약 등)을 모두 받는다(service-call-service.ts와 같다).
 */
export type LedgerFlow = "active" | "reserved" | "done";

const ACTIVE_STATUSES = ["IN_USE", "USING", "사용중", "CLEANING", "청소중"];
const RESERVED_STATUSES = ["RESERVED", "예약"];

/** 지금 이용 중(사용중·청소중) → 예약 → 완료·취소·노쇼. */
export function ledgerFlowOf(status: string): LedgerFlow {
  if (ACTIVE_STATUSES.includes(status)) return "active";
  if (RESERVED_STATUSES.includes(status)) return "reserved";
  return "done";
}

/**
 * 두 줄 원장(1018 스펙 D3·D9)의 목록: 예약·사용중·청소중은 받은 순서(예약시각순) 그대로 한 목록이고,
 * 방문완료·취소·노쇼는 하단 접기 영역으로 간다.
 */
export function ledgerTimeline<Row extends { status: string }>(rows: readonly Row[]) {
  return {
    open: rows.filter((row) => ledgerFlowOf(row.status) !== "done"),
    done: rows.filter((row) => ledgerFlowOf(row.status) === "done")
  };
}

/** 영업일 안의 분(첫 슬롯 시각 dayStart보다 이른 시계 값은 자정을 넘긴 다음 날로 본다). */
function businessMinuteOf(clock: string, dayStart: string) {
  const minutes = clockMinutes(clock);
  return minutes < clockMinutes(dayStart) ? minutes + 24 * 60 : minutes;
}

function clockMinutes(clock: string) {
  const [hour, minute] = clock.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

/** `지금 HH:MM` 구분선(스펙 D5)이 들어갈 자리: 예약시각이 지금보다 늦은 첫 줄 앞이다. 지금과 같은 시각은 위에 둔다. */
export function nowDividerIndex(startTimes: readonly string[], now: string, dayStart: string) {
  const at = businessMinuteOf(now, dayStart);
  const index = startTimes.findIndex((time) => businessMinuteOf(time, dayStart) > at);
  return index === -1 ? startTimes.length : index;
}

/** 예약 상태인데 예약시각이 지났으면 늦은 분(스펙 D5). 그 밖에는 null이다. */
export function lateMinutes(status: string, startTime: string, now: string, dayStart: string) {
  if (!RESERVED_STATUSES.includes(status)) return null;
  const late = businessMinuteOf(now, dayStart) - businessMinuteOf(startTime, dayStart);
  return late > 0 ? late : null;
}

export type LedgerEndView = { kind: "notEntered" } | { kind: "expected"; time: string } | { kind: "actual"; time: string };

/** 윗줄 종료 칸(스펙 D4): 입장 전 `미입장`, 종료 전 흐린 `예상`(표시 종료), 종료 뒤 진한 실제 종료. */
export function ledgerEndView(call: { actualEntryTime: string | null; actualEndTime: string | null; displayEnd: string }): LedgerEndView {
  if (call.actualEndTime) return { kind: "actual", time: call.actualEndTime };
  if (!call.actualEntryTime) return { kind: "notEntered" };
  return { kind: "expected", time: call.displayEnd };
}

/**
 * 아랫줄 첫 칸(스펙 D3·D10): 예약 경로와 예약자명. 예약자명이 없는 옛 콜은 연결된 고객 이름, 그것도 없으면
 * 고객/메모의 첫 줄을 보인다.
 */
export function ledgerWhoLabel(
  call: { bookingChannelCode: string | null; bookerName: string | null; customerId: string | null; customerMemo: string | null },
  channels: ReadonlyArray<{ value: string; label: string }>,
  customers: ReadonlyArray<{ id: string; name: string }>
) {
  const channel = call.bookingChannelCode ? (channels.find((option) => option.value === call.bookingChannelCode)?.label ?? call.bookingChannelCode) : null;
  const customerName = call.customerId ? customers.find((customer) => customer.id === call.customerId)?.name : undefined;
  const memoLine = call.customerMemo?.split("\n")[0]?.trim();
  return { channel, name: call.bookerName?.trim() || customerName || memoLine || null };
}

type PartyMember = { id: string; partyId: string | null; partyPosition: number | null };

export type LedgerFlowItem<Row> =
  | { kind: "call"; row: Row }
  /** 이 묶음 안의 일행 콜(일행 순번 순). size·lead는 하루 전체에서 본 일행 인원과 대표(가장 앞 순번) 콜이다. */
  | { kind: "party"; partyId: string; size: number; lead: Row; rows: Row[] };

const byPartyPosition = (left: PartyMember, right: PartyMember) => (left.partyPosition ?? 0) - (right.partyPosition ?? 0);

/**
 * 흐름 묶음 하나의 줄 순서(스펙 D14, 티켓 04). 같은 일행은 그 묶음에서 처음 나오는 일행 콜 자리에 일행 순번 순으로
 * 붙는다. 일행 콜이 다른 흐름에 흩어지면(1명만 완료 등) 묶음마다 따로 붙고, 인원은 하루 전체(allRows)로 센다.
 */
export function ledgerFlowItems<Row extends PartyMember>(sectionRows: readonly Row[], allRows: readonly Row[]): LedgerFlowItem<Row>[] {
  const items: LedgerFlowItem<Row>[] = [];
  const placed = new Set<string>();
  for (const row of sectionRows) {
    const partyId = row.partyId;
    if (!partyId) {
      items.push({ kind: "call", row });
      continue;
    }
    if (placed.has(partyId)) continue;
    placed.add(partyId);
    const party = allRows.filter((member) => member.partyId === partyId).sort(byPartyPosition);
    items.push({
      kind: "party",
      partyId,
      size: party.length,
      lead: party[0] ?? row,
      rows: sectionRows.filter((member) => member.partyId === partyId).sort(byPartyPosition)
    });
  }
  return items;
}

/** 일행 전체 입장(스펙 D14)이 입장시킬 콜: 예약인 일행 콜만이다. 객실이 빈 손님만 객실을 고른다. */
export function partyEntryTargets(members: ReadonlyArray<{ id: string; status: string; roomId: string | null }>) {
  return members.filter((member) => ledgerFlowOf(member.status) === "reserved").map((member) => ({ callId: member.id, needsRoom: !member.roomId }));
}

export type LedgerAction = "enter" | "finish" | "cleanDone";

/** 줄 끝 주 버튼(1018 스펙 D11): 예약은 입장, 사용중은 종료, 청소중은 청소 끝이다. 끝난 콜은 없다. */
export function nextLedgerAction(status: string): LedgerAction | null {
  if (RESERVED_STATUSES.includes(status)) return "enter";
  if (isStatusKind(status, "inUse")) return "finish";
  if (isStatusKind(status, "cleaning")) return "cleanDone";
  return null;
}

/**
 * 상태를 고를 때 입장·종료 시각(1018 스펙 D11). `now`는 오늘 원장일 때 지금 시계이고, 다른 날이면 null이다.
 * - 사용중: 입장이 비었으면 지금(다른 날이면 예약시각)으로 채우고 종료는 지운다.
 * - 청소중·방문완료: 입장이 비었으면 예약시각, 종료가 비었으면 지금과 표시 종료 중 이른 시각(다른 날이면 표시 종료)이다.
 *   종료는 입장보다 이르지 않다.
 * - 예약: 둘 다 지운다. 노쇼·취소와 그 밖의 상태는 그대로 둔다.
 */
export function statusChangeTimes(
  status: string,
  call: { startTime: string; actualEntryTime: string | null; actualEndTime: string | null; displayEnd: string },
  now: string | null,
  dayStart: string
): { actualEntryTime: string | null; actualEndTime: string | null } {
  if (RESERVED_STATUSES.includes(status)) return { actualEntryTime: null, actualEndTime: null };
  if (isStatusKind(status, "inUse")) {
    return { actualEntryTime: call.actualEntryTime ?? now ?? call.startTime, actualEndTime: null };
  }
  if (isStatusKind(status, "cleaning") || isStatusKind(status, "visitComplete")) {
    const entry = call.actualEntryTime ?? call.startTime;
    if (call.actualEndTime) return { actualEntryTime: entry, actualEndTime: call.actualEndTime };
    const minute = (clock: string) => businessMinuteOf(clock, dayStart);
    const end = now !== null && minute(now) < minute(call.displayEnd) ? now : call.displayEnd;
    return { actualEntryTime: entry, actualEndTime: minute(end) < minute(entry) ? entry : end };
  }
  return { actualEntryTime: call.actualEntryTime, actualEndTime: call.actualEndTime };
}

/**
 * "입장"에서 객실이 비어 있을 때 고르는 빈 객실(스펙 D18): 다른 콜이 지금 쓰고 있거나(사용중) 청소 중인 객실을 뺀다.
 * 예약이나 끝난 콜의 객실은 지금 비어 있으므로 남긴다. 객실 겹침 경고는 저장 뒤 서버가 따로 알린다.
 */
export function freeRoomOptions<Room extends { value: string }>(
  rooms: readonly Room[],
  rows: ReadonlyArray<{ id: string; status: string; roomId: string | null }>,
  callId: string
): Room[] {
  const occupied = new Set(
    rows.filter((row) => row.id !== callId && row.roomId && ledgerFlowOf(row.status) === "active").map((row) => row.roomId)
  );
  return rooms.filter((room) => !occupied.has(room.value));
}

/** 객실 칸 목록(스펙 D6): 빈 객실(freeRoomOptions와 같은 뜻)이 먼저, 쓰는 중이거나 청소 중인 객실이 아래다. */
export function roomPickList<Room extends { value: string }>(
  rooms: readonly Room[],
  rows: ReadonlyArray<{ id: string; status: string; roomId: string | null }>,
  callId: string
): Array<Room & { free: boolean }> {
  const free = new Set(freeRoomOptions(rooms, rows, callId).map((room) => room.value));
  const marked = rooms.map((room) => ({ ...room, free: free.has(room.value) }));
  return [...marked.filter((room) => room.free), ...marked.filter((room) => !room.free)];
}

export type TherapistPickVerdict = "possible" | "time_short" | "rate_missing";

type TherapistPickSource = {
  therapistId: string;
  therapistName: string;
  attendance: "before_check_in" | "checked_in" | "checked_out";
  available: boolean;
  freeFrom: string | null;
  callCounts: { done: number };
  courses: ReadonlyArray<{ courseId: string; verdict: TherapistPickVerdict }>;
};

/**
 * Therapist 칸 목록(스펙 D6): 출근해 있고 그 콜의 시각·코스에 가능한 사람이 위이고 오늘 완료가 적은 순이다.
 * 출근 전·퇴근한 사람과 불가한 사람은 아래에 가능 판정 순서대로 둔다(빠른 예약의 출근 기본값 D23과 같은 뜻).
 * 불가한 사람은 고르기 전에 그 이유로 경고한다. 그 달 정책이 없어 가능 판정에 없는 코스는 시각만으로 본다.
 */
export function therapistPickList<Row extends TherapistPickSource>(rows: readonly Row[], courseId: string) {
  const entries = rows.map((row) => ({
    ...row,
    verdict: row.courses.find((course) => course.courseId === courseId)?.verdict ?? (row.available ? "possible" : "time_short")
  }));
  const top = entries.filter((entry) => entry.verdict === "possible" && entry.attendance === "checked_in");
  return [
    ...[...top].sort((left, right) => left.callCounts.done - right.callCounts.done),
    ...entries.filter((entry) => !top.includes(entry))
  ];
}

const STATUS_CODES = {
  inUse: ["IN_USE", "USING", "사용중"],
  cleaning: ["CLEANING", "청소중"],
  visitComplete: ["VISIT_COMPLETE", "방문완료"],
  canceled: ["CANCELED", "CANCELLED", "취소"]
} as const;

function isStatusKind(status: string, kind: keyof typeof STATUS_CODES) {
  return (STATUS_CODES[kind] as readonly string[]).includes(status);
}

/** 입장(사용중)·종료(청소중)·청소 끝(방문완료)·일행 전체 취소(취소)가 저장할 상태 코드. 활성 상태 코드 목록에서 찾고, 없으면 null이다. */
export function statusCodeFor<Status extends { value: string }>(statuses: readonly Status[], kind: keyof typeof STATUS_CODES): string | null {
  const codes: readonly string[] = STATUS_CODES[kind];
  return statuses.find((status) => codes.includes(status.value))?.value ?? null;
}

export type LedgerListCommand = "next" | "previous" | "open" | "back" | "quickBooking";

/**
 * 원장 목록의 키보드(스펙 D21). 입력칸 안이나 조합키와 함께면 단축키를 쓰지 않아 글자 입력과 칸 안 이동을 막지 않는다.
 * Escape만은 입력칸 안에서도 목록으로 돌아간다(펼친 선택 목록이 먼저 Escape를 받아 닫으면 부르는 쪽이 넘긴다).
 */
export function ledgerListKey({ key, inField, modified }: { key: string; inField: boolean; modified: boolean }): LedgerListCommand | null {
  if (modified) return null;
  if (key === "Escape") return "back";
  if (inField) return null;
  switch (key) {
    case "ArrowDown":
      return "next";
    case "ArrowUp":
      return "previous";
    case "Enter":
      return "open";
    case "n":
    case "N":
      return "quickBooking";
    default:
      return null;
  }
}
