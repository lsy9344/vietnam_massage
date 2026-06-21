import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RoomStatusDto } from "@/modules/rooms/dtos";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";

function roomStatus(roomDisplayName: string): RoomStatusDto {
  return {
    roomId: roomDisplayName,
    roomDisplayName,
    roomSortOrder: 0,
    displayStatus: "빈방",
    sourceCallStatus: null,
    activeCallId: null,
    serviceDate: "2026-06-21",
    startTime: null,
    expectedEndAt: null,
    remainingMinutes: null,
    course: null,
    therapist1: null,
    therapist2: null,
    earcare: null,
    guidanceText: "",
    updatedAt: "2026-06-21T00:00:00.000Z"
  };
}

describe("roomFloorGroups", () => {
  it("REQ-001: 입력 순서가 섞여 있어도 위(4층)→아래(1층) 순서로 층을 묶는다", () => {
    // 의뢰자 요청: 객실현황·TV현황판에서 401/402 → 301/302/303 → ... → 101/102/103 순으로 보이게.
    const groups = roomFloorGroups(
      [
        roomStatus("201"),
        roomStatus("401"),
        roomStatus("101"),
        roomStatus("301")
      ].map((status) => status)
    );

    assert.deepEqual(
      groups.map((group) => group.floor),
      ["4", "3", "2", "1"]
    );
  });

  it("REQ-001: 같은 층 안에서는 객실 번호 오름차순으로 정렬한다", () => {
    const groups = roomFloorGroups([roomStatus("103"), roomStatus("101"), roomStatus("102")]);

    assert.equal(groups.length, 1);
    assert.deepEqual(
      groups[0].statuses.map((status) => status.roomDisplayName),
      ["101", "102", "103"]
    );
  });

  it("숫자로 시작하지 않는 객실은 기타 그룹으로 맨 뒤에 둔다", () => {
    const groups = roomFloorGroups([roomStatus("대기실"), roomStatus("201"), roomStatus("101")]);

    assert.deepEqual(
      groups.map((group) => group.floor),
      ["2", "1", "기타"]
    );
  });
});
