import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export const THERAPIST_MAIN_CONTENT_ID = "therapist-main-content";
export const THERAPIST_TAB_BAR_ID = "therapist-tab-bar";

/**
 * 화면 맨 앞의 건너뛰기 링크(WCAG 2.4.1). 운영팀 SkipLinks와 달리 아래 탭이 늘 있어(도크 구역이
 * 없는 웨이터처럼 조건부로 빼는 경우가 없다) 두 링크를 항상 보인다.
 */
export function TherapistSkipLinks({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <div className="skip-links">
      <a href={`#${THERAPIST_MAIN_CONTENT_ID}`}>{t("shell.skip.main")}</a>
      <a href={`#${THERAPIST_TAB_BAR_ID}`}>{t("therapist.nav.aria")}</a>
    </div>
  );
}
