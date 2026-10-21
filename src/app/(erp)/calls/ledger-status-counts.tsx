import Link from "next/link";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { LedgerStatusCountsDto } from "@/modules/calls/service-call-service";

type StatusCardConfig = {
  key: keyof Omit<LedgerStatusCountsDto, "totalCount">;
  labelKey: MessageKey;
  iconBg: string;
  icon: React.ReactNode;
};

const statusCards: StatusCardConfig[] = [
  {
    key: "reservedCount",
    labelKey: "calls.statusCounts.reserved",
    iconBg: "bg-amber-100 text-amber-700",
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
    iconBg: "bg-info-soft text-info",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    )
  },
  {
    key: "cleaningCount",
    labelKey: "calls.summary.cleaning",
    iconBg: "bg-amber-100 text-amber-600",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7-6.3-4.6-6.3 4.6 2.3-7-6-4.6h7.6z" />
      </svg>
    )
  },
  {
    key: "completedCount",
    labelKey: "calls.summary.completed",
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
    iconBg: "bg-rose-100 text-rose-700",
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
    iconBg: "bg-slate-100 text-slate-600",
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
        className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5"
      >
        {/* 1. 전체 */}
        <li className="flex items-center gap-3 rounded-xl border border-border bg-surface-float/80 px-3.5 py-2.5 shadow-2xs transition-colors hover:bg-surface-float">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect height="7" rx="1.5" width="7" x="3" y="3" />
              <rect height="7" rx="1.5" width="7" x="14" y="3" />
              <rect height="7" rx="1.5" width="7" x="3" y="14" />
              <rect height="7" rx="1.5" width="7" x="14" y="14" />
            </svg>
          </div>
          <div className="min-w-0">
            <span className="block text-xs font-medium text-muted">
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
              className="flex items-center gap-3 rounded-xl border border-border bg-surface-float/80 px-3.5 py-2.5 shadow-2xs transition-colors hover:bg-surface-float"
              key={card.key}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${card.iconBg}`}
              >
                {card.icon}
              </div>
              <div className="min-w-0">
                <span className="block text-xs font-medium text-muted">
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
