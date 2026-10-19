import { TherapistTopBar } from "@/components/therapist/therapist-top-bar";
import { TherapistPasswordForm } from "@/app/therapist/password/therapist-password-form";
import { getAuthorizedAccount } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";
import { getTherapistProfile } from "@/modules/therapists/therapist-profile-service";

/**
 * Therapist 비밀번호 변경 화면(티켓 02, 스펙 D3·D9). "나" 메뉴에서도 열지만, 발급·초기화 직후 임시
 * 비밀번호로 처음 로그인했을 때는 비밀번호 변경 필요 표시 때문에 requireTherapistAccess가 다른 탭에서
 * 이 주소로 보낸다(M17). allowPasswordChangeRequired라 그 표시가 켜져 있어도 이 화면만은 연다.
 */
export default async function TherapistPasswordPage() {
  const { employeeId } = await requireTherapistAccess({ allowPasswordChangeRequired: true });
  const { locale, t } = await getServerTranslator();
  const [profile, account] = await Promise.all([getTherapistProfile(employeeId), getAuthorizedAccount()]);

  return (
    <div className="screen">
      <TherapistTopBar profile={profile} title={t("therapist.password.title")} />
      <div className="mx-auto w-full max-w-md grid gap-4">
        <p className="text-sm text-muted">{t("therapist.password.description")}</p>
        {account?.passwordChangeRequired ? (
          <p className="rounded-sm bg-warning-soft px-3 py-2 text-sm text-warning" role="status">
            {t("therapist.password.requiredNotice")}
          </p>
        ) : null}
        <TherapistPasswordForm />
      </div>
    </div>
  );
}
