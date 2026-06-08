import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function ClosingPage() {
  await requireRouteAccess("/closing");

  return (
    <ErpEmptyState
      description="월마감 미리보기, 검토, 확정, 잠금 흐름은 후속 story에서 연결한다."
      eyebrow="월마감"
      title="월마감"
    />
  );
}
