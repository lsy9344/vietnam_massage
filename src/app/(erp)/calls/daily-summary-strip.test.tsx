import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import type { CalculationWarningCallDto, DailyCallLedgerSummaryDto, TillBalanceDto } from "@/modules/calls/service-call-service";

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
    discountTotal: 100000,
    expenseTotal: 50000,
    netSales: 2850000,
    paymentMethodTotals: { cash: 1500000, card: 1000000, bank: 400000, other: 0 },
    till: {
      day: { cashReceipts: 1500000, cashExpenses: 50000, cashBalance: 1450000, bankReceipts: 400000, bankExpenses: 0, bankBalance: 400000 },
      month: { cashReceipts: 9000000, cashExpenses: 300000, cashBalance: 8700000, bankReceipts: 2000000, bankExpenses: 100000, bankBalance: 1900000 }
    },
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

const warningCalls: CalculationWarningCallDto[] = [
  {
    serviceCallId: "call-rate",
    operatingMonthId: "m-2026-10",
    serviceDate: "2026-10-14",
    startTime: "13:00",
    customerMemo: "민준",
    calculationStatus: "therapist_rate_missing"
  },
  {
    serviceCallId: "call-second",
    operatingMonthId: "m-2026-10",
    serviceDate: "2026-10-14",
    startTime: "15:30",
    customerMemo: null,
    calculationStatus: "second_therapist_required"
  }
];

function render(overrides: Partial<Parameters<typeof DailySummaryStrip>[0]> = {}) {
  return renderToStaticMarkup(
    <DailySummaryStrip locale="ko" showSettlementAmounts={false} summary={summary()} warningCalls={[]} {...overrides} />
  );
}

/** 태그를 지운 화면 글자. 값이 어느 라벨 옆에 있는지 본다. */
function text(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

// 요약 카드 줄은 aria-label이 붙은 첫 dl이다("하루 수납 요약").
function summaryCards(html: string) {
  return html.match(/<dl aria-label="[^"]+"[^>]*>([\s\S]*?)<\/dl>/)?.[1] ?? "";
}

describe("하루 수납·지출 탭 요약", () => {
  it("puts payment total, net sales, cash balance and bank balance on separate pastel cards with the service values", () => {
    const html = render({ showSettlementAmounts: true });
    assert.match(html, /<dl aria-label="하루 수납 요약"/);
    const cards = summaryCards(html);

    assert.match(text(cards), /결제합계 2,900,000 VND/);
    assert.match(text(cards), /순매출 2,850,000 VND/);
    assert.match(text(cards), /현금 잔액 1,450,000 VND 이번 달 8,700,000 VND/);
    assert.match(text(cards), /계좌 잔액 400,000 VND 이번 달 1,900,000 VND/);
    // 순매출과 잔액은 다른 카드, 다른 색이다(ADR 0002).
    assert.equal((cards.match(/bg-accent-lavender/g) ?? []).length, 2);
    assert.equal((cards.match(/bg-accent-blue/g) ?? []).length, 2);
    assert.doesNotMatch(cards, /text-danger|text-muted/);
  });

  it("writes a cash shortage with the shortage word and a bank shortage with a minus sign, in black ink on the cards", () => {
    const html = render({
      summary: summary({
        till: {
          day: { cashReceipts: 1000, cashExpenses: 51000, cashBalance: -50000, bankReceipts: 0, bankExpenses: 20000, bankBalance: -20000 },
          month: zeroTill()
        }
      })
    });
    const cards = summaryCards(html);

    assert.match(text(cards), /현금 잔액 부족 50,000 VND/);
    assert.match(text(cards), /계좌 잔액 -20,000 VND/);
    assert.doesNotMatch(cards, /text-danger/);

    const vietnamese = text(summaryCards(render({ locale: "vi", summary: summary({ till: { day: { ...zeroTill(), cashBalance: -50000, bankBalance: -20000 }, month: zeroTill() } }) })));
    assert.match(vietnamese, /Số dư tiền mặt Thiếu 50.000 VND/);
    assert.match(vietnamese, /Số dư chuyển khoản -20.000 VND/);
  });

  it("lists cash, card, bank and other totals with discount and expense totals", () => {
    const shown = text(render());

    assert.match(shown, /결제수단별 합계/);
    assert.match(shown, /현금 1,500,000 VND/);
    assert.match(shown, /카드 1,000,000 VND/);
    assert.match(shown, /계좌 400,000 VND/);
    assert.match(shown, /기타 0 VND/);
    assert.match(shown, /할인합계 100,000 VND/);
    assert.match(shown, /지출합계 50,000 VND/);
  });

  it("shows the day and month till receipts, expenses and balances, marking a shortage in the table", () => {
    const html = render({
      showSettlementAmounts: true,
      summary: summary({
        till: {
          day: { cashReceipts: 1000, cashExpenses: 51000, cashBalance: -50000, bankReceipts: 0, bankExpenses: 0, bankBalance: 0 },
          month: { cashReceipts: 9000000, cashExpenses: 300000, cashBalance: 8700000, bankReceipts: 2000000, bankExpenses: 100000, bankBalance: 1900000 }
        }
      })
    });
    const till = html.match(/<table[^>]*aria-label="시재"[\s\S]*?<\/table>/)?.[0] ?? "";

    assert.match(text(till), /오늘 현금 1,000 VND 51,000 VND 부족 50,000 VND/);
    assert.match(text(till), /계좌 0 VND 0 VND 0 VND/);
    assert.match(text(till), /이번 달 현금 9,000,000 VND 300,000 VND 8,700,000 VND/);
    assert.match(text(till), /계좌 2,000,000 VND 100,000 VND 1,900,000 VND/);
    assert.match(till, /text-danger[^"]*">부족 50,000 VND/);
  });

  // 1018 스펙 D18: 이번 달 숫자는 관리자·정산 담당에게만 보낸다. 카운터에게는 오늘 숫자만 남는다.
  it("leaves this month's balances and till out for viewers without settlement amounts", () => {
    const counter = render();
    const cards = text(summaryCards(counter));

    assert.match(cards, /현금 잔액 1,450,000 VND/);
    assert.match(cards, /계좌 잔액 400,000 VND/);
    assert.doesNotMatch(counter, /이번 달|8,700,000|9,000,000|1,900,000/);
    assert.match(text(counter.match(/<table[^>]*aria-label="시재"[\s\S]*?<\/table>/)?.[0] ?? ""), /오늘 현금/);
  });

  it("keeps settlement amounts and the therapist assignment column for settlement viewers only", () => {
    const counter = render();
    assert.doesNotMatch(counter, /마사지사정산/);
    assert.doesNotMatch(counter, /마사지사 담당 수/);

    const admin = text(render({ showSettlementAmounts: true }));
    assert.match(admin, /마사지사정산 700,000 VND/);
    assert.match(admin, /마사지사 담당 수/);
    assert.match(admin, /B 1 0 2/);
  });

  it("summarizes course codes A to E", () => {
    const shown = text(render());
    assert.match(shown, /코스 요약/);
    assert.match(shown, /A 1 1 /);
    assert.match(shown, /E 0 0 /);
  });

  it("leaves the status counts to the ledger tab", () => {
    const shown = text(render());
    assert.doesNotMatch(shown, /예약건수|사용중|청소중|노쇼/);
  });

  it("opens the calculation warning count into the calls with errors, each linking to that call on the ledger", () => {
    const html = render({ warningCalls });
    const details = html.match(/<details[\s\S]*?<\/details>/)?.[0] ?? "";

    assert.match(text(details), /계산 경고 3건/);
    assert.match(text(details), /정책 확인이 필요한 3건은 일부 집계에서 제외됐다/);
    assert.doesNotMatch(details, /수당 누락/);
    assert.match(text(details), /13:00 민준 마사지사 수당 정책을 찾을 수 없습니다\./);
    assert.match(text(details), /15:30 — D코스는 마사지사2 필수입니다\./);
    assert.match(details, /href="\/calls\?operatingMonthId=m-2026-10&amp;serviceDate=2026-10-14&amp;call=call-rate"/);
    assert.match(details, /href="\/calls\?operatingMonthId=m-2026-10&amp;serviceDate=2026-10-14&amp;call=call-second"/);

    const admin = text(render({ showSettlementAmounts: true, warningCalls }));
    assert.match(admin, /정책 누락 1건, 수당 누락 1건, 마사지사2 필요 1건은 금액\/코스별 집계에서 제외됐다/);

    const vietnamese = text(render({ locale: "vi", warningCalls }));
    assert.match(vietnamese, /Cảnh báo tính toán 3 ca/);
    assert.match(vietnamese, /Xem trên sổ gọi/);
  });

  it("shows no calculation warning when the service counts none", () => {
    const html = render({ summary: summary({ warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 } }) });
    assert.doesNotMatch(html, /<details/);
    assert.doesNotMatch(text(html), /계산 경고/);
  });
});
