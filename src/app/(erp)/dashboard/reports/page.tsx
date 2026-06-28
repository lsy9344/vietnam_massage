import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import { operatingMonthStatusLabel, roomStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n";
import { getDashboardGraphReport, type DashboardGraphReportDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type ReportsSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

type ReportViewProps = {
  report: DashboardGraphReportDto;
  locale: Locale;
  t: Translator;
  formatVnd: (value: number) => string;
  formatPercent: (value: number) => string;
};

// sourceBasis.label(서비스 한국어 라벨)을 화면에서 안정 discriminator(kind)로 번역한다.
const SOURCE_BASIS_TITLE_KEY: Record<DashboardGraphReportDto["sourceBasis"]["kind"], MessageKey> = {
  current_recalculation: "dashboard.reports.basis.currentTitle",
  closed_snapshot: "dashboard.reports.basis.closedSnapshot",
  snapshot_missing: "dashboard.reports.snapshotMissing.title"
};

// opsIncentiveOrPayoutComposition.label(서비스 한국어 라벨)을 status로 번역한다.
const PAYOUT_LABEL_KEY: Record<DashboardGraphReportDto["opsIncentiveOrPayoutComposition"]["status"], MessageKey> = {
  available: "dashboard.reports.payout.label.closingComposition",
  no_ops_incentive_data: "dashboard.reports.payout.label.noOpsData",
  snapshot_missing: "dashboard.reports.payout.label.snapshotMissing"
};

// segment.label(서비스 한국어 라벨)을 segment.key로 번역한다.
const PAYOUT_SEGMENT_KEY: Record<DashboardGraphReportDto["opsIncentiveOrPayoutComposition"]["segments"][number]["key"], MessageKey> = {
  therapist: "dashboard.reports.payout.segment.therapist",
  ops_daily: "dashboard.reports.payout.segment.opsDaily",
  ops_monthly: "dashboard.reports.payout.segment.opsMonthly",
  earcare: "dashboard.reports.payout.segment.earcare"
};

function maxOf(values: number[]) {
  return Math.max(1, ...values);
}

function scaledY(value: number, minValue: number, maxValue: number) {
  const range = Math.max(1, maxValue - minValue);
  return 100 - ((value - minValue) / range) * 90;
}

function SourceBasisPanel({ report, t }: { report: DashboardGraphReportDto; t: Translator }) {
  if (report.sourceBasis.kind === "snapshot_missing") {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.snapshotMissing.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.reports.snapshotMissing.description")}</p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.reports.basis.aria")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t("dashboard.reports.basis.label")}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{t(SOURCE_BASIS_TITLE_KEY[report.sourceBasis.kind])}</h2>
        </div>
        <p className="max-w-2xl text-sm text-muted">{t("dashboard.reports.basis.description")}</p>
      </div>
    </section>
  );
}

function EmptyStatePanel({ report, t }: { report: DashboardGraphReportDto; t: Translator }) {
  const messages = [
    report.emptyStates.noCallsInPeriod ? t("dashboard.reports.emptyState.noCallsInPeriod") : null,
    report.emptyStates.noRevenueTrendData ? t("dashboard.reports.emptyState.noRevenueTrendData") : null,
    report.emptyStates.noCalculatedCompletedCalls ? t("dashboard.reports.emptyState.noCalculatedCompletedCalls") : null,
    report.emptyStates.graphReportSnapshotMissing ? t("dashboard.reports.emptyState.graphReportSnapshotMissing") : null,
    report.emptyStates.noRoomStatuses ? t("dashboard.reports.emptyState.noRoomStatuses") : null,
    report.emptyStates.noSettlementSource ? t("dashboard.reports.emptyState.noSettlementSource") : null
  ].filter((message): message is string => Boolean(message));

  if (messages.length === 0) return null;

  return (
    <section className="border border-border bg-surface px-4 py-5" aria-label={t("dashboard.reports.emptyState.aria")}>
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.emptyState.title")}</h2>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

function CompletedChartEmptyPanel({ t }: { t: Translator }) {
  return (
    <section className="border border-border bg-surface px-4 py-5" aria-label={t("dashboard.reports.completedEmpty.aria")}>
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.completedEmpty.title")}</h2>
      <p className="mt-2 text-sm text-muted">{t("dashboard.reports.completedEmpty.description")}</p>
    </section>
  );
}

function RevenueTrendChart({ report, locale, t, formatVnd }: ReportViewProps) {
  const revenueValues = report.dailyRevenueTrend.flatMap((row) => [row.paymentTotal, row.netSales]);
  const minRevenue = Math.min(0, ...revenueValues);
  const maxRevenue = Math.max(1, ...revenueValues);
  const pointStep = report.dailyRevenueTrend.length > 1 ? 100 / (report.dailyRevenueTrend.length - 1) : 100;
  const paymentPoints = report.dailyRevenueTrend
    .map((row, index) => `${index * pointStep},${scaledY(row.paymentTotal, minRevenue, maxRevenue)}`)
    .join(" ");
  const netSalesPoints = report.dailyRevenueTrend
    .map((row, index) => `${index * pointStep},${scaledY(row.netSales, minRevenue, maxRevenue)}`)
    .join(" ");

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="daily-revenue-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="daily-revenue-title" className="text-base font-semibold text-foreground">
          {t("dashboard.reports.revenue.title")}
        </h2>
        <p className="text-xs text-muted">{t("dashboard.reports.revenue.basis")}</p>
      </div>
      <svg className="mt-4 h-56 w-full overflow-visible" role="img" aria-labelledby="daily-revenue-chart-title" viewBox="0 0 100 110" preserveAspectRatio="none">
        <title id="daily-revenue-chart-title">{t("dashboard.reports.revenue.chartTitle")}</title>
        <polyline fill="none" points={paymentPoints} stroke="var(--color-brand)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <polyline fill="none" points={netSalesPoints} stroke="var(--color-danger)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="font-medium text-brand">{t("dashboard.reports.revenue.legendPayment")}</span>
        <span className="font-medium text-danger">{t("dashboard.reports.revenue.legendNetSales")}</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted">
              <th className="py-2 pr-3">{t("dashboard.reports.revenue.column.date")}</th>
              <th className="py-2 pr-3 text-right">{t("dashboard.reports.revenue.column.payment")}</th>
              <th className="py-2 pr-3 text-right">{t("dashboard.reports.revenue.column.netSales")}</th>
              <th className="py-2 text-right">{t("dashboard.reports.revenue.column.completed")}</th>
            </tr>
          </thead>
          <tbody>
            {report.dailyRevenueTrend.map((row) => (
              <tr className="border-b border-border last:border-0" key={row.serviceDate}>
                <td className="py-2 pr-3">{row.serviceDate}</td>
                <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">{formatVnd(row.paymentTotal)}</td>
                <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">{formatVnd(row.netSales)}</td>
                <td className="py-2 text-right [font-variant-numeric:tabular-nums]">
                  {`${formatNumber(locale, row.completedCount)}${t("dashboard.countSuffix")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CourseMixChart({ report, locale, t, formatVnd, formatPercent }: ReportViewProps) {
  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="course-mix-title">
      <h2 id="course-mix-title" className="text-base font-semibold text-foreground">
        {t("dashboard.reports.courseMix.title")}
      </h2>
      <div className="mt-4 grid gap-3">
        {report.courseMix.map((course) => (
          <div key={course.courseCode}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{t("dashboard.reports.courseMix.courseLabel", { code: course.courseCode })}</span>
              <span className="text-muted">
                {t("dashboard.reports.courseMix.detail", {
                  completed: formatNumber(locale, course.completedCount),
                  amount: formatVnd(course.paymentTotal),
                  callShare: formatPercent(course.callShare),
                  revenueShare: formatPercent(course.revenueShare)
                })}
              </span>
            </div>
            <div className="mt-2 h-3 bg-background" aria-hidden="true">
              <div className="h-3 bg-brand" style={{ width: `${course.revenueShare * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RankingCharts({ report, locale, t, formatVnd }: ReportViewProps) {
  const maxCallCount = maxOf(report.therapistCallRanking.map((row) => row.assignedCallCount));
  const maxPayout = maxOf(report.therapistSettlementRanking.map((row) => row.finalPayoutAmount));

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label={t("dashboard.reports.ranking.aria")}>
      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.ranking.callTitle")}</h2>
        <div className="mt-4 grid gap-3">
          {report.therapistCallRanking.length > 0 ? (
            report.therapistCallRanking.map((row) => (
              <div key={row.employeeId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {row.displayName} <span className="text-xs text-muted">{row.staffCode}</span>
                  </span>
                  <span className="text-muted">
                    {t("dashboard.reports.ranking.callDetail", {
                      assigned: formatNumber(locale, row.assignedCallCount),
                      first: formatNumber(locale, row.therapist1Count),
                      second: formatNumber(locale, row.therapist2Count)
                    })}
                  </span>
                </div>
                <div className="mt-2 h-3 bg-background" aria-hidden="true">
                  <div className="h-3 bg-brand" style={{ width: `${(row.assignedCallCount / maxCallCount) * 100}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">{t("dashboard.reports.ranking.callEmpty")}</p>
          )}
        </div>
      </div>

      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.ranking.settlementTitle")}</h2>
        <div className="mt-4 grid gap-3">
          {report.therapistSettlementRanking.length > 0 ? (
            report.therapistSettlementRanking.map((row) => (
              <div key={row.employeeId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {row.displayName} <span className="text-xs text-muted">{row.staffCode}</span>
                  </span>
                  <span className="text-muted">
                    {t("dashboard.reports.ranking.settlementDetail", {
                      amount: formatVnd(row.finalPayoutAmount),
                      count: formatNumber(locale, row.totalCallCount)
                    })}
                  </span>
                </div>
                <div className="mt-2 h-3 bg-background" aria-hidden="true">
                  <div className="h-3 bg-danger" style={{ width: `${(row.finalPayoutAmount / maxPayout) * 100}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">{t("dashboard.reports.ranking.settlementEmpty")}</p>
          )}
        </div>
      </div>
    </section>
  );
}

function RoomAndNoShowCharts({ report, locale, t }: ReportViewProps) {
  const maxRoomCount = maxOf(report.roomStatusDistribution.map((row) => row.count));
  const maxNoShowCancel = maxOf(report.noShowCancelTrend.flatMap((row) => [row.noShowCount, row.canceledCount]));

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label={t("dashboard.reports.roomNoShow.aria")}>
      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.room.title")}</h2>
        <div className="mt-4 grid gap-3">
          {report.roomStatusDistribution.map((row) => (
            <div key={row.displayStatus}>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge
                  state={row.displayStatus}
                  label={roomStatusLabel(locale, row.displayStatus)}
                  ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, row.displayStatus) })}
                />
                <span className="text-sm text-muted">{`${formatNumber(locale, row.count)}${t("dashboard.reports.room.countSuffix")}`}</span>
              </div>
              <div className="mt-2 h-3 bg-background" aria-hidden="true">
                <div className="h-3 bg-readonly" style={{ width: `${(row.count / maxRoomCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.noShow.title")}</h2>
        <div className="mt-4 grid gap-3" aria-label={t("dashboard.reports.noShow.chartAria")}>
          {report.noShowCancelTrend.map((row) => (
            <div className="grid gap-1" key={row.serviceDate}>
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{row.serviceDate}</span>
                <span>
                  {t("dashboard.reports.noShow.detail", {
                    noShow: formatNumber(locale, row.noShowCount),
                    canceled: formatNumber(locale, row.canceledCount)
                  })}
                </span>
              </div>
              <div className="grid gap-1" aria-hidden="true">
                <div className="h-2 bg-background">
                  <div className="h-2 bg-brand" style={{ width: `${(row.noShowCount / maxNoShowCancel) * 100}%` }} />
                </div>
                <div className="h-2 bg-background">
                  <div className="h-2 bg-danger" style={{ width: `${(row.canceledCount / maxNoShowCancel) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                <th className="py-2 pr-3">{t("dashboard.reports.noShow.column.date")}</th>
                <th className="py-2 pr-3 text-right">{t("dashboard.reports.noShow.column.noShow")}</th>
                <th className="py-2 text-right">{t("dashboard.reports.noShow.column.canceled")}</th>
              </tr>
            </thead>
            <tbody>
              {report.noShowCancelTrend.map((row) => (
                <tr className="border-b border-border last:border-0" key={row.serviceDate}>
                  <td className="py-2 pr-3">{row.serviceDate}</td>
                  <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">
                    {`${formatNumber(locale, row.noShowCount)}${t("dashboard.countSuffix")}`}
                  </td>
                  <td className="py-2 text-right [font-variant-numeric:tabular-nums]">
                    {`${formatNumber(locale, row.canceledCount)}${t("dashboard.countSuffix")}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">{t("dashboard.reports.noShow.legend")}</p>
        <div className="sr-only">{t("dashboard.reports.noShow.srSummary", { max: formatNumber(locale, maxNoShowCancel) })}</div>
      </div>
    </section>
  );
}

function PayoutCompositionChart({ report, t, formatVnd }: ReportViewProps) {
  const maxAmount = maxOf(report.opsIncentiveOrPayoutComposition.segments.map((row) => row.amount));

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="payout-composition-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="payout-composition-title" className="text-base font-semibold text-foreground">
          {t("dashboard.reports.payout.title")}
        </h2>
        <p className="text-xs text-muted">{t(PAYOUT_LABEL_KEY[report.opsIncentiveOrPayoutComposition.status])}</p>
      </div>
      {report.opsIncentiveOrPayoutComposition.segments.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.opsIncentiveOrPayoutComposition.segments.map((segment) => (
            <div key={segment.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{t(PAYOUT_SEGMENT_KEY[segment.key])}</span>
                <span className="text-muted">{formatVnd(segment.amount)}</span>
              </div>
              <div className="mt-2 h-3 bg-background" aria-hidden="true">
                <div className="h-3 bg-brand" style={{ width: `${(segment.amount / maxAmount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("dashboard.reports.payout.empty")}</p>
      )}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/reports");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  const formatVnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`;
  const formatPercent = (value: number) => `${formatNumber(locale, value * 100, { maximumFractionDigits: 1 })}%`;

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.reports.title")}
          description={t("dashboard.reports.emptyDescription")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("dashboard.reports.empty.description")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : (
            <p className="mt-4 text-sm text-muted">{t("dashboard.empty.requestAdmin")}</p>
          )}
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  if (params.operatingMonthId !== selectedMonth.id || params.serviceDate !== serviceDate) {
    const canonicalParams = new URLSearchParams({
      operatingMonthId: selectedMonth.id,
      serviceDate
    });
    redirect(`/dashboard/reports?${canonicalParams.toString()}`);
  }

  const report = await getDashboardGraphReport({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });
  const viewProps: ReportViewProps = { report, locale, t, formatVnd, formatPercent };

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.reports.title")}
        description={t("dashboard.reports.description")}
        meta={
          <>
            <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, report.operatingMonth.status)}</div>
            <div>
              {t("common.dateRange")}: {report.operatingMonth.startDate} ~ {report.operatingMonth.endDate}
            </div>
          </>
        }
      />

      <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.operatingMonth")}
          <select
            aria-label={t("common.operatingMonth")}
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.queryDate")}
          <input
            aria-label={t("common.queryDate")}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={serviceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="serviceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      <div className="space-y-4">
        <SourceBasisPanel report={report} t={t} />
        <EmptyStatePanel report={report} t={t} />
        {report.emptyStates.noRevenueTrendData ? <CompletedChartEmptyPanel t={t} /> : <RevenueTrendChart {...viewProps} />}
        {report.emptyStates.noCalculatedCompletedCalls ? (
          <PayoutCompositionChart {...viewProps} />
        ) : (
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" aria-label={t("dashboard.reports.courseAndPayout.aria")}>
            <CourseMixChart {...viewProps} />
            <PayoutCompositionChart {...viewProps} />
          </section>
        )}
        <RankingCharts {...viewProps} />
        <RoomAndNoShowCharts {...viewProps} />
      </div>
    </main>
  );
}
