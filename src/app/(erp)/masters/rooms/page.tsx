import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultRooms, listRooms } from "@/modules/masters/room-service";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function RoomsPage() {
  const account = await requireRouteAccess("/masters/rooms");
  const { t } = await getServerTranslator();
  await ensureDefaultRooms({ actorId: account.id });
  const rooms = await listRooms();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.rooms.title")}
        description={t("masters.rooms.description")}
        meta={
          <>
            <div>{t("masters.rooms.meta.defaultRooms")}</div>
            <div>{t("masters.rooms.meta.migrationReference")}</div>
          </>
        }
      />

      <RoomManager rooms={rooms} />
    </main>
  );
}
