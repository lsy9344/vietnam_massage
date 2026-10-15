import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { ScreenState } from "@/components/ui/screen-state";
import { getServerTranslator } from "@/lib/i18n/server";

export default async function EarcareAttendanceLoading() {
  const { locale, t } = await getServerTranslator();
  return (
    <div className="screen">
      <ScreenToolbar locale={locale} path="/settlements/earcare" title={t("settlements.earcare.title")} />
      <ScreenState
        description={t("settlements.earcare.loading.description")}
        kind="loading"
        label={t("common.screenState.loading")}
        title={t("settlements.earcare.loading.title")}
      />
    </div>
  );
}
