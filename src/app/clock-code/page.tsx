import { ClockCodeDisplay } from "@/components/domain/clock-code-display";
import { BRAND_NAME, BrandMark } from "@/components/ui/brand-logo";
import { requireRouteAccess } from "@/lib/authorization";
import { getServerTranslator } from "@/lib/i18n/server";
import { getTherapistClockCodeDisplayKeys } from "@/modules/therapists/therapist-clock-code-service";

/**
 * 출근 코드 크게 띄우기(스펙 D13, 티켓 05). 카운터·관리자가 "출근 코드" 버튼으로 연다(/rooms).
 * TV처럼 도크 없는 전체 화면이고, 날짜·운영월 맥락도 받지 않는다 — 지금 시각으로만 코드를 계산한다.
 * 서버는 오늘·다음 날 키만 내려주고(코드 자체는 안 내려줌), 화면이 분마다 다시 계산한다(D13: DB를
 * 깨우지 않는다). 그래서 이 페이지는 자동 새로고침도 없다.
 */
export default async function ClockCodePage() {
  await requireRouteAccess("/clock-code");
  const { locale, t } = await getServerTranslator();
  const keys = await getTherapistClockCodeDisplayKeys({ now: new Date() });

  return (
    <main className="fullscreen grid min-h-screen place-items-center bg-background px-6 py-6 text-foreground">
      <div className="grid place-items-center gap-6">
        <BrandMark className="w-20 shrink-0" label={BRAND_NAME} />
        <h1 className="text-[32px] font-black leading-none">{t("nav.item.clockCode")}</h1>
        <ClockCodeDisplay keys={keys} locale={locale} size="full" />
        <p className="max-w-md text-base font-semibold text-muted">{t("clockCode.pageDescription")}</p>
      </div>
    </main>
  );
}
