import { ErpEmptyState } from "@/components/domain/erp-empty-state";
import { requireRouteAccess } from "@/lib/authorization";

export default async function TvPage() {
  await requireRouteAccess("/tv");

  return (
    <ErpEmptyState
      description="TV 현황판은 후속 story에서 fullscreen chrome hidden route로 분리한다. 현재는 접근 권한만 검증한다."
      eyebrow="운영 현황"
      title="TV 현황판"
    />
  );
}
