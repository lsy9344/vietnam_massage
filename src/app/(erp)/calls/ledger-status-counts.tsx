import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { LedgerStatusCountsDto } from "@/modules/calls/service-call-service";

type StatusCardConfig = {
  key: keyof Omit<LedgerStatusCountsDto, "totalCount">;
  labelKey: MessageKey;
  cardBg: string;
  iconBg: string;
  icon: React.ReactNode;
};

const statusCards: StatusCardConfig[] = [
  {
    key: "reservedCount",
    labelKey: "calls.statusCounts.reserved",
    cardBg: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/50",
    iconBg: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <rect height="18" rx="2" width="18" x="3" y="4" />
        <line x1="16" x2="16" y1="2" y2="6" />
        <line x1="8" x2="8" y1="2" y2="6" />
        <line x1="3" x2="21" y1="10" y2="10" />
      </svg>
    )
  },
  {
    key: "inUseCount",
    labelKey: "calls.summary.inUse",
    cardBg: "bg-sky-50/50 dark:bg-sky-950/20 border-sky-200/70 dark:border-sky-900/50",
    iconBg: "bg-info-soft text-info",
    icon: (
      <svg className="w-3.5 h-3.5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    )
  },
  {
    key: "cleaningCount",
    labelKey: "calls.summary.cleaning",
    cardBg: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/50",
    iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
      </svg>
    )
  },
  {
    key: "completedCount",
    labelKey: "calls.summary.completed",
    cardBg: "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/50",
    iconBg: "bg-success-soft text-success",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    )
  },
  {
    key: "noShowCount",
    labelKey: "calls.summary.noShow",
    cardBg: "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/50",
    iconBg: "bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <line x1="18" x2="6" y1="6" y2="18" />
        <line x1="6" x2="18" y1="6" y2="18" />
      </svg>
    )
  },
  {
    key: "canceledCount",
    labelKey: "calls.summary.canceled",
    cardBg: "bg-slate-50/70 dark:bg-slate-900/30 border-slate-200/70 dark:border-slate-800/60",
    iconBg: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14H6L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
      </svg>
    )
  }
];

export function LedgerStatusCounts({
  counts,
  customerHref,
  locale
}: {
  counts: LedgerStatusCountsDto;
  customerHref?: string | null;
  locale: Locale;
}) {
  const countLabel = (value: number) => `${formatNumber(locale, value)}${t(locale, "calls.summary.countSuffix")}`;

  return (
    <div className="mb-4">
      <ul
        aria-label={t(locale, "calls.statusCounts.aria")}
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5"
      >
        {/* 1. 전체 */}
        <li className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-float/90 px-3 py-2 shadow-2xs transition-colors hover:bg-surface-float">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect height="6" rx="1.5" width="6" x="4" y="4" />
              <rect height="6" rx="1.5" width="6" x="14" y="4" />
              <rect height="6" rx="1.5" width="6" x="4" y="14" />
              <rect height="6" rx="1.5" width="6" x="14" y="14" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="block text-[11px] font-medium text-muted truncate">
              {t(locale, "calls.statusCounts.total")}
            </span>
            <span className="text-sm font-bold text-foreground tabular-nums">
              {countLabel(counts.totalCount)}
            </span>
          </div>
        </li>

        {/* 2-7. 상태별 카드 */}
        {statusCards.map((card) => {
          const val = counts[card.key];
          return (
            <li
              className={`flex items-center gap-2.5 rounded-xl border ${card.cardBg} px-3 py-2 shadow-2xs transition-colors hover:brightness-95`}
              key={card.key}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                {card.icon}
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-medium text-muted truncate">
                  {t(locale, card.labelKey)}
                </span>
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {countLabel(val)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {customerHref ? (
        <div className="mt-2 flex justify-end">
          <Link className="screen-step" href={customerHref}>
            {t(locale, "calls.customerScreenLink")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
