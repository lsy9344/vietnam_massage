import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  incentiveRuleHasBasis,
  payoutAmount,
  settlementAmount,
  therapistComparisonRows,
  therapistCourseAmount,
  therapistDailyTotal,
  therapistEvidenceAmount,
  therapistSettlementAmount
} from "@/app/(erp)/settlements/settlement-view-model";
import type { TherapistAttendanceDto } from "@/modules/settlements/therapist-attendance-service";
import type {
  TherapistAssignmentEvidenceDto,
  TherapistDailySettlementDto
} from "@/modules/settlements/therapist-daily-settlement-service";

function evidence(overrides: Partial<TherapistAssignmentEvidenceDto> = {}): TherapistAssignmentEvidenceDto {
  return {
    serviceCallId: "call-1",
    courseId: "course-a",
    courseCode: "A",
    role: "THERAPIST_1",
    employeeId: "thr-1",
    commissionAmount: 700000,
    rateStatus: "applied",
    call: {
      serviceCallId: "call-1",
      operatingMonthId: "m-2026-10",
      serviceDate: "2026-10-14",
      startTime: "14:00",
      courseCode: "A",
      therapistNames: ["Mai"],
      status: "방문완료"
    },
    ...overrides
  };
}

function settlement(overrides: Partial<TherapistDailySettlementDto> = {}): TherapistDailySettlementDto {
  const emptyCourse = (courseCode: "A" | "B" | "C" | "D" | "E") => ({ courseCode, callCount: 0, commissionAmount: 0 });
  return {
    employeeId: "thr-1",
    displayName: "Mai",
    staffCode: "THR-001",
    sortOrder: 1,
    totalCallCount: 1,
    totalCommissionAmount: 700000,
    courseBreakdown: { A: { courseCode: "A", callCount: 1, commissionAmount: 700000 }, B: emptyCourse("B"), C: emptyCourse("C"), D: emptyCourse("D"), E: emptyCourse("E") },
    assignmentEvidence: [evidence()],
    warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
    payoutConfirmation: { status: "unconfirmed", currentAmount: 700000, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] },
    ...overrides
  };
}

function attendance(overrides: Partial<TherapistAttendanceDto> = {}): TherapistAttendanceDto {
  return {
    id: null,
    operatingMonthId: "m-2026-10",
    attendanceDate: "2026-10-14",
    employeeId: "thr-1",
    staffCode: "THR-001",
    displayName: "Mai",
    sortOrder: 1,
    checkInTime: null,
    checkOutTime: null,
    standbyMinutes: null,
    isFullAttendanceRecognized: false,
    isComplete: false,
    incompleteReason: null,
    isLocked: false,
    warnings: [],
    ...overrides
  };
}

const missing = (serviceCallId: string) =>
  evidence({ serviceCallId, commissionAmount: 0, rateStatus: "missing_policy" });

describe("settlement amounts", () => {
  it("draws the value when the calculation has a basis and 'no basis' instead of 0 when it does not", () => {
    assert.deepEqual(settlementAmount(0, true), { kind: "amount", value: 0 });
    assert.deepEqual(settlementAmount(0, false), { kind: "noBasis" });
  });

  it("keeps an employee excluded by attendance at 0, since exclusion is the decision, but an eligible one without a basis has no basis", () => {
    assert.deepEqual(payoutAmount(0, { isPayoutEligible: false, hasBasis: false }), { kind: "amount", value: 0 });
    assert.deepEqual(payoutAmount(0, { isPayoutEligible: true, hasBasis: false }), { kind: "noBasis" });
    assert.deepEqual(payoutAmount(250000, { isPayoutEligible: true, hasBasis: true }), { kind: "amount", value: 250000 });
  });

  it("treats a missing incentive policy as no basis, while a total below the threshold is a real 0", () => {
    assert.equal(incentiveRuleHasBasis("missing_policy"), false);
    assert.equal(incentiveRuleHasBasis("below_threshold"), true);
    assert.equal(incentiveRuleHasBasis("applied"), true);
  });
});

describe("therapist amounts", () => {
  it("shows a commission left at 0 for a missing policy as no basis, but an explicit 0 VND policy as 0", () => {
    assert.deepEqual(therapistEvidenceAmount(missing("call-x")), { kind: "noBasis" });
    assert.deepEqual(therapistEvidenceAmount(evidence({ commissionAmount: 0, rateStatus: "zero_policy" })), { kind: "amount", value: 0 });
    assert.deepEqual(therapistEvidenceAmount(evidence()), { kind: "amount", value: 700000 });
  });

  it("has no basis for a therapist without completed calls or whose every call lacks a policy", () => {
    assert.deepEqual(therapistSettlementAmount(null), { kind: "noBasis" });
    assert.deepEqual(
      therapistSettlementAmount(settlement({ totalCommissionAmount: 0, assignmentEvidence: [missing("call-1"), missing("call-2")] })),
      { kind: "noBasis" }
    );
  });

  it("keeps the service total when at least one call has a policy", () => {
    assert.deepEqual(
      therapistSettlementAmount(settlement({ totalCommissionAmount: 700000, assignmentEvidence: [evidence(), missing("call-2")] })),
      { kind: "amount", value: 700000 }
    );
  });

  it("sums the day from the service rows and has no basis when no row has a policy", () => {
    assert.deepEqual(therapistDailyTotal([]), { kind: "noBasis" });
    assert.deepEqual(
      therapistDailyTotal([settlement(), settlement({ employeeId: "thr-2", totalCommissionAmount: 900000 })]),
      { kind: "amount", value: 1600000 }
    );
    assert.deepEqual(therapistDailyTotal([settlement({ totalCommissionAmount: 0, assignmentEvidence: [missing("call-1")] })]), {
      kind: "noBasis"
    });
  });

  it("gives each course the service's breakdown, with no basis when that course's calls all lack a policy", () => {
    const row = settlement({
      courseBreakdown: {
        ...settlement().courseBreakdown,
        B: { courseCode: "B", callCount: 1, commissionAmount: 0 }
      },
      assignmentEvidence: [evidence(), missing("call-b")].map((item, index) => (index === 1 ? { ...item, courseCode: "B" } : item))
    });
    assert.deepEqual(therapistCourseAmount(row, "A"), { kind: "amount", value: 700000 });
    assert.deepEqual(therapistCourseAmount(row, "B"), { kind: "noBasis" });
  });
});

describe("therapist comparison rows", () => {
  it("lists every active therapist from attendance with their settlement, plus therapists who only have calls, in sort order", () => {
    const rows = therapistComparisonRows(
      [settlement({ employeeId: "thr-2", displayName: "Linh", staffCode: "THR-002", sortOrder: 2 }), settlement({ employeeId: "thr-old", displayName: "Old", staffCode: "THR-009", sortOrder: 9 })],
      [attendance(), attendance({ employeeId: "thr-2", displayName: "Linh", staffCode: "THR-002", sortOrder: 2, checkInTime: "10:00" })]
    );

    assert.deepEqual(
      rows.map((row) => [row.employeeId, row.attendance?.checkInTime ?? "-", row.settlement ? row.settlement.totalCallCount : "-"]),
      [
        ["thr-1", "-", "-"],
        ["thr-2", "10:00", 1],
        ["thr-old", "-", 1]
      ]
    );
  });

  it("still lists therapists when one of the two reads failed", () => {
    assert.deepEqual(
      therapistComparisonRows(null, [attendance()]).map((row) => [row.employeeId, row.settlement]),
      [["thr-1", null]]
    );
    assert.deepEqual(
      therapistComparisonRows([settlement()], null).map((row) => [row.employeeId, row.attendance]),
      [["thr-1", null]]
    );
  });

  it("orders by sort order, then staff code", () => {
    const rows = therapistComparisonRows(null, [
      attendance({ employeeId: "b", staffCode: "THR-002", sortOrder: 1 }),
      attendance({ employeeId: "a", staffCode: "THR-001", sortOrder: 1 }),
      attendance({ employeeId: "c", staffCode: "THR-000", sortOrder: 0 })
    ]);
    assert.deepEqual(
      rows.map((row) => row.employeeId),
      ["c", "a", "b"]
    );
  });
});
