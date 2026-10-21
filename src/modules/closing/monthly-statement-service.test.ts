import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMonthlyStatement, MonthlyStatementDomainError, type MonthlyStatementDependencies } from "@/modules/closing/monthly-statement-service";
import type { MonthlyClosingPreviewDto } from "@/modules/closing/monthly-closing-preview-service";
import type { MonthlyClosingDto, MonthlyClosingVersionSummaryDto } from "@/modules/closing/monthly-closing-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

function dbDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

type MemoryAttendanceRow = {
  attendanceDate: Date;
  employeeId: string;
  checkInMinute: number;
  checkOutMinute: number | null;
};

function attendanceRow(serviceDate: string, checkInMinute = 540, checkOutMinute: number | null = 1080): MemoryAttendanceRow {
  return { attendanceDate: dbDate(serviceDate), employeeId: "emp-1", checkInMinute, checkOutMinute };
}

function createMemoryPrisma(
  options: {
    employeeGroup?: string;
    missingEmployee?: boolean;
    operatingMonthStatus?: string;
    endDate?: string;
    attendance?: MemoryAttendanceRow[];
  } = {}
) {
  const operatingMonth = {
    id: "month-1",
    monthKey: "2026-06",
    startDate: dbDate("2026-06-01"),
    endDate: dbDate(options.endDate ?? "2026-06-02"),
    status: options.operatingMonthStatus ?? "작성중"
  };
  const employee = {
    id: "emp-1",
    displayName: "직원1",
    staffCode: "THR-001",
    employeeGroup: options.employeeGroup ?? "THERAPIST"
  };
  const readCounts = { attendanceFindMany: 0 };

  return {
    readCounts,
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
    },
    therapistAttendance: {
      async findMany() {
        readCounts.attendanceFindMany += 1;
        return options.attendance ?? [];
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

/** 지급 확인 사건 하나(확인). 이력은 최신이 먼저 온다. */
function confirmEvent(amount: number, serviceDate = "2026-06-01"): any {
  return {
    id: `event-${serviceDate}`,
    unitType: "THERAPIST_DAILY",
    operatingMonthId: "month-1",
    serviceDate,
    employeeId: "emp-1",
    eventType: "confirm",
    amount,
    reason: null,
    occurredAt: "2026-06-02T00:00:00.000Z",
    actorAccountId: "account-admin",
    actor: null
  };
}

function emptyDay(serviceDate: string): any {
  return {
    operatingMonthId: "month-1",
    serviceDate,
    settlements: [],
    warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
    excludedCallCount: 0
  };
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
    const prismaClient = createMemoryPrisma({ attendance: [attendanceRow("2026-06-01")] });
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listMonthlyClosingPreview: async () => therapistPreview(),
      listTherapistDailySettlementsForOperatingMonth: async () => [
        {
          operatingMonthId: "month-1",
          serviceDate: "2026-06-01",
          settlements: [
            {
              employeeId: "emp-1",
              displayName: "직원1",
              staffCode: "THR-001",
              sortOrder: 1,
              totalCallCount: 2,
              totalCommissionAmount: 1600000,
              courseBreakdown: {} as any,
              assignmentEvidence: [{ serviceCallId: "call-a", courseId: "course-a", courseCode: "A", role: "THERAPIST_1", employeeId: "emp-1", commissionAmount: 1600000, rateStatus: "applied", call: call("call-a", "2026-06-01") }],
              warningCounts: { zeroPolicy: 0, missingPolicy: 0 },
              payoutConfirmation: payout("confirmed", 1600000)
            }
          ],
          warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 0, secondTherapistRequired: 0 },
          excludedCallCount: 0
        } as any
      ],
      listPayoutConfirmationHistoriesByDate: async () =>
        new Map([["2026-06-01", new Map([["emp-1", [confirmEvent(1600000)]]])]]) as any
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
      assert.equal(result.evidence.dailyEntries[0].payoutConfirmation?.status, "confirmed");
    }
    assert.equal(result.payoutUnits.length, 1);
    assert.equal(result.payoutUnits[0].payoutConfirmation.status, "confirmed");
  });

  it("운영월이 여러 날이어도 Therapist 초안 경로는 월 정산을 1회만 읽고, 날짜별 정산·출퇴근 조회는 쓰지 않는다", async () => {
    const prismaClient = createMemoryPrisma({ endDate: "2026-06-05" });
    let monthSettlementCalls = 0;
    let perDayCalls = 0;
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listMonthlyClosingPreview: async () => therapistPreview(),
      listTherapistDailySettlements: async () => {
        perDayCalls += 1;
        return emptyDay("2026-06-01");
      },
      listTherapistAttendanceForDate: async () => {
        perDayCalls += 1;
        return { operatingMonthId: "month-1", attendanceDate: "2026-06-01", isLocked: false, rows: [] } as any;
      },
      listTherapistDailySettlementsForOperatingMonth: async ({ startDate, endDate }) => {
        monthSettlementCalls += 1;
        assert.equal(startDate, "2026-06-01");
        assert.equal(endDate, "2026-06-05");
        return ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05"].map(emptyDay);
      },
      listPayoutConfirmationHistoriesByDate: async () => new Map() as any
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(monthSettlementCalls, 1, "월 정산 조회는 운영월당 1회다");
    assert.equal(perDayCalls, 0, "날짜마다 다시 읽는 경로는 쓰지 않는다");
    assert.equal(prismaClient.readCounts.attendanceFindMany, 1, "이 직원의 출퇴근도 날짜 범위로 1회만 읽는다");
    assert.equal(result.evidence.available, true);
    if (result.evidence.available) {
      // 근거가 없는 날(정산·출퇴근·지급 확인 모두 없음)은 줄을 만들지 않는다.
      assert.equal(result.evidence.dailyEntries.length, 0);
    }
  });

  it("완료 콜 없이 지급 확인만 있는 날은 금액 0으로 남고, 출근만 있는 날은 지급 확인 null이다", async () => {
    const prismaClient = createMemoryPrisma({ attendance: [attendanceRow("2026-06-02", 510, 1050)] });
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listMonthlyClosingPreview: async () => therapistPreview(),
      listTherapistDailySettlementsForOperatingMonth: async () => [emptyDay("2026-06-01"), emptyDay("2026-06-02")],
      listPayoutConfirmationHistoriesByDate: async () =>
        new Map([["2026-06-01", new Map([["emp-1", [confirmEvent(0, "2026-06-01")]]])]]) as any
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.equal(result.evidence.available, true);
    if (!result.evidence.available) return;
    assert.deepEqual(result.evidence.dailyEntries.map((entry) => entry.serviceDate), ["2026-06-01", "2026-06-02"]);
    const [payoutOnly, attendanceOnly] = result.evidence.dailyEntries;
    assert.equal(payoutOnly!.amount, 0);
    assert.deepEqual(payoutOnly!.calls, []);
    assert.deepEqual(payoutOnly!.appliedPolicies, []);
    assert.equal(payoutOnly!.attendanceSummary, null);
    assert.equal(payoutOnly!.payoutConfirmation?.status, "confirmed");
    assert.equal(attendanceOnly!.amount, 0);
    assert.deepEqual(attendanceOnly!.calls, []);
    assert.deepEqual(attendanceOnly!.appliedPolicies, []);
    assert.equal(attendanceOnly!.attendanceSummary, "08:30–17:30");
    assert.equal(attendanceOnly!.payoutConfirmation, null);
  });

  it("콜킹 기준선은 명세서가 이미 읽은 Therapist 행에서 순위 순서로 숫자만 담는다", async () => {
    const preview = therapistPreview({ countKingRank: 2, totalCallCount: 22 });
    const baseRow = preview.therapists.rows[0]!;
    preview.therapists.rows.push(
      { ...baseRow, employeeId: "emp-rank1", staffCode: "THR-901", displayName: "1위", countKingRank: 1, totalCallCount: 50 },
      { ...baseRow, employeeId: "emp-rank3", staffCode: "THR-903", displayName: "3위", countKingRank: 3, totalCallCount: 41 },
      { ...baseRow, employeeId: "emp-no-rank", staffCode: "THR-904", displayName: "4위", countKingRank: null, totalCallCount: 5 }
    );
    const prismaClient = createMemoryPrisma();
    const dependencies: Partial<MonthlyStatementDependencies> = {
      listMonthlyClosingVersions: async () => noVersions(),
      listMonthlyClosingPreview: async () => preview,
      listTherapistDailySettlementsForOperatingMonth: async () => [emptyDay("2026-06-01"), emptyDay("2026-06-02")],
      listPayoutConfirmationHistoriesByDate: async () => new Map() as any
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", prismaClient, dependencies });

    assert.deepEqual(result.rankBaseline, [
      { rank: 1, callCount: 50 },
      { rank: 2, callCount: 22 },
      { rank: 3, callCount: 41 }
    ]);
    const serialized = JSON.stringify(result.rankBaseline);
    assert.ok(!serialized.includes("1위") && !serialized.includes("emp-rank1"), "다른 Therapist의 이름·employeeId가 기준선에 샜다");
  });

  it("마감 스냅샷을 볼 때도 기준선은 그 스냅샷이 이미 담고 있는 Therapist 행에서 온다", async () => {
    const snapshotPreview = therapistPreview({ countKingRank: 2, totalCallCount: 22 });
    const baseRow = snapshotPreview.therapists.rows[0]!;
    snapshotPreview.therapists.rows.push(
      { ...baseRow, employeeId: "emp-rank1", staffCode: "THR-901", displayName: "1위", countKingRank: 1, totalCallCount: 50 },
      { ...baseRow, employeeId: "emp-rank3", staffCode: "THR-903", displayName: "3위", countKingRank: 3, totalCallCount: 41 }
    );
    const prismaClient = createMemoryPrisma();
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
          snapshot: snapshotPreview
        }) as unknown as MonthlyClosingDto,
      listTherapistDailyPayoutConfirmationsForMonth: async () => []
    };

    const result = await getMonthlyStatement({ operatingMonthId: "month-1", employeeId: "emp-1", closeVersion: 1, prismaClient, dependencies });

    assert.deepEqual(result.rankBaseline, [
      { rank: 1, callCount: 50 },
      { rank: 2, callCount: 22 },
      { rank: 3, callCount: 41 }
    ]);
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
        listTherapistDailySettlementsForOperatingMonth: async () => [],
        listPayoutConfirmationHistoriesByDate: async () => new Map() as any
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
