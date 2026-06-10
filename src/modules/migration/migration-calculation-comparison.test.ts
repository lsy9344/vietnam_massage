import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDailyCallLedgerSummary,
  listCompletedServiceCallCalculationsForDate,
  saveBasicServiceCallRow,
  ServiceCallDomainError
} from "@/modules/calls/service-call-service";
import { listMonthlyClosingPreview } from "@/modules/closing/monthly-closing-preview-service";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import { listEarcareDailySettlements } from "@/modules/settlements/earcare-daily-settlement-service";
import { listOpsDailyIncentives } from "@/modules/settlements/ops-daily-incentive-service";
import { listOpsMonthlyIncentivePreview } from "@/modules/settlements/ops-monthly-incentive-service";
import { listTherapistDailySettlements } from "@/modules/settlements/therapist-daily-settlement-service";
import {
  MIGRATION_CALCULATION_FIXTURE,
  MIGRATION_EXPECTED_RESULTS,
  MIGRATION_SOURCE_REFERENCES,
  type MigrationMismatchReport
} from "../../../tests/fixtures/migration-calculation-comparison";
import { createMigrationCalculationPrisma } from "../../../tests/fixtures/migration-calculation-prisma";

const monthId = MIGRATION_CALCULATION_FIXTURE.operatingMonth.id;
const comparisonDate = "2034-06-15";

function mismatchReport(input: Omit<MigrationMismatchReport, "sourceReference" | "relatedRequirement"> & { sourceReference?: string; relatedRequirement?: string }) {
  return {
    area: input.area,
    fixtureId: input.fixtureId,
    expected: input.expected,
    actual: input.actual,
    sourceReference: input.sourceReference ?? MIGRATION_SOURCE_REFERENCES.realtimeLedger,
    relatedRequirement: input.relatedRequirement ?? "Story 7.2 / PRD FR-37",
    message: input.message
  };
}

function assertMigrationComparisonEqual(input: {
  area: string;
  fixtureId: string;
  expected: unknown;
  actual: unknown;
  message: string;
  sourceReference?: string;
  relatedRequirement?: string;
}) {
  try {
    assert.deepEqual(input.actual, input.expected);
  } catch (error) {
    const report = mismatchReport(input);
    throw new Error(`Story 7.2 calculation mismatch\n${JSON.stringify(report, null, 2)}`, { cause: error });
  }
}

function emptyTherapistDay(serviceDate: string) {
  return {
    operatingMonthId: monthId,
    serviceDate,
    settlements: [],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    excludedCallCount: 0
  };
}

function therapistDay(serviceDate: string) {
  const fixtureDay = MIGRATION_CALCULATION_FIXTURE.monthlyClosingInputs.therapistDailySettlements.find((day) => day.serviceDate === serviceDate);
  if (!fixtureDay) return emptyTherapistDay(serviceDate);
  return {
    operatingMonthId: monthId,
    serviceDate,
    settlements: fixtureDay.settlements,
    warningCounts: fixtureDay.warningCounts,
    excludedCallCount: fixtureDay.excludedCallCount
  };
}

function emptyOpsDay(serviceDate: string) {
  return {
    operatingMonthId: monthId,
    serviceDate,
    dailyOpsCallCredit: 0,
    sourceCallCount: 0,
    appliedThresholdCallCount: null,
    personalIncentiveAmount: 0,
    ruleStatus: "below_threshold",
    warningMessage: "30콜 미만으로 운영팀 일일 인센이 없습니다.",
    eligibleCount: 0,
    distributedAmount: 0,
    warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    rows: [],
    callEvidence: []
  };
}

function emptyEarcareDay(serviceDate: string) {
  return {
    operatingMonthId: monthId,
    serviceDate,
    earcarePoolTotal: 0,
    sourceCallCount: 0,
    eligibleCount: 0,
    baseShareAmount: 0,
    remainderAmount: 0,
    distributedAmount: 0,
    undistributedAmount: 0,
    warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    rows: [],
    poolEvidence: []
  };
}

describe("Story 7.2 migration calculation comparison", () => {
  it("대조: fixture는 상태 6종, stable ID, source reference, mismatch report shape를 보존한다", () => {
    const statuses = new Set(MIGRATION_CALCULATION_FIXTURE.serviceCalls.map((call) => call.status));
    for (const status of ["방문완료", "예약", "사용중", "청소중", "노쇼", "취소"] as const) {
      assert.ok(statuses.has(status), `${status} fixture missing`);
    }
    assert.ok(MIGRATION_CALCULATION_FIXTURE.rooms.every((room) => room.id.startsWith("room-")));
    assert.ok(MIGRATION_CALCULATION_FIXTURE.employees.every((employee) => employee.id.includes("-")));
    assert.match(MIGRATION_SOURCE_REFERENCES.realtimeLedger, /sheet_erp_design\.md/);
    assert.match(MIGRATION_SOURCE_REFERENCES.realtimeLedger, /A:S/);
    assert.match(MIGRATION_SOURCE_REFERENCES.realtimeLedger, /셀 좌표|range|Evidence/);
    assert.deepEqual(
      { recognizedHoursThreshold: MIGRATION_CALCULATION_FIXTURE.monthlyClosingInputs.fullAttendanceRecognitions.rows[0].recognizedHoursThreshold },
      { recognizedHoursThreshold: 8 }
    );
    assert.deepEqual(Object.keys(mismatchReport({ area: "calls", fixtureId: "call-complete-a-discount", expected: 1, actual: 2, message: "mismatch" })), [
      "area",
      "fixtureId",
      "expected",
      "actual",
      "sourceReference",
      "relatedRequirement",
      "message"
    ]);
  });

  it("대조: 방문완료만 결제, 할인, 수당, 귀케어 풀, 콜인정 계산에 포함한다", async () => {
    const prismaClient = createMigrationCalculationPrisma();
    const calculations = await listCompletedServiceCallCalculationsForDate({ operatingMonthId: monthId, serviceDate: comparisonDate, prismaClient });
    assertMigrationComparisonEqual({
      area: "calls.completedIds",
      fixtureId: comparisonDate,
      expected: MIGRATION_EXPECTED_RESULTS.callCalculation.completedIds,
      actual: calculations.map((calculation) => calculation.serviceCallId),
      message: "방문완료 calculated 콜 목록이 fixture 기대값과 다릅니다."
    });

    const byId = new Map(calculations.map((calculation) => [calculation.serviceCallId, calculation]));
    for (const [fixtureId, expected] of Object.entries(MIGRATION_EXPECTED_RESULTS.callCalculation.payments)) {
      const actual = byId.get(fixtureId);
      assert.ok(actual, `${fixtureId} calculation missing`);
      assertMigrationComparisonEqual({
        area: "calls.payment",
        fixtureId,
        expected,
        actual: {
          basePrice: actual.basePrice,
          discountAmount: actual.discountAmount,
          paymentAmount: actual.paymentAmount,
          earcarePoolAmount: actual.earcarePoolAmount,
          opsCallCredit: actual.opsCallCredit
        },
        message: "코스 기본판매가, 할인, 결제금액, 귀케어풀, 콜인정 대조가 실패했습니다."
      });
    }

    const d = byId.get("call-complete-d-two-therapists");
    assertMigrationComparisonEqual({
      area: "calls.dCourseAssignments",
      fixtureId: "call-complete-d-two-therapists",
      expected: [
        { role: "THERAPIST_1", employeeId: "therapist-thr-001", commissionAmount: 900000 },
        { role: "THERAPIST_2", employeeId: "therapist-thr-002", commissionAmount: 900000 }
      ],
      actual: d?.therapistAssignments,
      sourceReference: MIGRATION_SOURCE_REFERENCES.dCourse,
      message: "D코스 2인 담당 수당 대조가 실패했습니다."
    });

    const summary = await getDailyCallLedgerSummary({ operatingMonthId: monthId, serviceDate: comparisonDate, prismaClient });
    assertMigrationComparisonEqual({
      area: "calls.dailySummary",
      fixtureId: comparisonDate,
      expected: MIGRATION_EXPECTED_RESULTS.callCalculation.dailySummary,
      actual: {
        reservationCount: summary.reservationCount,
        inUseCount: summary.inUseCount,
        cleaningCount: summary.cleaningCount,
        completedCount: summary.completedCount,
        noShowCount: summary.noShowCount,
        canceledCount: summary.canceledCount,
        paymentTotal: summary.paymentTotal,
        discountTotal: summary.discountTotal,
        earcarePoolTotal: summary.earcarePoolTotal,
        therapistCommissionTotal: summary.therapistCommissionTotal,
        expenseTotal: summary.expenseTotal,
        netSales: summary.netSales
      },
      message: "일별 콜 원장 요약 대조가 실패했습니다."
    });
    assert.equal(summary.warningCounts.secondTherapistRequired, 1);
  });

  it("대조: D코스 마사지사2 누락은 ERP 강화 검증으로 저장 전에 차단된다", async () => {
    const prismaClient = createMigrationCalculationPrisma();

    await assert.rejects(
      saveBasicServiceCallRow({
        operatingMonthId: monthId,
        serviceDate: comparisonDate,
        startTime: "12:30",
        roomId: "room-202",
        courseId: "course-d",
        status: "방문완료",
        discountTypeCode: null,
        paymentMethodCode: "CASH",
        therapist1Id: "therapist-thr-001",
        therapist2Id: null,
        earcareEmployeeId: null,
        prismaClient
      }),
      (error) => error instanceof ServiceCallDomainError && error.code === "D_COURSE_SECOND_THERAPIST_REQUIRED"
    );
    assert.deepEqual(prismaClient.writeOperations, []);
  });

  it("대조: 객실 상태는 웨이터리스트/TV현황판 계약대로 비점유 상태를 제외하고 종료확인을 표시한다", async () => {
    const statuses = await listRoomStatuses({
      operatingMonthId: monthId,
      serviceDate: comparisonDate,
      now: new Date("2034-06-16T03:00:00.000+09:00"),
      prismaClient: createMigrationCalculationPrisma()
    });
    const compact = statuses.map((status) => ({ roomId: status.roomId, activeCallId: status.activeCallId, displayStatus: status.displayStatus }));
    assertMigrationComparisonEqual({
      area: "rooms.status",
      fixtureId: comparisonDate,
      expected: MIGRATION_EXPECTED_RESULTS.roomStatus,
      actual: compact,
      sourceReference: MIGRATION_SOURCE_REFERENCES.roomStatus,
      message: "객실/TV 상태 대조가 실패했습니다."
    });
    assert.ok(statuses.some((status) => status.displayStatus === "종료확인" && status.remainingMinutes === 0));
  });

  it("대조: 운영팀 일일/월 인센은 30/40/50 및 1000~1500 threshold와 정상 근무자 조건을 따른다", async () => {
    const daily = await listOpsDailyIncentives({ operatingMonthId: monthId, serviceDate: comparisonDate, prismaClient: createMigrationCalculationPrisma() });
    assert.equal(daily.dailyOpsCallCredit, MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold.dailyOpsCallCredit);
    assert.equal(daily.appliedThresholdCallCount, MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold.appliedThresholdCallCount);
    assert.equal(daily.personalIncentiveAmount, MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold.personalIncentiveAmount);
    assert.equal(daily.eligibleCount, MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold.eligibleCount);
    assert.equal(daily.distributedAmount, MIGRATION_EXPECTED_RESULTS.operations.dailyThreshold.distributedAmount);
    assert.ok(daily.rows.every((row) => row.statusDisplayName === "정상" || row.payoutAmount === 0));

    const monthly = await listOpsMonthlyIncentivePreview({
      operatingMonthId: monthId,
      prismaClient: createMigrationCalculationPrisma({ monthlyOpsCredit: 1500 })
    });
    assert.deepEqual(
      MIGRATION_CALCULATION_FIXTURE.incentiveRules.opsMonthly.map((rule) => rule.thresholdCallCount),
      MIGRATION_EXPECTED_RESULTS.operations.monthlyThresholds
    );
    assert.equal(monthly.monthlyOpsCallCredit, MIGRATION_EXPECTED_RESULTS.operations.monthlyPreview.monthlyOpsCallCredit);
    assert.equal(monthly.appliedThresholdCallCount, MIGRATION_EXPECTED_RESULTS.operations.monthlyPreview.appliedThresholdCallCount);
    assert.equal(monthly.totalMonthlyIncentiveAmount, MIGRATION_EXPECTED_RESULTS.operations.monthlyPreview.totalMonthlyIncentiveAmount);
  });

  it("대조: 귀케어와 마사지사 일정산은 stable Employee.id/staffCode, 역할, 0명 분배 조건을 사용한다", async () => {
    const prismaClient = createMigrationCalculationPrisma();
    const earcare = await listEarcareDailySettlements({ operatingMonthId: monthId, serviceDate: comparisonDate, prismaClient });
    assert.equal(earcare.earcarePoolTotal, MIGRATION_EXPECTED_RESULTS.earcareDaily.normalDay.earcarePoolTotal);
    assert.equal(earcare.eligibleCount, MIGRATION_EXPECTED_RESULTS.earcareDaily.normalDay.eligibleCount);
    assert.equal(earcare.distributedAmount, MIGRATION_EXPECTED_RESULTS.earcareDaily.normalDay.distributedAmount);

    const zeroWorker = await listEarcareDailySettlements({ operatingMonthId: monthId, serviceDate: "2034-06-16", prismaClient });
    assert.equal(zeroWorker.earcarePoolTotal, MIGRATION_EXPECTED_RESULTS.earcareDaily.zeroWorkerDay.earcarePoolTotal);
    assert.equal(zeroWorker.eligibleCount, MIGRATION_EXPECTED_RESULTS.earcareDaily.zeroWorkerDay.eligibleCount);
    assert.equal(zeroWorker.distributedAmount, MIGRATION_EXPECTED_RESULTS.earcareDaily.zeroWorkerDay.distributedAmount);

    const therapist = await listTherapistDailySettlements({ operatingMonthId: monthId, serviceDate: comparisonDate, prismaClient });
    const byTherapist = new Map(therapist.settlements.map((row) => [row.employeeId, row]));
    assert.equal(byTherapist.get("therapist-thr-001")?.totalCallCount, MIGRATION_EXPECTED_RESULTS.therapistDaily["therapist-thr-001"].totalCallCount);
    assert.equal(byTherapist.get("therapist-thr-001")?.totalCommissionAmount, MIGRATION_EXPECTED_RESULTS.therapistDaily["therapist-thr-001"].totalCommissionAmount);
    assert.equal(byTherapist.get("therapist-thr-002")?.warningCounts.zeroPolicy, MIGRATION_EXPECTED_RESULTS.therapistDaily["therapist-thr-002"].zeroPolicyCount);
    assert.ok(byTherapist.get("therapist-thr-001")?.assignmentEvidence.some((evidence) => evidence.role === "THERAPIST_2"));
  });

  it("대조: 월마감 preview는 만근 8시간/20일, 갯수왕 40콜, 최종지급액을 계산한다", async () => {
    const dependencies = {
      async listTherapistDailySettlements({ serviceDate }: { serviceDate: string }) {
        return therapistDay(serviceDate) as any;
      },
      async listTherapistFullAttendanceRecognitions() {
        return MIGRATION_CALCULATION_FIXTURE.monthlyClosingInputs.fullAttendanceRecognitions as any;
      },
      async listOpsDailyIncentives({ serviceDate }: { serviceDate: string }) {
        return emptyOpsDay(serviceDate) as any;
      },
      async listOpsMonthlyIncentivePreview() {
        return {
          operatingMonthId: monthId,
          monthKey: "2034-06",
          startDate: "2034-06-01",
          endDate: "2034-06-30",
          isClosedOrLocked: false,
          previewStatus: "draft_current",
          monthlyOpsCallCredit: 1500,
          sourceCallCount: 1,
          appliedThresholdCallCount: 1500,
          totalMonthlyIncentiveAmount: 25000000,
          ruleStatus: "applied",
          warningMessage: null,
          shares: { leadShare: 0.3, counterTeamShare: 0.35, waiterTeamShare: 0.35, leadAmount: 7500000, counterTeamAmount: 8750000, waiterTeamAmount: 8750000, undistributedAmount: 0 },
          rows: [],
          warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
          callEvidence: [{ serviceCallId: "call-monthly-ops-1500", serviceDate: comparisonDate, opsCallCredit: 1500 }]
        } as any;
      },
      async listEarcareDailySettlements({ serviceDate }: { serviceDate: string }) {
        return emptyEarcareDay(serviceDate) as any;
      }
    };

    const preview = await listMonthlyClosingPreview({
      operatingMonthId: monthId,
      prismaClient: createMigrationCalculationPrisma(),
      dependencies
    });
    const rows = new Map(preview.therapists.rows.map((row) => [row.employeeId, row]));
    for (const [employeeId, expected] of Object.entries(MIGRATION_EXPECTED_RESULTS.monthlyClosing.rows)) {
      const actual = rows.get(employeeId);
      assert.ok(actual, `${employeeId} monthly closing row missing`);
      assertMigrationComparisonEqual({
        area: "closing.therapistPayout",
        fixtureId: employeeId,
        expected,
        actual: {
          monthlySettlementAmount: actual.monthlySettlementAmount,
          fullAttendanceAllowanceAmount: actual.fullAttendanceAllowanceAmount,
          countKingBonusAmount: actual.countKingBonusAmount,
          finalPayoutAmount: actual.finalPayoutAmount
        },
        sourceReference: MIGRATION_SOURCE_REFERENCES.closing,
        message: "월마감 최종지급액 대조가 실패했습니다."
      });
    }
    assert.match(preview.evidence.countKingTieBreaker, /Employee\.id asc/);
  });
});
