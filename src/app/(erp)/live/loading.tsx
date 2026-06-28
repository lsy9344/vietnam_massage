import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function LiveLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>

      <section className="grid grid-cols-4 gap-3" aria-label={t("live.loading.roomsAria")}>
        {Array.from({ length: 11 }, (_, index) => (
          <div className="min-h-56 border border-border bg-surface p-4" key={index}>
            <div className="flex items-start justify-between">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-8 w-20" />
            </div>
            <Skeleton className="mt-5 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <Skeleton className="mt-8 h-12 w-full" />
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-6 gap-3" aria-label={t("live.loading.summaryAria")}>
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton className="h-20" key={index} />
        ))}
      </section>
    </main>
  );
}
