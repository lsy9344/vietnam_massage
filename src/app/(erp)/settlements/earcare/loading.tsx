import { PageHeader } from "@/components/domain/page-header";

export default function EarcareAttendanceLoading() {
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader eyebrow="정산" title="귀케어 일일정산" />
      <section className="border border-border bg-surface px-4 py-8" role="status">
        <h2 className="text-base font-semibold text-foreground">귀케어 일일정산을 불러오는 중입니다</h2>
        <p className="mt-2 text-sm text-muted">운영월과 조회날짜가 바뀌는 동안 이전 날짜 값을 확정값처럼 표시하지 않습니다.</p>
      </section>
    </main>
  );
}
