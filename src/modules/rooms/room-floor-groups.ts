import type { RoomStatusDto } from "@/modules/rooms/dtos";

type GroupedRoomStatus = {
  floor: string;
  statuses: RoomStatusDto[];
};

type FloorBucket = {
  floorValue: number;
  floorLabel: string;
  status: RoomStatusDto;
  roomOrder: number;
};

function extractLeadingDigits(roomDisplayName: string): number | null {
  const match = /^\s*(\d+)/.exec(roomDisplayName);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  return Number.isNaN(parsed) ? null : parsed;
}

function roomFloorFromDisplayName(roomDisplayName: string) {
  const leadingNumber = extractLeadingDigits(roomDisplayName);
  if (leadingNumber === null) {
    return { floor: "기타", floorValue: -1, roomOrder: Number.MAX_SAFE_INTEGER };
  }

  const floorValue = leadingNumber >= 100 ? Math.floor(leadingNumber / 100) : leadingNumber;
  return {
    floor: String(floorValue),
    floorValue,
    roomOrder: leadingNumber
  };
}

export function roomFloorGroups(statuses: RoomStatusDto[]): GroupedRoomStatus[] {
  const prepared = statuses.map((status) => {
    const { floor, floorValue, roomOrder } = roomFloorFromDisplayName(status.roomDisplayName);
    return { floor, floorValue, status, roomOrder };
  });

  prepared.sort((left, right) => {
    if (left.floorValue !== right.floorValue) {
      return right.floorValue - left.floorValue;
    }

    if (left.roomOrder !== right.roomOrder) {
      return left.roomOrder - right.roomOrder;
    }

    return left.status.roomDisplayName.localeCompare(right.status.roomDisplayName);
  });

  const groups = new Map<string, RoomStatusDto[]>();
  for (const row of prepared) {
    const current = groups.get(row.floor);
    if (current) {
      current.push(row.status);
      continue;
    }
    groups.set(row.floor, [row.status]);
  }

  return Array.from(groups.entries()).map(([floor, roomStatuses]) => ({
    floor,
    statuses: roomStatuses
  }));
}

