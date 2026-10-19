import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusCounts } from "@/components/domain/room-status-counts";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { OpenClockCodeLink } from "@/components/shell/open-clock-code-link";
import { OpenTvLink } from "@/components/shell/open-tv-link";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { RoomStatusRefresh, RoomStatusRefreshController, RoomStatusStaleNotice } from "@/components/domain/room-status-refresh-controller";
import { canAccessRoute, requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import { autoFinishOverdueCalls } from "@/modules/calls/service-call-service";

type RoomsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function floorGridClass(count: number) {
  return count === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
}

export default async function RoomsPage({ searchParams }: { searchParams: Promise<RoomsPageSearchParams> }) {
  const account = await requireRouteAccess("/rooms");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/rooms" title={t("nav.item.rooms")} />
        <NoOperatingMonthNotice description={t("rooms.empty.description")} locale={locale} role={account.role} />
      </div>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  // 자동 청소 중(1018 스펙 D14): 그 영업일을 읽기 전에 표시 종료를 지난 사용중 콜을 정리한다.
  await autoFinishOverdueCalls({ operatingMonthId: selectedMonth.id, serviceDate });
  const [roomStatuses] = await Promise.all([listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate, includeOverlaps: true })]);
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());

  const context = { operatingMonthId: selectedMonth.id, date: serviceDate };
  // 원장의 콜 상세 링크는 원장에 들어갈 수 있는 역할(관리자·카운터)에게만 준다.
  const ledgerOperatingMonthId = canAccessRoute(account.role, "/calls") ? selectedMonth.id : null;

  return (
    <RoomStatusRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
      <div className="screen">
        <ScreenToolbar
          account={account}
          action={
            <div className="flex items-center gap-2">
              <OpenTvLink context={context} locale={locale} role={account.role} />
              <OpenClockCodeLink locale={locale} role={account.role} />
            </div>
          }
          context={context}
          dateControls={
            <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/rooms" selectedMonth={selectedMonth} />
          }
          locale={locale}
          path="/rooms"
          status={<RoomStatusRefreshController />}
          title={t("nav.item.rooms")}
        />

        <RoomStatusStaleNotice />
        <RoomStatusCounts displayStatuses={roomStatuses.map((status) => status.displayStatus)} locale={locale} />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("common.roomStatusAria")}>
          {roomFloorGroups(roomStatuses).map((group) => (
            <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
              {group.statuses.map((status) => (
                <RoomStatusCard key={status.roomId} ledgerOperatingMonthId={ledgerOperatingMonthId} locale={locale} showOverlaps status={status} />
              ))}
            </div>
          ))}
        </section>
      </div>
    </RoomStatusRefresh>
  );
}
