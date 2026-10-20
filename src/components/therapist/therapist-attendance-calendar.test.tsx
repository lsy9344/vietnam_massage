import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DayOffRequestControls, TherapistAttendanceCalendar } from "@/components/therapist/therapist-attendance-calendar";
import { statusGlyphChar } from "@/components/ui/status-indicator";
import { renderInShell } from "@/components/shell/test-harness";
import type { TherapistAttendanceCalendarDayDto, TherapistAttendanceDayRequestStatus } from "@/modules/therapists/therapist-attendance-calendar-service";

// R1(D22): 근태 달력의 휴무 신청·취소 조작이 신청 종류를 보고 맞게 갈린다. 서비스 쪽 비대칭(R3)과
// 짝을 이루는 화면 쪽 확인이다 — 둘 다 없으면 정정 요청이 대기 중인 날에 "휴무 신청을 보냈습니다 /
// 신청 취소"가 잘못 뜨고, 취소를 누르면 날짜로 찾는 cancelTherapistDayOffRequestForDate가 그
// 정정 요청을 취소해 버린다.
function day(requestStatus: TherapistAttendanceDayRequestStatus, planStatus: TherapistAttendanceCalendarDayDto["planStatus"] = "근무 예정"): TherapistAttendanceCalendarDayDto {
  return {
    date: "2042-08-15",
    planStatus,
    plannedStartTime: null,
    checkInTime: null,
    checkInMethod: null,
    checkOutTime: null,
    checkOutMethod: null,
    isFullAttendanceRecognized: false,
    isSpecialDayOff: false,
    judgment: { lateMinutes: null, isAbsent: false, isClockOutMissing: false, isUnscheduledAttendance: false },
    requestStatus
  };
}

function render(requestStatus: TherapistAttendanceDayRequestStatus, planStatus?: TherapistAttendanceCalendarDayDto["planStatus"]) {
  return renderToStaticMarkup(renderInShell(<DayOffRequestControls day={day(requestStatus, planStatus)} />, "ko"));
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

// R18(스멜): 압축 칸의 배지 기호는 status-indicator.tsx의 공용 맵(statusGlyphChar)을 그대로 쓴다 —
// 따로 적은 글자는 U+FE0E(이모지 방지)가 빠지기 쉽고, 공용 맵이 바뀌어도 같이 바뀌지 않는다.
describe("TherapistAttendanceCalendar compact cell badge", () => {
  it("renders the day's primary badge glyph with the shared U+FE0E-suffixed status glyph", () => {
    const absentDay = day(null);
    absentDay.judgment = { lateMinutes: null, isAbsent: true, isClockOutMissing: false, isUnscheduledAttendance: false };
    const html = renderToStaticMarkup(
      renderInShell(
        <TherapistAttendanceCalendar days={[absentDay]} locale="ko" monthKey="2042-08" todayServiceDate="2042-08-16" />,
        "ko"
      )
    );
    assert.match(html, new RegExp(statusGlyphChar("danger")));
  });
});
