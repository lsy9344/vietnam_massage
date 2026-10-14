import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-4 h-48 w-full" />
      <Skeleton className="mt-4 h-4 w-3/4" />
    </div>
  );
}

// 리포트 골격: 도구줄 → 조회 기준 한 줄 → 일별 매출 → 코스 비중·지급 구성 → 순위 → 객실 상태·노쇼/취소.
export default async function ReportsLoading() {
  const { t } = await getServerTranslator();
  return (
    <section className="screen" aria-busy="true" aria-label={t("dashboard.reports.loading.aria")}>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-11 w-72 rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-11 w-20 rounded-full" key={index} />
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        <section className="flex flex-wrap items-center gap-3" aria-label={t("dashboard.reports.loading.basisAria")}>
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </section>
        <SkeletonCard />
        <section className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-2" aria-label={t("dashboard.reports.loading.courseAndPayoutAria")}>
          <SkeletonCard />
          <SkeletonCard />
        </section>
        <section className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-2" aria-label={t("dashboard.reports.loading.rankingAria")}>
          <SkeletonCard />
          <SkeletonCard />
        </section>
        <section className="grid grid-cols-1 gap-4 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" aria-label={t("dashboard.reports.loading.roomNoShowAria")}>
          <SkeletonCard />
          <SkeletonCard />
        </section>
      </div>
    </section>
  );
}
