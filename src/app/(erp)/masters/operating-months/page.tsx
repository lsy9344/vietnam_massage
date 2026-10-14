import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths, type OperatingMonthDto } from "@/modules/masters/operating-month-service";
import { CreateOperatingMonthPanel, OperatingMonthManager } from "@/app/(erp)/masters/operating-months/operating-month-forms";
import { CountChips } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { operatingMonthTone } from "@/app/(erp)/masters/operating-months/operating-month-lifecycle";
import { operatingMonthStatuses } from "@/modules/masters/operating-month-schema";
import { operatingMonthStatusLabel } from "@/lib/i18n/codes";
import { getServerTranslator } from "@/lib/i18n/server";
import { businessTodayIsoDate } from "@/lib/operating-date";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

function getHighlightedMonthKey(months: OperatingMonthDto[]) {
  const today = businessTodayIsoDate();
  const currentMonth = months.find((month) => month.startDate <= today && month.endDate >= today);
  return currentMonth?.monthKey ?? months[0]?.monthKey ?? null;
}

export default async function OperatingMonthsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const account = await requireRouteAccess("/masters/operating-months");

  const { locale, t } = await getServerTranslator();
  const months = await listOperatingMonths();
  const params = await searchParams;

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        action={<CreateOperatingMonthPanel />}
        locale={locale}
        path="/masters/operating-months"
        title={t("masters.operatingMonths.title")}
      />
      <div className="mb-6 grid gap-2">
        <CountChips
          items={operatingMonthStatuses.map((status) => ({
            key: status,
            label: operatingMonthStatusLabel(locale, status),
            tone: operatingMonthTone(status),
            count: months.filter((month) => month.status === status).length
          }))}
          label={t("masters.operatingMonths.counts.aria")}
          locale={locale}
          unit={(count) => t("masters.common.count", { count })}
        />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("masters.operatingMonths.meta.defaultStatus")}</span>
          <span>{t("masters.operatingMonths.meta.dateFormat")}</span>
        </div>
      </div>

      <OperatingMonthManager highlightedMonthKey={getHighlightedMonthKey(months)} initialItem={readMasterItem(params[MASTER_ITEM_PARAM])} months={months} />
    </div>
  );
}
