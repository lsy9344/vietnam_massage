import { requireRouteAccess } from "@/lib/authorization";
import { ensureDefaultRooms, listRooms } from "@/modules/masters/room-service";
import { RoomManager } from "@/app/(erp)/masters/rooms/room-forms";

export default async function RoomsPage() {
  const account = await requireRouteAccess("/masters/rooms");
  await ensureDefaultRooms({ actorId: account.id });
  const rooms = await listRooms();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">마스터 설정</p>
          <h1 className="text-2xl font-semibold text-foreground">객실 마스터</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            콜 원장, 객실 현황, TV 현황판이 공유할 객실 표시명과 정렬 기준을 관리한다.
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>기본 객실: 11개</div>
          <div>이관 참조값은 검증용으로만 보존</div>
        </div>
      </div>

      <RoomManager rooms={rooms} />
    </main>
  );
}
