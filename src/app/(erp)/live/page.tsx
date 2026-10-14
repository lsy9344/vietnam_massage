import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefresh, RoomStatusRefreshController, RoomStatusStaleNotice } from "@/components/domain/room-status-refresh-controller";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { OpenTvLink } from "@/components/shell/open-tv-link";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { LiveSummaryCards, LiveSummaryDetails } from "@/app/(erp)/live/live-summary";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { getDailyCallLedgerSummary } from "@/modules/calls/service-call-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";

type LivePageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function floorGridClass(count: number) {
  return count === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
}

export default async function LivePage({ searchParams }: { searchParams: Promise<LivePageSearchParams> }) {
  const account = await requireRouteAccess("/live");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

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

  const context = { operatingMonthId: selectedMonth.id, date: serviceDate };

  return (
    <RoomStatusRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
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
          status={<RoomStatusRefreshController />}
          title={t("nav.item.live")}
        />

        <RoomStatusStaleNotice />
        <LiveSummaryCards locale={locale} summary={summary} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("common.roomStatusAria")}>
          {roomFloorGroups(roomStatuses).map((group) => (
            <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
              {group.statuses.map((status) => (
                <RoomStatusCard key={status.roomId} status={status} locale={locale} />
              ))}
            </div>
          ))}
        </section>

        <LiveSummaryDetails locale={locale} summary={summary} />
      </div>
    </RoomStatusRefresh>
  );
}
