import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistTabBarView } from "@/components/therapist/therapist-tab-bar";
import { renderInShell } from "@/components/shell/test-harness";

function render(currentPath: string, noticeUnreadCount?: number, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(
    renderInShell(<TherapistTabBarView currentPath={currentPath} locale={locale} noticeUnreadCount={noticeUnreadCount} />, locale)
  );
}

function tabs(html: string) {
  return [...html.matchAll(/<a [^>]*data-therapist-tab="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => ({
    path: match[1],
    text: match[2].replace(/<[^>]+>/g, "").trim(),
    current: match[0].includes('aria-current="page"')
  }));
}

describe("TherapistTabBarView", () => {
  it("lists the four tabs in today → attendance → payout → notices order", () => {
    const html = render("/therapist");
    assert.deepEqual(tabs(html).map((tab) => tab.path), ["/therapist", "/therapist/attendance", "/therapist/payout", "/therapist/notices"]);
    assert.deepEqual(tabs(html).map((tab) => tab.text), ["오늘", "근태", "수당", "공지"]);
  });

  it("is a labelled navigation landmark", () => {
    assert.match(render("/therapist"), /<nav[^>]*aria-label="Therapist 화면 이동"/);
  });

  it("marks only the current screen's tab as current", () => {
    assert.deepEqual(
      tabs(render("/therapist/payout")).filter((tab) => tab.current).map((tab) => tab.path),
      ["/therapist/payout"]
    );
  });

  it("renders in Vietnamese by default", () => {
    assert.deepEqual(tabs(render("/therapist", undefined, "vi")).map((tab) => tab.text), ["Hôm nay", "Chấm công", "Thu nhập", "Thông báo"]);
  });

  it("reserves the notices tab's spot but shows nothing when there is no unread count yet", () => {
    const html = render("/therapist");
    const notices = tabs(html).find((tab) => tab.path === "/therapist/notices");
    assert.equal(notices?.text, "공지");
    assert.doesNotMatch(html, /therapist-tab-badge/);
  });

  it("shows the unread count on the notices tab only", () => {
    const html = render("/therapist", 3);
    const parsed = tabs(html);
    assert.equal(parsed.find((tab) => tab.path === "/therapist/notices")?.text, "공지3");
    assert.equal(parsed.find((tab) => tab.path === "/therapist")?.text, "오늘");
    assert.match(html, /<span class="therapist-tab-badge">3<\/span>/);
  });
});
