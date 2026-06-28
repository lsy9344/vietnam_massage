"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/domain/page-header";
import { useT } from "@/lib/i18n/client";

export default function MonthlyDashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const t = useT();

  return (
    <main className="min-h-screen px-4 py-6 lg:px-8 lg:py-7">
      <PageHeader eyebrow={t("dashboard.eyebrow")} title={t("dashboard.monthly.title")} />
      <section className="border border-danger bg-surface px-4 py-6" role="alert">
        <h2 className="text-base font-semibold text-foreground">{t("dashboard.monthly.error.title")}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">{t("dashboard.monthly.error.description")}</p>
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
    </main>
  );
}
