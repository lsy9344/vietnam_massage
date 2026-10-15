import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CustomerVisitCounts } from "@/components/domain/customer-visit-counts";

describe("고객 방문 건수(B09)", () => {
  it("방문완료, 노쇼, 취소 건수를 그 순서로 0건까지 포함해 보인다", () => {
    const html = renderToStaticMarkup(
      <CustomerVisitCounts counts={{ completedCount: 3, noShowCount: 0, canceledCount: 1 }} locale="ko" />
    );

    assert.match(html, /^<ul aria-label="방문완료·노쇼·취소 건수"/);
    assert.match(html, /방문완료[\s\S]*?3건[\s\S]*?노쇼[\s\S]*?0건[\s\S]*?취소[\s\S]*?1건/);
  });

  it("speaks Vietnamese", () => {
    const html = renderToStaticMarkup(
      <CustomerVisitCounts counts={{ completedCount: 3, noShowCount: 0, canceledCount: 1 }} locale="vi" />
    );

    assert.match(html, /aria-label="Số ca hoàn tất, không đến, đã hủy"/);
    assert.match(html, /Hoàn tất[\s\S]*?3ca[\s\S]*?Không đến[\s\S]*?0ca[\s\S]*?Đã hủy[\s\S]*?1ca/);
  });
});
