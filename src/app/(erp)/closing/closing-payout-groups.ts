import { payoutConfirmationUnitTypes, type PayoutConfirmationUnitType } from "@/modules/settlements/payout-confirmation-service";
import type { MonthlyClosingPayoutReconfirmationUnitDto } from "@/modules/closing/monthly-closing-checklist-service";

/**
 * 티켓 32: 미확인 건수는 직군별 총 건수로만 보여, 점검자가 '어느 날짜의 정산 화면'으로 가야 하는지 바로
 * 가지 못했다(마감 점검 전체의 기준 날짜로만 갔다). unitType·serviceDate로 묶어 그룹마다 하나의 날짜로
 * 바로 갈 수 있게 한다.
 */
export function groupPayoutReconfirmationUnits(units: MonthlyClosingPayoutReconfirmationUnitDto[]) {
  const groups = new Map<string, { unitType: PayoutConfirmationUnitType; serviceDate: string | null; count: number }>();
  for (const unit of units) {
    const key = `${unit.unitType}::${unit.serviceDate ?? ""}`;
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      groups.set(key, { unitType: unit.unitType, serviceDate: unit.serviceDate, count: 1 });
    }
  }
  return [...groups.values()].sort((a, b) => {
    const typeOrder = payoutConfirmationUnitTypes.indexOf(a.unitType) - payoutConfirmationUnitTypes.indexOf(b.unitType);
    return typeOrder !== 0 ? typeOrder : (a.serviceDate ?? "").localeCompare(b.serviceDate ?? "");
  });
}
