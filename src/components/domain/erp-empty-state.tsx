import { StatusBadge, statusBadgeStates } from "@/components/domain/status-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

type ErpEmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function ErpEmptyState({ eyebrow, title, description }: ErpEmptyStateProps) {
  return (
    <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] gap-6 p-6">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted">{eyebrow}</p>
              <h3 className="mt-1 text-xl font-semibold">{title}</h3>
            </div>
            <span className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">Royal Gold</span>
          </div>
          <Separator className="my-5" />
          <p className="text-sm leading-6 text-muted">{description}</p>
          <div className="mt-5 rounded-md border border-dashed border-border bg-readonly p-4 text-sm text-muted">
            데이터 연결 대기
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <p className="text-sm font-medium text-muted">상태 토큰</p>
          <h3 className="mt-1 text-xl font-semibold">객실/콜 상태 표시 규칙</h3>
          <div className="mt-5 flex flex-wrap gap-3" aria-label="상태 배지 토큰">
            {statusBadgeStates.map((state) => (
              <StatusBadge key={state} state={state} />
            ))}
          </div>
        </div>
      </section>

      <aside className="rounded-md border border-border bg-surface p-5" aria-label="연결 대기 영역">
        <p className="text-sm font-medium text-muted">데이터 연결 상태</p>
        <h3 className="mt-1 text-lg font-semibold">후속 기능 연결 대기</h3>
        <p className="mt-3 text-sm leading-6 text-muted">실제 원장, 객실, 정산 데이터는 연결 대기 중이다.</p>
        <div className="mt-5 space-y-3" aria-label="로딩 상태 예시">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </aside>
    </div>
  );
}
