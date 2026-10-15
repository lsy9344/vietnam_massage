"use client";

import { DetailRow } from "@/components/ui/detail-row";
import { EarcareAttendanceForm, EarcareEligibility } from "@/app/(erp)/settlements/earcare/earcare-attendance-form";
import {
  confirmEarcareDailySettlementPayoutAction,
  reconfirmEarcareDailySettlementPayoutAction,
  releaseEarcareDailySettlementPayoutAction
} from "@/app/(erp)/settlements/earcare/actions";
import { EmployeeWorkspace, type ComparisonColumn } from "@/app/(erp)/settlements/employee-workspace";
import { PayoutConfirmationPanel, PayoutStatusIndicator } from "@/app/(erp)/settlements/payout-confirmation-panel";
import { AmountText, EvidenceCallItem, EvidenceCallList, PanelSection, StatementLink, vnd } from "@/app/(erp)/settlements/settlement-parts";
import { earcareHasBasis, monthlyStatementHref, payoutAmount, settlementAmount } from "@/app/(erp)/settlements/settlement-view-model";
import { useLocale, useT } from "@/lib/i18n/client";
import { codeLabel } from "@/lib/i18n/codes";
import { settlementBasisText } from "@/lib/i18n/settlement-basis";
import type { EarcareAttendanceForDateDto } from "@/modules/settlements/earcare-attendance-service";
import type { EarcareDailySettlementResultDto, EarcareDailySettlementRowDto } from "@/modules/settlements/earcare-daily-settlement-service";

/**
 * 귀케어 일일정산의 작업면(티켓 05): 직원 비교 표와 직원 패널. 패널에서 근무상태를 정정하고, 풀 분배 근거와
 * 풀을 만든 방문완료 콜을 본다. 금액은 서비스 값을 그대로 그린다.
 */
export function EarcareSettlementView({
  result,
  attendance,
  canOpenLedger,
  canOpenStatement,
  initialEmployeeId
}: {
  result: EarcareDailySettlementResultDto;
  attendance: EarcareAttendanceForDateDto;
  canOpenLedger: boolean;
  /** 월 명세서 화면에 들어갈 수 있는 역할(관리자·정산 담당)이면 패널에 그 링크를 둔다(티켓 32). */
  canOpenStatement: boolean;
  initialEmployeeId: string | null;
}) {
  const t = useT();
  const locale = useLocale();
  const hasBasis = earcareHasBasis(result);
  const attendanceById = new Map(attendance.rows.map((row) => [row.employeeId, row]));
  const rowAmount = (row: EarcareDailySettlementRowDto, value: number) => (
    <AmountText amount={payoutAmount(value, { isPayoutEligible: row.isPayoutEligible, hasBasis })} locale={locale} />
  );

  const columns: ComparisonColumn<EarcareDailySettlementRowDto>[] = [
    {
      key: "status",
      header: t("settlements.earcare.column.workStatus"),
      cell: (row) => codeLabel(locale, "ATTENDANCE_STATUS", row.statusCode, true, row.statusDisplayName)
    },
    { key: "decision", header: t("settlements.earcare.column.payoutDecision"), cell: (row) => <EarcareEligibility row={row} /> },
    { key: "base", header: t("settlements.earcare.column.baseShare"), numeric: true, cell: (row) => rowAmount(row, row.baseShareAmount) },
    { key: "remainder", header: t("settlements.earcare.column.remainder"), numeric: true, cell: (row) => rowAmount(row, row.remainderShareAmount) },
    {
      key: "payout",
      header: t("settlements.earcare.column.payout"),
      numeric: true,
      cell: (row) => <span className="font-semibold">{rowAmount(row, row.payoutAmount)}</span>
    },
    {
      key: "payoutConfirmation",
      header: t("settlements.earcare.column.payoutConfirmation"),
      cell: (row) => <PayoutStatusIndicator status={row.payoutConfirmation.status} t={t} />
    }
  ];

  return (
    <EmployeeWorkspace
      columns={columns}
      employeeHeader={t("settlements.earcare.column.earcareStaff")}
      initialEmployeeId={initialEmployeeId}
      minTableWidth="min-w-[44rem]"
      renderPanel={(row) => {
        const attendanceRow = attendanceById.get(row.employeeId);
        return (
          <div className="grid gap-6">
            <StatementLink href={canOpenStatement ? monthlyStatementHref(attendance.operatingMonthId, row.employeeId) : null} locale={locale} />

            <PanelSection title={t("settlements.panel.attendance")}>
              {attendanceRow ? (
                <EarcareAttendanceForm
                  attendanceDate={attendance.attendanceDate}
                  disabled={attendance.isLocked}
                  key={row.employeeId}
                  operatingMonthId={attendance.operatingMonthId}
                  row={attendanceRow}
                  statusOptions={attendance.statusOptions}
                />
              ) : (
                <p className="text-sm text-muted">{t("settlements.earcare.attendance.empty.title")}</p>
              )}
            </PanelSection>

            <PanelSection title={t("settlements.earcare.panel.basis")}>
              <dl>
                <DetailRow
                  label={t("settlements.earcare.summary.completedPool")}
                  value={<AmountText amount={settlementAmount(result.earcarePoolTotal, hasBasis)} locale={locale} />}
                />
                <DetailRow label={t("settlements.earcare.summary.normalStaff")} value={`${result.eligibleCount}${t("settlements.peopleSuffix")}`} />
                <DetailRow label={t("settlements.earcare.column.baseShare")} value={rowAmount(row, row.baseShareAmount)} />
                <DetailRow label={t("settlements.earcare.column.remainder")} value={rowAmount(row, row.remainderShareAmount)} />
                <DetailRow label={t("settlements.earcare.column.payout")} value={rowAmount(row, row.payoutAmount)} />
              </dl>
              <p className="text-sm text-muted">
                {t("settlements.earcare.column.basis")}: {settlementBasisText(locale, row.calculationBasis)}
              </p>
            </PanelSection>

            <PanelSection title={t("settlements.earcare.poolEvidence.title")}>
              {result.poolEvidence.length > 0 ? (
                <EvidenceCallList label={t("settlements.earcare.poolEvidence.title")}>
                  {result.poolEvidence.map((evidence) => (
                    <li key={evidence.serviceCallId}>
                      <EvidenceCallItem
                        amount={vnd(locale, evidence.earcarePoolAmount)}
                        call={evidence.call}
                        canOpenLedger={canOpenLedger}
                        locale={locale}
                        serviceDate={evidence.serviceDate}
                      />
                    </li>
                  ))}
                </EvidenceCallList>
              ) : (
                <p className="text-sm text-muted">{t("settlements.earcare.poolEvidence.empty.title")}</p>
              )}
            </PanelSection>

            <PayoutConfirmationPanel
              confirmAction={confirmEarcareDailySettlementPayoutAction}
              locale={locale}
              payout={row.payoutConfirmation}
              payoutLocked={result.isLocked}
              reconfirmAction={reconfirmEarcareDailySettlementPayoutAction}
              releaseAction={releaseEarcareDailySettlementPayoutAction}
              t={t}
              title={t("settlements.earcare.column.payoutConfirmation")}
              unit={{ operatingMonthId: attendance.operatingMonthId, serviceDate: attendance.attendanceDate, employeeId: row.employeeId }}
            />
          </div>
        );
      }}
      rows={result.rows}
      tableLabel={t("settlements.earcare.table.title")}
    />
  );
}
