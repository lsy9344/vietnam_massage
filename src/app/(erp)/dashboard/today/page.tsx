import { redirect } from "next/navigation";
import { TodayDashboardView } from "@/app/(erp)/dashboard/today/today-dashboard-view";
import { requireRouteAccess } from "@/lib/authorization";
import { linkToScreen } from "@/lib/routes";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { getTodayDashboardMetrics } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type TodayDashboardSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

export default async function TodayDashboardPage({ searchParams }: { searchParams: Promise<TodayDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/today");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/dashboard/today" title={t("dashboard.today.title")} />
        <NoOperatingMonthNotice description={t("dashboard.empty.description")} locale={locale} role={account.role} />
      </div>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  if (params.operatingMonthId !== selectedMonth.id || params.serviceDate !== serviceDate) {
    const canonicalParams = new URLSearchParams({
      operatingMonthId: selectedMonth.id,
      serviceDate
    });
    redirect(`/dashboard/today?${canonicalParams.toString()}`);
  }

  const metrics = await getTodayDashboardMetrics({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: serviceDate }}
        dateControls={
          <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/dashboard/today" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/dashboard/today"
        title={t("dashboard.today.title")}
      />

      <TodayDashboardView
        ledgerHref={linkToScreen(account.role, "/calls", { operatingMonthId: selectedMonth.id, date: serviceDate })}
        locale={locale}
        metrics={metrics}
      />
    </div>
  );
}
