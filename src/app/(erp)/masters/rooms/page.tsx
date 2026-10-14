import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultRooms, listRooms } from "@/modules/masters/room-service";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";
import { ActiveCounts } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, countActive, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireRouteAccess("/masters/rooms");
  const { locale, t } = await getServerTranslator();
  await ensureDefaultRooms({ actorId: account.id });
  const rooms = await listRooms();
  const params = await searchParams;
  const counts = countActive(rooms);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/rooms" title={t("masters.rooms.title")} />
      <div className="mb-6 grid gap-2">
        <ActiveCounts active={counts.active} inactive={counts.inactive} locale={locale} unit={(count) => t("masters.common.count", { count })} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("masters.rooms.meta.defaultRooms")}</span>
          <span>{t("masters.rooms.meta.migrationReference")}</span>
        </div>
      </div>

      <RoomManager initialItem={readMasterItem(params[MASTER_ITEM_PARAM])} rooms={rooms} />
    </div>
  );
}
