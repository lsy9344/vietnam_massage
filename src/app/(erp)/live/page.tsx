import { RoomStatusCard } from "@/components/domain/room-status-card";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { OpenTvLink } from "@/components/shell/open-tv-link";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import { codeLabel } from "@/lib/i18n/codes";
import { getDailyCallLedgerSummary } from "@/modules/calls/service-call-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import { RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";

type LivePageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function floorGridClass(count: number) {
  return count === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}

export default async function LivePage({ searchParams }: { searchParams: Promise<LivePageSearchParams> }) {
  const account = await requireRouteAccess("/live");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  const formatVnd = (value: number) => `${formatCurrencyVnd(locale, value)} ${t("live.vndSuffix")}`;
  const formatCount = (value: number) => `${formatNumber(locale, value)}${t("live.countSuffix")}`;

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/live" title={t("nav.item.live")} />
        <NoOperatingMonthNotice description={t("live.empty.description")} locale={locale} role={account.role} />
      </div>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  const [roomStatuses, summary] = await Promise.all([
    listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate, includeMonthTill: false })
  ]);
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;

  const statusSummary = [
    // REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음).
    [t("live.summary.reservationCount"), summary.reservationCount],
    [t("live.summary.inUse"), summary.inUseCount],
    [t("live.summary.cleaning"), summary.cleaningCount],
    [t("live.summary.completed"), summary.completedCount],
    [t("live.summary.noShow"), summary.noShowCount],
    [t("live.summary.canceled"), summary.canceledCount]
  ] as const;

  const context = { operatingMonthId: selectedMonth.id, date: serviceDate };

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        action={<OpenTvLink context={context} locale={locale} primary role={account.role} />}
        context={context}
        dateControls={
          <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/live" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/live"
        status={<RoomStatusRefreshController lastUpdatedAt={lastUpdatedAt} locale={locale} />}
        title={t("nav.item.live")}
      />

      <section className="grid grid-cols-4 gap-3" aria-label={t("common.roomStatusAria")}>
        {roomFloorGroups(roomStatuses).map((group) => (
          <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
            {group.statuses.map((status) => (
              <RoomStatusCard key={status.roomId} status={status} locale={locale} />
            ))}
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-6 gap-3" aria-label={t("live.summary.aria")}>
        {statusSummary.map(([label, count]) => (
          <SummaryTile key={label} label={label} value={formatCount(count)} />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label={t("live.payment.aria")}>
        {/* REQ-004: 카운터 직원이 돈통 현금 흐름을 한눈에 보도록 결제수단별 집계를 첫화면에도 노출한다. */}
        <SummaryTile label={codeLabel(locale, "PAYMENT_METHOD", "CASH", true)} value={formatVnd(summary.paymentMethodTotals.cash)} />
        <SummaryTile label={codeLabel(locale, "PAYMENT_METHOD", "CARD", true)} value={formatVnd(summary.paymentMethodTotals.card)} />
        <SummaryTile label={codeLabel(locale, "PAYMENT_METHOD", "BANK_TRANSFER", true)} value={formatVnd(summary.paymentMethodTotals.bank)} />
        <SummaryTile label={codeLabel(locale, "PAYMENT_METHOD", "OTHER", true)} value={formatVnd(summary.paymentMethodTotals.other)} />
      </section>

      <section className="mt-4 grid grid-cols-[1fr_1fr_2fr] gap-3" aria-label={t("live.kpi.aria")}>
        <SummaryTile label={t("live.kpi.paymentTotal")} value={formatVnd(summary.paymentTotal)} />
        <SummaryTile label={t("live.kpi.netSales")} value={formatVnd(summary.netSales)} />
        <div className="border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-muted">{t("live.kpi.courseCompleted")}</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {summary.courseSummaries.map((course) => (
              <div className="border border-border bg-background px-3 py-2 text-center" key={course.courseCode}>
                <p className="text-xs font-semibold text-muted">{course.courseCode}</p>
                <p className="text-lg font-semibold text-foreground [font-variant-numeric:tabular-nums]">{formatNumber(locale, course.completedCount)}</p>
              </div>
            ))}
          </div>
          {warningTotal > 0 ? (
            <p className="mt-3 text-xs text-danger">
              {t("live.warning.excluded", {
                policy: summary.warningCounts.coursePolicyMissing,
                rate: summary.warningCounts.therapistRateMissing,
                second: summary.warningCounts.secondTherapistRequired
              })}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
