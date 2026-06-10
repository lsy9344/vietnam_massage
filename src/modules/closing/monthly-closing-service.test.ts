import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MonthlyClosingDomainError,
  confirmMonthlyClose,
  getMonthlyClosingSnapshot,
  lockMonthlyClose,
  reopenMonthlyClose,
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
    closings: options.existingClosing ? [options.existingClosing] : ([] as any[]),
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
        if (options.uniqueCreate || state.closings.some((closing) => closing.operatingMonthId === data.operatingMonthId && closing.closeVersion === data.closeVersion)) {
          const error = new Error("unique") as Error & { code: string };
          error.code = "P2002";
          throw error;
        }
        const closing = {
          id: data.id ?? "closing-1",
          operatingMonthId: data.operatingMonthId,
          closeVersion: data.closeVersion ?? 1,
          snapshotJson: data.snapshotJson,
          confirmedByAccountId: data.confirmedByAccountId,
          confirmedAt: data.confirmedAt,
          reopenedAt: data.reopenedAt ?? null,
          reopenedByAccountId: data.reopenedByAccountId ?? null,
          reopenReason: data.reopenReason ?? null,
          createdAt: new Date("2026-06-10T04:00:00.000Z"),
          updatedAt: new Date("2026-06-10T04:00:00.000Z")
        };
        state.closings.push(closing);
        state.closing = closing;
        return { ...closing };
      },
      async findFirst({ where }: any) {
        const matches = state.closings.filter((closing) => !where?.operatingMonthId || closing.operatingMonthId === where.operatingMonthId);
        const latest = matches.sort((a, b) => b.closeVersion - a.closeVersion)[0];
        if (latest) return { ...latest };
        return null;
      },
      async update({ where, data }: any) {
        const index = state.closings.findIndex((closing) => closing.id === where.id);
        if (index === -1) throw new Error("closing not found");
        state.closings[index] = {
          ...state.closings[index],
          ...data,
          updatedAt: new Date("2026-06-10T04:00:00.000Z")
        };
        state.closing = state.closings[index];
        return { ...state.closings[index] };
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
        closings: state.closings,
        auditLogs: state.auditLogs
      });
      state.transactionSnapshots.push(snapshot);
      try {
        return await callback(client);
      } catch (error) {
        state.operatingMonth = snapshot.operatingMonth;
        state.closing = snapshot.closing;
        state.closings = snapshot.closings;
        state.auditLogs = snapshot.auditLogs;
        throw error;
      }
    }
  };

  return client as any;
}

function storedClosingSnapshot(): MonthlyClosingSnapshotDto {
  return {
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
    operations: {
      rows: [],
      dailyIncentiveAmount: 0,
      monthlyIncentiveAmount: 0,
      totalOpsPayoutAmount: 0,
      monthlyOpsCallCredit: 0,
      appliedThresholdCallCount: null,
      ruleStatus: "missing_policy",
      warningMessages: []
    },
    earcare: { rows: [], earcarePoolTotal: 0, distributedAmount: 0, undistributedAmount: 0, sourceCallCount: 0, eligibleDayCount: 0 },
    totals: { therapistPayoutAmount: 10, opsDailyIncentiveAmount: 0, opsMonthlyIncentiveAmount: 0, earcarePayoutAmount: 0, grandPayoutAmount: 10 },
    warningCounts: preview().warningCounts,
    evidence: preview().evidence,
    source: { serviceVersion: "monthly-closing-service:5.3", previewBasis: "listMonthlyClosingPreview", snapshotCreatedAt: "2026-06-10T04:00:00.000Z" }
  };
}

function existingClosing(overrides: Partial<{
  id: string;
  operatingMonthId: string;
  closeVersion: number;
  snapshotJson: MonthlyClosingSnapshotDto;
  confirmedByAccountId: string;
  confirmedAt: Date;
  reopenedAt: Date | null;
  reopenedByAccountId: string | null;
  reopenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}> = {}) {
  return {
    id: "closing-1",
    operatingMonthId: "month-1",
    closeVersion: 1,
    snapshotJson: storedClosingSnapshot(),
    confirmedByAccountId: "account-1",
    confirmedAt: new Date("2026-06-10T04:00:00.000Z"),
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    createdAt: new Date("2026-06-10T04:00:00.000Z"),
    updatedAt: new Date("2026-06-10T04:00:00.000Z"),
    ...overrides
  };
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
    assert.equal(result.closeVersion, 1);
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
    assert.equal(prismaClient.state.auditLogs[0].afterValue.closeVersion, 1);
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
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_VERSION_CONFLICT"
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

  it("locks a confirmed operating month and records monthly_close.locked audit with JSON-safe actor and timestamp", async () => {
    const prismaClient = createPrisma({ status: "마감확정", existingClosing: existingClosing() });

    const result = await lockMonthlyClose({
      operatingMonthId: "month-1",
      actorId: "account-locker",
      prismaClient,
      clock: () => new Date("2026-06-10T05:00:00.000Z")
    });

    assert.equal(result.status, "잠금");
    assert.equal(prismaClient.state.operatingMonth.status, "잠금");
    assert.equal(prismaClient.state.auditLogs.length, 1);
    assert.equal(prismaClient.state.auditLogs[0].action, "monthly_close.locked");
    assert.equal(prismaClient.state.auditLogs[0].targetType, "monthly_close");
    assert.equal(prismaClient.state.auditLogs[0].targetId, "closing-1");
    assert.equal(prismaClient.state.auditLogs[0].actorId, "account-locker");
    assert.equal(prismaClient.state.auditLogs[0].beforeValue.status, "마감확정");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.status, "잠금");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.lockedAt, "2026-06-10T05:00:00.000Z");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.lockedByAccountId, "account-locker");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.closeVersion, 1);
    assert.equal(prismaClient.state.closing.snapshotJson.totals.grandPayoutAmount, 10);
  });

  it("reopens a locked monthly close to 검토중 with trimmed reason and monthly_close.reopened audit", async () => {
    const prismaClient = createPrisma({ status: "잠금", existingClosing: existingClosing() });

    const result = await reopenMonthlyClose({
      operatingMonthId: "month-1",
      actorId: "account-admin",
      reason: "  정산 입력 오류 수정  ",
      prismaClient,
      clock: () => new Date("2026-06-10T06:00:00.000Z")
    });

    assert.equal(result.status, "검토중");
    assert.equal(prismaClient.state.operatingMonth.status, "검토중");
    assert.equal(prismaClient.state.closing.snapshotJson.totals.grandPayoutAmount, 10);
    assert.equal(prismaClient.state.closing.reopenReason, "정산 입력 오류 수정");
    assert.equal(prismaClient.state.closing.reopenedByAccountId, "account-admin");
    assert.equal(prismaClient.state.auditLogs.length, 1);
    assert.equal(prismaClient.state.auditLogs[0].action, "monthly_close.reopened");
    assert.equal(prismaClient.state.auditLogs[0].targetType, "monthly_close");
    assert.equal(prismaClient.state.auditLogs[0].targetId, "closing-1");
    assert.equal(prismaClient.state.auditLogs[0].beforeValue.status, "잠금");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.status, "검토중");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.reason, "정산 입력 오류 수정");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.reopenedAt, "2026-06-10T06:00:00.000Z");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.reopenedByAccountId, "account-admin");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.closeVersion, 1);
  });

  it("blocks reopen when reason is blank or too short without side effects", async () => {
    const prismaClient = createPrisma({ status: "잠금", existingClosing: existingClosing() });

    await assert.rejects(
      () => reopenMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", reason: "  ", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "INVALID_MONTHLY_CLOSE_REOPEN_REASON"
    );
    await assert.rejects(
      () => reopenMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", reason: "짧음", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "INVALID_MONTHLY_CLOSE_REOPEN_REASON"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "잠금");
    assert.equal(prismaClient.state.closing.reopenReason, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("blocks reopen unless the operating month is 잠금", async () => {
    for (const status of ["작성중", "검토중", "마감확정"]) {
      const prismaClient = createPrisma({ status, existingClosing: existingClosing() });

      await assert.rejects(
        () => reopenMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", reason: "충분한 재오픈 사유", prismaClient }),
        (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "INVALID_MONTHLY_CLOSE_REOPEN_TRANSITION"
      );

      assert.equal(prismaClient.state.operatingMonth.status, status);
      assert.equal(prismaClient.state.auditLogs.length, 0);
    }
  });

  it("blocks reopen when latest snapshot is missing and rolls back status changes", async () => {
    const prismaClient = createPrisma({ status: "잠금" });

    await assert.rejects(
      () => reopenMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", reason: "충분한 재오픈 사유", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "잠금");
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("rolls back reopened status and metadata when monthly_close.reopened audit fails", async () => {
    const prismaClient = createPrisma({ status: "잠금", existingClosing: existingClosing(), failAudit: true });

    await assert.rejects(() =>
      reopenMonthlyClose({
        operatingMonthId: "month-1",
        actorId: "account-1",
        reason: "충분한 재오픈 사유",
        prismaClient
      })
    );

    assert.equal(prismaClient.state.operatingMonth.status, "잠금");
    assert.equal(prismaClient.state.closing.reopenReason, null);
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("creates a new closeVersion after reopen without deleting or overwriting the previous snapshot", async () => {
    const previousClosing = existingClosing();
    const prismaClient = createPrisma({ status: "검토중", existingClosing: previousClosing });

    const result = await confirmMonthlyClose({
      operatingMonthId: "month-1",
      actorId: "account-2",
      prismaClient,
      clock: () => new Date("2026-06-11T04:00:00.000Z"),
      idFactory: () => "closing-2",
      dependencies: {
        listMonthlyClosingPreview: async () => preview({ therapists: { ...preview().therapists, payoutAmount: 2200000 } })
      }
    });

    assert.equal(result.id, "closing-2");
    assert.equal(result.closeVersion, 2);
    assert.equal(prismaClient.state.closings.length, 2);
    assert.equal(prismaClient.state.closings[0].id, "closing-1");
    assert.equal(prismaClient.state.closings[0].snapshotJson.totals.grandPayoutAmount, 10);
    assert.equal(prismaClient.state.closings[1].id, "closing-2");
    assert.equal(prismaClient.state.auditLogs[0].afterValue.closeVersion, 2);
  });

  it("blocks lock before confirmation without status or audit changes", async () => {
    const prismaClient = createPrisma({ status: "검토중", existingClosing: existingClosing() });

    await assert.rejects(
      () => lockMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_NOT_CONFIRMED"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "검토중");
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("blocks duplicate lock without creating another audit event", async () => {
    const prismaClient = createPrisma({ status: "잠금", existingClosing: existingClosing() });

    await assert.rejects(
      () => lockMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_ALREADY_LOCKED"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "잠금");
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("blocks lock when the confirmed snapshot row is missing and rolls back the status update", async () => {
    const prismaClient = createPrisma({ status: "마감확정" });

    await assert.rejects(
      () => lockMonthlyClose({ operatingMonthId: "month-1", actorId: "account-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
    );

    assert.equal(prismaClient.state.operatingMonth.status, "마감확정");
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("rolls back the lock status when monthly_close.locked audit fails", async () => {
    const prismaClient = createPrisma({ status: "마감확정", existingClosing: existingClosing(), failAudit: true });

    await assert.rejects(() =>
      lockMonthlyClose({
        operatingMonthId: "month-1",
        actorId: "account-1",
        prismaClient,
        clock: () => new Date("2026-06-10T05:00:00.000Z")
      })
    );

    assert.equal(prismaClient.state.operatingMonth.status, "마감확정");
    assert.equal(prismaClient.state.auditLogs.length, 0);
  });

  it("returns persisted snapshot without recalculating current preview", async () => {
    const prismaClient = createPrisma({
      status: "마감확정",
      existingClosing: existingClosing()
    });

    const result = await getMonthlyClosingSnapshot({ operatingMonthId: "month-1", prismaClient });

    assert.equal(result.snapshot.totals.grandPayoutAmount, 10);
    assert.equal(result.snapshot.month.confirmedStatus, "마감확정");
  });

  it("returns the latest versioned snapshot for existing getMonthlyClosingSnapshot callers", async () => {
    const prismaClient = createPrisma({ status: "마감확정", existingClosing: existingClosing() });
    prismaClient.state.closings.push(
      existingClosing({
        id: "closing-2",
        closeVersion: 2,
        snapshotJson: { ...storedClosingSnapshot(), id: "closing-2", totals: { ...storedClosingSnapshot().totals, grandPayoutAmount: 20 } },
        confirmedAt: new Date("2026-06-11T04:00:00.000Z")
      })
    );

    const result = await getMonthlyClosingSnapshot({ operatingMonthId: "month-1", prismaClient });

    assert.equal(result.id, "closing-2");
    assert.equal(result.closeVersion, 2);
    assert.equal(result.snapshot.totals.grandPayoutAmount, 20);
  });

  it("raises MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND when no persisted snapshot exists", async () => {
    const prismaClient = createPrisma({ status: "검토중" });

    await assert.rejects(
      () => getMonthlyClosingSnapshot({ operatingMonthId: "month-1", prismaClient }),
      (error: unknown) => error instanceof MonthlyClosingDomainError && error.code === "MONTHLY_CLOSE_SNAPSHOT_NOT_FOUND"
    );
  });
});
