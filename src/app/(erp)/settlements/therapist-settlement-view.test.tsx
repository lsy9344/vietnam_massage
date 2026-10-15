import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { renderInShell } from "@/components/shell/test-harness";
import { therapistComparisonRows } from "@/app/(erp)/settlements/settlement-view-model";
import { TherapistSettlementView } from "@/app/(erp)/settlements/therapist-settlement-view";
import type { TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";
import type { TherapistDailySettlementDto } from "@/modules/settlements/therapist-daily-settlement-service";

const call = (serviceCallId: string, startTime: string) => ({
  serviceCallId,
  operatingMonthId: "m-2026-10",
  serviceDate: "2026-10-14",
  startTime,
  courseCode: "A",
  therapistNames: ["Mai", "Linh"],
  status: "VISIT_COMPLETE"
});

const mai: TherapistDailySettlementDto = {
  employeeId: "thr-1",
  displayName: "Mai",
  staffCode: "THR-001",
  sortOrder: 1,
  totalCallCount: 2,
  totalCommissionAmount: 700000,
  courseBreakdown: {
    A: { courseCode: "A", callCount: 2, commissionAmount: 700000 },
    B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
    C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
    D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
    E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
  },
  assignmentEvidence: [
    { serviceCallId: "call-1", courseId: "course-a", courseCode: "A", role: "THERAPIST_1", employeeId: "thr-1", commissionAmount: 700000, rateStatus: "applied", call: call("call-1", "14:00") },
    { serviceCallId: "call-2", courseId: "course-a", courseCode: "A", role: "THERAPIST_2", employeeId: "thr-1", commissionAmount: 0, rateStatus: "missing_policy", call: call("call-2", "16:30") }
  ],
  warningCounts: { zeroPolicy: 0, missingPolicy: 1 },
  payoutConfirmation: { status: "unconfirmed", currentAmount: 700000, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] }
};

const maiAttendance: TherapistAttendanceDto = {
  id: "att-1",
  operatingMonthId: "m-2026-10",
  attendanceDate: "2026-10-14",
  employeeId: "thr-1",
  staffCode: "THR-001",
  displayName: "Mai",
  sortOrder: 1,
  checkInTime: "10:00",
  checkOutTime: "20:00",
  standbyMinutes: 600,
  isFullAttendanceRecognized: true,
  isComplete: true,
  incompleteReason: null,
  isLocked: false,
  warnings: []
};

const thuAttendance: TherapistAttendanceDto = {
  ...maiAttendance,
  id: null,
  employeeId: "thr-2",
  staffCode: "THR-002",
  displayName: "Thu",
  sortOrder: 2,
  checkInTime: null,
  checkOutTime: null,
  standbyMinutes: null,
  isFullAttendanceRecognized: false,
  isComplete: false
};

function render(overrides: Partial<Parameters<typeof TherapistSettlementView>[0]> = {}, locale: "ko" | "vi" = "ko") {
  return renderToStaticMarkup(
    renderInShell(
      <TherapistSettlementView
        attendanceAvailable
        attendanceDisabled={false}
        canOpenLedger={false}
        canOpenStatement={false}
        initialEmployeeId="thr-1"
        operatingMonthId="m-2026-10"
        paymentLocked={false}
        rows={therapistComparisonRows([mai], [maiAttendance, thuAttendance])}
        serviceDate="2026-10-14"
        {...overrides}
      />,
      locale
    )
  );
}

describe("therapist settlement view", () => {
  it("compares every therapist in one table, with right-aligned amounts and 'no basis' for a therapist without calls", () => {
    const html = render({ initialEmployeeId: null });

    assert.match(html, /<table aria-label="마사지사별 당일정산"/);
    assert.match(html, /10:00–20:00/);
    assert.match(html, /만근 인정 \(600분\)/);
    assert.match(html, /<td class="[^"]*text-right"><span class="font-semibold">700,000 VND<\/span><\/td>/);
    // Thu는 그날 방문완료 담당 콜이 없다: 0 VND가 아니라 근거 없음.
    assert.match(html, /Thu[\s\S]*0건[\s\S]*근거 없음/);
    assert.doesNotMatch(html, /Thu[\s\S]*0 VND/);
    assert.match(html, /직원을 고르면 옆에 그 직원의 계산 근거가 보입니다/);
    assert.doesNotMatch(html, /<aside/);
  });

  it("shows the selected therapist's attendance, evidence calls, course amounts, and payment in the panel", () => {
    const html = render();

    assert.match(html, /<aside aria-label="Mai \(THR-001\)"/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /aria-label="Mai 출근시간"[^>]*value="10:00"/);
    assert.match(html, /콜별 산출 근거/);
    assert.match(html, /2026-10-14 14:00/);
    assert.match(html, /정책 적용/);
    // 정책이 없어 0원으로 남은 담당 건은 0원이 아니라 근거 없음이다.
    assert.match(html, /2026-10-14 16:30[\s\S]*?근거 없음/);
    assert.match(html, /A 수량\/금액/);
    assert.match(html, />미확인</);
    assert.match(html, />지급 확인<\/button>/);
  });

  it("links each evidence call to that date and call in the ledger for an administrator", () => {
    const html = render({ canOpenLedger: true });

    assert.match(html, /href="\/calls\?operatingMonthId=m-2026-10&amp;serviceDate=2026-10-14&amp;call=call-1"/);
    assert.match(html, /원장에서 보기/);
  });

  it("gives a settlement manager the call summary in place, without a ledger link", () => {
    const html = render({ canOpenLedger: false });

    assert.doesNotMatch(html, /href="\/calls/);
    assert.doesNotMatch(html, /원장에서 보기/);
    // 날짜, 예약시각, 코스, Therapist, 상태
    assert.match(html, /2026-10-14 14:00/);
    assert.match(html, />A</);
    assert.match(html, /Mai, Linh/);
    assert.match(html, /방문완료/);
  });

  it("says there is an in-service call when the saved checkout comes back with that warning", () => {
    const warned = { ...maiAttendance, warnings: [{ code: "IN_SERVICE_CALL" as const, serviceCallIds: ["call-in-use"] }] };
    const rows = therapistComparisonRows([mai], [warned, thuAttendance]);
    assert.match(render({ rows }), /시술 중인 콜이 있습니다/);
    assert.match(render({ rows }, "vi"), /Có ca đang làm/);
    assert.doesNotMatch(render(), /시술 중인 콜이 있습니다/);
  });

  it("keeps a locked month read-only: attendance inputs disabled and no payment change", () => {
    const html = render({ attendanceDisabled: true, paymentLocked: true });

    assert.match(html, /aria-label="Mai 출근시간"[^>]*disabled=""/);
    assert.doesNotMatch(html, />지급 확인<\/button>/);
    assert.match(html, />잠금</);
  });

  it("renders in Vietnamese", () => {
    const html = render({}, "vi");

    assert.match(html, /Căn cứ tính theo cuộc gọi/);
    assert.match(html, /Chưa có căn cứ/);
    assert.doesNotMatch(html, /근거 없음|콜별 산출 근거/);
  });
});
