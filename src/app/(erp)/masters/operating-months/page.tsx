import { requireRouteAccess } from "@/lib/authorization";
import { listOperatingMonths, type OperatingMonthDto } from "@/modules/masters/operating-month-service";
import { OperatingMonthManager } from "@/app/(erp)/masters/operating-months/operating-month-forms";
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

function kstTodayIsoDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function getHighlightedMonthKey(months: OperatingMonthDto[]) {
  const today = kstTodayIsoDate();
  const currentMonth = months.find((month) => month.startDate <= today && month.endDate >= today);
  return currentMonth?.monthKey ?? months[0]?.monthKey ?? null;
}

export default async function OperatingMonthsPage() {
  await requireRouteAccess("/masters/operating-months");

  const { t } = await getServerTranslator();
  const months = await listOperatingMonths();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.operatingMonths.title")}
        description={t("masters.operatingMonths.description")}
        meta={
          <>
            <div>{t("masters.operatingMonths.meta.defaultStatus")}</div>
            <div>{t("masters.operatingMonths.meta.dateFormat")}</div>
          </>
        }
      />

      <OperatingMonthManager highlightedMonthKey={getHighlightedMonthKey(months)} months={months} />
    </main>
  );
}
