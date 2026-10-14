import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths, type OperatingMonthDto } from "@/modules/masters/operating-month-service";
import { OperatingMonthManager } from "@/app/(erp)/masters/operating-months/operating-month-forms";
import { getServerTranslator } from "@/lib/i18n/server";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

function getHighlightedMonthKey(months: OperatingMonthDto[]) {
  const today = businessTodayIsoDate();
  const currentMonth = months.find((month) => month.startDate <= today && month.endDate >= today);
  return currentMonth?.monthKey ?? months[0]?.monthKey ?? null;
}

export default async function OperatingMonthsPage() {
  const account = await requireRouteAccess("/masters/operating-months");

  const { locale, t } = await getServerTranslator();
  const months = await listOperatingMonths();

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/operating-months" title={t("masters.operatingMonths.title")} />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div>{t("masters.operatingMonths.meta.defaultStatus")}</div>
        <div>{t("masters.operatingMonths.meta.dateFormat")}</div>
      </div>

      <OperatingMonthManager highlightedMonthKey={getHighlightedMonthKey(months)} months={months} />
    </div>
  );
}
