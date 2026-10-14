import { cellClassName, DashboardCard, headCellClassName, NoBasis, numberCellClassName, tableHeadClassName } from "@/app/(erp)/dashboard/dashboard-parts";
import { BarList, ChartLegend, ColumnChart } from "@/app/(erp)/dashboard/reports/report-charts";
import { StatusBadge } from "@/components/domain/status-badge";
import { ScreenState } from "@/components/ui/screen-state";
import { StatusIndicator } from "@/components/ui/status-indicator";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";
import type { Locale } from "@/lib/i18n/config";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import { cn } from "@/lib/utils";
import type { DashboardGraphReportDto } from "@/modules/dashboard/dashboard-query-service";

type ViewProps = { report: DashboardGraphReportDto; locale: Locale };
type Payout = DashboardGraphReportDto["opsIncentiveOrPayoutComposition"];

// 서비스의 한국어 라벨 대신 안정 key(status, segment.key)로 번역한다.
const PAYOUT_LABEL_KEY: Record<Payout["status"], MessageKey> = {
  available: "dashboard.reports.payout.label.closingComposition",
  no_ops_incentive_data: "dashboard.reports.payout.label.noOpsData",
  snapshot_missing: "dashboard.reports.payout.label.snapshotMissing"
};

const PAYOUT_SEGMENT_KEY: Record<Payout["segments"][number]["key"], MessageKey> = {
  therapist: "dashboard.reports.payout.segment.therapist",
  ops_daily: "dashboard.reports.payout.segment.opsDaily",
  ops_monthly: "dashboard.reports.payout.segment.opsMonthly",
  earcare: "dashboard.reports.payout.segment.earcare"
};

function formatters(locale: Locale) {
  const t = createTranslator(locale);
  return {
    t,
    vnd: (value: number) => `${formatCurrencyVnd(locale, value)} ${t("dashboard.vndSuffix")}`,
    count: (value: number) => t("dashboard.count", { count: formatNumber(locale, value) })
  };
}

/** 리포트 숫자의 기준. 확정 스냅샷이 없는 마감 월은 현재 지급 계산값으로 대체하지 않는다고 알린다. */
function BasisLine({ report, locale }: ViewProps) {
  const { t } = formatters(locale);
  if (report.sourceBasis.kind === "snapshot_missing") {
    return (
      <ScreenState
        description={t("dashboard.reports.snapshotMissing.description")}
        kind="error"
        label={t("dashboard.error.chip")}
        title={t("dashboard.reports.snapshotMissing.title")}
      />
    );
  }
  return (
    <section aria-label={t("dashboard.reports.basis.aria")} className="flex flex-wrap items-center gap-x-3 gap-y-2">
      {report.sourceBasis.kind === "closed_snapshot" ? (
        <StatusIndicator label={t("dashboard.reports.basis.closedSnapshot")} tone="info" />
      ) : (
        <StatusIndicator label={t("dashboard.reports.basis.currentTitle")} tone="neutral" />
      )}
      <p className="max-w-3xl text-sm text-muted">{t("dashboard.reports.basis.description")}</p>
    </section>
  );
}

/** 이 조회 기준에서 비어 있는 것들. 각 차트 자리에도 그리지 않은 이유가 있다. */
function EmptyStatePanel({ report, locale }: ViewProps) {
  const { t } = formatters(locale);
  const reasons: Array<[boolean, MessageKey]> = [
    [report.emptyStates.noCallsInPeriod, "dashboard.reports.emptyState.noCallsInPeriod"],
    [report.emptyStates.noRevenueTrendData, "dashboard.reports.emptyState.noRevenueTrendData"],
    [report.emptyStates.noCalculatedCompletedCalls, "dashboard.reports.emptyState.noCalculatedCompletedCalls"],
    [report.emptyStates.graphReportSnapshotMissing, "dashboard.reports.emptyState.graphReportSnapshotMissing"],
    [report.emptyStates.noRoomStatuses, "dashboard.reports.emptyState.noRoomStatuses"],
    [report.emptyStates.noSettlementSource, "dashboard.reports.emptyState.noSettlementSource"]
  ];
  const messages = reasons.filter(([isEmpty]) => isEmpty).map(([, key]) => t(key));
  if (messages.length === 0) return null;

  return (
    <ScreenState
      description={
        <ul className="grid gap-1.5">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      }
      kind="empty"
      label={t("dashboard.noData")}
      name={t("dashboard.reports.emptyState.aria")}
      title={t("dashboard.reports.emptyState.title")}
    />
  );
}

const dayOfMonth = (serviceDate: string) => String(Number(serviceDate.slice(8)));

/** 일별 매출: 결제합계는 라벤더 막대, 순매출은 같은 축의 검정 선. 같은 값의 표를 함께 둔다. */
function RevenueTrendCard({ report, locale }: ViewProps) {
  const { t, vnd, count } = formatters(locale);
  const rows = report.dailyRevenueTrend;
  if (report.emptyStates.noRevenueTrendData) {
    return (
      <DashboardCard aside={t("dashboard.reports.revenue.basis")} title={t("dashboard.reports.revenue.title")}>
        <NoBasis locale={locale} message={t("dashboard.reports.completedEmpty.description")} />
      </DashboardCard>
    );
  }
  return (
    <DashboardCard aside={t("dashboard.reports.revenue.basis")} title={t("dashboard.reports.revenue.title")}>
      <ColumnChart
        label={t("dashboard.reports.revenue.chartTitle")}
        line={rows.map((row) => row.netSales)}
        locale={locale}
        points={rows.map((row) => ({
          key: row.serviceDate,
          axisLabel: dayOfMonth(row.serviceDate),
          value: row.paymentTotal,
          tooltip: `${row.serviceDate} · ${vnd(row.paymentTotal)} · ${t("dashboard.reports.revenue.legendNetSales")} ${vnd(row.netSales)}`
        }))}
        tone="lavender"
      />
      <ChartLegend
        items={[
          { label: t("dashboard.reports.revenue.legendPayment"), mark: "lavender" },
          { label: t("dashboard.reports.revenue.legendNetSales"), mark: "line" }
        ]}
      />
      <div className="mt-4 max-h-80 overflow-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead className={cn(tableHeadClassName, "sticky top-0")}>
            <tr>
              <th className={headCellClassName} scope="col">
                {t("dashboard.reports.revenue.column.date")}
              </th>
              <th className={cn(headCellClassName, "text-right")} scope="col">
                {t("dashboard.reports.revenue.column.payment")}
              </th>
              <th className={cn(headCellClassName, "text-right")} scope="col">
                {t("dashboard.reports.revenue.column.netSales")}
              </th>
              <th className={cn(headCellClassName, "text-right")} scope="col">
                {t("dashboard.reports.revenue.column.completed")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serviceDate}>
                <td className={cellClassName}>{row.serviceDate}</td>
                <td className={numberCellClassName}>{vnd(row.paymentTotal)}</td>
                <td className={numberCellClassName}>{vnd(row.netSales)}</td>
                <td className={numberCellClassName}>{count(row.completedCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

function EmployeeLabel({ displayName, staffCode }: { displayName: string; staffCode: string }) {
  return (
    <>
      {displayName} <span className="text-xs font-normal text-muted">{staffCode}</span>
    </>
  );
}

/** 코스별 매출 비중(매출 계열 라벤더). 막대는 전체 매출에 대한 몫이다. */
function CourseMixCard({ report, locale }: ViewProps) {
  const { t, vnd } = formatters(locale);
  const percent = (value: number) => `${formatNumber(locale, value * 100, { maximumFractionDigits: 1 })}%`;
  return (
    <DashboardCard title={t("dashboard.reports.courseMix.title")}>
      {report.emptyStates.noCalculatedCompletedCalls ? (
        <NoBasis locale={locale} message={t("dashboard.reports.courseMix.empty")} />
      ) : (
        <BarList
          max={1}
          rows={report.courseMix.map((course) => ({
            key: course.courseCode,
            label: t("dashboard.reports.courseMix.courseLabel", { code: course.courseCode }),
            detail: t("dashboard.reports.courseMix.detail", {
              completed: formatNumber(locale, course.completedCount),
              amount: vnd(course.paymentTotal),
              callShare: percent(course.callShare),
              revenueShare: percent(course.revenueShare)
            }),
            value: course.revenueShare
          }))}
          tone="lavender"
        />
      )}
    </DashboardCard>
  );
}

/** 직군별 지급 금액(비용 계열 피치). 확정 스냅샷이 없는 마감 월은 그리지 않는다. */
function PayoutCompositionCard({ report, locale }: ViewProps) {
  const { t, vnd } = formatters(locale);
  const payout = report.opsIncentiveOrPayoutComposition;
  return (
    <DashboardCard aside={t(PAYOUT_LABEL_KEY[payout.status])} title={t("dashboard.reports.payout.title")}>
      {payout.segments.length > 0 ? (
        <BarList
          rows={payout.segments.map((segment) => ({
            key: segment.key,
            label: t(PAYOUT_SEGMENT_KEY[segment.key]),
            detail: vnd(segment.amount),
            value: segment.amount
          }))}
          tone="peach"
        />
      ) : (
        <p className="mt-3 text-sm text-muted">{t("dashboard.reports.payout.empty")}</p>
      )}
    </DashboardCard>
  );
}

/** 마사지사 순위: 담당 콜 수는 건수 계열 민트, 정산 금액은 지급 계열 피치. */
function RankingCards({ report, locale }: ViewProps) {
  const { t, vnd } = formatters(locale);
  return (
    <section aria-label={t("dashboard.reports.ranking.aria")} className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-2">
      <DashboardCard title={t("dashboard.reports.ranking.callTitle")}>
        {report.therapistCallRanking.length > 0 ? (
          <BarList
            rows={report.therapistCallRanking.map((row) => ({
              key: row.employeeId,
              label: <EmployeeLabel displayName={row.displayName} staffCode={row.staffCode} />,
              detail: t("dashboard.reports.ranking.callDetail", {
                assigned: formatNumber(locale, row.assignedCallCount),
                first: formatNumber(locale, row.therapist1Count),
                second: formatNumber(locale, row.therapist2Count)
              }),
              value: row.assignedCallCount
            }))}
            tone="mint"
          />
        ) : (
          <p className="mt-3 text-sm text-muted">{t("dashboard.reports.ranking.callEmpty")}</p>
        )}
      </DashboardCard>
      <DashboardCard title={t("dashboard.reports.ranking.settlementTitle")}>
        {report.therapistSettlementRanking.length > 0 ? (
          <BarList
            rows={report.therapistSettlementRanking.map((row) => ({
              key: row.employeeId,
              label: <EmployeeLabel displayName={row.displayName} staffCode={row.staffCode} />,
              detail: t("dashboard.reports.ranking.settlementDetail", {
                amount: vnd(row.finalPayoutAmount),
                count: formatNumber(locale, row.totalCallCount)
              }),
              value: row.finalPayoutAmount
            }))}
            tone="peach"
          />
        ) : (
          <p className="mt-3 text-sm text-muted">{t("dashboard.reports.ranking.settlementEmpty")}</p>
        )}
      </DashboardCard>
    </section>
  );
}

/** 선택 날짜의 객실 상태별 수. 상태는 객실 상태색 배지로, 수는 건수 계열 민트 막대로 그린다. */
function RoomStatusCard({ report, locale }: ViewProps) {
  const { t } = formatters(locale);
  return (
    <DashboardCard title={t("dashboard.reports.room.title")}>
      {report.emptyStates.noRoomStatuses ? (
        <p className="mt-3 text-sm text-muted">{t("dashboard.reports.room.empty")}</p>
      ) : (
        <BarList
          rows={report.roomStatusDistribution.map((row) => ({
            key: row.displayStatus,
            label: (
              <StatusBadge
                ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, row.displayStatus) })}
                label={roomStatusLabel(locale, row.displayStatus)}
                state={row.displayStatus}
              />
            ),
            detail: t("dashboard.reports.room.count", { count: formatNumber(locale, row.count) }),
            value: row.count
          }))}
          tone="mint"
        />
      )}
    </DashboardCard>
  );
}

/** 노쇼와 취소는 같은 건수 계열이라 한 차트에 두 파스텔로 겹치지 않고 작은 차트 두 개로 나눈다. */
function NoShowCancelCard({ report, locale }: ViewProps) {
  const { t, count } = formatters(locale);
  const rows = report.noShowCancelTrend;
  const series = [
    { key: "noShow", title: t("dashboard.reports.noShow.column.noShow"), label: t("dashboard.reports.noShow.chartNoShow"), value: (row: (typeof rows)[number]) => row.noShowCount },
    { key: "canceled", title: t("dashboard.reports.noShow.column.canceled"), label: t("dashboard.reports.noShow.chartCanceled"), value: (row: (typeof rows)[number]) => row.canceledCount }
  ];
  if (report.emptyStates.noCallsInPeriod) {
    return (
      <DashboardCard title={t("dashboard.reports.noShow.title")}>
        <NoBasis locale={locale} message={t("dashboard.reports.noShow.empty")} />
      </DashboardCard>
    );
  }
  return (
    <DashboardCard title={t("dashboard.reports.noShow.title")}>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 min-[840px]:grid-cols-2">
        {series.map((item) => (
          <div className="mt-3" key={item.key}>
            <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
            <ColumnChart
              label={item.label}
              locale={locale}
              points={rows.map((row) => ({
                key: row.serviceDate,
                axisLabel: dayOfMonth(row.serviceDate),
                value: item.value(row),
                tooltip: `${row.serviceDate} · ${item.title} ${count(item.value(row))}`
              }))}
              tone="mint"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 max-h-80 overflow-auto">
        <table className="w-full min-w-[320px] border-collapse text-sm">
          <thead className={cn(tableHeadClassName, "sticky top-0")}>
            <tr>
              <th className={headCellClassName} scope="col">
                {t("dashboard.reports.noShow.column.date")}
              </th>
              <th className={cn(headCellClassName, "text-right")} scope="col">
                {t("dashboard.reports.noShow.column.noShow")}
              </th>
              <th className={cn(headCellClassName, "text-right")} scope="col">
                {t("dashboard.reports.noShow.column.canceled")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.serviceDate}>
                <td className={cellClassName}>{row.serviceDate}</td>
                <td className={numberCellClassName}>{count(row.noShowCount)}</td>
                <td className={numberCellClassName}>{count(row.canceledCount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardCard>
  );
}

/**
 * 보고 › 리포트. 추세를 먼저, 그 아래 구성·순위·상태. 차트마다 같은 값의 표나 글자가 함께 있다.
 * 값은 모두 대시보드 서비스(getDashboardGraphReport)가 준 그대로이고, 화면은 막대 길이와 축 위치만 정한다.
 */
export function ReportsView({ report, locale }: ViewProps) {
  const t = createTranslator(locale);
  return (
    <div className="grid gap-6">
      <BasisLine locale={locale} report={report} />
      <EmptyStatePanel locale={locale} report={report} />
      <RevenueTrendCard locale={locale} report={report} />
      <section aria-label={t("dashboard.reports.courseAndPayout.aria")} className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-2">
        <CourseMixCard locale={locale} report={report} />
        <PayoutCompositionCard locale={locale} report={report} />
      </section>
      <RankingCards locale={locale} report={report} />
      <section aria-label={t("dashboard.reports.roomNoShow.aria")} className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <RoomStatusCard locale={locale} report={report} />
        <NoShowCancelCard locale={locale} report={report} />
      </section>
    </div>
  );
}
