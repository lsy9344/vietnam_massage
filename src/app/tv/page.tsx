import Link from "next/link";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { RoomStatusRefresh, RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";
import { BRAND_NAME, BrandMark } from "@/components/ui/brand-logo";
import { canAccessRoute, requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import { autoFinishOverdueCalls } from "@/modules/calls/service-call-service";

type TvPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function floorGridClass(count: number) {
  return count === 2 ? "grid grid-cols-1 gap-4 md:grid-cols-2" : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3";
}

export default async function TvPage({ searchParams }: { searchParams: Promise<TvPageSearchParams> }) {
  const account = await requireRouteAccess("/tv");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="fullscreen min-h-screen bg-background px-6 py-6 text-foreground lg:px-10">
        <section className="grid min-h-[calc(100vh-3rem)] place-items-center rounded-lg border border-border bg-surface p-8 text-center">
          <div>
            <p className="text-lg font-bold text-muted">{t("tv.eyebrow")}</p>
            <h1 className="mt-3 text-[40px] font-black leading-none">{t("nav.item.tv")}</h1>
            <p className="mt-5 text-[22px] font-bold text-muted">{t("tv.empty.description")}</p>
            {canAccessRoute(account.role, "/masters/operating-months") ? (
              <Link className="mt-6 inline-flex text-lg font-bold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
                {t("common.goToOperatingMonths")}
              </Link>
            ) : (
              <p className="mt-6 text-lg font-bold text-muted">{t("common.requestOperatingMonthFromAdmin")}</p>
            )}
          </div>
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  // 자동 청소 중(1018 스펙 D14): 그 영업일을 읽기 전에 표시 종료를 지난 사용중 콜을 정리한다.
  await autoFinishOverdueCalls({ operatingMonthId: selectedMonth.id, serviceDate });
  const roomStatuses = await listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate });
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());

  return (
    <RoomStatusRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
      <main className="fullscreen min-h-screen bg-background px-5 py-5 text-foreground lg:px-8 lg:py-6">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-5 border-b border-border pb-4">
          <div className="flex items-center gap-5">
            {/* 로고 심볼은 TV에서 머리말에만, 멈춘 채로 둔다(design.md 6.15). */}
            <BrandMark className="w-20 shrink-0" label={BRAND_NAME} />
            <div>
              <p className="text-lg font-bold text-muted">{t("tv.eyebrowFull")}</p>
              <h1 className="mt-1 text-[40px] font-black leading-none">{t("nav.item.tv")}</h1>
              <p className="mt-2 text-lg font-semibold text-muted">
                {selectedMonth.monthKey} · {serviceDate} · {operatingMonthStatusLabel(locale, selectedMonth.status)}
              </p>
            </div>
          </div>
          <RoomStatusRefreshController variant="tv" />
        </header>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label={t("common.roomStatusAria")}>
          {roomFloorGroups(roomStatuses).map((group) => (
            <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
              {group.statuses.map((status) => (
                <RoomStatusCard key={status.roomId} status={status} variant="tv" locale={locale} />
              ))}
            </div>
          ))}
        </section>
      </main>
    </RoomStatusRefresh>
  );
}
