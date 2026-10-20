import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistAttendanceCalendar, TherapistAttendanceWeek } from "@/components/therapist/therapist-attendance-calendar";
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

  it("keeps every card to one line of status chips, folding extras into +N", () => {
    const html = renderWeek(
      WEEK_DATES.map((date) =>
        date === "2042-05-06"
          ? day(date, {
              checkInTime: "09:10",
              checkInMethod: "직접",
              judgment: { lateMinutes: 10, isAbsent: false, isClockOutMissing: true, isUnscheduledAttendance: false },
              requestStatus: { kind: "correction", status: "pending", rejectionReason: null }
            })
          : date === "2042-05-08"
            ? day(date, { judgment: { lateMinutes: 5, isAbsent: false, isClockOutMissing: true, isUnscheduledAttendance: false } })
            : day(date)
      )
    );
    // 셋(퇴근 미입력·지각·정정 대기)이면 가장 급한 하나 + "+2"
    const crowded = cardText(html.replace(/<span class="sr-only">[^<]*<\/span>/g, ""), "2042-05-06");
    assert.match(crowded, /퇴근 미입력/);
    assert.doesNotMatch(crowded, /지각 10분/);
    assert.match(crowded, /\+2/);
    // 접힌 칩은 화면 낭독기에는 그대로 읽힌다.
    assert.match(cardText(html, "2042-05-06"), /지각 10분, 정정 · 대기/);
    // 둘이면 그대로 둘
    const two = cardText(html, "2042-05-08");
    assert.match(two, /퇴근 미입력/);
    assert.match(two, /지각 5분/);
    assert.doesNotMatch(two, /\+\d/);
  });

  it("shows the planned start and clock times on every card, with a dash when there is no record", () => {
    const html = renderWeek(WEEK_DATES.map((date) => (date === "2042-05-09" ? day(date, { planStatus: "미입력", plannedStartTime: null }) : day(date))));
    assert.match(cardText(html, "2042-05-05"), /예정 09:00 출근 — 퇴근 —/);
    assert.match(cardText(html, "2042-05-09"), /미입력 출근 — 퇴근 —/);
  });

  it("explains what each symbol color means, next to the week strip", () => {
    const html = renderWeek(WEEK_DATES.map((date) => day(date)));
    const legend = legendText(html);
    assert.match(legend, /■︎ 결근 · 소중한날 휴가/);
    assert.match(legend, /▲︎ 지각 · 퇴근 미입력/);
    assert.match(legend, /◆︎ 예정 없는 출근/);
    assert.match(legend, /●︎ 만근 인정/);
    assert.match(legend, /오늘/);
    // 띠(기호가 있는 곳)와 카드 목록 사이에 둔다.
    assert.ok(html.indexOf('aria-label="기호 설명"') > html.indexOf('aria-label="요일로 이동"'));
    assert.ok(html.indexOf('aria-label="기호 설명"') < html.indexOf('id="attendance-day-'));
  });
});

describe("TherapistAttendanceCalendar (month)", () => {
  it("shows the same symbol legend under the month grid", () => {
    const html = renderToStaticMarkup(
      renderInShell(<TherapistAttendanceCalendar days={WEEK_DATES.map((date) => day(date))} locale="vi" monthKey="2042-05" todayServiceDate={TODAY} />, "vi")
    );
    const legend = legendText(html, "Chú thích ký hiệu");
    assert.match(legend, /■︎ Vắng · Nghỉ ngày đặc biệt/);
    assert.match(legend, /●︎ Đạt chuyên cần/);
    assert.ok(html.indexOf('aria-label="Chú thích ký hiệu"') > html.indexOf('role="grid"'));
  });
});

function legendText(html: string, label = "기호 설명") {
  const match = html.match(new RegExp(`<div[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</div>`));
  assert.ok(match, "legend");
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}
