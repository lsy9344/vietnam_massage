import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { listTherapistRequestsForAdmin } from "@/modules/therapists/therapist-request-service";
import { RequestWorkspace } from "@/app/(erp)/settlements/requests/request-workspace";

/** 휴무 신청·정정 요청 승인함(티켓 08, 스펙 D24, M18 `payout:write`). */
export default async function TherapistRequestsPage() {
  const account = await requireRouteAccess("/settlements/requests");
  const { locale, t } = await getServerTranslator();
  const requests = await listTherapistRequestsForAdmin();

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/settlements/requests" title={t("settlements.requests.title")} />
      <RequestWorkspace locale={locale} requests={requests} />
    </div>
  );
}
