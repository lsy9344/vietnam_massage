import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { OpsMonthlyView } from "@/app/(erp)/settlements/operations/monthly/ops-monthly-view";
import { OpsDailyView } from "@/app/(erp)/settlements/operations/ops-daily-view";
import { SettlementLockedNotice } from "@/app/(erp)/settlements/settlement-parts";
import type { OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import type { OpsDailyIncentiveResultDto } from "@/modules/settlements/ops-daily-incentive-service";
import type { OpsMonthlyIncentiveResultDto } from "@/modules/settlements/ops-monthly-incentive-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

function render(element: ReactElement, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(renderInShell(element, locale));
}

// 지급 확인(ADR 0004, 티켓 30·31) 기본값: 이 화면 테스트는 상태 전환이 아니라 금액/근거 표시를 본다.
function unconfirmedPayout(currentAmount: number): PayoutConfirmationDto {
  return { status: "unconfirmed", currentAmount, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] };
}

const warningCounts = { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 };

const opsAttendance: OpsAttendanceForDateDto = {
  operatingMonthId: "m-2026-10",
  attendanceDate: "2026-10-14",
  isLocked: false,
  statusOptions: [{ code: "NORMAL", displayName: "정상" }],
  rows: [
    { id: null, operatingMonthId: "m-2026-10", attendanceDate: "2026-10-14", employeeId: "ops-1", staffCode: "OPS-001", displayName: "Minh", position: "팀장", sortOrder: 1, statusCode: "NORMAL", statusDisplayName: "정상", isPayoutEligible: true, exclusionReason: null }
  ]
};

function opsDaily(overrides: Partial<OpsDailyIncentiveResultDto> = {}): OpsDailyIncentiveResultDto {
  return {
    operatingMonthId: "m-2026-10",
    serviceDate: "2026-10-14",
    isLocked: false,
    dailyOpsCallCount: 40,
    sourceCallCount: 40,
    appliedThresholdCallCount: null,
    personalIncentiveAmount: 0,
    ruleStatus: "missing_policy",
    warningMessage: "적용월에 활성 운영팀 일일 인센 정책이 없습니다.",
    eligibleCount: 1,
    distributedAmount: 0,
    warningCounts,
    rows: [
      { employeeId: "ops-1", staffCode: "OPS-001", displayName: "Minh", position: "팀장", statusCode: "NORMAL", statusDisplayName: "정상", isPayoutEligible: true, exclusionReason: null, payoutAmount: 0, calculationBasis: "정책 없음", payoutConfirmation: unconfirmedPayout(0) }
    ],
    callEvidence: [],
    ...overrides
  };
}

describe("ops daily view", () => {
  it("shows no basis instead of 0 when the daily incentive policy is missing", () => {
    const html = render(<OpsDailyView attendance={opsAttendance} canOpenLedger={false} canOpenStatement={false} initialEmployeeId="ops-1" result={opsDaily()} />);

    assert.match(html, /정책 없음/);
    assert.match(html, /근거 없음/);
    // 지급 확인(ADR 0004, 티켓 30·31)의 "현재 계산 금액"은 호출하는 쪽이 넘긴 값을 그대로 보이고 근거 없음으로 바꾸지 않는다.
    // 이 단언은 계산/근거 표시(표와 일일 인센 근거 구역)만 본다.
    const beforePayoutConfirmation = html.split('aria-label="지급 확인"')[0];
    assert.doesNotMatch(beforePayoutConfirmation, /0 VND/);
  });

  it("keeps a below-threshold day at a real 0", () => {
    const html = render(
      <OpsDailyView attendance={opsAttendance} canOpenLedger={false} canOpenStatement={false} initialEmployeeId={null} result={opsDaily({ ruleStatus: "below_threshold", dailyOpsCallCount: 20 })} />
    );

    assert.match(html, /30콜 미만/);
    assert.match(html, /0 VND/);
    assert.doesNotMatch(html, /근거 없음/);
  });
});

function opsMonthly(overrides: Partial<OpsMonthlyIncentiveResultDto> = {}): OpsMonthlyIncentiveResultDto {
  return {
    operatingMonthId: "m-2026-10",
    monthKey: "2026-10",
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    isClosedOrLocked: false,
    previewStatus: "draft_current",
    monthlyOpsCallCount: 1100,
    sourceCallCount: 1100,
    appliedThresholdCallCount: 1100,
    totalMonthlyIncentiveAmount: 5000000,
    ruleStatus: "applied",
    warningMessage: null,
    shares: { leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35, leadAmount: 1500000, counterTeamAmount: 1750000, waiterTeamAmount: 1750000, undistributedAmount: 0 },
    rows: [
      {
        employeeId: "ops-1",
        staffCode: "OPS-001",
        displayName: "Minh",
        position: "팀장",
        teamRole: "lead",
        teamShareLabel: "팀장 몫",
        payoutAmount: 1500000,
        calculationBasis: "팀장 몫 1500000 VND / 1명",
        payoutConfirmation: unconfirmedPayout(1500000)
      }
    ],
    warningCounts,
    callEvidence: [],
    ...overrides
  };
}

describe("ops monthly view", () => {
  it("draws each employee's expected payout and opens the rule basis panel", () => {
    const html = render(<OpsMonthlyView canOpenStatement={false} initialEmployeeId="ops-1" result={opsMonthly()} />);

    assert.match(html, /30% \/ 1,500,000 VND/);
    assert.match(html, /1,500,000 VND/);
    assert.match(html, /월 인센 근거/);
  });

  it("shows no basis for team portions and payouts when the monthly policy is missing", () => {
    const html = render(
      <OpsMonthlyView canOpenStatement={false} initialEmployeeId={null} result={opsMonthly({ ruleStatus: "missing_policy", totalMonthlyIncentiveAmount: 0, rows: [{ ...opsMonthly().rows[0], payoutAmount: 0 }] })} />
    );

    assert.match(html, /근거 없음/);
    assert.doesNotMatch(html, /0 VND/);
  });

  it("keeps an employee without a team at '-' and 0 even when the policy is missing, since they have no team share either way", () => {
    const unassigned = { ...opsMonthly().rows[0], employeeId: "ops-9", staffCode: "OPS-009", displayName: "Tuan", teamRole: "unassigned" as const, payoutAmount: 0 };
    const html = render(
      <OpsMonthlyView canOpenStatement={false} initialEmployeeId={null} result={opsMonthly({ ruleStatus: "missing_policy", totalMonthlyIncentiveAmount: 0, rows: [unassigned] })} />
    );

    assert.match(html, /Tuan[\s\S]*<td[^>]*>-<\/td>[\s\S]*0 VND/);
    assert.doesNotMatch(html, /근거 없음/);
  });
});

describe("settlement locked notice", () => {
  it("states the lock reason (the operating month status) and that the screen is read-only, in both languages", () => {
    const ko = render(<SettlementLockedNotice description="출퇴근 시간은 수정할 수 없습니다." locale="ko" monthStatus="마감확정" />);
    assert.match(ko, /잠김/);
    assert.match(ko, /마감확정 상태의 운영월은 읽기 전용입니다/);

    const vi = render(<SettlementLockedNotice description="..." locale="vi" monthStatus="잠금" />, "vi");
    assert.match(vi, /Đã khóa/);
    assert.match(vi, /chỉ được xem/);
  });
});
