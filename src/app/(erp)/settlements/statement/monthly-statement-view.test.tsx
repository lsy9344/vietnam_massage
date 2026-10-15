import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { MonthlyStatementView } from "@/app/(erp)/settlements/statement/monthly-statement-view";
import type { MonthlyStatementDto } from "@/modules/settlements/monthly-statement-service";

function call(serviceCallId: string, startTime: string) {
  return {
    serviceCallId,
    operatingMonthId: "month-1",
    serviceDate: "2026-06-01",
    startTime,
    courseCode: "A",
    therapistNames: ["Mai"],
    status: "VISIT_COMPLETE"
  };
}

function draftTherapistResult(overrides: Partial<MonthlyStatementDto> = {}): MonthlyStatementDto {
  return {
    operatingMonthId: "month-1",
    monthKey: "2026-06",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    employeeId: "emp-1",
    displayName: "Mai",
    staffCode: "THR-001",
    employeeGroup: "THERAPIST",
    isConfirmed: false,
    closeVersion: null,
    confirmedAt: null,
    confirmedByAccountId: null,
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    availableVersions: [],
    finalAmount: 3600000,
    summary: {
      kind: "THERAPIST",
      totalCallCount: 2,
      monthlySettlementAmount: 1600000,
      fullAttendanceDays: 22,
      fullAttendanceAllowanceAmount: 2000000,
      countKingRank: null,
      countKingBonusAmount: 0
    },
    evidence: {
      available: true,
      dailyEntries: [
        {
          serviceDate: "2026-06-01",
          attendanceSummary: "09:00–18:00",
          callCount: 2,
          amount: 1600000,
          calls: [call("call-a", "14:00")],
          appliedPolicies: [
            { serviceCallId: "call-a", courseId: "course-a", courseCode: "A", role: "THERAPIST_1", employeeId: "emp-1", commissionAmount: 1600000, rateStatus: "applied", call: call("call-a", "14:00") }
          ],
          payoutConfirmation: { status: "confirmed", currentAmount: 1600000, lastConfirmedAmount: 1600000, difference: 0, requiresReconfirmation: false, history: [] }
        }
      ]
    },
    payoutUnits: [
      { serviceDate: "2026-06-01", payoutConfirmation: { status: "confirmed", currentAmount: 1600000, lastConfirmedAmount: 1600000, difference: 0, requiresReconfirmation: false, history: [] } }
    ],
    ...overrides
  };
}

describe("MonthlyStatementView", () => {
  it("미확정 Therapist 명세서를 날짜별 근거(출근·콜 목록·금액·지급 확인)와 함께 그린다", () => {
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={true} result={draftTherapistResult()} />, "ko"));

    assert.match(html, /미확정/);
    assert.match(html, /Mai/);
    assert.match(html, /THR-001/);
    assert.match(html, /3,600,000/);
    assert.match(html, /09:00–18:00/);
    assert.match(html, /14:00/);
    assert.match(html, /원장에서 보기/);
    assert.match(html, /확인됨/);
    assert.match(html, /이 문서는 수당 명세이며 송금 영수증이 아닙니다/);
    // S9(V08): 적용 정책 근거(코스 수당).
    assert.match(html, /적용 정책/);
    assert.match(html, /마사지사1/);
    assert.match(html, /정책 적용/);
    assert.match(html, /1,600,000/);
  });

  it("S9(V08): 코스 수당이 0원 정책이거나 아예 없으면(이중 역할 포함) 콜마다 그 상태를 함께 보인다", () => {
    const withPolicies = draftTherapistResult({
      evidence: {
        available: true,
        dailyEntries: [
          {
            serviceDate: "2026-06-01",
            attendanceSummary: "09:00–18:00",
            callCount: 1,
            amount: 0,
            calls: [call("call-b", "15:00")],
            appliedPolicies: [
              { serviceCallId: "call-b", courseId: "course-a", courseCode: "A", role: "THERAPIST_1", employeeId: "emp-1", commissionAmount: 0, rateStatus: "zero_policy", call: call("call-b", "15:00") },
              { serviceCallId: "call-b", courseId: "course-a", courseCode: "A", role: "THERAPIST_2", employeeId: "emp-1", commissionAmount: 0, rateStatus: "missing_policy", call: call("call-b", "15:00") }
            ],
            payoutConfirmation: null
          }
        ]
      }
    });
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={true} result={withPolicies} />, "ko"));

    assert.match(html, /마사지사1/);
    assert.match(html, /마사지사2/);
    assert.match(html, /0원 정책/);
    assert.match(html, /정책 없음/);
  });

  it("관리자가 아니면(canOpenLedger=false) 근거 콜에 원장 링크를 주지 않는다", () => {
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={false} result={draftTherapistResult()} />, "ko"));

    assert.doesNotMatch(html, /원장에서 보기/);
    assert.doesNotMatch(html, /href="\/calls/);
  });

  it("마감 버전을 보는 중이면 날짜별 근거 자리에 '저장되지 않았습니다' 안내만 두고 다시 계산한 값을 만들어 내지 않는다", () => {
    const closed = draftTherapistResult({
      isConfirmed: true,
      closeVersion: 2,
      confirmedAt: "2026-07-01T09:00:00.000Z",
      confirmedByAccountId: "account-admin",
      evidence: { available: false, notice: "이 마감 버전에는 해당 근거가 저장되지 않았습니다." }
    });
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={true} result={closed} />, "ko"));

    assert.match(html, /마감 버전 2/);
    assert.match(html, /이 마감 버전에는 해당 근거가 저장되지 않았습니다/);
    assert.doesNotMatch(html, /09:00–18:00/);
  });

  it("귀케어·운영팀 직원 요약도 그 직군 금액 구성으로 그린다", () => {
    const earcare = draftTherapistResult({
      employeeGroup: "EARCARE",
      finalAmount: 300000,
      summary: { kind: "EARCARE", payoutAmount: 300000, calculationBasis: "방문완료 풀 300,000 VND / 정상 근무자 2명", eligibleDayCount: 2 },
      evidence: { available: true, dailyEntries: [] },
      payoutUnits: []
    });
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={false} result={earcare} />, "ko"));

    assert.match(html, /귀케어 풀 분배/);
    assert.match(html, /지급 대상일 2일/);

    const operations = draftTherapistResult({
      employeeGroup: "OPERATIONS",
      finalAmount: 600000,
      summary: { kind: "OPERATIONS", dailyIncentiveAmount: 100000, monthlyIncentiveAmount: 500000, monthlyCalculationBasis: null, dailyEvidenceCount: 2 },
      evidence: { available: true, dailyEntries: [] },
      payoutUnits: [{ serviceDate: null, payoutConfirmation: { status: "confirmed", currentAmount: 500000, lastConfirmedAmount: 500000, difference: 0, requiresReconfirmation: false, history: [] } }]
    });
    const opsHtml = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={false} result={operations} />, "ko"));

    assert.match(opsHtml, /일일 인센티브 합계/);
    assert.match(opsHtml, /적용월에 월 인센 정책이 없습니다/);
    assert.match(opsHtml, /월 인센티브/);
  });

  it("베트남어 화면에서도 깨지지 않고 locale 문구로 그린다", () => {
    const html = renderToStaticMarkup(renderInShell(<MonthlyStatementView canOpenLedger={true} result={draftTherapistResult()} />, "vi"));

    assert.match(html, /Chưa chốt/);
    assert.match(html, /Mai/);
    assert.match(html, /Đã xác nhận/);
  });
});
