import { requireRouteAccess } from "@/lib/authorization";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import {
  getTherapistAdminMonthlyOverview,
  getTherapistAdminTodayOverview,
  type TherapistAdminMonthlyOverviewDto
} from "@/modules/therapists/therapist-admin-overview-service";
import { TherapistOverviewMonthlySection, TherapistOverviewTodaySection } from "@/app/(erp)/settlements/therapist-overview/therapist-overview-view";
import { SettlementErrorNotice } from "@/app/(erp)/settlements/settlement-parts";
import { DateContextControls } from "@/components/shell/date-context-controls";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

type TherapistOverviewPageSearchParams = { operatingMonthId?: string };

/**
 * 관리자 Therapist 현황(티켓 11, 스펙 D26, M18 `therapist:manage`). 오늘 영역은 날짜 선택이 없고
 * 늘 지금 운영일을 본다. 운영월 영역만 DateContextControls로 운영월을 고른다. 두 영역 모두 06의
 * 판정·좁은 조회와 월마감 미리보기/스냅샷 행을 그대로 옮긴 값이라 이 페이지는 계산하지 않는다.
 */
export default async function TherapistOverviewPage({ searchParams }: { searchParams: Promise<TherapistOverviewPageSearchParams> }) {
  const account = await requireRouteAccess("/settlements/therapist-overview");
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const operatingMonths = await listOperatingMonths();
  const selectedMonth = selectedOperatingMonthFor(operatingMonths, params.operatingMonthId);

  if (!selectedMonth) {
    return (
      <div className="screen">
        <ScreenToolbar account={account} locale={locale} path="/settlements/therapist-overview" title={t("settlements.therapistOverview.title")} />
        <NoOperatingMonthNotice locale={locale} role={account.role} />
      </div>
    );
  }

  const todayOverview = await getTherapistAdminTodayOverview({ operatingMonths });

  let monthlyOverview: TherapistAdminMonthlyOverviewDto | null = null;
  let errorMessage: string | null = null;
  try {
    monthlyOverview = await getTherapistAdminMonthlyOverview({ operatingMonth: selectedMonth });
  } catch (error) {
    if (error instanceof Error) console.error("[settlements/therapist-overview] load error", error);
    const code = error && typeof error === "object" && "code" in error ? String((error as { code: unknown }).code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("settlements.therapistOverview.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  const context = { operatingMonthId: selectedMonth.id, date: null };

  return (
    <div className="screen">
      <ScreenToolbar
        account={account}
        context={context}
        dateControls={
          <DateContextControls date={null} locale={locale} months={operatingMonths} path="/settlements/therapist-overview" selectedMonth={selectedMonth} />
        }
        locale={locale}
        path="/settlements/therapist-overview"
        title={t("settlements.therapistOverview.title")}
      />

      <div className="grid gap-6">
        <section aria-labelledby="therapist-overview-today" className="grid gap-3">
          <h2 className="text-[0.9375rem] font-semibold text-foreground" id="therapist-overview-today">
            {t("settlements.therapistOverview.today.heading")}
          </h2>
          <TherapistOverviewTodaySection locale={locale} overview={todayOverview} t={t} />
        </section>

        <section aria-labelledby="therapist-overview-monthly" className="grid gap-3">
          <h2 className="text-[0.9375rem] font-semibold text-foreground" id="therapist-overview-monthly">
            {t("settlements.therapistOverview.monthly.heading")}
          </h2>
          {errorMessage ? (
            <SettlementErrorNotice
              locale={locale}
              message={errorMessage}
              query={{ operatingMonthId: selectedMonth.id }}
              title={t("settlements.therapistOverview.error.title")}
            />
          ) : monthlyOverview ? (
            <TherapistOverviewMonthlySection overview={monthlyOverview} t={t} />
          ) : null}
        </section>
      </div>
    </div>
  );
}
