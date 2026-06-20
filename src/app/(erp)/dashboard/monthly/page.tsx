import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { StatusBadge } from "@/components/domain/status-badge";
import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getMonthlyDashboardMetrics, type MonthlyDashboardMetricsDto } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";

type MonthlyDashboardSearchParams = {
  operatingMonthId?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)} VND`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function KpiTile({ label, value, note, tone = "default" }: { label: string; value: string; note?: string; tone?: "default" | "strong" | "cost" }) {
  return (
    <div className={tone === "strong" ? "border-2 border-brand bg-surface px-4 py-4" : "border border-border bg-surface px-4 py-3"}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={
          tone === "strong"
            ? "mt-1 text-3xl font-bold text-brand [font-variant-numeric:tabular-nums]"
            : tone === "cost"
              ? "mt-1 text-2xl font-semibold text-danger [font-variant-numeric:tabular-nums]"
              : "mt-1 text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]"
        }
      >
        {value}
      </p>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}

function StatusCountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {label === "예약" || label === "사용중" || label === "청소중" ? (
          <StatusBadge state={label} />
        ) : (
          <p className="text-sm font-semibold text-foreground">{label}</p>
        )}
        <p className="text-2xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{formatNumber(value)}건</p>
      </div>
    </div>
  );
}

function SourceBasisPanel({ metrics }: { metrics: MonthlyDashboardMetricsDto }) {
  if (metrics.sourceBasis.kind === "closed_snapshot") {
    return (
      <section className="border border-border bg-surface px-4 py-4" aria-label="월간 KPI 기준">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-muted">조회 기준</p>
            <h2 className="mt-1 text-base font-semibold text-foreground">확정 스냅샷 기준</h2>
          </div>
          <div className="text-right text-sm text-muted">
            <div>closeVersion {metrics.sourceBasis.closeVersion}</div>
            <div>확정 {formatDateTime(metrics.sourceBasis.confirmedAt)}</div>
          </div>
        </div>
      </section>
    );
  }

  if (metrics.sourceBasis.kind === "snapshot_missing") {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert">
        <h2 className="text-base font-semibold text-foreground">확정 스냅샷을 찾을 수 없습니다</h2>
        <p className="mt-2 text-sm text-muted">
          마감확정 또는 잠금 상태의 운영월은 현재 재계산값으로 대체하지 않습니다. 월마감 확정 이력을 확인하세요.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label="월간 KPI 기준">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-muted">조회 기준</p>
          <h2 className="mt-1 text-base font-semibold text-foreground">미확정 현재 기준</h2>
        </div>
        <p className="max-w-xl text-sm text-muted">현재 콜 원장과 현재 정책 기준의 월간 미리보기이며 확정 스냅샷과 섞어 표시하지 않습니다.</p>
      </div>
    </section>
  );
}

function EmptyOrWarningState({ metrics }: { metrics: MonthlyDashboardMetricsDto }) {
  if (metrics.emptyState.kind === "none" || metrics.emptyState.kind === "snapshot_missing") return null;

  if (metrics.emptyState.kind === "no_calls") {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label="데이터 없음">
        <h2 className="text-base font-semibold text-foreground">이 운영월의 콜이 없습니다</h2>
        <p className="mt-2 text-sm text-muted">운영월을 바꾸거나 콜 원장에서 해당 월 데이터를 확인하세요.</p>
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
        정책 누락 {metrics.warningCounts.callLedger.coursePolicyMissing}건, 수당 누락 {metrics.warningCounts.callLedger.therapistRateMissing}건,
        D코스 마사지사2 필요 {metrics.warningCounts.callLedger.secondTherapistRequired}건
      </p>
    </section>
  );
}

function MonthlyMoneyKpis({ metrics }: { metrics: MonthlyDashboardMetricsDto }) {
  // 마감확정/잠금 월인데 확정 스냅샷이 없으면, 현재 재계산값으로 금액 KPI를 대체하지 않는다.
  // (잠금 월은 확정 스냅샷만이 신뢰 가능한 금액 기준이다.)
  if (metrics.sourceBasis.kind === "snapshot_missing" || !metrics.financials) {
    return (
      <section className="border border-danger bg-surface px-4 py-5" role="alert" aria-label="월간 금액 KPI 표시 보류">
        <h2 className="text-base font-semibold text-foreground">월간 금액 KPI를 표시하지 않습니다</h2>
        <p className="mt-2 text-sm text-muted">
          마감확정 또는 잠금 운영월의 결제합계·순이익·비용 지표는 확정 스냅샷에서만 산출합니다. 스냅샷이 없어 현재 재계산값으로 대체하지 않았습니다.
        </p>
      </section>
    );
  }

  const financials = metrics.financials;

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="월간 금액 KPI">
      <KpiTile label="결제합계" value={formatVnd(financials.paymentTotal)} tone="strong" />
      <KpiTile label="월간 순이익" value={formatVnd(financials.netProfit)} note="결제합계 - 일일비용 - 월간비용" tone="strong" />
      <KpiTile label="할인합계" value={formatVnd(financials.discountTotal)} />
      <KpiTile label="지출합계" value={formatVnd(financials.expenseTotal)} tone="cost" />
      <KpiTile label="일일비용 합계" value={formatVnd(financials.dailyCostTotal)} note="지출, 마사지사 정산, 귀케어, 일일인센" tone="cost" />
      <KpiTile label="월간비용 합계" value={formatVnd(financials.monthlyCostTotal)} note="운영팀 월인센, 만근수당, 갯수왕" tone="cost" />
      <KpiTile label="운영팀 월인센" value={formatVnd(financials.opsMonthlyIncentiveTotal)} tone="cost" />
      <KpiTile label="만근수당" value={formatVnd(financials.fullAttendanceAllowanceTotal)} tone="cost" />
      <KpiTile label="갯수왕" value={formatVnd(financials.countKingBonusTotal)} tone="cost" />
      <KpiTile label="전체 지급 합계" value={formatVnd(financials.settlementPayoutTotal)} tone="cost" />
      <KpiTile label="귀케어 풀" value={formatVnd(financials.earcarePoolTotal)} />
    </section>
  );
}

function SettlementSummary({ metrics }: { metrics: MonthlyDashboardMetricsDto }) {
  if (!metrics.settlementSummary) {
    return (
      <section className="border border-border bg-surface px-4 py-5" aria-label="지급 요약 없음">
        <h2 className="text-base font-semibold text-foreground">지급/정산 요약을 표시하지 않습니다</h2>
        <p className="mt-2 text-sm text-muted">확정 스냅샷이 없어 현재 지급 계산값으로 대체하지 않았습니다.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-5" aria-label="월간 지급 정산 KPI">
      <KpiTile label="마사지사 지급" value={formatVnd(metrics.settlementSummary.therapistPayoutAmount)} />
      <KpiTile label="운영팀 일일 인센" value={formatVnd(metrics.settlementSummary.opsDailyIncentiveAmount)} />
      <KpiTile label="운영팀 월 인센" value={formatVnd(metrics.settlementSummary.opsMonthlyIncentiveAmount)} />
      <KpiTile label="귀케어 지급" value={formatVnd(metrics.settlementSummary.earcarePayoutAmount)} />
      <KpiTile
        label="전체 지급 합계"
        value={formatVnd(metrics.settlementSummary.grandPayoutAmount)}
        note={`포함 ${formatNumber(metrics.settlementSummary.includedCallCount)}건 · 제외 ${formatNumber(metrics.settlementSummary.excludedCallCount)}건`}
      />
    </section>
  );
}

function PreviousSnapshotReference({ metrics }: { metrics: MonthlyDashboardMetricsDto }) {
  if (!metrics.snapshot || metrics.snapshot.kind !== "previous") return null;

  return (
    <section className="border border-border bg-surface px-4 py-4" aria-label="이전 확정 스냅샷">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">이전 확정 스냅샷</h2>
          <p className="mt-1 text-sm text-muted">재오픈된 검토중 월의 참고 정보이며 현재 KPI 기준에는 섞지 않습니다.</p>
        </div>
        <div className="text-right text-sm text-muted">
          <div>closeVersion {metrics.snapshot.closeVersion}</div>
          <div>{formatDateTime(metrics.snapshot.confirmedAt)}</div>
          <div className="font-medium text-foreground">{formatVnd(metrics.snapshot.totals.grandPayoutAmount)}</div>
        </div>
      </div>
    </section>
  );
}

export default async function MonthlyDashboardPage({ searchParams }: { searchParams: Promise<MonthlyDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/monthly");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow="대시보드"
          title="월간 KPI 대시보드"
          description="운영월 전체 날짜 범위 기준으로 월간 상태, 매출, 지급 요약을 조회한다."
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">월간 KPI는 운영월 날짜 범위와 운영월 ID를 기준으로 조회한다.</p>
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

  if (params.operatingMonthId !== selectedMonth.id) {
    const canonicalParams = new URLSearchParams({ operatingMonthId: selectedMonth.id });
    redirect(`/dashboard/monthly?${canonicalParams.toString()}`);
  }

  const metrics = await getMonthlyDashboardMetrics({
    operatingMonthId: selectedMonth.id
  });
  const statusCounts = [
    // REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음).
    ["예약건수", metrics.statusCounts.reservation],
    ["사용중", metrics.statusCounts.inUse],
    ["청소중", metrics.statusCounts.cleaning],
    ["방문완료", metrics.statusCounts.completed],
    ["노쇼", metrics.statusCounts.noShow],
    ["취소", metrics.statusCounts.canceled]
  ] as const;

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="대시보드"
        title="월간 KPI 대시보드"
        description="운영월 전체 기준의 콜 상태, 선결제 반영 매출, 지급 스냅샷 흐름을 조회한다."
        meta={
          <>
            <div>운영월 상태: {metrics.operatingMonth.status}</div>
            <div>
              날짜 범위: {metrics.operatingMonth.startDate} ~ {metrics.operatingMonth.endDate}
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
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          조회
        </button>
      </form>

      <div className="space-y-4">
        <SourceBasisPanel metrics={metrics} />
        <EmptyOrWarningState metrics={metrics} />
        <PreviousSnapshotReference metrics={metrics} />

        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="월간 상태 건수">
          {statusCounts.map(([label, count]) => (
            <StatusCountTile key={label} label={label} value={count} />
          ))}
        </section>

        <MonthlyMoneyKpis metrics={metrics} />

        <SettlementSummary metrics={metrics} />

        <section className="border border-border bg-surface px-4 py-4" aria-label="월간 코스별 방문완료">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-foreground">코스별 방문완료</h2>
            <p className="text-xs text-muted">calculated 완료 콜 기준</p>
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
        </section>
      </div>
    </main>
  );
}
