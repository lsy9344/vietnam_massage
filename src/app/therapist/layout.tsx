import { Suspense } from "react";
import { TherapistSkipLinks, THERAPIST_MAIN_CONTENT_ID } from "@/components/therapist/therapist-skip-links";
import { TherapistTabBar } from "@/components/therapist/therapist-tab-bar";
import { getLocale } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { requireTherapistAccess } from "@/app/therapist/require-therapist-access";
import { countUnreadTherapistNotices } from "@/modules/therapists/therapist-notice-service";

/**
 * Therapist 전용 레이아웃(티켓 01, 스펙 D7). 운영팀 (erp) 레이아웃의 업무 흐름 도크(옆으로 넓은 구역
 * 메뉴) 대신 아래 탭 네 개를 쓰고, 도크의 "나" 메뉴 자리도 없다 — "나" 메뉴는 화면마다 TherapistTopBar가
 * 맨 위에 둔다. 레이아웃 단계에서는 느슨한 검사만 한다(세션 유효성); 화면별 엄격한 검사(M17)는 각 화면이
 * requireTherapistAccess()를 다시 불러 직원 id를 얻는다(운영팀 ErpLayout·각 화면의 requireRouteAccess와
 * 같은 이중 검사 모양).
 *
 * 티켓 02: 레이아웃은 모든 하위 주소(비밀번호 변경 화면 포함) 앞에서 한 번 더 도는 공용 자리라 비밀번호
 * 변경 필요 리다이렉트는 여기서 하지 않는다(allowPasswordChangeRequired: true) — 그 리다이렉트는
 * /therapist/password로 가는데, 레이아웃이 그 화면을 그릴 때도 기본값으로 다시 검사하면 같은 주소로
 * 되돌이 리다이렉트가 생긴다. 실제 막음은 각 탭 화면이 기본값으로 다시 부르는 곳에서 일어난다.
 *
 * 공지 탭 숫자(티켓 10, 01이 둔 noticeUnreadCount 자리)도 여기서 읽는다 — 화면을 열 때, visibility로
 * 돌아올 때, 새로고침 버튼을 누를 때만 다시 읽힌다(D8). 주기적으로 다시 읽지 않는다.
 */
export default async function TherapistLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { employeeId } = await requireTherapistAccess({ allowPasswordChangeRequired: true });
  const locale = await getLocale();
  const noticeUnreadCount = await countUnreadTherapistNotices(employeeId);

  return (
    <LocaleProvider locale={locale}>
      <TherapistSkipLinks locale={locale} />
      <main className="therapist-main bg-background text-foreground" id={THERAPIST_MAIN_CONTENT_ID} tabIndex={-1}>
        {children}
      </main>
      <Suspense fallback={null}>
        <TherapistTabBar noticeUnreadCount={noticeUnreadCount} />
      </Suspense>
    </LocaleProvider>
  );
}
