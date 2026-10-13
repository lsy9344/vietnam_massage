import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExpenseMethodControl, ExpenseSaveButton } from "@/app/(erp)/calls/daily-expense-panel";
import { LocaleProvider } from "@/lib/i18n/client";

function render(locale: "ko" | "vi", node: ReactNode) {
  return renderToStaticMarkup(<LocaleProvider locale={locale}>{node}</LocaleProvider>);
}

describe("expense method control", () => {
  it("shows a visible method label, defaults to cash, and puts the failure under the field", () => {
    const html = render("ko", <ExpenseMethodControl disabled={false} error="수단은 현금 또는 계좌입니다." />);

    assert.match(html, />수단</);
    assert.match(html, /<option value="cash" selected="">현금<\/option>/);
    assert.match(html, /<option value="bank">계좌<\/option>/);
    assert.match(html, /class="h-11 /);
    assert.match(html, /role="alert">수단은 현금 또는 계좌입니다.</);

    const vietnamese = render("vi", <ExpenseMethodControl defaultMethod="bank" disabled={false} error={null} />);
    assert.match(vietnamese, />Hình thức</);
    assert.match(vietnamese, /<option value="bank" selected="">Chuyển khoản<\/option>/);
  });

  it("waits on the save control while the expense is saving", () => {
    const saving = render("ko", <ExpenseSaveButton disabled idleLabel="지출 추가" pending />);
    assert.match(saving, /aria-busy="true"/);
    assert.match(saving, /disabled=""/);
    assert.match(saving, />저장 중</);

    const idle = render("vi", <ExpenseSaveButton disabled={false} idleLabel="Thêm chi phí" pending={false} />);
    assert.match(idle, /aria-busy="false"/);
    assert.match(idle, />Thêm chi phí</);
    assert.doesNotMatch(idle, /Đang lưu/);
  });
});
