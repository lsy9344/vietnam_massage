import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CallDetailPanel } from "@/app/(erp)/calls/call-detail-panel";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { LocaleProvider } from "@/lib/i18n/client";
import type { CallRowWarningDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "16:00", label: "16:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [
    { value: "예약", label: "예약" },
    { value: "사용중", label: "사용중" }
  ],
  discountTypes: [],
  paymentMethods: [],
  confirmationCodes: [],
  therapists: [{ value: "therapist-1", label: "Therapist 1" }],
  earcareEmployees: [],
  expenseHandlers: []
};

function ledgerRow(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "back",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "16:00",
    actualEntryTime: null,
    displayEnd: "17:00",
    warningTime: null,
    warnings: [],
    roomId: "room-101",
    roomLabel: "101 호실",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: "지윤",
    therapist1: { id: "therapist-1", displayName: "Therapist 1", staffCode: "THR-001" },
    therapist2: null,
    earcare: null,
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    confirmationCode: null,
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 0,
    calculationStatus: "not_completed",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    savedAt: "2026-06-10T00:00:00.000Z",
    ...overrides
  };
}

const unfinished: CallRowWarningDto = { code: "previous_service_unfinished", relatedTime: "16:00", relatedCallIds: ["front"] };
const yielded: CallRowWarningDto = { code: "yield_to_reservation", relatedTime: "17:00", relatedCallIds: ["after"] };
const calculation: CallRowWarningDto = { code: "calculation_error", relatedTime: null, relatedCallIds: [] };

const front = ledgerRow({ id: "front", startTime: "15:00", displayEnd: "16:00", status: "사용중", customerMemo: "민준" });

function render(locale: "ko" | "vi", child: ReturnType<typeof createElement>) {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(LocaleProvider, { locale, children: child }));
}

function renderGrid(locale: "ko" | "vi", rows: ServiceCallRowDto[], selectedCallId: string | null = null) {
  return render(
    locale,
    createElement(EditableCallGrid, {
      isLocked: false,
      operatingMonthId: "month-2026-06",
      options,
      rows,
      selectedCallId,
      serviceDate: "2026-06-10",
      showSettlementColumns: false
    })
  );
}

function warningCell(html: string, callId: string) {
  const row = html.match(new RegExp(`<tr[^>]*data-service-call-id="${callId}"[\\s\\S]*?</tr>`))?.[0] ?? "";
  return row.match(/<td[^>]*data-call-cell-column="warnings"[\s\S]*?<\/td>/)?.[0] ?? "";
}

describe("ledger row warnings", () => {
  it("shows only the first warning and the remaining count, with the save state in a different cell", () => {
    const html = renderGrid("ko", [ledgerRow({ warnings: [unfinished, yielded, calculation] })]);
    const cell = warningCell(html, "back");

    assert.match(cell, /앞 시술이 아직 끝나지 않았습니다/);
    assert.match(cell, />\+2</);
    assert.doesNotMatch(cell, /5:00 예약이 있습니다|계산 오류/);
    assert.doesNotMatch(cell, /저장/);
    assert.match(cell, /data-call-open="back"/);
    assert.match(html, /<th[^>]*>경고<\/th>/);
  });

  it("shows a single warning without a count", () => {
    const cell = warningCell(renderGrid("ko", [ledgerRow({ warnings: [yielded] })]), "back");
    assert.match(cell, /5:00 예약이 있습니다/);
    assert.doesNotMatch(cell, />\+\d</);
  });

  it("keeps an open-detail button on a row with no warnings", () => {
    const cell = warningCell(renderGrid("ko", [ledgerRow()]), "back");
    assert.match(cell, /콜 상세 열기/);
    assert.doesNotMatch(cell, /text-warning/);
  });

  it("marks the row whose detail panel is open", () => {
    const html = renderGrid("ko", [ledgerRow()], "back");
    assert.match(html, /<tr[^>]*data-selected="true"[^>]*data-service-call-id="back"/);
  });

  it("names the other call's reservation time as written in the ledger for a room overlap", () => {
    const overlap: CallRowWarningDto = { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["other"] };
    const cell = warningCell(renderGrid("ko", [ledgerRow({ warnings: [overlap, yielded] })]), "back");
    assert.match(cell, /이 객실에 14:00 콜이 있습니다/);
    assert.doesNotMatch(cell, /외 \d+건/);
    assert.match(cell, />\+1</);
  });

  it("shows the earliest overlapping call and how many more there are when three calls overlap", () => {
    const overlap: CallRowWarningDto = { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["early", "middle"] };
    const ko = warningCell(renderGrid("ko", [ledgerRow({ warnings: [overlap] })]), "back");
    const vi = warningCell(renderGrid("vi", [ledgerRow({ warnings: [overlap] })]), "back");
    assert.match(ko, /이 객실에 14:00 콜이 있습니다 외 1건/);
    assert.match(vi, /Phòng này có cuộc gọi lúc 14:00 và 1 cuộc gọi khác/);
  });

  it("speaks the warnings in Vietnamese", () => {
    const cell = warningCell(renderGrid("vi", [ledgerRow({ warnings: [unfinished, calculation] })]), "back");
    assert.match(cell, /Dịch vụ trước vẫn chưa kết thúc/);
    assert.match(cell, />\+1</);
  });
});

describe("call detail panel", () => {
  function renderPanel(locale: "ko" | "vi", row: ServiceCallRowDto | null, rows: ServiceCallRowDto[]) {
    return render(
      locale,
      createElement(CallDetailPanel, { customers: [], isLocked: false, onClose: () => {}, onSelectCall: () => {}, options, row, rows })
    );
  }

  it("lists every warning in priority order and the related call with a way to move to it", () => {
    const row = ledgerRow({ warnings: [unfinished, yielded, calculation] });
    const html = renderPanel("ko", row, [front, row]);

    assert.match(html, /<aside[^>]*aria-label="콜 상세 · 16:00 지윤"/);
    const order = ["앞 시술이 아직 끝나지 않았습니다", "5:00 예약이 있습니다", "계산 오류"].map((text) => html.indexOf(text));
    assert.ok(order.every((index) => index >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-related-call="front"/);
    assert.match(html, /15:00 · A 누루60 · Therapist 1 · 사용중/);
    assert.match(html, /이 콜로 이동/);
    assert.doesNotMatch(html, /저장됨|저장 중|저장 실패|충돌 확인/);
    assert.doesNotMatch(html, /role="dialog"/);
  });

  it("says so when there are no warnings or related calls", () => {
    const html = renderPanel("ko", ledgerRow(), [ledgerRow()]);
    assert.match(html, /경고가 없습니다/);
    assert.match(html, /관련 콜이 없습니다/);
  });

  it("explains an address whose call is not on this date's ledger", () => {
    const html = renderPanel("ko", null, [front]);
    assert.match(html, /이 날짜의 원장에서 그 콜을 찾을 수 없습니다/);
  });

  it("has Vietnamese text", () => {
    const row = ledgerRow({ warnings: [unfinished] });
    const html = renderPanel("vi", row, [front, row]);
    assert.match(html, /Dịch vụ trước vẫn chưa kết thúc/);
    assert.match(html, /Cuộc gọi liên quan/);
    assert.match(html, /Đi đến cuộc gọi này/);
  });
});
