import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistTodayStatus } from "@/components/therapist/therapist-today-status";
import { renderInShell } from "@/components/shell/test-harness";

// R17(design.md §2.3): 돈이 아닌 다음 콜까지 남은 시간은 매출 계열(lavender)을 쓰지 않는다 —
// 오늘 예상 코스 수당(src/app/therapist/page.tsx)이 그 돈 카드라 lavender를 쓴다.
it("colors the next-call card butter, not the money accent lavender", () => {
  const html = renderToStaticMarkup(renderInShell(<TherapistTodayStatus doneCount={3} locale="ko" nextCallInMinutes={20} />, "ko"));
  const nextCallCard = html.match(/<div class="[^"]*"><dt class="[^"]*">다음 콜까지[\s\S]*?<\/div>/)?.[0] ?? html;
  assert.match(nextCallCard, /bg-accent-butter/);
  assert.doesNotMatch(nextCallCard, /bg-accent-lavender/);
});
