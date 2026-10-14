import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

// 실시간 화면 골격: 도구줄 → 요약 카드 네 장 → 층별 객실 카드.
export default async function LiveLoading() {
  const { t } = await getServerTranslator();
  return (
    <div className="screen">
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-72 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-24 rounded-full" />
        </div>
      </div>

      <section
        className="mb-6 grid grid-cols-1 gap-4 min-[600px]:grid-cols-2 min-[1200px]:grid-cols-4"
        aria-label={t("live.loading.summaryAria")}
      >
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton className="h-24 rounded-lg" key={index} />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("live.loading.roomsAria")}>
        {Array.from({ length: 11 }, (_, index) => (
          <div className="flex min-h-40 flex-col gap-3 rounded-lg border border-border bg-surface p-4" key={index}>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-20 rounded-full" />
            </div>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="mt-auto flex gap-1.5">
              <Skeleton className="h-7 w-20 rounded-full" />
              <Skeleton className="h-7 w-24 rounded-full" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
