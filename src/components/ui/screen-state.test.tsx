import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScreenState } from "@/components/ui/screen-state";

describe("화면 상태", () => {
  it("announces a warning right away, in the warning colour with its symbol, like an error", () => {
    const html = renderToStaticMarkup(<ScreenState kind="warning" label="계산 경고" title="집계 제외 항목이 있습니다" />);

    assert.match(html, /^<section class="[^"]*border-warning"[^>]*role="alert"/);
    assert.match(html, /bg-warning-soft text-warning"><span aria-hidden="true">▲︎<\/span>계산 경고/);
    assert.match(renderToStaticMarkup(<ScreenState kind="error" label="오류" title="불러오지 못했습니다" />), /role="alert"/);
  });

  it("stays a polite status for the calm kinds", () => {
    for (const kind of ["empty", "stale", "locked", "loading"] as const) {
      assert.match(renderToStaticMarkup(<ScreenState kind={kind} label="상태" title="제목" />), /role="status"/);
    }
  });

  it("takes a region name that differs from its title when a screen needs one", () => {
    const html = renderToStaticMarkup(<ScreenState kind="error" label="오류" name="월간 금액 KPI 표시 보류" title="월간 금액 KPI를 표시하지 않습니다" />);

    assert.match(html, /<section aria-label="월간 금액 KPI 표시 보류"/);
    assert.doesNotMatch(renderToStaticMarkup(<ScreenState kind="empty" label="상태" title="제목" />), /aria-label/);
  });
});
