import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomFloorPlan } from "@/components/domain/room-floor-plan";
import type { RoomStatusDto } from "@/modules/rooms/dtos";

function roomStatus(roomDisplayName: string, overrides: Partial<RoomStatusDto> = {}): RoomStatusDto {
  return {
    roomId: `room-${roomDisplayName.slice(0, 3)}`,
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

const mai = { id: "t1", displayName: "Mai", staffCode: "T1" };
const linh = { id: "t2", displayName: "Linh", staffCode: "T2" };

// 시안(mockup/_shared.js ROOMS)의 2026-10-19 21:14 예시.
const statuses = [
  roomStatus("401 호실", { displayStatus: "사용중", remainingMinutes: 46, startTime: "20:30", therapist1: linh, therapist2: mai }),
  roomStatus("402 호실", { displayStatus: "종료임박", remainingMinutes: 6, startTime: "20:20", therapist1: mai }),
  roomStatus("301 호실", { displayStatus: "종료확인", remainingMinutes: 0, startTime: "19:40" }),
  roomStatus("302 호실", { displayStatus: "예약", startTime: "21:40" }),
  roomStatus("303 호실"),
  roomStatus("201 호실", { displayStatus: "사용중", remainingMinutes: 66 }),
  roomStatus("202 호실", { displayStatus: "청소중", startTime: "20:00" }),
  roomStatus("203 호실", { displayStatus: "사용중", remainingMinutes: 31 }),
  roomStatus("101 호실", { displayStatus: "예약", startTime: "22:00" }),
  roomStatus("102 호실"),
  roomStatus("103 호실", { displayStatus: "종료임박", remainingMinutes: 8 })
];

const noop = () => {};

/** 여는 태그의 속성 하나. */
function attr(tag: string, name: string) {
  return new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
}

/** data-testid로 고른 여는 태그들. */
function tags(html: string, testId: string) {
  return [...html.matchAll(new RegExp(`<[a-z]+[^>]*data-testid="${testId}"[^>]*>`, "g"))].map((match) => match[0]);
}

describe("RoomFloorPlan 실시간", () => {
  it("방마다 버튼 하나이고 접근 이름에 방·상태·한 줄이 들리며, 열린 방만 aria-expanded=true다", () => {
    const html = renderToStaticMarkup(<RoomFloorPlan locale="ko" onOpenRoom={noop} selectedRoomId="room-301" statuses={statuses} />);
    const rooms = tags(html, "floor-plan-room");

    assert.equal(rooms.length, 11);
    assert.ok(rooms.every((tag) => tag.startsWith("<button") && attr(tag, "aria-haspopup") === "dialog"));
    assert.deepEqual(
      rooms.map((tag) => attr(tag, "aria-label")),
      [
        "402 호실, 종료임박, 6분 남음",
        "401 호실, 사용중, 46분 남음",
        "303 호실, 빈방",
        "302 호실, 예약, 시작 21:40",
        "301 호실, 종료확인, 결제·확인 필요",
        "203 호실, 사용중, 31분 남음",
        "202 호실, 청소중",
        "201 호실, 사용중, 66분 남음",
        "103 호실, 종료임박, 8분 남음",
        "102 호실, 빈방",
        "101 호실, 예약, 시작 22:00"
      ]
    );
    assert.deepEqual(
      rooms.filter((tag) => attr(tag, "aria-expanded") === "true").map((tag) => attr(tag, "data-room-id")),
      ["room-301"]
    );
  });
});

/** data-room-id로 고른 방 이름표 하나의 HTML(여는 태그부터 짝이 맞는 닫는 태그까지). */
function roomHtml(html: string, roomId: string) {
  const start = html.search(new RegExp(`<(button|div)[^>]*data-room-id="${roomId}"[^>]*data-testid="floor-plan-room"`));
  assert.ok(start >= 0, `${roomId} 이름표가 없다`);
  const tag = /^<(button|div)/.exec(html.slice(start))![1];
  let depth = 0;
  const pattern = new RegExp(`<${tag}[\\s>]|</${tag}>`, "g");
  pattern.lastIndex = start;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, pattern.lastIndex);
  }
  throw new Error("닫는 태그가 없다");
}

describe("RoomFloorPlan 이름표", () => {
  const html = renderToStaticMarkup(<RoomFloorPlan locale="ko" onOpenRoom={noop} statuses={statuses} />);

  it("종료임박·종료확인 방 번호에만 상태색 마커 고리를 친다", () => {
    assert.match(roomHtml(html, "room-402"), /floor-plan-marker--ending-soon/);
    assert.match(roomHtml(html, "room-301"), /floor-plan-marker--complete-check/);
    for (const roomId of ["room-401", "room-302", "room-303", "room-202"]) {
      assert.doesNotMatch(roomHtml(html, roomId), /floor-plan-marker/);
    }
  });

  it("번호는 이름 앞 숫자이고, 배지 글자와 한 줄이 보이며 실시간에는 담당자가 없다", () => {
    const room = roomHtml(html, "room-302");
    assert.match(room, /<span class="floor-plan-room-number">302<\/span>/);
    assert.match(room, /aria-label="상태: 예약"/);
    assert.match(room, /<span class="floor-plan-room-label">시작<\/span><span class="floor-plan-room-value">21:40<\/span>/);
    assert.doesNotMatch(roomHtml(html, "room-401"), /floor-plan-room-who/);
    assert.doesNotMatch(roomHtml(html, "room-303"), /floor-plan-room-line/);
  });

  it("범례는 상태 배지 6개이고 화면 낭독기에는 숨긴다", () => {
    const legend = /<div aria-hidden="true" class="floor-plan-legend">[\s\S]*?<\/div>/.exec(html)?.[0] ?? "";
    assert.equal([...legend.matchAll(/aria-label="상태: /g)].length, 6);
  });
});

describe("RoomFloorPlan 지금 빈방 / 곧 비는 방", () => {
  it("빈방 칩과 남은 분이 적은 방 3개 칩을 평면도 위에 두고, 누르면 서랍을 여는 버튼이다", () => {
    const html = renderToStaticMarkup(<RoomFloorPlan locale="ko" onOpenRoom={noop} statuses={statuses} />);
    const chips = tags(html, "floor-plan-free-chip");

    assert.deepEqual(
      chips.map((tag) => attr(tag, "aria-label")),
      ["303 호실", "102 호실", "402 호실 6분", "103 호실 8분", "203 호실 31분"]
    );
    assert.ok(chips.every((tag) => tag.startsWith("<button")));
    assert.ok(html.indexOf("floor-plan-free") < html.indexOf("floor-plan-floors"));
  });

  it("해당하는 방이 없으면 '없음'을 쓴다", () => {
    const html = renderToStaticMarkup(<RoomFloorPlan locale="vi" onOpenRoom={noop} statuses={[roomStatus("301 호실", { displayStatus: "청소중" })]} />);
    assert.equal([...html.matchAll(/<span class="floor-plan-free-none">Không có<\/span>/g)].length, 2);
  });
});

describe("RoomFloorPlan 기타와 빈 칸", () => {
  it("배치에 없는 방은 평면도 아래 기타 줄에 전체 이름으로 두고, 방이 없는 칸은 이름표 없이 층만 그린다", () => {
    const html = renderToStaticMarkup(
      <RoomFloorPlan locale="ko" onOpenRoom={noop} statuses={[roomStatus("301 호실"), roomStatus("501 호실"), roomStatus("대기실")]} />
    );
    const others = /<div aria-label="기타" class="floor-plan-others" role="group">[\s\S]*$/.exec(html)?.[0] ?? "";

    assert.equal(tags(html, "floor-plan-room").length, 3);
    assert.match(others, /<span class="floor-plan-room-number">501 호실<\/span>/);
    assert.match(others, /<span class="floor-plan-room-number">대기실<\/span>/);
    assert.equal([...html.matchAll(/<section aria-labelledby="floor-plan-floor-\d"/g)].length, 4);
    assert.ok(html.indexOf("floor-plan-others") > html.indexOf("floor-plan-floors"));
  });

  it("기타 줄의 빈방은 빈방 칩에서도 전체 이름이라 같은 앞 숫자의 칸 방과 헷갈리지 않는다", () => {
    const html = renderToStaticMarkup(
      <RoomFloorPlan locale="ko" onOpenRoom={noop} statuses={[roomStatus("301 호실"), roomStatus("301-B", { roomId: "room-301b" })]} />
    );
    const chips = [...html.matchAll(/data-testid="floor-plan-free-chip"[^>]*>([^<]*)</g)].map((match) => match[1]);
    assert.deepEqual(chips, ["301", "301-B"]);
  });
});

describe("RoomFloorPlan TV", () => {
  const html = renderToStaticMarkup(<RoomFloorPlan locale="vi" statuses={statuses} variant="tv" />);

  it("버튼이 없는 읽기 전용이고 범례가 없으며 빈방 줄은 평면도 아래다", () => {
    assert.doesNotMatch(html, /<button/);
    assert.doesNotMatch(html, /floor-plan-legend/);
    assert.equal(tags(html, "floor-plan-room").length, 11);
    assert.ok(html.indexOf("floor-plan-free") > html.indexOf("floor-plan-floors"));
  });

  it("이름표에 담당 Therapist가 있고 베트남어 문구를 쓴다", () => {
    const room = roomHtml(html, "room-401");
    assert.match(room, /<span class="floor-plan-room-who">Linh \/ Mai<\/span>/);
    assert.match(room, /còn 46 phút/);
    assert.match(html, /Tầng 4/);
    assert.match(html, /Trống ngay/);
  });
});
