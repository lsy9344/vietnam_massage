import { PageHeader } from "@/components/domain/page-header";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function EarcareAttendanceLoading() {
  const { t } = await getServerTranslator();
  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader eyebrow={t("nav.group.settlements")} title={t("settlements.earcare.title")} />
      <section className="border border-border bg-surface px-4 py-8" role="status">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.loading.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.earcare.loading.description")}</p>
      </section>
    </main>
  );
}
