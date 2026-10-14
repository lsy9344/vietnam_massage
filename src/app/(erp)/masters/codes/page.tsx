import { requireRouteAccess } from "@/lib/authorization";
import { codeTypes } from "@/modules/masters/code-schema";
import {
  ensureDefaultCodeItems,
  ensureDefaultTimeSlots,
  listCodeItems,
  listTimeSlots,
  type CodeItemDto
} from "@/modules/masters/code-service";
import { CodeManager } from "@/app/(erp)/masters/codes/code-forms";
import { getServerTranslator } from "@/lib/i18n/server";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function CodesPage() {
  const account = await requireRouteAccess("/masters/codes");
  const { locale, t } = await getServerTranslator();
  await ensureDefaultCodeItems({ actorId: account.id });
  await ensureDefaultTimeSlots({ actorId: account.id });

  const codeGroups = await Promise.all(
    codeTypes.map(async (codeType) => ({
      codeType,
      items: (await listCodeItems({ codeType })) as CodeItemDto[]
    }))
  );
  const timeSlots = await listTimeSlots();

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/codes" title={t("masters.codes.title")} />
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <div>{t("masters.codes.meta.defaultCodes", { count: codeGroups.reduce((sum, group) => sum + group.items.length, 0) })}</div>
        <div>{t("masters.codes.meta.defaultTimeSlots", { count: timeSlots.length })}</div>
      </div>

      <CodeManager codeGroups={codeGroups} timeSlots={timeSlots} />
    </div>
  );
}
