"use client";

import { useRouter } from "next/navigation";

export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5">
        <p className="mb-2 text-xs font-semibold uppercase text-muted">대시보드</p>
        <h1 className="text-2xl font-semibold text-foreground">그래프 리포트</h1>
      </div>
      <section className="border border-danger bg-surface px-4 py-6" role="alert">
        <h2 className="text-base font-semibold text-foreground">그래프 리포트를 불러오지 못했습니다</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          현재 계산값과 확정 스냅샷 값을 섞어 표시하지 않도록 조회를 중단했습니다. 운영월과 조회날짜를 확인한 뒤 다시 시도하세요.
        </p>
        <p className="mt-3 text-sm font-medium text-danger">대시보드 조회 중 오류가 발생했습니다.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly"
            onClick={() => {
              reset();
            }}
            type="button"
          >
            다시 시도
          </button>
          <button
            className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly"
            onClick={() => {
              router.refresh();
            }}
            type="button"
          >
            현재 조건 새로고침
          </button>
        </div>
      </section>
    </main>
  );
}
