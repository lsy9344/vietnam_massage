import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthlyDashboardView } from "@/app/(erp)/dashboard/monthly/monthly-dashboard-view";
import type { MonthlyDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";

const settlementWarnings = {} as NonNullable<MonthlyDashboardMetricsDto["warningCounts"]["settlement"]>;

function metrics(overrides: Partial<MonthlyDashboardMetricsDto> = {}): MonthlyDashboardMetricsDto {
  return {
    operatingMonth: { id: "month-1", monthKey: "2026-09", startDate: "2026-09-01", endDate: "2026-09-30", status: "작성중" },
    sourceBasis: {
      kind: "current_recalculation",
      label: "미확정 현재 기준",
      calculationBasis: "getDailyCallLedgerSummary_range",
      settlementBasis: "listMonthlyClosingPreview",
      readOnly: true
    },
    statusCounts: { reservation: 40, inUse: 0, cleaning: 0, completed: 35, noShow: 3, canceled: 2 },
    financials: {
      paymentTotal: 296_000_000,
      netSales: 200_000_000,
      discountTotal: 4_000_000,
      expenseTotal: 96_000_000,
      opsDailyIncentiveTotal: 3_000_000,
      opsMonthlyIncentiveTotal: 2_000_000,
      fullAttendanceAllowanceTotal: 1_000_000,
      countKingBonusTotal: 500_000,
      therapistCommissionTotal: 100_000_000,
      therapistPayoutTotal: 101_500_000,
      dailyCostTotal: 199_000_000,
      monthlyCostTotal: 3_500_000,
      settlementPayoutTotal: 106_500_000,
      netProfit: 93_500_000
    },
    courseCompletions: [
      { courseCode: "A", completedCount: 20, discountCount: 0, therapistAssignmentCount: 20 },
      { courseCode: "B", completedCount: 10, discountCount: 0, therapistAssignmentCount: 10 },
      { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "D", completedCount: 5, discountCount: 0, therapistAssignmentCount: 10 },
      { courseCode: "E", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }
    ],
    warningCounts: {
      callLedger: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
      settlement: settlementWarnings,
      settlementExcludedCallCount: 0
    },
    settlementSummary: {
      therapistPayoutAmount: 101_500_000,
      opsDailyIncentiveAmount: 3_000_000,
      opsMonthlyIncentiveAmount: 2_000_000,
      fullAttendanceAllowanceTotal: 1_000_000,
      countKingBonusTotal: 500_000,
      grandPayoutAmount: 106_500_000,
      includedCallCount: 35,
      excludedCallCount: 1,
      warningCount: 0
    },
    snapshot: null,
    emptyState: { kind: "none", message: null },
    ...overrides
  };
}

const closedBasis: MonthlyDashboardMetricsDto["sourceBasis"] = {
  kind: "closed_snapshot",
  label: "확정 스냅샷 기준",
  closeVersion: 2,
  confirmedAt: "2026-10-03T05:30:00.000Z",
  calculationBasis: "getMonthlyClosingSnapshot.dashboardFinancials",
  settlementBasis: "getMonthlyClosingSnapshot",
  readOnly: true
};

const missingBasis: MonthlyDashboardMetricsDto["sourceBasis"] = {
  kind: "snapshot_missing",
  label: "확정 스냅샷을 찾을 수 없습니다",
  calculationBasis: "getDailyCallLedgerSummary_range",
  settlementBasis: "none",
  readOnly: true
};

function render(dto: MonthlyDashboardMetricsDto, options: { ledgerHref?: string | null; locale?: "ko" | "vi" } = {}) {
  return renderToStaticMarkup(
    <MonthlyDashboardView
      ledgerHref={options.ledgerHref === undefined ? "/calls?operatingMonthId=month-1" : options.ledgerHref}
      locale={options.locale ?? "ko"}
      metrics={dto}
    />
  );
}

// 화면 낭독기가 읽는 글자. 상태 기호(aria-hidden)는 뺀다.
function text(html: string) {
  return html
    .replace(/<span aria-hidden="true">[^<]*<\/span>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** aria-label이 label인 요소의 안쪽부터 문서 끝까지. */
function from(html: string, label: string) {
  const start = html.indexOf(`aria-label="${label}"`);
  assert.notEqual(start, -1, `${label} not found`);
  return html.slice(html.indexOf(">", start) + 1);
}

/** 안에 다른 section이 없는 영역 하나의 안쪽. */
function card(html: string, label: string) {
  const inside = from(html, label);
  return inside.slice(0, inside.indexOf("</section>"));
}

describe("월간 대시보드", () => {
  it("opens with the basis the month's numbers come from: the close version for a closed month", () => {
    const closed = render(metrics({ sourceBasis: closedBasis }));

    assert.match(text(card(closed, "월간 KPI 기준")), /^확정 스냅샷 기준 마감 버전 2 · 확정 2026\. 10\. 3\. 12:30/);
    assert.ok(closed.indexOf('aria-label="월간 KPI 기준"') < closed.indexOf('aria-label="월간 금액 KPI"'));

    const current = render(metrics());
    assert.match(text(card(current, "월간 KPI 기준")), /^미확정 현재 기준 현재 콜 원장과 현재 정책 기준의 월간 미리보기이며/);
  });

  it("paints revenue and cost as different card families and shows no till balance", () => {
    const html = render(metrics());
    const money = from(html, "월간 금액 KPI");

    assert.match(money, /bg-accent-lavender"><dt[^>]*>결제합계<\/dt><dd[^>]*>296,000,000 <span[^>]*>VND<\/span><\/dd><dd[^>]*>할인합계 4,000,000 VND<\/dd>/);
    assert.match(money, /bg-accent-lavender"><dt[^>]*>월간 순이익<\/dt><dd[^>]*>93,500,000 <span[^>]*>VND<\/span><\/dd><dd[^>]*>결제합계 - 일일비용 - 월간비용<\/dd>/);
    assert.match(money, /bg-accent-peach"><dt[^>]*>일일비용 합계<\/dt><dd[^>]*>199,000,000 <span[^>]*>VND<\/span>/);
    assert.match(money, /bg-accent-peach"><dt[^>]*>월간비용 합계<\/dt><dd[^>]*>3,500,000 <span[^>]*>VND<\/span>/);
    assert.equal(money.match(/bg-accent-/g)?.length, 4);
    assert.doesNotMatch(html, /잔액/);
  });

  it("withholds the money and payout figures of a closed month whose snapshot is missing instead of using current numbers", () => {
    const html = render(
      metrics({
        sourceBasis: missingBasis,
        financials: null,
        settlementSummary: null,
        emptyState: { kind: "snapshot_missing", message: null }
      })
    );

    assert.match(html, /role="alert"[^>]*>.*확정 스냅샷을 찾을 수 없습니다/);
    assert.match(html, /<section aria-label="월간 금액 KPI 표시 보류"[^>]*role="alert"/);
    assert.doesNotMatch(html, /aria-label="월간 금액 KPI"/);
    assert.doesNotMatch(html, /bg-accent-/);
    assert.match(text(card(html, "지급 요약 없음")), /확정 스냅샷이 없어 현재 지급 계산값으로 대체하지 않았습니다/);

    // 서비스가 금액을 돌려줘도 스냅샷이 없는 마감 월이면 보이지 않는다.
    const leaked = render(metrics({ sourceBasis: missingBasis }));
    assert.doesNotMatch(leaked, /aria-label="월간 금액 KPI"|aria-label="월간 금액 내역"/);
  });

  it("lists the payouts by staff group with their total, and the month's other amounts, as rows instead of more cards", () => {
    const html = render(metrics());

    assert.equal(
      text(card(html, "월간 지급 정산 KPI")),
      "월간 지급 정산 마사지사 지급 101,500,000 VND 운영팀 일일 인센 3,000,000 VND 운영팀 월 인센 2,000,000 VND 전체 지급 합계 106,500,000 VND 포함 35건 · 제외 1건"
    );
    assert.equal(
      text(card(html, "월간 금액 내역")),
      "월간 금액 내역 지출합계 96,000,000 VND 운영팀 월인센 2,000,000 VND 만근수당 1,000,000 VND 갯수왕 500,000 VND"
    );
  });

  it("puts the month's status counts and course completions in the body, led by the month's call count", () => {
    const html = render(metrics());

    // 지난 운영월에는 사용중·청소중이 지금의 뜻이 없으므로 오늘 화면과 달리 예약건수를 앞에 둔다.
    assert.match(text(card(html, "월간 상태 건수")), /^예약건수 40건 사용중 0건 청소중 0건 방문완료 35건 노쇼 3건 취소 2건$/);
    assert.match(text(card(html, "월간 코스별 방문완료")), /^코스별 방문완료 calculated 완료 콜 기준 코스 방문완료 담당 A 20건 20건 B 10건 10건/);
    assert.match(html, /<tr aria-label="D 코스 방문완료">/);
  });

  it("shows a reopened month's previous close only as a separate reference", () => {
    const html = render(
      metrics({
        snapshot: {
          kind: "previous",
          label: "이전 확정 스냅샷",
          id: "closing-1",
          closeVersion: 1,
          confirmedAt: "2026-10-02T03:00:00.000Z",
          totals: { grandPayoutAmount: 10_500_000 } as NonNullable<MonthlyDashboardMetricsDto["snapshot"]>["totals"],
          warningCounts: {} as NonNullable<MonthlyDashboardMetricsDto["snapshot"]>["warningCounts"]
        }
      })
    );

    assert.equal(
      text(card(html, "이전 확정 스냅샷")),
      "이전 확정 스냅샷 재오픈된 검토중 월의 참고 정보이며 현재 KPI 기준에는 섞지 않습니다. 마감 버전 1 · 확정 2026. 10. 2. 10:00 전체 지급 합계 10,500,000 VND"
    );
    assert.doesNotMatch(render(metrics()), /이전 확정 스냅샷/);
  });

  it("warns about excluded calls and says when the month has no calls, linking the ledger only for roles that can open it", () => {
    const warned = render(
      metrics({
        emptyState: { kind: "warnings_excluded", message: "서비스 한국어 문장" },
        warningCounts: {
          callLedger: { coursePolicyMissing: 0, therapistRateMissing: 1, secondTherapistRequired: 1 },
          settlement: settlementWarnings,
          settlementExcludedCallCount: 2
        }
      })
    );
    assert.match(text(warned), /집계 제외 항목이 있습니다 .*정책 누락 0건, 수당 누락 1건, D코스 마사지사2 필요 1건/);

    const empty = metrics({ emptyState: { kind: "no_calls", message: null } });
    assert.match(render(empty), /이 운영월의 콜이 없습니다.*<a [^>]*href="\/calls\?operatingMonthId=month-1"/);
    assert.doesNotMatch(render(empty, { ledgerHref: null }), /<a /);
  });

  it("speaks Vietnamese with no Korean left, including the basis the service labels in Korean", () => {
    const missing = metrics({
      sourceBasis: missingBasis,
      financials: null,
      settlementSummary: null,
      emptyState: { kind: "snapshot_missing", message: null }
    });

    for (const dto of [metrics({ sourceBasis: closedBasis }), metrics(), missing, metrics({ emptyState: { kind: "no_calls", message: null } })]) {
      assert.doesNotMatch(render(dto, { locale: "vi" }), /[가-힣]/);
    }
    assert.match(render(metrics({ sourceBasis: closedBasis }), { locale: "vi" }), /Phiên bản chốt 2/);
  });
});
