import { ScreenState } from "@/components/ui/screen-state";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * 탭 내용이 아직 없는 Therapist 화면의 자리(티켓 01). 오늘·근태·수당·공지는 03–10이 채운다.
 */
export function TherapistEmptyTab({ locale }: { locale: Locale }) {
  const t = createTranslator(locale);
  return <ScreenState description={t("therapist.emptyTab.description")} kind="empty" label={t("common.screenState.empty")} title={t("therapist.emptyTab.title")} />;
}
