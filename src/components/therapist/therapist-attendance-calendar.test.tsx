import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistAttendanceWeek } from "@/components/therapist/therapist-attendance-calendar";
import { renderInShell } from "@/components/shell/test-harness";
import type { TherapistAttendanceCalendarDayDto } from "@/modules/therapists/therapist-attendance-calendar-service";

const TODAY = "2042-05-07";

function day(date: string, overrides: Partial<TherapistAttendanceCalendarDayDto> = {}): TherapistAttendanceCalendarDayDto {
  return {
    date,
    planStatus: "근무 예정",
    plannedStartTime: "09:00",
    checkInTime: null,
    checkInMethod: null,
    checkOutTime: null,
    checkOutMethod: null,
    isFullAttendanceRecognized: false,
    isSpecialDayOff: false,
    judgment: { lateMinutes: null, isAbsent: false, isClockOutMissing: false, isUnscheduledAttendance: false },
    requestStatus: null,
    ...overrides
  };
}

const WEEK_DATES = ["2042-05-05", "2042-05-06", "2042-05-07", "2042-05-08", "2042-05-09", "2042-05-10", "2042-05-11"];

function renderWeek(days: TherapistAttendanceCalendarDayDto[]) {
  return renderToStaticMarkup(renderInShell(<TherapistAttendanceWeek days={days} locale="ko" todayServiceDate={TODAY} weekLabel="5월 5일~11일" />, "ko"));
}

// 날짜 카드 하나의 글자(태그를 뺀 것).
function cardText(html: string, date: string) {
  const match = html.match(new RegExp(`<li[^>]*id="attendance-day-${date}"[^>]*>([\\s\\S]*?)</li>`));
  assert.ok(match, `card for ${date}`);
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

describe("TherapistAttendanceWeek", () => {
  it("shows one card per day with schedule, clock times and judgment badges", () => {
    const html = renderWeek(
      WEEK_DATES.map((date) =>
        date === "2042-05-06"
          ? day(date, {
              checkInTime: "09:10",
              checkInMethod: "직접",
              judgment: { lateMinutes: 10, isAbsent: false, isClockOutMissing: true, isUnscheduledAttendance: false }
            })
          : day(date)
      )
    );

    assert.equal([...html.matchAll(/<li[^>]*id="attendance-day-/g)].length, 7);
    const text = cardText(html, "2042-05-06");
    assert.match(text, /근무 예정/);
    assert.match(text, /출근 09:10/);
    assert.match(text, /퇴근 —/);
    assert.match(text, /퇴근 미입력/);
    assert.match(text, /지각 10분/);
  });

  it("marks today as working while checked in without a checkout, and only today", () => {
    const html = renderWeek(
      WEEK_DATES.map((date) => (date === TODAY || date === "2042-05-06" ? day(date, { checkInTime: "09:00", checkInMethod: "직접" }) : day(date)))
    );
    assert.match(cardText(html, TODAY), /근무 중/);
    assert.doesNotMatch(cardText(html, "2042-05-06"), /근무 중/);
  });

  it("shows pending, approved and rejected requests on the card but leaves canceled and expired ones to the panel", () => {
    const html = renderWeek(
      WEEK_DATES.map((date, index) => {
        const statuses = ["pending", "approved", "rejected", "canceled", "expired"] as const;
        const status = statuses[index];
        return status ? day(date, { requestStatus: { kind: "day_off", status, rejectionReason: null } }) : day(date);
      })
    );
    assert.match(cardText(html, "2042-05-05"), /휴무 · 대기/);
    assert.match(cardText(html, "2042-05-06"), /휴무 · 승인/);
    assert.match(cardText(html, "2042-05-07"), /휴무 · 거절/);
    assert.doesNotMatch(cardText(html, "2042-05-08"), /휴무 ·/);
    assert.doesNotMatch(cardText(html, "2042-05-09"), /휴무 ·/);
  });
});
