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

    assert.match(html, /현금 수납<\/span><span class="[^"]*">1,000 VND<\/span>/);
    assert.match(html, /현금 잔액<\/span><span class="[^"]*text-danger[^"]*">부족 50,000 VND<\/span>/);
    assert.match(html, /계좌 잔액<\/span><span class="[^"]*text-danger[^"]*">-20,000 VND<\/span>/);
    assert.match(html, /이번 달 현금 잔액<\/span><span class="[^"]*text-foreground[^"]*">10,000 VND<\/span>/);
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
    assert.match(vietnamese, /Số dư tiền mặt<\/span><span class="[^"]*text-danger[^"]*">Thiếu 50.000 VND<\/span>/);
    assert.match(vietnamese, /Số dư chuyển khoản<\/span><span class="[^"]*text-danger[^"]*">-20.000 VND<\/span>/);
  });
});
