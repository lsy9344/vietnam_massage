import { redirect } from "next/navigation";
import { MonthlyDashboardView } from "@/app/(erp)/dashboard/monthly/monthly-dashboard-view";
import { requireRouteAccess } from "@/lib/authorization";
import { linkToScreen } from "@/lib/routes";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { getMonthlyDashboardMetrics } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type MonthlyDashboardSearchParams = {
  operatingMonthId?: string;
};

export default async function MonthlyDashboardPage({ searchParams }: { searchParams: Promise<MonthlyDashboardSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/monthly");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/dashboard/monthly" title={t("dashboard.monthly.title")} />
        <NoOperatingMonthNotice description={t("dashboard.monthly.empty.description")} locale={locale} role={account.role} />
      </div>
    );
  }

  if (params.operatingMonthId !== selectedMonth.id) {
    const canonicalParams = new URLSearchParams({ operatingMonthId: selectedMonth.id });
    redirect(`/dashboard/monthly?${canonicalParams.toString()}`);
  }

  const metrics = await getMonthlyDashboardMetrics({
    operatingMonthId: selectedMonth.id
  });

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: null }}
        dateControls={
          <DateContextControls date={null} locale={locale} months={operatingMonths} path="/dashboard/monthly" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/dashboard/monthly"
        title={t("dashboard.monthly.title")}
      />

      <MonthlyDashboardView
        ledgerHref={linkToScreen(account.role, "/calls", { operatingMonthId: selectedMonth.id, date: null })}
        locale={locale}
        metrics={metrics}
      />
    </div>
  );
}
