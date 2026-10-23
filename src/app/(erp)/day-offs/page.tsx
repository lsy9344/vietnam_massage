import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { businessTodayServiceDate } from "@/lib/operating-date";
import { linkToScreen } from "@/lib/routes";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { listTherapistDayOffEmployeeOptions, listTherapistDayOffRegistrations } from "@/modules/therapists/therapist-request-service";
import { DayOffWorkspace } from "@/app/(erp)/day-offs/day-off-workspace";

/**
 * 휴무 등록(2026-10-23 고객 요청, dayoff:write). 카운터가 텔레그램으로 받은 Therapist의 휴무·소중한날
 * 휴가를 사유를 확인한 뒤 기간으로 등록하고, 등록한 휴무를 취소한다. Therapist가 직접 신청하던 화면과
 * 승인함의 휴무 승인을 대신한다.
 */
export default async function TherapistDayOffsPage() {
  const account = await requireRouteAccess("/day-offs");
  const { locale, t } = await getServerTranslator();
  const today = businessTodayServiceDate();
  // 배정된 콜 안내가 원장 링크를 보일지는 근무표와 같이 원장 라우트 접근 권한을 따른다.
  const canOpenLedger = linkToScreen(account.role, "/calls", { operatingMonthId: null, date: today }) !== null;
  const [employees, registrations] = await Promise.all([listTherapistDayOffEmployeeOptions(), listTherapistDayOffRegistrations()]);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/day-offs" title={t("settlements.dayOffs.title")} />
      <DayOffWorkspace
        canOpenLedger={canOpenLedger}
        employees={employees}
        locale={locale}
        past={registrations.past}
        today={today}
        upcoming={registrations.upcoming}
      />
    </div>
  );
}
