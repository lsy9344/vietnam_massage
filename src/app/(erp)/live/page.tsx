import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function LivePage() {
  await requireRouteAccess("/live");

  return (
    <ErpEmptyState
      description="객실과 콜 원장의 최신 활성 상태가 연결되면 첫화면 실시간 현황이 표시된다."
      eyebrow="운영 현황"
      title="첫화면 실시간 현황"
    />
  );
}
