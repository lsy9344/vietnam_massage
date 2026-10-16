import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CallStatusChip, callStatusKeyOf } from "@/components/domain/call-status-chip";

// 기호(aria-hidden)를 뺀 글자.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function icon(html: string) {
  return html.match(/<svg[\s\S]*?<\/svg>/)?.[0] ?? "";
}

describe("콜 상태 칩", () => {
  it("gives 사용중, 청소중, 방문완료, 노쇼 each their own filled color and their own symbol", () => {
    const inUse = renderToStaticMarkup(<CallStatusChip label="사용중" status="inUse" />);
    const cleaning = renderToStaticMarkup(<CallStatusChip label="청소중" status="cleaning" />);
    const completed = renderToStaticMarkup(<CallStatusChip label="방문완료" status="completed" />);
    const noShow = renderToStaticMarkup(<CallStatusChip label="노쇼" status="noShow" />);

    assert.match(inUse, /bg-info text-info-foreground/);
    assert.match(cleaning, /bg-warning text-warning-foreground/);
    assert.match(completed, /bg-success text-success-foreground/);
    assert.match(noShow, /bg-danger text-danger-foreground/);

    const icons = [inUse, cleaning, completed, noShow].map(icon);
    assert.ok(icons.every((markup) => /<svg[^>]*aria-hidden="true"/.test(markup)));
    assert.equal(new Set(icons).size, 4);
    assert.equal(text(cleaning), "청소중");
  });

  it("puts the count in a light bubble inside the chip, and drops the fill when the count is 0 so only present states stand out", () => {
    const two = renderToStaticMarkup(<CallStatusChip count={{ value: 2, text: "2건" }} label="사용중" status="inUse" />);
    assert.match(two, /^<span class="[^"]*bg-info text-info-foreground[^"]*">[\s\S]*사용중[\s\S]*<span class="[^"]*bg-surface text-info[^"]*">2건<\/span><\/span>$/);
    // 글자로 읽으면 "사용중 2건"이다(E2E가 목록 글자로 찾는다).
    assert.match(two.replace(/<[^>]+>/g, ""), /사용중 2건/);

    const zero = renderToStaticMarkup(<CallStatusChip count={{ value: 0, text: "0건" }} label="노쇼" status="noShow" />);
    assert.doesNotMatch(zero, /bg-danger/);
    assert.match(zero, /border border-border-strong[^"]*text-muted/);
    // 기호는 그 상태 색으로 남아 모양으로 알아본다.
    assert.match(zero, /<svg[^>]*class="[^"]*text-danger/);
    assert.match(zero, /bg-readonly[^"]*">0건<\/span>/);
  });

  it("keeps 예약 and 취소 as the unfilled ○ chip, with the count in the same bubble", () => {
    for (const status of ["reserved", "canceled"] as const) {
      const html = renderToStaticMarkup(<CallStatusChip count={{ value: 4, text: "4건" }} label="예약" status={status} />);
      assert.match(html, /^<span class="[^"]*border border-border-strong bg-surface text-foreground[^"]*"><span aria-hidden="true">○︎<\/span>/);
      assert.doesNotMatch(html, /<svg/);
      assert.match(html, /bg-readonly[^"]*">4건<\/span>/);
      assert.equal(text(html), "예약 4건");
    }
    // 0건이어도 채움이 없던 칩이라 모양이 그대로다.
    const canceledZero = renderToStaticMarkup(<CallStatusChip count={{ value: 0, text: "0건" }} label="취소" status="canceled" />);
    assert.match(canceledZero, /^<span class="[^"]*border border-border-strong bg-surface text-foreground/);
    assert.match(canceledZero, /bg-readonly text-foreground[^"]*">0건<\/span>/);
  });

  it("drops the fill for 0 even without a bubble, for lists whose count sits in its own value cell", () => {
    const zero = renderToStaticMarkup(<CallStatusChip count={{ value: 0 }} label="노쇼" status="noShow" />);
    assert.doesNotMatch(zero, /bg-danger|bg-readonly|bg-surface/);
    assert.match(zero, /border border-border-strong[^"]*text-muted/);
    assert.equal(text(zero), "노쇼");

    const one = renderToStaticMarkup(<CallStatusChip count={{ value: 1 }} label="노쇼" status="noShow" />);
    assert.match(one, /bg-danger text-danger-foreground/);
    assert.equal(text(one), "노쇼");
  });

  it("reads both master codes and the old Korean values as a call status", () => {
    const cases: Array<[string, ReturnType<typeof callStatusKeyOf>]> = [
      ["RESERVED", "reserved"],
      ["예약", "reserved"],
      ["IN_USE", "inUse"],
      ["USING", "inUse"],
      ["사용중", "inUse"],
      ["CLEANING", "cleaning"],
      ["청소중", "cleaning"],
      ["VISIT_COMPLETE", "completed"],
      ["방문완료", "completed"],
      ["NO_SHOW", "noShow"],
      ["노쇼", "noShow"],
      ["CANCELED", "canceled"],
      ["CANCELLED", "canceled"],
      ["취소", "canceled"],
      ["SOMETHING_ELSE", null]
    ];
    for (const [status, key] of cases) assert.equal(callStatusKeyOf(status), key, status);
  });

  it("has a small size for status cells inside table rows", () => {
    const html = renderToStaticMarkup(<CallStatusChip label="청소중" size="sm" status="cleaning" />);
    assert.match(html, /^<span class="[^"]*min-h-6 max-w-full gap-1 px-1\.5 text-xs[^"]*bg-warning text-warning-foreground/);
    assert.match(html, /<svg[^>]*class="size-3/);
    // 좁은 칸에서 긴 이름(베트남어 등)은 옆 칸을 덮지 않고 말줄임으로 잘린다.
    assert.match(html, /<span class="min-w-0 truncate">청소중<\/span>/);
  });
});
