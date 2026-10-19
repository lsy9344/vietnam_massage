import { Suspense } from "react";
import { TherapistSkipLinks, THERAPIST_MAIN_CONTENT_ID } from "@/components/therapist/therapist-skip-links";
import { TherapistTabBar } from "@/components/therapist/therapist-tab-bar";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { requireTherapistAccess } from "@/modules/therapists/therapist-access-service";

/**
 * Therapist 전용 레이아웃(티켓 01, 스펙 D7). 운영팀 (erp) 레이아웃의 업무 흐름 도크(옆으로 넓은 구역
 * 메뉴) 대신 아래 탭 네 개를 쓰고, 도크의 "나" 메뉴 자리도 없다 — "나" 메뉴는 화면마다 TherapistTopBar가
 * 맨 위에 둔다. 레이아웃 단계에서는 느슨한 검사만 한다(세션 유효성); 화면별 엄격한 검사(M17)는 각 화면이
 * requireTherapistAccess()를 다시 불러 직원 id를 얻는다(운영팀 ErpLayout·각 화면의 requireRouteAccess와
 * 같은 이중 검사 모양).
 */
export default async function TherapistLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireTherapistAccess();
  const locale = await getLocale();

  return (
    <LocaleProvider locale={locale}>
      <TherapistSkipLinks locale={locale} />
      <main className="therapist-main bg-background text-foreground" id={THERAPIST_MAIN_CONTENT_ID} tabIndex={-1}>
        {children}
      </main>
      <Suspense fallback={null}>
        <TherapistTabBar />
      </Suspense>
    </LocaleProvider>
  );
}
