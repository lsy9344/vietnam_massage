import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AvailabilityRow, filterByAttendance, sortAvailabilityRows, TherapistAvailabilityView } from "@/app/(erp)/calls/therapist-availability-view";
import type { TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

const timeSlots = [{ value: "15:00", label: "15:00" }, { value: "16:00", label: "16:00" }];

function row(overrides: Partial<TherapistAvailabilityRowDto> = {}): TherapistAvailabilityRowDto {
  return {
    therapistId: "therapist-1",
    therapistName: "마사지사1",
    attendance: "before_check_in",
    shiftCheck: false,
    available: true,
    unavailableReason: null,
    inServiceDisplayEnd: null,
    freeFrom: null,
    nextReservationTime: "16:00",
    freeMinutes: 60,
    priorServiceEndCheck: false,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done: 0, reserved: 0 },
    courses: [
      { courseId: "course-a", courseCode: "A", courseName: "A 누루60", durationMinutes: 60, verdict: "possible", requiresSecondTherapist: false },
      { courseId: "course-b", courseCode: "B", courseName: "B 90", durationMinutes: 90, verdict: "time_short", requiresSecondTherapist: false }
    ],
    ...overrides
  };
}

function renderView(overrides: Partial<Parameters<typeof TherapistAvailabilityView>[0]> = {}) {
  return renderToStaticMarkup(
    <TherapistAvailabilityView
      failed={false}
      locale="ko"
      onChoose={() => undefined}
      onTimeChange={() => undefined}
      onToggle={() => undefined}
      open={false}
      pending={false}
      rows={[]}
      time="15:00"
      timeSlots={timeSlots}
      {...overrides}
    />
  );
}

function renderRow(overrides: Partial<Parameters<typeof AvailabilityRow>[0]> & { row: TherapistAvailabilityRowDto }) {
  return renderToStaticMarkup(
    <ul>
      <AvailabilityRow expansion={null} locale="ko" onChoose={() => undefined} onExpansionChange={() => undefined} time="15:00" {...overrides} />
    </ul>
  );
}

describe("availability row order", () => {
  it("puts available therapists first, then those who free up soonest, then the checked out, keeping the service order inside each group", () => {
    const rows = [
      row({ therapistId: "out-available", attendance: "checked_out", available: true }),
      row({ therapistId: "busy-late", attendance: "checked_in", available: false, freeFrom: "16:30" }),
      row({ therapistId: "free-1", attendance: "checked_in", available: true }),
      row({ therapistId: "busy-no-free", attendance: "checked_in", available: false, freeFrom: null }),
      row({ therapistId: "busy-soon", attendance: "checked_in", available: false, freeFrom: "15:20" }),
      row({ therapistId: "out-busy", attendance: "checked_out", available: false, freeFrom: "15:10" }),
      row({ therapistId: "free-2", attendance: "before_check_in", available: true })
    ];
    assert.deepEqual(
      sortAvailabilityRows(rows, "15:00").map((entry) => entry.therapistId),
      ["free-1", "free-2", "busy-soon", "busy-late", "busy-no-free", "out-available", "out-busy"]
    );
  });

  it("orders free-up times after midnight behind the evening ones of the same business day", () => {
    const rows = [
      row({ therapistId: "after-midnight", available: false, freeFrom: "00:30" }),
      row({ therapistId: "before-midnight", available: false, freeFrom: "23:40" })
    ];
    assert.deepEqual(
      sortAvailabilityRows(rows, "23:00").map((entry) => entry.therapistId),
      ["before-midnight", "after-midnight"]
    );
  });
});

describe("therapist availability panel", () => {
  it("stays collapsed to the title and the time control", () => {
    const html = renderView();
    assert.match(html, /가능 코스/);
    assert.match(html, /id="therapist-availability-time"/);
    assert.match(html, /펼치기/);
    assert.doesNotMatch(html, /<table/);
    assert.doesNotMatch(html, /60분 가능/);
    assert.match(html, /<select[^>]*class="[^"]*h-11[^"]*border-border-strong/);
    assert.match(html, /<button[^>]*class="[^"]*h-11[^"]*rounded-full[^"]*"[^>]*id="therapist-availability-expand"/);
  });

  // 매니저 한 명이 한 줄이다(스펙 D1–D4): 이름 · 상태 · 코스 칩 · 경고 아이콘. 근무표·출근 칸은 없다.
  it("draws one line per therapist: name, status, course chips, with no schedule or attendance columns", () => {
    const html = renderView({
      open: true,
      rows: [
        row(),
        row({
          therapistId: "therapist-2",
          therapistName: "마사지사2",
          attendance: "checked_in",
          available: false,
          unavailableReason: "booked",
          freeFrom: "15:30",
          nextReservationTime: null,
          freeMinutes: null
        })
      ]
    });
    const lines = html.split("<li").slice(1);
    assert.equal(lines.length, 2);
    assert.match(lines[0], /data-availability-row="therapist-1"[\s\S]*>마사지사1<[\s\S]*가능[\s\S]*다음 16:00 · 60분/);
    assert.match(lines[1], /data-availability-row="therapist-2"[\s\S]*>마사지사2<[\s\S]*불가 · 15:30부터/);
    assert.doesNotMatch(lines[1], /다음 /);
    assert.doesNotMatch(html, /<dl|<table|overflow-x-auto|근무표|이 시각|출근 전|>출근</);

    // 칩 문구는 코스 코드와 기준정보의 시간이다. 화면 낭독기는 판정까지 함께 읽는다.
    assert.match(html, /<button[^>]*aria-label="A 60분 가능"[^>]*data-course-id="course-a"[^>]*data-start-time="15:00"[^>]*data-therapist-id="therapist-1"[^>]*>[\s\S]*?A 60분<\/span><\/button>/);
    assert.match(html, /<button[^>]*aria-expanded="false"[^>]*aria-label="B 90분 · 시간 부족"[^>]*>[\s\S]*?B 90분<\/span><\/button>/);
    // 가능 칩과 불가 칩은 색만이 아니라 기호와 테두리 모양으로도 다르다: 불가 칩만 ○ 기호와 점선 테두리다.
    assert.match(html, /aria-label="A 60분 가능"[^>]*><span class="text-sm font-semibold">A 60분<\/span><\/button>/);
    assert.match(html, /aria-label="B 90분 · 시간 부족"[^>]*>[^<]*<span aria-hidden="true"[^>]*>○︎<\/span>/);
    assert.match(html, /<button[^>]*border-dashed[^>]*aria-label="B 90분 · 시간 부족"|<button[^>]*aria-label="B 90분 · 시간 부족"[^>]*border-dashed/);

    const timeAt = html.indexOf('id="therapist-availability-time"');
    const expandAt = html.indexOf('id="therapist-availability-expand"');
    const courseAt = html.indexOf('aria-label="A 60분 가능"');
    assert.ok(timeAt >= 0 && timeAt < expandAt && expandAt < courseAt);

    const vietnamese = renderView({
      locale: "vi",
      open: true,
      rows: [row(), row({ therapistId: "t-2", available: false, unavailableReason: "booked", freeFrom: "15:30", nextReservationTime: null, freeMinutes: null })]
    });
    assert.match(vietnamese, /Gói có thể/);
    assert.match(vietnamese, /Có thể/);
    assert.match(vietnamese, /Tiếp 16:00 · 60 phút/);
    assert.match(vietnamese, /Không thể · từ 15:30/);
    assert.match(vietnamese, /aria-label="A 60 phút, có thể"[^>]*>[\s\S]*?A 60 phút<\/span><\/button>/);
    assert.match(vietnamese, /aria-label="B 90 phút · không đủ thời gian"/);
  });

  // 다음 예약이 없으면 다음 예약 글자 없이 영업 끝까지의 여유 분만 붙인다. 여유 분도 모르면 "가능"만 보인다.
  it("shows the free minutes without a next booking, and only the status when neither is known", () => {
    const untilClose = renderView({ open: true, rows: [row({ nextReservationTime: null, freeMinutes: 180 })] });
    assert.match(untilClose, /가능<\/span><span>180분<\/span>/);
    assert.doesNotMatch(untilClose, /다음|없음/);
    const bare = renderView({ open: true, rows: [row({ nextReservationTime: null, freeMinutes: null })] });
    assert.match(bare, /가능<\/span><\/span>/);
    assert.doesNotMatch(bare, /다음|없음|<span>\d+분<\/span>/);
  });

  it("puts a faint checked-out tag next to the name only for a checked-out therapist", () => {
    const html = renderView({
      open: true,
      rows: [
        row({ therapistId: "t-before", therapistName: "전", attendance: "before_check_in" }),
        row({ therapistId: "t-in", therapistName: "중", attendance: "checked_in" }),
        row({ therapistId: "t-out", therapistName: "후", attendance: "checked_out" })
      ]
    });
    const lineOf = (therapistId: string) => html.split("<li").find((part) => part.includes(`data-availability-row="${therapistId}"`)) ?? "";
    assert.match(lineOf("t-out"), />후<\/span><span class="[^"]*text-muted[^"]*">퇴근<\/span>/);
    assert.doesNotMatch(lineOf("t-in"), /퇴근/);
    assert.doesNotMatch(lineOf("t-before"), /퇴근|출근/);
    // 퇴근해도 코스 칩은 그대로다.
    assert.match(lineOf("t-out"), /aria-label="A 60분 가능"/);
    assert.match(renderView({ locale: "vi", open: true, rows: [row({ attendance: "checked_out" })] }), />Đã về<\/span>/);
  });

  it("puts the day's done +booked count next to the name, marking only a checked-in Therapist with none", () => {
    const html = renderView({
      open: true,
      rows: [
        row({ therapistId: "t-busy", therapistName: "린", attendance: "checked_in", callCounts: { done: 3, reserved: 2 } }),
        row({ therapistId: "t-idle", therapistName: "마이", attendance: "checked_in" }),
        row({ therapistId: "t-before", therapistName: "전", attendance: "before_check_in" })
      ]
    });
    const lineOf = (therapistId: string) => html.split("<li").find((part) => part.includes(`data-availability-row="${therapistId}"`)) ?? "";
    // 이름 줄 안에 붙여 카드 높이를 그대로 둔다.
    assert.match(lineOf("t-busy"), />린<\/span><span [^>]*data-therapist-call-count=""[^>]*>[\s\S]*?>3<\/span>[\s\S]*?>\+2<\/span><span class="sr-only">한 것 3, 예약 2<\/span>/);
    assert.match(lineOf("t-idle"), /bg-warning-soft[^"]*" data-idle=""/);
    assert.match(lineOf("t-idle"), /한 것 0, 예약 0, 콜 없음/);
    // 출근 전이면 0이어도 강조하지 않는다.
    assert.doesNotMatch(lineOf("t-before") + lineOf("t-busy"), /data-idle/);
  });

  it("sorts the lines: available first, then the soonest free, then checked out", () => {
    const html = renderView({
      open: true,
      rows: [
        row({ therapistId: "t-out", attendance: "checked_out" }),
        row({ therapistId: "t-busy", attendance: "checked_in", available: false, freeFrom: "15:30" }),
        row({ therapistId: "t-free", attendance: "checked_in" })
      ]
    });
    const order = [...html.matchAll(/data-availability-row="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(order, ["t-free", "t-busy", "t-out"]);
  });

  // 경고는 줄 끝 아이콘 하나이고, 누르면 문구가 펼쳐진다(D4). 닫힌 동안에도 문구는 숨긴 채 있어 칩이 설명으로 가리킨다.
  it("folds the shift and earlier-service warnings into one icon at the end of the line", () => {
    const html = renderView({ open: true, rows: [row({ shiftCheck: true, priorServiceEndCheck: true })] });
    const toggle = html.match(/<button[^>]*aria-controls="([^"]+)"[^>]*aria-expanded="false"[^>]*aria-label="경고 2건 보기"[^>]*>/);
    assert.ok(toggle, html);
    const regionId = toggle[1];
    assert.match(html, new RegExp(`<div[^>]*hidden=""[^>]*id="${regionId}"[^>]*>[\\s\\S]*근무 확인 필요[\\s\\S]*시간표상 가능 · 앞 시술 종료 확인 필요`));
    assert.match(html, new RegExp(`<button[^>]*aria-describedby="${regionId}"[^>]*aria-label="A 60분 가능"`));
    // 아이콘은 색만이 아니라 기호로도 경고다.
    assert.match(html, /aria-label="경고 2건 보기"[^>]*>[\s\S]*?▲︎/);

    const inService = renderView({
      open: true,
      rows: [row({ available: false, unavailableReason: "in_service_past_display_end", inServiceDisplayEnd: "15:00", freeFrom: "15:20", priorServiceEndCheck: true, courses: [row().courses[1]] })]
    });
    assert.match(inService, /불가 · 15:20부터/);
    assert.match(inService, /aria-label="경고 1건 보기"/);
    assert.match(inService, /시술 중 · 15:00 종료 확인/);
    // 가능 코스가 없으면 앞 시술 종료 확인은 붙이지 않는다.
    assert.doesNotMatch(inService, /앞 시술 종료 확인 필요/);

    const plain = renderView({ open: true, rows: [row()] });
    assert.doesNotMatch(plain, /경고 \d+건 보기|aria-describedby/);

    const vietnamese = renderView({ locale: "vi", open: true, rows: [row({ shiftCheck: true })] });
    assert.match(vietnamese, /aria-label="Xem 1 cảnh báo"/);
    assert.match(vietnamese, /Cần xác nhận ca làm/);
  });

  it("opens the warning words under the line when the icon is expanded", () => {
    const html = renderRow({ row: row({ shiftCheck: true }), expansion: { kind: "warnings" } });
    assert.match(html, /aria-expanded="true"[^>]*aria-label="경고 1건 보기"/);
    assert.doesNotMatch(html, /hidden=""/);
    assert.match(html, /근무 확인 필요/);
  });

  // 불가 칩도 누를 수 있다. 누르면 그 줄 아래에 이유와 "경고 확인 후 배정"이 열린다(D3, 티켓 21 경로 유지).
  it("opens the reason and the override button under the line for a chosen impossible chip", () => {
    const courses: TherapistAvailabilityRowDto["courses"] = [
      row().courses[0],
      { courseId: "course-c", courseCode: "C", courseName: "C 120", durationMinutes: 120, verdict: "rate_missing", requiresSecondTherapist: false }
    ];
    const closed = renderRow({ row: row({ courses }), onOverride: () => undefined });
    assert.doesNotMatch(closed, /경고 확인 후 배정|이 코스 불가<\/p>/);

    const withOverride = renderRow({ row: row({ courses }), expansion: { kind: "course", courseId: "course-c" }, onOverride: () => undefined });
    assert.match(withOverride, /<button[^>]*aria-expanded="true"[^>]*aria-label="C 120분 · 이 코스 불가"/);
    assert.match(withOverride, /<p[^>]*>C 120분 · 이 코스 불가<\/p>/);
    assert.match(withOverride, /<button[^>]*data-override-course-id="course-c"[^>]*data-therapist-id="therapist-1"[^>]*>경고 확인 후 배정<\/button>/);
    assert.match(withOverride, /border-warning text-warning/);

    // onOverride가 없으면 이유만 보인다.
    const withoutOverride = renderRow({ row: row({ courses }), expansion: { kind: "course", courseId: "course-c" } });
    assert.match(withoutOverride, /C 120분 · 이 코스 불가/);
    assert.doesNotMatch(withoutOverride, /경고 확인 후 배정/);

    const vietnamese = renderRow({ locale: "vi", row: row({ courses }), expansion: { kind: "course", courseId: "course-c" } });
    assert.match(vietnamese, /<p[^>]*>C 120 phút · không làm được gói này<\/p>/);
  });

  it("draws each course verdict from the service without recomputing it", () => {
    const flipped = renderView({
      open: true,
      rows: [row({ courses: [{ courseId: "course-c", courseCode: "C", courseName: "C 120", durationMinutes: 120, verdict: "possible", requiresSecondTherapist: false }] })]
    });
    assert.match(flipped, /<button[^>]*aria-label="C 120분 가능"[^>]*data-course-id="course-c"/);
    // 칩 문구는 코스 이름이 아니라 코드와 시간이다.
    assert.doesNotMatch(flipped, /C 120</);
  });

  it("says there is nobody to show and what to look at next", () => {
    const html = renderView({ open: true, rows: [] });
    assert.match(html, /이 시각에 볼 Therapist가 없습니다\./);
    assert.match(html, /직원 마스터에서 활성 Therapist를 확인해 보세요\./);
    assert.doesNotMatch(html, /<table/);

    const vietnamese = renderView({ locale: "vi", open: true, rows: [] });
    assert.match(vietnamese, /Không có Therapist để xem ở giờ này\./);
    assert.match(vietnamese, /Hãy kiểm tra Therapist đang hoạt động trong danh mục nhân viên\./);
  });

  it("keeps only therapists whose check-in is entered, checked out included, and says so when nobody has checked in", () => {
    const rows = [
      row({ therapistId: "t-before", therapistName: "전", attendance: "before_check_in" }),
      row({ therapistId: "t-in", therapistName: "중", attendance: "checked_in" }),
      row({ therapistId: "t-out", therapistName: "후", attendance: "checked_out" })
    ];
    const attended = filterByAttendance(rows, false);
    assert.deepEqual(attended.rows.map((entry) => entry.therapistId), ["t-in", "t-out"]);
    assert.equal(attended.hiddenCount, 1);
    assert.equal(attended.nobodyAttended, false);

    const everyone = filterByAttendance(rows, true);
    assert.deepEqual(everyone.rows.map((entry) => entry.therapistId), ["t-before", "t-in", "t-out"]);
    assert.equal(everyone.hiddenCount, 1);

    // 아무도 출근이 입력되지 않았으면(내일 이후 날짜, 아직 출근 전) 걸러 낼 근거가 없어 전체를 보인다.
    const nobody = filterByAttendance([rows[0], row({ therapistId: "t-2", attendance: "before_check_in" })], false);
    assert.equal(nobody.rows.length, 2);
    assert.equal(nobody.hiddenCount, 0);
    assert.equal(nobody.nobodyAttended, true);
    assert.deepEqual(filterByAttendance([], false), { rows: [], hiddenCount: 0, nobodyAttended: false });
  });

  it("offers a checkbox for the hidden before-check-in therapists, and a note when nobody is entered", () => {
    const filtered = renderView({
      open: true,
      rows: [row({ therapistId: "t-in", therapistName: "중", attendance: "checked_in" })],
      attendanceFilter: { hiddenCount: 2, nobodyAttended: false, onShowAllChange: () => undefined, showAll: false }
    });
    assert.match(filtered, /<input[^>]*type="checkbox"/);
    assert.doesNotMatch(filtered, /<input[^>]*checked=""/);
    assert.match(filtered, /출근 전 Therapist 2명도 보기/);
    assert.doesNotMatch(filtered, /출근 시각이 입력된 Therapist가 없어/);

    const shown = renderView({
      open: true,
      rows: [row({ attendance: "checked_in" })],
      attendanceFilter: { hiddenCount: 2, nobodyAttended: false, onShowAllChange: () => undefined, showAll: true }
    });
    assert.match(shown, /<input[^>]*checked=""[^>]*type="checkbox"|<input[^>]*type="checkbox"[^>]*checked=""/);

    const nobody = renderView({
      open: true,
      rows: [row()],
      attendanceFilter: { hiddenCount: 0, nobodyAttended: true, onShowAllChange: () => undefined, showAll: false }
    });
    assert.match(nobody, /출근 시각이 입력된 Therapist가 없어 전체를 보여 줍니다\./);
    assert.doesNotMatch(nobody, /type="checkbox"/);

    // 필터를 주지 않으면(기존 호출) 아무것도 더 보이지 않는다.
    assert.doesNotMatch(renderView({ open: true, rows: [row()] }), /type="checkbox"|출근 시각이 입력된/);

    const vietnamese = renderView({
      locale: "vi",
      open: true,
      rows: [row({ attendance: "checked_in" })],
      attendanceFilter: { hiddenCount: 3, nobodyAttended: false, onShowAllChange: () => undefined, showAll: false }
    });
    assert.match(vietnamese, /Hiện cả 3 Therapist chưa đến/);
    const vietnameseNobody = renderView({
      locale: "vi",
      open: true,
      rows: [row()],
      attendanceFilter: { hiddenCount: 0, nobodyAttended: true, onShowAllChange: () => undefined, showAll: false }
    });
    assert.match(vietnameseNobody, /Chưa có Therapist nào được nhập giờ đến nên hiển thị tất cả\./);
  });
});
