import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { listTherapistNoticeTargetOptions, listTherapistNoticesForAdmin } from "@/modules/therapists/therapist-notice-service";
import { NoticeWorkspace } from "@/app/(erp)/settlements/notices/notice-workspace";

/** 관리자 전용 Therapist 공지 화면(티켓 10, 스펙 D25, M5, M18 `therapist:manage`). */
export default async function TherapistNoticesPage() {
  const account = await requireRouteAccess("/settlements/notices");
  const { locale, t } = await getServerTranslator();
  const [notices, targetOptions] = await Promise.all([listTherapistNoticesForAdmin(), listTherapistNoticeTargetOptions()]);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/settlements/notices" title={t("settlements.notices.title")} />
      <NoticeWorkspace locale={locale} notices={notices} targetOptions={targetOptions} />
    </div>
  );
}
