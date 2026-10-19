import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefresh, RoomStatusRefreshController, RoomStatusStaleNotice } from "@/components/domain/room-status-refresh-controller";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { OpenTvLink } from "@/components/shell/open-tv-link";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { LiveSummaryCards, LiveSummaryDetails } from "@/app/(erp)/live/live-summary";
import { canAccessRoute, requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { autoFinishOverdueCalls, getDailyCallLedgerSummary } from "@/modules/calls/service-call-service";
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
  // 자동 청소 중(1018 스펙 D14): 그 영업일을 읽기 전에 표시 종료를 지난 사용중 콜을 정리한다.
  await autoFinishOverdueCalls({ operatingMonthId: selectedMonth.id, serviceDate, actorId: account.id });
  const [roomStatuses, summary] = await Promise.all([
    listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate, includeMonthTill: false })
  ]);
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());

  const context = { operatingMonthId: selectedMonth.id, date: serviceDate };
  // 원장의 콜 상세 링크는 원장에 들어갈 수 있는 역할(관리자·카운터)에게만 준다.
  const ledgerOperatingMonthId = canAccessRoute(account.role, "/calls") ? selectedMonth.id : null;

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
                <RoomStatusCard key={status.roomId} ledgerOperatingMonthId={ledgerOperatingMonthId} locale={locale} status={status} />
              ))}
            </div>
          ))}
        </section>

        <LiveSummaryDetails locale={locale} summary={summary} />
      </div>
    </RoomStatusRefresh>
  );
}
