import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CallLedgerWorkspace } from "@/app/(erp)/calls/call-ledger-workspace";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { TherapistAvailabilityView } from "@/app/(erp)/calls/therapist-availability-view";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, TherapistAvailabilityRowDto } from "@/modules/calls/service-call-service";

const timeSlots = [{ value: "15:00", label: "15:00" }, { value: "16:00", label: "16:00" }];

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots,
  courses: [
    { value: "course-a", label: "A 누루60" },
    { value: "course-b", label: "B 90" }
  ],
  statuses: [{ value: "RESERVED", label: "예약" }],
  discountTypes: [],
  paymentMethods: [],
  confirmationCodes: [],
  therapists: [{ value: "therapist-1", label: "마사지사1" }],
  bookingChannels: [],
  expenseHandlers: []
};

function row(overrides: Partial<TherapistAvailabilityRowDto> = {}): TherapistAvailabilityRowDto {
  return {
    therapistId: "therapist-1",
    therapistName: "마사지사1",
    attendance: "before_check_in",
    shiftCheck: false,
    available: true,
    freeFrom: null,
    nextReservationTime: "16:00",
    freeMinutes: 60,
    plannedWorkingDayStatus: "미입력",
    callCounts: { done: 0, finished: 0, reserved: 0 },
    plannedStartTime: null,
    current: { state: "available", expectedEnd: null, nextReservationTime: null, freeMinutes: null },
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

function hiddenValue(html: string, name: string) {
  const match = html.match(new RegExp(`name="${name}"[^>]*value="([^"]*)"`));
  return match?.[1] ?? null;
}

describe("therapist availability panel", () => {
  it("stays collapsed to the title and the time control", () => {
    const html = renderView();
    assert.match(html, /가능 코스/);
    assert.match(html, /id="therapist-availability-time"/);
    assert.match(html, /펼치기/);
    assert.doesNotMatch(html, /<table/);
    assert.doesNotMatch(html, /60분 가능/);
    assert.match(html, /min-h-11/);
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

    assert.match(html, /Therapist/);
    assert.match(html, /출근/);
    assert.match(html, /이 시각/);
    assert.match(html, /다음 예약/);
    assert.match(html, /가능한 코스/);
    assert.match(html, /마사지사1/);
    assert.match(html, /미입력/);
    assert.match(html, />가능</);
    assert.match(html, /16:00 · 60분/);
    assert.match(html, /마사지사2/);
    assert.match(html, /불가 · 15:30부터/);
    assert.match(html, /<button[^>]*type="button"[^>]*>A 60분 가능<\/button>/);
    assert.match(html, /data-course-id="course-a"/);
    assert.match(html, /data-therapist-id="therapist-1"/);
    assert.match(html, /data-start-time="15:00"/);
    assert.match(html, /<span[^>]*>B 90분 불가<\/span>/);
    assert.doesNotMatch(html, /<button[^>]*>B 90분 불가<\/button>/);
    assert.match(html, /flex flex-wrap/);
    assert.match(html, /motion-safe:duration-200/);
    assert.match(html, /motion-reduce:transition-none/);

    const timeAt = html.indexOf('id="therapist-availability-time"');
    const expandAt = html.indexOf('id="therapist-availability-expand"');
    const courseAt = html.indexOf("A 60분 가능");
    assert.ok(timeAt >= 0 && timeAt < expandAt && expandAt < courseAt);

    const vietnamese = renderView({
      locale: "vi",
      open: true,
      rows: [row({ available: false, freeFrom: "15:30", nextReservationTime: null, freeMinutes: null, courses: [] })]
    });
    assert.match(vietnamese, /Gói có thể/);
    assert.match(vietnamese, /Không thể · từ 15:30/);
    assert.match(vietnamese, /Chưa nhập/);
    assert.match(vietnamese, /Therapist/);
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

  it("fills the new row time, therapist, and course from a possible course and does not save", () => {
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: "ko",
        children: createElement(EditableCallGrid, {
          courseChoice: { id: 1, startTime: "15:00", therapistId: "therapist-1", courseId: "course-a" },
          isLocked: false,
          operatingMonthId: "month-1",
          options,
          rows: [],
          serviceDate: "2026-06-10",
          showSettlementColumns: false
        })
      })
    );

    assert.equal(hiddenValue(html, "startTime"), "15:00");
    assert.equal(hiddenValue(html, "therapist1Id"), "therapist-1");
    assert.equal(hiddenValue(html, "courseId"), "course-a");
    assert.equal(hiddenValue(html, "therapist2Id"), "");
    assert.match(html, /새 콜 행 추가/);
    assert.doesNotMatch(html, /저장됨/);
  });

  it("places the availability controls before the ledger", () => {
    const html = renderToStaticMarkup(
      createElement(LocaleProvider, {
        locale: "ko",
        children: createElement(CallLedgerWorkspace, {
          availabilityRows: [row()],
          availabilityTime: "15:00",
          isLocked: false,
          operatingMonthId: "month-1",
          options,
          rows: [],
          serviceDate: "2026-06-10",
          showSettlementColumns: false
        })
      })
    );

    const timeAt = html.indexOf('id="therapist-availability-time"');
    const expandAt = html.indexOf('id="therapist-availability-expand"');
    const ledgerAt = html.indexOf("콜 원장 그리드");
    assert.ok(timeAt >= 0 && timeAt < expandAt && expandAt < ledgerAt);
  });
});
