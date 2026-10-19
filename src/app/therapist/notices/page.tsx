import { TherapistEmptyTab } from "@/components/therapist/therapist-empty-tab";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { getServerTranslator } from "@/lib/i18n/server";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";

/**
 * 공지 탭(스펙 D25). 내용은 티켓 10이 채운다 — 이 티켓(01)은 빈 자리만 둔다. 탭 숫자 자리는
 * TherapistTabBar의 noticeUnreadCount가 맡는다(지금은 넘기는 값이 없어 자리가 비어 있다).
 */
export default async function TherapistNoticesPage() {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const profile = await getTherapistProfile(employeeId);
  const lastUpdatedAt = new Date().toISOString();

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.notices")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        <TherapistEmptyTab locale={locale} />
      </TherapistRefresh>
    </div>
  );
}
