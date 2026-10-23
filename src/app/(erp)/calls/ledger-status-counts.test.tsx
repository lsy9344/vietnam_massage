import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LedgerStatusCounts } from "@/app/(erp)/calls/ledger-status-counts";

const counts = {
  totalCount: 6,
  reservedCount: 1,
  inUseCount: 1,
  cleaningCount: 1,
  completedCount: 2,
  noShowCount: 0,
  canceledCount: 1
};

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("원장 탭의 상태 카드 (1018 스펙 D16)", () => {
  it("shows seven cards in one row: all calls, then each status from 예약 to 취소 with its count", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} locale="ko" />);
    const line = html.match(/<ul aria-label="상태별 건수"[^>]*>([\s\S]*?)<\/ul>/)?.[0] ?? "";
    const cards = line.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];

    assert.equal(cards.length, 7);
    assert.equal(text(line), "전체 6건 예약 1건 사용중 1건 청소중 1건 방문완료 2건 노쇼 0건 취소 1건");
    // 카드 줄은 빠른 예약 앞의 가로를 다 쓰고 일곱 장이 같은 폭으로 나눠 갖는다(2026-10-23 고객 요청, 시안 111.png).
    // 좁으면 같은 폭 카드로 줄을 넘긴다.
    assert.match(line, /^<ul aria-label="상태별 건수" class="[^"]*\bgrid\b[^"]*\bflex-1\b/);
    assert.match(line, /^<ul aria-label="상태별 건수" class="[^"]*min-\[1100px\]:grid-cols-7/);
    // 카드는 칸을 채우는 요약 카드이고, 좁아지면 칩 글자가 칸 안에서 말줄임으로 줄어든다.
    for (const card of cards) assert.match(card, /^<li class="[^"]*min-w-0 rounded-lg bg-surface px-4 py-2\.5/);
    // 전체 숫자가 가장 크다. 상태 카드는 그보다 작다.
    assert.match(cards[0], /text-2xl[^"]*">6/);
    assert.doesNotMatch(cards[1], /text-2xl/);
    // 상태는 같은 기호와 색의 칩으로 이름을 단다. 사용중과 청소중은 색이 다르고, 노쇼 0건은 채우지 않는다.
    assert.match(cards[2], /bg-info text-info-foreground/);
    assert.match(cards[3], /bg-warning text-warning-foreground/);
    assert.match(cards[4], /bg-success text-success-foreground/);
    assert.doesNotMatch(line, /bg-danger/);
    assert.doesNotMatch(html, /VND/);
  });

  it("puts the main action (quick booking) at the right end of the card row", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts action={<button type="button">빠른 예약 +</button>} counts={counts} locale="ko" />);
    assert.match(html, /<\/ul><div class="ml-auto[^"]*">[\s\S]*빠른 예약 \+/);
  });

  it("has no customer screen link next to quick booking (2026-10-23 고객 요청: 도크의 고객 구역으로 간다)", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts action={<button type="button">빠른 예약 +</button>} counts={counts} locale="ko" />);
    assert.doesNotMatch(html, /<a\b/);
    assert.doesNotMatch(html, /고객 화면/);
    assert.doesNotMatch(html, /<form|<input/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} locale="vi" />);
    assert.match(text(html), /Tất cả 6ca Đặt trước 1ca Đang sử dụng 1ca/);
  });
});
