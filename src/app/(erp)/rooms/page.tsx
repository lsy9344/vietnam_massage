import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function RoomsPage() {
  await requireRouteAccess("/rooms");

  return (
    <ErpEmptyState
      description="객실별 사용중, 청소중, 예약, 종료확인, 빈방 상태를 읽기 전용으로 연결할 예정이다."
      eyebrow="운영 현황"
      title="객실 현황"
    />
  );
}
