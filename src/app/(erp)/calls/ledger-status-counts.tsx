import Link from "next/link";
import type { ReactNode } from "react";
import { CallStatusChip, type CallStatusKey } from "@/components/domain/call-status-chip";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { LedgerStatusCountsDto } from "@/modules/calls/service-call-service";

const statuses: Array<{ key: keyof Omit<LedgerStatusCountsDto, "totalCount">; labelKey: MessageKey; status: CallStatusKey }> = [
  { key: "reservedCount", labelKey: "calls.statusCounts.reserved", status: "reserved" },
  { key: "inUseCount", labelKey: "calls.summary.inUse", status: "inUse" },
  { key: "cleaningCount", labelKey: "calls.summary.cleaning", status: "cleaning" },
  { key: "completedCount", labelKey: "calls.summary.completed", status: "completed" },
  { key: "noShowCount", labelKey: "calls.summary.noShow", status: "noShow" },
  { key: "canceledCount", labelKey: "calls.summary.canceled", status: "canceled" }
];

/**
 * 원장 탭 머리의 상태 카드 7개(1018 스펙 D16, 명세 F08): 그날의 전체 콜 수, 그리고 예약부터 취소까지 상태마다의 건수.
 * 요약 카드(design.md 6.7)의 모양을 베이지 면에 쓴다. 상태 이름은 원장 줄과 같은 기호·색의 칩이다. 누르는 동작은 없다.
 * 카드는 글자 폭만큼만 차지하고(2026-10-22 고객 요청: 옆 여백을 줄여 간결하게), 남는 오른쪽 자리에 빠른 예약(action)을
 * 크게 둔다. 좁은 폭에서는 줄을 넘겨 감싼다. 고객 등록·검색은 고객 화면에서 하므로 그리로 가는 링크만 둔다.
 */
export function LedgerStatusCounts({
  action,
  counts,
  customerHref,
  locale
}: {
  /** 카드 줄 오른쪽에 둘 주요 행동(빠른 예약). */
  action?: ReactNode;
  /** ledgerStatusCountsFromRows가 원장 행에서 센 값. */
  counts: LedgerStatusCountsDto;
  /** 고객 화면 주소. 들어갈 수 없는 역할이면 null. */
  customerHref: string | null;
  locale: Locale;
}) {
  const countLabel = (value: number) => `${formatNumber(locale, value)}${t(locale, "calls.summary.countSuffix")}`;
  const cardClassName = "min-w-[6.5rem] rounded-lg bg-surface px-4 py-2.5 text-foreground max-[599px]:min-w-0 max-[599px]:basis-24 max-[599px]:grow max-[599px]:px-3";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <ul aria-label={t(locale, "calls.statusCounts.aria")} className="flex flex-wrap gap-2">
        <li className={cardClassName}>
          <span className="text-sm font-semibold">{t(locale, "calls.statusCounts.total")}</span>{" "}
          <span className="mt-1.5 block text-2xl font-semibold leading-none tracking-[-0.02em]">{countLabel(counts.totalCount)}</span>
        </li>
        {statuses.map((status) => (
          <li className={cardClassName} key={status.key}>
            <CallStatusChip count={{ value: counts[status.key] }} label={t(locale, status.labelKey)} size="sm" status={status.status} />{" "}
            <span className="mt-1.5 block text-xl font-semibold leading-none tracking-[-0.02em]">{countLabel(counts[status.key])}</span>
          </li>
        ))}
      </ul>
      {action || customerHref ? (
        <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
          {customerHref ? (
            <Link className="screen-step" href={customerHref}>
              {t(locale, "calls.customerScreenLink")}
            </Link>
          ) : null}
          {action}
        </div>
      ) : null}
    </div>
  );
}
