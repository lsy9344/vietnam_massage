import Link from "next/link";
import { PageHeader } from "@/components/domain/page-header";
import { RoomStatusCard } from "@/components/domain/room-status-card";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getDailyCallLedgerSummary } from "@/modules/calls/service-call-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { latestRoomStatusUpdatedAt } from "@/modules/rooms/room-status-refresh";
import { roomFloorGroups } from "@/modules/rooms/room-floor-groups";
import { listRoomStatuses } from "@/modules/rooms/room-status-service";
import { RoomStatusRefreshController } from "@/components/domain/room-status-refresh-controller";

type LivePageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatVnd(value: number) {
  return `${formatNumber(value)} VND`;
}

function floorGridClass(count: number) {
  return count === 2 ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</p>
    </div>
  );
}

export default async function LivePage({ searchParams }: { searchParams: Promise<LivePageSearchParams> }) {
  const account = await requireRouteAccess("/live");
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow="운영 현황"
          title="첫화면 실시간 현황"
          description="객실 상태와 오늘 콜/매출 요약을 조회한다."
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">첫 화면은 운영월 날짜 범위 안의 객실 상태와 콜 요약을 조회한다.</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              운영월 관리로 이동
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  const [roomStatuses, summary] = await Promise.all([
    listRoomStatuses({ operatingMonthId: selectedMonth.id, serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate })
  ]);
  const lastUpdatedAt = latestRoomStatusUpdatedAt(roomStatuses, new Date().toISOString());
  const warningTotal =
    summary.warningCounts.coursePolicyMissing + summary.warningCounts.therapistRateMissing + summary.warningCounts.secondTherapistRequired;

  const statusSummary = [
    // REQ-009: 예약건수는 상태가 아니라 원장에 등록된 전체 건수다(방문완료·노쇼·취소로 바뀌어도 빠지지 않음).
    ["예약건수", summary.reservationCount],
    ["사용중", summary.inUseCount],
    ["청소중", summary.cleaningCount],
    ["방문완료", summary.completedCount],
    ["노쇼", summary.noShowCount],
    ["취소", summary.canceledCount]
  ] as const;

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="운영 현황"
        title="첫화면 실시간 현황"
        description="객실 상태와 오늘 콜/매출 요약을 조회한다."
        meta={
          <>
            <RoomStatusRefreshController lastUpdatedAt={lastUpdatedAt} />
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
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
        <div className="ml-auto text-right text-xs text-muted">
          <div>운영월 상태: {selectedMonth.status}</div>
          <div>
            날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
          </div>
        </div>
      </form>

      <section className="grid grid-cols-4 gap-3" aria-label="객실 상태">
        {roomFloorGroups(roomStatuses).map((group) => (
          <div className={`col-span-full ${floorGridClass(group.statuses.length)}`} key={group.floor}>
            {group.statuses.map((status) => (
              <RoomStatusCard key={status.roomId} status={status} />
            ))}
          </div>
        ))}
      </section>

      <section className="mt-4 grid grid-cols-6 gap-3" aria-label="오늘 상태 요약">
        {statusSummary.map(([label, count]) => (
          <SummaryTile key={label} label={label} value={`${formatNumber(count)}건`} />
        ))}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="결제수단별 집계">
        {/* REQ-004: 카운터 직원이 돈통 현금 흐름을 한눈에 보도록 결제수단별 집계를 첫화면에도 노출한다. */}
        <SummaryTile label="현금" value={formatVnd(summary.paymentMethodTotals.cash)} />
        <SummaryTile label="카드" value={formatVnd(summary.paymentMethodTotals.card)} />
        <SummaryTile label="계좌" value={formatVnd(summary.paymentMethodTotals.bank)} />
        <SummaryTile label="기타" value={formatVnd(summary.paymentMethodTotals.other)} />
      </section>

      <section className="mt-4 grid grid-cols-[1fr_1fr_2fr] gap-3" aria-label="오늘 KPI">
        <SummaryTile label="결제합계" value={formatVnd(summary.paymentTotal)} />
        <SummaryTile label="순매출" value={formatVnd(summary.netSales)} />
        <div className="border border-border bg-surface px-4 py-3">
          <p className="text-xs font-medium text-muted">코스별 방문완료</p>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {summary.courseSummaries.map((course) => (
              <div className="border border-border bg-background px-3 py-2 text-center" key={course.courseCode}>
                <p className="text-xs font-semibold text-muted">{course.courseCode}</p>
                <p className="text-lg font-semibold text-foreground [font-variant-numeric:tabular-nums]">{formatNumber(course.completedCount)}</p>
              </div>
            ))}
          </div>
          {warningTotal > 0 ? (
            <p className="mt-3 text-xs text-danger">
              정책 누락 {summary.warningCounts.coursePolicyMissing}건, 수당 누락 {summary.warningCounts.therapistRateMissing}건, 마사지사2 필요{" "}
              {summary.warningCounts.secondTherapistRequired}건은 금액/코스별 집계에서 제외됐다.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
