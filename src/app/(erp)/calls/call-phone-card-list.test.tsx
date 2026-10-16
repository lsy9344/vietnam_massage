import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CallPhoneCardList } from "@/app/(erp)/calls/call-phone-card-list";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

// 티켓 26: 휴대폰 폭 원장 카드 목록(명세 F08). 표를 축소해 보여 주는 게 아니라, 예약시각·객실·코스·
// Therapist·상태·첫 경고만 보여 주는 읽기 전용의 다른 렌더다. 서비스가 돌려준 값은 바뀌지 않으므로
// 여기서는 화면이 그 값 중 무엇을 보여 주는지만 본다.

const options: ServiceCallFormOptions = {
  rooms: [{ value: "room-101", label: "101 호실" }],
  timeSlots: [{ value: "16:00", label: "16:00" }],
  courses: [{ value: "course-a", label: "A 누루60" }],
  statuses: [{ value: "예약", label: "예약" }],
  discountTypes: [{ value: "birthday", label: "생일자" }],
  paymentMethods: [{ value: "card", label: "카드" }],
  confirmationCodes: [{ value: "Y", label: "Y" }],
  therapists: [{ value: "therapist-1", label: "Therapist 1" }],
  expenseHandlers: []
};

const baseRow: ServiceCallRowDto = {
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
  customerMemo: "010-1234-5678 지윤",
  therapist1: { id: "therapist-1", displayName: "Therapist 1", staffCode: "THR-001" },
  therapist2: null,
  status: "예약",
  discountTypeCode: null,
  paymentMethodCode: null,
  note: null,
  visitRequest: null,
  confirmationCode: null,
  basePrice: 500_000,
  paymentAmount: 500_000,
  discountAmount: 0,
  therapist1Commission: 100_000,
  therapist2Commission: 0,
  calculationStatus: "calculated",
  calculationErrorCode: null,
  calculationErrorMessage: null,
  createdAt: "2026-06-10T06:00:00.000Z",
  updatedAt: "2026-06-10T07:28:00.000Z",
  savedAt: "2026-06-10T07:28:00.000Z"
};

function render(
  rows: ServiceCallRowDto[],
  selectedCallId: string | null = null,
  locale: "ko" | "vi" = "ko",
  isPhoneWidth = true
) {
  return renderToStaticMarkup(
    createElement(LocaleProvider, {
      locale,
      // eslint-disable-next-line react/no-children-prop
      children: createElement(CallPhoneCardList, {
        isPhoneWidth,
        onOpenDetail: () => {},
        options,
        rows,
        selectedCallId
      })
    })
  );
}

describe("CallPhoneCardList (ticket 26)", () => {
  it("카드에 예약시각·객실·코스·Therapist·상태를 보여 준다", () => {
    const html = render([baseRow]);
    assert.match(html, /16:00/);
    assert.match(html, /101 호실/);
    assert.match(html, /A 누루60/);
    assert.match(html, /Therapist 1/);
    assert.match(html, /예약/);
  });

  it("경고가 있으면 우선순위 첫 항목만 보인다", () => {
    const row: ServiceCallRowDto = {
      ...baseRow,
      warnings: [
        { code: "room_overlap", relatedTime: "16:30", relatedCallIds: ["call-2"] },
        { code: "calculation_error", relatedTime: null, relatedCallIds: [] }
      ]
    };
    const html = render([row]);
    assert.match(html, /이 객실에 16:30 콜이 있습니다/);
    assert.doesNotMatch(html, /계산 오류/);
  });

  it("경고가 없으면 경고 칩이 없다", () => {
    const html = render([baseRow]);
    assert.doesNotMatch(html, /text-warning/);
  });

  it("고객 연락처나 금액을 새로 보여 주지 않는다", () => {
    const html = render([baseRow]);
    assert.doesNotMatch(html, /010-1234-5678/);
    assert.doesNotMatch(html, /500,000/);
    assert.doesNotMatch(html, /100,000/);
  });

  it("콜이 없으면 빈 상태 문구를 보여 준다", () => {
    const html = render([]);
    assert.match(html, /이 날짜의 콜이 없습니다/);
  });

  // 회귀(story-2-1): 태블릿 이상 폭에서는 editable-call-grid.tsx의 표 쪽이 이미 같은 빈 상태 문구를
  // 보여 준다. CSS(min-[600px]:hidden)로만 숨기면 두 문구가 함께 DOM에 남아 "이 날짜의 콜이 없습니다"를
  // 찾는 검사가 strict-mode 위반으로 깨진다. 태블릿 이상에서는 이 컴포넌트가 아예 아무것도 그리지 않는다.
  it("태블릿 이상 폭에서는 콜이 없어도 아무것도 그리지 않는다(표 쪽 문구와 중복 방지)", () => {
    const html = render([], null, "ko", false);
    assert.equal(html, "");
  });

  it("베트남어로도 아리아 라벨과 빈 상태 문구가 있다", () => {
    const html = render([baseRow], null, "vi");
    assert.match(html, /aria-label="Danh sách thẻ sổ cuộc gọi"/);

    const empty = render([], null, "vi");
    assert.match(empty, /Không có cuộc gọi nào trong ngày này/);
  });

  it("카드를 누르면 상세를 열고, 닫으면 포커스를 돌려줄 수 있게 콜 id를 들고 있다", () => {
    const html = render([baseRow], "call-1");
    assert.match(html, /data-call-open="call-1"/);
    assert.match(html, /data-service-call-id="call-1"/);
    assert.match(html, /data-selected="true"/);
  });
});
