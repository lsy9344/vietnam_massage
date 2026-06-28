import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

function SkeletonTile() {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-8 w-28" />
      <Skeleton className="mt-2 h-3 w-24" />
    </div>
  );
}

export default async function MonthlyDashboardLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7" aria-busy="true" aria-label={t("dashboard.monthly.loading.aria")}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="grid justify-items-end gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Skeleton className="h-12 w-44" />
        <Skeleton className="h-9 w-16" />
      </div>

      <div className="space-y-4">
        <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.loading.basisAria")}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-6 w-44" />
        </section>
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={t("dashboard.monthly.loading.statusCountsAria")}>
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonTile key={index} />
          ))}
        </section>
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label={t("dashboard.monthly.loading.moneyKpiAria")}>
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonTile key={index} />
          ))}
        </section>
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label={t("dashboard.monthly.loading.settlementAria")}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonTile key={index} />
          ))}
        </section>
        <section className="border border-border bg-surface px-4 py-4" aria-label={t("dashboard.monthly.loading.courseAria")}>
          <Skeleton className="h-5 w-36" />
          <div className="mt-4 grid grid-cols-5 gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton className="h-24" key={index} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
