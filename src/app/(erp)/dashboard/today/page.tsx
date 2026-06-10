import Link from "next/link";
import { redirect } from "next/navigation";
import { StatusBadge } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getTodayDashboardMetrics, type TodayDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type TodayDashboardSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)} VND`;
}

function KpiTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function StatusCountTile({ label, value }: { label: "예약" | "방문완료" | "노쇼" | "취소"; value: number }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {label === "예약" ? <StatusBadge state="예약" /> : <p className="text-sm font-semibold text-foreground">{label}</p>}
        <p className="text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{formatNumber(value)}건</p>
      </div>
    </div>
  );
}

function EmptyOrWarningState({ metrics }: { metrics: TodayDashboardMetricsDto }) {
  if (metrics.emptyState.kind === "none") return null;

  if (metrics.emptyState.kind === "no_calls") {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label="데이터 없음">
        <h2 className="text-base font-semibold text-foreground">이 날짜의 콜이 없습니다</h2>
        <p className="mt-2 text-sm text-muted">조회 날짜를 바꾸거나 콜 원장에서 해당 날짜 데이터를 확인하세요.</p>
        <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/calls">
          콜 원장으로 이동
        </Link>
      </section>
    );
  }

  return (
    <section className="border border-danger bg-surface px-4 py-5" role="alert">
      <h2 className="text-base font-semibold text-foreground">집계 제외 항목이 있습니다</h2>
      <p className="mt-2 text-sm text-muted">{metrics.emptyState.message}</p>
      <p className="mt-3 text-sm font-medium text-danger">
        정책 누락 {metrics.warningCounts.coursePolicyMissing}건, 수당 누락 {metrics.warningCounts.therapistRateMissing}건, D코스 마사지사2 필요{" "}
        {metrics.warningCounts.secondTherapistRequired}건
      </p>
    </section>
  );
}

export default async function TodayDashboardPage({ searchParams }: { searchParams: Promise<TodayDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/today");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <div className="mb-5">
          <p className="mb-2 text-xs font-semibold uppercase text-muted">대시보드</p>
          <h1 className="text-2xl font-semibold text-foreground">오늘 KPI 대시보드</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">운영월과 조회날짜 기준으로 오늘 예약, 방문완료, 매출, 정산 흐름을 조회한다.</p>
        </div>
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            오늘 KPI는 운영월 날짜 범위 안의 콜 원장과 정산 데이터를 기준으로 조회한다.
          </p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
            </Link>
          ) : (
            <p className="mt-4 text-sm text-muted">관리자에게 운영월 생성을 요청하세요.</p>
          )}
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  if (params.operatingMonthId !== selectedMonth.id || params.serviceDate !== serviceDate) {
    const canonicalParams = new URLSearchParams({
      operatingMonthId: selectedMonth.id,
      serviceDate
    });
    redirect(`/dashboard/today?${canonicalParams.toString()}`);
  }

  const metrics = await getTodayDashboardMetrics({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });
  const statusCounts = [
    ["예약", metrics.statusCounts.reservation],
    ["방문완료", metrics.statusCounts.completed],
    ["노쇼", metrics.statusCounts.noShow],
    ["취소", metrics.statusCounts.canceled]
  ] as const;

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-muted">대시보드</p>
          <h1 className="text-2xl font-semibold text-foreground">오늘 KPI 대시보드</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">선택 날짜 기준의 콜 상태, 매출, 지출, 정산 흐름을 조회한다.</p>
        </div>
        <div className="text-right text-xs text-muted">
          <div>운영월 상태: {metrics.operatingMonth.status}</div>
          <div>
            날짜 범위: {metrics.operatingMonth.startDate} ~ {metrics.operatingMonth.endDate}
          </div>
        </div>
      </div>

      <form className="mb-5 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          운영월
          <select
            aria-label="운영월"
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {month.monthKey} ({month.status})
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          조회날짜
          <input
            aria-label="조회날짜"
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={serviceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="serviceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          조회
        </button>
      </form>

      <div className="space-y-4">
        <EmptyOrWarningState metrics={metrics} />

        <section className="grid gap-3 md:grid-cols-4" aria-label="오늘 상태 건수">
          {statusCounts.map(([label, count]) => (
            <StatusCountTile key={label} label={label} value={count} />
          ))}
        </section>

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="오늘 금액 KPI">
          <KpiTile label="결제합계" value={formatVnd(metrics.financials.paymentTotal)} />
          <KpiTile label="순매출" value={formatVnd(metrics.financials.netSales)} note="결제합계 - 지출합계" />
          <KpiTile label="할인합계" value={formatVnd(metrics.financials.discountTotal)} />
          <KpiTile label="지출합계" value={formatVnd(metrics.financials.expenseTotal)} />
          <KpiTile label="귀케어 풀" value={formatVnd(metrics.financials.earcarePoolTotal)} />
          <KpiTile label="마사지사 정산" value={formatVnd(metrics.financials.therapistCommissionTotal)} />
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1.4fr]" aria-label="상세 요약">
          <div className="border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">코스별 방문완료</h2>
              <p className="text-xs text-muted">계산 가능 완료 콜 기준</p>
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {metrics.courseCompletions.map((course) => (
                <div
                  aria-label={`${course.courseCode} 코스 방문완료`}
                  className="border border-border bg-background px-3 py-3 text-center"
                  key={course.courseCode}
                >
                  <p className="text-xs font-semibold text-muted">{course.courseCode}</p>
                  <p className="mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">
                    {formatNumber(course.completedCount)}
                  </p>
                  <p className="mt-1 text-xs text-muted">담당 {formatNumber(course.therapistAssignmentCount)}건</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-border bg-surface px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">마사지사 담당콜/정산</h2>
              <p className="text-xs text-muted">
                총 {formatNumber(metrics.therapistSummary.totalAssignedCallCount)}건 ·{" "}
                {formatVnd(metrics.therapistSummary.totalCommissionAmount)}
              </p>
            </div>
            {metrics.therapistSummary.therapists.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                      <th className="py-2 pr-3">마사지사</th>
                      <th className="py-2 pr-3 text-right">담당콜</th>
                      <th className="py-2 pr-3 text-right">정산 합계</th>
                      <th className="py-2 text-right">주의</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.therapistSummary.therapists.map((therapist) => (
                      <tr className="border-b border-border last:border-0" key={therapist.employeeId}>
                        <td className="py-2 pr-3">
                          <span className="font-medium text-foreground">{therapist.displayName}</span>
                          <span className="ml-2 text-xs text-muted">{therapist.staffCode}</span>
                        </td>
                        <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">
                          {formatNumber(therapist.totalAssignedCallCount)}건
                        </td>
                        <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">
                          {formatVnd(therapist.totalCommissionAmount)}
                        </td>
                        <td className="py-2 text-right text-xs text-muted">
                          0원 정책 {formatNumber(therapist.warningCounts.zeroPolicy)} · 수당 누락{" "}
                          {formatNumber(therapist.warningCounts.missingPolicy)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted">표시할 마사지사 정산 항목이 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
