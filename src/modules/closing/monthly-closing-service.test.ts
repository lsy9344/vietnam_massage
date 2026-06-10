import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MonthlyClosingDomainError,
  confirmMonthlyClose,
  getMonthlyClosingSnapshot,
  startMonthlyCloseReview,
  type MonthlyClosingSnapshotDto
} from "@/modules/closing/monthly-closing-service";
import type { MonthlyClosingPreviewDto } from "@/modules/closing/monthly-closing-preview-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function preview(overrides: Partial<MonthlyClosingPreviewDto> = {}): MonthlyClosingPreviewDto {
  return {
    operatingMonthId: "month-1",
    monthKey: "2026-06",
    startDate: "2026-06-01",
    endDate: "2026-06-30",
    status: "검토중",
    previewStatus: "draft_current",
    therapists: {
      payoutAmount: 1200000,
      totalCallCount: 2,
      rows: [
        {
          employeeId: "emp-therapist-1",
          staffCode: "THR-001",
          displayName: "마사지사 원",
          totalCallCount: 2,
          monthlySettlementAmount: 1200000,
          courseBreakdown: {
            A: { courseCode: "A", callCount: 2, commissionAmount: 1200000 },
            B: { courseCode: "B", callCount: 0, commissionAmount: 0 },
            C: { courseCode: "C", callCount: 0, commissionAmount: 0 },
            D: { courseCode: "D", callCount: 0, commissionAmount: 0 },
            E: { courseCode: "E", callCount: 0, commissionAmount: 0 }
          },
          assignmentEvidenceCount: 2,
          warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
          fullAttendanceDays: null,
          fullAttendanceAllowanceAmount: 0,
          fullAttendanceBasis: "Story 4.1 만근 인정 source 없음",
          countKingRank: null,
          countKingBonusAmount: 0,
          countKingBasis: "월 총콜 2콜 / 40콜 미만 제외",
          finalPayoutAmount: 1200000,
          bonusWarningMessages: ["Story 4.1 source 없음"]
        }
      ]
    },
    operations: {
      dailyIncentiveAmount: 50000,
      monthlyIncentiveAmount: 0,
      totalOpsPayoutAmount: 50000,
      monthlyOpsCallCredit: 31,
      appliedThresholdCallCount: null,
      ruleStatus: "missing_policy",
      warningMessages: ["월 인센 정책 없음"],
      rows: [
        {
          employeeId: "emp-ops-1",
          staffCode: "OPS-001",
          displayName: "운영 원",
          position: "카운터",
          dailyIncentiveAmount: 50000,
          monthlyIncentiveAmount: 0,
          totalOpsPayoutAmount: 50000,
          dailyEvidenceCount: 1,
          monthlyCalculationBasis: null
        }
      ]
    },
    earcare: {
      earcarePoolTotal: 200000,
      distributedAmount: 200000,
      undistributedAmount: 0,
      sourceCallCount: 2,
      eligibleDayCount: 1,
      rows: [
        {
          employeeId: "emp-earcare-1",
          staffCode: "EAR-001",
          displayName: "귀케어 원",
          eligibleDayCount: 1,
          payoutAmount: 200000,
          calculationBasis: "귀케어풀 200000 / 1명"
        }
      ]
    },
    totals: {
      therapistPayoutAmount: 1200000,
      opsDailyIncentiveAmount: 50000,
      opsMonthlyIncentiveAmount: 0,
      earcarePayoutAmount: 200000,
      grandPayoutAmount: 1450000
    },
    warningCounts: {
      therapistCoursePolicyMissing: 0,
      therapistRateMissing: 0,
      therapistSecondTherapistRequired: 0,
      therapistZeroPolicy: 0,
      therapistExcludedCallCount: 0,
      fullAttendanceSourceMissing: 1,
      fullAttendanceSourceDayCount: 0,
      countKingEligibleCount: 0,
      countKingExcludedCount: 1,
      opsDaily: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
      opsMonthly: { notCompleted: 0, coursePolicyMissing: 1, therapistRateMissing: 0, secondTherapistRequired: 0 },
      opsWarningMessageCount: 1,
      earcare: { notCompleted: 0, coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
      earcareNormalStaffZeroDays: 0,
      earcareUndistributedDays: 0,
      total: 3
    },
    evidence: {
      period: "2026-06-01 ~ 2026-06-30",
      sourceDayCount: 30,
      includedCallCount: 2,
      excludedCallCount: 0,
      fullAttendanceSourceStatus: "missing_story_4_1_source",
      fullAttendanceSourceDayCount: 0,
      countKingEligibleCount: 0,
      countKingExcludedCount: 1,
      countKingTieBreaker: "tie-breaker: totalCallCount desc, monthlySettlementAmount desc, staffCode asc, Employee.id asc",
      policyWarningCount: 1,
      warningCount: 3,
      representativeEvidence: {
        therapist: ["call-1"],
        operationsDaily: ["call-1"],
        operationsMonthly: ["call-1"],
        earcare: ["call-1"]
      }
    },
    ...overrides
  };
}

function createPrisma(options: { status?: string; existingClosing?: any; failAudit?: boolean; uniqueCreate?: boolean } = {}) {
  const state = {
    operatingMonth: {
      id: "month-1",
      monthKey: "2026-06",
      startDate: dbDate("2026-06-01"),
      endDate: dbDate("2026-06-30"),
      status: options.status ?? "작성중",
      createdAt: new Date("2026-06-01T00:00:00.000Z"),
      updatedAt: new Date("2026-06-01T00:00:00.000Z")
    },
    closing: options.existingClosing ?? null,
    auditLogs: [] as any[],
    transactionSnapshots: [] as any[]
  };

  const client = {
    state,
    operatingMonth: {
      async findUnique({ where }: any) {
        if (where.id === state.operatingMonth.id || where.monthKey === state.operatingMonth.monthKey) return { ...state.operatingMonth };
        return null;
      },
      async updateMany({ where, data }: any) {
        if (where.id === state.operatingMonth.id && (!where.status || where.status === state.operatingMonth.status)) {
          state.operatingMonth = { ...state.operatingMonth, ...data, updatedAt: new Date("2026-06-10T04:00:00.000Z") };
          return { count: 1 };
        }
        return { count: 0 };
      }
    },
    monthlyClosing: {
      async create({ data }: any) {
        if (options.uniqueCreate || state.closing) {
          const error = new Error("unique") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
        state.closing = {
          id: data.id ?? "closing-1",
          operatingMonthId: data.operatingMonthId,
          snapshotJson: data.snapshotJson,
          confirmedByAccountId: data.confirmedByAccountId,
          confirmedAt: data.confirmedAt,
          createdAt: new Date("2026-06-10T04:00:00.000Z"),
          updatedAt: new Date("2026-06-10T04:00:00.000Z")
        };
        return { ...state.closing };
      },
      async findUnique({ where }: any) {
        if (where.operatingMonthId === state.closing?.operatingMonthId) return { ...state.closing };
        return null;
      }
    },
    auditLog: {
      async create({ data }: any) {
        if (options.failAudit) throw new Error("audit failed");
        state.auditLogs.push(data);
        return { id: `audit-${state.auditLogs.length}`, ...data, createdAt: new Date("2026-06-10T04:00:00.000Z") };
      }
    },
    async $transaction(callback: any) {
      const snapshot = structuredClone({
        operatingMonth: state.operatingMonth,
        closing: state.closing,
        auditLogs: state.auditLogs
      });
      state.transactionSnapshots.push(snapshot);
      try {
        return await callback(client);
      } catch (error) {
        state.operatingMonth = snapshot.operatingMonth;
        state.closing = snapshot.closing;
        state.auditLogs = snapshot.auditLogs;
        throw error;
      }
    }
  };

  return client as any;
}

describe("monthly closing service", () => {
  it("moves 작성중 operating month to 검토중 and records operating_month.status_changed", async () => {
    const prismaClient = createPrisma();

    const result = await startMonthlyCloseReview({
      operatingMonthId: "month-1",
      actorId: "account-1",
      prismaClient
    });

    assert.equal(result.status, "검토중");
    assert.equal(prismaClient.state.auditLogs.length, 1);
    assert.equal(prismaClient.state.auditLogs[0].action, "operating_month.status_changed");
    assert.equal(prismaClient.state.auditLogs[0].targetType, "operating_month");
    assert.deepEqual(prismaClient.state.auditLogs[0].beforeValue.status, "작성중");
    assert.deepEqual(prismaClient.state.auditLogs[0].afterValue.status, "검토중");
  });

  it("confirms 검토중 month atomically with normalized immutable snapshot and monthly_close.confirmed audit", async () => {
    const prismaClient = createPrisma({ status: "검토중" });

    const result = await confirmMonthlyClose({
      operatingMonthId: "month-1",
      actorId: "account-1",
      prismaClient,
      clock: () => new Date("2026-06-10T04:00:00.000Z"),
      idFactory: () => "closing-1",
      dependencies: {
        listMonthlyClosingPreview: async () => preview()
      }
    });

    assert.equal(result.status, "마감확정");
    assert.equal(result.confirmedByAccountId, "account-1");
    assert.equal(result.confirmedAt, "2026-06-10T04:00:00.000Z");
    assert.equal(result.snapshot.id, "closing-1");
    assert.equal(result.snapshot.month.statusAtConfirmation, "검토중");
    assert.equal(result.snapshot.source.serviceVersion, "monthly-closing-service:5.3");
    assert.equal(result.snapshot.therapists.rows[0].employeeId, "emp-therapist-1");
    assert.equal(result.snapshot.operations.rows[0].staffCode, "OPS-001");
    assert.equal(result.snapshot.earcare.rows[0].payoutAmount, 200000);
    assert.equal(result.snapshot.totals.grandPayoutAmount, 1450000);
    assert.equal(prismaClient.state.auditLogs[0].action, "monthly_close.confirmed");
    assert.equal(prismaClient.state.auditLogs[0].targetType, "monthly_close");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.snapshotId, "closing-1");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.status, "마감확정");
  });

  it("blocks duplicate or invalid confirmation without creating snapshot or audit rows", async () => {
    const prismaClient = createPrisma({ status: "마감확정" });

    await assert.rejects(
      () =>
        confirmMonthlyClose({
          operatingMonthId: "month-1",
          actorId: "account-1",
          prismaClient,
          dependencies: { listMonthlyClosingPreview: async () => preview({ status: "마감확정", previewStatus: "closed_current" }) }
        }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "INVALID_MONTHLY_CLOSE_TRANSITION"
    );

    assert.equal(prismaClient.state.closing, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("rolls back status and snapshot when audit fails inside confirmation transaction", async () => {
    const prismaClient = createPrisma({ status: "검토중", failAudit: true });

    await assert.rejects(() =>
      confirmMonthlyClose({
        operatingMonthId: "month-1",
        actorId: "account-1",
        prismaClient,
        dependencies: { listMonthlyClosingPreview: async () => preview() }
      })
    );

    assert.equal(prismaClient.state.operatingMonth.status, "검토중");
    assert.equal(prismaClient.state.closing, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("rolls back status when the DB unique constraint rejects a duplicate confirmation race", async () => {
    const prismaClient = createPrisma({ status: "검토중", uniqueCreate: true });

    await assert.rejects(
      () =>
        confirmMonthlyClose({
          operatingMonthId: "month-1",
          actorId: "account-1",
          prismaClient,
          dependencies: { listMonthlyClosingPreview: async () => preview() }
        }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_ALREADY_CONFIRMED"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "검토중");
    assert.equal(prismaClient.state.closing, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("rejects non-JSON snapshot values before persistence and rolls back status", async () => {
    const prismaClient = createPrisma({ status: "검토중" });

    await assert.rejects(
      () =>
        confirmMonthlyClose({
          operatingMonthId: "month-1",
          actorId: "account-1",
          prismaClient,
          dependencies: {
            listMonthlyClosingPreview: async () => ({
              ...preview(),
              totals: {
                ...preview().totals,
                grandPayoutAmount: Number.NaN
              }
            })
          }
        }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "INVALID_MONTHLY_CLOSE_INPUT"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "검토중");
    assert.equal(prismaClient.state.closing, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("returns persisted snapshot without recalculating current preview", async () => {
    const storedSnapshot: MonthlyClosingSnapshotDto = {
      id: "closing-1",
      month: {
        operatingMonthId: "month-1",
        monthKey: "2026-06",
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        statusAtConfirmation: "검토중",
        confirmedStatus: "마감확정",
        confirmedAt: "2026-06-10T04:00:00.000Z",
        confirmedByAccountId: "account-1"
      },
      therapists: { rows: [], payoutAmount: 10, totalCallCount: 1 },
      operations: { rows: [], dailyIncentiveAmount: 0, monthlyIncentiveAmount: 0, totalOpsPayoutAmount: 0, monthlyOpsCallCredit: 0, appliedThresholdCallCount: null, ruleStatus: "missing_policy", warningMessages: [] },
      earcare: { rows: [], earcarePoolTotal: 0, distributedAmount: 0, undistributedAmount: 0, sourceCallCount: 0, eligibleDayCount: 0 },
      totals: { therapistPayoutAmount: 10, opsDailyIncentiveAmount: 0, opsMonthlyIncentiveAmount: 0, earcarePayoutAmount: 0, grandPayoutAmount: 10 },
      warningCounts: preview().warningCounts,
      evidence: preview().evidence,
      source: { serviceVersion: "monthly-closing-service:5.3", previewBasis: "listMonthlyClosingPreview", snapshotCreatedAt: "2026-06-10T04:00:00.000Z" }
    };
    const prismaClient = createPrisma({
      status: "마감확정",
      existingClosing: {
        id: "closing-1",
        operatingMonthId: "month-1",
        snapshotJson: storedSnapshot,
        confirmedByAccountId: "account-1",
        confirmedAt: new Date("2026-06-10T04:00:00.000Z"),
        createdAt: new Date("2026-06-10T04:00:00.000Z"),
        updatedAt: new Date("2026-06-10T04:00:00.000Z")
      }
    });

    const result = await getMonthlyClosingSnapshot({ operatingMonthId: "month-1", prismaClient });

    assert.equal(result.snapshot.totals.grandPayoutAmount, 10);
    assert.equal(result.snapshot.month.confirmedStatus, "마감확정");
  });

  it("raises MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND when no persisted snapshot exists", async () => {
    const prismaClient = createPrisma({ status: "검토중" });

    await assert.rejects(
      () => getMonthlyClosingSnapshot({ operatingMonthId: "month-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
    );
  });
});
