import { Skeleton } from "@/components/ui/skeleton";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function ClosingLoading() {
  const { t } = await getServerTranslator();
  return (
    <main aria-label={t("closing.loading.aria")} className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div>
          <Skeleton className="mb-2 h-3 w-16" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="hidden space-y-2 md:block">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-14" />
      </div>
      <section className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </section>
      <section className="space-y-4">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
        <Skeleton className="h-44" />
      </section>
    </main>
  );
}
