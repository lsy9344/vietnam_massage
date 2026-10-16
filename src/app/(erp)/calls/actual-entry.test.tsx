import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "15:00", label: "15:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [{ value: "예약", label: "예약" }],
  discountTypes: [],
  paymentMethods: [{ value: "현금", label: "현금" }],
  confirmationCodes: [],
  therapists: [{ value: "therapist-1", label: "Therapist 1" }],
  expenseHandlers: []
};

function ledgerRow(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "late",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "15:00",
    actualEntryTime: "15:20",
    displayEnd: "16:00",
    warningTime: "16:00",
    warnings: [{ code: "yield_to_reservation", relatedTime: "16:00", relatedCallIds: ["next"] }],
    roomId: "room-101",
    roomLabel: "101 호실",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: null,
    therapist1: { id: "therapist-1", displayName: "Therapist 1", staffCode: "THR-001" },
    therapist2: null,
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: "현금",
    note: null,
    visitRequest: null,
    confirmationCode: null,
    basePrice: 1500000,
    paymentAmount: 1500000,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    calculationStatus: "calculated",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    savedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

function renderGrid(locale: "ko" | "vi", row = ledgerRow()) {
  return renderToStaticMarkup(
    createElement(LocaleProvider, {
      locale,
      children: createElement(EditableCallGrid, {
        isLocked: false,
        operatingMonthId: "month-2026-06",
        options,
        rows: [row],
        serviceDate: "2026-06-10",
        showSettlementColumns: false
      })
    })
  );
}

function columnOrder(html: string) {
  return ["startTime", "actualEntryTime", "roomId"].map((column) => html.indexOf(`data-call-cell-column="${column}"`));
}

describe("actual entry cell", () => {
  it("shows the service warning in words and color, tied to the actual entry cell", () => {
    const html = renderGrid("ko");
    const [startAt, entryAt, roomAt] = columnOrder(html);

    assert.match(html, /실제입장/);
    assert.match(html, /예약시각은 그대로입니다\./);
    assert.match(html, /표시 종료 16:00/);
    assert.match(html, /4:00 예약이 있습니다/);
    assert.match(html, /text-danger/);
    assert.doesNotMatch(html, /role="dialog"|role="alertdialog"/);
    assert.doesNotMatch(html, /name="finishTime"|name="endTime"/);
    assert.ok(startAt >= 0 && startAt < entryAt && entryAt < roomAt);

    const entryInput = html.match(/<input[^>]*data-call-cell-column="actualEntryTime"[^>]*>/)?.[0] ?? "";
    assert.match(entryInput, /h-11/);
    assert.match(entryInput, /aria-describedby="[^"]*actual-entry-warning/);
    assert.match(html, /id="[^"]*actual-entry-warning[^"]*"[^>]*>4:00 예약이 있습니다/);

    const vietnamese = renderGrid("vi");
    assert.match(vietnamese, /Giờ vào thực tế/);
    assert.match(vietnamese, /Giờ đặt giữ nguyên\./);
    assert.match(vietnamese, /Giờ kết thúc hiển thị 16:00/);
    assert.match(vietnamese, /Có lịch lúc 4:00\./);
  });

  it("leaves the warning off when the service warning is empty", () => {
    const html = renderGrid("ko", ledgerRow({ actualEntryTime: null, displayEnd: "16:20", warningTime: null, warnings: [] }));
    assert.match(html, /표시 종료 16:20/);
    assert.doesNotMatch(html, /예약이 있습니다/);
    assert.match(html, /예약시각은 그대로입니다\./);
  });
});
