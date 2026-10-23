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
 * 카드 줄은 오른쪽 빠른 예약(action) 앞의 가로를 다 쓰고, 일곱 장이 같은 폭으로 나눈다(2026-10-23 고객 요청, 시안 111.png).
 * 1100px 미만에서는 같은 폭(최소 6rem) 카드로 줄을 넘긴다. 고객 화면 링크는 두지 않는다(같은 요청: 도크의 고객 구역으로 간다).
 */
export function LedgerStatusCounts({
  action,
  counts,
  locale
}: {
  /** 카드 줄 오른쪽에 둘 주요 행동(빠른 예약). */
  action?: ReactNode;
  /** ledgerStatusCountsFromRows가 원장 행에서 센 값. */
  counts: LedgerStatusCountsDto;
  locale: Locale;
}) {
  const countLabel = (value: number) => `${formatNumber(locale, value)}${t(locale, "calls.summary.countSuffix")}`;
  // 칸이 좁아지면 칩 글자가 말줄임으로 줄어든다(CallStatusChip sm은 max-w-full truncate).
  const cardClassName = "min-w-0 rounded-lg bg-surface px-4 py-2.5 text-foreground max-[599px]:px-3";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <ul
        aria-label={t(locale, "calls.statusCounts.aria")}
        className="grid min-w-0 flex-1 basis-[36rem] grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-2 min-[1100px]:grid-cols-7"
      >
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
      {action ? <div className="ml-auto flex items-center">{action}</div> : null}
    </div>
  );
}
