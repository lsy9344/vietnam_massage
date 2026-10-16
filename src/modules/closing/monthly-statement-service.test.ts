import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMonthlyStatement, MonthlyStatementDomainError, type MonthlyStatementDependencies } from "@/modules/closing/monthly-statement-service";
import type { MonthlyClosingPreviewDto } from "@/modules/closing/monthly-closing-preview-service";
import type { MonthlyClosingDto, MonthlyClosingVersionSummaryDto } from "@/modules/closing/monthly-closing-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function createMemoryPrisma(options: { employeeGroup?: string; missingEmployee?: boolean; operatingMonthStatus?: string } = {}) {
  const operatingMonth = {
    id: "month-1",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate("2026-06-02"),
    status: options.operatingMonthStatus ?? "작성중"
  };
  const employee = {
    id: "emp-1",
    displayName: "직원1",
    staffCode: "THR-001",
    employeeGroup: options.employeeGroup ?? "THERAPIST"
  };

  return {
    operatingMonth: {
      async findUnique({ where }: any) {
        return where.id === operatingMonth.id ? operatingMonth : null;
      }
    },
    employee: {
      async findUnique({ where }: any) {
        if (options.missingEmployee) return null;
        return where.id === employee.id ? employee : null;
      }
    }
  };
}

function payout(status: PayoutConfirmationDto["status"], currentAmount: number): PayoutConfirmationDto {
  return { status, currentAmount, lastConfirmedAmount: status === "confirmed" ? currentAmount : null, difference: status === "confirmed" ? 0 : null, requiresReconfirmation: status === "needs_reconfirmation", history: [] };
}

function call(serviceCallId: string, serviceDate: string): any {
  return { serviceCallId, operatingMonthId: "month-1", serviceDate, startTime: "11:00", courseCode: "A", therapistNames: ["직원1"], status: "방문완료" };
}

function noVersions(): Promise<MonthlyClosingVersionSummaryDto[]> {
  return Promise.resolve([]);
}

function oneVersion(overrides: Partial<MonthlyClosingVersionSummaryDto> = {}): MonthlyClosingVersionSummaryDto {
  return {
    id: "closing-1",
    closeVersion: 1,
    confirmedByAccountId: "account-admin",
    confirmedAt: "2026-07-01T00:00:00.000Z",
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    ...overrides
  };
}

function therapistPreview(overrides: Partial<MonthlyClosingPreviewDto["therapists"]["rows"][number]> = {}): MonthlyClosingPreviewDto {
  return {
    therapists: {
      payoutAmount: 1800000,
      totalCallCount: 2,
      rows: [
        {
          employeeId: "emp-1",
          staffCode: "THR-001",
          displayName: "직원1",
          totalCallCount: 2,
          monthlySettlementAmount: 1600000,
          courseBreakdown: {} as any,
          assignmentEvidenceCount: 2,
          warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
          fullAttendanceDays: 22,
          fullAttendanceAllowanceAmount: 2000000,
          fullAttendanceBasis: "만근 인정 22일 / 20일 이상 2,000,000 VND",
          countKingRank: null,
          countKingBonusAmount: 0,
          countKingBasis: "월 총콜 2콜 / 40콜 미만 제외",
          finalPayoutAmount: 3600000,
          bonusWarningMessages: [],
          ...overrides
        }
      ]
    },
    operations: { rows: [] } as any
  } as unknown as MonthlyClosingPreviewDto;
}

function opsPreview(): MonthlyClosingPreviewDto {
  return {
    therapists: { rows: [] } as any,
    operations: {
      rows: [
        {
          employeeId: "emp-1",
          staffCode: "OPS-001",
          displayName: "직원1",
          position: "팀장",
          dailyIncentiveAmount: 100000,
          monthlyIncentiveAmount: 500000,
          totalOpsPayoutAmount: 600000,
          dailyEvidenceCount: 2,
          monthlyCalculationBasis: "월 콜 수 기준 적용"
        }
      ]
    } as any
  } as unknown as MonthlyClosingPreviewDto;
}

describe("getMonthlyStatement", () => {
  it("마감 버전이 없으면 지금 계산 결과(미확정)를 보여주고, 날짜별 근거가 그대로 담긴다(Therapist)", async () => {
    const prismaClient = createMemoryPrisma();
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listMonthlyClosingPreview: async () => therapistPreview(),
      listTherapistDailySettlements: async ({ serviceDate }: any) => {
        if (serviceDate === "2026-06-01") {
          return {
            operatingMonthId: "month-1",
            serviceDate,
            settlements: [
              {
                employeeId: "emp-1",
                displayName: "직원1",
                staffCode: "THR-001",
                sortOrder: 1,
                totalCallCount: 2,
                totalCommissionAmount: 1600000,
                courseBreakdown: {} as any,
                assignmentEvidence: [{ serviceCallId: "call-a", courseId: "course-a", courseCode: "A", role: "THERAPIST_1", employeeId: "emp-1", commissionAmount: 1600000, rateStatus: "applied", call: call("call-a", serviceDate) }],
                warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
                payoutConfirmation: payout("confirmed", 1600000)
              }
            ],
            warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
            excludedCallCount: 0
          } as any;
        }
        return { operatingMonthId: "month-1", serviceDate, settlements: [], warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 }, excludedCallCount: 0 } as any;
      },
      listTherapistAttendanceForDate: async ({ attendanceDate }: any) => ({
        operatingMonthId: "month-1",
        attendanceDate,
        isLocked: false,
        rows:
          attendanceDate === "2026-06-01"
            ? [{ id: "att-1", operatingMonthId: "month-1", attendanceDate, employeeId: "emp-1", staffCode: "THR-001", displayName: "직원1", sortOrder: 1, checkInTime: "09:00", checkOutTime: "18:00", standbyMinutes: null, isFullAttendanceRecognized: true, isComplete: true, incompleteReason: null, isLocked: false, warnings: [] }]
            : []
      })
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(result.isConfirmed, false);
    assert.equal(result.closeVersion, null);
    assert.equal(result.employeeGroup, "THERAPIST");
    assert.equal(result.finalAmount, 3600000);
    assert.deepEqual(result.summary, {
      kind: "THERAPIST",
      totalCallCount: 2,
      monthlySettlementAmount: 1600000,
      fullAttendanceDays: 22,
      fullAttendanceAllowanceAmount: 2000000,
      countKingRank: null,
      countKingBonusAmount: 0
    });
    assert.equal(result.evidence.available, true);
    if (result.evidence.available) {
      assert.equal(result.evidence.dailyEntries.length, 1);
      assert.equal(result.evidence.dailyEntries[0].serviceDate, "2026-06-01");
      assert.equal(result.evidence.dailyEntries[0].attendanceSummary, "09:00–18:00");
      assert.equal(result.evidence.dailyEntries[0].calls[0].serviceCallId, "call-a");
    }
    assert.equal(result.payoutUnits.length, 1);
    assert.equal(result.payoutUnits[0].payoutConfirmation.status, "confirmed");
  });

  it("마감확정 운영월은 마감 버전이 있으면 기본으로 가장 최근 버전의 스냅샷을 보여주고, 날짜별 근거는 '저장되지 않았습니다'로 대신한다(S9)", async () => {
    const prismaClient = createMemoryPrisma({ operatingMonthStatus: "마감확정" });
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => [oneVersion({ closeVersion: 2, confirmedAt: "2026-07-05T00:00:00.000Z" }), oneVersion({ closeVersion: 1 })],
      getMonthlyClosingSnapshotByVersion: async ({ closeVersion }: any) =>
        ({
          id: "closing-x",
          operatingMonthId: "month-1",
          closeVersion,
          status: "마감확정",
          confirmedByAccountId: "account-admin",
          confirmedAt: "2026-07-05T00:00:00.000Z",
          reopenedAt: null,
          reopenedByAccountId: null,
          reopenReason: null,
          snapshot: therapistPreview({ finalPayoutAmount: closeVersion === 2 ? 3600000 : 1000000 })
        }) as unknown as MonthlyClosingDto,
      listTherapistDailyPayoutConfirmationsForMonth: async () => [
        { serviceDate: "2026-06-01", employeeId: "emp-1", payoutConfirmation: payout("confirmed", 1600000) },
        { serviceDate: "2026-06-02", employeeId: "other", payoutConfirmation: payout("unconfirmed", 0) }
      ]
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(result.isConfirmed, true);
    assert.equal(result.closeVersion, 2);
    assert.equal(result.finalAmount, 3600000);
    assert.equal(result.availableVersions.length, 2);
    assert.equal(result.evidence.available, false);
    if (!result.evidence.available) {
      assert.equal(result.evidence.notice, "이 마감 버전에는 해당 근거가 저장되지 않았습니다.");
    }
    assert.equal(result.payoutUnits.length, 1);
    assert.equal(result.payoutUnits[0].serviceDate, "2026-06-01");
  });

  it("이전 마감 버전을 고르면(재오픈·재확정을 거쳐도) 최신이 아닌 그 버전을 그대로 본다", async () => {
    const prismaClient = createMemoryPrisma();
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => [oneVersion({ closeVersion: 2 }), oneVersion({ closeVersion: 1 })],
      getMonthlyClosingSnapshotByVersion: async ({ closeVersion }: any) =>
        ({
          id: `closing-${closeVersion}`,
          operatingMonthId: "month-1",
          closeVersion,
          status: "마감확정",
          confirmedByAccountId: "account-admin",
          confirmedAt: "2026-07-01T00:00:00.000Z",
          reopenedAt: null,
          reopenedByAccountId: null,
          reopenReason: null,
          snapshot: therapistPreview({ finalPayoutAmount: closeVersion === 2 ? 3600000 : 1000000 })
        }) as unknown as MonthlyClosingDto,
      listTherapistDailyPayoutConfirmationsForMonth: async () => []
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", closeVersion: 1, prismaClient, dependencies });

    assert.equal(result.closeVersion, 1);
    assert.equal(result.finalAmount, 1000000);
  });

  it("존재하지 않는 마감 버전을 고르면 거절한다", async () => {
    const prismaClient = createMemoryPrisma();
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => [oneVersion({ closeVersion: 1 })]
    };

    await assert.rejects(
      () => getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", closeVersion: 9, prismaClient, dependencies }),
      (error: unknown) => error instanceof MonthlyStatementDomainError && error.code === "MONTHLY_STATEMENT_VERSION_NOT_FOUND"
    );
  });

  it("S9: 작성중·검토중(재오픈 포함) 운영월은 마감 버전이 있어도 기본으로 지금 계산(미확정)을 보여주고, 이전 버전은 목록에서 고를 수 있다", async () => {
    for (const status of ["작성중", "검토중"]) {
      const prismaClient = createMemoryPrisma({ operatingMonthStatus: status });
      const dependencies: Partial<MonthlyStatementDependencies> = {
        listMonthlyClosingVersions: async () => [oneVersion({ closeVersion: 1 })],
        listMonthlyClosingPreview: async () => therapistPreview(),
        listTherapistDailySettlements: async ({ serviceDate }: any) =>
          ({
            operatingMonthId: "month-1",
            serviceDate,
            settlements: [],
            warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
            excludedCallCount: 0
          }) as any,
        listTherapistAttendanceForDate: async ({ attendanceDate }: any) => ({ operatingMonthId: "month-1", attendanceDate, isLocked: false, rows: [] })
      };

      const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

      assert.equal(result.isConfirmed, false, `${status} 운영월은 미확정 현재 계산을 기본으로 보여야 한다`);
      assert.equal(result.closeVersion, null);
      assert.equal(result.availableVersions.length, 1);
      assert.equal(result.evidence.available, true);
    }
  });

  it("S9: 마감확정·잠금 운영월에 확정 스냅샷이 없으면 지금 계산으로 내려가지 않고 거절한다", async () => {
    for (const status of ["마감확정", "잠금"]) {
      const prismaClient = createMemoryPrisma({ operatingMonthStatus: status });
      const dependencies: Partial<MonthlyStatementDependencies> = {
        listMonthlyClosingVersions: async () => noVersions()
      };

      await assert.rejects(
        () => getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies }),
        (error: unknown) => error instanceof MonthlyStatementDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND",
        `${status} 운영월은 스냅샷이 없으면 거절해야 한다`
      );
    }
  });

  it("마감 스냅샷에 이 직원의 정산 행이 없으면(그 직원보다 먼저 만들어진 버전) 금액 0과 summary null을 만들어 내지 않고 그대로 보인다", async () => {
    const prismaClient = createMemoryPrisma({ operatingMonthStatus: "마감확정" });
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => [oneVersion({ closeVersion: 1 })],
      getMonthlyClosingSnapshotByVersion: async () =>
        ({
          id: "closing-1",
          operatingMonthId: "month-1",
          closeVersion: 1,
          status: "마감확정",
          confirmedByAccountId: "account-admin",
          confirmedAt: "2026-07-01T00:00:00.000Z",
          reopenedAt: null,
          reopenedByAccountId: null,
          reopenReason: null,
          snapshot: { therapists: { rows: [] }, operations: { rows: [] } }
        }) as unknown as MonthlyClosingDto,
      listTherapistDailyPayoutConfirmationsForMonth: async () => []
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(result.finalAmount, 0);
    assert.equal(result.summary, null);
  });

  it("운영월을 찾을 수 없으면 거절한다", async () => {
    const prismaClient = createMemoryPrisma();
    await assert.rejects(
      () => getMonthlyStatement({ operatingMonthId: "missing-month", employeeId: "emp-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyStatementDomainError && error.code === "OPERATING_MONTH_NOT_FOUND"
    );
  });

  it("직원을 찾을 수 없으면 거절한다", async () => {
    const prismaClient = createMemoryPrisma({ missingEmployee: true });
    await assert.rejects(
      () => getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyStatementDomainError && error.code === "EMPLOYEE_NOT_FOUND"
    );
  });

  it("두 직군(운영팀) 직원은 일일 인센 단위와 월 인센 단위가 함께 payoutUnits에 담긴다", async () => {
    const prismaClient = createMemoryPrisma({ employeeGroup: "OPERATIONS" });
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listOpsMonthlyIncentivePreview: async () =>
        ({
          rows: [{ employeeId: "emp-1", staffCode: "OPS-001", displayName: "직원1", position: "팀장", teamRole: "lead", teamShareLabel: "팀장", payoutAmount: 500000, calculationBasis: "월 콜 수 기준", payoutConfirmation: payout("confirmed", 500000) }]
        }) as any,
      listMonthlyClosingPreview: async () => opsPreview(),
      listOpsDailyIncentives: async ({ serviceDate }: any) => ({
        operatingMonthId: "month-1",
        serviceDate,
        isLocked: false,
        dailyOpsCallCount: 10,
        sourceCallCount: 2,
        appliedThresholdCallCount: 10,
        personalIncentiveAmount: 50000,
        ruleStatus: "applied",
        warningMessage: null,
        eligibleCount: 1,
        distributedAmount: 50000,
        warningCounts: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
        rows: [
          {
            employeeId: "emp-1",
            staffCode: "OPS-001",
            displayName: "직원1",
            position: "팀장",
            statusCode: "NORMAL",
            statusDisplayName: "정상",
            isPayoutEligible: true,
            exclusionReason: null,
            payoutAmount: 50000,
            calculationBasis: "일일 인센 균등 분배",
            payoutConfirmation: payout("confirmed", 50000)
          }
        ],
        callEvidence: [{ serviceCallId: "call-o", serviceDate, call: call("call-o", serviceDate) }]
      })
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(result.employeeGroup, "OPERATIONS");
    assert.equal(result.finalAmount, 600000);
    assert.deepEqual(result.summary, {
      kind: "OPERATIONS",
      dailyIncentiveAmount: 100000,
      monthlyIncentiveAmount: 500000,
      monthlyCalculationBasis: "월 콜 수 기준 적용",
      dailyEvidenceCount: 2
    });
    // 일일 인센 2일 + 월 인센 1건.
    assert.equal(result.payoutUnits.length, 3);
    assert.equal(result.payoutUnits.at(-1)?.serviceDate, null);
  });
});
