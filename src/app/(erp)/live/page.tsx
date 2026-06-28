import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { formatCurrencyVnd, formatNumber } from "@/lib/i18n/format";
import { codeLabel, operatingMonthStatusLabel } from "@/lib/i18n/codes";
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
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.operations")}
          title={t("nav.item.live")}
          description={t("live.description")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("live.empty.description")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  const [roomStatuses, summary] = await Promise.all([
    listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate })
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

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.operations")}
        title={t("nav.item.live")}
        description={t("live.description")}
        meta={
          <>
            <RoomStatusRefreshController lastUpdatedAt={lastUpdatedAt} locale={locale} />
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
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
        <div className="ml-auto text-right text-xs text-muted">
          <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}</div>
          <div>
            {t("common.dateRange")}: {selectedMonth.startDate} ~ {selectedMonth.endDate}
          </div>
        </div>
      </form>

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
    </main>
  );
}
