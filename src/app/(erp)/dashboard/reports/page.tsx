import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getDashboardGraphReport, type DashboardGraphReportDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type ReportsSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)} VND`;
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value * 100)}%`;
}

function maxOf(values: number[]) {
  return Math.max(1, ...values);
}

function scaledY(value: number, minValue: number, maxValue: number) {
  const range = Math.max(1, maxValue - minValue);
  return 100 - ((value - minValue) / range) * 90;
}

function SourceBasisPanel({ report }: { report: DashboardGraphReportDto }) {
  if (report.sourceBasis.kind === "snapshot_missing") {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert">
        <h2 className="text-base font-semibold text-foreground">확정 스냅샷을 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm text-muted">
          마감확정 또는 잠금 상태의 운영월은 현재 지급 계산값으로 대체하지 않습니다. 그래프의 정산 순위와 지급 구성은 비워 둡니다.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label="그래프 리포트 기준">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">조회 기준</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">{report.sourceBasis.label}</h2>
        </div>
        <p className="max-w-2xl text-sm text-muted">
          매출/코스/노쇼 추이는 완료 계산 콜 기준이고, 객실 상태는 선택 날짜의 객실 상태 DTO 기준입니다.
        </p>
      </div>
    </section>
  );
}

function EmptyStatePanel({ report }: { report: DashboardGraphReportDto }) {
  const messages = [
    report.emptyStates.noCallsInPeriod ? "운영월 기간 전체에 콜 원장 데이터가 없습니다." : null,
    report.emptyStates.noCalculatedCompletedCalls
      ? "calculated 방문완료 콜이 없어 매출/코스 비중 그래프를 성공처럼 표시하지 않습니다. 이 기간의 데이터가 없습니다."
      : null,
    report.emptyStates.noRoomStatuses ? "선택 날짜의 객실 상태 데이터가 없습니다." : null,
    report.emptyStates.noSettlementSource ? "정산 source가 없어 정산 순위와 지급 구성을 표시하지 않습니다." : null
  ].filter((message): message is string => Boolean(message));

  if (messages.length === 0) return null;

  return (
    <section className="border border-border bg-surface px-4 py-5" aria-label="데이터 없음 상태">
      <h2 className="text-base font-semibold text-foreground">데이터 없음 상태</h2>
      <ul className="mt-3 grid gap-2 text-sm text-muted">
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

function CompletedChartEmptyPanel() {
  return (
    <section className="border border-border bg-surface px-4 py-5" aria-label="완료 콜 그래프 없음">
      <h2 className="text-base font-semibold text-foreground">방문완료 그래프를 표시하지 않습니다</h2>
      <p className="mt-2 text-sm text-muted">
        calculated 방문완료 콜이 없는 조회 기준입니다. 누락된 완료 데이터를 0값 매출 또는 0값 코스 비중 그래프로 꾸미지 않습니다.
      </p>
    </section>
  );
}

function RevenueTrendChart({ report }: { report: DashboardGraphReportDto }) {
  const revenueValues = report.dailyRevenueTrend.flatMap((row) => [row.paymentTotal, row.netSales]);
  const minRevenue = Math.min(0, ...revenueValues);
  const maxRevenue = Math.max(1, ...revenueValues);
  const pointStep = report.dailyRevenueTrend.length > 1 ? 100 / (report.dailyRevenueTrend.length - 1) : 100;
  const paymentPoints = report.dailyRevenueTrend
    .map((row, index) => `${index * pointStep},${scaledY(row.paymentTotal, minRevenue, maxRevenue)}`)
    .join(" ");
  const netSalesPoints = report.dailyRevenueTrend
    .map((row, index) => `${index * pointStep},${scaledY(row.netSales, minRevenue, maxRevenue)}`)
    .join(" ");

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="daily-revenue-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="daily-revenue-title" className="text-base font-semibold text-foreground">
          일별 매출 추이
        </h2>
        <p className="text-xs text-muted">방문완료 calculated 콜만 포함</p>
      </div>
      <svg className="mt-4 h-56 w-full overflow-visible" role="img" aria-labelledby="daily-revenue-chart-title" viewBox="0 0 100 110" preserveAspectRatio="none">
        <title id="daily-revenue-chart-title">일별 방문완료 매출과 순매출 추이</title>
        <polyline fill="none" points={paymentPoints} stroke="var(--color-brand)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        <polyline fill="none" points={netSalesPoints} stroke="var(--color-danger)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="font-medium text-brand">방문완료 매출</span>
        <span className="font-medium text-danger">순매출</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-semibold text-muted">
              <th className="py-2 pr-3">날짜</th>
              <th className="py-2 pr-3 text-right">방문완료 매출</th>
              <th className="py-2 pr-3 text-right">순매출</th>
              <th className="py-2 text-right">방문완료 콜</th>
            </tr>
          </thead>
          <tbody>
            {report.dailyRevenueTrend.map((row) => (
              <tr className="border-b border-border last:border-0" key={row.serviceDate}>
                <td className="py-2 pr-3">{row.serviceDate}</td>
                <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">{formatVnd(row.paymentTotal)}</td>
                <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">{formatVnd(row.netSales)}</td>
                <td className="py-2 text-right [font-variant-numeric:tabular-nums]">{formatNumber(row.completedCount)}건</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CourseMixChart({ report }: { report: DashboardGraphReportDto }) {
  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="course-mix-title">
      <h2 id="course-mix-title" className="text-base font-semibold text-foreground">
        코스별 콜/매출 비중
      </h2>
      <div className="mt-4 grid gap-3">
        {report.courseMix.map((course) => (
          <div key={course.courseCode}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-foreground">{course.courseCode} 코스</span>
              <span className="text-muted">
                {formatNumber(course.completedCount)}건 · {formatVnd(course.paymentTotal)} · 콜 {formatPercent(course.callShare)} · 매출{" "}
                {formatPercent(course.revenueShare)}
              </span>
            </div>
            <div className="mt-2 h-3 bg-background" aria-hidden="true">
              <div className="h-3 bg-brand" style={{ width: `${course.revenueShare * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RankingCharts({ report }: { report: DashboardGraphReportDto }) {
  const maxCallCount = maxOf(report.therapistCallRanking.map((row) => row.assignedCallCount));
  const maxPayout = maxOf(report.therapistSettlementRanking.map((row) => row.finalPayoutAmount));

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="마사지사 순위 그래프">
      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">마사지사 담당 콜 순위</h2>
        <div className="mt-4 grid gap-3">
          {report.therapistCallRanking.length > 0 ? (
            report.therapistCallRanking.map((row) => (
              <div key={row.employeeId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {row.displayName} <span className="text-xs text-muted">{row.staffCode}</span>
                  </span>
                  <span className="text-muted">
                    담당 {formatNumber(row.assignedCallCount)}건 · 1번 {formatNumber(row.therapist1Count)} · 2번 {formatNumber(row.therapist2Count)}
                  </span>
                </div>
                <div className="mt-2 h-3 bg-background" aria-hidden="true">
                  <div className="h-3 bg-brand" style={{ width: `${(row.assignedCallCount / maxCallCount) * 100}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">표시할 담당 콜 순위가 없습니다.</p>
          )}
        </div>
      </div>

      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">마사지사 정산 순위</h2>
        <div className="mt-4 grid gap-3">
          {report.therapistSettlementRanking.length > 0 ? (
            report.therapistSettlementRanking.map((row) => (
              <div key={row.employeeId}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-foreground">
                    {row.displayName} <span className="text-xs text-muted">{row.staffCode}</span>
                  </span>
                  <span className="text-muted">
                    {formatVnd(row.finalPayoutAmount)} · 담당 {formatNumber(row.totalCallCount)}건
                  </span>
                </div>
                <div className="mt-2 h-3 bg-background" aria-hidden="true">
                  <div className="h-3 bg-danger" style={{ width: `${(row.finalPayoutAmount / maxPayout) * 100}%` }} />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-muted">정산 source가 없어 순위를 표시하지 않습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function RoomAndNoShowCharts({ report }: { report: DashboardGraphReportDto }) {
  const maxRoomCount = maxOf(report.roomStatusDistribution.map((row) => row.count));
  const maxNoShowCancel = maxOf(report.noShowCancelTrend.flatMap((row) => [row.noShowCount, row.canceledCount]));

  return (
    <section className="grid gap-4 lg:grid-cols-2" aria-label="객실 상태와 노쇼 취소 그래프">
      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">객실 상태 분포</h2>
        <div className="mt-4 grid gap-3">
          {report.roomStatusDistribution.map((row) => (
            <div key={row.displayStatus}>
              <div className="flex items-center justify-between gap-3">
                <StatusBadge state={row.displayStatus} />
                <span className="text-sm text-muted">{formatNumber(row.count)}개</span>
              </div>
              <div className="mt-2 h-3 bg-background" aria-hidden="true">
                <div className="h-3 bg-readonly" style={{ width: `${(row.count / maxRoomCount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-border bg-surface px-4 py-4">
        <h2 className="text-base font-semibold text-foreground">노쇼/취소 추이</h2>
        <div className="mt-4 grid gap-3" aria-label="노쇼와 취소 건수 그래프">
          {report.noShowCancelTrend.map((row) => (
            <div className="grid gap-1" key={row.serviceDate}>
              <div className="flex items-center justify-between gap-3 text-xs text-muted">
                <span>{row.serviceDate}</span>
                <span>
                  노쇼 {formatNumber(row.noShowCount)}건 · 취소 {formatNumber(row.canceledCount)}건
                </span>
              </div>
              <div className="grid gap-1" aria-hidden="true">
                <div className="h-2 bg-background">
                  <div className="h-2 bg-brand" style={{ width: `${(row.noShowCount / maxNoShowCancel) * 100}%` }} />
                </div>
                <div className="h-2 bg-background">
                  <div className="h-2 bg-danger" style={{ width: `${(row.canceledCount / maxNoShowCancel) * 100}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold text-muted">
                <th className="py-2 pr-3">날짜</th>
                <th className="py-2 pr-3 text-right">노쇼</th>
                <th className="py-2 text-right">취소</th>
              </tr>
            </thead>
            <tbody>
              {report.noShowCancelTrend.map((row) => (
                <tr className="border-b border-border last:border-0" key={row.serviceDate}>
                  <td className="py-2 pr-3">{row.serviceDate}</td>
                  <td className="py-2 pr-3 text-right [font-variant-numeric:tabular-nums]">{formatNumber(row.noShowCount)}건</td>
                  <td className="py-2 text-right [font-variant-numeric:tabular-nums]">{formatNumber(row.canceledCount)}건</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">범례: 노쇼는 브랜드색, 취소는 위험색이며 텍스트와 숫자로 함께 구분합니다.</p>
        <div className="sr-only">노쇼/취소 최대값 {formatNumber(maxNoShowCancel)}건 기준의 그래프와 표 데이터입니다.</div>
      </div>
    </section>
  );
}

function PayoutCompositionChart({ report }: { report: DashboardGraphReportDto }) {
  const maxAmount = maxOf(report.opsIncentiveOrPayoutComposition.segments.map((row) => row.amount));

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-labelledby="payout-composition-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="payout-composition-title" className="text-base font-semibold text-foreground">
          운영팀 인센/월마감 지급 구성
        </h2>
        <p className="text-xs text-muted">{report.opsIncentiveOrPayoutComposition.label}</p>
      </div>
      {report.opsIncentiveOrPayoutComposition.segments.length > 0 ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.opsIncentiveOrPayoutComposition.segments.map((segment) => (
            <div key={segment.key}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">{segment.label}</span>
                <span className="text-muted">{formatVnd(segment.amount)}</span>
              </div>
              <div className="mt-2 h-3 bg-background" aria-hidden="true">
                <div className="h-3 bg-brand" style={{ width: `${(segment.amount / maxAmount) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">확정 스냅샷이 없어 지급 구성 그래프를 표시하지 않습니다.</p>
      )}
    </section>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/reports");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow="대시보드"
          title="그래프 리포트"
          description="운영월과 조회날짜 기준으로 매출, 코스, 마사지사, 객실, 노쇼/취소 흐름을 조회한다."
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">그래프 리포트는 운영월 날짜 범위와 선택 조회날짜를 기준으로 조회한다.</p>
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
    redirect(`/dashboard/reports?${canonicalParams.toString()}`);
  }

  const report = await getDashboardGraphReport({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="대시보드"
        title="그래프 리포트"
        description="매출, 코스, 마사지사, 객실, 노쇼/취소 흐름을 그래프로 조회한다."
        meta={
          <>
            <div>운영월 상태: {report.operatingMonth.status}</div>
            <div>
              날짜 범위: {report.operatingMonth.startDate} ~ {report.operatingMonth.endDate}
            </div>
          </>
        }
      />

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
        <SourceBasisPanel report={report} />
        <EmptyStatePanel report={report} />
        {report.emptyStates.noCalculatedCompletedCalls ? <CompletedChartEmptyPanel /> : <RevenueTrendChart report={report} />}
        {report.emptyStates.noCalculatedCompletedCalls ? (
          <PayoutCompositionChart report={report} />
        ) : (
          <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]" aria-label="코스 비중과 지급 구성">
            <CourseMixChart report={report} />
            <PayoutCompositionChart report={report} />
          </section>
        )}
        <RankingCharts report={report} />
        <RoomAndNoShowCharts report={report} />
      </div>
    </main>
  );
}
