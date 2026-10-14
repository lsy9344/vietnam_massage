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
import { ActiveCounts } from "@/app/(erp)/masters/master-parts";
import { MASTER_ITEM_PARAM, countActive, readMasterItem } from "@/app/(erp)/masters/master-view-model";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";

export default async function CodesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  const params = await searchParams;
  const counts = countActive([...codeGroups.flatMap((group) => group.items), ...timeSlots]);

  return (
    <div className="screen">
      <ScreenToolbar account={account} locale={locale} path="/masters/codes" title={t("masters.codes.title")} />
      <div className="mb-6 grid gap-2">
        <ActiveCounts active={counts.active} inactive={counts.inactive} locale={locale} unit={(count) => t("masters.common.count", { count })} />
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span>{t("masters.codes.meta.defaultCodes", { count: codeGroups.reduce((sum, group) => sum + group.items.length, 0) })}</span>
          <span>{t("masters.codes.meta.defaultTimeSlots", { count: timeSlots.length })}</span>
        </div>
      </div>

      <CodeManager codeGroups={codeGroups} initialItem={readMasterItem(params[MASTER_ITEM_PARAM])} timeSlots={timeSlots} />
    </div>
  );
}
