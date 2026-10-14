import { Skeleton } from "@/components/ui/skeleton";

// 원장 탭 골격: 도구줄(제목·날짜·탭) → 상태별 건수 한 줄 → 원장 표.
export default function CallsLoading() {
  return (
    <div className="screen">
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-3 pb-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-72 rounded-full" />
        <div className="flex gap-2">
          <Skeleton className="h-11 w-20 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton className="h-7 w-24 rounded-full" key={index} />
        ))}
      </div>
      <section className="rounded-md border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="grid gap-2 px-4 py-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-8 w-full" key={index} />
          ))}
        </div>
      </section>
    </div>
  );
}
