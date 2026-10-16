"use client";

import { DetailRow } from "@/components/ui/detail-row";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import {
  confirmOpsDailyIncentivePayoutAction,
  reconfirmOpsDailyIncentivePayoutAction,
  releaseOpsDailyIncentivePayoutAction
} from "@/app/(erp)/settlements/operations/actions";
import { OpsAttendanceForm, OpsEligibility } from "@/app/(erp)/settlements/operations/ops-attendance-form";
import { opsThresholdLabel } from "@/app/(erp)/settlements/operations/ops-threshold";
import { PayoutConfirmationPanel, PayoutStatusIndicator } from "@/app/(erp)/settlements/payout-confirmation-panel";
import { AmountText, EvidenceCallItem, EvidenceCallList, PanelSection, StatementLink } from "@/app/(erp)/settlements/settlement-parts";
import { incentiveRuleHasBasis, monthlyStatementHref, payoutAmount, settlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { useLocale, useT } from "@/lib/i18n/client";
import { codeLabel } from "@/lib/i18n/codes";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";
import type { OpsAttendanceForDateDto } from "@/modules/settlements/ops-attendance-service";
import type { OpsDailyIncentiveResultDto, OpsDailyIncentiveRowDto } from "@/modules/settlements/ops-daily-incentive-service";

/**
 * 운영팀 일일 인센의 작업면(티켓 05): 직원 비교 표와 직원 패널. 패널에서 근무상태를 정정하고, 인센 근거와
 * 일 총콜을 만든 방문완료 콜을 본다. 금액은 서비스 값을 그대로 그린다.
 */
export function OpsDailyView({
  result,
  attendance,
  canOpenLedger,
  canOpenStatement,
  initialEmployeeId
}: {
  result: OpsDailyIncentiveResultDto;
  attendance: OpsAttendanceForDateDto;
  canOpenLedger: boolean;
  /** 월 명세서 화면에 들어갈 수 있는 역할(관리자·정산 담당)이면 패널에 그 링크를 둔다(티켓 32). */
  canOpenStatement: boolean;
  initialEmployeeId: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const hasBasis = incentiveRuleHasBasis(result.ruleStatus);
  const attendanceById = new Map(attendance.rows.map((row) => [row.employeeId, row]));
  const payout = (row: OpsDailyIncentiveRowDto) => (
    <AmountText amount={payoutAmount(row.payoutAmount, { isPayoutEligible: row.isPayoutEligible, hasBasis })} locale={locale} />
  );
  const callSuffix = t("settlements.callSuffix");

  const columns: ComparisonColumn<OpsDailyIncentiveRowDto>[] = [
    { key: "position", header: t("settlements.ops.column.position"), cell: (row) => row.position },
    {
      key: "status",
      header: t("settlements.ops.column.workStatus"),
      cell: (row) => codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName)
    },
    {
      key: "decision",
      header: t("settlements.ops.column.payoutDecision"),
      // 지급 대상이어도 정책이 없거나 기준에 못 미치면 그 사유를 보인다. 근무상태로 제외된 직원은 제외 사유다.
      cell: (row) =>
        row.isPayoutEligible && result.ruleStatus !== "applied" ? (
          <StatusIndicator label={opsThresholdLabel(locale, result)} tone={hasBasis ? "neutral" : "warning"} />
        ) : (
          <OpsEligibility row={row} />
        )
    },
    { key: "payout", header: t("settlements.ops.column.payout"), numeric: true, cell: (row) => <span className="font-semibold">{payout(row)}</span> },
    {
      key: "payoutConfirmation",
      header: t("settlements.ops.column.payoutConfirmation"),
      cell: (row) => <PayoutStatusIndicator status={row.payoutConfirmation.status} t={t} />
    }
  ];

  return (
    <EmployeeWorkspace
      columns={columns}
      employeeHeader={t("settlements.ops.column.opsStaff")}
      initialEmployeeId={initialEmployeeId}
      minTableWidth="min-w-[40rem]"
      renderPanel={(row) => {
        const attendanceRow = attendanceById.get(row.employeeId);
        return (
          <div className="grid gap-6">
            <StatementLink href={canOpenStatement ? monthlyStatementHref(attendance.operatingMonthId, row.employeeId) : null} locale={locale} />

            <PanelSection title={t("settlements.panel.attendance")}>
              {attendanceRow ? (
                <OpsAttendanceForm
                  attendanceDate={attendance.attendanceDate}
                  disabled={attendance.isLocked}
                  key={row.employeeId}
                  operatingMonthId={attendance.operatingMonthId}
                  row={attendanceRow}
                  statusOptions={attendance.statusOptions}
                />
              ) : (
                <p className="text-sm text-muted">{t("settlements.ops.attendance.empty.title")}</p>
              )}
            </PanelSection>

            <PanelSection title={t("settlements.ops.panel.basis")}>
              <dl>
                <DetailRow label={t("settlements.ops.summary.dailyTotalCalls")} value={`${result.dailyOpsCallCount}${callSuffix}`} />
                <DetailRow label={t("settlements.ops.summary.appliedThreshold")} value={opsThresholdLabel(locale, result)} />
                <DetailRow
                  label={t("settlements.ops.summary.perPerson")}
                  value={<AmountText amount={settlementAmount(result.personalIncentiveAmount, hasBasis)} locale={locale} />}
                />
                <DetailRow label={t("settlements.ops.column.payout")} value={payout(row)} />
              </dl>
              <p className="text-sm text-muted">
                {t("settlements.ops.column.basis")}: {settlementBasisText(locale, row.calculationBasis)}
              </p>
            </PanelSection>

            <PanelSection title={t("settlements.ops.callEvidence.title")}>
              {result.callEvidence.length > 0 ? (
                <EvidenceCallList label={t("settlements.ops.callEvidence.title")}>
                  {result.callEvidence.map((evidence) => (
                    <li key={evidence.serviceCallId}>
                      <EvidenceCallItem
                        amount={`1${callSuffix}`}
                        call={evidence.call}
                        canOpenLedger={canOpenLedger}
                        locale={locale}
                        serviceDate={evidence.serviceDate}
                      />
                    </li>
                  ))}
                </EvidenceCallList>
              ) : (
                <p className="text-sm text-muted">{t("settlements.ops.callEvidence.empty.title")}</p>
              )}
            </PanelSection>

            <PayoutConfirmationPanel
              confirmAction={confirmOpsDailyIncentivePayoutAction}
              locale={locale}
              payout={row.payoutConfirmation}
              payoutLocked={result.isLocked}
              reconfirmAction={reconfirmOpsDailyIncentivePayoutAction}
              releaseAction={releaseOpsDailyIncentivePayoutAction}
              t={t}
              title={t("settlements.ops.column.payoutConfirmation")}
              unit={{ operatingMonthId: attendance.operatingMonthId, serviceDate: attendance.attendanceDate, employeeId: row.employeeId }}
            />
          </div>
        );
      }}
      rows={result.rows}
      tableLabel={t("settlements.ops.table.title")}
    />
  );
}
