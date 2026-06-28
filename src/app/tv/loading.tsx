import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function TvLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen bg-background px-5 py-5 text-foreground lg:px-8 lg:py-6">
      <header className="mb-5 flex items-end justify-between gap-5 border-b border-border pb-4">
        <div className="grid gap-3">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Skeleton className="h-12 w-80" />
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" aria-label={t("tv.loading.boardAria")}>
        {Array.from({ length: 11 }, (_, index) => (
          <div className="min-h-[270px] border border-border bg-surface p-6" key={index}>
            <div className="flex items-start justify-between gap-4">
              <div className="grid gap-3">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-6 w-40" />
              </div>
              <Skeleton className="h-12 w-28" />
            </div>
            <Skeleton className="mt-8 h-6 w-full" />
            <Skeleton className="mt-4 h-6 w-4/5" />
            <Skeleton className="mt-10 h-14 w-full" />
          </div>
        ))}
      </section>
    </main>
  );
}
