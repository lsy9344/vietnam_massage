import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import type { DailyCallLedgerSummaryDto, TillBalanceDto } from "@/modules/calls/service-call-service";

// 모든 줄이 같은 열 틀을 써서 칸이 위아래로 맞는다. 첫 칸은 줄 이름이다.
const ROW_GRID = "grid grid-cols-[6.5rem_repeat(6,minmax(0,1fr))]";
const ROW_LABEL_TEXT = "border-r border-border bg-readonly/60 px-3 py-2 text-left text-xs font-semibold text-foreground";
const ROW_LABEL = `flex items-center ${ROW_LABEL_TEXT}`;

function Kpi({ label, value, danger, strong }: { label: string; value: string; danger?: boolean; strong?: boolean }) {
  return (
    <div className="grid min-w-0 content-center gap-0.5 border-r border-border px-3 py-2 last:border-r-0">
      <span className="truncate text-xs font-medium text-muted">{label}</span>
      <span
        className={`truncate [font-variant-numeric:tabular-nums] ${strong ? "text-base font-bold" : "text-sm font-semibold"} ${
          danger ? "text-danger" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function KpiRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={`${ROW_GRID} border-b border-border`}>
      <div className={ROW_LABEL}>{label}</div>
      {children}
    </div>
  );
}

function TillTable({
  day,
  month,
  locale,
  formatVnd,
  formatBalance
}: {
  day: TillBalanceDto;
  month: TillBalanceDto;
  locale: Locale;
  formatVnd: (value: number) => string;
  formatBalance: (value: number, kind: "cash" | "bank") => string;
}) {
  const headCell = "border-b border-border px-3 py-1.5 text-right text-xs font-medium text-muted";
  const amountCell = "border-b border-border px-3 py-2 text-right text-sm [font-variant-numeric:tabular-nums]";
  const rows = [
    { kind: "cash" as const, label: t(locale, "calls.summary.cash") },
    { kind: "bank" as const, label: t(locale, "calls.summary.bank") }
  ];

  return (
    <table className="w-full table-fixed border-collapse border-b border-border text-left">
      <caption className="sr-only">{t(locale, "calls.summary.till.title")}</caption>
      <colgroup>
        <col className="w-[6.5rem]" />
        <col span={6} />
      </colgroup>
      <thead>
        <tr>
          <th className={`${ROW_LABEL_TEXT} align-middle`} rowSpan={2} scope="col">
            {t(locale, "calls.summary.till.title")}
          </th>
          <th className="border-b border-border px-3 pt-2 text-right text-xs font-semibold text-foreground" colSpan={3} scope="colgroup">
            {t(locale, "calls.summary.till.day")}
          </th>
          <th
            className="border-b border-l border-border px-3 pt-2 text-right text-xs font-semibold text-foreground"
            colSpan={3}
            scope="colgroup"
          >
            {t(locale, "calls.summary.till.month")}
          </th>
        </tr>
        <tr>
          {[0, 1].map((group) => (
            <TillHeadCells className={headCell} first={group === 1} key={group} locale={locale} />
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.kind}>
            <th className={`${ROW_LABEL_TEXT} border-t font-semibold`} scope="row">
              {row.label}
            </th>
            {[day, month].map((till, group) => {
              const receipts = row.kind === "cash" ? till.cashReceipts : till.bankReceipts;
              const expenses = row.kind === "cash" ? till.cashExpenses : till.bankExpenses;
              const balance = row.kind === "cash" ? till.cashBalance : till.bankBalance;
              return [
                <td className={`${amountCell} text-foreground ${group === 1 ? "border-l" : ""}`} key={`${group}-in`}>
                  {formatVnd(receipts)}
                </td>,
                <td className={`${amountCell} text-foreground`} key={`${group}-out`}>
                  {formatVnd(expenses)}
                </td>,
                <td className={`${amountCell} font-semibold ${balance < 0 ? "text-danger" : "text-foreground"}`} key={`${group}-balance`}>
                  {formatBalance(balance, row.kind)}
                </td>
              ];
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TillHeadCells({ className, first, locale }: { className: string; first: boolean; locale: Locale }) {
  return (
    <>
      <th className={`${className} ${first ? "border-l" : ""}`} scope="col">
        {t(locale, "calls.summary.till.receipts")}
      </th>
      <th className={className} scope="col">
        {t(locale, "calls.summary.till.expenses")}
      </th>
      <th className={className} scope="col">
        {t(locale, "calls.summary.till.balance")}
      </th>
    </>
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
      <KpiRow label={t(locale, "calls.summary.row.calls")}>
        <Kpi label={t(locale, "calls.summary.reservationCount")} value={formatCount(summary.reservationCount)} />
        <Kpi label={t(locale, "calls.summary.inUse")} value={formatCount(summary.inUseCount)} />
        <Kpi label={t(locale, "calls.summary.cleaning")} value={formatCount(summary.cleaningCount)} />
        <Kpi label={t(locale, "calls.summary.completed")} value={formatCount(summary.completedCount)} />
        <Kpi label={t(locale, "calls.summary.noShow")} value={formatCount(summary.noShowCount)} />
        <Kpi label={t(locale, "calls.summary.canceled")} value={formatCount(summary.canceledCount)} />
      </KpiRow>
      <KpiRow label={t(locale, "calls.summary.row.sales")}>
        <Kpi label={t(locale, "calls.summary.paymentTotal")} value={formatVnd(summary.paymentTotal)} />
        <Kpi label={t(locale, "calls.summary.discountTotal")} value={formatVnd(summary.discountTotal)} />
        <Kpi label={t(locale, "calls.summary.expenseTotal")} value={formatVnd(summary.expenseTotal)} danger={summary.expenseTotal > 0} />
        <Kpi label={t(locale, "calls.summary.netSales")} value={formatVnd(summary.netSales)} danger={summary.netSales < 0} strong />
        {showSettlementAmounts ? (
          <>
            <Kpi label={t(locale, "calls.summary.therapistCommission")} value={formatVnd(summary.therapistCommissionTotal)} />
            <Kpi label={t(locale, "calls.summary.earcarePool")} value={formatVnd(summary.earcarePoolTotal)} />
          </>
        ) : null}
      </KpiRow>
      <KpiRow label={t(locale, "calls.summary.row.paymentMethods")}>
        <Kpi label={t(locale, "calls.summary.cash")} value={formatVnd(summary.paymentMethodTotals.cash)} />
        <Kpi label={t(locale, "calls.summary.card")} value={formatVnd(summary.paymentMethodTotals.card)} />
        <Kpi label={t(locale, "calls.summary.bank")} value={formatVnd(summary.paymentMethodTotals.bank)} />
        <Kpi label={t(locale, "calls.summary.other")} value={formatVnd(summary.paymentMethodTotals.other)} />
      </KpiRow>
      <TillTable day={summary.till.day} formatBalance={formatBalance} formatVnd={formatVnd} locale={locale} month={summary.till.month} />
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)]">
        <div className={`flex items-start ${ROW_LABEL_TEXT}`}>{t(locale, "calls.summary.row.courses")}</div>
        <div className="overflow-x-auto">
          {/* 열 하나가 위 지표 칸 하나와 같은 폭이다. */}
          <table className={`${showTherapistAssignmentCount ? "w-2/3" : "w-1/2"} table-fixed border-collapse text-left text-xs`}>
            <thead className="text-muted">
              <tr>
                <th className="border-b border-border px-3 py-1.5 font-medium">{t(locale, "calls.summary.course.code")}</th>
                <th className="border-b border-border px-3 py-1.5 text-right font-medium">{t(locale, "calls.summary.course.completed")}</th>
                <th className="border-b border-border px-3 py-1.5 text-right font-medium">{t(locale, "calls.summary.course.discountCount")}</th>
                {showTherapistAssignmentCount ? (
                  <th className="border-b border-border px-3 py-1.5 text-right font-medium">
                    {t(locale, "calls.summary.course.therapistAssignmentCount")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {summary.courseSummaries.map((course) => (
                <tr className="border-b border-border last:border-b-0" key={course.courseCode}>
                  <td className="px-3 py-1.5 font-semibold text-foreground">{course.courseCode}</td>
                  <td className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]">{course.completedCount}</td>
                  <td className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]">{course.discountCount}</td>
                  {showTherapistAssignmentCount ? (
                    <td className="px-3 py-1.5 text-right [font-variant-numeric:tabular-nums]">{course.therapistAssignmentCount}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {warningTotal > 0 && showSettlementAmounts ? (
        <p className="border-t border-border px-3 py-2 text-xs text-danger">
          {t(locale, "calls.summary.warning.settlement", {
            policy: summary.warningCounts.coursePolicyMissing,
            rate: summary.warningCounts.therapistRateMissing,
            second: summary.warningCounts.secondTherapistRequired
          })}
        </p>
      ) : null}
      {warningTotal > 0 && !showSettlementAmounts ? (
        <p className="border-t border-border px-3 py-2 text-xs text-danger">{t(locale, "calls.summary.warning.basic", { total: warningTotal })}</p>
      ) : null}
    </section>
  );
}
