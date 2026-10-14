import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { RoomStatusCounts } from "@/components/domain/room-status-counts";
import type { RoomDisplayStatus } from "@/modules/rooms/dtos";

const displayStatuses: RoomDisplayStatus[] = ["사용중", "빈방", "사용중", "종료확인", "청소중", "빈방", "빈방", "예약"];

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("상태별 객실 수", () => {
  it("counts the display status the room status service gave each room, in the room's day order, zeros included", () => {
    const html = renderToStaticMarkup(<RoomStatusCounts displayStatuses={displayStatuses} locale="ko" />);

    assert.match(html, /^<ul aria-label="상태별 객실 수"/);
    assert.equal(text(html), "예약 1실 사용중 2실 종료임박 0실 종료확인 1실 청소중 1실 빈방 3실");
    // 객실 상태는 고정색 StatusBadge의 글자·기호·색으로 보인다(design.md 2.5).
    assert.match(html, /bg-status-complete-check[^>]*><span aria-hidden="true">⚠/);
  });

  it("does not reuse the room card's status label, so each card badge stays the only \"상태: …\" on the page", () => {
    const html = renderToStaticMarkup(<RoomStatusCounts displayStatuses={displayStatuses} locale="ko" />);

    assert.doesNotMatch(html, /상태: /);
    assert.match(html, /aria-label="사용중"/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(<RoomStatusCounts displayStatuses={displayStatuses} locale="vi" />);

    assert.match(html, /aria-label="Số phòng theo trạng thái"/);
    assert.match(text(html), /^Đặt trước 1 phòng Đang sử dụng 2 phòng/);
  });
});
