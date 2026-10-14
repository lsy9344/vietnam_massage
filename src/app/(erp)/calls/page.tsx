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
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";

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
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/calls" title={t("calls.title")} />
        <NoOperatingMonthNotice description={t("calls.empty.description")} locale={locale} role={account.role} />
      </div>
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
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: serviceDate }}
        dateControls={
          <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/calls" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/calls"
        sticky
        title={t("calls.title")}
      />

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
      <CustomerPanel customers={customers} />
      <DailyExpensePanel
        expenses={expenses}
        handlers={options.expenseHandlers}
        isLocked={isLocked}
        operatingMonthId={selectedMonth.id}
        serviceDate={serviceDate}
      />

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
  );
}
