import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";

describe("NoOperatingMonthNotice", () => {
  it("gives the administrator a link to the operating month settings", () => {
    const html = renderToStaticMarkup(<NoOperatingMonthNotice locale="ko" role="administrator" />);

    assert.match(html, />운영월을 먼저 생성해 주세요</);
    assert.match(html, /<a[^>]*href="\/masters\/operating-months"[^>]*>운영월 관리로 이동<\/a>/);
    assert.doesNotMatch(html, /관리자에게 운영월 생성을 요청하세요/);
  });

  it("tells every other role to ask an administrator instead of linking to a screen it cannot open", () => {
    for (const role of ["counter", "settlement_manager", "waiter", "read_only_viewer"] as const) {
      const html = renderToStaticMarkup(<NoOperatingMonthNotice locale="ko" role={role} />);

      assert.match(html, />관리자에게 운영월 생성을 요청하세요\.</, role);
      assert.doesNotMatch(html, /<a /, role);
    }
  });

  it("speaks Vietnamese by default", () => {
    const html = renderToStaticMarkup(<NoOperatingMonthNotice locale="vi" role="counter" />);

    assert.match(html, />Hãy yêu cầu quản trị viên tạo tháng vận hành\.</);
  });
});
