import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TherapistDailySettlementDto, TherapistDailySettlementResultDto } from "@/modules/settlements/therapist-daily-settlement-service";
import { expectedPayoutAmountForDate, getTherapistPayoutView } from "@/modules/therapists/therapist-payout-view-service";

const createdAt = new Date("2042-01-01T00:00:00.000Z");

function mySettlement(): TherapistDailySettlementDto {
  return {
    employeeId: "emp-me",
    displayName: "나",
    staffCode: "TH-1",
    sortOrder: 1,
    totalCallCount: 2,
    totalCommissionAmount: 150000,
    courseBreakdown: {} as TherapistDailySettlementDto["courseBreakdown"],
    assignmentEvidence: [
      { serviceCallId: "mine-a", courseId: "a", courseCode: "A", role: "THERAPIST_1", employeeId: "emp-me", commissionAmount: 150000, rateStatus: "applied", call: { startTime: "23:30", therapistNames: ["다른 Therapist"] } },
      { serviceCallId: "mine-c", courseId: "c", courseCode: "C", role: "THERAPIST_2", employeeId: "emp-me", commissionAmount: 0, rateStatus: "missing_policy", call: { startTime: "01:00", therapistNames: [] } }
    ] as TherapistDailySettlementDto["assignmentEvidence"],
    warningCounts: { zeroPolicy: 0, missingPolicy: 1 },
    payoutConfirmation: { status: "unconfirmed", currentAmount: 150000, lastConfirmedAmount: null, difference: null, requiresReconfirmation: false, history: [] }
  };
}

function fixture(rows = [mySettlement()]) {
  const monthKeys: string[] = [];
  const queries: Array<{ operatingMonthId: string; serviceDate: string }> = [];
  return {
    monthKeys, queries,
    prismaClient: { operatingMonth: { async findUnique({ where }: { where: { monthKey: string } }) { monthKeys.push(where.monthKey); return { id: `month-${where.monthKey}` }; } } },
    dependencies: { async listTherapistDailySettlements(input: { operatingMonthId: string; serviceDate: string }): Promise<TherapistDailySettlementResultDto> {
      queries.push(input);
      return { operatingMonthId: input.operatingMonthId, serviceDate: input.serviceDate, settlements: rows, warningCounts: { coursePolicyMissing: 0, therapistRateMissing: 1, secondTherapistRequired: 0 }, excludedCallCount: 0 };
    } }
  };
}

describe("getTherapistPayoutView", () => {
  it("queries only the current service date and returns only the session employee's evidence", async () => {
    const other = { ...mySettlement(), employeeId: "emp-other", displayName: "남의 수당", totalCommissionAmount: 9999999 };
    const data = fixture([other, mySettlement()]);
    const view = await getTherapistPayoutView({ employeeId: "emp-me", now: new Date("2042-08-01T02:59:00+07:00"), ...data });
    assert.deepEqual(data.monthKeys, ["2042-07"]);
    assert.equal(data.queries.length, 1);
    assert.equal(data.queries[0].serviceDate, "2042-07-31");
    assert.equal(view.serviceDate, "2042-07-31");
    assert.equal(view.amount, 150000);
    assert.equal(view.confirmationStatus, "unconfirmed");
    assert.equal(view.calls.length, 2);
    assert.equal(view.calls[1].isAmountPending, true);
    assert.deepEqual(Object.keys(view).sort(), ["operatingMonthId", "serviceDate", "amount", "confirmationStatus", "calls"].sort());
    assert.doesNotMatch(JSON.stringify(view), /다른 Therapist|남의 수당|9999999/);
  });

  it("switches to the new month and a fresh daily total at 03:00", async () => {
    const data = fixture([]);
    const view = await getTherapistPayoutView({ employeeId: "emp-me", now: new Date("2042-08-01T03:00:00+07:00"), ...data });
    assert.deepEqual(data.monthKeys, ["2042-08"]);
    assert.equal(data.queries[0].serviceDate, "2042-08-01");
    assert.equal(view.amount, 0);
    assert.deepEqual(view.calls, []);
  });

  it("does not fall back to historical months when the current operating month is missing", async () => {
    const view = await getTherapistPayoutView({ employeeId: "emp-me", now: new Date("2042-08-01T03:00:00+07:00"), prismaClient: { operatingMonth: { async findUnique() { return null; } } }, dependencies: { async listTherapistDailySettlements() { throw new Error("must not query a different month"); } } });
    assert.equal(view.operatingMonthId, null);
    assert.equal(view.serviceDate, "2042-08-01");
    assert.equal(view.amount, 0);
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
