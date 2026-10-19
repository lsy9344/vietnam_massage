import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AddExpenseForm,
  AddExpensePanel,
  DailyExpensePanel,
  ExpenseMethodControl,
  ExpenseSaveButton
} from "@/app/(erp)/calls/daily-expense-panel";
import { renderInShell } from "@/components/shell/test-harness";

function render(locale: "ko" | "vi", node: ReactNode) {
  return renderToStaticMarkup(renderInShell(<>{node}</>, locale));
}

const handlers = [{ value: "handler-1", label: "담당자1" }];
const target = { handlers, operatingMonthId: "m-2026-10", serviceDate: "2026-10-14" };

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

describe("지출 추가", () => {
  it("is the cashbook tab's primary action: a black button that is off in a locked month", () => {
    const open = render("ko", <AddExpensePanel {...target} isLocked={false} />);
    assert.match(open, /<button[^>]*class="[^"]*bg-brand[^"]*"[^>]*>지출 추가<\/button>/);
    assert.doesNotMatch(open, /disabled=""/);

    const locked = render("ko", <AddExpensePanel {...target} isLocked />);
    assert.match(locked, /<button[^>]*disabled=""[^>]*>지출 추가<\/button>/);
  });

  it("asks for each field with a visible label in the drawer form", () => {
    const html = render("ko", <AddExpenseForm {...target} onAdded={() => undefined} />);

    for (const label of ["지출금액", "내용", "지출 담당자", "수단", "비고"]) {
      assert.match(html, new RegExp(`<span class="text-sm font-semibold text-foreground">${label}</span>`));
    }
    assert.doesNotMatch(html, /sr-only/);
    assert.match(html, /name="operatingMonthId" value="m-2026-10"/);
    assert.match(html, /name="expenseDate" value="2026-10-14"/);
    assert.match(html, /<button[^>]*type="submit"[^>]*>지출 추가<\/button>/);

    assert.match(render("vi", <AddExpenseForm {...target} onAdded={() => undefined} />), />Số tiền chi</);
  });

  it("leaves the add form out of the expense list, which keeps editing in each row", () => {
    const html = render("ko", <DailyExpensePanel {...target} expenses={[]} isLocked={false} />);
    assert.doesNotMatch(html, /지출 추가/);
    assert.match(html, /이 날짜에 등록된 지출이 없습니다\./);
  });

  // 목록 행의 칸은 한 줄로 나란히 선다. 수단만 글자 라벨이 보이면 수단 칸만 아래로 밀린다.
  it("hides every field label in a list row, the method included, so the row's fields line up", () => {
    const expense = {
      id: "expense-1",
      operatingMonthId: "m-2026-10",
      expenseDate: "2026-10-14",
      amount: 100000,
      method: "cash" as const,
      description: "김부장 커피",
      handledByEmployee: { id: "handler-1", displayName: "카운터", staffCode: "CNT-001" },
      note: null,
      isActive: true,
      createdAt: "2026-10-14T03:00:00.000Z",
      updatedAt: "2026-10-14T03:00:00.000Z"
    };
    const html = render("ko", <DailyExpensePanel {...target} expenses={[expense]} isLocked={false} />);
    const row = html.match(/<tbody[\s\S]*?<\/tbody>/)?.[0] ?? "";

    for (const label of ["지출금액", "내용", "수단", "비고"]) {
      assert.match(row, new RegExp(`<span class="sr-only">${label}</span>`));
    }
    assert.doesNotMatch(row, /<span class="text-sm font-semibold text-foreground">/);
  });
});

