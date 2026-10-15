import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { DailyCallLedgerSummaryDto, ServiceCallRowDto } from "@/modules/calls/service-call-service";
import {
  MonthlyClosingChecklistDomainError,
  listMonthlyClosingChecklist,
  type MonthlyClosingChecklistDependencies
} from "@/modules/closing/monthly-closing-checklist-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createOperatingMonthPrisma(status = "검토중") {
  const operatingMonth = {
    id: "month-2026-06",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-02"),
    status
  };
  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    }
  } as any;
}

function row(overrides: Partial<ServiceCallRowDto> = {}): ServiceCallRowDto {
  return {
    id: "call-1",
    operatingMonthId: "month-2026-06",
    serviceDate: "2026-06-01",
    startTime: "14:00",
    actualEntryTime: null,
    displayEnd: "15:00",
    warningTime: null,
    warnings: [],
    roomId: "room-1",
    roomLabel: "301",
    courseId: "course-a",
    courseCode: "A",
    courseLabel: "A 누루60",
    customerId: null,
    customerMemo: null,
    therapist1: { id: "thr-1", displayName: "Mai", staffCode: "THR-001" },
    therapist2: null,
    earcare: null,
    status: "방문완료",
    discountTypeCode: null,
    paymentMethodCode: "CASH",
    note: null,
    confirmationCode: null,
    basePrice: 1500000,
    paymentAmount: 1500000,
    discountAmount: 0,
    therapist1Commission: 700000,
    therapist2Commission: 0,
    earcarePoolAmount: 0,
    opsCallCredit: 1,
    calculationStatus: "calculated",
    calculationErrorCode: null,
    calculationErrorMessage: null,
    createdAt: "2026-06-01T07:00:00.000Z",
    updatedAt: "2026-06-01T07:00:00.000Z",
    savedAt: "2026-06-01T07:00:00.000Z",
    ...overrides
  };
}

function dayLedgerSummary(overrides: Partial<DailyCallLedgerSummaryDto> = {}): DailyCallLedgerSummaryDto {
  return {
    reservationCount: 0,
    inUseCount: 0,
    cleaningCount: 0,
    completedCount: 0,
    noShowCount: 0,
    canceledCount: 0,
    paymentTotal: 0,
    therapistCommissionTotal: 0,
    earcarePoolTotal: 0,
    discountTotal: 0,
    expenseTotal: 0,
    netSales: 0,
    paymentMethodTotals: { cash: 0, card: 0, bank: 0, other: 0 },
    till: {
      day: { cashReceipts: 0, cashExpenses: 0, cashBalance: 0, bankReceipts: 0, bankExpenses: 0, bankBalance: 0 },
      month: { cashReceipts: 0, cashExpenses: 0, cashBalance: 0, bankReceipts: 0, bankExpenses: 0, bankBalance: 0 }
    },
    courseSummaries: [],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    ...overrides
  };
}

function unconfirmedPayout(currentAmount: number): PayoutConfirmationDto {
  return { status: "unconfirmed", currentAmount, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] };
}

function reconfirmationPendingPayout(currentAmount: number, lastConfirmedAmount: number): PayoutConfirmationDto {
  return {
    status: "needs_reconfirmation",
    currentAmount,
    lastConfirmedAmount,
    difference: currentAmount - lastConfirmedAmount,
    requiresReconfirmation: true,
    history: []
  };
}

function baseDependencies(overrides: Partial<MonthlyClosingChecklistDependencies> = {}): MonthlyClosingChecklistDependencies {
  return {
    listServiceCallsForOperatingMonth: async () => [],
    getDailyCallLedgerSummary: async () => dayLedgerSummary(),
    listTherapistDailyPayoutConfirmationsForMonth: async () => [],
    listEarcareDailyPayoutConfirmationsForMonth: async () => [],
    listOpsDailyPayoutConfirmationsForMonth: async () => [],
    listOpsMonthlyIncentivePreview: async () =>
      ({
        operatingMonthId: "month-2026-06",
        monthKey: "2026-06",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
        isClosedOrLocked: false,
        previewStatus: "draft_current",
        monthlyOpsCallCredit: 0,
        sourceCallCount: 0,
        appliedThresholdCallCount: null,
        totalMonthlyIncentiveAmount: 0,
        ruleStatus: "missing_policy",
        warningMessage: null,
        shares: { leadShare: 0, counterTeamShare: 0, waiterTeamShare: 0, leadAmount: 0, counterTeamAmount: 0, waiterTeamAmount: 0, undistributedAmount: 0 },
        rows: [],
        warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        callEvidence: []
      }) as any,
    ...overrides
  };
}

describe("listMonthlyClosingChecklist", () => {
  it("방문완료 콜의 계산 오류만 계산 오류 목록에 담고, 방문완료·취소·노쇼는 마감 확인 대상에서 뺀다", async () => {
    const rows = [
      row({ id: "call-error", status: "방문완료", calculationStatus: "course_policy_missing" }),
      row({ id: "call-ok", status: "방문완료", calculationStatus: "calculated" }),
      row({ id: "call-reserved", status: "예약", calculationStatus: "not_completed" }),
      row({ id: "call-in-use", status: "사용중", calculationStatus: "not_completed" }),
      row({ id: "call-cleaning", status: "청소중", calculationStatus: "not_completed" }),
      row({ id: "call-canceled", status: "취소", calculationStatus: "not_completed" }),
      row({ id: "call-no-show", status: "노쇼", calculationStatus: "not_completed" })
    ];

    const result = await listMonthlyClosingChecklist({
      operatingMonthId: "month-2026-06",
      prismaClient: createOperatingMonthPrisma(),
      dependencies: baseDependencies({ listServiceCallsForOperatingMonth: async () => rows })
    });

    assert.deepEqual(result.calculationErrorCalls.map((call) => call.serviceCallId), ["call-error"]);
    assert.deepEqual(
      result.pendingCloseCalls.map((call) => call.serviceCallId).sort(),
      ["call-cleaning", "call-in-use", "call-reserved"].sort()
    );
  });

  it("세 직군 중 지급 재확인 필요 단위가 하나라도 있으면 확정을 막는다", async () => {
    const result = await listMonthlyClosingChecklist({
      operatingMonthId: "month-2026-06",
      prismaClient: createOperatingMonthPrisma(),
      dependencies: baseDependencies({
        listTherapistDailyPayoutConfirmationsForMonth: async () => [
          { serviceDate: "2026-06-01", employeeId: "thr-1", payoutConfirmation: reconfirmationPendingPayout(800000, 700000) }
        ]
      })
    });

    assert.equal(result.payoutReconfirmationUnits.length, 1);
    assert.equal(result.payoutReconfirmationUnits[0].unitType, "THERAPIST_DAILY");
    assert.equal(result.payoutReconfirmationUnits[0].serviceDate, "2026-06-01");
    assert.equal(result.isConfirmBlocked, true);
  });

  it("네 단위(마사지사 일일·귀케어 일일·운영팀 일일·운영팀 월) 모두에서 재확인 필요를 모은다", async () => {
    const result = await listMonthlyClosingChecklist({
      operatingMonthId: "month-2026-06",
      prismaClient: createOperatingMonthPrisma(),
      dependencies: baseDependencies({
        listTherapistDailyPayoutConfirmationsForMonth: async () => [
          { serviceDate: "2026-06-01", employeeId: "thr-1", payoutConfirmation: reconfirmationPendingPayout(100, 90) },
          { serviceDate: "2026-06-02", employeeId: "thr-2", payoutConfirmation: unconfirmedPayout(0) }
        ],
        listEarcareDailyPayoutConfirmationsForMonth: async () => [
          { serviceDate: "2026-06-01", employeeId: "ear-1", payoutConfirmation: reconfirmationPendingPayout(200, 150) }
        ],
        listOpsDailyPayoutConfirmationsForMonth: async () => [
          { serviceDate: "2026-06-01", employeeId: "ops-1", payoutConfirmation: reconfirmationPendingPayout(300, 250) }
        ],
        listOpsMonthlyIncentivePreview: async () =>
          ({
            operatingMonthId: "month-2026-06",
            monthKey: "2026-06",
            startDate: "2026-06-01",
            endDate: "2026-06-02",
            isClosedOrLocked: false,
            previewStatus: "draft_current",
            monthlyOpsCallCredit: 0,
            sourceCallCount: 0,
            appliedThresholdCallCount: null,
            totalMonthlyIncentiveAmount: 0,
            ruleStatus: "missing_policy",
            warningMessage: null,
            shares: { leadShare: 0, counterTeamShare: 0, waiterTeamShare: 0, leadAmount: 0, counterTeamAmount: 0, waiterTeamAmount: 0, undistributedAmount: 0 },
            rows: [
              {
                employeeId: "ops-monthly-1",
                staffCode: "OPS-010",
                displayName: "운영 월",
                position: "리드",
                teamRole: "lead",
                teamShareLabel: "리드",
                payoutAmount: 400000,
                calculationBasis: "",
                payoutConfirmation: reconfirmationPendingPayout(400000, 300000)
              }
            ],
            warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
            callEvidence: []
          }) as any
      })
    });

    const unitTypes = result.payoutReconfirmationUnits.map((unit) => unit.unitType).sort();
    assert.deepEqual(unitTypes, ["EARCARE_DAILY", "OPS_DAILY", "OPS_MONTHLY", "THERAPIST_DAILY"]);
    const opsMonthlyUnit = result.payoutReconfirmationUnits.find((unit) => unit.unitType === "OPS_MONTHLY");
    assert.equal(opsMonthlyUnit?.serviceDate, null);
    assert.equal(opsMonthlyUnit?.employeeId, "ops-monthly-1");
    // 확인된 사건이 없을 뿐인 단위("미확인")는 재확인 미처리 목록에 들어가지 않는다.
    assert.equal(result.payoutReconfirmationUnits.some((unit) => unit.employeeId === "thr-2"), false);
    assert.equal(result.isConfirmBlocked, true);
  });

  it("마감 확인 대상 콜만 남아 있으면 이 티켓에서는 확정을 막지 않는다", async () => {
    const result = await listMonthlyClosingChecklist({
      operatingMonthId: "month-2026-06",
      prismaClient: createOperatingMonthPrisma(),
      dependencies: baseDependencies({
        listServiceCallsForOperatingMonth: async () => [row({ id: "call-reserved", status: "예약", calculationStatus: "not_completed" })]
      })
    });

    assert.equal(result.pendingCloseCalls.length, 1);
    assert.equal(result.calculationErrorCalls.length, 0);
    assert.equal(result.payoutReconfirmationUnits.length, 0);
    assert.equal(result.isConfirmBlocked, false);
  });

  it("결제수단별 합계·지출·순매출은 날짜별 합산이고, 현금·계좌 잔액은 운영월 누적(ADR 0002)이다", async () => {
    const byDate: Record<string, DailyCallLedgerSummaryDto> = {
      "2026-06-01": dayLedgerSummary({
        paymentMethodTotals: { cash: 1000000, card: 200000, bank: 300000, other: 0 },
        expenseTotal: 100000,
        netSales: 1400000,
        till: {
          day: { cashReceipts: 1000000, cashExpenses: 100000, cashBalance: 900000, bankReceipts: 300000, bankExpenses: 0, bankBalance: 300000 },
          month: { cashReceipts: 1500000, cashExpenses: 150000, cashBalance: 1350000, bankReceipts: 500000, bankExpenses: 50000, bankBalance: 450000 }
        }
      }),
      "2026-06-02": dayLedgerSummary({
        paymentMethodTotals: { cash: 500000, card: 0, bank: 200000, other: 50000 },
        expenseTotal: 50000,
        netSales: 700000,
        till: {
          day: { cashReceipts: 500000, cashExpenses: 50000, cashBalance: 450000, bankReceipts: 200000, bankExpenses: 50000, bankBalance: 150000 },
          // 같은 운영월이면 조회한 날짜와 무관하게 month 값은 같아야 한다(monthTillFor는 날짜를 보지 않는다).
          month: { cashReceipts: 1500000, cashExpenses: 150000, cashBalance: 1350000, bankReceipts: 500000, bankExpenses: 50000, bankBalance: 450000 }
        }
      })
    };

    const result = await listMonthlyClosingChecklist({
      operatingMonthId: "month-2026-06",
      prismaClient: createOperatingMonthPrisma(),
      dependencies: baseDependencies({
        getDailyCallLedgerSummary: async ({ serviceDate }: any) => byDate[serviceDate] ?? dayLedgerSummary()
      })
    });

    assert.deepEqual(result.financials.paymentMethodTotals, { cash: 1500000, card: 200000, bank: 500000, other: 50000 });
    assert.equal(result.financials.expenseTotal, 150000);
    assert.equal(result.financials.netSales, 2100000);
    assert.equal(result.financials.cashBalance, 1350000);
    assert.equal(result.financials.bankBalance, 450000);
  });

  it("운영월을 찾을 수 없으면 거절한다", async () => {
    await assert.rejects(
      () =>
        listMonthlyClosingChecklist({
          operatingMonthId: "missing-month",
          prismaClient: createOperatingMonthPrisma(),
          dependencies: baseDependencies()
        }),
      (error: unknown) => error instanceof MonthlyClosingChecklistDomainError && error.code === "OPERATING_MONTH_NOT_FOUND"
    );
  });

  it("운영월 id가 비어 있으면 거절한다", async () => {
    await assert.rejects(
      () =>
        listMonthlyClosingChecklist({
          operatingMonthId: "  ",
          prismaClient: createOperatingMonthPrisma(),
          dependencies: baseDependencies()
        }),
      (error: unknown) => error instanceof MonthlyClosingChecklistDomainError && error.code === "INVALID_MONTHLY_CLOSING_CHECKLIST_INPUT"
    );
  });
});
