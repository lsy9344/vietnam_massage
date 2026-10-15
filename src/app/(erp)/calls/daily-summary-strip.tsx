import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/i18n/format";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { calculationErrorMessageKey } from "@/app/(erp)/calls/calculation-status-message";
import { ledgerCallHref } from "@/lib/ledger-address";
import type { CalculationWarningCallDto, DailyCallLedgerSummaryDto, TillBalanceDto } from "@/modules/calls/service-call-service";

const cardClassName = "rounded-lg border border-border bg-surface p-4";
const cardTitleClassName = "text-[0.9375rem] font-semibold text-foreground";
const tableHeadClassName = "bg-readonly text-xs font-semibold text-muted";
const cellClassName = "border-b border-border px-3 py-2";

// 현금이 모자라면 "부족"을 앞에 붙이고, 계좌는 음수 부호로 둔다. 단위(VND)는 부르는 쪽이 붙인다.
function balanceAmount(locale: Locale, value: number, kind: "cash" | "bank") {
  return kind === "cash" && value < 0
    ? `${t(locale, "calls.summary.cashShortage")} ${formatNumber(locale, Math.abs(value))}`
    : formatNumber(locale, value);
}

function AmountRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2 text-sm last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Card({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`${cardClassName} ${className ?? ""}`}>
      <h2 className={cardTitleClassName}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * "하루 수납·지출" 탭의 금액 요약. 값은 모두 콜 서비스(getDailyCallLedgerSummary)가 준 그대로다.
 * 현금 잔액·계좌 잔액은 순매출과 다른 카드다(ADR 0002). 지출 입력과 목록은 DailyExpensePanel이 그린다.
 */
export function DailySummaryStrip({
  summary,
  warningCalls,
  showSettlementAmounts,
  locale
}: {
  summary: DailyCallLedgerSummaryDto;
  /** 계산 경고 건수를 펼치면 보이는 콜(calculationWarningCallsFromRows). */
  warningCalls: CalculationWarningCallDto[];
  showSettlementAmounts: boolean;
  locale: Locale;
}) {
  const showTherapistAssignmentCount = showSettlementAmounts;
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;
  const vndSuffix = t(locale, "calls.summary.vndSuffix");
  const amount = (value: number) => formatNumber(locale, value);
  const formatVnd = (value: number) => `${amount(value)} ${vndSuffix}`;
  const balance = (value: number, kind: "cash" | "bank") => balanceAmount(locale, value, kind);
  const monthNote = (value: number, kind: "cash" | "bank") =>
    t(locale, "calls.cashbook.monthNote", { amount: `${balance(value, kind)} ${vndSuffix}` });

  return (
    <section aria-label={t(locale, "calls.summary.aria")} className="grid grid-cols-1 gap-6">
      <SummaryCards label={t(locale, "calls.cashbook.cardsAria")}>
        <SummaryCard accent="lavender" label={t(locale, "calls.summary.paymentTotal")} unit={vndSuffix} value={amount(summary.paymentTotal)} />
        <SummaryCard accent="lavender" label={t(locale, "calls.summary.netSales")} unit={vndSuffix} value={amount(summary.netSales)} />
        <SummaryCard
          accent="blue"
          label={t(locale, "calls.summary.cashBalance")}
          note={monthNote(summary.till.month.cashBalance, "cash")}
          unit={vndSuffix}
          value={balance(summary.till.day.cashBalance, "cash")}
        />
        <SummaryCard
          accent="blue"
          label={t(locale, "calls.summary.bankBalance")}
          note={monthNote(summary.till.month.bankBalance, "bank")}
          unit={vndSuffix}
          value={balance(summary.till.day.bankBalance, "bank")}
        />
      </SummaryCards>

      {warningTotal > 0 ? (
        <CalculationWarnings
          locale={locale}
          message={
            showSettlementAmounts
              ? t(locale, "calls.summary.warning.settlement", {
                  policy: summary.warningCounts.coursePolicyMissing,
                  rate: summary.warningCounts.therapistRateMissing,
                  second: summary.warningCounts.secondTherapistRequired
                })
              : t(locale, "calls.summary.warning.basic", { total: warningTotal })
          }
          total={warningTotal}
          warningCalls={warningCalls}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card title={t(locale, "calls.cashbook.paymentMethods")}>
          <dl className="mt-2">
            <AmountRow label={t(locale, "calls.summary.cash")} value={formatVnd(summary.paymentMethodTotals.cash)} />
            <AmountRow label={t(locale, "calls.summary.card")} value={formatVnd(summary.paymentMethodTotals.card)} />
            <AmountRow label={t(locale, "calls.summary.bank")} value={formatVnd(summary.paymentMethodTotals.bank)} />
            <AmountRow label={t(locale, "calls.summary.other")} value={formatVnd(summary.paymentMethodTotals.other)} />
          </dl>
          <dl className="mt-3 border-t border-border-strong pt-1">
            <AmountRow label={t(locale, "calls.summary.discountTotal")} value={formatVnd(summary.discountTotal)} />
            <AmountRow label={t(locale, "calls.summary.expenseTotal")} value={formatVnd(summary.expenseTotal)} />
            {showSettlementAmounts ? (
              <>
                <AmountRow label={t(locale, "calls.summary.therapistCommission")} value={formatVnd(summary.therapistCommissionTotal)} />
                <AmountRow label={t(locale, "calls.summary.earcarePool")} value={formatVnd(summary.earcarePoolTotal)} />
              </>
            ) : null}
          </dl>
        </Card>
        <Card title={t(locale, "calls.cashbook.till")}>
          <TillTable day={summary.till.day} locale={locale} month={summary.till.month} />
        </Card>
      </div>

      <Card title={t(locale, "calls.cashbook.courseSummary")}>
        <div className="mt-3 overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead className={tableHeadClassName}>
              <tr>
                <th className={cellClassName} scope="col">{t(locale, "calls.summary.course.code")}</th>
                <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.summary.course.completed")}</th>
                <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.summary.course.discountCount")}</th>
                {showTherapistAssignmentCount ? (
                  <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.summary.course.therapistAssignmentCount")}</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {summary.courseSummaries.map((course) => (
                <tr className="hover:bg-readonly" key={course.courseCode}>
                  <th className={`${cellClassName} font-semibold text-foreground`} scope="row">{course.courseCode}</th>
                  <td className={`${cellClassName} text-right`}>{course.completedCount}</td>
                  <td className={`${cellClassName} text-right`}>{course.discountCount}</td>
                  {showTherapistAssignmentCount ? <td className={`${cellClassName} text-right`}>{course.therapistAssignmentCount}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function TillTable({ day, month, locale }: { day: TillBalanceDto; month: TillBalanceDto; locale: Locale }) {
  const vndSuffix = t(locale, "calls.summary.vndSuffix");
  const formatVnd = (value: number) => `${formatNumber(locale, value)} ${vndSuffix}`;
  const formatBalance = (value: number, kind: "cash" | "bank") => `${balanceAmount(locale, value, kind)} ${vndSuffix}`;
  const periods = [
    { key: "today", label: t(locale, "calls.cashbook.till.today"), till: day },
    { key: "month", label: t(locale, "calls.cashbook.till.month"), till: month }
  ];

  return (
    <div className="mt-3 overflow-x-auto rounded-md border border-border">
      <table aria-label={t(locale, "calls.cashbook.till")} className="w-full min-w-[32rem] border-collapse text-left text-sm">
        <thead className={tableHeadClassName}>
          <tr>
            <th className={cellClassName} scope="col">{t(locale, "calls.cashbook.till.kind")}</th>
            <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.cashbook.till.receipts")}</th>
            <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.cashbook.till.expenses")}</th>
            <th className={`${cellClassName} text-right`} scope="col">{t(locale, "calls.cashbook.till.balance")}</th>
          </tr>
        </thead>
        {periods.map((period) => (
          <tbody key={period.key}>
            <tr>
              <th className={`${cellClassName} text-xs font-semibold text-muted`} colSpan={4} scope="rowgroup">
                {period.label}
              </th>
            </tr>
            {(["cash", "bank"] as const).map((kind) => {
              const receipts = kind === "cash" ? period.till.cashReceipts : period.till.bankReceipts;
              const expenses = kind === "cash" ? period.till.cashExpenses : period.till.bankExpenses;
              const value = kind === "cash" ? period.till.cashBalance : period.till.bankBalance;
              return (
                <tr className="hover:bg-readonly" key={kind}>
                  <th className={`${cellClassName} font-medium text-foreground`} scope="row">
                    {t(locale, kind === "cash" ? "calls.summary.cash" : "calls.summary.bank")}
                  </th>
                  <td className={`${cellClassName} text-right`}>{formatVnd(receipts)}</td>
                  <td className={`${cellClassName} text-right`}>{formatVnd(expenses)}</td>
                  <td className={`${cellClassName} text-right font-semibold ${value < 0 ? "text-danger" : "text-foreground"}`}>
                    {formatBalance(value, kind)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function CalculationWarnings({
  locale,
  message,
  total,
  warningCalls
}: {
  locale: Locale;
  message: string;
  total: number;
  warningCalls: CalculationWarningCallDto[];
}) {
  return (
    <details className="rounded-lg border border-border bg-surface">
      <summary className="min-h-11 cursor-pointer rounded-lg px-4 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary">
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 align-middle">
          <StatusIndicator label={t(locale, "calls.cashbook.warnings.count", { count: total })} tone="warning" />
          <span className="text-sm text-foreground">{message}</span>
        </span>
      </summary>
      <div className="relative overflow-x-auto border-t border-border">
        <table aria-label={t(locale, "calls.cashbook.warnings.listAria")} className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className={tableHeadClassName}>
            <tr>
              <th className={cellClassName} scope="col">{t(locale, "calls.search.column.time")}</th>
              <th className={cellClassName} scope="col">{t(locale, "calls.column.customerMemo")}</th>
              <th className={cellClassName} scope="col">{t(locale, "calls.cashbook.warnings.column.status")}</th>
              <th className={cellClassName} scope="col">
                <span className="sr-only">{t(locale, "calls.cashbook.warnings.open")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {warningCalls.map((call) => (
              <tr className="hover:bg-readonly" key={call.serviceCallId}>
                <td className={cellClassName}>{call.startTime}</td>
                <td className={cellClassName}>{call.customerMemo || "—"}</td>
                <td className={`${cellClassName} text-danger`}>{t(locale, calculationErrorMessageKey(call.calculationStatus))}</td>
                <td className={`${cellClassName} text-right`}>
                  {/* 주소의 call 매개변수로 원장 표의 그 행이 선택되고 콜 상세 패널이 열린다. */}
                  <a className="screen-step" href={ledgerCallHref(call)}>
                    {t(locale, "calls.cashbook.warnings.open")}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
