import Link from "next/link";
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
 * 요약 카드(design.md 6.7)의 모양을 베이지 면에 쓰고, 전체 숫자를 가장 크게 둔다. 상태 이름은 원장 줄과 같은 기호·색의
 * 칩이다. 누르는 동작은 없다. 좁은 폭에서는 줄을 넘겨 감싼다. 고객 등록·검색은 고객 화면에서 하므로 그리로 가는 링크만 둔다.
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
  // 휴대폰 폭에서는 한 줄에 셋씩 놓여 좁으므로 옆 여백만 줄여 "방문완료" 칩이 잘리지 않게 한다.
  const cardClassName = "min-w-0 basis-28 rounded-lg bg-surface px-5 py-4 text-foreground max-[599px]:px-3";

  return (
    <div className="mb-4 grid gap-2">
      <ul aria-label={t(locale, "calls.statusCounts.aria")} className="flex flex-wrap gap-2">
        <li className={`${cardClassName} grow-[1.4]`}>
          <span className="text-sm font-semibold">{t(locale, "calls.statusCounts.total")}</span>{" "}
          <span className="mt-3 block text-[1.75rem] font-semibold leading-none tracking-[-0.03em] min-[1200px]:text-4xl">
            {countLabel(counts.totalCount)}
          </span>
        </li>
        {statuses.map((status) => (
          <li className={`${cardClassName} grow`} key={status.key}>
            <CallStatusChip count={{ value: counts[status.key] }} label={t(locale, status.labelKey)} size="sm" status={status.status} />{" "}
            <span className="mt-3 block text-2xl font-semibold leading-none tracking-[-0.02em]">{countLabel(counts[status.key])}</span>
          </li>
        ))}
      </ul>
      {customerHref ? (
        <div className="flex justify-end">
          <Link className="screen-step" href={customerHref}>
            {t(locale, "calls.customerScreenLink")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
