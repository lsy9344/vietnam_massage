import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupPayoutReconfirmationUnits } from "@/app/(erp)/closing/closing-payout-groups";
import type { MonthlyClosingPayoutReconfirmationUnitDto } from "@/modules/closing/monthly-closing-checklist-service";
import type { PayoutConfirmationDto } from "@/modules/settlements/payout-confirmation-service";

function unit(overrides: Partial<MonthlyClosingPayoutReconfirmationUnitDto> = {}): MonthlyClosingPayoutReconfirmationUnitDto {
  return {
    unitType: "THERAPIST_DAILY",
    operatingMonthId: "month-1",
    serviceDate: "2026-10-10",
    employeeId: "emp-1",
    payoutConfirmation: { status: "needs_reconfirmation", currentAmount: 0, lastConfirmedAmount: 0, difference: 0, requiresReconfirmation: true, history: [] } as PayoutConfirmationDto,
    ...overrides
  };
}

// S12: 마감 점검의 지급 재확인 항목 링크가 그 날짜로 가지 못하던 자리다. unitType만으로 묶으면 같은
// 직군의 다른 날짜들이 한 건수로 합쳐져 어느 날짜로도 못 간다 — unitType·serviceDate로 묶어야 그룹마다
// 하나의 날짜가 남는다.
describe("groupPayoutReconfirmationUnits", () => {
  it("groups by unit type and service date separately, instead of merging different dates into one count", () => {
    const groups = groupPayoutReconfirmationUnits([
      unit({ employeeId: "emp-1", serviceDate: "2026-10-10" }),
      unit({ employeeId: "emp-2", serviceDate: "2026-10-10" }),
      unit({ employeeId: "emp-3", serviceDate: "2026-10-15" })
    ]);

    assert.deepEqual(groups, [
      { unitType: "THERAPIST_DAILY", serviceDate: "2026-10-10", count: 2 },
      { unitType: "THERAPIST_DAILY", serviceDate: "2026-10-15", count: 1 }
    ]);
  });

  it("keeps different unit types separate and orders by unit type then date", () => {
    const groups = groupPayoutReconfirmationUnits([
      unit({ unitType: "OPS_DAILY", serviceDate: "2026-10-12", employeeId: "ops-1" }),
      unit({ unitType: "THERAPIST_DAILY", serviceDate: "2026-10-10", employeeId: "thr-1" }),
      unit({ unitType: "OPS_MONTHLY", serviceDate: null, employeeId: "ops-2" })
    ]);

    assert.deepEqual(
      groups.map((group) => group.unitType),
      ["THERAPIST_DAILY", "OPS_DAILY", "OPS_MONTHLY"]
    );
    assert.equal(groups.find((group) => group.unitType === "OPS_MONTHLY")?.serviceDate, null);
  });

  it("returns an empty list for no units", () => {
    assert.deepEqual(groupPayoutReconfirmationUnits([]), []);
  });
});
