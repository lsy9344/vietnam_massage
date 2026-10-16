import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { filterByAttendance, TherapistAvailabilityView } from "@/app/(erp)/calls/therapist-availability-view";
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

  it("shows the service words, wraps course buttons, and puts the time, expand, and possible course before the ledger", () => {
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
          freeMinutes: null,
          courses: [
            { courseId: "course-a", courseCode: "A", courseName: "A 누루60", durationMinutes: 60, verdict: "time_short", requiresSecondTherapist: false },
            { courseId: "course-b", courseCode: "B", courseName: "B 90", durationMinutes: 90, verdict: "time_short", requiresSecondTherapist: false }
          ]
        })
      ]
    });

    assert.match(html, /근무표/);
    assert.match(html, /출근/);
    assert.match(html, /이 시각/);
    assert.match(html, /다음 예약/);
    assert.match(html, /마사지사1/);
    assert.match(html, /출근 전/);
    assert.match(html, />가능</);
    assert.match(html, /16:00 · 60분/);
    assert.match(html, /마사지사2/);
    assert.match(html, /불가 · 15:30부터/);
    assert.match(html, /<button[^>]*type="button"[^>]*>A 60분 가능<\/button>/);
    assert.match(html, /data-course-id="course-a"/);
    assert.match(html, /data-therapist-id="therapist-1"/);
    assert.match(html, /data-start-time="15:00"/);
    assert.match(html, /<span[^>]*>B 90분 · 시간 부족<\/span>/);
    assert.doesNotMatch(html, /<button[^>]*>B 90분 · 시간 부족<\/button>/);
    assert.match(html, /flex flex-wrap/);
    assert.match(html, /<button[^>]*class="[^"]*rounded-full[^"]*transition-colors[^"]*"[^>]*>A 60분 가능<\/button>/);

    const timeAt = html.indexOf('id="therapist-availability-time"');
    const expandAt = html.indexOf('id="therapist-availability-expand"');
    const courseAt = html.indexOf("A 60분 가능");
    assert.ok(timeAt >= 0 && timeAt < expandAt && expandAt < courseAt);

    const vietnamese = renderView({
      locale: "vi",
      open: true,
      rows: [row({ available: false, unavailableReason: "booked", freeFrom: "15:30", nextReservationTime: null, freeMinutes: null, courses: [] })]
    });
    assert.match(vietnamese, /Gói có thể/);
    assert.match(vietnamese, /Không thể · từ 15:30/);
    assert.match(vietnamese, /Chưa đến/);
  });

  it("says the therapist is still in service, when to check, and when they free up, without recomputing the hold", () => {
    const html = renderView({
      open: true,
      time: "15:00",
      rows: [
        row({
          available: false,
          unavailableReason: "in_service_past_display_end",
          inServiceDisplayEnd: "15:00",
          freeFrom: "15:20",
          nextReservationTime: null,
          freeMinutes: null,
          priorServiceEndCheck: true,
          courses: [{ courseId: "course-a", courseCode: "A", courseName: "A 누루60", durationMinutes: 60, verdict: "time_short", requiresSecondTherapist: false }]
        })
      ]
    });
    assert.match(html, /불가 · 15:20부터/);
    assert.match(html, /시술 중 · 15:00 종료 확인/);
    assert.doesNotMatch(html, /앞 시술 종료 확인 필요/);

    const vietnamese = renderView({
      locale: "vi",
      open: true,
      rows: [row({ available: false, unavailableReason: "in_service_past_display_end", inServiceDisplayEnd: "15:00", freeFrom: "15:20", priorServiceEndCheck: true, courses: [] })]
    });
    assert.match(vietnamese, /Không thể · từ 15:20/);
    assert.match(vietnamese, /Đang làm · kiểm tra kết thúc 15:00/);
  });

  it("marks a possible course as possible by the schedule only when an earlier service still needs its end checked", () => {
    const html = renderView({ open: true, time: "15:30", rows: [row({ priorServiceEndCheck: true })] });
    assert.match(html, /시간표상 가능 · 앞 시술 종료 확인 필요/);
    const noteId = html.match(/id="([^"]+)"(?:(?!id=")[\s\S])*?시간표상 가능 · 앞 시술 종료 확인 필요/)?.[1];
    assert.ok(noteId);
    assert.match(html, new RegExp(`<button[^>]*aria-describedby="${noteId}"[^>]*>A 60분 가능</button>`));
    assert.doesNotMatch(html, /시술 중 ·/);

    const plain = renderView({ open: true, time: "15:30", rows: [row()] });
    assert.doesNotMatch(plain, /앞 시술 종료 확인 필요/);

    const vietnamese = renderView({ locale: "vi", open: true, rows: [row({ priorServiceEndCheck: true })] });
    assert.match(vietnamese, /Có thể theo lịch · cần xác nhận ca trước đã xong/);
  });

  it("tells before check-in, checked in, and checked out apart and asks to check the shift without turning a course off", () => {
    const html = renderView({
      open: true,
      rows: [
        row({ therapistId: "t-before", therapistName: "전", attendance: "before_check_in", shiftCheck: true }),
        row({ therapistId: "t-in", therapistName: "중", attendance: "checked_in" }),
        row({ therapistId: "t-out", therapistName: "후", attendance: "checked_out", shiftCheck: true })
      ]
    });
    const rowOf = (therapistId: string) => html.split("<li").find((part) => part.includes(`data-therapist-id="${therapistId}"`)) ?? "";
    assert.match(rowOf("t-before"), /출근 전[\s\S]*근무 확인 필요/);
    assert.match(rowOf("t-in"), /출근/);
    assert.doesNotMatch(rowOf("t-in"), /출근 전|퇴근|근무 확인 필요/);
    assert.match(rowOf("t-out"), /퇴근\(현재 퇴근\)[\s\S]*근무 확인 필요/);
    for (const therapistId of ["t-before", "t-in", "t-out"]) {
      assert.match(html, new RegExp(`<button[^>]*data-therapist-id="${therapistId}"[^>]*>A 60분 가능</button>`));
    }

    const vietnamese = renderView({ locale: "vi", open: true, rows: [row({ attendance: "checked_out", shiftCheck: true })] });
    assert.match(vietnamese, /Đã về \(hiện đã về\)/);
    assert.match(vietnamese, /Cần xác nhận ca làm/);
  });

  // 근무표(27)의 근무 예정은 출근(attendance)과 다른 칸에 보이고, 특정 시각까지 근무한다는 보장이 아니라는
  // 안내가 함께 있다(스토리 12–13, 60, 104, V07, 티켓 29). 휴무라도 코스 버튼은 그대로다.
  it("shows the planned schedule in its own column, separate from attendance, with a note that it is not a guarantee", () => {
    const html = renderView({
      open: true,
      rows: [
        row({ therapistId: "t-planned", therapistName: "예정", attendance: "checked_in", plannedWorkingDayStatus: "근무 예정" }),
        row({ therapistId: "t-off", therapistName: "휴무자", attendance: "before_check_in", plannedWorkingDayStatus: "휴무" }),
        row({ therapistId: "t-unset", therapistName: "미입력자", attendance: "before_check_in", plannedWorkingDayStatus: "미입력" })
      ]
    });
    const rowOf = (therapistId: string) => html.split("<li").find((part) => part.includes(`data-therapist-id="${therapistId}"`)) ?? "";
    assert.match(html, /근무표/);
    assert.match(rowOf("t-planned"), /근무 예정[\s\S]*출근/);
    assert.match(rowOf("t-off"), /휴무[\s\S]*출근 전/);
    assert.match(rowOf("t-unset"), /미입력[\s\S]*출근 전/);
    // 휴무라도 가능 코스 버튼은 그대로 보인다(저장을 막지 않는다).
    assert.match(rowOf("t-off"), /<button[^>]*>A 60분 가능<\/button>/);
    assert.match(html, /근무표의 근무 예정은 그 시각까지 근무한다는 보장이 아닙니다\./);

    const vietnamese = renderView({ locale: "vi", open: true, rows: [row({ plannedWorkingDayStatus: "휴무" })] });
    assert.match(vietnamese, /Lịch làm việc/);
    assert.match(vietnamese, /Nghỉ/);
    assert.match(vietnamese, /Dự kiến làm việc trong lịch không đảm bảo có mặt đến giờ đó\./);
  });

  it("draws each course verdict from the service: possible as a button, short time, and no rate without a free time", () => {
    const courses: TherapistAvailabilityRowDto["courses"] = [
      { courseId: "course-a", courseCode: "A", courseName: "A 누루60", durationMinutes: 60, verdict: "possible", requiresSecondTherapist: false },
      { courseId: "course-b", courseCode: "B", courseName: "B 90", durationMinutes: 90, verdict: "time_short", requiresSecondTherapist: false },
      { courseId: "course-c", courseCode: "C", courseName: "C 120", durationMinutes: 120, verdict: "rate_missing", requiresSecondTherapist: false }
    ];
    const html = renderView({ open: true, rows: [row({ courses })] });
    assert.match(html, /<button[^>]*>A 60분 가능<\/button>/);
    assert.match(html, /<span[^>]*>B 90분 · 시간 부족<\/span>/);
    assert.match(html, /<span[^>]*>C 120분 · 이 코스 불가<\/span>/);
    assert.doesNotMatch(html, /<button[^>]*data-course-id="course-c"/);
    assert.doesNotMatch(html, /C 120분[^<]*\d{2}:\d{2}/);

    // 판정만 바뀌면 같은 코스도 다르게 그린다. 화면은 수당을 다시 보지 않는다.
    const flipped = renderView({
      open: true,
      rows: [row({ courses: [{ courseId: "course-c", courseCode: "C", courseName: "C 120", durationMinutes: 120, verdict: "possible", requiresSecondTherapist: false }] })]
    });
    assert.match(flipped, /<button[^>]*data-course-id="course-c"[^>]*>C 120분 가능<\/button>/);

    const vietnamese = renderView({ locale: "vi", open: true, rows: [row({ courses })] });
    assert.match(vietnamese, /A 60 phút, có thể/);
    assert.match(vietnamese, /B 90 phút · không đủ thời gian/);
    assert.match(vietnamese, /<span[^>]*>C 120 phút · không làm được gói này<\/span>/);
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

  // 좁은 서랍(30rem)에서도 가로로 밀지 않도록 Therapist마다 한 장씩 쌓는다. 표나 가로 스크롤 상자가 없다.
  it("stacks each therapist as one card with the course buttons on their own line, with no table or sideways scroll", () => {
    const html = renderView({ open: true, rows: [row({ therapistId: "t-1", therapistName: "첫째" }), row({ therapistId: "t-2", therapistName: "둘째" })] });
    assert.doesNotMatch(html, /<table|<tr|overflow-x-auto|min-w-\[/);
    const cards = html.split("<li").slice(1);
    assert.equal(cards.length, 2);
    for (const card of cards) {
      // 이름, 칸 이름·값 쌍(<dl>), 코스 버튼 순서다.
      assert.ok(card.indexOf("<dl") > 0 && card.indexOf("<dl") < card.indexOf("</dl>") && card.indexOf("</dl>") < card.indexOf("A 60분 가능"));
    }
    assert.match(cards[0], /data-availability-row="t-1"[\s\S]*첫째[\s\S]*<dt[^>]*>근무표<\/dt>[\s\S]*<dt[^>]*>출근<\/dt>[\s\S]*<dt[^>]*>이 시각<\/dt>[\s\S]*<dt[^>]*>다음 예약<\/dt>/);
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

  // 가능 코스에서 고르면 원장 새 행이 아니라 빠른 예약 패널의 Therapist·코스를 채운다(티켓 20).
  // 그 연결은 quick-booking-panel.test.tsx가 확인하고, 콜 원장 위에 항상 펼쳐 두던 이 패널의 자리는
  // 없어졌으므로(명세 F08) 여기서는 TherapistAvailabilityView 자체의 렌더만 다룬다.

  // 시간 부족·수당 없음 코스의 "경고 확인 후 배정" 경로(스펙 F01, 티켓 21).
  it("offers an override button for an impossible course only when onOverride is given, distinct from the possible button", () => {
    const courses: TherapistAvailabilityRowDto["courses"] = [
      { courseId: "course-a", courseCode: "A", courseName: "A 누루60", durationMinutes: 60, verdict: "possible", requiresSecondTherapist: false },
      { courseId: "course-b", courseCode: "B", courseName: "B 90", durationMinutes: 90, verdict: "time_short", requiresSecondTherapist: false },
      { courseId: "course-c", courseCode: "C", courseName: "C 120", durationMinutes: 120, verdict: "rate_missing", requiresSecondTherapist: true }
    ];

    // onOverride가 없으면(기존 호출) 흐린 글자만 그대로 보이고 버튼이 없다.
    const withoutOverride = renderView({ open: true, rows: [row({ courses })] });
    assert.doesNotMatch(withoutOverride, /경고 확인 후 배정/);
    assert.match(withoutOverride, /<span[^>]*>B 90분 · 시간 부족<\/span>/);

    // onOverride가 있으면 "가능"과는 다른 문구·모양의 버튼이 불가 코스마다 보인다.
    const withOverride = renderView({ open: true, onOverride: () => undefined, rows: [row({ courses })] });
    assert.match(withOverride, /<button[^>]*data-override-course-id="course-b"[^>]*>B 90분 · 시간 부족 · 경고 확인 후 배정<\/button>/);
    assert.match(withOverride, /<button[^>]*data-override-course-id="course-c"[^>]*>C 120분 · 이 코스 불가 · 경고 확인 후 배정<\/button>/);
    assert.match(withOverride, /border-warning text-warning/);
    // 가능 코스는 그대로 "가능" 버튼이다. 경고 확인 버튼과 섞이지 않는다.
    assert.match(withOverride, /<button[^>]*>A 60분 가능<\/button>/);
    assert.doesNotMatch(withOverride, /data-override-course-id="course-a"/);
  });
});
