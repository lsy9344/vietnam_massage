import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { LocaleProvider } from "@/lib/i18n/client";
import type { ServiceCallFormOptions, ServiceCallRowDto } from "@/modules/calls/service-call-service";

// 티켓 26: 휴대폰 폭(600px 미만)에서는 넓은 표 대신 짧은 카드 목록을 보여 준다(명세 F08). 둘 다 같은
// 렌더에 있고 CSS로만 서로 숨기므로(min-[600px] 기준), 여기서는 그 두 블록이 올바른 쪽에 있는지와
// 표·새 행 직접 입력(표 편집)이 "태블릿 이상에서만" 블록 안에 있는지를 본다.

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
  calculationStatus: "not_completed",
  calculationErrorCode: null,
  calculationErrorMessage: null,
  createdAt: "2026-06-10T06:00:00.000Z",
  updatedAt: "2026-06-10T07:28:00.000Z",
  savedAt: "2026-06-10T07:28:00.000Z"
};

function render(rows: ServiceCallRowDto[]) {
  return renderToStaticMarkup(
    createElement(LocaleProvider, {
      locale: "ko",
      // eslint-disable-next-line react/no-children-prop
      children: createElement(EditableCallGrid, {
        isLocked: false,
        operatingMonthId: "month-2026-06",
        options,
        rows,
        serviceDate: "2026-06-10",
        showSettlementColumns: false
      })
    })
  );
}

/** "hidden min-[600px]:block"(태블릿 이상에서만)으로 감싼 블록의 markup만 잘라낸다. */
function tabletUpBlock(html: string) {
  const start = html.indexOf('class="hidden min-[600px]:block"');
  const openTagStart = html.lastIndexOf("<div", start);
  return html.slice(openTagStart);
}

// call-row-warnings.test.tsx의 같은 이름 헬퍼와 같은 방식. usePhoneWidth()의 초기 useState는 렌더 중에
// window.matchMedia를 읽는다(effect 없이도 SSR에서 바로 반영된다), 그래서 전역 window를 흉내 내면 실제
// 폭을 바꾼 것과 같은 결과를 renderToStaticMarkup로 볼 수 있다.
function withWindowWidth(minWidth600Matches: boolean, run: () => string) {
  const original = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    matchMedia: () => ({
      matches: minWidth600Matches,
      addEventListener: () => {},
      removeEventListener: () => {}
    })
  };
  try {
    return run();
  } finally {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  }
}

describe("phone card list vs. wide table (ticket 26)", () => {
  it("넓은 표와 새 행 직접 입력(표 편집)은 태블릿 이상에서만 보이는 블록 안에 있다", () => {
    const html = render([row]);
    const tabletUp = tabletUpBlock(html);
    assert.match(tabletUp, /<table/, "표가 태블릿 이상 블록 밖에 있다");
    assert.match(tabletUp, /새 콜 행 추가/, "새 행 추가(표 편집)가 태블릿 이상 블록 밖에 있다");
  });

  it("휴대폰 카드 목록은 표와 별도로 항상 렌더되고(CSS로만 숨김) 같은 콜 요약을 보인다", () => {
    const html = render([row]);
    assert.match(html, /min-\[600px\]:hidden/, "카드 목록을 숨기는 휴대폰-전용 래퍼가 없다");
    assert.match(html, /aria-label="원장 카드 목록"/);
    // 카드는 101 호실 · A 누루60을 보이고, 표(td)보다 앞서 나온다(문서 순서상 카드 블록이 먼저다).
    const cardIndex = html.indexOf("101 호실 · A 누루60");
    const tableIndex = html.indexOf("<table");
    assert.ok(cardIndex > -1, "카드에 객실·코스 요약이 없다");
    assert.ok(cardIndex < tableIndex, "카드 목록이 표보다 뒤에 있다");
  });

  // 회귀(story-2-1): 카드 목록과 표가 둘 다 같은 빈 상태 문구를 그리고 CSS로만 서로 숨기면, 콜이 없는
  // 날짜에는 "이 날짜의 콜이 없습니다"가 DOM에 두 번 남아 그 문구를 찾는 Playwright strict-mode 검사가
  // 깨진다. usePhoneWidth()로 실제 폭에 맞는 한쪽만 그리도록 고쳐, 폭마다 문구가 정확히 하나여야 한다.
  it("콜이 없는 날짜에는 폭에 맞는 빈 상태 문구가 정확히 하나만 있다", () => {
    const countEmptyMatches = (html: string) => (html.match(/이 날짜의 콜이 없습니다/g) ?? []).length;

    // window가 없는 SSR 그대로(이 파일의 다른 테스트처럼 stub 없음)는 "휴대폰 아님"으로 본다.
    assert.equal(countEmptyMatches(render([])), 1, "window가 없으면 표 쪽 문구만 하나 있어야 한다");

    assert.equal(
      countEmptyMatches(withWindowWidth(false, () => render([]))),
      1,
      "휴대폰 폭에서는 카드 쪽 문구만 하나 있어야 한다"
    );

    assert.equal(
      countEmptyMatches(withWindowWidth(true, () => render([]))),
      1,
      "태블릿 이상 폭에서는 표 쪽 문구만 하나 있어야 한다"
    );
  });
});
