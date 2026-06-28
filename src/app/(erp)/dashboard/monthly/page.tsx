import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge, type StatusBadgeState } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatDateTime, formatNumber } from "@/lib/i18n/format";
import { operatingMonthStatusLabel, roomStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import type { Translator } from "@/lib/i18n";
import { getMonthlyDashboardMetrics, type MonthlyDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type MonthlyDashboardSearchParams = {
  operatingMonthId?: string;
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
  badgeState,
  locale,
  t
}: {
  label: string;
  value: string;
  badgeState: StatusBadgeState | null;
  locale: Locale;
  t: Translator;
}) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {badgeState ? (
          <StatusBadge
            state={badgeState}
            label={roomStatusLabel(locale, badgeState)}
            ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, badgeState) })}
          />
        ) : (
          <p className="text-sm font-semibold text-foreground">{label}</p>
        )}
        <p className="text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
      </div>
    </div>
  );
}

function SourceBasisPanel({ metrics, locale, t }: { metrics: MonthlyDashboardMetricsDto; locale: Locale; t: Translator }) {
  if (metrics.sourceBasis.kind === "closed_snapshot") {
    return (
      <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.basis.aria")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">{t("dashboard.monthly.basis.label")}</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">{t("dashboard.monthly.basis.closedSnapshot")}</h2>
          </div>
          <div className="text-right text-sm text-muted">
            <div>closeVersion {metrics.sourceBasis.closeVersion}</div>
            <div>{t("dashboard.monthly.basis.confirmed", { value: formatDateTime(locale, metrics.sourceBasis.confirmedAt, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }) })}</div>
          </div>
        </div>
      </section>
    );
  }

  if (metrics.sourceBasis.kind === "snapshot_missing") {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.snapshotMissing.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.snapshotMissing.description")}</p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.basis.aria")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">{t("dashboard.monthly.basis.label")}</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{t("dashboard.monthly.basis.currentTitle")}</h2>
        </div>
        <p className="max-w-xl text-sm text-muted">{t("dashboard.monthly.basis.currentDescription")}</p>
      </div>
    </section>
  );
}

function EmptyOrWarningState({ metrics, locale, t }: { metrics: MonthlyDashboardMetricsDto; locale: Locale; t: Translator }) {
  if (metrics.emptyState.kind === "none" || metrics.emptyState.kind === "snapshot_missing") return null;

  if (metrics.emptyState.kind === "no_calls") {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label={t("dashboard.today.noData.aria")}>
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.empty.noCallsTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.empty.noCallsDescription")}</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/calls">
          {t("dashboard.today.goToCalls")}
        </Link>
      </section>
    );
  }

  return (
    <section className="border border-danger bg-surface px-4 py-5" role="alert">
      <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.warning.excludedTitle")}</h2>
      <p className="mt-2 text-sm text-muted">{metrics.emptyState.message}</p>
      <p className="mt-3 text-sm font-medium text-danger">
        {t("dashboard.monthly.warning.excludedDetail", {
          policy: formatNumber(locale, metrics.warningCounts.callLedger.coursePolicyMissing),
          rate: formatNumber(locale, metrics.warningCounts.callLedger.therapistRateMissing),
          second: formatNumber(locale, metrics.warningCounts.callLedger.secondTherapistRequired)
        })}
      </p>
    </section>
  );
}

function MonthlyMoneyKpis({ metrics, t, formatVnd }: { metrics: MonthlyDashboardMetricsDto; t: Translator; formatVnd: (value: number) => string }) {
  // 마감확정/잠금 월인데 확정 스냅샷이 없으면, 현재 재계산값으로 금액 KPI를 대체하지 않는다.
  // (잠금 월은 확정 스냅샷만이 신뢰 가능한 금액 기준이다.)
  if (metrics.sourceBasis.kind === "snapshot_missing" || !metrics.financials) {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert" aria-label={t("dashboard.monthly.money.withheldAria")}>
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.money.withheldTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.money.withheldDescription")}</p>
      </section>
    );
  }

  const financials = metrics.financials;

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label={t("dashboard.monthly.money.aria")}>
      <KpiTile label={t("dashboard.monthly.kpi.paymentTotal")} value={formatVnd(financials.paymentTotal)} tone="strong" />
      <KpiTile label={t("dashboard.monthly.kpi.netProfit")} value={formatVnd(financials.netProfit)} note={t("dashboard.monthly.kpi.netProfitNote")} tone="strong" />
      <KpiTile label={t("dashboard.monthly.kpi.discountTotal")} value={formatVnd(financials.discountTotal)} />
      <KpiTile label={t("dashboard.monthly.kpi.expenseTotal")} value={formatVnd(financials.expenseTotal)} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.dailyCostTotal")} value={formatVnd(financials.dailyCostTotal)} note={t("dashboard.monthly.kpi.dailyCostNote")} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.monthlyCostTotal")} value={formatVnd(financials.monthlyCostTotal)} note={t("dashboard.monthly.kpi.monthlyCostNote")} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.opsMonthlyIncentiveTotal")} value={formatVnd(financials.opsMonthlyIncentiveTotal)} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.fullAttendanceAllowanceTotal")} value={formatVnd(financials.fullAttendanceAllowanceTotal)} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.countKingBonusTotal")} value={formatVnd(financials.countKingBonusTotal)} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.settlementPayoutTotal")} value={formatVnd(financials.settlementPayoutTotal)} tone="cost" />
      <KpiTile label={t("dashboard.monthly.kpi.earcarePoolTotal")} value={formatVnd(financials.earcarePoolTotal)} />
    </section>
  );
}

function SettlementSummary({ metrics, locale, t, formatVnd }: { metrics: MonthlyDashboardMetricsDto; locale: Locale; t: Translator; formatVnd: (value: number) => string }) {
  if (!metrics.settlementSummary) {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label={t("dashboard.monthly.settlement.emptyAria")}>
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.settlement.emptyTitle")}</h2>
        <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.settlement.emptyDescription")}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={t("dashboard.monthly.settlement.aria")}>
      <KpiTile label={t("dashboard.monthly.settlement.therapistPayout")} value={formatVnd(metrics.settlementSummary.therapistPayoutAmount)} />
      <KpiTile label={t("dashboard.monthly.settlement.opsDailyIncentive")} value={formatVnd(metrics.settlementSummary.opsDailyIncentiveAmount)} />
      <KpiTile label={t("dashboard.monthly.settlement.opsMonthlyIncentive")} value={formatVnd(metrics.settlementSummary.opsMonthlyIncentiveAmount)} />
      <KpiTile label={t("dashboard.monthly.settlement.earcarePayout")} value={formatVnd(metrics.settlementSummary.earcarePayoutAmount)} />
      <KpiTile
        label={t("dashboard.monthly.settlement.grandPayout")}
        value={formatVnd(metrics.settlementSummary.grandPayoutAmount)}
        note={t("dashboard.monthly.settlement.grandPayoutNote", {
          included: formatNumber(locale, metrics.settlementSummary.includedCallCount),
          excluded: formatNumber(locale, metrics.settlementSummary.excludedCallCount)
        })}
      />
    </section>
  );
}

function PreviousSnapshotReference({ metrics, locale, t, formatVnd }: { metrics: MonthlyDashboardMetricsDto; locale: Locale; t: Translator; formatVnd: (value: number) => string }) {
  if (!metrics.snapshot || metrics.snapshot.kind !== "previous") return null;

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.previousSnapshot.aria")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.previousSnapshot.title")}</h2>
          <p className="mt-1 text-sm text-muted">{t("dashboard.monthly.previousSnapshot.description")}</p>
        </div>
        <div className="text-right text-sm text-muted">
          <div>closeVersion {metrics.snapshot.closeVersion}</div>
          <div>{formatDateTime(locale, metrics.snapshot.confirmedAt, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" })}</div>
          <div className="font-medium text-foreground">{formatVnd(metrics.snapshot.totals.grandPayoutAmount)}</div>
        </div>
      </div>
    </section>
  );
}

export default async function MonthlyDashboardPage({ searchParams }: { searchParams: Promise<MonthlyDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/monthly");
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
          title={t("dashboard.monthly.title")}
          description={t("dashboard.monthly.emptyDescription")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("dashboard.monthly.empty.description")}</p>
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

  if (params.operatingMonthId !== selectedMonth.id) {
    const canonicalParams = new URLSearchParams({ operatingMonthId: selectedMonth.id });
    redirect(`/dashboard/monthly?${canonicalParams.toString()}`);
  }

  const metrics = await getMonthlyDashboardMetrics({
    operatingMonthId: selectedMonth.id
  });
  const statusCounts: ReadonlyArray<readonly [string, number, StatusBadgeState | null]> = [
    // REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음).
    [t("dashboard.monthly.status.reservationCount"), metrics.statusCounts.reservation, null],
    [t("dashboard.monthly.status.inUse"), metrics.statusCounts.inUse, "사용중"],
    [t("dashboard.monthly.status.cleaning"), metrics.statusCounts.cleaning, "청소중"],
    [t("dashboard.monthly.status.completed"), metrics.statusCounts.completed, null],
    [t("dashboard.monthly.status.noShow"), metrics.statusCounts.noShow, null],
    [t("dashboard.monthly.status.canceled"), metrics.statusCounts.canceled, null]
  ];

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.monthly.title")}
        description={t("dashboard.monthly.description")}
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
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      <div className="space-y-4">
        <SourceBasisPanel metrics={metrics} locale={locale} t={t} />
        <EmptyOrWarningState metrics={metrics} locale={locale} t={t} />
        <PreviousSnapshotReference metrics={metrics} locale={locale} t={t} formatVnd={formatVnd} />

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={t("dashboard.monthly.statusCounts.aria")}>
          {statusCounts.map(([label, count, badgeState]) => (
            <StatusCountTile key={label} label={label} value={formatCount(count)} badgeState={badgeState} locale={locale} t={t} />
          ))}
        </section>

        <MonthlyMoneyKpis metrics={metrics} t={t} formatVnd={formatVnd} />

        <SettlementSummary metrics={metrics} locale={locale} t={t} formatVnd={formatVnd} />

        <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.course.aria")}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.course.title")}</h2>
            <p className="text-xs text-muted">{t("dashboard.monthly.course.basis")}</p>
          </div>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {metrics.courseCompletions.map((course) => (
              <div
                aria-label={t("dashboard.monthly.course.completedAria", { code: course.courseCode })}
                className="border border-border bg-background px-3 py-3 text-center"
                key={course.courseCode}
              >
                <p className="text-xs font-semibold text-muted">{course.courseCode}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                  {formatNumber(locale, course.completedCount)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("dashboard.monthly.course.assignment", { count: formatNumber(locale, course.therapistAssignmentCount) })}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
