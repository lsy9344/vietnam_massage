import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkflowDockView } from "@/components/shell/workflow-dock";
import { renderInShell } from "@/components/shell/test-harness";
import type { Role } from "@/lib/authorization";

const october14 = { operatingMonthId: "m-2026-10", date: "2026-10-14" };

function renderDock(role: Role, currentPath: string, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(
    renderInShell(
      <WorkflowDockView
        account={{ role, displayName: "Lan" }}
        context={october14}
        currentPath={currentPath}
        locale={locale}
      />,
      locale
    )
  );
}

function dockLinks(html: string) {
  const dock = html.match(/<nav[^>]*id="workflow-dock"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  const primary = dock.split('data-dock-overflow')[0];
  return [...primary.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1].replaceAll("&amp;", "&"),
    label: match[2],
    current: match[0].includes('aria-current="page"')
  }));
}

describe("WorkflowDockView", () => {
  it("is a labelled navigation landmark with the role's zones in workflow order", () => {
    const html = renderDock("administrator", "/live");

    assert.match(html, /<nav[^>]*aria-label="업무 이동"/);
    assert.deepEqual(
      dockLinks(html).map((link) => link.label),
      ["원장", "현장", "고객", "정산", "마감", "보고", "설정"]
    );
  });

  it("marks the zone of the current screen as current", () => {
    const html = renderDock("administrator", "/settlements/earcare");

    assert.deepEqual(
      dockLinks(html).filter((link) => link.current).map((link) => link.label),
      ["정산"]
    );
  });

  it("links each zone to its first tab with the chosen month and date", () => {
    const links = dockLinks(renderDock("counter", "/calls"));

    assert.deepEqual(links, [
      { href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "원장", current: true },
      { href: "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "현장", current: false },
      { href: "/customers", label: "고객", current: false },
      { href: "/dashboard/today?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "보고", current: false }
    ]);
  });

  it("offers More with the zones after the first four only to roles with five or more zones", () => {
    const admin = renderDock("administrator", "/live");
    const counter = renderDock("counter", "/calls");

    assert.match(admin, />더보기</);
    const overflow = admin.match(/data-dock-overflow[\s\S]*?<\/nav>/)?.[0] ?? "";
    assert.deepEqual(
      [...overflow.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((match) => match[1]),
      ["마감", "보고", "설정"]
    );
    assert.doesNotMatch(counter, />더보기</);
  });

  it("marks More as current when the current zone sits behind it below 840px", () => {
    const moreButton = (html: string) => html.match(/<button[^>]*>더보기<\/button>/)?.[0] ?? "";

    assert.match(moreButton(renderDock("administrator", "/masters/codes")), /aria-current="true"/);
    assert.doesNotMatch(moreButton(renderDock("administrator", "/live")), /aria-current/);
  });

  it("renders no dock for the waiter", () => {
    assert.equal(renderDock("waiter", "/rooms"), "");
  });

  it("ends with the Me menu: display name, role, language switch and sign-out", () => {
    const html = renderDock("counter", "/calls");

    assert.match(html, />나</);
    assert.match(html, />Lan</);
    assert.match(html, />카운터</);
    assert.match(html, /aria-label="화면 언어 전환"/);
    assert.match(html, />로그아웃</);
  });

  it("uses Vietnamese labels by default language", () => {
    const html = renderDock("counter", "/calls", "vi");

    assert.deepEqual(
      dockLinks(html).map((link) => link.label),
      ["Sổ gọi", "Vận hành", "Khách", "Báo cáo"]
    );
    assert.match(html, />Đăng xuất</);
  });
});
