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
  timeSlots: [
    { value: "11:00", label: "11:00" },
    { value: "15:00", label: "15:00" }
  ],
  courses: [
    { value: "course-a", label: "A 누루60" },
    { value: "course-d", label: "D 2:1" }
  ],
  statuses: [
    { value: "RESERVED", label: "예약" },
    { value: "IN_USE", label: "사용중" },
    { value: "CLEANING", label: "청소중" },
    { value: "VISIT_COMPLETE", label: "방문완료" },
    { value: "CANCELED", label: "취소" }
  ],
  discountTypes: [{ value: "BIRTHDAY", label: "생일자" }],
  paymentMethods: [
    { value: "CASH", label: "현금" },
    { value: "CARD", label: "카드" }
  ],
  confirmationCodes: [{ value: "Y", label: "Y" }],
  secondTherapistCourseIds: ["course-d"],
  bookingChannels: [{ value: "TELEGRAM", label: "텔레그램" }],
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
    actualEndTime: null,
    displayEnd: "17:00",
    reservedEnd: "17:00",
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
    bookingChannelCode: null,
    bookerName: null,
    bookerHandle: null,
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
  {
    locale = "ko",
    isLocked = false,
    selectedCallId = null,
    clock = null,
    phoneWidth = false,
    therapistFilter = null
  }: {
    locale?: "ko" | "vi";
    isLocked?: boolean;
    selectedCallId?: string | null;
    clock?: { today: string; time: string } | null;
    phoneWidth?: boolean;
    therapistFilter?: string | null;
  } = {}
) {
  return render(
    locale,
    createElement(CallLedgerList, { clock, customers: [], isLocked, options, phoneWidth, rows, selectedCallId, showSettlementAmounts: false, therapistFilter })
  );
}

function line(html: string, callId: string) {
  return html.match(new RegExp(`<li[^>]*data-service-call-id="${callId}"[\\s\\S]*?</li>`))?.[0] ?? "";
}

/** 줄의 칸(data-line-cell) 하나의 마크업. 칸은 형제라 다음 칸 표시까지 자른다. 여러 이름을 주면 이어 붙인다. */
function cell(markup: string, ...names: string[]) {
  return names
    .map((name) => {
      const marker = markup.indexOf(`data-line-cell="${name}"`);
      if (marker === -1) return "";
      const next = markup.indexOf('data-line-cell="', marker + 1);
      // 칸 표시가 든 여는 태그부터 다음 칸의 여는 태그 앞까지.
      return markup.slice(markup.lastIndexOf("<", marker), next === -1 ? undefined : markup.lastIndexOf("<", next));
    })
    .join("");
}

function text(markup: string) {
  return markup.replace(/<[^>]+>/g, "").replace(/&gt;/g, ">");
}

function buttons(markup: string) {
  return [...markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((match) => match[1].replace(/<[^>]+>/g, ""));
}

describe("parties on the two-line ledger (ticket 04, 1018 ticket 02)", () => {
  const party = (id: string, partyPosition: number, status: string, roomId: string | null = null) =>
    ledgerRow({ id, startTime: "11:00", status, customerMemo: "정 대표", partyId: "party-jung", partyPosition, roomId });
  const rows = [
    party("jung-2", 2, "RESERVED"),
    ledgerRow({ id: "solo-11", startTime: "11:00", status: "RESERVED", customerMemo: "혼자 손님" }),
    party("jung-1", 1, "RESERVED", "room-101"),
    party("jung-3", 3, "VISIT_COMPLETE", "room-102")
  ];

  function head(html: string, part: string) {
    return html.match(new RegExp(`<li[^>]*data-ledger-party="party-jung"[^>]*data-ledger-party-part="${part}"[\\s\\S]*?</li>`))?.[0] ?? "";
  }

  it("puts the party under a head line with its size, members in party order with a bar on the left, where its first member stands", () => {
    const html = renderList(rows);
    const order = ['data-ledger-party="party-jung"', 'data-service-call-id="jung-1"', 'data-service-call-id="jung-2"', 'data-service-call-id="solo-11"'].map(
      (marker) => html.indexOf(marker)
    );
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(head(html, "open"), /정 대표 일행 3명/);
    assert.match(line(html, "jung-2"), /일행 2\/3/);
    assert.match(line(html, "jung-2"), /^<li[^>]*data-ledger-party-member="party-jung"/);
    // 완료로 내려간 손님도 하단에서 일행 머리 아래에 있고 "일행 3/3"이 남는다.
    assert.match(head(html, "done"), /정 대표 일행 3명/);
    assert.match(line(html, "jung-3"), /일행 3\/3/);
    assert.doesNotMatch(line(html, "solo-11"), /일행/);
  });

  it("offers party entry and cancel where the party's reservations are, and adding one guest once", () => {
    const html = renderList(rows);
    assert.deepEqual(buttons(head(html, "open")), ["일행 입장", "일행 취소", "1명 추가"]);
    assert.deepEqual(buttons(head(html, "done")), []);
  });

  // 1018 스펙 D17: 현황 줄의 "콜만" 거르기는 줄을 숨길 뿐 빼지 않는다. 숨은 줄의 저장 상태와 일행 인원이 그대로다.
  it("hides the calls of other Therapists when filtered, keeping the party's full size and the open call", () => {
    const other = { id: "therapist-2", displayName: "Therapist 2", staffCode: "THR-002" };
    const filteredRows = [
      ledgerRow({ id: "jung-1", startTime: "11:00", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 1 }),
      ledgerRow({ id: "jung-2", startTime: "11:00", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 2, therapist1: other }),
      ledgerRow({ id: "solo-other", startTime: "12:00", therapist1: other }),
      ledgerRow({ id: "solo-open", startTime: "13:00", therapist1: other }),
      ledgerRow({ id: "only-other-party", startTime: "14:00", partyId: "party-other", partyPosition: 1, therapist1: other }),
      ledgerRow({ id: "only-other-party-2", startTime: "14:00", partyId: "party-other", partyPosition: 2, therapist1: other })
    ];
    const html = renderList(filteredRows, { therapistFilter: "therapist-1", selectedCallId: "solo-open" });

    assert.match(line(html, "jung-1"), /^<li(?![^>]*hidden)/);
    assert.match(line(html, "jung-2"), /^<li[^>]*hidden/);
    assert.match(line(html, "solo-other"), /^<li[^>]*hidden/);
    assert.match(line(html, "solo-open"), /^<li(?![^>]*hidden)/);
    // 일행 머리는 보이는 손님이 있으면 남고, 인원은 하루 전체로 센다. 보이는 손님이 없는 일행은 머리도 숨는다.
    assert.match(head(html, "open"), /^<li(?![^>]*hidden)[\s\S]*정 대표 일행 2명/);
    assert.match(html, /<li[^>]*data-ledger-party="party-other"[^>]*hidden/);
  });

  it("locks the party actions in a locked month", () => {
    const html = renderList(rows, { isLocked: true });
    for (const button of head(html, "open").match(/<button[^>]*>/g) ?? []) assert.match(button, /disabled=""/);
  });

  it("speaks Vietnamese", () => {
    const html = renderList(rows, { locale: "vi" });
    assert.match(head(html, "open"), /Nhóm 정 대표 3 người/);
    assert.deepEqual(buttons(head(html, "open")), ["Cả nhóm vào phòng", "Hủy nhóm", "Thêm 1 người"]);
    assert.match(line(html, "jung-2"), /Nhóm 2\/3/);
  });
});

describe("two-line ledger (1018 ticket 02)", () => {
  const rows = [
    ledgerRow({ id: "done-11", startTime: "11:00", status: "VISIT_COMPLETE", customerMemo: "끝난 손님", actualEntryTime: "11:00", actualEndTime: "11:55" }),
    ledgerRow({ id: "reserved-12", startTime: "12:00", status: "RESERVED", customerMemo: "예약 손님", displayEnd: "13:00" }),
    ledgerRow({
      id: "in-use-13",
      startTime: "13:00",
      status: "IN_USE",
      actualEntryTime: "13:10",
      displayEnd: "14:10",
      bookingChannelCode: "TELEGRAM",
      bookerName: "홍길동",
      customerMemo: "옛 메모",
      paymentMethodCode: "CASH"
    }),
    ledgerRow({ id: "reserved-15", startTime: "15:00", status: "RESERVED", therapist1: null, roomId: null, roomLabel: "미배정" })
  ];

  it("lists the open calls in time order as one list, without the in-use and reservation groups", () => {
    const html = renderList(rows);
    const order = ["reserved-12", "in-use-13", "reserved-15", "data-ledger-done-toggle", "done-11"].map((marker) => html.indexOf(marker));
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.doesNotMatch(html, /지금 이용 중|data-ledger-flow=/);
  });

  it("folds the finished calls at the bottom behind a toggle that says how many there are", () => {
    const html = renderList(rows);
    assert.match(html, /<button aria-expanded="false"[^>]*>[\s\S]*?완료·취소·노쇼 1건<\/button>/);
    assert.match(line(html, "done-11"), /^<li[^>]*hidden=""/);
    assert.doesNotMatch(line(html, "reserved-12"), /^<li[^>]*hidden=""/);
  });

  it("unfolds the finished calls when one of them is the open call", () => {
    const html = renderList(rows, { selectedCallId: "done-11" });
    assert.match(html, /<button aria-expanded="true"/);
    assert.doesNotMatch(line(html, "done-11"), /^<li[^>]*hidden=""/);
    assert.match(line(html, "done-11"), /data-selected="true"/);
  });

  it("shows the booking time, status, entry, end and the next thing to do in their own cells (1018 ticket 03, 2026-10-22 시안)", () => {
    const html = renderList([...rows, ledgerRow({ id: "cleaning-14", startTime: "14:00", status: "CLEANING", actualEntryTime: "14:02", actualEndTime: "14:58" })]);
    const inUse = line(html, "in-use-13");
    assert.match(cell(inUse, "time"), /data-call-open="in-use-13"[^>]*>13:00</);
    assert.equal(text(cell(inUse, "entry")), "13:10");
    assert.match(cell(inUse, "end"), /text-faint[^>]*>예상 14:10</);
    assert.match(cell(inUse, "status"), /<span[^>]*>사용중<\/span>/);
    assert.deepEqual(buttons(cell(inUse, "action")), ["종료"]);
    // 청소중은 청소 끝이 주 버튼이고, 옆 ▾가 청소 끝·종료 취소 목록을 연다(스펙 D11·D13, 시안 444.png).
    const cleaning = cell(line(html, "cleaning-14"), "action");
    assert.deepEqual(buttons(cleaning), ["청소 끝", "▾"]);
    assert.match(cleaning, /aria-haspopup="listbox"[^>]*aria-label="14:00 콜 청소 메뉴 열기"/);
    assert.match(text(cell(line(html, "cleaning-14"), "entry", "end")), /14:02[\s\S]*14:58/);

    assert.match(text(cell(line(html, "reserved-12"), "entry")), /미입장/);
    assert.deepEqual(buttons(cell(line(html, "reserved-12"), "action")), ["입장"]);
    assert.match(text(cell(line(html, "done-11"), "entry", "end")), /11:00[\s\S]*11:55/);
    assert.match(cell(line(html, "done-11"), "end"), /font-semibold[^>]*>11:55</);
  });

  it("shows the channel symbol and booker, course, therapist, room, payment and discount", () => {
    const html = renderList(rows);
    const inUse = text(cell(line(html, "in-use-13"), "who", "course", "therapist", "room", "pay", "discount"));
    for (const part of ["텔레그램", "홍길동", "누루60", "Therapist 1", "101 호실", "결제완료", "현금", "없음"]) assert.ok(inUse.includes(part), part);
    assert.match(cell(line(html, "in-use-13"), "who"), /<svg[^>]*aria-label="텔레그램"/);
    assert.doesNotMatch(inUse, /옛 메모/);
    assert.match(text(cell(line(html, "reserved-12"), "who", "pay")), /예약 손님[\s\S]*미확인/);
    const unassigned = text(cell(line(html, "reserved-15"), "therapist", "room"));
    assert.match(unassigned, /미지명/);
    assert.match(unassigned, /미배정/);
  });

  // 2026-10-23: 메신저로 받은 예약은 고객 칸 둘째 줄에 그 메신저 ID를 보인다(고객 시안 111.png의 @jihoon123). ID가 없으면 전과 같이 경로 이름이다.
  it("shows the booker's messenger ID on the customer cell's second line, else the channel name", () => {
    const html = renderList([
      ledgerRow({ id: "with-id", startTime: "12:00", bookingChannelCode: "TELEGRAM", bookerName: "지훈", bookerHandle: "@jihoon123" }),
      ledgerRow({ id: "without-id", startTime: "13:00", bookingChannelCode: "TELEGRAM", bookerName: "민수" })
    ]);
    // 앞의 "텔레그램"은 경로 기호의 이름(title)이다. 둘째 줄은 이름 뒤에 온다.
    assert.match(text(cell(line(html, "with-id"), "who")), /지훈@jihoon123$/);
    assert.match(text(cell(line(html, "without-id"), "who")), /민수텔레그램$/);
  });

  // 2026-10-23: 결제 칸에 "결제 미확인"·"Chưa xác nhận thanh toán"을 다 쓰면 칸 밖으로 넘치거나 잘렸다. 머리가 이미 "결제"라
  // 칩은 짧게 쓰고(고객 시안 111.png의 "미확인"·"결제완료"), 다 쓴 말은 칸의 title로 남긴다.
  it("writes the payment chip short under the 결제 head, keeping the full words in the cell's title", () => {
    // 보이는 글자만(▲·●·▾ 기호 빼고).
    const words = (markup: string) => text(markup).replace(/[^\p{L}\p{N} ]/gu, "").trim();
    const ko = renderList(rows);
    const unpaid = cell(line(ko, "reserved-12"), "pay");
    assert.equal(words(unpaid), "미확인");
    assert.match(unpaid, /title="결제 미확인"/);
    const paid = cell(line(ko, "in-use-13"), "pay");
    assert.equal(words(paid), "결제완료현금");
    assert.match(paid, /title="결제완료 · 현금"/);

    const vi = renderList(rows, { locale: "vi" });
    const unpaidVi = cell(line(vi, "reserved-12"), "pay");
    assert.equal(words(unpaidVi), "Chưa xác nhận");
    assert.match(unpaidVi, /title="Chưa xác nhận thanh toán"/);
  });

  it("opens the status, therapist, room and payment lists in place, and locks them in a locked month (1018 spec D6·D12)", () => {
    const pickers = (markup: string) => markup.match(/<button[^>]*aria-haspopup="listbox"[^>]*>/g) ?? [];
    const statusPicker = pickers(cell(line(renderList(rows), "reserved-12"), "status"));
    assert.equal(statusPicker.length, 1);
    assert.match(statusPicker[0], /aria-label="12:00 콜 상태 고르기"/);
    const open = pickers(cell(line(renderList(rows), "reserved-12"), "therapist", "room", "pay", "discount"));
    assert.equal(open.length, 4);
    assert.match(open[0], /aria-label="12:00 콜 Therapist 고르기"/);
    assert.match(open[1], /aria-label="12:00 콜 객실 고르기"/);
    assert.match(open[2], /aria-label="12:00 콜 결제수단 고르기"/);
    assert.match(open[3], /aria-label="12:00 콜 할인 고르기"/);
    assert.ok(open.every((picker) => /aria-expanded="false"/.test(picker) && !/disabled=""/.test(picker)));
    assert.ok(pickers(line(renderList(rows, { isLocked: true }), "reserved-12")).every((picker) => /disabled=""/.test(picker)));
  });

  it("shows a second Therapist cell on a two-Therapist course even before anyone is in it, and only there", () => {
    const html = renderList([
      ledgerRow({ id: "two-empty", startTime: "12:00", courseId: "course-d", courseCode: "D", courseLabel: "D 2:1" }),
      ledgerRow({ id: "one", startTime: "13:00" })
    ]);
    const second = (callId: string) => cell(line(html, callId), "therapist").match(/<button[^>]*aria-label="\d\d:00 콜 두 번째 Therapist 고르기"[^>]*>[\s\S]*?<\/button>/)?.[0] ?? "";
    assert.match(second("two-empty"), /미지명/);
    assert.equal(second("one"), "");
  });

  it("lets the entry and end times be corrected in place, and locks them in a locked month (1018 spec D11)", () => {
    const html = renderList([ledgerRow({ id: "ended", status: "CLEANING", actualEntryTime: "14:02", actualEndTime: "14:58" })]);
    assert.match(cell(line(html, "ended"), "entry"), /<button[^>]*aria-label="16:00 콜 실제입장 고치기"[^>]*>[\s\S]*?14:02/);
    assert.match(cell(line(html, "ended"), "end"), /<button[^>]*aria-label="16:00 콜 실제 종료 고치기"[^>]*>[\s\S]*?14:58/);
    const locked = renderList([ledgerRow({ id: "ended", status: "CLEANING", actualEntryTime: "14:02", actualEndTime: "14:58" })], { isLocked: true });
    assert.match(cell(line(locked, "ended"), "entry"), /<button[^>]*aria-label="16:00 콜 실제입장 고치기"[^>]*disabled=""/);
  });

  it("draws a now line between the calls and says how late a reservation is, only for today", () => {
    const html = renderList(rows, { clock: { today: "2026-06-10", time: "12:30" } });
    const order = ["reserved-12", "data-ledger-now", "in-use-13"].map((marker) => html.indexOf(marker));
    assert.ok(order.every((index) => index >= 0), String(order));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(html, /data-ledger-now=""[^>]*>[\s\S]*?지금 12:30/);
    assert.match(text(cell(line(html, "reserved-12"), "entry")), /30분 늦음/);
    assert.doesNotMatch(text(line(html, "reserved-15")), /늦음/);

    const otherDay = renderList(rows, { clock: { today: "2026-06-11", time: "12:30" } });
    assert.doesNotMatch(otherDay, /data-ledger-now|늦음/);
  });

  it("shows each line's status with the same symbol and color as the status counts above the list", () => {
    const html = renderList([
      ...rows,
      ledgerRow({ id: "cleaning-14", startTime: "14:00", status: "CLEANING" }),
      ledgerRow({ id: "no-show-10", startTime: "10:00", status: "NO_SHOW" })
    ]);
    assert.match(line(html, "in-use-13"), /bg-info text-info-foreground[^"]*"><svg[\s\S]*?<span[^>]*>사용중<\/span>/);
    assert.match(line(html, "cleaning-14"), /bg-warning text-warning-foreground[^"]*"><svg/);
    assert.match(line(html, "done-11"), /bg-success text-success-foreground[^"]*"><svg[\s\S]*?<span[^>]*>방문완료<\/span>/);
    assert.match(line(html, "no-show-10"), /bg-danger text-danger-foreground[^"]*"><svg/);
    assert.match(line(html, "reserved-12"), /border border-border-strong bg-surface text-foreground[^"]*"><span aria-hidden="true">○︎<\/span><span[^>]*>예약<\/span>/);
  });

  it("keeps a status it does not know as a plain ○ chip with its own name", () => {
    const html = renderList([ledgerRow({ id: "hold-15", startTime: "15:00", status: "ON_HOLD" })]);
    assert.doesNotMatch(cell(line(html, "hold-15"), "status"), /<svg[^>]*viewBox="0 0 24 24"/);
    assert.match(line(html, "hold-15"), /<span aria-hidden="true">○︎<\/span>ON_HOLD/);
  });

  it("fits the width: a list with no table, no minimum width and no sideways scroll box", () => {
    const html = renderList(rows);
    assert.doesNotMatch(html, /<table|min-width|overflow-x-auto/);
    assert.match(html, /<ol aria-label="콜 원장 목록"[^>]*data-call-ledger-list=""/);
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
    assert.match(line(html, "in-use-13"), /<button[^>]*disabled=""[^>]*>종료<\/button>/);
  });

  it("speaks Vietnamese", () => {
    const html = renderList(rows, { locale: "vi", clock: { today: "2026-06-10", time: "12:30" } });
    assert.match(html, /Hoàn tất · Hủy · Không đến 1 ca/);
    assert.match(line(html, "reserved-12"), />Vào phòng</);
    assert.match(line(html, "in-use-13"), />Kết thúc</);
    for (const part of ["Chưa vào", "Dự kiến 14:10", "Bây giờ 12:30", "Trễ 30 phút", "Chưa chỉ định", "Đã thanh toán", "Chưa xác nhận"]) {
      assert.ok(text(html).includes(part), part);
    }
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

// 2026-10-23 고객 요청(시안 123.png): 원장 표의 칸 순서는 예약시간 · 입장 · 종료 · 고객 정보 · 코스 · Therapist · 객실 · 상태 ·
// 할인 · 결제 · 조치이고, 머리 글자는 가운데 정렬·굵게다. 줄의 칸도 같은 순서라 Tab 순서와 칸 사이 세로줄이 머리와 맞는다.
describe("ledger column order (2026-10-23 customer mockup)", () => {
  const expectedOrder = ["time", "entry", "end", "who", "course", "therapist", "room", "status", "discount", "pay", "action"];

  it("lays out every line's cells in the requested order", () => {
    const html = renderList([ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE" })]);
    const order = [...line(html, "in-use-13").matchAll(/data-line-cell="([a-z]+)"/g)].map((match) => match[1]);
    assert.deepEqual(order, expectedOrder);
  });

  it("puts the head labels in the same order, centered and bold", () => {
    const html = renderList([ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE" })]);
    const head = html.match(/<div[^>]*data-ledger-head=""[^>]*>[\s\S]*?<\/div>/)?.[0] ?? "";
    assert.deepEqual(
      [...head.matchAll(/<span[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]),
      ["예약시간", "입장", "종료", "고객 정보", "코스", "Therapist", "객실", "상태", "할인", "결제", "조치"]
    );
    for (const span of head.match(/<span[^>]*>/g) ?? []) {
      assert.match(span, /text-center/);
      assert.match(span, /font-bold/);
    }
  });

  it("uses the same order in the one-line grid template", () => {
    const html = renderList([ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE" })]);
    // React가 클래스 안의 '를 &#x27;로 적는다.
    assert.match(line(html, "in-use-13"), /\[grid-template-areas:(?:'|&#x27;)time_entry_end_who_course_therapist_room_status_discount_pay_action(?:'|&#x27;)\]/);
  });
});

describe("phone width (ticket 26, 1018 ticket 02)", () => {
  const rows = [
    ledgerRow({ id: "reserved-12", startTime: "12:00", status: "RESERVED", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 1 }),
    ledgerRow({ id: "reserved-12b", startTime: "12:00", status: "RESERVED", customerMemo: "정 대표", partyId: "party-jung", partyPosition: 2 }),
    ledgerRow({ id: "in-use-13", startTime: "13:00", status: "IN_USE" })
  ];

  it("draws the same rows on a phone, with no separate card list", () => {
    const html = renderList(rows, { phoneWidth: true });
    assert.doesNotMatch(html, /원장 카드 목록/);
    assert.equal((html.match(/<ol/g) ?? []).length, 1);
    assert.match(line(html, "in-use-13"), /data-line-cell="time"[\s\S]*data-line-cell="who"/);
  });

  it("keeps the phone read-only: no entry, pay, cell lists or party buttons", () => {
    const phone = renderList(rows, { phoneWidth: true });
    // 줄에는 패널을 여는 시간 버튼만 남는다.
    assert.deepEqual(buttons(line(phone, "reserved-12")), ["12:00"]);
    assert.deepEqual(buttons(line(phone, "in-use-13")), ["13:00"]);
    assert.doesNotMatch(phone, /aria-haspopup="listbox"|일행 입장|일행 취소|1명 추가/);
    assert.match(phone, /정 대표 일행 2명/);
    assert.match(text(line(phone, "in-use-13")), /Therapist 1/);

    const wide = renderList(rows, { phoneWidth: false });
    assert.deepEqual(buttons(cell(line(wide, "in-use-13"), "action")), ["종료"]);
    assert.match(wide, /일행 입장/);
  });

  // 회귀(story-2-1): 콜이 없는 날짜의 빈 상태 문구는 한 번만 나온다. 휴대폰 폭에는 빠른 예약이 없어 안내도 뺀다.
  it("shows exactly one empty-day message, without the quick booking hint on a phone", () => {
    const count = (html: string) => (html.match(/이 날짜의 콜이 없습니다/g) ?? []).length;
    assert.equal(count(renderList([])), 1);
    assert.equal(count(renderList([], { phoneWidth: true })), 1);
    assert.equal(count(renderList([], { phoneWidth: false })), 1);
    assert.match(renderList([]), /빠른 예약으로 새 콜을 만든다/);
    assert.doesNotMatch(renderList([], { phoneWidth: true }), /빠른 예약으로 새 콜을 만든다/);
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
      onStatusChange: () => {},
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
      "bookerHandle",
      "therapist1Id",
      "therapist2Id",
      "actualEntryTime",
      "actualEndTime",
      "roomId",
      "status",
      "discountTypeCode",
      "note",
      "visitRequest",
      "confirmationCode"
    ]);
  });

  // 2026-10-23: 빠른 예약에서 적은 메신저 ID는 콜 상세에서 고친다(오타가 원장 고객 칸 둘째 줄에 그대로 남지 않게).
  it("lets the booker's ID or contact be corrected in the booking group for every booking channel", () => {
    const wechat = renderPanel(ledgerRow({ bookingChannelCode: "WECHAT", bookerName: "민수", bookerHandle: "minsu88" }));
    const booking = wechat.slice(wechat.indexOf('aria-label="예약"'), wechat.indexOf('aria-label="입장"'));
    assert.match(booking, /<input[^>]*data-call-field="bookerHandle"[^>]*value="minsu88"/);
    assert.match(booking, /예약자 ID \/ 연락처/);
    // 2026-10-23 고객 요청: 전화·워크인·경로 없음도 같은 칸이 있다(전화 예약은 번호를 적는다).
    for (const bookingChannelCode of ["TELEGRAM", "PHONE", "WALK_IN", null]) {
      assert.match(renderPanel(ledgerRow({ bookingChannelCode })), /data-call-field="bookerHandle"/, String(bookingChannelCode));
    }
  });

  // 1018 스펙 D12: 결제는 결제수단만 고르고 상태는 바꾸지 않는다. "결제 완료 → 방문완료" 버튼은 없다.
  it("chooses the payment method with pills, without a button that completes the visit", () => {
    const html = renderPanel(ledgerRow({ status: "IN_USE", paymentMethodCode: "CARD" }));
    const payment = html.slice(html.indexOf('data-panel-section="payment"'));
    assert.match(payment, /<input[^>]*data-payment-method="CARD"[^>]*type="radio"[^>]*checked=""/);
    assert.match(payment, /data-payment-method="CASH"/);
    assert.match(payment, />미선택</);
    assert.doesNotMatch(html, /결제 완료/);
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
    // 분 단위 시각 칸이다(스펙 D11). 10분 목록이 아니다.
    assert.match(entry, /type="time"/);
    assert.match(entry, /value="15:20"/);
    assert.match(renderPanel(ledgerRow({ actualEndTime: "16:47" })), /<input[^>]*data-call-field="actualEndTime"[^>]*type="time"[^>]*value="16:47"/);
    assert.match(renderPanel(ledgerRow({ warningTime: "16:00" }), { locale: "vi" }), /Có lịch lúc 4:00\./);
  });

  it("shows the six times of the call in the entry group, the next free time being the actual end once there is one", () => {
    const times = (html: string) => {
      const entry = html.slice(html.indexOf('aria-label="입장"'), html.indexOf('data-panel-section="payment"'));
      return [...entry.matchAll(/data-call-time="([^"]+)"[\s\S]*?<dd[^>]*>([\s\S]*?)<\/dd>/g)].map((match) => [match[1], text(match[2])]);
    };
    const row = ledgerRow({ startTime: "16:00", actualEntryTime: "16:10", displayEnd: "17:10", reservedEnd: "17:00", status: "IN_USE" });
    assert.deepEqual(times(renderPanel(row)), [
      ["booking", "16:00 · A 누루60"],
      ["actualEntry", "16:10"],
      ["reservedEnd", "17:00"],
      ["displayEnd", "17:10"],
      ["actualEnd", "-"],
      ["nextFree", "17:10"]
    ]);
    const ended = times(renderPanel({ ...row, actualEndTime: "16:50", status: "CLEANING" }));
    assert.deepEqual(ended.slice(4), [
      ["actualEnd", "16:50"],
      ["nextFree", "16:50"]
    ]);
    assert.match(renderPanel(row), /예약 기준 예상 종료/);
    assert.match(renderPanel(row, { locale: "vi" }), /Giờ rảnh tiếp theo/);
    // 휴대폰 폭의 읽기 전용 패널도 같은 시각을 보인다.
    assert.match(renderPanel(row, { readOnly: true }), /data-call-time="nextFree"/);
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

  it("locks every field in a locked month", () => {
    const html = renderPanel(ledgerRow({ status: "IN_USE" }), { isLocked: true });
    const fields = [...html.matchAll(/<input[^>]*data-call-field="[^"]+"[^>]*>/g)].map((match) => match[0]);
    assert.ok(fields.length > 0 && fields.every((field) => /disabled=""/.test(field)));
  });

  it("only reads at phone width: no input at all", () => {
    const html = renderPanel(ledgerRow(), { readOnly: true });
    assert.doesNotMatch(html, /<input|<select|<textarea/);
    assert.match(html, /고객 화면으로 이동/);
  });

  it("speaks Vietnamese", () => {
    const html = renderPanel(ledgerRow({ warnings: [unfinished] }), { locale: "vi" });
    for (const text of ["Đặt lịch", "Vào phòng", "Thanh toán", "Ghi chú", "Xem thêm", "Dịch vụ trước vẫn chưa kết thúc"]) {
      assert.ok(html.includes(text), text);
    }
  });
});
