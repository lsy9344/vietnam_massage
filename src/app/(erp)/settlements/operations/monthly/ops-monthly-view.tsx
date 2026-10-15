"use client";

import { DetailRow } from "@/components/ui/detail-row";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import {
  confirmOpsMonthlyIncentivePayoutAction,
  reconfirmOpsMonthlyIncentivePayoutAction,
  releaseOpsMonthlyIncentivePayoutAction
} from "@/app/(erp)/settlements/operations/monthly/actions";
import { PayoutConfirmationPanel, PayoutStatusIndicator } from "@/app/(erp)/settlements/payout-confirmation-panel";
import { AmountText, PanelSection } from "@/app/(erp)/settlements/settlement-parts";
import { incentiveRuleHasBasis, payoutAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { useLocale, useT } from "@/lib/i18n/client";
import type { Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";
import type {
  OpsMonthlyIncentiveResultDto,
  OpsMonthlyIncentiveRowDto,
  OpsMonthlyIncentiveTeamRole
} from "@/modules/settlements/ops-monthly-incentive-service";

// 팀 역할 라벨은 stable teamRole 키로 번역한다(서비스의 한국어 teamShareLabel 대신).
function teamRoleLabel(t: Translator, role: OpsMonthlyIncentiveTeamRole) {
  return t(`settlements.opsMonthly.team.${role}`);
}

// 분배율/팀 몫: row의 teamRole에 해당하는 share(비율)·team amount를 result.shares에서 재구성한다.
function shareTeamPortionText(locale: Locale, t: Translator, shares: OpsMonthlyIncentiveResultDto["shares"], role: OpsMonthlyIncentiveTeamRole) {
  const byRole = {
    lead: { share: shares.leadShare, amount: shares.leadAmount },
    counter: { share: shares.counterTeamShare, amount: shares.counterTeamAmount },
    waiter: { share: shares.waiterTeamShare, amount: shares.waiterTeamAmount }
  } as const;
  if (role === "unassigned") return t("settlements.opsMonthly.shareTeamPortion.none");
  const { share, amount } = byRole[role];
  return t("settlements.opsMonthly.shareTeamPortion.value", {
    percent: formatNumber(locale, Math.round(share * 100)),
    amount: formatNumber(locale, amount)
  });
}

/**
 * 운영팀 월 인센 미리보기의 작업면(티켓 05): 직원별 금액 표와 직원 패널(규칙 근거). 금액은 서비스 값을 그대로 그린다.
 * 정책이 없으면 팀 몫과 직원 금액은 0이 아니라 근거 없음이다.
 */
export function OpsMonthlyView({ result, initialEmployeeId }: { result: OpsMonthlyIncentiveResultDto; initialEmployeeId: string | null }) {
  const t = useT();
  const locale = useLocale();
  const hasBasis = incentiveRuleHasBasis(result.ruleStatus);
  // 팀이 없는 직원은 정책과 상관없이 팀 몫이 없다. 정책 없음과 구분해 "-"와 0을 그대로 둔다.
  const portion = (row: OpsMonthlyIncentiveRowDto) =>
    hasBasis || row.teamRole === "unassigned" ? (
      shareTeamPortionText(locale, t, result.shares, row.teamRole)
    ) : (
      <AmountText amount={{ kind: "noBasis" }} locale={locale} />
    );
  const payout = (row: OpsMonthlyIncentiveRowDto) => (
    <AmountText amount={payoutAmount(row.payoutAmount, { isPayoutEligible: row.teamRole !== "unassigned", hasBasis })} locale={locale} />
  );

  const columns: ComparisonColumn<OpsMonthlyIncentiveRowDto>[] = [
    { key: "position", header: t("settlements.opsMonthly.column.position"), cell: (row) => row.position },
    { key: "teamRole", header: t("settlements.opsMonthly.column.teamRole"), cell: (row) => teamRoleLabel(t, row.teamRole) },
    { key: "portion", header: t("settlements.opsMonthly.column.shareTeamPortion"), cell: portion },
    {
      key: "payout",
      header: t("settlements.opsMonthly.column.expectedPayout"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{payout(row)}</span>
    },
    {
      key: "payoutConfirmation",
      header: t("settlements.opsMonthly.column.payoutConfirmation"),
      cell: (row) => <PayoutStatusIndicator status={row.payoutConfirmation.status} t={t} />
    }
  ];

  return (
    <EmployeeWorkspace
      columns={columns}
      employeeHeader={t("settlements.opsMonthly.column.opsStaff")}
      initialEmployeeId={initialEmployeeId}
      minTableWidth="min-w-[40rem]"
      renderPanel={(row) => (
        <div className="grid gap-6">
          <PanelSection title={t("settlements.opsMonthly.panel.basis")}>
            <dl>
              <DetailRow label={t("settlements.opsMonthly.column.teamRole")} value={teamRoleLabel(t, row.teamRole)} />
              <DetailRow label={t("settlements.opsMonthly.column.shareTeamPortion")} value={portion(row)} />
              <DetailRow label={t("settlements.opsMonthly.column.expectedPayout")} value={payout(row)} />
            </dl>
            <p className="text-sm text-muted">
              {t("settlements.opsMonthly.column.basis")}: {settlementBasisText(locale, row.calculationBasis)}
            </p>
          </PanelSection>

          <PayoutConfirmationPanel
            confirmAction={confirmOpsMonthlyIncentivePayoutAction}
            locale={locale}
            payout={row.payoutConfirmation}
            payoutLocked={result.isClosedOrLocked}
            reconfirmAction={reconfirmOpsMonthlyIncentivePayoutAction}
            releaseAction={releaseOpsMonthlyIncentivePayoutAction}
            t={t}
            title={t("settlements.opsMonthly.column.payoutConfirmation")}
            unit={{ operatingMonthId: result.operatingMonthId, serviceDate: "", employeeId: row.employeeId }}
          />
        </div>
      )}
      rows={result.rows}
      tableLabel={t("settlements.opsMonthly.employeeTable.title")}
    />
  );
}
