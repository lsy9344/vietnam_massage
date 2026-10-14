import { redirect } from "next/navigation";
import { ReportsView } from "@/app/(erp)/dashboard/reports/reports-view";
import { requireRouteAccess } from "@/lib/authorization";
import { clampDateToOperatingMonth, selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { getDashboardGraphReport } from "@/modules/dashboard/dashboard-query-service";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type ReportsSearchParams = {
  operatingMonthId?: string;
  serviceDate?: string;
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<ReportsSearchParams> }) {
  const account = await requireRouteAccess("/dashboard/reports");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/dashboard/reports" title={t("dashboard.reports.title")} />
        <NoOperatingMonthNotice description={t("dashboard.reports.empty.description")} locale={locale} role={account.role} />
      </div>
    );
  }

  const serviceDate = clampDateToOperatingMonth(params.serviceDate, selectedMonth);
  if (params.operatingMonthId !== selectedMonth.id || params.serviceDate !== serviceDate) {
    const canonicalParams = new URLSearchParams({
      operatingMonthId: selectedMonth.id,
      serviceDate
    });
    redirect(`/dashboard/reports?${canonicalParams.toString()}`);
  }

  const report = await getDashboardGraphReport({
    operatingMonthId: selectedMonth.id,
    serviceDate
  });

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={{ operatingMonthId: selectedMonth.id, date: serviceDate }}
        dateControls={
          <DateContextControls date={serviceDate} locale={locale} months={operatingMonths} path="/dashboard/reports" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/dashboard/reports"
        title={t("dashboard.reports.title")}
      />

      <ReportsView locale={locale} report={report} />
    </div>
  );
}
