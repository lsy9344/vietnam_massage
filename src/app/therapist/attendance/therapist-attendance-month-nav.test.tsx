import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistAttendanceMonthNav } from "@/app/therapist/attendance/therapist-attendance-month-nav";
import { renderInShell } from "@/components/shell/test-harness";

function thisMonthHref(now: Date) {
  const html = renderToStaticMarkup(renderInShell(<TherapistAttendanceMonthNav locale="ko" monthKey="2042-08" now={now} />, "ko"));
  const hrefMatch = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].find(([, , text]) => text === "이번 달");
  return hrefMatch?.[1];
}

// R11: "이번 달"은 영업일 기준(03:00 경계)이어야 한다. 00:00–02:59에는 달력날이 다음 달로
// 넘어가도 아직 전날 영업일이라 "이번 달"은 전달 그대로여야 한다.
describe("TherapistAttendanceMonthNav", () => {
  it("keeps 'this month' on the previous calendar month during 00:00-02:59 on the 1st (service day hasn't rolled over)", () => {
    // 2042-09-01T01:30+07:00: 달력날은 9월 1일이지만 영업일은 아직 8월 31일이다.
    const href = thisMonthHref(new Date("2042-09-01T01:30:00+07:00"));
    assert.equal(href, "/therapist/attendance?month=2042-08");
  });

  it("rolls over to the new calendar month once 03:00 passes", () => {
    const href = thisMonthHref(new Date("2042-09-01T03:00:00+07:00"));
    assert.equal(href, "/therapist/attendance?month=2042-09");
  });
});
