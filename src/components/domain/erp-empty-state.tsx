import { StatusBadge, statusBadgeStates } from "@/components/domain/status-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { defaultLocale, type Locale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n";
import { roomStatusLabel } from "@/lib/i18n/codes";

type ErpEmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  locale?: Locale;
};

export function ErpEmptyState({ eyebrow, title, description, locale = defaultLocale }: ErpEmptyStateProps) {
  const t = createTranslator(locale);
  return (
    <div className="grid flex-1 grid-cols-[minmax(0,1fr)_340px] gap-6 p-6">
      <section className="space-y-6">
        <div className="rounded-md border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted">{eyebrow}</p>
              <h3 className="mt-1 text-xl font-semibold">{title}</h3>
            </div>
            <span className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white">Royal Gold</span>
          </div>
          <Separator className="my-5" />
          <p className="text-sm leading-6 text-muted">{description}</p>
          <div className="mt-5 rounded-md border border-dashed border-border bg-readonly p-4 text-sm text-muted">
            {t("emptyState.dataWaiting")}
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <p className="text-sm font-medium text-muted">{t("emptyState.statusToken")}</p>
          <h3 className="mt-1 text-xl font-semibold">{t("emptyState.statusRuleTitle")}</h3>
          <div className="mt-5 flex flex-wrap gap-3" aria-label={t("emptyState.statusBadgeTokensAria")}>
            {statusBadgeStates.map((state) => (
              <StatusBadge
                key={state}
                state={state}
                label={roomStatusLabel(locale, state)}
                ariaLabel={t("roomStatus.aria", { status: roomStatusLabel(locale, state) })}
              />
            ))}
          </div>
        </div>
      </section>

      <aside className="rounded-md border border-border bg-surface p-5" aria-label={t("emptyState.connectionAreaAria")}>
        <p className="text-sm font-medium text-muted">{t("emptyState.connectionStatus")}</p>
        <h3 className="mt-1 text-lg font-semibold">{t("emptyState.followUpTitle")}</h3>
        <p className="mt-3 text-sm leading-6 text-muted">{t("emptyState.followUpDescription")}</p>
        <div className="mt-5 space-y-3" aria-label={t("emptyState.loadingExampleAria")}>
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </aside>
    </div>
  );
}
