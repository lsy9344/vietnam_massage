import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function EarcareAttendanceLoading() {
  const { locale, t } = await getServerTranslator();
  return (
    <div className="screen">
      <ScreenToolbar locale={locale} path="/settlements/earcare" title={t("settlements.earcare.title")} />
      <section className="border border-border bg-surface px-4 py-8" role="status">
        <h2 className="text-base font-semibold text-foreground">{t("settlements.earcare.loading.title")}</h2>
        <p className="mt-2 text-sm text-muted">{t("settlements.earcare.loading.description")}</p>
      </section>
    </div>
  );
}
