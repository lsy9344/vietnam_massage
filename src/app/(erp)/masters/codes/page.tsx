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
import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function CodesPage() {
  const account = await requireRouteAccess("/masters/codes");
  const { t } = await getServerTranslator();
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
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader
        eyebrow={t("masters.eyebrow")}
        title={t("masters.codes.title")}
        description={t("masters.codes.description")}
        meta={
          <>
            <div>{t("masters.codes.meta.defaultCodes", { count: codeGroups.reduce((sum, group) => sum + group.items.length, 0) })}</div>
            <div>{t("masters.codes.meta.defaultTimeSlots", { count: timeSlots.length })}</div>
          </>
        }
      />

      <CodeManager codeGroups={codeGroups} timeSlots={timeSlots} />
    </main>
  );
}
