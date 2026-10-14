import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

export type SaveState = "saving" | "saved" | "failed" | "conflict" | "checking";

const saveStateTone: Record<SaveState, StatusTone> = {
  saving: "info",
  saved: "success",
  failed: "danger",
  conflict: "warning",
  checking: "neutral"
};

/** 행마다 늘 보이는 저장 상태. 화면 도구줄에는 두지 않는다. */
export function SaveStatus({ state, locale }: { state: SaveState; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <span aria-live="polite" role="status">
      <StatusIndicator label={t(`common.saveState.${state}`)} tone={saveStateTone[state]} />
    </span>
  );
}
