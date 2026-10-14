"use client";

import { useRouter } from "next/navigation";
import { ScreenToolbar } from "@/components/shell/screen-toolbar";
import { useLocale, useT } from "@/lib/i18n/client";

export default function ReportsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  return (
    <div className="screen">
      <ScreenToolbar locale={locale} path="/dashboard/reports" title={t("dashboard.reports.title")} />
      <section className="border border-danger bg-surface px-4 py-6" role="alert">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.reports.error.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("dashboard.reports.error.description")}</p>
        <p className="mt-3 text-sm font-medium text-danger">{t("dashboard.error.generic")}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className="h-9 border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-readonly"
            onClick={() => {
              reset();
            }}
            type="button"
          >
            {t("dashboard.error.retry")}
          </button>
          <button
            className="h-9 border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-readonly"
            onClick={() => {
              router.refresh();
            }}
            type="button"
          >
            {t("dashboard.error.refresh")}
          </button>
        </div>
      </section>
    </div>
  );
}
