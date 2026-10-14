import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RoomStatusRefresh,
  RoomStatusRefreshController,
  RoomStatusStaleNotice
} from "@/components/domain/room-status-refresh-controller";
import { renderInShell } from "@/components/shell/test-harness";

// 매장 19:01:35(UTC+7). 자동 갱신이 도는 영업 시간이다.
const now = new Date("2026-10-14T12:01:35.000Z");

function render(lastUpdatedAt: string, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(
    renderInShell(
      <RoomStatusRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <RoomStatusRefreshController />
        <RoomStatusStaleNotice />
      </RoomStatusRefresh>,
      locale
    )
  );
}

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("객실 상태 갱신 표시", () => {
  beforeEach(() => mock.timers.enable({ apis: ["Date"], now }));
  afterEach(() => mock.timers.reset());

  it("shows the last update as small meta next to the refresh button while updates keep coming", () => {
    const html = render("2026-10-14T12:01:00.000Z");

    assert.match(html, /aria-label="실시간 갱신 상태"/);
    assert.match(html, /<span class="text-xs font-semibold text-faint">마지막 갱신: 19:01:00<\/span>/);
    assert.match(html, /<button[^>]*>새로고침<\/button>/);
    assert.doesNotMatch(html, /role="status"/);
  });

  it("turns the toolbar status into a warning and puts a stale notice on the screen after 90 seconds without an update", () => {
    const html = render("2026-10-14T11:59:00.000Z");

    // 도구줄: 글자 + 기호 + 색(design.md 2.4).
    assert.match(html, /bg-warning-soft text-warning[^>]*><span aria-hidden="true">▲[^<]*<\/span>갱신 지연: 18:59:00/);
    // 본문: ScreenState의 갱신 지연(design.md 6.13).
    const notice = html.match(/<section[^>]*role="status"[^>]*>[\s\S]*<\/section>/)?.[0] ?? "";
    assert.match(notice, /border-warning/);
    assert.equal(
      text(notice),
      "갱신 지연 18:59:00 이후로 객실 상태를 새로 받지 못했습니다 화면의 상태가 지금과 다를 수 있습니다. 위의 새로고침을 누르고, 계속되면 연결을 확인하세요."
    );
  });

  it("speaks Vietnamese", () => {
    const html = render("2026-10-14T11:59:00.000Z", "vi");

    assert.match(text(html), /Cập nhật trễ: 18:59:00/);
    assert.match(text(html), /Chưa nhận được trạng thái phòng mới kể từ 18:59:00/);
  });
});
