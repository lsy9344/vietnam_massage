import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkflowDockView } from "@/components/shell/workflow-dock";
import { renderInShell } from "@/components/shell/test-harness";
import { ledgerHref } from "@/app/(erp)/calls/ledger-address";
import type { Role } from "@/lib/authorization";

// 지금 화면 주소. 운영월·날짜는 늘 2026-10-14이고, 그 밖의 검색 값(예: tab=cashbook)은 주소에 적는다.
function renderDock(role: Role, currentUrl: string, locale: "ko" | "vi" = "ko") {
  const [currentPath, query = ""] = currentUrl.split("?");
  const searchParams = new URLSearchParams(`operatingMonthId=m-2026-10&serviceDate=2026-10-14&${query}`);
  return renderToStaticMarkup(
    renderInShell(
      <WorkflowDockView
        account={{ role, displayName: "Lan" }}
        currentPath={currentPath}
        locale={locale}
        searchParams={searchParams}
      />,
      locale
    )
  );
}

/** 도크 줄의 구역 항목: 화면이 하나인 구역은 링크, 여럿인 구역은 메뉴를 여는 버튼이다. */
function dockZones(html: string) {
  return [...html.matchAll(/<(a|button) [^>]*data-dock-zone="[^"]*"[^>]*>([^<]*)<\/\1>/g)].map((match) => ({
    label: match[2],
    opens: match[1] === "a" ? attribute(match[0], "href") : "menu",
    current: attribute(match[0], "aria-current")
  }));
}

/** 구역 버튼이 여는 메뉴의 링크. */
function zoneMenu(html: string, zoneLabel: string) {
  const trigger = html.match(new RegExp(`<button [^>]*data-dock-zone="[^"]*"[^>]*>${zoneLabel}</button>`))?.[0] ?? "";
  const menuId = attribute(trigger, "popoverTarget");
  const menu = menuId ? html.split(`id="${menuId}"`)[1]?.split("</div>")[0] ?? "" : "";
  return [...menu.matchAll(/<a [^>]*>([^<]*)<\/a>/g)].map((match) => ({
    href: attribute(match[0], "href"),
    label: match[1],
    current: match[0].includes('aria-current="page"')
  }));
}

// 속성 이름은 대소문자를 가리지 않는다(React는 popoverTarget을 그대로 적고 브라우저는 popovertarget으로 읽는다).
function attribute(tag: string, name: string) {
  return tag.match(new RegExp(` ${name}="([^"]*)"`, "i"))?.[1]?.replaceAll("&amp;", "&") ?? null;
}

describe("WorkflowDockView", () => {
  it("is a labelled navigation landmark with the role's zones in workflow order", () => {
    const html = renderDock("administrator", "/live");

    assert.match(html, /<nav[^>]*aria-label="업무 이동"/);
    assert.deepEqual(
      dockZones(html).map((zone) => zone.label),
      ["원장", "현장", "고객", "정산", "마감", "보고", "설정"]
    );
  });

  it("marks the zone of the current screen as current", () => {
    const html = renderDock("administrator", "/settlements/earcare");

    assert.deepEqual(
      dockZones(html).filter((zone) => zone.current).map((zone) => zone.label),
      ["정산"]
    );
    assert.deepEqual(
      dockZones(renderDock("administrator", "/customers")).filter((zone) => zone.current),
      [{ label: "고객", opens: "/customers", current: "page" }]
    );
  });

  it("links a zone with one screen straight to it with the chosen month", () => {
    assert.deepEqual(dockZones(renderDock("settlement_manager", "/settlements")), [
      { label: "정산", opens: "menu", current: "true" },
      { label: "마감", opens: "/closing?operatingMonthId=m-2026-10", current: null },
      { label: "보고", opens: "menu", current: null }
    ]);
  });

  it("opens a menu of the zone's screens from zones with two or more screens and goes straight to a zone's only screen", () => {
    const html = renderDock("counter", "/calls");

    assert.deepEqual(dockZones(html), [
      { label: "원장", opens: "menu", current: "true" },
      { label: "현장", opens: "menu", current: null },
      { label: "고객", opens: "/customers", current: null },
      { label: "보고", opens: "menu", current: null }
    ]);
    assert.deepEqual(zoneMenu(html, "현장"), [
      { href: "/rooms?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "객실", current: false },
      { href: "/live?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "실시간", current: false }
    ]);
    assert.deepEqual(
      zoneMenu(html, "보고").map((item) => item.label),
      ["오늘", "월간", "리포트"]
    );
  });

  it("marks the screen you are on in its zone's menu", () => {
    assert.deepEqual(
      zoneMenu(renderDock("administrator", "/settlements/earcare"), "정산").map((item) => [item.label, item.current]),
      [
        ["Therapist", false],
        ["귀케어", true],
        ["운영팀 일일", false],
        ["운영팀 월", false]
      ]
    );
  });

  it("splits the ledger menu into the ledger screen's own views at the ledger's own addresses", () => {
    const october14 = { operatingMonthId: "m-2026-10", serviceDate: "2026-10-14" };

    assert.deepEqual(zoneMenu(renderDock("counter", "/calls?tab=cashbook"), "원장"), [
      { href: ledgerHref(october14, "ledger"), label: "원장", current: false },
      { href: ledgerHref(october14, "cashbook"), label: "하루 수납·지출", current: true }
    ]);
  });

  it("offers More with the zones after the first four only to roles with five or more zones", () => {
    const admin = renderDock("administrator", "/live");
    const counter = renderDock("counter", "/calls");

    assert.match(admin, />더보기</);
    // 화면이 하나인 마감은 바로 가는 링크, 보고·설정은 그 구역의 화면 메뉴로 들어가는 버튼이다.
    const overflow = admin.split("data-dock-overflow")[1]?.split("</div>")[0] ?? "";
    assert.deepEqual(
      [...overflow.matchAll(/<(a|button) [^>]*>([^<]*)/g)].map((match) => [match[1], match[2]]),
      [
        ["a", "마감"],
        ["button", "보고"],
        ["button", "설정"]
      ]
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
      dockZones(html).map((zone) => zone.label),
      ["Sổ gọi", "Vận hành", "Khách", "Báo cáo"]
    );
    assert.match(html, />Đăng xuất</);
  });
});
