import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";

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
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.operations")}
          title={t("nav.item.rooms")}
          description={t("rooms.description.short")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("rooms.empty.description")}</p>
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
  const [roomStatuses] = await Promise.all([listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate })]);
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.operations")}
        title={t("nav.item.rooms")}
        description={t("rooms.description.full")}
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

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("common.roomStatusAria")}>
        {roomFloorGroups(roomStatuses).map((group) => (
          <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
            {group.statuses.map((status) => (
              <RoomStatusCard key={status.roomId} status={status} locale={locale} />
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
