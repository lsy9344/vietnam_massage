import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultRooms, listRooms } from "@/modules/masters/room-service";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";
import { PageHeader } from "@/components/domain/page-header";

export default async function RoomsPage() {
  const account = await requireRouteAccess("/masters/rooms");
  await ensureDefaultRooms({ actorId: account.id });
  const rooms = await listRooms();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="마스터 설정"
        title="객실 마스터"
        description="콜 원장, 객실 현황, TV 현황판이 공유할 객실 표시명과 정렬 기준을 관리한다."
        meta={
          <>
            <div>기본 객실: 11개</div>
            <div>이관 참조값은 검증용으로만 보존</div>
          </>
        }
      />

      <RoomManager rooms={rooms} />
    </main>
  );
}
