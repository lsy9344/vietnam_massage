/**
 * 흐름별 원장 목록(스펙 D16–D18, 티켓 03)의 규칙. 화면 없이 돌아가는 순수 함수만 둔다.
 * 상태 코드는 기준정보 코드(RESERVED 등)와 옛 한국어 값(예약 등)을 모두 받는다(service-call-service.ts와 같다).
 */
export type LedgerFlow = "active" | "reserved" | "done";

const ACTIVE_STATUSES = ["IN_USE", "USING", "사용중", "CLEANING", "청소중"];
const RESERVED_STATUSES = ["RESERVED", "예약"];

/** 지금 이용 중(사용중·청소중, 종료 확인은 사용중이 표시 종료를 넘긴 것) → 예약 → 완료·취소·노쇼. */
export function ledgerFlowOf(status: string): LedgerFlow {
  if (ACTIVE_STATUSES.includes(status)) return "active";
  if (RESERVED_STATUSES.includes(status)) return "reserved";
  return "done";
}

export const LEDGER_FLOWS: readonly LedgerFlow[] = ["active", "reserved", "done"];

/**
 * 하루 콜을 흐름 묶음으로 나눈다. 묶음 안은 받은 순서를 지킨다 — 서버가 시간 슬롯 순서(자정을 넘는 영업일 포함)로
 * 이미 예약시각순으로 정렬해 준다. 빈 묶음도 돌려준다(화면이 "0건"을 보일지 정한다).
 */
export function ledgerFlowSections<Row extends { status: string }>(rows: readonly Row[]) {
  return LEDGER_FLOWS.map((flow) => ({ flow, rows: rows.filter((row) => ledgerFlowOf(row.status) === flow) }));
}

export type LedgerAction = "enter" | "pay";

/** 줄 끝 "다음 할 일" 버튼. 예약은 입장, 이용 중(사용중·청소중)은 결제, 끝난 콜은 없다. */
export function nextLedgerAction(status: string): LedgerAction | null {
  const flow = ledgerFlowOf(status);
  if (flow === "reserved") return "enter";
  if (flow === "active") return "pay";
  return null;
}

/**
 * "입장"이 넣는 실제입장 시각(스펙 D18): 지금 시계(HH:mm)를 가장 가까운 10분으로 맞춘다. 실제입장 선택지가
 * 10분 단위라 그 목록의 값 하나가 된다. 자정 넘김은 00:00으로 돈다.
 */
export function entryClock(now: string): string {
  const [hour, minute] = now.split(":").map(Number);
  const rounded = Math.round(((hour ?? 0) * 60 + (minute ?? 0)) / 10) * 10;
  const minutes = rounded % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
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

const STATUS_CODES = {
  inUse: ["IN_USE", "USING", "사용중"],
  visitComplete: ["VISIT_COMPLETE", "방문완료"]
} as const;

/** 입장(사용중)과 결제 완료(방문완료)가 저장할 상태 코드. 활성 상태 코드 목록에서 찾고, 없으면 null이다. */
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
