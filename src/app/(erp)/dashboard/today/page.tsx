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
import type { Translator } from "@/lib/i18n";
import { getTodayDashboardMetrics, type TodayDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type TodayDashboardSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function KpiTile({ label, value, note, tone = "default" }: { label: string; value: string; note?: string; tone?: "default" | "strong" | "cost" }) {
  return (
    <div className={tone === "strong" ? "border-2 border-brand bg-surface px-4 py-4" : "border border-border bg-surface px-4 py-3"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={
          tone === "strong"
            ? "mt-1 text-3xl font-bold text-brand [font-variant-numeric:tabular-nums]"
            : tone === "cost"
              ? "mt-1 text-2xl font-semibold text-danger [font-variant-numeric:tabular-nums]"
              : "mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]"
        }
      >
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function StatusCountTile({
  label,
  value,
  isReservation,
  locale,
  t
}: {
  label: string;
  value: string;
  isReservation: boolean;
  locale: Locale;
  t: Translator;
}) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {isReservation ? (
          <StatusBadge state="예약" label={roomStatusLabel(locale, "예약")} ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, "예약") })} />
        ) : (
          <p className="text-sm font-semibold text-foreground">{label}</p>
        )}
        <p className="text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
      </div>
    </div>
  );
}

function EmptyOrWarningState({
  metrics,
  locale,
  t
}: {
  metrics: TodayDashboardMetricsDto;
  locale: Locale;
  t: Translator;
}) {
  if (metrics.emptyState.kind === "none") return null;

  if (metrics.emptyState.kind === "no_calls") {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label={t("dashboard.today.noData.aria")}>
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.today.empty.noCallsTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.today.empty.noCallsDescription")}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/calls">
          {t("dashboard.today.goToCalls")}
        </Link>
      </section>
    );
  }

  return (
    <section className="border border-danger bg-surface px-4 py-5" role="alert">
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.today.warning.excludedTitle")}</h2>
      <p className="mt-2 text-sm text-muted">{metrics.emptyState.message}</p>
      <p className="mt-3 text-sm font-medium text-danger">
        {t("dashboard.today.warning.excludedDetail", {
          policy: formatNumber(locale, metrics.warningCounts.coursePolicyMissing),
          rate: formatNumber(locale, metrics.warningCounts.therapistRateMissing),
          second: formatNumber(locale, metrics.warningCounts.secondTherapistRequired)
        })}
      </p>
    </section>
  );
}

export default async function TodayDashboardPage({ searchParams }: { searchParams: Promise<TodayDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/today");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  const formatVnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`;
  const formatCount = (value: number) => `${formatNumber(locale, value)}${t("dashboard.countSuffix")}`;

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("dashboard.eyebrow")}
          title={t("dashboard.today.title")}
          description={t("dashboard.today.emptyDescription")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("dashboard.empty.description")}</p>
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
    redirect(`/dashboard/today?${canonicalParams.toString()}`);
  }

  const metrics = await getTodayDashboardMetrics({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });
  const statusCounts = [
    // REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음).
    [t("dashboard.today.status.reservationCount"), metrics.statusCounts.reservation, true],
    [t("dashboard.today.status.completed"), metrics.statusCounts.completed, false],
    [t("dashboard.today.status.noShow"), metrics.statusCounts.noShow, false],
    [t("dashboard.today.status.canceled"), metrics.statusCounts.canceled, false]
  ] as const;

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.today.title")}
        description={t("dashboard.today.description")}
        meta={
          <>
            <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, metrics.operatingMonth.status)}</div>
            <div>
              {t("common.dateRange")}: {metrics.operatingMonth.startDate} ~ {metrics.operatingMonth.endDate}
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
        <EmptyOrWarningState metrics={metrics} locale={locale} t={t} />

        <section className="grid gap-3 md:grid-cols-4" aria-label={t("dashboard.today.statusCounts.aria")}>
          {statusCounts.map(([label, count, isReservation]) => (
            <StatusCountTile key={label} label={label} value={formatCount(count)} isReservation={isReservation} locale={locale} t={t} />
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label={t("dashboard.today.moneyKpi.aria")}>
          <KpiTile label={t("dashboard.today.kpi.paymentTotal")} value={formatVnd(metrics.financials.paymentTotal)} tone="strong" />
          <KpiTile label={t("dashboard.today.kpi.netProfit")} value={formatVnd(metrics.financials.netProfit)} note={t("dashboard.today.kpi.netProfitNote")} tone="strong" />
          <KpiTile label={t("dashboard.today.kpi.discountTotal")} value={formatVnd(metrics.financials.discountTotal)} />
          <KpiTile label={t("dashboard.today.kpi.opsDailyIncentiveTotal")} value={formatVnd(metrics.financials.opsDailyIncentiveTotal)} tone="cost" />
          <KpiTile label={t("dashboard.today.kpi.expenseTotal")} value={formatVnd(metrics.financials.expenseTotal)} tone="cost" />
          <KpiTile label={t("dashboard.today.kpi.therapistPayoutTotal")} value={formatVnd(metrics.financials.therapistPayoutTotal)} tone="cost" />
          <KpiTile label={t("dashboard.today.kpi.earcarePayoutTotal")} value={formatVnd(metrics.financials.earcarePayoutTotal)} tone="cost" />
          <KpiTile label={t("dashboard.today.kpi.dailyCostTotal")} value={formatVnd(metrics.financials.dailyCostTotal)} tone="cost" />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]" aria-label={t("dashboard.today.detailSummary.aria")}>
          <div className="border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">{t("dashboard.today.course.title")}</h2>
              <p className="text-xs text-muted">{t("dashboard.today.course.basis")}</p>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {metrics.courseCompletions.map((course) => (
                <div
                  aria-label={t("dashboard.today.course.completedAria", { code: course.courseCode })}
                  className="border border-border bg-background px-3 py-3 text-center"
                  key={course.courseCode}
                >
                  <p className="text-xs font-semibold text-muted">{course.courseCode}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                    {formatNumber(locale, course.completedCount)}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t("dashboard.today.course.assignment", { count: formatNumber(locale, course.therapistAssignmentCount) })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">{t("dashboard.today.therapist.title")}</h2>
              <p className="text-xs text-muted">
                {t("dashboard.today.therapist.summary", {
                  count: formatNumber(locale, metrics.therapistSummary.totalAssignedCallCount),
                  amount: formatVnd(metrics.therapistSummary.totalCommissionAmount)
                })}
              </p>
            </div>
            {metrics.therapistSummary.therapists.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                      <th className="py-2 pr-3">{t("dashboard.today.therapist.column.therapist")}</th>
                      <th className="py-2 pr-3 text-right">{t("dashboard.today.therapist.column.assignedCalls")}</th>
                      <th className="py-2 pr-3 text-right">{t("dashboard.today.therapist.column.settlementTotal")}</th>
                      <th className="py-2 text-right">{t("dashboard.today.therapist.column.warning")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.therapistSummary.therapists.map((therapist) => (
                      <tr className="border-b border-border last:border-0" key={therapist.employeeId}>
                        <td className="py-2 pr-3">
                          <span className="font-medium text-foreground">{therapist.displayName}</span>
                          <span className="ml-2 text-xs text-muted">{therapist.staffCode}</span>
                        </td>
                        <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">
                          {t("dashboard.today.therapist.assignedCount", { count: formatNumber(locale, therapist.totalAssignedCallCount) })}
                        </td>
                        <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">
                          {formatVnd(therapist.totalCommissionAmount)}
                        </td>
                        <td className="py-2 text-right text-xs text-muted">
                          {t("dashboard.today.therapist.warningCell", {
                            zero: formatNumber(locale, therapist.warningCounts.zeroPolicy),
                            missing: formatNumber(locale, therapist.warningCounts.missingPolicy)
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">{t("dashboard.today.therapist.empty")}</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
