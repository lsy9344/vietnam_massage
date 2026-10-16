import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { TodayDashboardView } from "@/app/(erp)/dashboard/today/today-dashboard-view";
import type { TodayDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";

type Therapist = TodayDashboardMetricsDto["therapistSummary"]["therapists"][number];

function therapist(overrides: Partial<Therapist>): Therapist {
  return {
    employeeId: "emp-mai",
    displayName: "Mai",
    staffCode: "T01",
    totalAssignedCallCount: 3,
    totalCommissionAmount: 1_200_000,
    warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
    courseBreakdown: {} as Therapist["courseBreakdown"],
    ...overrides
  };
}

function metrics(overrides: Partial<TodayDashboardMetricsDto> = {}): TodayDashboardMetricsDto {
  return {
    operatingMonth: { id: "month-1", monthKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-31", status: "작성중" },
    serviceDate: "2026-10-14",
    statusCounts: { reservation: 7, inUse: 2, cleaning: 1, completed: 3, noShow: 1, canceled: 0 },
    financials: {
      paymentTotal: 10_900_000,
      netSales: 10_400_000,
      discountTotal: 300_000,
      expenseTotal: 500_000,
      opsDailyIncentiveTotal: 300_000,
      opsMonthlyIncentiveTotal: 0,
      fullAttendanceAllowanceTotal: 0,
      countKingBonusTotal: 0,
      therapistCommissionTotal: 3_900_000,
      therapistPayoutTotal: 3_900_000,
      dailyCostTotal: 4_700_000,
      monthlyCostTotal: 0,
      settlementPayoutTotal: 4_200_000,
      netProfit: 6_200_000
    },
    therapistSummary: {
      totalAssignedCallCount: 3,
      totalCommissionAmount: 1_200_000,
      therapists: [therapist({})]
    },
    courseCompletions: [
      { courseCode: "A", completedCount: 1, discountCount: 0, therapistAssignmentCount: 1 },
      { courseCode: "B", completedCount: 1, discountCount: 0, therapistAssignmentCount: 2 },
      { courseCode: "C", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 },
      { courseCode: "D", completedCount: 1, discountCount: 0, therapistAssignmentCount: 2 },
      { courseCode: "E", completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }
    ],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0, settlementExcludedCallCount: 0 },
    emptyState: { kind: "none", message: null },
    sourceBasis: {
      callLedgerSummary: "getDailyCallLedgerSummary",
      therapistDailySettlements: "listTherapistDailySettlements",
      amountBasis: "calculated_completed_service_calls_only",
      readOnly: true
    },
    ...overrides
  };
}

function render(dto: TodayDashboardMetricsDto, options: { ledgerHref?: string | null; locale?: "ko" | "vi" } = {}) {
  return renderToStaticMarkup(
    <TodayDashboardView
      ledgerHref={options.ledgerHref === undefined ? "/calls?date=2026-10-14" : options.ledgerHref}
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

/** 안에 다른 section이 없는 카드 하나의 안쪽. */
function card(html: string, label: string) {
  const inside = from(html, label);
  return inside.slice(0, inside.indexOf("</section>"));
}

describe("오늘 대시보드", () => {
  it("leads with the calls in progress (사용중·청소중), then the day's other status counts", () => {
    const status = text(from(render(metrics()), "오늘 상태 건수"));

    assert.match(status, /^사용중 2건 청소중 1건 예약건수 7건 방문완료 3건 노쇼 1건 취소 0건/);
  });

  it("puts the excluded-call warning above everything else, with the counts the service gave", () => {
    const html = render(
      metrics({
        emptyState: { kind: "warnings_excluded", message: "서비스 한국어 문장" },
        warningCounts: { coursePolicyMissing: 1, therapistRateMissing: 2, secondTherapistRequired: 0, settlementExcludedCallCount: 3 }
      })
    );

    const alertAt = html.indexOf('role="alert"');
    assert.ok(alertAt !== -1 && alertAt < html.indexOf('aria-label="오늘 상태 건수"'));
    assert.match(text(html), /집계 제외 항목이 있습니다 .*정책 누락 1건, 수당 누락 2건, D코스 마사지사2 필요 0건/);
    // 서비스의 한국어 문장은 베트남어 화면에도 그대로 나오므로 쓰지 않는다.
    assert.doesNotMatch(html, /서비스 한국어 문장/);
    assert.doesNotMatch(render(metrics()), /role="alert"/);
  });

  it("paints revenue and cost as different card families and keeps cash and bank balances off this screen", () => {
    const html = render(metrics());
    const money = from(html, "오늘 금액 KPI");

    // 매출 계열은 라벤더, 비용 계열은 피치(design.md 2.3). 순이익과 비용 합계를 한 값처럼 칠하지 않는다.
    assert.match(money, /bg-accent-lavender"><dt[^>]*>결제합계<\/dt><dd[^>]*>10,900,000 <span[^>]*>VND<\/span><\/dd><dd[^>]*>할인합계 300,000 VND<\/dd>/);
    assert.match(money, /bg-accent-lavender"><dt[^>]*>순이익<\/dt><dd[^>]*>6,200,000 <span[^>]*>VND<\/span>/);
    assert.match(money, /bg-accent-peach"><dt[^>]*>일일비용 합계<\/dt><dd[^>]*>4,700,000 <span[^>]*>VND<\/span>/);
    // 일일비용 합계를 이루는 금액은 카드가 아니라 목록이다.
    assert.equal(
      text(card(html, "일일비용 내역")),
      "일일비용 내역 지출합계 500,000 VND 마사지사 정산 3,900,000 VND 일일인센 합계 300,000 VND"
    );
    assert.equal(money.match(/bg-accent-/g)?.length, 3);
    // 현금·계좌 잔액은 하루 수납·지출 탭에만 있다(명세 F08 기준 5).
    assert.doesNotMatch(html, /잔액/);
  });

  it("says the day has no calls and links to the ledger only for roles that can open it", () => {
    const empty = metrics({
      emptyState: { kind: "no_calls", message: null },
      statusCounts: { reservation: 0, inUse: 0, cleaning: 0, completed: 0, noShow: 0, canceled: 0 }
    });

    const withLink = render(empty, { ledgerHref: "/calls?operatingMonthId=month-1&date=2026-10-14" });
    assert.match(text(withLink), /데이터 없음 이 날짜의 콜이 없습니다/);
    assert.match(withLink, /<a [^>]*href="\/calls\?operatingMonthId=month-1&amp;date=2026-10-14"[^>]*>콜 원장으로 이동<\/a>/);

    const withoutLink = render(empty, { ledgerHref: null });
    assert.match(text(withoutLink), /이 날짜의 콜이 없습니다/);
    assert.doesNotMatch(withoutLink, /<a /);
  });

  it("lists course completions in a table, one row per course", () => {
    const courses = card(render(metrics()), "코스별 방문완료");

    assert.match(courses, /<table/);
    assert.match(text(courses), /코스 방문완료 담당 A 1건 1건 B 1건 2건 C 0건 0건 D 1건 2건 E 0건 0건/);
    assert.match(courses, /<tr aria-label="D 코스 방문완료">/);
  });

  it("shows that course counts have no calculation basis instead of a table of zeros", () => {
    // 방문완료 콜은 있지만 정책 누락으로 코스 집계에서 모두 빠진 날.
    const html = render(
      metrics({
        courseCompletions: (["A", "B", "C", "D", "E"] as const).map((courseCode) => ({ courseCode, completedCount: 0, discountCount: 0, therapistAssignmentCount: 0 }))
      })
    );
    const courses = card(html, "코스별 방문완료");

    assert.doesNotMatch(courses, /<table/);
    assert.match(text(courses), /계산 근거 없음 계산할 수 있는 방문완료 콜이 없어 코스별 건수를 표시하지 않습니다/);
  });

  it("compares therapists in a table from tablet width up and as short cards on a phone", () => {
    const html = render(
      metrics({
        therapistSummary: {
          totalAssignedCallCount: 5,
          totalCommissionAmount: 2_000_000,
          therapists: [
            therapist({}),
            therapist({
              employeeId: "emp-linh",
              displayName: "Linh",
              staffCode: "T02",
              totalAssignedCallCount: 2,
              totalCommissionAmount: 800_000,
              warningCounts: { zeroPolicy: 0, missingPolicy: 1 }
            })
          ]
        }
      })
    );
    const therapists = card(html, "마사지사 담당콜/정산");

    assert.match(text(therapists), /^마사지사 담당콜\/정산 총 5건 · 2,000,000 VND/);
    // 600px 이상에서는 표, 미만에서는 같은 값의 짧은 카드다(데스크톱 표를 줄이지 않는다).
    assert.match(therapists, /<div class="[^"]*max-\[599px\]:hidden"><table/);
    assert.match(text(therapists), /마사지사 담당콜 정산 합계 주의 Mai T01 3건 1,200,000 VND Linh T02 2건 800,000 VND 0원 정책 0 · 수당 누락 1/);
    assert.match(therapists, /<ul class="[^"]*min-\[600px\]:hidden/);
    assert.match(text(therapists.slice(therapists.indexOf("<ul"))), /^Mai T01 담당 3건 1,200,000 VND Linh T02 담당 2건 800,000 VND 0원 정책 0 · 수당 누락 1$/);
  });

  it("says so when no therapist has a settlement row", () => {
    const html = render(metrics({ therapistSummary: { totalAssignedCallCount: 0, totalCommissionAmount: 0, therapists: [] } }));

    assert.match(text(card(html, "마사지사 담당콜/정산")), /표시할 마사지사 정산 항목이 없습니다/);
    assert.doesNotMatch(card(html, "마사지사 담당콜/정산"), /<table/);
  });

  it("speaks Vietnamese with no Korean left, warnings and empty states included", () => {
    const html = render(
      metrics({
        emptyState: { kind: "warnings_excluded", message: "서비스 한국어 문장" },
        warningCounts: { coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 0, settlementExcludedCallCount: 1 },
        therapistSummary: { totalAssignedCallCount: 3, totalCommissionAmount: 1_200_000, therapists: [therapist({ warningCounts: { zeroPolicy: 1, missingPolicy: 0 } })] }
      }),
      { locale: "vi" }
    );

    assert.match(text(from(html, "Số ca trạng thái hôm nay")), /^Đang sử dụng 2 ca Đang dọn 1 ca Số lượt đặt trước 7 ca/);
    assert.match(html, /bg-accent-lavender"><dt[^>]*>Tổng thanh toán<\/dt>/);
    assert.doesNotMatch(html, /[가-힣]/);
    assert.doesNotMatch(render(metrics({ emptyState: { kind: "no_calls", message: null }, courseCompletions: [] }), { locale: "vi" }), /[가-힣]/);
  });
});
