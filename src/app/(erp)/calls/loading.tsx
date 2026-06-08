import { Skeleton } from "@/components/ui/skeleton";

export default function CallsLoading() {
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex items-end justify-between gap-6">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-[420px] max-w-full" />
        </div>
        <div className="hidden gap-2 text-right lg:grid">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-44" />
        </div>
      </div>
      <div className="mb-4 flex gap-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-16" />
      </div>
      <section className="border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid gap-2 px-4 py-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-8 w-full" key={index} />
          ))}
        </div>
      </section>
    </main>
  );
}
