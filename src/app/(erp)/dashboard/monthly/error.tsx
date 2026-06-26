"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";

export default function MonthlyDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader eyebrow="대시보드" title="월간 KPI 대시보드" />
      <section className="border border-danger bg-surface px-4 py-6" role="alert">
        <h2 className="text-base font-semibold text-foreground">월간 KPI를 불러오지 못했습니다</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          현재 계산값과 확정 스냅샷 값을 섞어 표시하지 않도록 조회를 중단했습니다. 운영월 조건을 확인한 뒤 다시 시도하세요.
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
