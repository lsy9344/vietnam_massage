import { TherapistPayoutMonthPicker } from "@/components/therapist/therapist-payout-month-picker";
import { TherapistPayoutView } from "@/components/therapist/therapist-payout-view";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenState } from "@/components/ui/screen-state";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { selectedOperatingMonthFor } from "@/lib/operating-date";
import { listOperatingMonths } from "@/modules/masters/operating-month-service";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { getTherapistPayoutView } from "@/modules/therapists/therapist-payout-view-service";
import { MonthlyStatementDomainError } from "@/modules/closing/monthly-statement-service";

type TherapistPayoutPageSearchParams = { operatingMonthId?: string };

/**
 * 수당 탭(스펙 D19–D21, M8–M10, 티켓 07). 운영월만 고를 수 있다(Therapist는 마감 버전을 고르지
 * 않는다, M8). getTherapistPayoutView가 월 명세서·월마감 미리보기·마감 스냅샷 결과를 이 Therapist의
 * 행만 좁혀 돌려준다 — 이 화면은 그 값을 그대로 그린다.
 */
export default async function TherapistPayoutPage({ searchParams }: { searchParams: Promise<TherapistPayoutPageSearchParams> }) {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const params = await searchParams;
  const [profile, months] = await Promise.all([getTherapistProfile(employeeId), listOperatingMonths()]);
  const selectedMonth = selectedOperatingMonthFor(months, params.operatingMonthId);
  const lastUpdatedAt = new Date().toISOString();

  let view = null;
  let errorMessage: string | null = null;
  if (selectedMonth) {
    try {
      view = await getTherapistPayoutView({ employeeId, operatingMonthId: selectedMonth.id });
    } catch (error) {
      const code = error instanceof MonthlyStatementDomainError ? error.code : undefined;
      const koFallback = error instanceof Error ? error.message : t("therapist.payout.error.fallback");
      errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
    }
  }

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.payout")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        {selectedMonth ? <TherapistPayoutMonthPicker locale={locale} months={months} selectedMonthId={selectedMonth.id} /> : null}
        {!selectedMonth ? (
          <NoOperatingMonthNotice description={t("therapist.payout.noMonth.description")} locale={locale} role="therapist" />
        ) : errorMessage ? (
          <ScreenState description={errorMessage} kind="error" label={t("common.screenState.error")} title={t("therapist.payout.error.title")} />
        ) : view ? (
          <TherapistPayoutView locale={locale} view={view} />
        ) : null}
      </TherapistRefresh>
    </div>
  );
}
