import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

function SkeletonCard({ label, rows }: { label: string; rows: number }) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4" aria-label={label}>
      <Skeleton className="h-5 w-32" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton className="h-8 w-full" key={index} />
        ))}
      </div>
    </section>
  );
}

// 월간 화면 골격: 도구줄 → 조회 기준 한 줄 → 금액 요약 카드 네 장 → 상태별 건수 → 지급 정산·금액 내역·코스별 완료.
export default async function MonthlyDashboardLoading() {
  const { t } = await getServerTranslator();
  return (
    <section className="screen" aria-busy="true" aria-label={t("dashboard.monthly.loading.aria")}>
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
        <section className="flex flex-wrap items-center gap-3" aria-label={t("dashboard.monthly.loading.basisAria")}>
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </section>
        <section className="grid grid-cols-1 gap-4 min-[600px]:grid-cols-2 min-[1200px]:grid-cols-4" aria-label={t("dashboard.monthly.loading.moneyKpiAria")}>
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-28 rounded-lg" key={index} />
          ))}
        </section>
        <section className="flex flex-wrap gap-1.5" aria-label={t("dashboard.monthly.loading.statusCountsAria")}>
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton className="h-9 w-28 rounded-full" key={index} />
          ))}
        </section>
        <div className="grid grid-cols-1 gap-4 min-[840px]:grid-cols-2 min-[1200px]:grid-cols-3">
          <SkeletonCard label={t("dashboard.monthly.loading.settlementAria")} rows={5} />
          <SkeletonCard label={t("dashboard.monthly.loading.amountAria")} rows={5} />
          <SkeletonCard label={t("dashboard.monthly.loading.courseAria")} rows={5} />
        </div>
      </div>
    </section>
  );
}
