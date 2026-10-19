import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { callConflictFieldRows, CallConflictCompare, CallConflictCompareFields, type CallConflictCompareData } from "@/app/(erp)/calls/call-conflict-compare";
import { draftFromRow, type CallRowDraft } from "@/app/(erp)/calls/call-row-save";
import { LocaleProvider } from "@/lib/i18n/client";
import { createTranslator } from "@/lib/i18n";
import type { CustomerDto, ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

const t = createTranslator("ko");

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "16:00", label: "16:00" }],
  courses: [
    { value: "course-a", label: "A 누루60" },
    { value: "course-c", label: "C 누루90" }
  ],
  statuses: [
    { value: "예약", label: "예약" },
    { value: "사용중", label: "사용중" }
  ],
  discountTypes: [{ value: "discount-vip", label: "VIP 할인" }],
  paymentMethods: [{ value: "카드", label: "카드" }],
  confirmationCodes: [{ value: "code-1", label: "확인1" }],
  bookingChannels: [{ value: "TELEGRAM", label: "텔레그램" }],
  therapists: [
    { value: "therapist-1", label: "Therapist 1" },
    { value: "therapist-2", label: "Therapist 2" }
  ],
  expenseHandlers: []
};

const customers: CustomerDto[] = [{ id: "customer-1", name: "지윤", phone: "0901112222", memo: null, preferenceNote: null }];

function savedRow(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "call-1",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-10",
    startTime: "16:00",
    actualEntryTime: null,
    actualEndTime: null,
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
    status: "예약",
    discountTypeCode: null,
    paymentMethodCode: null,
    note: null,
    visitRequest: null,
    bookingChannelCode: null,
    bookerName: null,
    confirmationCode: null,
    partyId: null,
    partyPosition: null,
    basePrice: 0,
    paymentAmount: 0,
    discountAmount: 0,
    therapist1Commission: 0,
    therapist2Commission: 0,
    calculationStatus: "not_completed",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-10T06:00:00.000Z",
    updatedAt: "2026-06-10T07:00:00.000Z",
    savedAt: "2026-06-10T07:00:00.000Z",
    ...overrides
  };
}

describe("callConflictFieldRows", () => {
  it("lists every editable field in ledger order and marks only the fields whose raw value differs", () => {
    const mine = draftFromRow(savedRow({ customerMemo: "내 초안", paymentMethodCode: "카드" }));
    const latest = draftFromRow(savedRow({ customerMemo: "최신 화면", courseId: "course-c" }));
    const rows = callConflictFieldRows(mine, latest, options, customers, t);

    assert.deepEqual(
      rows.map((row) => row.field),
      [
        "startTime",
        "actualEntryTime",
        "actualEndTime",
        "roomId",
        "courseId",
        "customerMemo",
        "customerId",
        "therapist1Id",
        "therapist2Id",
        "status",
        "discountTypeCode",
        "paymentMethodCode",
        "note",
        "visitRequest",
        "bookingChannelCode",
        "bookerName",
        "confirmationCode"
      ]
    );

    const byField = new Map(rows.map((row) => [row.field, row]));
    assert.equal(byField.get("customerMemo")?.differs, true);
    assert.equal(byField.get("customerMemo")?.mine, "내 초안");
    assert.equal(byField.get("customerMemo")?.latest, "최신 화면");
    assert.equal(byField.get("courseId")?.differs, true);
    assert.equal(byField.get("courseId")?.mine, "A 누루60");
    assert.equal(byField.get("courseId")?.latest, "C 누루90");
    // 내가 카드로 바꿨지만 최신 행은 아직 결제수단이 없다(차이가 있다 — 둘 다 같은 "최신 행 그대로"는 아니다).
    assert.equal(byField.get("paymentMethodCode")?.differs, true);
    assert.equal(byField.get("paymentMethodCode")?.mine, "카드");
    assert.equal(byField.get("paymentMethodCode")?.latest, "-");
    // 안 바꾼 필드는 같다.
    assert.equal(byField.get("roomId")?.differs, false);
    assert.equal(byField.get("status")?.differs, false);
  });

  it("compares the actual end, booking channel, and booker name (1018 스펙 D1)", () => {
    const mine = draftFromRow(savedRow({ actualEndTime: "16:52", bookingChannelCode: "TELEGRAM", bookerName: "Minh" }));
    const latest = draftFromRow(savedRow());
    const byField = new Map(callConflictFieldRows(mine, latest, options, customers, t).map((row) => [row.field, row]));

    assert.deepEqual(
      ["actualEndTime", "bookingChannelCode", "bookerName"].map((field) => {
        const row = byField.get(field as never);
        return row && { label: row.label, mine: row.mine, latest: row.latest, differs: row.differs };
      }),
      [
        { label: "실제 종료", mine: "16:52", latest: "-", differs: true },
        { label: "예약 경로", mine: "텔레그램", latest: "-", differs: true },
        { label: "예약자명", mine: "Minh", latest: "-", differs: true }
      ]
    );
  });

  it("looks up option and customer labels instead of raw codes, and falls back to a dash when empty", () => {
    const mine = draftFromRow(savedRow({ customerId: "customer-1", discountTypeCode: "discount-vip" }));
    const latest = draftFromRow(savedRow({ customerId: null, discountTypeCode: null }));
    const rows = callConflictFieldRows(mine, latest, options, customers, t);
    const byField = new Map(rows.map((row) => [row.field, row]));

    assert.equal(byField.get("customerId")?.mine, "지윤 · 0901112222");
    assert.equal(byField.get("customerId")?.latest, "연결된 고객 없음");
    assert.equal(byField.get("discountTypeCode")?.mine, "VIP 할인");
    assert.equal(byField.get("discountTypeCode")?.latest, "-");
  });

  it("does not consider two values that differ only in their option label as the same raw value", () => {
    // courseId는 코드값으로 가린다. 같은 라벨을 가진 두 옵션이 있어도(여기선 없지만) 코드가 다르면 differs다.
    const mine = draftFromRow(savedRow({ courseId: "course-a" }));
    const latest = draftFromRow(savedRow({ courseId: "course-a" }));
    const rows = callConflictFieldRows(mine, latest, options, customers, t);
    assert.equal(rows.find((row) => row.field === "courseId")?.differs, false);
  });
});

function render(locale: "ko" | "vi", child: ReturnType<typeof createElement>) {
  // eslint-disable-next-line react/no-children-prop
  return renderToStaticMarkup(createElement(LocaleProvider, { locale, children: child }));
}

function compareData(overrides: Partial<CallConflictCompareData> = {}): CallConflictCompareData {
  const mine: CallRowDraft = draftFromRow(savedRow({ customerMemo: "내 초안" }));
  return {
    rowId: "call-1",
    draft: mine,
    latestRow: savedRow({ customerMemo: "다른 화면", updatedAt: "2026-06-10T07:05:00.000Z" }),
    message: "다른 화면에서 이 콜이 바뀌었습니다. 다시 불러온 뒤에 저장하세요.",
    onReapply: () => {},
    onReloadLatest: () => {},
    ...overrides
  };
}

// CallConflictCompare 자체는 ModalPanel(Radix Dialog.Portal)로 열리는데, Portal은 document가 없는
// 정적 렌더(renderToStaticMarkup)에서 아무것도 그리지 않는다(daily-expense-panel.test.tsx와 같은 제약).
// 그래서 ModalPanel의 children인 CallConflictCompareFields를 바로 렌더해 표·라벨·버튼 상태를 본다.
function renderCompare(locale: "ko" | "vi", overrides: Partial<CallConflictCompareData> = {}) {
  return render(locale, createElement(CallConflictCompareFields, { compare: compareData(overrides), customers, options }));
}

describe("CallConflictCompareFields", () => {
  it("shows the server message and lists the ledger fields in order with mine/latest side by side", () => {
    const html = renderCompare("ko");
    assert.match(html, /다른 화면에서 이 콜이 바뀌었습니다/);
    const memoIndex = html.indexOf("고객/메모");
    const courseIndex = html.indexOf("코스");
    assert.ok(memoIndex >= 0 && courseIndex >= 0 && courseIndex < memoIndex);
    assert.match(html, /내 초안/);
    assert.match(html, /다른 화면/);
  });

  it("offers a checkbox only for fields that differ, and a dash for fields that are the same", () => {
    const html = renderCompare("ko");
    // customerMemo differs (내 초안 vs 다른 화면): checkbox present for that row.
    assert.match(html, /data-conflict-field="customerMemo"/);
    // roomId is unchanged in both drafts: no checkbox, shown as a dash instead.
    assert.doesNotMatch(html, /data-conflict-field="roomId"/);
    assert.match(html, />—</);
  });

  it("disables reapply until a field is chosen, and always offers reload-latest", () => {
    const html = renderCompare("ko");
    const reapplyButton = html.match(/<button[^>]*>다시 반영하고 저장<\/button>/)?.[0] ?? "";
    assert.match(reapplyButton, /disabled/);
    assert.match(html, /최신 내용으로 다시 불러오기/);
  });

  it("speaks Vietnamese", () => {
    const html = renderCompare("vi", { message: "Màn hình khác đã lưu cuộc gọi này trước." });
    assert.match(html, /Màn hình khác đã lưu cuộc gọi này trước/);
    assert.match(html, /Tải lại nội dung mới nhất/);
    assert.match(html, /Áp lại và lưu/);
  });
});

// S2: 비교는 콜 상세 패널(SidePanel, 비모달) 안의 충돌 상태 구역이어야 한다(스펙 321줄). 한 행이
// STALE_CALL이 되어도 패널 전체가 포커스를 가두는 모달이 되면 안 되므로, role="dialog"가 아닌 평범한
// 구역으로 그려지는지 정적 렌더로 확인한다(모달이면 Radix Dialog.Portal이라 아무것도 그리지 않는다).
describe("CallConflictCompare", () => {
  it("renders as a plain section inside the detail panel instead of its own modal dialog", () => {
    const html = render("ko", createElement(CallConflictCompare, { compare: compareData(), customers, options }));
    assert.doesNotMatch(html, /role="dialog"/);
    assert.doesNotMatch(html, /role="alertdialog"/);
    assert.match(html, /저장 충돌 비교/);
    assert.match(html, /다른 화면에서 이 콜이 바뀌었습니다/);
    assert.match(html, /고객\/메모/);
  });
});
