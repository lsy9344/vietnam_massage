import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <Skeleton className="h-5 w-32" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-8 w-full" key={index} />
        ))}
      </div>
    </div>
  );
}

// 오늘 화면 골격: 도구줄 → 상태별 건수 한 줄 → 금액 요약 카드 세 장 → 비용 내역·코스별 완료·마사지사 정산.
export default async function TodayDashboardLoading() {
  const { t } = await getServerTranslator();
  return (
    <section className="screen" aria-busy="true" aria-label={t("dashboard.today.loading.aria")}>
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-72 rounded-full" />
        <div className="flex gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-11 w-20 rounded-full" key={index} />
          ))}
        </div>
      </div>

      <div className="grid gap-6">
        <section className="flex flex-wrap gap-x-4 gap-y-2" aria-label={t("dashboard.today.loading.statusCountsAria")}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-7 w-24 rounded-full" key={index} />
          ))}
        </section>
        <section className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2 min-[1200px]:grid-cols-3" aria-label={t("dashboard.today.loading.moneyKpiAria")}>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton className="h-28 rounded-lg" key={index} />
          ))}
        </section>
        <section
          className="grid grid-cols-1 gap-4 min-[840px]:grid-cols-2 min-[1200px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]"
          aria-label={t("dashboard.today.loading.detailSummaryAria")}
        >
          {Array.from({ length: 3 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </section>
      </div>
    </section>
  );
}
