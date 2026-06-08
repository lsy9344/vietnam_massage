import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function CallsPage() {
  await requireRouteAccess("/calls");

  return (
    <ErpEmptyState
      description="예약, 방문, 결제 흐름을 입력할 콜 원장 데이터 연결을 기다리고 있다."
      eyebrow="콜 원장"
      title="콜/예약 입력 원장"
    />
  );
}
