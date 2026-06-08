import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function EmployeeMasterPage() {
  await requireRouteAccess("/masters/employees");

  return (
    <ErpEmptyState
      description="직원 마스터 전체 CRUD는 Story 1.7 범위다. 현재는 관리자 route 권한만 확인한다."
      eyebrow="마스터 설정"
      title="직원 계정"
    />
  );
}
