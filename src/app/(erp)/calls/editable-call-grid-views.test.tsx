import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

// 티켓 19: 원장 보기(예약·현장/수납·정산/전체)가 보여 주는 열 묶음과 그 순서를 확인한다.
// 서비스가 돌려준 값은 바뀌지 않으므로, 여기서는 화면이 어떤 열을 그리는지만 본다(명세의 테스트 경계).

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "16:00", label: "16:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [{ value: "예약", label: "예약" }],
  discountTypes: [{ value: "birthday", label: "생일자" }],
  paymentMethods: [{ value: "card", label: "카드" }],
  confirmationCodes: [{ value: "Y", label: "Y" }],
  therapists: [{ value: "therapist-1", label: "Therapist 1" }],
  earcareEmployees: [],
  expenseHandlers: []
};

const row: ServiceCallRowDto = {
  id: "call-1",
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
  visitRequest: null,
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
  createdAt: "2026-06-10T06:00:00.000Z",
  updatedAt: "2026-06-10T07:28:00.000Z",
  savedAt: "2026-06-10T07:28:00.000Z"
};

function render(props: Partial<Parameters<typeof EditableCallGrid>[0]>) {
  const markup = renderToStaticMarkup(
    createElement(LocaleProvider, {
      locale: "ko",
      // eslint-disable-next-line react/no-children-prop
      children: createElement(EditableCallGrid, {
        isLocked: false,
        operatingMonthId: "month-2026-06",
        options,
        rows: [row],
        serviceDate: "2026-06-10",
        showSettlementColumns: false,
        ...props
      })
    })
  );
  return markup;
}

/**
 * 저장된 행(표의 둘째 tbody가 아니라 첫 tbody) 한 줄의 markup만 잘라낸다. 티켓 26부터는 같은
 * `data-service-call-id`를 휴대폰 카드 목록도 들고 있어(CSS로만 서로 숨긴다), `<tr` 태그 안의
 * 것인지까지 확인한다(call-row-warnings.test.tsx의 dataRow와 같은 방식).
 */
function dataRow(html: string) {
  return html.match(/<tr[^>]*data-service-call-id="call-1"[\s\S]*?<\/tr>/)?.[0] ?? "";
}

/** 표 머리(<thead>) 한 줄의 markup만 잘라낸다. 열 라벨은 각 행이 아니라 머리에만 있다. */
function tableHead(html: string) {
  const start = html.indexOf("<thead");
  const end = html.indexOf("</thead>") + "</thead>".length;
  return html.slice(start, end);
}

function columnOrder(html: string, columns: string[]) {
  return columns.map((column) => html.indexOf(`data-call-cell-column="${column}"`));
}

describe("ledger view column grouping (ticket 19)", () => {
  it("booking view shows the on-site columns and hides the settlement ones", () => {
    const html = render({ view: "booking" });
    const head = tableHead(html);
    const row = dataRow(html);

    for (const label of ["시간", "실제입장", "객실", "고객/메모", "코스", "마사지사1", "마사지사2", "귀케어 담당", "저장상태"]) {
      assert.match(head, new RegExp(label), `${label}이 예약·현장 보기에 없다`);
    }
    for (const field of ["discountTypeCode", "paymentMethodCode", "note", "visitRequest", "confirmationCode", "customerId"]) {
      assert.doesNotMatch(row, new RegExp(`data-call-cell-column="${field}"`), `${field}은 예약·현장 보기에 없어야 한다`);
    }

    // 고정 열(예약시각, 고객/메모, 상태)이 앞쪽에 있고, 그 뒤로 보기 전용 열이 이어진다.
    const order = columnOrder(row, ["startTime", "customerMemo", "status", "actualEntryTime", "roomId", "courseId"]);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "열 순서가 고정열 다음 보기 열 순서를 따르지 않는다");
  });

  it("settlement view shows the payment columns and hides the on-site ones", () => {
    const html = render({ view: "settlement" });
    const head = tableHead(html);
    const row = dataRow(html);

    for (const label of ["시간", "고객/메모", "결제수단", "결제금액", "확인값", "비고", "방문별 요청"]) {
      assert.match(head, new RegExp(label), `${label}이 수납·정산 보기에 없다`);
    }
    for (const field of ["actualEntryTime", "roomId", "courseId", "therapist1Id", "therapist2Id", "earcareEmployeeId", "customerId"]) {
      assert.doesNotMatch(row, new RegExp(`data-call-cell-column="${field}"`), `${field}은 수납·정산 보기에 없어야 한다`);
    }
    assert.doesNotMatch(row, /data-call-cell-column="warnings"/, "경고 열은 수납·정산 보기에 없어야 한다");

    const order = columnOrder(row, [
      "startTime",
      "customerMemo",
      "status",
      "discountTypeCode",
      "paymentMethodCode",
      "confirmationCode",
      "note",
      "visitRequest"
    ]);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), "열 순서가 고정열 다음 보기 열 순서를 따르지 않는다");
  });

  it("all view keeps every column, unaffected by the new view switch (existing behavior)", () => {
    const html = render({ view: "all" });
    const row = dataRow(html);

    for (const field of [
      "startTime",
      "actualEntryTime",
      "roomId",
      "courseId",
      "customerMemo",
      "customerId",
      "therapist1Id",
      "therapist2Id",
      "earcareEmployeeId",
      "status",
      "discountTypeCode",
      "paymentMethodCode",
      "note",
      "visitRequest",
      "confirmationCode"
    ]) {
      assert.match(row, new RegExp(`data-call-cell-column="${field}"`), `${field}은 전체 보기에 있어야 한다`);
    }
    assert.match(row, /data-call-cell-column="warnings"/);
  });

  it("defaults to the all view when no view prop is given (keeps the pre-existing behavior)", () => {
    const withDefault = dataRow(render({}));
    const withAll = dataRow(render({ view: "all" }));
    assert.equal(withDefault, withAll);
  });

  it("hides commission columns in the settlement view for roles without settlement access, same as other views", () => {
    const html = render({ view: "settlement", showSettlementColumns: false });
    assert.doesNotMatch(dataRow(html), /data-call-cell-column="therapist1Commission"/);

    const withAccess = render({ view: "settlement", showSettlementColumns: true });
    assert.match(dataRow(withAccess), /data-call-cell-column="therapist1Commission"/);
  });

  it("the add-row form only offers the columns visible in the current view, and none in the settlement view", () => {
    const booking = render({ view: "booking" });
    assert.match(booking, /새 콜 행 추가/);
    assert.doesNotMatch(booking, /name="discountTypeCode"/);
    assert.doesNotMatch(booking, /name="confirmationCode"/);

    const settlement = render({ view: "settlement" });
    assert.doesNotMatch(settlement, /새 콜 행 추가/);
    assert.match(settlement, /예약·현장이나 전체 보기에서 추가하세요/);
  });
});
