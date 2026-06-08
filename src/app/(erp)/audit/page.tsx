import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function AuditPage() {
  await requireRouteAccess("/audit");

  return (
    <ErpEmptyState
      description="감사 로그 기반과 조회 화면은 Story 1.3에서 연결한다."
      eyebrow="감사 로그"
      title="감사 로그"
    />
  );
}
