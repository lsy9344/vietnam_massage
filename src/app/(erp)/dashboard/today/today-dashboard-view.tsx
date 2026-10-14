import {
  AmountRows,
  cellClassName,
  CourseCompletionCard,
  DashboardCard,
  DashboardStatusCounts,
  ExcludedCallsWarning,
  headCellClassName,
  numberCellClassName,
  NoCallsState,
  tableHeadClassName
} from "@/app/(erp)/dashboard/dashboard-parts";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { createTranslator, type Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import type { TodayDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";

type TherapistSummary = TodayDashboardMetricsDto["therapistSummary"];

function TherapistWarning({ warningCounts, t, locale }: { warningCounts: TherapistSummary["therapists"][number]["warningCounts"]; t: Translator; locale: Locale }) {
  if (warningCounts.zeroPolicy + warningCounts.missingPolicy === 0) return null;
  return (
    <StatusIndicator
      label={t("dashboard.today.therapist.warningCell", {
        zero: formatNumber(locale, warningCounts.zeroPolicy),
        missing: formatNumber(locale, warningCounts.missingPolicy)
      })}
      tone="warning"
    />
  );
}

/** 마사지사별 담당 콜과 정산 합계. 600px 이상은 비교 표, 휴대폰은 같은 값의 짧은 카드다. */
function TherapistSummaryCard({ summary, locale }: { summary: TherapistSummary; locale: Locale }) {
  const t = createTranslator(locale);
  const vnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`;
  const count = (value: number) => formatNumber(locale, value);

  return (
    <DashboardCard
      aside={t("dashboard.today.therapist.summary", { count: count(summary.totalAssignedCallCount), amount: vnd(summary.totalCommissionAmount) })}
      className="min-[840px]:col-span-2 min-[1200px]:col-span-1"
      title={t("dashboard.today.therapist.title")}
    >
      {summary.therapists.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t("dashboard.today.therapist.empty")}</p>
      ) : (
        <>
          <div className="mt-3 overflow-x-auto max-[599px]:hidden">
            <table className="w-full border-collapse text-sm">
              <thead className={tableHeadClassName}>
                <tr>
                  <th className={headCellClassName} scope="col">
                    {t("dashboard.today.therapist.column.therapist")}
                  </th>
                  <th className={cn(headCellClassName, "text-right")} scope="col">
                    {t("dashboard.today.therapist.column.assignedCalls")}
                  </th>
                  <th className={cn(headCellClassName, "text-right")} scope="col">
                    {t("dashboard.today.therapist.column.settlementTotal")}
                  </th>
                  <th className={headCellClassName} scope="col">
                    {t("dashboard.today.therapist.column.warning")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {summary.therapists.map((therapist) => (
                  <tr key={therapist.employeeId}>
                    <th className={cn(cellClassName, "text-left font-semibold text-foreground")} scope="row">
                      {therapist.displayName} <span className="text-xs font-normal text-muted">{therapist.staffCode}</span>
                    </th>
                    <td className={numberCellClassName}>
                      {t("dashboard.today.therapist.assignedCount", { count: count(therapist.totalAssignedCallCount) })}
                    </td>
                    <td className={numberCellClassName}>{vnd(therapist.totalCommissionAmount)}</td>
                    <td className={cellClassName}>
                      <TherapistWarning locale={locale} t={t} warningCounts={therapist.warningCounts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-3 grid gap-2 min-[600px]:hidden">
            {summary.therapists.map((therapist) => (
              <li className="grid min-h-14 gap-1.5 rounded-md border border-border px-4 py-3 text-sm" key={therapist.employeeId}>
                <p className="font-semibold text-foreground">
                  {therapist.displayName} <span className="text-xs font-normal text-muted">{therapist.staffCode}</span>
                </p>
                <p className="flex flex-wrap items-baseline justify-between gap-x-4 text-muted">
                  {t("dashboard.today.therapist.assignedCard", { count: count(therapist.totalAssignedCallCount) })}{" "}
                  <span className="font-semibold text-foreground">{vnd(therapist.totalCommissionAmount)}</span>
                </p>
                <TherapistWarning locale={locale} t={t} warningCounts={therapist.warningCounts} />
              </li>
            ))}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}

/**
 * 보고 › 오늘. 지금 필요한 상태(진행 중인 콜)와 경고를 먼저, 핵심 금액 한 줄, 그 아래 코스별 완료와 수당.
 * 값은 모두 대시보드 서비스(getTodayDashboardMetrics)가 준 그대로다.
 */
export function TodayDashboardView({
  metrics,
  ledgerHref,
  locale
}: {
  metrics: TodayDashboardMetricsDto;
  /** 콜 원장 주소. 들어갈 수 없는 역할이면 null(링크 없음). */
  ledgerHref: string | null;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  const vndSuffix = t("dashboard.vndSuffix");
  const amount = (value: number) => formatCurrencyVnd(locale, value);
  const vnd = (value: number) => `${amount(value)} ${vndSuffix}`;
  const { financials } = metrics;

  return (
    <div className="grid gap-6">
      {metrics.emptyState.kind === "warnings_excluded" ? (
        <ExcludedCallsWarning
          detail={t("dashboard.today.warning.excludedDetail", {
            policy: formatNumber(locale, metrics.warningCounts.coursePolicyMissing),
            rate: formatNumber(locale, metrics.warningCounts.therapistRateMissing),
            second: formatNumber(locale, metrics.warningCounts.secondTherapistRequired)
          })}
          locale={locale}
          summary={t("dashboard.today.warning.excludedSummary")}
          title={t("dashboard.today.warning.excludedTitle")}
        />
      ) : null}
      {metrics.emptyState.kind === "no_calls" ? (
        <NoCallsState
          description={t("dashboard.today.empty.noCallsDescription")}
          ledgerHref={ledgerHref}
          locale={locale}
          title={t("dashboard.today.empty.noCallsTitle")}
        />
      ) : null}
      <DashboardStatusCounts counts={metrics.statusCounts} inProgressFirst label={t("dashboard.today.statusCounts.aria")} locale={locale} />

      <section aria-label={t("dashboard.today.moneyKpi.aria")}>
        {/* 매출 계열은 라벤더, 비용 계열은 피치다(design.md 2.3). 현금·계좌 잔액은 하루 수납·지출 탭에만 있다(명세 F08 기준 5). */}
        <SummaryCards className="min-[1200px]:grid-cols-3" label={t("dashboard.today.moneyKpi.cardsAria")}>
          <SummaryCard
            accent="lavender"
            label={t("dashboard.today.kpi.paymentTotal")}
            note={t("dashboard.today.kpi.discountNote", { amount: vnd(financials.discountTotal) })}
            unit={vndSuffix}
            value={amount(financials.paymentTotal)}
          />
          <SummaryCard
            accent="lavender"
            label={t("dashboard.today.kpi.netProfit")}
            note={t("dashboard.today.kpi.netProfitNote")}
            unit={vndSuffix}
            value={amount(financials.netProfit)}
          />
          <SummaryCard accent="peach" label={t("dashboard.today.kpi.dailyCostTotal")} unit={vndSuffix} value={amount(financials.dailyCostTotal)} />
        </SummaryCards>
      </section>

      <section aria-label={t("dashboard.today.detailSummary.aria")} className="grid grid-cols-1 gap-4 min-[840px]:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* 일일비용 합계를 이루는 네 금액. */}
        <DashboardCard title={t("dashboard.today.costBreakdown.title")}>
          <AmountRows
            rows={[
              { label: t("dashboard.today.kpi.expenseTotal"), value: vnd(financials.expenseTotal) },
              { label: t("dashboard.today.kpi.therapistPayoutTotal"), value: vnd(financials.therapistPayoutTotal) },
              { label: t("dashboard.today.kpi.earcarePayoutTotal"), value: vnd(financials.earcarePayoutTotal) },
              { label: t("dashboard.today.kpi.opsDailyIncentiveTotal"), value: vnd(financials.opsDailyIncentiveTotal) }
            ]}
          />
        </DashboardCard>
        <CourseCompletionCard
          basis={t("dashboard.today.course.basis")}
          courses={metrics.courseCompletions}
          locale={locale}
          rowLabel={(code) => t("dashboard.today.course.completedAria", { code })}
          title={t("dashboard.today.course.title")}
        />
        <TherapistSummaryCard locale={locale} summary={metrics.therapistSummary} />
      </section>
    </div>
  );
}
