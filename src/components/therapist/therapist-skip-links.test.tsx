import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistSkipLinks } from "@/components/therapist/therapist-skip-links";

function skipLinks(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => [match[1], match[2]]);
}

describe("TherapistSkipLinks", () => {
  it("always offers both the main content and the tab bar link (아래 탭이 늘 있다)", () => {
    assert.deepEqual(skipLinks(renderToStaticMarkup(<TherapistSkipLinks locale="ko" />)), [
      ["#therapist-main-content", "본문으로"],
      ["#therapist-tab-bar", "Therapist 화면 이동"]
    ]);
  });

  it("renders in Vietnamese by default", () => {
    assert.deepEqual(skipLinks(renderToStaticMarkup(<TherapistSkipLinks locale="vi" />)), [
      ["#therapist-main-content", "Tới nội dung chính"],
      ["#therapist-tab-bar", "Di chuyển màn hình KTV"]
    ]);
  });
});
