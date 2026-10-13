import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import type { DailyCallLedgerSummaryDto, TillBalanceDto } from "@/modules/calls/service-call-service";

function zeroTill(): TillBalanceDto {
  return {
    cashReceipts: 0,
    cashExpenses: 0,
    cashBalance: 0,
    bankReceipts: 0,
    bankExpenses: 0,
    bankBalance: 0
  };
}

function summary(overrides: Partial<DailyCallLedgerSummaryDto> = {}): DailyCallLedgerSummaryDto {
  return {
    reservationCount: 5,
    inUseCount: 1,
    cleaningCount: 1,
    completedCount: 2,
    noShowCount: 1,
    canceledCount: 1,
    paymentTotal: 2900000,
    therapistCommissionTotal: 700000,
    earcarePoolTotal: 100000,
    discountTotal: 100000,
    expenseTotal: 50000,
    netSales: 2850000,
    paymentMethodTotals: { cash: 1500000, card: 1000000, bank: 400000, other: 0 },
    till: { day: zeroTill(), month: zeroTill() },
    courseSummaries: [
      { courseCode: "A", completedCount: 1, discountCount: 1, therapistAssignmentCount: 1 },
      { courseCode: "B", completedCount: 1, discountCount: 0, therapistAssignmentCount: 2 },
      { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "D", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "E", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }
    ],
    warningCounts: { coursePolicyMissing: 1, therapistRateMissing: 1, secondTherapistRequired: 1 },
    ...overrides
  };
}

// 시재 표의 한 줄(현금 또는 계좌)에서 조회일 수납·지출·잔액, 이번 달 수납·지출·잔액 칸을 차례로 꺼낸다.
function tillRow(html: string, label: string) {
  const row = html.match(new RegExp(`<tr><th[^>]*scope="row">${label}</th>(.*?)</tr>`))?.[1] ?? "";
  return [...row.matchAll(/<td class="([^"]*)">([^<]*)<\/td>/g)].map(([, className, text]) => ({ className, text }));
}

describe("DailySummaryStrip", () => {
  it("keeps no-show and canceled counts as separate status summary items", () => {
    const html = renderToStaticMarkup(<DailySummaryStrip summary={summary()} showSettlementAmounts={false} locale="ko" />);

    assert.match(html, /노쇼/);
    assert.match(html, /취소/);
    assert.doesNotMatch(html, /노쇼\/취소/);
  });

  it("hides settlement-only warning wording from non-settlement call ledger users", () => {
    const html = renderToStaticMarkup(<DailySummaryStrip summary={summary()} showSettlementAmounts={false} locale="ko" />);

    assert.doesNotMatch(html, /수당 누락/);
    assert.doesNotMatch(html, /마사지사2 필요/);
  });

  it("shows settlement warning details to settlement amount viewers", () => {
    const html = renderToStaticMarkup(<DailySummaryStrip summary={summary()} showSettlementAmounts locale="ko" />);

    assert.match(html, /수당 누락 1건/);
    assert.match(html, /마사지사2 필요 1건/);
  });

  it("shows payment method totals for cash, card, bank, and other buckets", () => {
    const html = renderToStaticMarkup(<DailySummaryStrip summary={summary()} showSettlementAmounts={false} locale="ko" />);

    assert.match(html, /현금/);
    assert.match(html, /1,500,000 VND/);
    assert.match(html, /카드/);
    assert.match(html, /1,000,000 VND/);
    assert.match(html, /계좌/);
    assert.match(html, /400,000 VND/);
    assert.match(html, /기타/);
    assert.match(html, /0 VND/);
  });

  it("shows the service till amounts, the shortage word, and a signed bank shortage", () => {
    const html = renderToStaticMarkup(
      <DailySummaryStrip
        summary={summary({
          expenseTotal: 0,
          netSales: 1000,
          till: {
            day: {
              cashReceipts: 1000,
              cashExpenses: 1000,
              cashBalance: -50000,
              bankReceipts: 0,
              bankExpenses: 0,
              bankBalance: -20000
            },
            month: {
              cashReceipts: 0,
              cashExpenses: 0,
              cashBalance: 10000,
              bankReceipts: 0,
              bankExpenses: 0,
              bankBalance: 0
            }
          }
        })}
        showSettlementAmounts={false}
        locale="ko"
      />
    );

    assert.match(html, /현금·계좌 시재/);
    assert.match(html, /조회일/);
    assert.match(html, /이번 달 누계/);
    const cash = tillRow(html, "현금");
    const bank = tillRow(html, "계좌");
    assert.deepEqual(
      cash.map((cell) => cell.text),
      ["1,000 VND", "1,000 VND", "부족 50,000 VND", "0 VND", "0 VND", "10,000 VND"]
    );
    assert.match(cash[2].className, /text-danger/);
    assert.match(cash[5].className, /text-foreground/);
    assert.equal(bank[2].text, "-20,000 VND");
    assert.match(bank[2].className, /text-danger/);
    assert.match(html, /카드/);
    assert.match(html, /기타/);
    assert.match(html, /순매출/);

    const vietnamese = renderToStaticMarkup(
      <DailySummaryStrip
        summary={summary({
          expenseTotal: 0,
          netSales: 1000,
          till: {
            day: {
              cashReceipts: 1000,
              cashExpenses: 1000,
              cashBalance: -50000,
              bankReceipts: 0,
              bankExpenses: 0,
              bankBalance: -20000
            },
            month: zeroTill()
          }
        })}
        showSettlementAmounts={false}
        locale="vi"
      />
    );
    const vietnameseCash = tillRow(vietnamese, "Tiền mặt");
    const vietnameseBank = tillRow(vietnamese, "Chuyển khoản");
    assert.match(vietnamese, /Số dư/);
    assert.equal(vietnameseCash[2].text, "Thiếu 50.000 VND");
    assert.match(vietnameseCash[2].className, /text-danger/);
    assert.equal(vietnameseBank[2].text, "-20.000 VND");
    assert.match(vietnameseBank[2].className, /text-danger/);
  });
});
