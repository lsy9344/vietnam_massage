import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardStatusCounts } from "@/app/(erp)/dashboard/dashboard-parts";

const counts = { reservation: 8, inUse: 2, cleaning: 3, completed: 20, noShow: 0, canceled: 1 };

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("대시보드 상태별 건수", () => {
  it("puts 사용중·청소중 first on the today screen and uses the ledger's call status chips with the count inside", () => {
    const html = renderToStaticMarkup(<DashboardStatusCounts counts={counts} inProgressFirst label="오늘 상태 건수" locale="ko" />);

    assert.equal(text(html), "사용중 2건 청소중 3건 예약건수 8건 방문완료 20건 노쇼 0건 취소 1건");
    assert.match(html, /bg-info text-info-foreground[^"]*">[\s\S]*?사용중<\/span> <span[^>]*>2건<\/span>/);
    assert.match(html, /bg-warning text-warning-foreground[^"]*">[\s\S]*?청소중<\/span> <span[^>]*>3건<\/span>/);
    assert.match(html, /bg-success text-success-foreground[^"]*">[\s\S]*?방문완료<\/span> <span[^>]*>20건<\/span>/);
    // 노쇼 0건은 채우지 않는다.
    assert.doesNotMatch(html, /bg-danger/);
  });
});
