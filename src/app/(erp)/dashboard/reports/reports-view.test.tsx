import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportsView } from "@/app/(erp)/dashboard/reports/reports-view";
import type { DashboardGraphReportDto } from "@/modules/dashboard/dashboard-query-service";

const days = ["2026-10-01", "2026-10-02", "2026-10-03"];

function report(overrides: Partial<DashboardGraphReportDto> = {}): DashboardGraphReportDto {
  return {
    operatingMonth: { id: "month-1", monthKey: "2026-10", startDate: "2026-10-01", endDate: "2026-10-03", status: "작성중" },
    serviceDate: "2026-10-02",
    sourceBasis: {
      kind: "current_recalculation",
      label: "미확정 현재 기준",
      calculationBasis: "getDailyCallLedgerSummary_range",
      settlementBasis: "listMonthlyClosingPreview",
      readOnly: true
    },
    dailyRevenueTrend: [
      { serviceDate: days[0], paymentTotal: 0, netSales: -300_000, completedCount: 0 },
      { serviceDate: days[1], paymentTotal: 4_700_000, netSales: 4_400_000, completedCount: 2 },
      { serviceDate: days[2], paymentTotal: 1_200_000, netSales: 1_200_000, completedCount: 1 }
    ],
    courseMix: [
      { courseCode: "A", completedCount: 1, paymentTotal: 1_400_000, callShare: 0.5, revenueShare: 0.4375 },
      { courseCode: "B", completedCount: 1, paymentTotal: 1_800_000, callShare: 0.5, revenueShare: 0.5625 }
    ],
    therapistCallRanking: [
      { employeeId: "emp-mai", displayName: "Mai", staffCode: "T01", assignedCallCount: 3, therapist1Count: 2, therapist2Count: 1, totalCommissionAmount: 900_000, evidenceCount: 3 },
      { employeeId: "emp-linh", displayName: "Linh", staffCode: "T02", assignedCallCount: 1, therapist1Count: 1, therapist2Count: 0, totalCommissionAmount: 300_000, evidenceCount: 1 }
    ],
    therapistSettlementRanking: [
      { employeeId: "emp-mai", displayName: "Mai", staffCode: "T01", totalCallCount: 3, monthlySettlementAmount: 900_000, finalPayoutAmount: 1_000_000 }
    ],
    roomStatusDistribution: [
      { displayStatus: "사용중", count: 2 },
      { displayStatus: "빈방", count: 4 }
    ],
    noShowCancelTrend: [
      { serviceDate: days[0], noShowCount: 0, canceledCount: 1 },
      { serviceDate: days[1], noShowCount: 2, canceledCount: 0 },
      { serviceDate: days[2], noShowCount: 0, canceledCount: 0 }
    ],
    opsIncentiveOrPayoutComposition: {
      status: "available",
      label: "월마감 지급 구성",
      segments: [
        { key: "therapist", label: "마사지사 지급", amount: 1_000_000 },
        { key: "ops_daily", label: "운영팀 일일 인센", amount: 250_000 }
      ]
    },
    warningCounts: {
      callLedger: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
      settlement: null,
      settlementExcludedCallCount: 0
    },
    emptyStates: {
      noCallsInPeriod: false,
      noRevenueTrendData: false,
      noCalculatedCompletedCalls: false,
      noRoomStatuses: false,
      noSettlementSource: false,
      snapshotMissing: false,
      graphReportSnapshotMissing: false
    },
    ...overrides
  };
}

function render(dto: DashboardGraphReportDto, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(<ReportsView locale={locale} report={dto} />);
}

// 화면 낭독기가 읽는 글자. 장식(aria-hidden)은 뺀다.
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

describe("리포트", () => {
  it("draws daily revenue as lavender columns with net sales as an ink line on one axis, and keeps the same values in a table", () => {
    const revenue = card(render(report()), "일별 매출 추이");

    assert.match(revenue, /<div aria-label="일별 선결제 매출과 순매출 추이"[^>]*role="img"/);
    // 한 차트에 파스텔은 하나다. 두 번째 계열은 색이 아니라 모양(선)으로 구분한다.
    assert.equal(revenue.match(/bg-accent-lavender/g)?.length, 3 + 1);
    assert.doesNotMatch(revenue, /bg-accent-(peach|blue|mint|butter)|status-/);
    assert.match(revenue, /<polyline[^>]*class="[^"]*stroke-foreground/);
    assert.match(text(revenue), /매출\(선결제 반영\) 순매출/);
    assert.match(text(revenue), /2026-10-02 4,700,000 VND 4,400,000 VND 2건/);
  });

  it("draws each make-up and ranking in the colour of what it measures, with the value written beside every bar", () => {
    const html = render(report());

    const courses = card(html, "코스별 콜/매출 비중");
    assert.match(text(courses), /A 코스 1건 · 1,400,000 VND · 콜 50% · 매출 43\.8% B 코스 1건 · 1,800,000 VND · 콜 50% · 매출 56\.3%/);
    // 매출 비중은 전체에 대한 몫이라 막대 길이도 전체를 100%로 둔다.
    assert.match(courses, /bg-accent-lavender" style="width:43.75%"/);
    assert.doesNotMatch(courses, /bg-accent-(peach|blue|mint|butter)/);

    const payout = card(html, "운영팀 인센/월마감 지급 구성");
    assert.match(text(payout), /^운영팀 인센\/월마감 지급 구성 월마감 지급 구성 마사지사 지급 1,000,000 VND 운영팀 일일 인센 250,000 VND$/);
    assert.match(payout, /bg-accent-peach" style="width:25%"/);

    const calls = card(html, "마사지사 담당 콜 순위");
    assert.match(text(calls), /Mai T01 담당 3건 · 1번 2 · 2번 1 Linh T02 담당 1건 · 1번 1 · 2번 0/);
    assert.match(calls, /bg-accent-mint" style="width:100%"/);

    const settlement = card(html, "마사지사 정산 순위");
    assert.match(text(settlement), /Mai T01 1,000,000 VND · 담당 3건/);
    assert.match(settlement, /bg-accent-peach/);
  });

  it("keeps room-status colours on the status labels only and draws the counts as mint bars", () => {
    const rooms = card(render(report()), "객실 상태 분포");

    assert.match(text(rooms), /사용중 2개 빈방 4개/);
    assert.equal(rooms.match(/class="[^"]*status-/g)?.length, 2);
    assert.equal(rooms.match(/bg-accent-mint/g)?.length, 2);
  });

  it("draws no-shows and cancellations as two small charts of their own instead of two pastels in one", () => {
    const trend = card(render(report()), "노쇼/취소 추이");

    assert.match(trend, /<div aria-label="일별 노쇼 건수"[^>]*role="img"/);
    assert.match(trend, /<div aria-label="일별 취소 건수"[^>]*role="img"/);
    assert.doesNotMatch(trend, /bg-accent-(lavender|peach|blue|butter)|status-/);
    assert.match(text(trend), /날짜 노쇼 취소 2026-10-01 0건 1건 2026-10-02 2건 0건 2026-10-03 0건 0건/);
  });

  it("opens with the basis of the numbers", () => {
    assert.match(text(card(render(report()), "그래프 리포트 기준")), /^미확정 현재 기준 매출은 결제수단 선택 시점 선결제 기준이고/);

    const closed = render(
      report({
        sourceBasis: {
          kind: "closed_snapshot",
          label: "확정 스냅샷 기준",
          closeVersion: 3,
          confirmedAt: "2026-11-02T03:00:00.000Z",
          calculationBasis: "getMonthlyClosingSnapshot.graphReport",
          settlementBasis: "getMonthlyClosingSnapshot",
          readOnly: true
        }
      })
    );
    assert.match(text(card(closed, "그래프 리포트 기준")), /^확정 스냅샷 기준 /);
  });

  it("leaves a chart out with the reason when its numbers have no basis, instead of drawing zeros", () => {
    const html = render(
      report({
        dailyRevenueTrend: days.map((serviceDate) => ({ serviceDate, paymentTotal: 0, netSales: 0, completedCount: 0 })),
        courseMix: [],
        roomStatusDistribution: [],
        noShowCancelTrend: days.map((serviceDate) => ({ serviceDate, noShowCount: 0, canceledCount: 0 })),
        emptyStates: {
          noCallsInPeriod: true,
          noRevenueTrendData: true,
          noCalculatedCompletedCalls: true,
          noRoomStatuses: true,
          noSettlementSource: false,
          snapshotMissing: false,
          graphReportSnapshotMissing: false
        }
      })
    );

    assert.match(text(card(html, "데이터 없음 상태")), /운영월 기간 전체에 콜 원장 데이터가 없습니다\./);
    assert.doesNotMatch(html, /role="img"/);
    assert.match(text(card(html, "일별 매출 추이")), /계산 근거 없음 calculated 방문완료 콜이 없는 조회 기준입니다/);
    assert.match(text(card(html, "코스별 콜\/매출 비중")), /계산 근거 없음 계산할 수 있는 방문완료 콜이 없어 코스 비중을 그리지 않습니다/);
    assert.match(text(card(html, "노쇼\/취소 추이")), /계산 근거 없음 이 기간에 콜이 없어 노쇼·취소 추이를 그리지 않습니다/);
    assert.match(text(card(html, "객실 상태 분포")), /객실 상태가 없어 분포를 그리지 않습니다/);
  });

  it("keeps a closed month without its snapshot from falling back to current payouts", () => {
    const html = render(
      report({
        sourceBasis: {
          kind: "snapshot_missing",
          label: "확정 스냅샷을 찾을 수 없습니다",
          calculationBasis: "getDailyCallLedgerSummary_range",
          settlementBasis: "none",
          readOnly: true
        },
        therapistSettlementRanking: [],
        opsIncentiveOrPayoutComposition: { status: "snapshot_missing", label: "확정 스냅샷을 찾을 수 없습니다", segments: [] },
        emptyStates: {
          noCallsInPeriod: false,
          noRevenueTrendData: false,
          noCalculatedCompletedCalls: false,
          noRoomStatuses: false,
          noSettlementSource: true,
          snapshotMissing: true,
          graphReportSnapshotMissing: false
        }
      })
    );

    assert.match(html, /role="alert"[^>]*>.*확정 스냅샷을 찾을 수 없습니다/);
    assert.match(text(card(html, "마사지사 정산 순위")), /정산 source가 없어 순위를 표시하지 않습니다\./);
    assert.match(text(card(html, "운영팀 인센\/월마감 지급 구성")), /확정 스냅샷이 없어 지급 구성 그래프를 표시하지 않습니다\./);
  });

  it("speaks Vietnamese with no Korean left, tooltips and empty states included", () => {
    const html = render(report(), "vi");

    assert.doesNotMatch(html, /[가-힣]/);
    assert.match(html, /aria-label="Số ca không đến theo ngày"/);
    const empty = report({
      emptyStates: {
        noCallsInPeriod: true,
        noRevenueTrendData: true,
        noCalculatedCompletedCalls: true,
        noRoomStatuses: true,
        noSettlementSource: true,
        snapshotMissing: false,
        graphReportSnapshotMissing: true
      }
    });
    assert.doesNotMatch(render(empty, "vi"), /[가-힣]/);
  });
});
