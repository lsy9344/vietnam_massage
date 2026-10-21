import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DayOffRequestControls, TherapistAttendanceCalendar, TherapistAttendanceWeek } from "@/components/therapist/therapist-attendance-calendar";
import { statusGlyphChar } from "@/components/ui/status-indicator";
import { renderInShell } from "@/components/shell/test-harness";
import type { TherapistAttendanceCalendarDayDto, TherapistAttendanceDayRequestStatus } from "@/modules/therapists/therapist-attendance-calendar-service";

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

  it("makes each strip day a button that opens the same day detail as the cards, not a jump link", () => {
    const html = renderWeek(WEEK_DATES.map((date) => (date === "2042-05-06" ? day(date, { judgment: { lateMinutes: 5, isAbsent: false, isClockOutMissing: false, isUnscheduledAttendance: false } }) : day(date))));
    const strip = html.match(/<div[^>]*aria-label="요일별 근태"[^>]*>([\s\S]*?)<\/div><div[^>]*aria-label="기호 설명"/);
    assert.ok(strip, "strip");
    assert.doesNotMatch(strip[1], /<a /);
    const buttons = [...strip[1].matchAll(/<button[^>]*aria-label="([^"]*)"/g)].map((match) => match[1]);
    assert.equal(buttons.length, 7);
    // 월 달력 칸과 같은 이름(날짜 + 근태 상세 + 가장 급한 배지)
    assert.equal(buttons[1], "2042년 5월 6일 화요일 근태 상세 · 지각 5분");
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
    assert.ok(html.indexOf('aria-label="기호 설명"') > html.indexOf('aria-label="요일별 근태"'));
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

  // R18(스멜): 압축 칸의 배지 기호는 status-indicator.tsx의 공용 맵(statusGlyphChar)을 그대로 쓴다 —
  // 따로 적은 글자는 U+FE0E(이모지 방지)가 빠지기 쉽고, 공용 맵이 바뀌어도 같이 바뀌지 않는다.
  it("renders the day's primary badge glyph with the shared U+FE0E-suffixed status glyph", () => {
    const absentDay = day("2042-08-15");
    absentDay.judgment = { lateMinutes: null, isAbsent: true, isClockOutMissing: false, isUnscheduledAttendance: false };
    const html = renderToStaticMarkup(
      renderInShell(<TherapistAttendanceCalendar days={[absentDay]} locale="ko" monthKey="2042-08" todayServiceDate="2042-08-16" />, "ko")
    );
    assert.match(html, new RegExp(statusGlyphChar("danger")));
  });
});

function legendText(html: string, label = "기호 설명") {
  const match = html.match(new RegExp(`<div[^>]*aria-label="${label}"[^>]*>([\\s\\S]*?)</div>`));
  assert.ok(match, "legend");
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

// R1(D22): 근태 달력의 휴무 신청·취소 조작이 신청 종류를 보고 맞게 갈린다. 서비스 쪽 비대칭(R3)과
// 짝을 이루는 화면 쪽 확인이다 — 둘 다 없으면 정정 요청이 대기 중인 날에 "휴무 신청을 보냈습니다 /
// 신청 취소"가 잘못 뜨고, 취소를 누르면 날짜로 찾는 cancelTherapistDayOffRequestForDate가 그
// 정정 요청을 취소해 버린다.
function render(requestStatus: TherapistAttendanceDayRequestStatus, planStatus: TherapistAttendanceCalendarDayDto["planStatus"] = "근무 예정") {
  return renderToStaticMarkup(renderInShell(<DayOffRequestControls day={day("2042-08-15", { requestStatus, planStatus })} />, "ko"));
}

describe("DayOffRequestControls", () => {
  it("shows the cancel notice for a pending day-off request", () => {
    const html = render({ kind: "day_off", status: "pending", rejectionReason: null });
    assert.match(html, /휴무를 신청했습니다/);
    assert.match(html, /신청 취소/);
  });

  it("shows the cancel notice for a pending 소중한날 휴가 request too (day-off family)", () => {
    const html = render({ kind: "special_day_off", status: "pending", rejectionReason: null });
    assert.match(html, /휴무를 신청했습니다/);
  });

  it("shows neither the cancel notice nor the request button for a pending correction request (R1)", () => {
    const html = render({ kind: "correction", status: "pending", rejectionReason: null });
    assert.doesNotMatch(html, /휴무를 신청했습니다/);
    assert.doesNotMatch(html, /신청 취소/);
    assert.doesNotMatch(html, /휴무 신청/);
  });

  it("shows the request button when there is no pending request", () => {
    const html = render(null);
    assert.match(html, /휴무 신청/);
  });

  it("shows the request button again once an earlier request was resolved (rejected)", () => {
    const html = render({ kind: "day_off", status: "rejected", rejectionReason: "콜 많음" });
    assert.match(html, /휴무 신청/);
    assert.doesNotMatch(html, /신청 취소/);
  });

  it("shows nothing once the day is already day off", () => {
    const html = render({ kind: "day_off", status: "approved", rejectionReason: null }, "휴무");
    assert.equal(html, "");
  });
});
