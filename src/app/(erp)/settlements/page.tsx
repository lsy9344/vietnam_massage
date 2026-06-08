import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function SettlementsPage() {
  await requireRouteAccess("/settlements");

  return (
    <ErpEmptyState
      description="방문완료 기준 결제, 수당, 콜 인정 계산 화면은 후속 story에서 연결한다."
      eyebrow="정산"
      title="정산 화면"
    />
  );
}
