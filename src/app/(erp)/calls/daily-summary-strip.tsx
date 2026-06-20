import type { DailyCallLedgerSummaryDto } from "@/modules/calls/service-call-service";

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function Kpi({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="grid min-w-28 gap-1 border-r border-border px-3 py-2 last:border-r-0">
      <span className="text-xs font-medium text-muted">{label}</span>
      <span className={`text-sm font-semibold [font-variant-numeric:tabular-nums] ${danger ? "text-danger" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

export function DailySummaryStrip({ summary, showSettlementAmounts }: { summary: DailyCallLedgerSummaryDto; showSettlementAmounts: boolean }) {
  const showTherapistAssignmentCount = showSettlementAmounts;
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;

  return (
    <section className="mb-4 border border-border bg-surface" aria-label="일별 요약">
      <div className="flex flex-wrap border-b border-border">
        <Kpi label="예약건수" value={`${formatNumber(summary.reservationCount)}건`} />
        <Kpi label="사용중" value={`${formatNumber(summary.inUseCount)}건`} />
        <Kpi label="청소중" value={`${formatNumber(summary.cleaningCount)}건`} />
        <Kpi label="방문완료" value={`${formatNumber(summary.completedCount)}건`} />
        <Kpi label="노쇼" value={`${formatNumber(summary.noShowCount)}건`} />
        <Kpi label="취소" value={`${formatNumber(summary.canceledCount)}건`} />
        <Kpi label="결제합계" value={`${formatNumber(summary.paymentTotal)} VND`} />
        <Kpi label="할인합계" value={`${formatNumber(summary.discountTotal)} VND`} />
        <Kpi label="지출합계" value={`${formatNumber(summary.expenseTotal)} VND`} danger={summary.expenseTotal > 0} />
        <Kpi label="순매출" value={`${formatNumber(summary.netSales)} VND`} danger={summary.netSales < 0} />
        {showSettlementAmounts ? (
          <>
            <Kpi label="마사지사정산" value={`${formatNumber(summary.therapistCommissionTotal)} VND`} />
            <Kpi label="귀케어풀" value={`${formatNumber(summary.earcarePoolTotal)} VND`} />
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap border-b border-border bg-background/60">
        <Kpi label="현금" value={`${formatNumber(summary.paymentMethodTotals.cash)} VND`} />
        <Kpi label="카드" value={`${formatNumber(summary.paymentMethodTotals.card)} VND`} />
        <Kpi label="계좌" value={`${formatNumber(summary.paymentMethodTotals.bank)} VND`} />
        <Kpi label="기타" value={`${formatNumber(summary.paymentMethodTotals.other)} VND`} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-xs">
          <thead className="bg-readonly text-foreground">
            <tr>
              <th className="border-b border-border px-3 py-2">코스</th>
              <th className="border-b border-border px-3 py-2 text-right">방문완료</th>
              <th className="border-b border-border px-3 py-2 text-right">할인건수</th>
              {showTherapistAssignmentCount ? <th className="border-b border-border px-3 py-2 text-right">마사지사 담당 수</th> : null}
            </tr>
          </thead>
          <tbody>
            {summary.courseSummaries.map((course) => (
              <tr key={course.courseCode}>
                <td className="border-b border-border px-3 py-2 font-semibold text-foreground">{course.courseCode}</td>
                <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">{course.completedCount}</td>
                <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">{course.discountCount}</td>
                {showTherapistAssignmentCount ? (
                  <td className="border-b border-border px-3 py-2 text-right [font-variant-numeric:tabular-nums]">
                    {course.therapistAssignmentCount}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {warningTotal > 0 && showSettlementAmounts ? (
        <p className="px-3 py-2 text-xs text-danger">
          정책 누락 {summary.warningCounts.coursePolicyMissing}건, 수당 누락 {summary.warningCounts.therapistRateMissing}건, 마사지사2 필요{" "}
          {summary.warningCounts.secondTherapistRequired}건은 금액/코스별 집계에서 제외됐다.
        </p>
      ) : null}
      {warningTotal > 0 && !showSettlementAmounts ? (
        <p className="px-3 py-2 text-xs text-danger">정책 확인이 필요한 {warningTotal}건은 일부 집계에서 제외됐다.</p>
      ) : null}
    </section>
  );
}
