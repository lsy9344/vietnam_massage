import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import type { RoomStatusDto } from "@/modules/rooms/dtos";

function roomStatus(overrides: Partial<RoomStatusDto> = {}): RoomStatusDto {
  return {
    roomId: "room-401",
    roomDisplayName: "401 호실",
    roomSortOrder: 1,
    displayStatus: "사용중",
    sourceCallStatus: "사용중",
    activeCallId: "call-1",
    serviceDate: "2026-10-14",
    startTime: "18:40",
    // 19:40 (UTC+7)
    expectedEndAt: "2026-10-14T12:40:00.000Z",
    remainingMinutes: 39,
    course: { id: "course-a", code: "A", name: "아로마 바디 60", tvDisplayName: "A60 아로마", durationMinutes: 60 },
    therapist1: { id: "t1", displayName: "Mai", staffCode: "T1" },
    therapist2: { id: "t2", displayName: "Linh", staffCode: "T2" },
    earcare: null,
    guidanceText: "서비스가 진행 중입니다.",
    updatedAt: "2026-10-14T12:01:00.000Z",
    ...overrides
  };
}

const emptyRoom = roomStatus({
  displayStatus: "빈방",
  sourceCallStatus: null,
  activeCallId: null,
  startTime: null,
  expectedEndAt: null,
  remainingMinutes: null,
  course: null,
  therapist1: null,
  therapist2: null
});

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// 날짜 캡슐(design.md 6.9) 안의 글자: 흐린 라벨 + 시각.
function capsules(html: string) {
  return [
    ...html.matchAll(
      /<span class="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-surface-float px-2\.5 text-xs font-semibold">(<span[^>]*>[^<]*<\/span>[^<]*)<\/span>/g
    )
  ].map((match) => text(match[1]));
}

describe("객실 카드", () => {
  it("draws the service's values as given: room, status, guidance, course and assignees, then start and display end in date capsules and remaining minutes", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus()} />);

    assert.match(html, /<article aria-label="401 호실 사용중"[^>]*data-testid="room-status-card"/);
    assert.equal(
      text(html),
      "401 호실 사용중 서비스가 진행 중입니다. 코스 A60 아로마 담당자 Mai / Linh 시작 18:40 종료예정 19:40 남은분 39분"
    );
    // 카드 안 예약시각·표시 종료는 날짜 캡슐이다(design.md 6.9).
    assert.deepEqual(capsules(html), ["시작 18:40", "종료예정 19:40"]);
    // 상태는 글자와 기호, 고정 객실 상태색을 함께 쓴다.
    assert.match(html, /aria-label="상태: 사용중"[^>]*bg-status-active[^>]*><span aria-hidden="true">●/);
  });

  it("is an 18px card on the work surface without a shadow, and stays read-only", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus()} />);
    const article = html.match(/<article[^>]*>/)?.[0] ?? "";

    assert.match(article, /rounded-lg/);
    assert.match(article, /border border-border bg-surface/);
    assert.doesNotMatch(article, /shadow|rounded-md/);
    assert.doesNotMatch(html, /<button|<a |onclick|cursor-pointer/i);
  });

  it("keeps an empty room short: dashes for course and assignee and no time row", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="ko" status={emptyRoom} />);

    assert.equal(text(html), "401 호실 빈방 즉시 가능 코스 - 담당자 -");
    assert.deepEqual(capsules(html), []);
    assert.match(html.match(/<article[^>]*>/)?.[0] ?? "", /border-dashed border-status-empty bg-surface/);
  });

  it("shows no remaining minutes when the service gives none (a reservation)", () => {
    const html = renderToStaticMarkup(
      <RoomStatusCard
        locale="ko"
        status={roomStatus({ displayStatus: "예약", sourceCallStatus: "예약", startTime: "20:10", expectedEndAt: "2026-10-14T14:10:00.000Z", remainingMinutes: null })}
      />
    );

    assert.deepEqual(capsules(html), ["시작 20:10", "종료예정 21:10"]);
    assert.doesNotMatch(text(html), /남은분/);
    assert.match(text(html), /예약 고객 입실 준비가 필요합니다\./);
  });

  it("keeps display end and remaining minutes in place with a dash when an occupied room has no value", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus({ expectedEndAt: null, remainingMinutes: null })} />);

    assert.deepEqual(capsules(html), ["시작 18:40", "종료예정 -"]);
    assert.match(text(html), /남은분 -$/);
  });

  it("marks ending soon and end check with their own attention ring and never re-derives the status from the minutes", () => {
    const endingSoon = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus({ displayStatus: "종료임박", remainingMinutes: 6 })} />);
    assert.match(endingSoon.match(/<article[^>]*>/)?.[0] ?? "", /status-attention border-status-ending-soon/);
    assert.match(text(endingSoon), /곧 종료/);

    const check = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus({ displayStatus: "종료확인", remainingMinutes: 0 })} />);
    assert.match(check.match(/<article[^>]*>/)?.[0] ?? "", /status-attention border-status-complete-check/);
    assert.match(text(check), /결제·확인 필요/);
    assert.match(text(check), /남은분 0분/);

    // 남은 시간이 0이어도 서비스가 사용중이라고 하면 사용중으로 그린다.
    const asGiven = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus({ displayStatus: "사용중", remainingMinutes: 0 })} />);
    assert.match(asGiven, /aria-label="상태: 사용중"/);
    assert.doesNotMatch(asGiven, /status-attention/);
  });

  it("keeps TV type large and the times as plain large text", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="ko" status={roomStatus()} variant="tv" />);

    assert.match(html, /<h2 class="[^"]*text-\[40px\]/);
    assert.match(html, /aria-label="상태: 사용중" class="[^"]*text-\[28px\]/);
    // 첫 문단(안내)과 값은 22px이다.
    assert.match(html.match(/<p[^>]*>/)?.[0] ?? "", /text-\[22px\]/);
    assert.deepEqual(capsules(html), []);
    assert.match(text(html), /시작 18:40 종료예정 19:40 남은분 39분/);
    assert.match(html.match(/<article[^>]*>/)?.[0] ?? "", /rounded-lg/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(<RoomStatusCard locale="vi" status={roomStatus()} />);

    assert.match(html, /aria-label="Trạng thái: Đang sử dụng"/);
    assert.match(text(html), /Gói dịch vụ A60 아로마 Người phụ trách Mai \/ Linh Bắt đầu 18:40 Dự kiến kết thúc 19:40 Số phút còn lại 39 phút/);
  });
});
