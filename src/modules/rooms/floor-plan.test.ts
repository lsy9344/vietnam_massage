import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RoomDisplayStatus, RoomStatusDto } from "@/modules/rooms/dtos";
import { floorPlanFloors, floorPlanFreeRooms, floorPlanPencilPaths, floorPlanRoomLine } from "@/modules/rooms/floor-plan";

function roomStatus(roomDisplayName: string, overrides: Partial<RoomStatusDto> = {}): RoomStatusDto {
  return {
    roomId: `room-${roomDisplayName}`,
    roomDisplayName,
    roomSortOrder: 0,
    displayStatus: "빈방",
    sourceCallStatus: null,
    activeCallId: null,
    serviceDate: "2026-10-19",
    startTime: null,
    expectedEndAt: null,
    remainingMinutes: null,
    course: null,
    therapist1: null,
    therapist2: null,
    guidanceText: "",
    updatedAt: "2026-10-19T00:00:00.000Z",
    overlappingCalls: [],
    ...overrides
  };
}

// 기본 객실 11개(room-schema.ts의 defaultRooms 순서).
const defaultRoomNames = ["401 호실", "402 호실", "301 호실", "302 호실", "303 호실", "201 호실", "202 호실", "203 호실", "101 호실", "102 호실", "103 호실"];

/** 층마다 "칸=방 이름"을 칸 순서대로. 빈 칸은 "칸=-". */
function cellMap(statuses: RoomStatusDto[]) {
  return floorPlanFloors(statuses).floors.map((floor) => ({
    floor: floor.floor,
    layout: floor.layout,
    cells: floor.cells.map((cell) => `${cell.slot}=${cell.status?.roomDisplayName ?? "-"}`)
  }));
}

describe("floorPlanFloors: 방을 평면 칸에 놓는다", () => {
  it("기본 11개 방을 4층(계단 쪽 402, 넓은 401)과 1–3층(n03·n02·n01) 칸에 놓고 기타는 없다", () => {
    const { others } = floorPlanFloors(defaultRoomNames.map((name) => roomStatus(name)));

    assert.deepEqual(cellMap(defaultRoomNames.map((name) => roomStatus(name))), [
      { floor: 4, layout: "top", cells: ["03=402 호실", "wide=401 호실"] },
      { floor: 3, layout: "std", cells: ["03=303 호실", "02=302 호실", "01=301 호실"] },
      { floor: 2, layout: "std", cells: ["03=203 호실", "02=202 호실", "01=201 호실"] },
      { floor: 1, layout: "std", cells: ["03=103 호실", "02=102 호실", "01=101 호실"] }
    ]);
    assert.deepEqual(others, []);
  });

  it("번호가 없는 방, 배치에 없는 5xx 방, 같은 칸의 두 번째 방은 들어온 순서대로 기타로 보낸다", () => {
    const statuses = [roomStatus("대기실"), roomStatus("301 호실"), roomStatus("501 호실"), roomStatus("301-B"), roomStatus("12번방")];
    const { others } = floorPlanFloors(statuses);

    assert.deepEqual(
      others.map((status) => status.roomDisplayName),
      ["대기실", "501 호실", "301-B", "12번방"]
    );
    assert.equal(cellMap(statuses)[1].cells[2], "01=301 호실");
  });

  it("방이 없는 칸(비활성 등)도 층과 칸은 그대로 두고 방만 비운다", () => {
    const statuses = defaultRoomNames.filter((name) => name !== "302 호실" && name !== "401 호실").map((name) => roomStatus(name));

    const floors = cellMap(statuses);
    assert.deepEqual(floors[0].cells, ["03=402 호실", "wide=-"]);
    assert.deepEqual(floors[1].cells, ["03=303 호실", "02=-", "01=301 호실"]);
  });

  it("방이 하나도 없어도 네 층을 모두 돌려준다", () => {
    assert.deepEqual(
      cellMap([]).map((floor) => floor.floor),
      [4, 3, 2, 1]
    );
  });
});

describe("floorPlanRoomLine: 이름표의 한 줄", () => {
  const line = (displayStatus: RoomDisplayStatus, overrides: Partial<RoomStatusDto> = {}) =>
    floorPlanRoomLine(roomStatus("301 호실", { displayStatus, ...overrides }));

  it("사용중·종료임박은 남은 분, 0 미만은 0이다", () => {
    assert.deepEqual(line("사용중", { remainingMinutes: 46 }), { kind: "remaining", minutes: 46 });
    assert.deepEqual(line("종료임박", { remainingMinutes: 6 }), { kind: "remaining", minutes: 6 });
    assert.deepEqual(line("종료임박", { remainingMinutes: -3 }), { kind: "remaining", minutes: 0 });
  });

  it("남은 분이 없는 사용중은 줄이 없다(새로 계산하지 않는다)", () => {
    assert.equal(line("사용중", { remainingMinutes: null }), null);
  });

  it("예약은 시작 시각, 시작 시각이 없으면 줄이 없다", () => {
    assert.deepEqual(line("예약", { startTime: "21:40" }), { kind: "start", time: "21:40" });
    assert.equal(line("예약", { startTime: null }), null);
  });

  it("종료확인은 할 일, 청소중·빈방은 줄이 없다", () => {
    assert.deepEqual(line("종료확인", { remainingMinutes: 0 }), { kind: "completeCheck" });
    assert.equal(line("청소중", { startTime: "20:00" }), null);
    assert.equal(line("빈방"), null);
  });
});

describe("floorPlanFreeRooms: 지금 빈방 / 곧 비는 방", () => {
  const names = (statuses: RoomStatusDto[]) => statuses.map((status) => status.roomDisplayName);

  it("빈방은 전부 들어온 순서대로, 곧 비는 방은 사용중·종료임박 중 남은 분이 적은 순서로 3개다", () => {
    const { freeNow, freeSoon } = floorPlanFreeRooms([
      roomStatus("401", { displayStatus: "사용중", remainingMinutes: 46 }),
      roomStatus("402", { displayStatus: "종료임박", remainingMinutes: 6 }),
      roomStatus("301", { displayStatus: "종료확인", remainingMinutes: 0 }),
      roomStatus("302", { displayStatus: "예약", startTime: "21:40" }),
      roomStatus("303"),
      roomStatus("201", { displayStatus: "사용중", remainingMinutes: 66 }),
      roomStatus("202", { displayStatus: "청소중" }),
      roomStatus("203", { displayStatus: "사용중", remainingMinutes: 31 }),
      roomStatus("102"),
      roomStatus("103", { displayStatus: "종료임박", remainingMinutes: 8 })
    ]);

    assert.deepEqual(names(freeNow), ["303", "102"]);
    assert.deepEqual(names(freeSoon), ["402", "103", "203"]);
  });

  it("남은 분이 같으면 들어온 방 순서를 지키고, 남은 분이 없는 방은 고르지 않는다", () => {
    const { freeSoon } = floorPlanFreeRooms([
      roomStatus("301", { displayStatus: "사용중", remainingMinutes: 20 }),
      roomStatus("201", { displayStatus: "사용중", remainingMinutes: null }),
      roomStatus("401", { displayStatus: "종료임박", remainingMinutes: 5 }),
      roomStatus("101", { displayStatus: "사용중", remainingMinutes: 20 })
    ]);

    assert.deepEqual(names(freeSoon), ["401", "301", "101"]);
  });

  it("해당하는 방이 없으면 둘 다 비어 있다", () => {
    assert.deepEqual(floorPlanFreeRooms([roomStatus("301", { displayStatus: "청소중" })]), { freeNow: [], freeSoon: [] });
  });
});

// 확정 시안(mockup/c3-pencil.html)이 그린 경로를 그대로 옮긴 값이다. 시안 코드를 node로 돌려 뽑았다.
const mockupPaths = {
  4: {
    walls: "M -1.9 5.3 Q 583.0 1.8 1166.8 3.1 M 7.9 2.6 Q 582.0 5.3 1158.5 2.8 M 1162.0 -2.3 Q 1162.9 199.1 1160.4 400.4 M 1160.0 8.5 Q 1163.5 200.0 1159.7 393.1 M 1165.7 395.9 Q 584.6 398.2 -1.0 394.9 M 1156.8 395.9 Q 582.3 397.3 6.1 395.3 M 3.7 401.5 Q 7.9 200.0 5.4 -1.4 M 4.7 394.3 Q 6.6 200.7 2.7 6.3 M 114.8 -4.3 Q 109.8 148.3 114.4 304.0 M 114.7 1.9 Q 114.8 148.8 114.7 296.0 M 459.0 -5.5 Q 459.3 161.4 460.7 325.0 M 461.1 2.0 Q 461.3 162.0 460.3 317.0 M 459.2 375.8 Q 459.6 390.6 459.8 405.4 M 459.1 382.5 Q 461.3 389.8 459.0 397.5 M 110.6 300.6 Q 235.7 303.5 365.5 299.4 M 117.4 300.9 Q 235.5 299.8 355.8 301.0 M 414.9 300.7 Q 438.0 301.5 464.1 299.2 M 421.8 299.2 Q 438.8 301.3 456.6 299.4 ",
    lift: "M 24.8 231.7 Q 57.7 231.2 91.2 231.1 M 33.5 231.6 Q 56.7 232.0 83.4 231.9 M 86.6 226.4 Q 86.5 260.0 85.3 292.6 M 86.2 235.3 Q 85.2 259.1 85.4 285.0 M 90.3 288.7 Q 58.7 288.6 24.4 288.2 M 83.6 287.8 Q 59.2 287.1 33.4 288.3 M 30.5 293.3 Q 28.9 260.1 30.5 226.1 M 29.4 284.7 Q 31.0 260.7 30.0 234.2 M 45.4 260.0 Q 53.7 251.0 60.9 242.7 M 50.6 253.4 Q 53.9 251.3 55.6 247.8 M 54.3 242.0 Q 62.7 250.6 70.0 260.0 M 60.0 248.0 Q 63.1 250.7 64.9 254.0 M 45.6 260.6 Q 53.0 269.1 61.5 277.8 M 51.4 266.2 Q 53.7 269.4 55.7 271.4 M 54.7 277.3 Q 62.9 268.8 70.1 260.5 M 59.7 271.3 Q 61.8 268.4 64.7 266.0 "
  },
  1: {
    walls: "M -2.3 5.5 Q 583.2 0.3 1167.3 4.1 M 8.4 3.3 Q 581.7 10.0 1157.7 4.8 M 1162.4 -1.7 Q 1163.4 201.7 1160.5 399.7 M 1161.9 7.7 Q 1158.5 198.1 1160.3 392.7 M 1167.0 395.6 Q 583.6 399.7 0.1 394.6 M 1156.6 394.9 Q 584.3 395.7 6.4 396.9 M 4.3 402.2 Q 8.1 199.4 5.5 -0.7 M 5.3 394.5 Q 10.3 198.3 2.6 7.2 M 115.3 -3.9 Q 113.1 148.1 114.6 305.0 M 115.2 3.0 Q 114.6 151.2 114.6 295.8 M 458.0 -6.0 Q 459.7 148.8 459.1 305.3 M 458.0 3.6 Q 456.7 149.0 458.4 297.9 M 840.1 -4.5 Q 838.0 158.6 840.2 325.4 M 838.9 2.6 Q 838.2 160.5 839.4 318.0 M 839.9 374.8 Q 839.9 391.6 839.2 404.5 M 839.5 382.9 Q 838.7 391.0 840.0 397.6 M 109.1 299.3 Q 238.5 300.6 365.7 300.7 M 118.6 300.7 Q 237.7 302.5 357.8 298.9 M 415.2 299.0 Q 591.4 297.1 765.4 300.0 M 422.9 299.6 Q 589.1 300.4 758.0 299.1 M 814.3 300.7 Q 831.5 298.2 843.9 299.0 M 823.4 301.0 Q 830.4 300.1 835.9 300.9 ",
    lift: "M 24.6 232.4 Q 57.0 231.2 91.1 232.3 M 33.4 231.7 Q 59.4 232.7 82.9 232.3 M 85.9 227.8 Q 85.9 261.1 85.9 293.5 M 86.5 235.1 Q 88.0 261.3 86.7 285.5 M 91.1 288.3 Q 59.3 288.4 25.5 288.4 M 83.0 287.6 Q 59.3 289.1 33.0 288.0 M 30.5 292.2 Q 31.1 258.7 30.5 226.5 M 30.7 285.6 Q 28.3 258.8 29.3 235.3 M 46.0 259.9 Q 53.4 251.1 61.0 242.7 M 51.0 253.7 Q 53.6 250.4 55.6 248.0 M 54.3 242.1 Q 63.2 250.8 70.7 260.1 M 59.8 248.5 Q 62.7 250.5 65.3 253.3 M 45.4 260.2 Q 53.7 269.2 61.7 277.9 M 51.3 266.6 Q 52.9 268.7 56.2 272.2 M 55.1 277.9 Q 62.8 269.0 70.2 260.3 M 60.2 271.6 Q 63.2 269.1 64.7 266.3 "
  }
};

describe("floorPlanPencilPaths: 연필로 흔든 벽", () => {
  it("층 번호 씨앗으로 시안과 같은 경로를 그린다", () => {
    assert.deepEqual(floorPlanPencilPaths(4, "top"), mockupPaths[4]);
    assert.deepEqual(floorPlanPencilPaths(1, "std"), mockupPaths[1]);
  });

  it("몇 번을 다시 그려도 같은 문자열이고 Math.random을 쓰지 않는다", () => {
    const original = Math.random;
    Math.random = () => {
      throw new Error("Math.random 금지");
    };
    try {
      assert.deepEqual(floorPlanPencilPaths(3, "std"), floorPlanPencilPaths(3, "std"));
    } finally {
      Math.random = original;
    }
  });

  it("층마다 씨앗이 달라 같은 배치라도 선 모양이 다르다", () => {
    assert.notEqual(floorPlanPencilPaths(3, "std").walls, floorPlanPencilPaths(2, "std").walls);
  });
});
