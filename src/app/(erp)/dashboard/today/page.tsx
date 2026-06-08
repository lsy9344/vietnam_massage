import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function TodayDashboardPage() {
  await requireRouteAccess("/dashboard/today");

  return (
    <ErpEmptyState
      description="오늘 방문완료, 매출, 객실 상태 KPI는 원장 연결 후 표시한다."
      eyebrow="대시보드"
      title="오늘 대시보드"
    />
  );
}
