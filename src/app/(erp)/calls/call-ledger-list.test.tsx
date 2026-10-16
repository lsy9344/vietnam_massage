import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CallEditPanel } from "@/app/(erp)/calls/call-edit-panel";
import { CallLedgerList, readDoneExpanded } from "@/app/(erp)/calls/call-ledger-list";
import { initialCallRowSave, type CallRowSave } from "@/app/(erp)/calls/call-row-save";
import { LocaleProvider } from "@/lib/i18n/client";
import type { CallRowWarningDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

const options: ServiceCallFormOptions = {
  rooms: [
    { value: "room-101", label: "101 호실" },
    { value: "room-102", label: "102 호실" }
  ],
  timeSlots: [{ value: "15:00", label: "15:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [
    { value: "RESERVED", label: "예약" },
    { value: "IN_USE", label: "사용중" },
    { value: "VISIT_COMPLETE", label: "방문완료" },
    { value: "CANCELED", label: "취소" }
  ],
  discountTypes: [{ value: "BIRTHDAY", label: "생일자" }],
  paymentMethods: [
    { value: "CASH", label: "현금" },
    { value: "CARD", label: "카드" }
  ],
  confirmationCodes: [{ value: "Y", label: "Y" }],
  therapists: [{ value: "therapist-1", label: "Therapist 1 (THR-001)" }],
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
    status: "RESERVED",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    visitRequest: null,
    confirmationCode: null,
    partyId: null,
    partyPosition: null,
    basePrice: 1500000,
    paymentAmount: 1500000,
    discountAmount: 0,
    therapist1Commission: 300000,
    therapist2Commission: 0,
    calculationStatus: "not_completed",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T00:00:00.000Z",
    updatedAt: "2026-06-10T00:00:00.000Z",
    savedAt: "2026-06-10T07:28:00.000Z",
    ...overrides
  };
}

const unfinished: CallRowWarningDto = { code: "previous_service_unfinished", relatedTime: "16:00", relatedCallIds: ["front"] };
const yielded: CallRowWarningDto = { code: "yield_to_reservation", relatedTime: "17:00", relatedCallIds: ["after"] };
const calculation: CallRowWarningDto = { code: "calculation_error", relatedTime: null, relatedCallIds: [] };

function render(locale: "ko" | "vi", child: ReturnType<typeof createElement>) {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(LocaleProvider, { locale, children: child }));
}

function renderList(
  rows: ServiceCallRowDto[],
  { locale = "ko", isLocked = false, selectedCallId = null }: { locale?: "ko" | "vi"; isLocked?: boolean; selectedCallId?: string | null } = {}
) {
  return render(locale, createElement(CallLedgerList, { isLocked, options, rows, selectedCallId, showSettlementAmounts: false }));
}

function line(html: string, callId: string) {
  return html.match(new RegExp(`<tr[^>]*data-service-call-id="${callId}"[\\s\\S]*?</tr>`))?.[0] ?? "";
}

function buttons(markup: string) {
  return [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
}

// usePhoneWidth()의 초기 useState는 렌더 중에 window.matchMedia를 읽는다. 전역 window를 흉내 내면 실제 폭을
// 바꾼 것과 같은 결과를 renderToStaticMarkup로 볼 수 있다.
function withWindowWidth(minWidth600Matches: boolean, run: () => string) {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({ matches: minWidth600Matches, addEventListener: () => {}, removeEventListener: () => {} })
  };
  try {
    return run();
  } finally {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  }
}

describe("parties on the flow ledger list (ticket 04)", () => {
  const party = (id: string, partyPosition: number, status: string, roomId: string | null = null) =>
    ledgerRow({ id, startTime: "11:00", status, customerMemo: "정 대표", partyId: "party-jung", partyPosition, roomId });
  const rows = [
    party("jung-2", 2, "RESERVED"),
    ledgerRow({ id: "solo-11", startTime: "11:00", status: "RESERVED", customerMemo: "혼자 손님" }),
    party("jung-1", 1, "RESERVED", "room-101"),
    party("jung-3", 3, "IN_USE", "room-102")
  ];

  function head(html: string, flow: string) {
    const section = html.slice(html.indexOf(`data-ledger-flow="${flow}"`));
    return section.match(/<tr[^>]*data-ledger-party="party-jung"[\s\S]*?<\/tr>/)?.[0] ?? "";
  }

  it("puts the party under a head line with its size, members in party order, where its first member stands", () => {
    const html = renderList(rows);
    const table = html.slice(html.indexOf("<table"));
    const reserved = table.slice(table.indexOf('data-ledger-flow="reserved"'));
    const order = ['data-ledger-party="party-jung"', 'data-service-call-id="jung-1"', 'data-service-call-id="jung-2"', 'data-service-call-id="solo-11"'].map(
      (marker) => reserved.indexOf(marker)
    );
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(head(html, "reserved"), /정 대표 일행 3명/);
    assert.match(line(html, "jung-2"), /일행 2\/3/);
    // 흩어진 손님도 자기 묶음에서 일행 머리 아래에 있고 "일행 3/3"이 남는다.
    assert.match(head(html, "active"), /정 대표 일행 3명/);
    assert.match(line(html, "jung-3"), /일행 3\/3/);
    assert.doesNotMatch(line(html, "solo-11"), /일행/);
  });

  it("offers party entry and cancel where the party's reservations are, and adding one guest once", () => {
    const html = renderList(rows);
    assert.deepEqual(buttons(head(html, "reserved")), ["일행 입장", "일행 취소"]);
    assert.deepEqual(buttons(head(html, "active")), ["1명 추가"]);
  });

  it("locks the party actions in a locked month", () => {
    const html = renderList(rows, { isLocked: true });
    for (const flow of ["reserved", "active"]) {
      for (const button of head(html, flow).match(/<button[^>]*>/g) ?? []) assert.match(button, /disabled=""/);
    }
  });

  it("speaks Vietnamese", () => {
    const html = renderList(rows, { locale: "vi" });
    assert.match(head(html, "reserved"), /Nhóm 정 대표 3 người/);
    assert.deepEqual(buttons(head(html, "reserved")), ["Cả nhóm vào phòng", "Hủy nhóm"]);
    assert.match(line(html, "jung-2"), /Nhóm 2\/3/);
  });
});

describe("flow ledger list (ticket 03)", () => {
  const rows = [
    ledgerRow({ id: "done-11", startTime: "11:00", status: "VISIT_COMPLETE", customerMemo: "끝난 손님" }),
    ledgerRow({ id: "reserved-12", startTime: "12:00", status: "RESERVED", customerMemo: "예약 손님" }),
    ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE", customerMemo: "이용 손님", note: "VIP 단골" })
  ];

  it("groups the day's calls as in use, then reserved, then finished, with how many are in each", () => {
    // 휴대폰 카드 목록(티켓 26)이 목록 앞에 있으므로 목록(table)만 본다.
    const html = renderList(rows).slice(renderList(rows).indexOf("<table"));
    const order = ["data-ledger-flow=\"active\"", "in-use-13", "data-ledger-flow=\"reserved\"", "reserved-12", "data-ledger-flow=\"done\"", "done-11"].map(
      (marker) => html.indexOf(marker)
    );
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /지금 이용 중 <span[^>]*>1건/);
    assert.match(html, /예약 <span[^>]*>1건/);
  });

  it("folds the finished calls by default behind a toggle that says how many there are", () => {
    const html = renderList(rows);
    assert.match(html, /<button aria-expanded="false"[^>]*>[\s\S]*?완료·취소·노쇼 1건<\/button>/);
    assert.match(line(html, "done-11"), /<tr[^>]*hidden=""/);
    assert.doesNotMatch(line(html, "reserved-12"), /hidden=""/);
  });

  it("unfolds the finished calls when one of them is the open call", () => {
    const html = renderList(rows, { selectedCallId: "done-11" });
    assert.match(html, /<button aria-expanded="true"/);
    assert.doesNotMatch(line(html, "done-11"), /hidden=""/);
    assert.match(line(html, "done-11"), /data-selected="true"/);
  });

  it("shows time, customer, course, therapist, room, status with the note, and the next thing to do on one line", () => {
    const html = renderList(rows);
    const inUse = line(html, "in-use-13");
    for (const text of ["13:00", "이용 손님", "A 누루60", "Therapist 1", "101 호실", "사용중", "VIP 단골"]) {
      assert.ok(inUse.includes(text), text);
    }
    assert.match(inUse, /data-call-open="in-use-13"/);
    assert.deepEqual(buttons(inUse).slice(-1), ["결제"]);
    assert.deepEqual(buttons(line(html, "reserved-12")).slice(-1), ["입장"]);
    assert.ok(!buttons(line(html, "done-11")).includes("입장") && !buttons(line(html, "done-11")).includes("결제"));
  });

  it("fits the width: a fixed-layout table with no minimum width and no sideways scroll box", () => {
    const html = renderList(rows);
    assert.match(html, /<table[^>]*class="w-full table-fixed/);
    assert.doesNotMatch(html, /min-width|overflow-x-auto/);
  });

  it("has no view switch and no new-row input: new calls come from quick booking only", () => {
    const html = renderList(rows);
    assert.doesNotMatch(html, /새 콜 행 추가|예약·현장|수납·정산/);
    assert.equal((html.match(/<input/g) ?? []).length, 0);
  });

  it("locks the entry and payment buttons in a locked month", () => {
    const html = renderList(rows, { isLocked: true });
    assert.match(html, /잠긴 운영월입니다/);
    assert.match(line(html, "reserved-12"), /<button[^>]*disabled=""[^>]*>입장<\/button>/);
    assert.match(line(html, "in-use-13"), /<button[^>]*disabled=""[^>]*>결제<\/button>/);
  });

  it("speaks Vietnamese", () => {
    const html = renderList(rows, { locale: "vi" });
    assert.match(html, /Đang phục vụ/);
    assert.match(html, /Hoàn tất · Hủy · Không đến 1 ca/);
    assert.match(line(html, "reserved-12"), />Vào phòng</);
    assert.match(line(html, "in-use-13"), />Thanh toán</);
  });
});

describe("remembered done group", () => {
  function withStorage(localStorage: unknown, run: () => boolean) {
    const original = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
      get localStorage() {
        if (localStorage instanceof Error) throw localStorage;
        return localStorage;
      }
    };
    try {
      return run();
    } finally {
      if (original === undefined) delete (globalThis as { window?: unknown }).window;
      else (globalThis as { window?: unknown }).window = original;
    }
  }

  it("reads the unfolded state this device kept, and falls back to folded when storage cannot be used", () => {
    assert.equal(withStorage({ getItem: () => "1" }, readDoneExpanded), true);
    assert.equal(withStorage({ getItem: () => null }, readDoneExpanded), false);
    assert.equal(withStorage(new Error("SecurityError"), readDoneExpanded), false);
  });
});

describe("ledger line warnings", () => {
  it("shows how many warnings there are and names the first, and opens the panel; the save state is apart", () => {
    const html = renderList([ledgerRow({ warnings: [unfinished, yielded, calculation] })]);
    const warning = html.match(/<button aria-label="경고 3건: 앞 시술이 아직 끝나지 않았습니다"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    assert.ok(warning, "경고 버튼이 없다");
    assert.match(warning, />3</);
    assert.doesNotMatch(warning, /저장/);
  });

  it("shows no warning button on a line without warnings", () => {
    assert.doesNotMatch(renderList([ledgerRow()]), /경고 \d+건/);
  });

  it("names the room overlap the way the ledger writes it, in Korean and Vietnamese", () => {
    const overlap: CallRowWarningDto = { code: "room_overlap", relatedTime: "14:00", relatedCallIds: ["early", "middle"] };
    assert.match(renderList([ledgerRow({ warnings: [overlap] })]), /경고 1건: 이 객실에 14:00 콜이 있습니다 외 1건/);
    assert.match(renderList([ledgerRow({ warnings: [overlap] })], { locale: "vi" }), /Phòng này có cuộc gọi lúc 14:00 và 1 cuộc gọi khác/);
  });
});

describe("phone width (ticket 26, ledger flow ticket 05)", () => {
  const rows = [
    ledgerRow({ id: "reserved-12", startTime: "12:00", status: "RESERVED", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 1 }),
    ledgerRow({ id: "reserved-12b", startTime: "12:00", status: "RESERVED", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 2 }),
    ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE" })
  ];

  it("draws the same flow list on a phone, with no separate card list", () => {
    const html = withWindowWidth(false, () => renderList(rows));
    assert.doesNotMatch(html, /원장 카드 목록/);
    assert.equal((html.match(/<table/g) ?? []).length, 1);
    // 같은 줄이 600px 미만에서 세 줄 격자가 된다.
    assert.match(line(html, "in-use-13"), /^<tr[^>]*max-\[599px\]:grid/);
  });

  it("keeps the phone read-only: no enter, pay, or party buttons", () => {
    const phone = withWindowWidth(false, () => renderList(rows));
    // 줄에는 패널을 여는 시간 버튼만 남는다.
    assert.deepEqual(buttons(line(phone, "reserved-12")), ["12:00"]);
    assert.deepEqual(buttons(line(phone, "in-use-13")), ["13:00"]);
    assert.doesNotMatch(phone, /일행 입장|일행 취소|1명 추가/);
    assert.match(phone, /정 대표 일행 2명/);

    const wide = withWindowWidth(true, () => renderList(rows));
    assert.deepEqual(buttons(line(wide, "in-use-13")).slice(-1), ["결제"]);
    assert.match(wide, /일행 입장/);
  });

  // 회귀(story-2-1): 콜이 없는 날짜의 빈 상태 문구는 한 번만 나온다. 휴대폰 폭에는 빠른 예약이 없어 안내도 뺀다.
  it("shows exactly one empty-day message, without the quick booking hint on a phone", () => {
    const count = (html: string) => (html.match(/이 날짜의 콜이 없습니다/g) ?? []).length;
    assert.equal(count(renderList([])), 1);
    assert.equal(count(withWindowWidth(false, () => renderList([]))), 1);
    assert.equal(count(withWindowWidth(true, () => renderList([]))), 1);
    assert.match(renderList([]), /빠른 예약으로 새 콜을 만든다/);
    assert.doesNotMatch(withWindowWidth(false, () => renderList([])), /빠른 예약으로 새 콜을 만든다/);
  });
});

function renderPanel(
  row: ServiceCallRowDto,
  {
    locale = "ko",
    isLocked = false,
    readOnly = false,
    rows = [row],
    save = initialCallRowSave(row),
    showSettlementAmounts = false
  }: { locale?: "ko" | "vi"; isLocked?: boolean; readOnly?: boolean; rows?: ServiceCallRowDto[]; save?: CallRowSave; showSettlementAmounts?: boolean } = {}
) {
  return render(
    locale,
    createElement(CallEditPanel, {
      conflict: null,
      customers: [],
      focusRequest: null,
      isLocked,
      onCancel: () => {},
      onCommit: () => {},
      onEdit: () => {},
      onReload: () => {},
      onRetry: () => {},
      onSelectCall: () => {},
      options,
      readOnly,
      row,
      rows,
      save,
      showSettlementAmounts,
      warningsRow: row
    })
  );
}

describe("call edit panel (ticket 03)", () => {
  it("groups every field as booking, entry, payment and memo, with the rarely used ones under more", () => {
    const html = renderPanel(ledgerRow());
    const order = ['aria-label="예약"', 'aria-label="입장"', 'aria-label="결제"', 'aria-label="메모"', "<details", "더 보기"].map((marker) =>
      html.indexOf(marker)
    );
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    const more = html.slice(html.indexOf("<details"));
    for (const field of ["visitRequest", "confirmationCode"]) assert.match(more, new RegExp(`data-call-field="${field}"`));
    assert.match(more, /고객 연결 정정/);
    const fields = [...html.matchAll(/data-call-field="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(fields, [
      "startTime",
      "courseId",
      "customerMemo",
      "therapist1Id",
      "therapist2Id",
      "actualEntryTime",
      "roomId",
      "status",
      "discountTypeCode",
      "note",
      "visitRequest",
      "confirmationCode"
    ]);
  });

  it("chooses the payment method with pills and completes payment with one button", () => {
    const html = renderPanel(ledgerRow({ status: "IN_USE", paymentMethodCode: "CARD" }));
    const payment = html.slice(html.indexOf('data-panel-section="payment"'));
    assert.match(payment, /<input[^>]*data-payment-method="CARD"[^>]*type="radio"[^>]*checked=""/);
    assert.match(payment, /data-payment-method="CASH"/);
    assert.match(payment, />미선택</);
    assert.match(payment, /<button[^>]*>결제 완료<\/button>/);
    assert.doesNotMatch(payment, /<button[^>]*disabled=""[^>]*>결제 완료/);
  });

  it("shows the calculated payment, and the therapist commission only to roles that may see settlement amounts", () => {
    const row = ledgerRow({ status: "VISIT_COMPLETE", calculationStatus: "calculated", discountAmount: 100000, paymentAmount: 1400000 });
    const staff = renderPanel(row);
    assert.match(staff, /1,400,000/);
    assert.match(staff, /line-through">1,500,000/);
    assert.doesNotMatch(staff, /마사지사1수당/);
    const admin = renderPanel(row, { showSettlementAmounts: true });
    assert.match(admin, /마사지사1수당/);
    assert.match(admin, /300,000/);
    assert.match(admin, /<button[^>]*disabled=""[^>]*>결제 완료/);
  });

  it("waits on the calculation while the draft is not saved", () => {
    const row = ledgerRow({ calculationStatus: "calculated" });
    const failed: CallRowSave = { ...initialCallRowSave(row), status: "failed", message: "저장하지 못했습니다." };
    const html = renderPanel(row, { save: failed });
    assert.match(html, /저장 보류 계산 대기/);
    assert.doesNotMatch(html, /1,500,000/);
    assert.match(html, /저장하지 못했습니다\./);
    assert.match(html, />재시도</);
  });

  it("keeps the actual-entry help, display end and yield warning tied to the actual entry field", () => {
    const html = renderPanel(ledgerRow({ actualEntryTime: "15:20", displayEnd: "16:00", warningTime: "16:00" }));
    assert.match(html, /예약시각은 그대로입니다\./);
    assert.match(html, /표시 종료 16:00/);
    const entry = html.match(/<input[^>]*data-call-field="actualEntryTime"[^>]*>/)?.[0] ?? "";
    assert.match(entry, /aria-describedby="[^"]*actual-entry-warning/);
    assert.match(html, /id="[^"]*actual-entry-warning"[^>]*>4:00 예약이 있습니다/);
    assert.match(renderPanel(ledgerRow({ warningTime: "16:00" }), { locale: "vi" }), /Có lịch lúc 4:00\./);
  });

  it("lists every warning in priority order and the related call with a way to move to it", () => {
    const front = ledgerRow({ id: "front", startTime: "15:00", status: "IN_USE", customerMemo: "민준" });
    const row = ledgerRow({ warnings: [unfinished, yielded, calculation] });
    const html = renderPanel(row, { rows: [front, row] });
    const order = ["앞 시술이 아직 끝나지 않았습니다", "5:00 예약이 있습니다", "계산 오류"].map((text) => html.indexOf(text));
    assert.ok(order.every((index) => index >= 0));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-related-call="front"/);
    assert.match(html, /15:00 · A 누루60 · Therapist 1 · 사용중/);
    assert.match(html, /이 콜로 이동/);
    assert.match(renderPanel(ledgerRow()), /경고가 없습니다/);
    assert.match(renderPanel(ledgerRow()), /관련 콜이 없습니다/);
  });

  it("locks every field and the payment button in a locked month", () => {
    const html = renderPanel(ledgerRow({ status: "IN_USE" }), { isLocked: true });
    const fields = [...html.matchAll(/<input[^>]*data-call-field="[^"]+"[^>]*>/g)].map((match) => match[0]);
    assert.ok(fields.length > 0 && fields.every((field) => /disabled=""/.test(field)));
    assert.match(html, /<button[^>]*disabled=""[^>]*>결제 완료/);
  });

  it("only reads at phone width: no input at all", () => {
    const html = withWindowWidth(false, () => renderPanel(ledgerRow(), { readOnly: true }));
    assert.doesNotMatch(html, /<input|<select|<textarea/);
    assert.match(html, /고객 화면으로 이동/);
  });

  it("speaks Vietnamese", () => {
    const html = renderPanel(ledgerRow({ warnings: [unfinished] }), { locale: "vi" });
    for (const text of ["Đặt lịch", "Vào phòng", "Thanh toán", "Ghi chú", "Xem thêm", "Hoàn tất thanh toán", "Dịch vụ trước vẫn chưa kết thúc"]) {
      assert.ok(html.includes(text), text);
    }
  });
});
