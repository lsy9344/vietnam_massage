import {
  AmountRows,
  CourseCompletionCard,
  DashboardCard,
  DashboardStatusCounts,
  ExcludedCallsWarning,
  NoCallsState
} from "@/app/(erp)/dashboard/dashboard-parts";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { SummaryCard, SummaryCards } from "@/components/ui/summary-card";
import { createTranslator, type Translator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd, formatDateTime, formatNumber } from "@/lib/i18n/format";
import type { MonthlyDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";

function closeVersionLine(t: Translator, locale: Locale, version: number, confirmedAt: string) {
  return `${t("dashboard.monthly.basis.version", { version })} · ${t("dashboard.monthly.basis.confirmed", {
    value: formatDateTime(locale, confirmedAt, { dateStyle: "medium", timeStyle: "short" })
  })}`;
}

/** 이 달의 숫자가 어디서 왔는지: 확정 스냅샷(마감 버전) 또는 미확정 현재 계산. */
function BasisLine({ basis, locale }: { basis: MonthlyDashboardMetricsDto["sourceBasis"]; locale: Locale }) {
  const t = createTranslator(locale);
  if (basis.kind === "snapshot_missing") {
    return (
      <ScreenState
        description={t("dashboard.monthly.snapshotMissing.description")}
        kind="error"
        label={t("dashboard.error.chip")}
        title={t("dashboard.monthly.snapshotMissing.title")}
      />
    );
  }

  return (
    <section aria-label={t("dashboard.monthly.basis.aria")} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {basis.kind === "closed_snapshot" ? (
        <>
          <StatusIndicator label={t("dashboard.monthly.basis.closedSnapshot")} tone="info" />
          <p className="text-sm text-muted">{closeVersionLine(t, locale, basis.closeVersion, basis.confirmedAt)}</p>
        </>
      ) : (
        <>
          <StatusIndicator label={t("dashboard.monthly.basis.currentTitle")} tone="neutral" />
          <p className="text-sm text-muted">{t("dashboard.monthly.basis.currentDescription")}</p>
        </>
      )}
    </section>
  );
}

/** 재오픈된 검토중 월의 이전 마감 버전. 현재 KPI 기준에 섞지 않고 참고로만 보인다. */
function PreviousSnapshotCard({ snapshot, locale }: { snapshot: NonNullable<MonthlyDashboardMetricsDto["snapshot"]>; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <DashboardCard title={t("dashboard.monthly.previousSnapshot.title")}>
      <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.previousSnapshot.description")}</p>
      <p className="mt-2 text-sm text-muted">{closeVersionLine(t, locale, snapshot.closeVersion, snapshot.confirmedAt)}</p>
      <AmountRows
        rows={[
          {
            label: t("dashboard.monthly.settlement.grandPayout"),
            value: `${formatCurrencyVnd(locale, snapshot.totals.grandPayoutAmount)} ${t("dashboard.vndSuffix")}`
          }
        ]}
      />
    </DashboardCard>
  );
}

/**
 * 운영월 금액 요약 카드. 매출 계열은 라벤더, 비용 계열은 피치다(design.md 2.3).
 * 마감확정·잠금 월인데 확정 스냅샷이 없으면 현재 재계산값으로 대체하지 않고 표시를 보류한다.
 */
function MoneyCards({ financials, locale }: { financials: MonthlyDashboardMetricsDto["financials"]; locale: Locale }) {
  const t = createTranslator(locale);
  if (!financials) {
    return (
      <ScreenState
        description={t("dashboard.monthly.money.withheldDescription")}
        kind="error"
        label={t("dashboard.error.chip")}
        name={t("dashboard.monthly.money.withheldAria")}
        title={t("dashboard.monthly.money.withheldTitle")}
      />
    );
  }

  const vndSuffix = t("dashboard.vndSuffix");
  const amount = (value: number) => formatCurrencyVnd(locale, value);
  return (
    <section aria-label={t("dashboard.monthly.money.aria")}>
      <SummaryCards label={t("dashboard.monthly.money.cardsAria")}>
        <SummaryCard
          accent="lavender"
          label={t("dashboard.monthly.kpi.paymentTotal")}
          note={t("dashboard.monthly.kpi.discountNote", { amount: `${amount(financials.discountTotal)} ${vndSuffix}` })}
          unit={vndSuffix}
          value={amount(financials.paymentTotal)}
        />
        <SummaryCard
          accent="lavender"
          label={t("dashboard.monthly.kpi.netProfit")}
          note={t("dashboard.monthly.kpi.netProfitNote")}
          unit={vndSuffix}
          value={amount(financials.netProfit)}
        />
        <SummaryCard
          accent="peach"
          label={t("dashboard.monthly.kpi.dailyCostTotal")}
          note={t("dashboard.monthly.kpi.dailyCostNote")}
          unit={vndSuffix}
          value={amount(financials.dailyCostTotal)}
        />
        <SummaryCard
          accent="peach"
          label={t("dashboard.monthly.kpi.monthlyCostTotal")}
          note={t("dashboard.monthly.kpi.monthlyCostNote")}
          unit={vndSuffix}
          value={amount(financials.monthlyCostTotal)}
        />
      </SummaryCards>
    </section>
  );
}

/** 직군별 지급 합계. 확정 스냅샷이 없는 마감 월은 현재 지급 계산값으로 대체하지 않는다. */
function SettlementSummaryCard({ summary, locale }: { summary: MonthlyDashboardMetricsDto["settlementSummary"]; locale: Locale }) {
  const t = createTranslator(locale);
  if (!summary) {
    return (
      <DashboardCard label={t("dashboard.monthly.settlement.emptyAria")} title={t("dashboard.monthly.settlement.emptyTitle")}>
        <p className="mt-2 text-sm text-muted">{t("dashboard.monthly.settlement.emptyDescription")}</p>
      </DashboardCard>
    );
  }
  const vnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`;
  return (
    <DashboardCard label={t("dashboard.monthly.settlement.aria")} title={t("dashboard.monthly.settlement.title")}>
      <AmountRows
        rows={[
          { label: t("dashboard.monthly.settlement.therapistPayout"), value: vnd(summary.therapistPayoutAmount) },
          { label: t("dashboard.monthly.settlement.opsDailyIncentive"), value: vnd(summary.opsDailyIncentiveAmount) },
          { label: t("dashboard.monthly.settlement.opsMonthlyIncentive"), value: vnd(summary.opsMonthlyIncentiveAmount) }
        ]}
      />
      <dl className="mt-1 border-t border-border pt-2 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="font-semibold text-foreground">{t("dashboard.monthly.settlement.grandPayout")}</dt>
          <dd className="text-right font-semibold text-foreground">{vnd(summary.grandPayoutAmount)}</dd>
        </div>
      </dl>
      <p className="mt-1 text-xs text-faint">
        {t("dashboard.monthly.settlement.grandPayoutNote", {
          included: formatNumber(locale, summary.includedCallCount),
          excluded: formatNumber(locale, summary.excludedCallCount)
        })}
      </p>
    </DashboardCard>
  );
}

/** 요약 카드 밖의 나머지 금액. 전체 지급 합계는 지급 정산 카드에만 둔다. */
function AmountBreakdownCard({ financials, locale }: { financials: NonNullable<MonthlyDashboardMetricsDto["financials"]>; locale: Locale }) {
  const t = createTranslator(locale);
  const vnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`;
  return (
    <DashboardCard title={t("dashboard.monthly.amountBreakdown.title")}>
      <AmountRows
        rows={[
          { label: t("dashboard.monthly.kpi.expenseTotal"), value: vnd(financials.expenseTotal) },
          { label: t("dashboard.monthly.kpi.opsMonthlyIncentiveTotal"), value: vnd(financials.opsMonthlyIncentiveTotal) },
          { label: t("dashboard.monthly.kpi.fullAttendanceAllowanceTotal"), value: vnd(financials.fullAttendanceAllowanceTotal) },
          { label: t("dashboard.monthly.kpi.countKingBonusTotal"), value: vnd(financials.countKingBonusTotal) }
        ]}
      />
    </DashboardCard>
  );
}

/**
 * 보고 › 월간. 운영월 합계와 그 기준(확정 스냅샷·미확정 현재 계산)을 먼저, 그 아래 정산 요약과 상태 건수.
 * 값은 모두 대시보드 서비스(getMonthlyDashboardMetrics)가 준 그대로이고 스냅샷을 직접 읽지 않는다.
 */
export function MonthlyDashboardView({
  metrics,
  ledgerHref,
  locale
}: {
  metrics: MonthlyDashboardMetricsDto;
  /** 콜 원장 주소. 들어갈 수 없는 역할이면 null(링크 없음). */
  ledgerHref: string | null;
  locale: Locale;
}) {
  const t = createTranslator(locale);
  // 마감확정·잠금 월인데 확정 스냅샷이 없으면 금액이 와도 현재 재계산값으로 대체하지 않는다.
  const financials = metrics.sourceBasis.kind === "snapshot_missing" ? null : metrics.financials;
  return (
    <div className="grid gap-6">
      <BasisLine basis={metrics.sourceBasis} locale={locale} />
      {metrics.emptyState.kind === "warnings_excluded" ? (
        <ExcludedCallsWarning
          detail={t("dashboard.monthly.warning.excludedDetail", {
            policy: formatNumber(locale, metrics.warningCounts.callLedger.coursePolicyMissing),
            rate: formatNumber(locale, metrics.warningCounts.callLedger.therapistRateMissing),
            second: formatNumber(locale, metrics.warningCounts.callLedger.secondTherapistRequired)
          })}
          locale={locale}
          summary={t("dashboard.monthly.warning.excludedSummary")}
          title={t("dashboard.monthly.warning.excludedTitle")}
        />
      ) : null}
      {metrics.emptyState.kind === "no_calls" ? (
        <NoCallsState
          description={t("dashboard.monthly.empty.noCallsDescription")}
          ledgerHref={ledgerHref}
          locale={locale}
          title={t("dashboard.monthly.empty.noCallsTitle")}
        />
      ) : null}
      {metrics.snapshot?.kind === "previous" ? <PreviousSnapshotCard locale={locale} snapshot={metrics.snapshot} /> : null}
      <MoneyCards financials={financials} locale={locale} />
      <DashboardStatusCounts counts={metrics.statusCounts} label={t("dashboard.monthly.statusCounts.aria")} locale={locale} />
      <div className="grid grid-cols-1 gap-4 min-[840px]:grid-cols-2 min-[1200px]:grid-cols-3">
        <SettlementSummaryCard locale={locale} summary={metrics.settlementSummary} />
        {financials ? <AmountBreakdownCard financials={financials} locale={locale} /> : null}
        <CourseCompletionCard
          basis={t("dashboard.monthly.course.basis")}
          courses={metrics.courseCompletions}
          label={t("dashboard.monthly.course.aria")}
          locale={locale}
          rowLabel={(code) => t("dashboard.monthly.course.completedAria", { code })}
          title={t("dashboard.monthly.course.title")}
        />
      </div>
    </div>
  );
}
