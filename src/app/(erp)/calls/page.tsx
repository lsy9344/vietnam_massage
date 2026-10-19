import type { ReactNode } from "react";
import { requireRouteAccess } from "@/lib/authorization";
import { isOperatingMonthPayoutLocked } from "@/modules/closing/month-lock-guard";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  autoFinishOverdueCalls,
  calculationWarningCallsFromRows,
  getDailyCallLedgerSummary,
  ledgerStatusCountsFromRows,
  listCustomers,
  listDailyExpensesForDate,
  listServiceCallFormOptions,
  listServiceCallsForDate,
  listTherapistAvailability,
  redactServiceCallSettlementAmounts,
  unassignedReservedCallCountFromRows
} from "@/modules/calls/service-call-service";
import { AddExpensePanel, DailyExpensePanel } from "@/app/(erp)/calls/daily-expense-panel";
import { DailySummaryStrip } from "@/app/(erp)/calls/daily-summary-strip";
import { CallLedgerWorkspace } from "@/app/(erp)/calls/call-ledger-workspace";
import { LedgerStatusCounts } from "@/app/(erp)/calls/ledger-status-counts";
import { QuickBookingTrigger } from "@/app/(erp)/calls/quick-booking-panel";
import { TherapistStatusStrip } from "@/app/(erp)/calls/therapist-status-strip";
import { CallLeaveGuard } from "@/app/(erp)/calls/unsaved-guard";
import { ledgerHref, ledgerTabParams, parseLedgerTab, type LedgerTab } from "@/lib/ledger-address";
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
  /** 옛 보기 전환(티켓 19)의 주소. 옛 링크가 깨지지 않게 받아서 버린다(스펙 D15). */
  view?: string;
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
  // 자동 청소 중(1018 스펙 D14): 그 영업일을 읽기 전에 표시 종료를 지난 사용중 콜을 정리한다.
  await autoFinishOverdueCalls(ledgerDate);
  const isLocked = isOperatingMonthPayoutLocked(selectedMonth.status);
  const canViewSettlementAmounts = account.role === "administrator" || account.role === "settlement_manager";

  // 주요 행동은 탭마다 다르다. 하루 수납·지출은 지출 추가, 원장은 빠른 예약이다.
  const toolbar = (action?: ReactNode) => (
    <ScreenToolbar
      account={account}
      action={action}
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
        items: ledgerTabs.map((item) => ({
          href: ledgerHref(ledgerDate, item.tab),
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
      // 이번 달 시재는 관리자·정산 담당에게만 읽어 보낸다(1018 스펙 D18). 카운터의 HTML에는 그 숫자가 없다.
      getDailyCallLedgerSummary({ ...ledgerDate, includeMonthTill: canViewSettlementAmounts })
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
      {/*
        원장 탭을 저장하지 않은 입력이 있는 동안 떠나기 전 안내로 감싼다(스펙 B07, 티켓 18). 빠른 예약은 원장 탭 머리의
        주요 버튼이고, 패널은 원장 옆 패널이라 CallLedgerWorkspace 안에 있다(1018 스펙 D19). 새 콜은 빠른 예약으로만
        만든다(스펙 D22).
      */}
      <CallLeaveGuard>
        {toolbar(<QuickBookingTrigger isLocked={isLocked} />)}
        <LedgerStatusCounts
          counts={ledgerStatusCountsFromRows(rows)}
          customerHref={linkToScreen(account.role, "/customers", { operatingMonthId: selectedMonth.id, date: serviceDate })}
          locale={locale}
        />
        {/* Therapist 현황 줄(1018 스펙 D17). 출근 상태·콜 수·지금 상태는 빠른 예약에 넘기는 가능 판정 행에 이미 있다. */}
        <TherapistStatusStrip canBook={!isLocked} rows={availabilityRows} unassignedCount={unassignedReservedCallCountFromRows(rows)} />
        <CallLedgerWorkspace
          key={`${selectedMonth.id}:${serviceDate}`}
          customers={customers}
          isLocked={isLocked}
          options={options}
          quickBooking={{
            initialAvailabilityRows: availabilityRows,
            initialAvailabilityTime: availabilityTime,
            monthEndDate: selectedMonth.endDate,
            monthStartDate: selectedMonth.startDate,
            operatingMonthId: selectedMonth.id,
            serviceDate
          }}
          rows={visibleRows}
          showSettlementColumns={canViewSettlementAmounts}
        />
      </CallLeaveGuard>
    </div>
  );
}
