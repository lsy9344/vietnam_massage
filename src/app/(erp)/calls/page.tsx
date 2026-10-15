import type { ReactNode } from "react";
import Link from "next/link";
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
import { AddExpensePanel, DailyExpensePanel } from "@/app/(erp)/calls/daily-expense-panel";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import { CallLedgerWorkspace } from "@/app/(erp)/calls/call-ledger-workspace";
import { LedgerStatusCounts } from "@/app/(erp)/calls/ledger-status-counts";
import { QuickBookingPanel } from "@/app/(erp)/calls/quick-booking-panel";
import {
  LEDGER_VIEWS,
  ledgerHref,
  ledgerTabParams,
  ledgerViewParams,
  parseLedgerTab,
  parseLedgerView,
  type LedgerTab,
  type LedgerView
} from "@/app/(erp)/calls/ledger-address";
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
  view?: string;
};

const ledgerTabs: Array<{ tab: LedgerTab; labelKey: "calls.tab.ledger" | "calls.tab.cashbook" }> = [
  { tab: "ledger", labelKey: "calls.tab.ledger" },
  { tab: "cashbook", labelKey: "calls.tab.cashbook" }
];

// 원장 탭 안의 보기 전환(명세 F02, 티켓 19). 순서는 LEDGER_VIEWS(예약·현장 → 수납·정산 → 전체)를 따른다.
const ledgerViewLabelKeys = {
  booking: "calls.view.booking",
  settlement: "calls.view.settlement",
  all: "calls.view.all"
} as const satisfies Record<LedgerView, "calls.view.booking" | "calls.view.settlement" | "calls.view.all">;

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
  const view = parseLedgerView(params.view);
  const ledgerDate = { operatingMonthId: selectedMonth.id, serviceDate };
  const isLocked = isOperatingMonthPayoutLocked(selectedMonth.status);
  const canViewSettlementAmounts = account.role === "administrator" || account.role === "settlement_manager";

  // 주요 행동은 탭마다 다르다. 하루 수납·지출은 지출 추가, 원장의 빠른 예약은 티켓 20에서 붙인다.
  const toolbar = (action?: ReactNode) => (
    <ScreenToolbar
      account={account}
      action={action}
      context={{ operatingMonthId: selectedMonth.id, date: serviceDate }}
      dateControls={
        <DateContextControls
          date={serviceDate}
          keepParams={{ ...ledgerTabParams(tab), ...(tab === "ledger" ? ledgerViewParams(view) : {}) }}
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
        items: ledgerTabs.map((item) => ({
          href: ledgerHref(ledgerDate, item.tab, view),
          label: t(item.labelKey),
          current: item.tab === tab
        }))
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
        {toolbar(
          <AddExpensePanel
            handlers={options.expenseHandlers}
            isLocked={isLocked}
            operatingMonthId={selectedMonth.id}
            serviceDate={serviceDate}
          />
        )}
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
      {/* 빠른 예약(명세 F01·F08, 티켓 20): 원장 탭 머리의 주요 버튼이다. 원장 위에 항상 펼쳐 두던 가능
          코스 영역은 없애고 패널 안으로 옮겼다. */}
      {toolbar(
        <QuickBookingPanel
          customers={customers}
          initialAvailabilityRows={availabilityRows}
          initialAvailabilityTime={availabilityTime}
          isLocked={isLocked}
          monthEndDate={selectedMonth.endDate}
          monthStartDate={selectedMonth.startDate}
          operatingMonthId={selectedMonth.id}
          options={options}
          serviceDate={serviceDate}
        />
      )}
      <LedgerStatusCounts
        counts={ledgerStatusCountsFromRows(rows)}
        customerHref={linkToScreen(account.role, "/customers", { operatingMonthId: selectedMonth.id, date: serviceDate })}
        locale={locale}
      />
      {/* 원장 보기 전환(명세 F02, 티켓 19): 같은 표를 다른 열 묶음으로 보여 준다. 역할·저장 규칙·데이터는 그대로다. */}
      <nav aria-label={t("calls.view.aria")} className="mb-4 flex flex-wrap gap-2">
        {LEDGER_VIEWS.map((item) => (
          <Link
            aria-current={item === view ? "page" : undefined}
            className="screen-tab"
            href={ledgerHref(ledgerDate, "ledger", item)}
            key={item}
          >
            {t(ledgerViewLabelKeys[item])}
          </Link>
        ))}
      </nav>
      <CallLedgerWorkspace
        key={`${selectedMonth.id}:${serviceDate}`}
        customers={customers}
        isLocked={isLocked}
        operatingMonthId={selectedMonth.id}
        options={options}
        rows={visibleRows}
        serviceDate={serviceDate}
        showSettlementColumns={canViewSettlementAmounts}
        view={view}
      />
    </div>
  );
}
