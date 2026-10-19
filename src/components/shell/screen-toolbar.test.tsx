import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { renderInShell } from "@/components/shell/test-harness";
import type { Role } from "@/lib/authorization";

const october = { id: "m-2026-10", monthKey: "2026-10", status: "OPEN", startDate: "2026-10-01", endDate: "2026-10-31" };
const september = { id: "m-2026-09", monthKey: "2026-09", status: "LOCKED", startDate: "2026-09-01", endDate: "2026-09-30" };
const october14 = { operatingMonthId: "m-2026-10", date: "2026-10-14" };

function renderToolbar(role: Role, path: string, extra: { action?: React.ReactNode; status?: React.ReactNode } = {}) {
  return renderToStaticMarkup(
    renderInShell(
      <ScreenToolbar
        account={{ role, displayName: "Lan" }}
        context={october14}
        locale="ko"
        path={path}
        title="운영팀 일일 인센"
        {...extra}
      />,
      "ko"
    )
  );
}

function tabLinks(html: string) {
  const tabs = html.match(/<nav[^>]*aria-label="정산 화면"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
  return [...tabs.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1].replaceAll("&amp;", "&"),
    label: match[2],
    current: match[0].includes('aria-current="page"')
  }));
}

function links(html: string) {
  return [...html.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((match) => ({
    href: match[1].replaceAll("&amp;", "&"),
    label: match[2]
  }));
}

describe("ScreenToolbar", () => {
  it("puts the screen title first as the page heading", () => {
    assert.match(renderToolbar("administrator", "/settlements/operations"), /<h1[^>]*>운영팀 일일 인센<\/h1>/);
  });

  it("lists the zone's tabs as links that keep the month and date in each screen's own parameter", () => {
    assert.deepEqual(tabLinks(renderToolbar("administrator", "/settlements/operations")), [
      { href: "/settlements/schedule", label: "근무표", current: false },
      { href: "/settlements?operatingMonthId=m-2026-10&serviceDate=2026-10-14", label: "Therapist", current: false },
      { href: "/settlements/operations?operatingMonthId=m-2026-10&attendanceDate=2026-10-14", label: "운영팀 일일", current: true },
      { href: "/settlements/operations/monthly?operatingMonthId=m-2026-10", label: "운영팀 월", current: false },
      { href: "/settlements/notices", label: "공지", current: false },
      { href: "/settlements/requests", label: "승인함", current: false },
      { href: "/settlements/therapist-overview?operatingMonthId=m-2026-10", label: "현황", current: false }
    ]);
  });

  it("shows no tab list when the role has only one screen in the zone", () => {
    assert.doesNotMatch(renderToolbar("counter", "/calls"), /<nav/);
  });

  it("holds the Me menu for the waiter, who has no dock", () => {
    assert.match(renderToolbar("waiter", "/rooms"), />로그아웃</);
    assert.doesNotMatch(renderToolbar("counter", "/rooms"), />로그아웃</);
  });

  it("draws a screen's own view tabs as pill links in the tab slot, marking the current one", () => {
    const html = renderToStaticMarkup(
      renderInShell(
        <ScreenToolbar
          account={{ role: "counter", displayName: "Lan" }}
          locale="ko"
          path="/calls"
          screenTabs={{
            label: "원장 보기",
            items: [
              { href: "/calls?serviceDate=2026-10-14", label: "원장", current: false },
              { href: "/calls?serviceDate=2026-10-14&tab=cashbook", label: "하루 수납·지출", current: true }
            ]
          }}
          title="콜 원장"
        />,
        "ko"
      )
    );
    const nav = html.match(/<nav[^>]*aria-label="원장 보기"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? "";
    assert.deepEqual(
      [...nav.matchAll(/<a [^>]*class="screen-tab"[^>]*>([^<]*)<\/a>/g)].map((match) => ({
        label: match[1],
        current: match[0].includes('aria-current="page"')
      })),
      [
        { label: "원장", current: false },
        { label: "하루 수납·지출", current: true }
      ]
    );
  });

  it("places the primary action and screen status in the toolbar", () => {
    const html = renderToolbar("counter", "/rooms", {
      action: <button type="button">빠른 예약</button>,
      status: <span>마지막 갱신 10:30</span>
    });

    assert.match(html, />빠른 예약</);
    assert.match(html, />마지막 갱신 10:30</);
  });
});

function renderControls(path: string, date: string | null, today = "2026-10-20") {
  return renderToStaticMarkup(
    <DateContextControls
      date={date}
      locale="ko"
      months={[october, september]}
      path={path}
      selectedMonth={october}
      today={today}
    />
  );
}

describe("DateContextControls", () => {
  it("is a query form for the operating month and date of the screen", () => {
    const html = renderControls("/calls", "2026-10-14");

    assert.match(html, /<form[^>]*action="\/calls"[^>]*method="get"/);
    assert.match(html, /<select[^>]*aria-label="운영월"[^>]*name="operatingMonthId"/);
    assert.match(html, /<option value="m-2026-10" selected="">2026-10/);
    assert.match(html, /<input[^>]*aria-label="조회날짜"[^>]*name="serviceDate"[^>]*value="2026-10-14"/);
    assert.match(html, /<button[^>]*type="submit"[^>]*>조회<\/button>/);
  });

  it("steps to the previous and next day and jumps to today within the operating months", () => {
    assert.deepEqual(links(renderControls("/calls", "2026-10-14")), [
      { href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-13", label: "이전 날" },
      { href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-20", label: "오늘" },
      { href: "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-15", label: "다음 날" }
    ]);
  });

  it("does not step outside the operating month and hides today when no month contains it", () => {
    assert.deepEqual(
      links(renderControls("/rooms", "2026-10-01", "2026-12-01")).map((link) => link.label),
      ["다음 날"]
    );
    assert.deepEqual(
      links(renderControls("/rooms", "2026-10-31", "2026-12-01")).map((link) => link.label),
      ["이전 날"]
    );
  });

  it("uses the attendance date parameter on the operations screens", () => {
    const html = renderControls("/settlements/operations", "2026-10-14");

    assert.match(html, /name="attendanceDate"/);
    assert.match(html, /href="\/settlements\/operations\?operatingMonthId=m-2026-10&amp;attendanceDate=2026-10-13"/);
  });

  it("keeps the screen's own view parameters when the month or date changes", () => {
    const html = renderToStaticMarkup(
      <DateContextControls
        date="2026-10-14"
        keepParams={{ tab: "cashbook" }}
        locale="ko"
        months={[october, september]}
        path="/calls"
        selectedMonth={october}
        today="2026-10-20"
      />
    );

    assert.match(html, /<input type="hidden" name="tab" value="cashbook"\/>/);
    assert.deepEqual(
      links(html).map((link) => link.href),
      [
        "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-13&tab=cashbook",
        "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-20&tab=cashbook",
        "/calls?operatingMonthId=m-2026-10&serviceDate=2026-10-15&tab=cashbook"
      ]
    );
  });

  it("asks only for the operating month on month-only screens", () => {
    const html = renderControls("/closing", null);

    assert.match(html, /name="operatingMonthId"/);
    assert.doesNotMatch(html, /type="date"/);
    assert.deepEqual(links(html), []);
  });
});
