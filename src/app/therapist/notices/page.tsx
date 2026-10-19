import { TherapistNoticeList } from "@/components/therapist/therapist-notice-list";
import { TherapistRefresh, TherapistRefreshController } from "@/components/therapist/therapist-refresh";
import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { getServerTranslator } from "@/lib/i18n/server";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";
import { listTherapistNoticesForEmployee } from "@/modules/therapists/therapist-notice-service";

/** 공지 탭(티켓 10, 스펙 D25): 내게 온 공지를 최신순으로 보고, 열면 읽음으로 기록된다. */
export default async function TherapistNoticesPage() {
  const { employeeId } = await requireTherapistAccess();
  const { locale, t } = await getServerTranslator();
  const [profile, notices] = await Promise.all([getTherapistProfile(employeeId), listTherapistNoticesForEmployee(employeeId)]);
  const lastUpdatedAt = new Date().toISOString();

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.nav.notices")} />
      <TherapistRefresh lastUpdatedAt={lastUpdatedAt} locale={locale}>
        <TherapistRefreshController />
        <TherapistNoticeList locale={locale} notices={notices} />
      </TherapistRefresh>
    </div>
  );
}
