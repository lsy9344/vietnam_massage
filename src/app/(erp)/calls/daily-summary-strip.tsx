import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import type { DailyCallLedgerSummaryDto, TillBalanceDto } from "@/modules/calls/service-call-service";

function TillKpis({
  till,
  labels,
  formatVnd,
  formatBalance
}: {
  till: TillBalanceDto;
  labels: {
    cashReceipts: string;
    cashExpenses: string;
    cashBalance: string;
    bankReceipts: string;
    bankExpenses: string;
    bankBalance: string;
  };
  formatVnd: (value: number) => string;
  formatBalance: (value: number, kind: "cash" | "bank") => string;
}) {
  return (
    <>
      <Kpi label={labels.cashReceipts} value={formatVnd(till.cashReceipts)} />
      <Kpi label={labels.cashExpenses} value={formatVnd(till.cashExpenses)} />
      <Kpi label={labels.cashBalance} value={formatBalance(till.cashBalance, "cash")} danger={till.cashBalance < 0} />
      <Kpi label={labels.bankReceipts} value={formatVnd(till.bankReceipts)} />
      <Kpi label={labels.bankExpenses} value={formatVnd(till.bankExpenses)} />
      <Kpi label={labels.bankBalance} value={formatBalance(till.bankBalance, "bank")} danger={till.bankBalance < 0} />
    </>
  );
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="grid min-w-28 gap-1 border-r border-border px-3 py-2 last:border-r-0">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`text-sm font-semibold [font-variant-numeric:tabular-nums] ${danger ? "text-danger" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function DailySummaryStrip({
  summary,
  showSettlementAmounts,
  locale
}: {
  summary: DailyCallLedgerSummaryDto;
  showSettlementAmounts: boolean;
  locale: Locale;
}) {
  const showTherapistAssignmentCount = showSettlementAmounts;
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;
  const countSuffix = t(locale, "calls.summary.countSuffix");
  const vndSuffix = t(locale, "calls.summary.vndSuffix");
  const formatCount = (value: number) => `${formatNumber(locale, value)}${countSuffix}`;
  const formatVnd = (value: number) => `${formatNumber(locale, value)} ${vndSuffix}`;
  const formatBalance = (value: number, kind: "cash" | "bank") => {
    if (kind === "cash" && value < 0) {
      return `${t(locale, "calls.summary.cashShortage")} ${formatNumber(locale, Math.abs(value))} ${vndSuffix}`;
    }
    return formatVnd(value);
  };

  return (
    <section className="mb-4 border border-border bg-surface" aria-label={t(locale, "calls.summary.aria")}>
      <div className="flex flex-wrap border-b border-border">
        <Kpi label={t(locale, "calls.summary.reservationCount")} value={formatCount(summary.reservationCount)} />
        <Kpi label={t(locale, "calls.summary.inUse")} value={formatCount(summary.inUseCount)} />
        <Kpi label={t(locale, "calls.summary.cleaning")} value={formatCount(summary.cleaningCount)} />
        <Kpi label={t(locale, "calls.summary.completed")} value={formatCount(summary.completedCount)} />
        <Kpi label={t(locale, "calls.summary.noShow")} value={formatCount(summary.noShowCount)} />
        <Kpi label={t(locale, "calls.summary.canceled")} value={formatCount(summary.canceledCount)} />
        <Kpi label={t(locale, "calls.summary.paymentTotal")} value={formatVnd(summary.paymentTotal)} />
        <Kpi label={t(locale, "calls.summary.discountTotal")} value={formatVnd(summary.discountTotal)} />
        <Kpi label={t(locale, "calls.summary.expenseTotal")} value={formatVnd(summary.expenseTotal)} danger={summary.expenseTotal > 0} />
        <Kpi label={t(locale, "calls.summary.netSales")} value={formatVnd(summary.netSales)} danger={summary.netSales < 0} />
        {showSettlementAmounts ? (
          <>
            <Kpi label={t(locale, "calls.summary.therapistCommission")} value={formatVnd(summary.therapistCommissionTotal)} />
            <Kpi label={t(locale, "calls.summary.earcarePool")} value={formatVnd(summary.earcarePoolTotal)} />
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap border-b border-border bg-background/60">
        <Kpi label={t(locale, "calls.summary.cash")} value={formatVnd(summary.paymentMethodTotals.cash)} />
        <Kpi label={t(locale, "calls.summary.card")} value={formatVnd(summary.paymentMethodTotals.card)} />
        <Kpi label={t(locale, "calls.summary.bank")} value={formatVnd(summary.paymentMethodTotals.bank)} />
        <Kpi label={t(locale, "calls.summary.other")} value={formatVnd(summary.paymentMethodTotals.other)} />
      </div>
      <div className="flex flex-wrap border-b border-border">
        <TillKpis
          till={summary.till.day}
          formatVnd={formatVnd}
          formatBalance={formatBalance}
          labels={{
            cashReceipts: t(locale, "calls.summary.cashReceipts"),
            cashExpenses: t(locale, "calls.summary.cashExpenses"),
            cashBalance: t(locale, "calls.summary.cashBalance"),
            bankReceipts: t(locale, "calls.summary.bankReceipts"),
            bankExpenses: t(locale, "calls.summary.bankExpenses"),
            bankBalance: t(locale, "calls.summary.bankBalance")
          }}
        />
      </div>
      <div className="flex flex-wrap border-b border-border bg-background/60">
        <TillKpis
          till={summary.till.month}
          formatVnd={formatVnd}
          formatBalance={formatBalance}
          labels={{
            cashReceipts: t(locale, "calls.summary.monthCashReceipts"),
            cashExpenses: t(locale, "calls.summary.monthCashExpenses"),
            cashBalance: t(locale, "calls.summary.monthCashBalance"),
            bankReceipts: t(locale, "calls.summary.monthBankReceipts"),
            bankExpenses: t(locale, "calls.summary.monthBankExpenses"),
            bankBalance: t(locale, "calls.summary.monthBankBalance")
          }}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead className="bg-readonly text-foreground">
            <tr>
              <th className="border-b border-border px-3 py-2">{t(locale, "calls.summary.course.code")}</th>
              <th className="border-b border-border px-3 py-2 text-right">{t(locale, "calls.summary.course.completed")}</th>
              <th className="border-b border-border px-3 py-2 text-right">{t(locale, "calls.summary.course.discountCount")}</th>
              {showTherapistAssignmentCount ? (
                <th className="border-b border-border px-3 py-2 text-right">{t(locale, "calls.summary.course.therapistAssignmentCount")}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {summary.courseSummaries.map((course) => (
              <tr key={course.courseCode}>
                <td className="border-b border-border px-3 py-2 font-semibold text-foreground">{course.courseCode}</td>
                <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">{course.completedCount}</td>
                <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">{course.discountCount}</td>
                {showTherapistAssignmentCount ? (
                  <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">
                    {course.therapistAssignmentCount}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {warningTotal > 0 && showSettlementAmounts ? (
        <p className="px-3 py-2 text-xs text-danger">
          {t(locale, "calls.summary.warning.settlement", {
            policy: summary.warningCounts.coursePolicyMissing,
            rate: summary.warningCounts.therapistRateMissing,
            second: summary.warningCounts.secondTherapistRequired
          })}
        </p>
      ) : null}
      {warningTotal > 0 && !showSettlementAmounts ? (
        <p className="px-3 py-2 text-xs text-danger">{t(locale, "calls.summary.warning.basic", { total: warningTotal })}</p>
      ) : null}
    </section>
  );
}
