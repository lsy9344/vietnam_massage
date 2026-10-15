import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { EarcareSettlementView } from "@/app/(erp)/settlements/earcare/earcare-settlement-view";
import { OpsMonthlyView } from "@/app/(erp)/settlements/operations/monthly/ops-monthly-view";
import { OpsDailyView } from "@/app/(erp)/settlements/operations/ops-daily-view";
import { SettlementLockedNotice } from "@/app/(erp)/settlements/settlement-parts";
import type { EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
import type { EarcareDailySettlementResultDto } from "@/modules/settlements/earcare-daily-settlement-service";
import type { OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import type { OpsDailyIncentiveResultDto } from "@/modules/settlements/ops-daily-incentive-service";
import type { OpsMonthlyIncentiveResultDto } from "@/modules/settlements/ops-monthly-incentive-service";

function render(element: ReactElement, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(renderInShell(element, locale));
}

const warningCounts = { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 };
const poolCall = {
  serviceCallId: "call-9",
  operatingMonthId: "m-2026-10",
  serviceDate: "2026-10-14",
  startTime: "15:30",
  courseCode: "B",
  therapistNames: ["Thu"],
  status: "방문완료"
};

const earcareAttendance: EarcareAttendanceForDateDto = {
  operatingMonthId: "m-2026-10",
  attendanceDate: "2026-10-14",
  isLocked: false,
  statusOptions: [
    { code: "NORMAL", displayName: "정상" },
    { code: "DAY_OFF", displayName: "휴무" }
  ],
  rows: [
    { id: null, operatingMonthId: "m-2026-10", attendanceDate: "2026-10-14", employeeId: "ear-1", staffCode: "EAR-001", displayName: "Hoa", sortOrder: 1, statusCode: "NORMAL", statusDisplayName: "정상", isPayoutEligible: true, exclusionReason: null },
    { id: "a-2", operatingMonthId: "m-2026-10", attendanceDate: "2026-10-14", employeeId: "ear-2", staffCode: "EAR-002", displayName: "Lan", sortOrder: 2, statusCode: "DAY_OFF", statusDisplayName: "휴무", isPayoutEligible: false, exclusionReason: "휴무" }
  ]
};

function earcareResult(overrides: Partial<EarcareDailySettlementResultDto> = {}): EarcareDailySettlementResultDto {
  return {
    operatingMonthId: "m-2026-10",
    serviceDate: "2026-10-14",
    isLocked: false,
    earcarePoolTotal: 0,
    sourceCallCount: 0,
    eligibleCount: 1,
    baseShareAmount: 0,
    remainderAmount: 0,
    distributedAmount: 0,
    undistributedAmount: 0,
    warningCounts,
    rows: [
      { employeeId: "ear-1", staffCode: "EAR-001", displayName: "Hoa", statusCode: "NORMAL", statusDisplayName: "정상", isPayoutEligible: true, exclusionReason: null, baseShareAmount: 0, remainderShareAmount: 0, payoutAmount: 0, calculationBasis: "방문완료 풀 0 VND / 정상 근무자 1명" },
      { employeeId: "ear-2", staffCode: "EAR-002", displayName: "Lan", statusCode: "DAY_OFF", statusDisplayName: "휴무", isPayoutEligible: false, exclusionReason: "휴무", baseShareAmount: 0, remainderShareAmount: 0, payoutAmount: 0, calculationBasis: "휴무 제외" }
    ],
    poolEvidence: [],
    ...overrides
  };
}

describe("earcare settlement view", () => {
  it("shows no basis for an eligible worker when no completed call made a pool, but 0 for a worker excluded by status", () => {
    const html = render(<EarcareSettlementView attendance={earcareAttendance} canOpenLedger={false} initialEmployeeId={null} result={earcareResult()} />);

    assert.match(html, /Hoa[\s\S]*?근거 없음[\s\S]*Lan/);
    assert.match(html, /Lan[\s\S]*제외: 휴무[\s\S]*0 VND/);
  });

  it("puts the work status correction, pool distribution basis, and pool calls in the selected worker's panel", () => {
    const html = render(
      <EarcareSettlementView
        attendance={earcareAttendance}
        canOpenLedger
        initialEmployeeId="ear-1"
        result={earcareResult({
          earcarePoolTotal: 300000,
          sourceCallCount: 1,
          baseShareAmount: 300000,
          distributedAmount: 300000,
          rows: earcareResult().rows.map((row) => (row.employeeId === "ear-1" ? { ...row, baseShareAmount: 300000, payoutAmount: 300000 } : row)),
          poolEvidence: [{ serviceCallId: "call-9", serviceDate: "2026-10-14", earcarePoolAmount: 300000, call: poolCall }]
        })}
      />
    );

    assert.match(html, /<aside aria-label="Hoa \(EAR-001\)"/);
    assert.match(html, /<select aria-label="Hoa 근무상태"[^>]*class="h-11 /);
    assert.match(html, /풀 분배 근거/);
    assert.match(html, /풀 산출 근거/);
    assert.match(html, /href="\/calls\?operatingMonthId=m-2026-10&amp;serviceDate=2026-10-14&amp;call=call-9"/);
  });

  it("gives a settlement manager the pool call summary without a ledger link", () => {
    const html = render(
      <EarcareSettlementView
        attendance={earcareAttendance}
        canOpenLedger={false}
        initialEmployeeId="ear-1"
        result={earcareResult({ sourceCallCount: 1, poolEvidence: [{ serviceCallId: "call-9", serviceDate: "2026-10-14", earcarePoolAmount: 300000, call: poolCall }] })}
      />
    );

    assert.doesNotMatch(html, /href="\/calls/);
    assert.match(html, /2026-10-14 15:30[\s\S]*B[\s\S]*Thu[\s\S]*방문완료/);
  });
});

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
    dailyOpsCallCredit: 40,
    sourceCallCount: 40,
    appliedThresholdCallCount: null,
    personalIncentiveAmount: 0,
    ruleStatus: "missing_policy",
    warningMessage: "적용월에 활성 운영팀 일일 인센 정책이 없습니다.",
    eligibleCount: 1,
    distributedAmount: 0,
    warningCounts,
    rows: [
      { employeeId: "ops-1", staffCode: "OPS-001", displayName: "Minh", position: "팀장", statusCode: "NORMAL", statusDisplayName: "정상", isPayoutEligible: true, exclusionReason: null, payoutAmount: 0, calculationBasis: "정책 없음" }
    ],
    callEvidence: [],
    ...overrides
  };
}

describe("ops daily view", () => {
  it("shows no basis instead of 0 when the daily incentive policy is missing", () => {
    const html = render(<OpsDailyView attendance={opsAttendance} canOpenLedger={false} initialEmployeeId="ops-1" result={opsDaily()} />);

    assert.match(html, /정책 없음/);
    assert.match(html, /근거 없음/);
    assert.doesNotMatch(html, /0 VND/);
  });

  it("keeps a below-threshold day at a real 0", () => {
    const html = render(
      <OpsDailyView attendance={opsAttendance} canOpenLedger={false} initialEmployeeId={null} result={opsDaily({ ruleStatus: "below_threshold", dailyOpsCallCredit: 20 })} />
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
    monthlyOpsCallCredit: 1100,
    sourceCallCount: 1100,
    appliedThresholdCallCount: 1100,
    totalMonthlyIncentiveAmount: 5000000,
    ruleStatus: "applied",
    warningMessage: null,
    shares: { leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35, leadAmount: 1500000, counterTeamAmount: 1750000, waiterTeamAmount: 1750000, undistributedAmount: 0 },
    rows: [{ employeeId: "ops-1", staffCode: "OPS-001", displayName: "Minh", position: "팀장", teamRole: "lead", teamShareLabel: "팀장 몫", payoutAmount: 1500000, calculationBasis: "팀장 몫 1500000 VND / 1명" }],
    warningCounts,
    callEvidence: [],
    ...overrides
  };
}

describe("ops monthly view", () => {
  it("draws each employee's expected payout and opens the rule basis panel", () => {
    const html = render(<OpsMonthlyView initialEmployeeId="ops-1" result={opsMonthly()} />);

    assert.match(html, /30% \/ 1,500,000 VND/);
    assert.match(html, /1,500,000 VND/);
    assert.match(html, /월 인센 근거/);
  });

  it("shows no basis for team portions and payouts when the monthly policy is missing", () => {
    const html = render(
      <OpsMonthlyView initialEmployeeId={null} result={opsMonthly({ ruleStatus: "missing_policy", totalMonthlyIncentiveAmount: 0, rows: [{ ...opsMonthly().rows[0], payoutAmount: 0 }] })} />
    );

    assert.match(html, /근거 없음/);
    assert.doesNotMatch(html, /0 VND/);
  });

  it("keeps an employee without a team at '-' and 0 even when the policy is missing, since they have no team share either way", () => {
    const unassigned = { ...opsMonthly().rows[0], employeeId: "ops-9", staffCode: "OPS-009", displayName: "Tuan", teamRole: "unassigned" as const, payoutAmount: 0 };
    const html = render(
      <OpsMonthlyView initialEmployeeId={null} result={opsMonthly({ ruleStatus: "missing_policy", totalMonthlyIncentiveAmount: 0, rows: [unassigned] })} />
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
