import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TherapistStatusOverview } from "@/app/(erp)/calls/therapist-status-overview";
import { LocaleProvider } from "@/lib/i18n/client";
import type { TherapistStatusOverviewDto } from "@/modules/calls/service-call-service";

const sampleTherapists: TherapistStatusOverviewDto[] = [
  {
    therapistId: "thr-1",
    displayName: "01번 민아",
    staffCode: "THR-001",
    sortOrder: 1,
    attendanceStatus: "checked_in",
    checkInTime: "14:50",
    currentStatus: "available",
    nextEventTime: null,
    nextEventLabel: null,
    completedCallsCount: 3,
    remainingReservationsCount: 1,
    freeMinutes: 90,
    availableCourseCodes: ["A", "B"]
  },
  {
    therapistId: "thr-2",
    displayName: "02번 수진",
    staffCode: "THR-002",
    sortOrder: 2,
    attendanceStatus: "checked_in",
    checkInTime: "15:00",
    currentStatus: "in_use",
    nextEventTime: "16:00",
    nextEventLabel: "종료 예상 16:00",
    completedCallsCount: 1,
    remainingReservationsCount: 2,
    freeMinutes: null,
    availableCourseCodes: []
  },
  {
    therapistId: "thr-3",
    displayName: "03번 지우",
    staffCode: "THR-003",
    sortOrder: 3,
    attendanceStatus: "scheduled",
    checkInTime: "17:00",
    currentStatus: "scheduled",
    nextEventTime: "17:00",
    nextEventLabel: "출근 예정 17:00",
    completedCallsCount: 0,
    remainingReservationsCount: 0,
    freeMinutes: null,
    availableCourseCodes: ["A"]
  }
];

function render(locale: "ko" | "vi" = "ko", items = sampleTherapists) {
  return renderToStaticMarkup(
    <LocaleProvider locale={locale}>
      <TherapistStatusOverview items={items} />
    </LocaleProvider>
  );
}

describe("TherapistStatusOverview", () => {
  it("renders therapist overview header and 4 sort mode toggles", () => {
    const html = render("ko");
    assert.match(html, /관리사별 현황/);
    assert.match(html, /\(3명\)/);
    assert.match(html, /지금 가능한 순/);
    assert.match(html, /완료 콜 적은 순/);
    assert.match(html, /남은 예약 적은 순/);
    assert.match(html, /번호순/);
  });

  it("renders cards with therapist display names, status indicators, and counts", () => {
    const html = render("ko");
    assert.match(html, /01번 민아/);
    assert.match(html, /02번 수진/);
    assert.match(html, /03번 지우/);

    // Status texts
    assert.match(html, /지금 가능/);
    assert.match(html, /사용 중/);
    assert.match(html, /출근 17:00/);

    // Completed & remaining counts
    assert.match(html, /완료 3/);
    assert.match(html, /예약 1/);
    assert.match(html, /완료 1/);
    assert.match(html, /예약 2/);
  });

  it("supports Vietnamese localization", () => {
    const html = render("vi");
    assert.match(html, /Tình trạng Therapist/);
    assert.match(html, /Có thể ngay/);
    assert.match(html, /Ít ca nhất/);
    assert.match(html, /Số thứ tự/);
    assert.match(html, /Có thể/);
    assert.match(html, /Đang làm/);
  });
});
