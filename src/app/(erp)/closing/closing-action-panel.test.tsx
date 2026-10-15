import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ClosingActionPanel } from "./closing-action-panel";
import { renderInShell } from "@/components/shell/test-harness";

it("마감 처리 네 버튼은 44px 공용 버튼과 보이는 포커스를 사용한다 (티켓 39)", () => {
  const html = ["작성중", "마감확정"].map((status) => renderToStaticMarkup(renderInShell(
    <ClosingActionPanel operatingMonthId="month-1" status={status} canWrite canReopen confirmSummary={null} checklistBlocked={false} pendingCloseCalls={[]} canOpenLedger />,
    "ko"
  ))).join("");
  for (const label of ["검토 시작", "마감 확정", "잠금", "재오픈"]) {
    const button = [...html.matchAll(/<button[^>]*>[\s\S]*?<\/button>/g)].find(([markup]) => markup.endsWith(`>${label}</button>`))?.[0];
    assert.ok(button, `${label} 버튼`);
    assert.match(button, /class="[^"]*\bh-11\b/);
    assert.match(button, /focus-visible:outline-brand-secondary/);
  }
});
