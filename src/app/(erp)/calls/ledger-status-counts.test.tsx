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
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} customerHref="/customers" locale="ko" />);
    const line = html.match(/<ul aria-label="상태별 건수"[^>]*>([\s\S]*?)<\/ul>/)?.[0] ?? "";
    const cards = line.match(/<li[^>]*>[\s\S]*?<\/li>/g) ?? [];

    assert.equal(cards.length, 7);
    assert.equal(text(line), "전체 6건 예약 1건 사용중 1건 청소중 1건 방문완료 2건 노쇼 0건 취소 1건");
    // 좁은 폭에서는 줄을 넘겨 감싼다. 카드는 요약 카드 모양(rounded-lg px-5 py-4)이고 베이지 면이다.
    assert.match(line, /^<ul aria-label="상태별 건수" class="[^"]*flex-wrap/);
    for (const card of cards) assert.match(card, /^<li class="[^"]*rounded-lg bg-surface px-5 py-4/);
    // 전체 숫자가 가장 크다(요약 숫자 크기). 상태 카드는 그보다 작다.
    assert.match(cards[0], /text-\[1\.75rem\][^"]*min-\[1200px\]:text-4xl[^"]*">6/);
    assert.doesNotMatch(cards[1], /text-4xl/);
    // 상태는 같은 기호와 색의 칩으로 이름을 단다. 사용중과 청소중은 색이 다르고, 노쇼 0건은 채우지 않는다.
    assert.match(cards[2], /bg-info text-info-foreground/);
    assert.match(cards[3], /bg-warning text-warning-foreground/);
    assert.match(cards[4], /bg-success text-success-foreground/);
    assert.doesNotMatch(line, /bg-danger/);
    assert.doesNotMatch(html, /VND/);
  });

  it("links to the customer screen instead of holding customer registration", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} customerHref="/customers" locale="ko" />);
    assert.match(html, /<a class="screen-step" href="\/customers">고객 화면<\/a>/);
    assert.doesNotMatch(html, /<form|<input/);

    assert.doesNotMatch(renderToStaticMarkup(<LedgerStatusCounts counts={counts} customerHref={null} locale="ko" />), /고객 화면/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} customerHref="/customers" locale="vi" />);
    assert.match(text(html), /Tất cả 6ca Đặt trước 1ca Đang sử dụng 1ca/);
    assert.match(html, />Màn hình khách</);
  });
});
