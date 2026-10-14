import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SkipLinks } from "@/components/shell/skip-links";

function skipLinks(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => [match[1], match[2]]);
}

describe("SkipLinks", () => {
  it("lets keyboard users jump to the main content or to the workflow dock", () => {
    assert.deepEqual(skipLinks(renderToStaticMarkup(<SkipLinks locale="ko" role="counter" />)), [
      ["#main-content", "본문으로"],
      ["#workflow-dock", "업무 이동으로"]
    ]);
  });

  it("offers only the main content link to the waiter, who has no dock", () => {
    assert.deepEqual(skipLinks(renderToStaticMarkup(<SkipLinks locale="ko" role="waiter" />)), [["#main-content", "본문으로"]]);
  });
});
