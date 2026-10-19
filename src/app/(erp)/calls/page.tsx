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
import { QuickBookingPanel } from "@/app/(erp)/calls/quick-booking-panel";
import { TherapistCallStrip } from "@/app/(erp)/calls/therapist-call-counts";
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

  // 주요 행동은 탭마다 다르다. 하루 수납·지출은 지출 추가, 원장의 빠른 예약은 티켓 20에서 붙인다.
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
      {/*
        원장 탭을 저장하지 않은 입력이 있는 동안 떠나기 전 안내로 감싼다(스펙 B07, 티켓 18). 빠른 예약
        패널(20)은 원장 탭 머리의 주요 버튼이라 CallLedgerWorkspace 밖(이 탭의 형제)에 있으므로, 공통
        조상인 여기서 건다 — CallLedgerWorkspace 자신의 useUnsavedGuard 등록(행 저장, 콜 상세)도 이 안에서
        그대로 된다. 새 콜은 빠른 예약으로만 만든다(스펙 D22).
      */}
      <CallLeaveGuard>
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
        {/* Therapist별 한 것·예약 수. 출근 상태와 콜 수는 빠른 예약에 넘기는 가능 판정 행에 이미 있다. */}
        <TherapistCallStrip locale={locale} rows={availabilityRows} unassignedCount={unassignedReservedCallCountFromRows(rows)} />
        <CallLedgerWorkspace
          key={`${selectedMonth.id}:${serviceDate}`}
          customers={customers}
          isLocked={isLocked}
          options={options}
          rows={visibleRows}
          showSettlementColumns={canViewSettlementAmounts}
        />
      </CallLeaveGuard>
    </div>
  );
}
