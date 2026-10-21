import { TherapistPayoutView } from "@/components/therapist/therapist-payout-view";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { NoOperatingMonthNotice } from "@/components/shell/no-operating-month-notice";
import { ScreenState } from "@/components/ui/screen-state";
import { getServerTranslator } from "@/lib/i18n/server";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";
import { requireTherapistAccess } from "@/app/therapist/require-therapist-access";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { getTherapistPayoutView } from "@/modules/therapists/therapist-payout-view-service";

/** 조회 월·날짜를 URL로 받지 않는다. 현재 영업일의 본인 수당만 보여 준다. */
export default async function TherapistPayoutPage() {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const profile = await getTherapistProfile(employeeId);
  const now = new Date();
  const lastUpdatedAt = now.toISOString();

  let view = null;
  let errorMessage: string | null = null;
  try {
    view = await getTherapistPayoutView({ employeeId, now });
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : undefined;
    const koFallback = error instanceof Error ? error.message : t("therapist.payout.error.fallback");
    errorMessage = resolveDomainErrorMessage(locale, code, koFallback);
  }

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.payout")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        {errorMessage ? (
          <ScreenState description={errorMessage} kind="error" label={t("common.screenState.error")} title={t("therapist.payout.error.title")} />
        ) : view && !view.operatingMonthId ? (
          <NoOperatingMonthNotice description={t("therapist.payout.noMonth.description")} locale={locale} role="therapist" />
        ) : view ? (
          <TherapistPayoutView locale={locale} view={view} />
        ) : null}
      </TherapistRefresh>
    </div>
  );
}
