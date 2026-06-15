import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  getDailyCallLedgerSummary,
  listDailyExpensesForDate,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  redactServiceCallSettlementAmounts
} from "@/modules/calls/service-call-service";
import { DailyExpensePanel } from "@/app/(erp)/calls/daily-expense-panel";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import { EditableCallGrid } from "@/app/(erp)/calls/editable-call-grid";
import { PageHeader } from "@/components/domain/page-header";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";

type CallsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

export default async function CallsPage({ searchParams }: { searchParams: Promise<CallsPageSearchParams> }) {
  const account = await requireRouteAccess("/calls");

  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow="콜 원장"
          title="콜/예약 입력 원장"
          description="운영월과 날짜별로 실시간콜입력 A:S 의미의 기본 콜 정보를 기록한다."
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">운영월을 먼저 생성해 주세요</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">콜 원장은 운영월 날짜 범위 안에서만 조회하고 저장할 수 있다.</p>
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
  const [rows, options, expenses, summary] = await Promise.all([
    listServiceCallsForDate({ operatingMonthId: selectedMonth.id, serviceDate }),
    listServiceCallFormOptions({ operatingMonthId: selectedMonth.id }),
    listDailyExpensesForDate({ operatingMonthId: selectedMonth.id, expenseDate: serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate })
  ]);
  const isLocked = isOperatingMonthPayoutLocked(selectedMonth.status);
  const canViewSettlementAmounts = account.role === "administrator" || account.role === "settlement_manager";
  const visibleRows = canViewSettlementAmounts ? rows : rows.map(redactServiceCallSettlementAmounts);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow="콜 원장"
        title="콜/예약 입력 원장"
        description="운영월과 날짜별로 실시간콜입력 A:S 의미의 기본 콜 정보를 기록한다."
        meta={
          <>
            <div>운영월 상태: {selectedMonth.status}</div>
            <div>
              날짜 범위: {selectedMonth.startDate} ~ {selectedMonth.endDate}
            </div>
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
      </form>

      <DailySummaryStrip summary={summary} showSettlementAmounts={canViewSettlementAmounts} />
      <DailyExpensePanel
        expenses={expenses}
        handlers={options.expenseHandlers}
        isLocked={isLocked}
        operatingMonthId={selectedMonth.id}
        serviceDate={serviceDate}
      />

      <EditableCallGrid
        isLocked={isLocked}
        operatingMonthId={selectedMonth.id}
        options={options}
        rows={visibleRows}
        serviceDate={serviceDate}
        showSettlementColumns={canViewSettlementAmounts}
      />
    </main>
  );
}
