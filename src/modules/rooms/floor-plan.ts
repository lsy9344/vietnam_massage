import type { RoomStatusDto } from "@/modules/rooms/dtos";

// 객실 평면도(.scratch/room-floor-plan/spec.md D1·D2)의 화면 없는 부분: 배치 좌표, 방→칸.
// 서버 페이지(/live, /tv)와 클라이언트 평면도가 함께 쓰므로 "use client"를 붙이지 않는다.

/** 도면 단위. 층마다 가로 1165 × 세로 400이다. */
export const FLOOR_PLAN_WIDTH = 1165;
export const FLOOR_PLAN_HEIGHT = 400;

/** [x, y, 폭, 높이] */
export type FloorPlanRect = readonly [number, number, number, number];
/** [x1, y1, x2, y2] */
export type FloorPlanSegment = readonly [number, number, number, number];

export type FloorPlanLayout = {
  /** 방 칸. 키는 방 번호 끝 두 자리("01"·"02"·"03"), 4층 401은 "wide". */
  slots: Readonly<Record<string, FloorPlanRect>>;
  corridor: FloorPlanRect;
  /** 왼쪽 띠: 엘리베이터와 복도. */
  hall: FloorPlanRect;
  elevator: FloorPlanRect;
  /** 방과 복도 사이 칸막이. 끊긴 자리가 문이다. */
  walls: readonly FloorPlanSegment[];
};

export type FloorPlanLayoutKey = "std" | "top";

// 값은 확정 시안 mockup/_shared.js의 PLAN.LAYOUTS 그대로다.
export const FLOOR_PLAN_LAYOUTS: Readonly<Record<FloorPlanLayoutKey, FloorPlanLayout>> = {
  std: {
    slots: { "03": [115, 0, 343, 300], "02": [458, 0, 382, 300], "01": [840, 0, 325, 400] },
    corridor: [115, 300, 725, 100],
    hall: [0, 0, 115, 400],
    elevator: [30, 232, 56, 56],
    walls: [
      [115, 0, 115, 300],
      [458, 0, 458, 300],
      [840, 0, 840, 320],
      [840, 380, 840, 400],
      [115, 300, 360, 300],
      [420, 300, 760, 300],
      [820, 300, 840, 300]
    ]
  },
  top: {
    slots: { "03": [115, 0, 345, 300], wide: [460, 0, 705, 400] },
    corridor: [115, 300, 345, 100],
    hall: [0, 0, 115, 400],
    elevator: [30, 232, 56, 56],
    walls: [
      [115, 0, 115, 300],
      [460, 0, 460, 320],
      [460, 380, 460, 400],
      [115, 300, 360, 300],
      [420, 300, 460, 300]
    ]
  }
};

/** 위층부터. cells는 왼쪽(엘리베이터 쪽)에서 오른쪽(창 쪽) 순서로 [칸, 방 번호]다. */
const FLOORS: readonly { floor: number; layout: FloorPlanLayoutKey; cells: readonly (readonly [string, number])[] }[] = [
  { floor: 4, layout: "top", cells: [["03", 402], ["wide", 401]] },
  { floor: 3, layout: "std", cells: [["03", 303], ["02", 302], ["01", 301]] },
  { floor: 2, layout: "std", cells: [["03", 203], ["02", 202], ["01", 201]] },
  { floor: 1, layout: "std", cells: [["03", 103], ["02", 102], ["01", 101]] }
];

export type FloorPlanCell = {
  slot: string;
  rect: FloorPlanRect;
  /** 이 칸의 방. 없으면(비활성 등) 벽만 그리고 이름표를 두지 않는다. */
  status: RoomStatusDto | null;
};

export type FloorPlanFloor = {
  floor: number;
  layout: FloorPlanLayoutKey;
  cells: FloorPlanCell[];
};

/** 방 이름 앞 숫자(roomFloorGroups와 같은 규칙). 없으면 null. */
export function roomLeadingNumber(roomDisplayName: string): number | null {
  const match = /^\s*(\d+)/.exec(roomDisplayName);
  return match ? Number(match[1]) : null;
}

/**
 * 객실 상태를 층별 평면 칸에 놓는다. 배치에 없는 방(번호가 없거나 5xx 등)과 같은 칸의 두 번째 방은
 * others로 돌려준다. 어떤 방도 빠지지 않는다.
 */
export function floorPlanFloors(statuses: RoomStatusDto[]): { floors: FloorPlanFloor[]; others: RoomStatusDto[] } {
  const byNumber = new Map<number, RoomStatusDto>();
  const others: RoomStatusDto[] = [];
  const placeable = new Set(FLOORS.flatMap((floor) => floor.cells.map(([, number]) => number)));

  for (const status of statuses) {
    const number = roomLeadingNumber(status.roomDisplayName);
    if (number === null || !placeable.has(number) || byNumber.has(number)) {
      others.push(status);
      continue;
    }
    byNumber.set(number, status);
  }

  const floors = FLOORS.map(({ floor, layout, cells }) => ({
    floor,
    layout,
    cells: cells.map(([slot, number]) => ({
      slot,
      rect: FLOOR_PLAN_LAYOUTS[layout].slots[slot],
      status: byNumber.get(number) ?? null
    }))
  }));

  return { floors, others };
}

/** 이름표의 한 줄. 문구는 화면 경계에서 번역하고 여기서는 종류와 값만 준다. */
export type FloorPlanRoomLine = { kind: "remaining"; minutes: number } | { kind: "start"; time: string } | { kind: "completeCheck" };

/**
 * 사용중·종료임박 → 남은 분(0 미만은 0), 예약 → 시작 시각, 종료확인 → 할 일, 청소중·빈방 → 없음(배지로 충분).
 * 값은 RoomStatusDto 그대로이고 다시 계산하지 않는다.
 */
export function floorPlanRoomLine(status: RoomStatusDto): FloorPlanRoomLine | null {
  switch (status.displayStatus) {
    case "사용중":
    case "종료임박":
      return status.remainingMinutes === null ? null : { kind: "remaining", minutes: Math.max(0, status.remainingMinutes) };
    case "예약":
      return status.startTime ? { kind: "start", time: status.startTime } : null;
    case "종료확인":
      return { kind: "completeCheck" };
    default:
      return null;
  }
}

const FREE_SOON_LIMIT = 3;

/**
 * "지금 빈방 / 곧 비는 방" 줄. 빈방은 전부, 곧 비는 방은 사용중·종료임박 중 남은 분이 적은 순서로 3개다.
 * 남은 분이 같으면 들어온 방 순서(객실 정렬 순서)를 지킨다. 값은 RoomStatusDto 그대로다.
 */
export function floorPlanFreeRooms(statuses: RoomStatusDto[]): { freeNow: RoomStatusDto[]; freeSoon: RoomStatusDto[] } {
  const freeNow = statuses.filter((status) => status.displayStatus === "빈방");
  const freeSoon = statuses
    .filter(
      (status) => (status.displayStatus === "사용중" || status.displayStatus === "종료임박") && status.remainingMinutes !== null
    )
    .sort((left, right) => (left.remainingMinutes ?? 0) - (right.remainingMinutes ?? 0))
    .slice(0, FREE_SOON_LIMIT);
  return { freeNow, freeSoon };
}

/** 층마다 고정된 씨앗의 결정적 난수(Park–Miller). 새로고침·자동 갱신·서버/클라이언트 렌더에서 같은 선이 나온다. */
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

/** 살짝 휘고 끝이 넘치는 선. extend 하나마다 한 번 긋는다(두 번이면 연필 두 겹). */
function wobble([x1, y1, x2, y2]: FloorPlanSegment, rand: () => number, amp: number, extend: readonly number[] = [5, -3]) {
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const jitter = () => (rand() - 0.5) * 2 * amp;
  let d = "";
  for (const e of extend) {
    const bow = (rand() - 0.5) * Math.min(10, length * 0.03);
    const mx = (x1 + x2) / 2 - uy * bow + jitter();
    const my = (y1 + y2) / 2 + ux * bow + jitter();
    const sx = x1 - ux * e + jitter() * 0.6;
    const sy = y1 - uy * e + jitter() * 0.6;
    const ex = x2 + ux * e + jitter() * 0.6;
    const ey = y2 + uy * e + jitter() * 0.6;
    d += `M ${sx.toFixed(1)} ${sy.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} `;
  }
  return d;
}

function rectSegments([x, y, w, h]: FloorPlanRect): FloorPlanSegment[] {
  return [
    [x, y, x + w, y],
    [x + w, y, x + w, y + h],
    [x + w, y + h, x, y + h],
    [x, y + h, x, y]
  ];
}

/**
 * 한 층의 연필 선(SVG path d). walls는 바깥벽(가장자리에서 4 안쪽)과 칸막이, lift는 엘리베이터 상자와 ▲▼ 꺾쇠(옅은 선)다.
 * 선을 긋는 순서가 난수 순서라 시안(mockup/c3-pencil.html)과 같은 순서로 긋는다.
 */
export function floorPlanPencilPaths(floor: number, layoutKey: FloorPlanLayoutKey): { walls: string; lift: string } {
  const layout = FLOOR_PLAN_LAYOUTS[layoutKey];
  const rand = seededRandom(floor * 7919);
  const lines = (segments: readonly FloorPlanSegment[], amp: number) => segments.map((segment) => wobble(segment, rand, amp)).join("");

  const [ex, ey, ew, eh] = layout.elevator;
  const cx = ex + ew / 2;
  const chevrons: FloorPlanSegment[] = [
    [cx - 9, ey + 24, cx, ey + 14],
    [cx, ey + 14, cx + 9, ey + 24],
    [cx - 9, ey + 32, cx, ey + 42],
    [cx, ey + 42, cx + 9, ey + 32]
  ];

  const walls = lines(rectSegments([4, 4, FLOOR_PLAN_WIDTH - 8, FLOOR_PLAN_HEIGHT - 8]), 2.5) + lines(layout.walls, 2);
  const lift = lines(rectSegments(layout.elevator), 1.5) + lines(chevrons, 0.8);
  return { walls, lift };
}
