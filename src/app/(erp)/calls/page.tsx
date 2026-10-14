import { requireRouteAccess } from "@/lib/authorization";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  calculationWarningCallsFromRows,
  getDailyCallLedgerSummary,
  ledgerStatusCountsFromRows,
  listCustomers,
  listDailyExpensesForDate,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  listTherapistAvailability,
  redactServiceCallSettlementAmounts
} from "@/modules/calls/service-call-service";
import { DailyExpensePanel } from "@/app/(erp)/calls/daily-expense-panel";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import { CallLedgerWorkspace } from "@/app/(erp)/calls/call-ledger-workspace";
import { LedgerStatusCounts } from "@/app/(erp)/calls/ledger-status-counts";
import { ledgerHref, ledgerTabParams, parseLedgerTab, type LedgerTab } from "@/app/(erp)/calls/ledger-address";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { linkToScreen } from "@/lib/routes";

type CallsPageSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
  tab?: string;
};

const ledgerTabs: Array<{ tab: LedgerTab; labelKey: "calls.tab.ledger" | "calls.tab.cashbook" }> = [
  { tab: "ledger", labelKey: "calls.tab.ledger" },
  { tab: "cashbook", labelKey: "calls.tab.cashbook" }
];

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
  const tab = parseLedgerTab(params.tab);
  const ledgerDate = { operatingMonthId: selectedMonth.id, serviceDate };
  const isLocked = isOperatingMonthPayoutLocked(selectedMonth.status);
  const canViewSettlementAmounts = account.role === "administrator" || account.role === "settlement_manager";

  const toolbar = (
    <ScreenToolbar
      account={account}
      context={{ operatingMonthId: selectedMonth.id, date: serviceDate }}
      dateControls={
        <DateContextControls
          date={serviceDate}
          keepParams={ledgerTabParams(tab)}
          locale={locale}
          months={operatingMonths}
          path="/calls"
          selectedMonth={selectedMonth}
        />
      }
      locale={locale}
      path="/calls"
      screenTabs={{
        label: t("calls.tabs.aria"),
        items: ledgerTabs.map((item) => ({ href: ledgerHref(ledgerDate, item.tab), label: t(item.labelKey), current: item.tab === tab }))
      }}
      sticky
      title={t("calls.title")}
    />
  );

  if (tab === "cashbook") {
    const [rows, options, expenses, summary] = await Promise.all([
      listServiceCallsForDate(ledgerDate),
      listServiceCallFormOptions({ operatingMonthId: selectedMonth.id, locale }),
      listDailyExpensesForDate({ operatingMonthId: selectedMonth.id, expenseDate: serviceDate }),
      getDailyCallLedgerSummary(ledgerDate)
    ]);

    return (
      <div className="screen">
        {toolbar}
        <div className="grid grid-cols-1 gap-10">
          <DailySummaryStrip
            locale={locale}
            showSettlementAmounts={canViewSettlementAmounts}
            summary={summary}
            warningCalls={calculationWarningCallsFromRows(rows)}
          />
          <DailyExpensePanel
            expenses={expenses}
            handlers={options.expenseHandlers}
            isLocked={isLocked}
            operatingMonthId={selectedMonth.id}
            serviceDate={serviceDate}
          />
        </div>
      </div>
    );
  }

  const [rows, options, customers] = await Promise.all([
    listServiceCallsForDate(ledgerDate),
    listServiceCallFormOptions({ operatingMonthId: selectedMonth.id, locale }),
    listCustomers()
  ]);
  const availabilityTime = options.timeSlots[0]?.value ?? "";
  const availabilityRows = availabilityTime
    ? await listTherapistAvailability({ operatingMonthId: selectedMonth.id, serviceDate, time: availabilityTime })
    : [];
  const visibleRows = canViewSettlementAmounts ? rows : rows.map(redactServiceCallSettlementAmounts);

  return (
    <div className="screen">
      {toolbar}
      <LedgerStatusCounts
        counts={ledgerStatusCountsFromRows(rows)}
        customerHref={linkToScreen(account.role, "/customers", { operatingMonthId: selectedMonth.id, date: serviceDate })}
        locale={locale}
      />
      {/* 가능 코스 영역은 티켓 20에서 빠른 예약 패널로 옮길 때까지 원장 위에 둔다. */}
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
