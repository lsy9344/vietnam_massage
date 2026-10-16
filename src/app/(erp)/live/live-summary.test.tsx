import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { LiveSummaryCards, LiveSummaryDetails } from "@/app/(erp)/live/live-summary";
import type { DailyCallLedgerSummaryDto } from "@/modules/calls/service-call-service";

const zeroTill = { cashReceipts: 0, cashExpenses: 0, cashBalance: 0, bankReceipts: 0, bankExpenses: 0, bankBalance: 0 };

function summary(overrides: Partial<DailyCallLedgerSummaryDto> = {}): DailyCallLedgerSummaryDto {
  return {
    reservationCount: 8,
    inUseCount: 3,
    cleaningCount: 1,
    completedCount: 2,
    noShowCount: 1,
    canceledCount: 0,
    paymentTotal: 2900000,
    therapistCommissionTotal: 700000,
    discountTotal: 100000,
    expenseTotal: 50000,
    netSales: 2850000,
    paymentMethodTotals: { cash: 1500000, card: 1000000, bank: 400000, other: 0 },
    till: { day: { ...zeroTill, cashBalance: 1450000 }, month: { ...zeroTill, cashBalance: 8700000 } },
    courseSummaries: [
      { courseCode: "A", completedCount: 1, discountCount: 1, therapistAssignmentCount: 1 },
      { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "D", completedCount: 1, discountCount: 0, therapistAssignmentCount: 2 }
    ],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    ...overrides
  };
}

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function region(html: string, label: string) {
  const start = html.indexOf(`aria-label="${label}"`);
  assert.notEqual(start, -1, `region ${label}`);
  const open = html.lastIndexOf("<", start);
  const tag = html.slice(open + 1, html.indexOf(" ", open));
  return html.slice(open, html.indexOf(`</${tag}>`, start) + tag.length + 3);
}

describe("실시간 요약", () => {
  it("puts four pastel cards on top: call counts in mint, payment total and net sales in lavender, as the service gave them", () => {
    const html = renderToStaticMarkup(<LiveSummaryCards locale="ko" summary={summary()} />);
    const cards = region(html, "오늘 KPI");

    assert.equal(text(cards), "예약건수 8건 사용중 3건 결제합계 2,900,000 VND 순매출 2,850,000 VND");
    assert.deepEqual(
      [...cards.matchAll(/class="[^"]*bg-accent-(\w+)[^"]*"/g)].map((match) => match[1]),
      ["mint", "mint", "lavender", "lavender"]
    );
    // 실시간에는 현금·계좌 잔액을 두지 않는다(그건 하루 수납·지출 탭이다).
    assert.doesNotMatch(html, /잔액|bg-accent-blue/);
    // 계산에서 빠진 콜이 없으면 경고도 없다.
    assert.doesNotMatch(html, /계산 경고/);
  });

  it("warns right under the cards when calls were left out of the amounts", () => {
    const html = renderToStaticMarkup(
      <LiveSummaryCards locale="ko" summary={summary({ warningCounts: { coursePolicyMissing: 1, therapistRateMissing: 2, secondTherapistRequired: 0 } })} />
    );

    assert.match(html, /bg-warning-soft[^>]*><span aria-hidden="true">▲[^<]*<\/span>계산 경고 3건/);
    assert.match(text(html), /정책 누락 1건, 수당 누락 2건, 마사지사2 필요 0건은 금액\/코스별 집계에서 제외됐다\./);
  });

  it("lists the rest below the room board: every status count, payment method totals and completed visits per course", () => {
    const html = renderToStaticMarkup(<LiveSummaryDetails locale="ko" summary={summary()} />);

    assert.equal(text(region(html, "오늘 상태 요약")), "오늘 상태 요약 예약건수 8건 사용중 3건 청소중 1건 방문완료 2건 노쇼 1건 취소 0건");
    assert.equal(text(region(html, "결제수단별 집계")), "결제수단별 집계 현금 1,500,000 VND 카드 1,000,000 VND 계좌 400,000 VND 기타 0 VND");
    assert.equal(text(region(html, "코스별 방문완료")), "코스별 방문완료 A 1건 C 0건 D 1건");
    // 상태는 글자와 기호, 색을 함께 쓴다.
    assert.match(region(html, "오늘 상태 요약"), /bg-success-soft[^>]*><span aria-hidden="true">●[^<]*<\/span>방문완료/);
  });

  it("speaks Vietnamese", () => {
    const cards = renderToStaticMarkup(<LiveSummaryCards locale="vi" summary={summary()} />);
    assert.match(text(cards), /^Số lượt đặt trước 8ca Đang sử dụng 3ca Tổng thanh toán 2\.900\.000 VND/);

    const details = renderToStaticMarkup(<LiveSummaryDetails locale="vi" summary={summary()} />);
    assert.match(details, /aria-label="Tổng hợp theo phương thức thanh toán"/);
  });
});
