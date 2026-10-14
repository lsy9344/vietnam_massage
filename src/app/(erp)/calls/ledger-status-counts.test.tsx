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

describe("원장 탭의 상태별 건수", () => {
  it("shows the service's counts in one line: all calls, then each status from 예약 to 취소 with its count", () => {
    const html = renderToStaticMarkup(<LedgerStatusCounts counts={counts} customerHref="/customers" locale="ko" />);
    const line = html.match(/<ul aria-label="상태별 건수"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";

    assert.equal(text(line), "전체 6건 예약 1건 사용중 1건 청소중 1건 방문완료 2건 노쇼 0건 취소 1건");
    // 상태는 글자와 기호, 색을 함께 쓴다.
    assert.match(line, /bg-info-soft[\s\S]*사용중/);
    assert.match(line, /bg-success-soft[\s\S]*방문완료/);
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
