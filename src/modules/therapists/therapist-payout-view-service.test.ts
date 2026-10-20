import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MonthlyStatementDto } from "@/modules/closing/monthly-statement-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";
import { expectedPayoutAmountForDate, getTherapistPayoutView } from "@/modules/therapists/therapist-payout-view-service";

const createdAt = new Date("2042-01-01T00:00:00.000Z");

function payout(status: PayoutConfirmationDto["status"], currentAmount: number, requiresReconfirmation = false): PayoutConfirmationDto {
  return {
    status,
    currentAmount,
    lastConfirmedAmount: status === "confirmed" ? currentAmount : null,
    difference: status === "confirmed" ? 0 : null,
    requiresReconfirmation,
    history: []
  };
}

function call(serviceCallId: string, startTime: string, courseCode: string, therapistNames: string[]): any {
  return { serviceCallId, operatingMonthId: "month-1", serviceDate: "2042-07-10", startTime, courseCode, therapistNames, status: "방문완료" };
}

function baseStatement(overrides: Partial<MonthlyStatementDto> = {}): MonthlyStatementDto {
  return {
    operatingMonthId: "month-1",
    monthKey: "2042-07",
    startDate: "2042-07-01",
    endDate: "2042-07-31",
    employeeId: "emp-me",
    displayName: "티켓07 Therapist",
    staffCode: "THR-907",
    employeeGroup: "THERAPIST",
    isConfirmed: false,
    closeVersion: null,
    confirmedAt: null,
    confirmedByAccountId: null,
    reopenedAt: null,
    reopenedByAccountId: null,
    reopenReason: null,
    availableVersions: [],
    finalAmount: 0,
    summary: null,
    evidence: { available: true, dailyEntries: [] },
    payoutUnits: [],
    rankBaseline: [],
    ...overrides
  } as MonthlyStatementDto;
}

describe("getTherapistPayoutView", () => {
  it("미확정 달: 날짜별 콜 근거·금액을 옮기고, 함께한 Therapist의 이름은 응답에 없다(M6)", async () => {
    const statement = baseStatement({
      summary: {
        kind: "THERAPIST",
        totalCallCount: 12,
        monthlySettlementAmount: 900000,
        fullAttendanceDays: 14,
        fullAttendanceAllowanceAmount: 0,
        countKingRank: null,
        countKingBonusAmount: 0
      },
      finalAmount: 900000,
      evidence: {
        available: true,
        dailyEntries: [
          {
            serviceDate: "2042-07-10",
            attendanceSummary: "09:00–19:00",
            callCount: 2,
            amount: 250000,
            calls: [call("call-a", "10:00", "A", ["티켓07 Therapist", "짝 Therapist"])],
            appliedPolicies: [
              {
                serviceCallId: "call-a",
                courseId: "course-a",
                courseCode: "A",
                role: "THERAPIST_1",
                employeeId: "emp-me",
                commissionAmount: 150000,
                rateStatus: "applied",
                call: call("call-a", "10:00", "A", ["티켓07 Therapist", "짝 Therapist"])
              },
              {
                serviceCallId: "call-b",
                courseId: "course-b",
                courseCode: "B",
                role: "THERAPIST_1",
                employeeId: "emp-me",
                commissionAmount: 0,
                rateStatus: "missing_policy",
                call: call("call-b", "14:00", "B", ["티켓07 Therapist"])
              }
            ],
            payoutConfirmation: payout("unconfirmed", 150000)
          }
        ]
      }
    });

    const view = await getTherapistPayoutView({
      employeeId: "emp-me",
      operatingMonthId: "month-1",
      dependencies: {
        getMonthlyStatement: async () => statement,
        listMonthlyClosingPreview: async () => {
          throw new Error("수당 뷰는 이 달을 다시 계산하지 않는다");
        },
        getMonthlyClosingSnapshotByVersion: async () => {
          throw new Error("수당 뷰는 마감 스냅샷을 다시 읽지 않는다");
        }
      }
    });

    assert.equal(view.isConfirmed, false);
    assert.equal(view.evidenceAvailable, true);
    assert.equal(view.dailyEntries.length, 1);
    const [entry] = view.dailyEntries;
    assert.equal(entry!.serviceDate, "2042-07-10");
    assert.equal(entry!.amount, 250000);
    assert.equal(entry!.confirmationStatus, "unconfirmed");
    assert.equal(entry!.calls.length, 2);
    assert.equal(entry!.calls[0]!.courseCode, "A");
    assert.equal(entry!.calls[0]!.commissionAmount, 150000);
    assert.equal(entry!.calls[0]!.isAmountPending, false);
    assert.equal(entry!.calls[1]!.isAmountPending, true, "코스 수당이 없는 콜은 금액 확인 중이다");
    assert.equal(entry!.calls[1]!.commissionAmount, 0);

    assert.equal(view.month.totalCallCount, 12);
    assert.equal(view.month.fullAttendanceDays, 14);
    assert.equal(view.month.finalAmount, 900000);

    const serialized = JSON.stringify(view);
    assert.ok(!serialized.includes("짝 Therapist"), "함께한 Therapist의 이름이 응답에 샜다");
  });

  it("마감된 달: 날짜별 콜 근거는 없고(evidenceAvailable=false), 지급 확인은 payoutUnits에서 그대로 보인다", async () => {
    const statement = baseStatement({
      isConfirmed: true,
      closeVersion: 3,
      finalAmount: 2700000,
      summary: {
        kind: "THERAPIST",
        totalCallCount: 22,
        monthlySettlementAmount: 1800000,
        fullAttendanceDays: 22,
        fullAttendanceAllowanceAmount: 2000000,
        countKingRank: 2,
        countKingBonusAmount: 3000000
      },
      evidence: { available: false, notice: "이 마감 버전에는 해당 근거가 저장되지 않았습니다." },
      payoutUnits: [{ serviceDate: "2042-07-10", payoutConfirmation: payout("confirmed", 250000) }],
      // 기준선은 명세서가 담아 온 값이다(미리보기·스냅샷을 여기서 다시 부르지 않는다).
      rankBaseline: [
        { rank: 1, callCount: 50 },
        { rank: 2, callCount: 22 },
        { rank: 3, callCount: 41 }
      ]
    });

    const view = await getTherapistPayoutView({
      employeeId: "emp-me",
      operatingMonthId: "month-1",
      dependencies: {
        getMonthlyStatement: async () => statement,
        listMonthlyClosingPreview: async () => {
          throw new Error("수당 뷰는 이 달을 다시 계산하지 않는다");
        },
        getMonthlyClosingSnapshotByVersion: async () => {
          throw new Error("수당 뷰는 마감 스냅샷을 다시 읽지 않는다");
        }
      }
    });

    assert.equal(view.isConfirmed, true);
    assert.equal(view.closeVersion, 3);
    assert.equal(view.evidenceAvailable, false);
    assert.equal(view.evidenceNotice, "이 마감 버전에는 해당 근거가 저장되지 않았습니다.");
    assert.equal(view.dailyEntries.length, 1);
    assert.deepEqual(view.dailyEntries[0]!.calls, [], "마감된 달은 콜별 근거가 없다");
    assert.equal(view.dailyEntries[0]!.amount, 250000);
    assert.equal(view.dailyEntries[0]!.confirmationStatus, "confirmed");

    assert.equal(view.month.countKingRank, 2);
    assert.equal(view.month.countKingBonusAmount, 3000000);
    // 기준선(1-3위 콜 수)은 숫자만 온다 — 다른 Therapist의 이름·금액은 응답에 없다(M9).
    assert.deepEqual(view.month.rankBaseline, [
      { rank: 1, callCount: 50 },
      { rank: 2, callCount: 22 },
      { rank: 3, callCount: 41 }
    ]);

    const serialized = JSON.stringify(view);
    assert.ok(!serialized.includes("1위") && !serialized.includes("3위"), "다른 Therapist의 이름이 기준선에 샜다");
    assert.ok(!serialized.includes("emp-rank1") && !serialized.includes("emp-rank3"), "다른 Therapist의 employeeId가 응답에 샜다");
  });

  it("아직 아무도 콜킹 자격이 없으면(40콜 미만) 기준선은 빈 배열이다", async () => {
    const statement = baseStatement();
    const view = await getTherapistPayoutView({
      employeeId: "emp-me",
      operatingMonthId: "month-1",
      dependencies: {
        getMonthlyStatement: async () => statement,
        listMonthlyClosingPreview: async () => {
          throw new Error("수당 뷰는 이 달을 다시 계산하지 않는다");
        },
        getMonthlyClosingSnapshotByVersion: async () => {
          throw new Error("수당 뷰는 마감 스냅샷을 다시 읽지 않는다");
        }
      }
    });

    assert.deepEqual(view.month.rankBaseline, []);
  });

  it("수당 뷰는 미리보기·마감 스냅샷을 다시 부르지 않는다(같은 달을 두 번 계산하지 않는다)", async () => {
    const statement = baseStatement();
    let statementCalls = 0;
    let previewCalls = 0;
    let snapshotCalls = 0;
    const view = await getTherapistPayoutView({
      employeeId: "emp-me",
      operatingMonthId: "month-1",
      dependencies: {
        getMonthlyStatement: async () => {
          statementCalls += 1;
          return statement;
        },
        listMonthlyClosingPreview: async () => {
          previewCalls += 1;
          return null as never;
        },
        getMonthlyClosingSnapshotByVersion: async () => {
          snapshotCalls += 1;
          return null as never;
        }
      }
    });

    assert.equal(statementCalls, 1, "월 명세서는 한 번만 부른다");
    assert.equal(previewCalls, 0, "수당 뷰는 미리보기를 다시 부르지 않는다");
    assert.equal(snapshotCalls, 0, "수당 뷰는 마감 스냅샷을 다시 부르지 않는다");
    assert.deepEqual(view.month.rankBaseline, []);
  });
});

describe("expectedPayoutAmountForDate", () => {
  it("이 Therapist의 정산 행이 없으면 0이다", async () => {
    const createdAtLocal = createdAt;
    const operatingMonth = { id: "month-1", monthKey: "2042-07", startDate: new Date("2042-07-01T00:00:00.000Z"), endDate: new Date("2042-07-31T00:00:00.000Z"), status: "작성중" };
    const client = {
      operatingMonth: { async findUnique({ where }: any) { return where.id === operatingMonth.id ? operatingMonth : null; } },
      employee: { async findMany() { return [] as any[]; } },
      course: { async findMany() { return [] as any[]; } },
      coursePolicy: { async findMany() { return [] as any[]; } },
      therapistCourseRate: { async findMany() { return [] as any[]; } },
      timeSlot: { async findMany() { return [{ value: "09:00", sortOrder: 10, createdAt: createdAtLocal, isActive: true }]; } },
      serviceCall: { async findMany() { return [] as any[]; } }
    };

    const amount = await expectedPayoutAmountForDate({ employeeId: "emp-me", operatingMonthId: "month-1", serviceDate: "2042-07-10", prismaClient: client as any });
    assert.equal(amount, 0);
  });
});
