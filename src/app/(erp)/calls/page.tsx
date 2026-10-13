import Link from "next/link";
import { requireRouteAccess } from "@/lib/authorization";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  getDailyCallLedgerSummary,
  listCustomerVisitHistory,
  listCustomers,
  listDailyExpensesForDate,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  listTherapistAvailability,
  redactServiceCallSettlementAmounts,
  searchCustomerVisitCandidates,
  type CustomerVisitSelection
} from "@/modules/calls/service-call-service";
import { CustomerPanel } from "@/app/(erp)/calls/customer-panel";
import { CustomerVisitSearch } from "@/app/(erp)/calls/customer-visit-search-panel";
import { DailyExpensePanel } from "@/app/(erp)/calls/daily-expense-panel";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import { CallLedgerWorkspace } from "@/app/(erp)/calls/call-ledger-workspace";
import { PageHeader } from "@/components/domain/page-header";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";

type CallsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
  customerQuery?: string;
  visitCustomer?: string;
  visitMemo?: string;
};

export default async function CallsPage({ searchParams }: { searchParams: Promise<CallsPageSearchParams> }) {
  const account = await requireRouteAccess("/calls");
  const { locale, t } = await getServerTranslator();

  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
        <PageHeader
          eyebrow={t("nav.group.calls")}
          title={t("calls.title")}
          description={t("calls.description")}
        />
        <section className="border border-border bg-surface px-4 py-8">
          <h2 className="text-base font-semibold text-foreground">{t("common.createOperatingMonthFirst")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t("calls.empty.description")}</p>
          {account.role === "administrator" ? (
            <Link className="mt-4 inline-flex text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/masters/operating-months">
              {t("common.goToOperatingMonths")}
            </Link>
          ) : null}
        </section>
      </main>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  const customerQuery = typeof params.customerQuery === "string" ? params.customerQuery.trim() : "";
  const visitCustomer = typeof params.visitCustomer === "string" && params.visitCustomer.trim() ? params.visitCustomer.trim() : null;
  const visitMemo = typeof params.visitMemo === "string" ? params.visitMemo : null;
  const visitSelection: CustomerVisitSelection | null = !customerQuery
    ? null
    : visitCustomer
      ? { kind: "customer", customerId: visitCustomer }
      : visitMemo !== null
        ? { kind: "memo", customerMemo: visitMemo }
        : null;
  const [rows, options, expenses, summary, customers, candidates, visitHistory] = await Promise.all([
    listServiceCallsForDate({ operatingMonthId: selectedMonth.id, serviceDate }),
    listServiceCallFormOptions({ operatingMonthId: selectedMonth.id, locale }),
    listDailyExpensesForDate({ operatingMonthId: selectedMonth.id, expenseDate: serviceDate }),
    getDailyCallLedgerSummary({ operatingMonthId: selectedMonth.id, serviceDate }),
    listCustomers(),
    customerQuery ? searchCustomerVisitCandidates({ query: customerQuery }) : Promise.resolve([]),
    visitSelection ? listCustomerVisitHistory(visitSelection) : Promise.resolve([])
  ]);
  const availabilityTime = options.timeSlots[0]?.value ?? "";
  const availabilityRows = availabilityTime
    ? await listTherapistAvailability({ operatingMonthId: selectedMonth.id, serviceDate, time: availabilityTime })
    : [];
  const isLocked = isOperatingMonthPayoutLocked(selectedMonth.status);
  const canViewSettlementAmounts = account.role === "administrator" || account.role === "settlement_manager";
  const visibleRows = canViewSettlementAmounts ? rows : rows.map(redactServiceCallSettlementAmounts);

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("nav.group.calls")}
        title={t("calls.title")}
        description={t("calls.description")}
        meta={
          <>
            <div>{t("common.operatingMonthStatusPrefix")}: {operatingMonthStatusLabel(locale, selectedMonth.status)}</div>
            <div>
              {t("common.dateRange")}: {selectedMonth.startDate} ~ {selectedMonth.endDate}
            </div>
          </>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.operatingMonth")}
          <select
            aria-label={t("common.operatingMonth")}
            className="h-9 min-w-44 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={selectedMonth.id}
            name="operatingMonthId"
          >
            {operatingMonths.map((month) => (
              <option key={month.id} value={month.id}>
                {t("common.monthOption", { monthKey: month.monthKey, status: operatingMonthStatusLabel(locale, month.status) })}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-medium text-muted">
          {t("common.queryDate")}
          <input
            aria-label={t("common.queryDate")}
            className="h-9 border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-brand"
            defaultValue={serviceDate}
            max={selectedMonth.endDate}
            min={selectedMonth.startDate}
            name="serviceDate"
            type="date"
          />
        </label>
        <button className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly" type="submit">
          {t("common.query")}
        </button>
      </form>

      <CustomerVisitSearch
        candidates={candidates}
        operatingMonthId={selectedMonth.id}
        query={customerQuery}
        rows={visitHistory}
        serviceDate={serviceDate}
        visitCustomer={visitSelection?.kind === "customer" ? visitSelection.customerId : null}
        visitMemo={visitSelection?.kind === "memo" ? visitSelection.customerMemo : null}
      />
      <DailySummaryStrip summary={summary} showSettlementAmounts={canViewSettlementAmounts} locale={locale} />

      {/* 매일 쓰는 원장을 위로 올리고, 가끔 쓰는 지출과 고객 관리는 그 아래에 둔다. */}
      <div className="mb-4">
        <CallLedgerWorkspace
          key={`${selectedMonth.id}:${serviceDate}`}
          availabilityRows={availabilityRows}
          availabilityTime={availabilityTime}
          customers={customers}
          isLocked={isLocked}
          operatingMonthId={selectedMonth.id}
          options={options}
          rows={visibleRows}
          serviceDate={serviceDate}
          showSettlementColumns={canViewSettlementAmounts}
        />
      </div>

      <DailyExpensePanel
        expenses={expenses}
        handlers={options.expenseHandlers}
        isLocked={isLocked}
        operatingMonthId={selectedMonth.id}
        serviceDate={serviceDate}
      />
      <CustomerPanel customers={customers} />
    </main>
  );
}
