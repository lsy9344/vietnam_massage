import type { Role } from "@/lib/authorization";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { getDockZones } from "@/lib/routes";

export const MAIN_CONTENT_ID = "main-content";
export const WORKFLOW_DOCK_ID = "workflow-dock";

/** 화면 맨 앞의 건너뛰기 링크(WCAG 2.4.1). 포커스를 받을 때만 보인다. */
export function SkipLinks({ role, locale }: { role: Role; locale: Locale }) {
  const t = createTranslator(locale);
  return (
    <div className="skip-links">
      <a href={`#${MAIN_CONTENT_ID}`}>{t("shell.skip.main")}</a>
      {getDockZones(role).length > 0 ? <a href={`#${WORKFLOW_DOCK_ID}`}>{t("shell.skip.dock")}</a> : null}
    </div>
  );
}
