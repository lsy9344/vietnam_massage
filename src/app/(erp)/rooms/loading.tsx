import { Skeleton } from "@/components/ui/skeleton";

export default function RoomsLoading() {
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-8 w-56" />
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="객실 상태 로딩">
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
    </main>
  );
}
