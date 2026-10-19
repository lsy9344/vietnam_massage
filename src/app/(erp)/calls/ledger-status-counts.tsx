import Link from "next/link";
import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { LedgerStatusCountsDto } from "@/modules/calls/service-call-service";

const statuses: Array<{ key: keyof Omit<LedgerStatusCountsDto, "totalCount">; labelKey: MessageKey; tone: StatusTone }> = [
  { key: "reservedCount", labelKey: "calls.statusCounts.reserved", tone: "neutral" },
  { key: "inUseCount", labelKey: "calls.summary.inUse", tone: "info" },
  { key: "cleaningCount", labelKey: "calls.summary.cleaning", tone: "info" },
  { key: "completedCount", labelKey: "calls.summary.completed", tone: "success" },
  { key: "noShowCount", labelKey: "calls.summary.noShow", tone: "warning" },
  { key: "canceledCount", labelKey: "calls.summary.canceled", tone: "neutral" }
];

/**
 * 원장 탭 머리의 상태별 건수 한 줄(명세 F08): 그날의 전체 콜 수, 그리고 예약부터 취소까지 상태마다의 건수.
 * 고객 등록·검색은 고객 화면에서 하므로 여기에는 그리로 가는 링크만 둔다.
 */
export function LedgerStatusCounts({
  counts,
  customerHref,
  locale
}: {
  /** ledgerStatusCountsFromRows가 원장 행에서 센 값. */
  counts: LedgerStatusCountsDto;
  /** 고객 화면 주소. 들어갈 수 없는 역할이면 null. */
  customerHref: string | null;
  locale: Locale;
}) {
  const countLabel = (value: number) => `${formatNumber(locale, value)}${t(locale, "calls.summary.countSuffix")}`;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
      <ul aria-label={t(locale, "calls.statusCounts.aria")} className="flex flex-wrap items-center gap-2">
        <li className="flex items-center gap-1.5 rounded-md border border-border-strong bg-surface-float px-3 py-1.5 text-base font-bold text-foreground">
          <span>{t(locale, "calls.statusCounts.total")}</span> <span>{countLabel(counts.totalCount)}</span>
        </li>
        {statuses.map((status) => (
          <li className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-float px-2.5 py-1 text-xs font-semibold text-foreground" key={status.key}>
            <StatusIndicator label={t(locale, status.labelKey)} tone={status.tone} />{" "}
            <span className="tabular-nums">{countLabel(counts[status.key])}</span>
          </li>
        ))}
      </ul>
      {customerHref ? (
        <Link className="screen-step" href={customerHref}>
          {t(locale, "calls.customerScreenLink")}
        </Link>
      ) : null}
    </div>
  );
}
