import { Skeleton } from "@/components/ui/skeleton";

function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`border border-border bg-surface px-4 py-4 ${className}`}>
      <Skeleton className="h-5 w-36" />
      <Skeleton className="mt-4 h-40 w-full" />
      <Skeleton className="mt-4 h-4 w-3/4" />
    </div>
  );
}

export default function ReportsLoading() {
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7" aria-busy="true" aria-label="그래프 리포트 로딩 중">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="mb-3 h-3 w-20" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-3 h-4 w-96 max-w-full" />
        </div>
        <div className="grid justify-items-end gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Skeleton className="h-12 w-44" />
        <Skeleton className="h-12 w-36" />
        <Skeleton className="h-9 w-16" />
      </div>

      <div className="space-y-4">
        <section className="border border-border bg-surface px-4 py-4" aria-label="그래프 리포트 기준 로딩">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-3 h-6 w-44" />
        </section>
        <SkeletonBlock className="h-[360px]" />
        <section className="grid gap-4 lg:grid-cols-2" aria-label="코스와 지급 구성 그래프 로딩">
          <SkeletonBlock />
          <SkeletonBlock />
        </section>
        <section className="grid gap-4 lg:grid-cols-2" aria-label="마사지사 순위 그래프 로딩">
          <SkeletonBlock />
          <SkeletonBlock />
        </section>
        <section className="grid gap-4 lg:grid-cols-2" aria-label="객실 상태와 노쇼 취소 그래프 로딩">
          <SkeletonBlock />
          <SkeletonBlock />
        </section>
      </div>
    </main>
  );
}
