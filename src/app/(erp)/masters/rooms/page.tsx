import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultRooms, listRooms } from "@/modules/masters/room-service";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function RoomsPage() {
  const account = await requireRouteAccess("/masters/rooms");
  const { locale, t } = await getServerTranslator();
  await ensureDefaultRooms({ actorId: account.id });
  const rooms = await listRooms();

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/rooms" title={t("masters.rooms.title")} />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div>{t("masters.rooms.meta.defaultRooms")}</div>
        <div>{t("masters.rooms.meta.migrationReference")}</div>
      </div>

      <RoomManager rooms={rooms} />
    </div>
  );
}
