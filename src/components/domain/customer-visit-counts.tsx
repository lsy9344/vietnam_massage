import { StatusIndicator, type StatusTone } from "@/components/ui/status-indicator";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";
import type { MessageKey } from "@/lib/i18n/types";
import type { CustomerVisitCountsDto } from "@/modules/calls/service-call-service";

const statuses: Array<{ key: keyof CustomerVisitCountsDto; labelKey: MessageKey; tone: StatusTone }> = [
  { key: "completedCount", labelKey: "calls.summary.completed", tone: "success" },
  { key: "noShowCount", labelKey: "calls.summary.noShow", tone: "warning" },
  { key: "canceledCount", labelKey: "calls.summary.canceled", tone: "neutral" }
];

/**
 * 고객 화면의 열린 방문 이력 위 건수 한 줄(B09, 스토리 76-77): 방문완료·노쇼·취소를 0건까지 포함해 보인다.
 * 예약·사용중·청소중은 이 건수에 들어가지 않지만 이력 표에는 그대로 남는다. 빠른 예약의 고객 단계(티켓 24)도
 * 같은 CustomerVisitCountsDto로 이 컴포넌트를 재사용한다.
 */
export function CustomerVisitCounts({ counts, locale }: { counts: CustomerVisitCountsDto; locale: Locale }) {
  const countLabel = (value: number) => `${formatNumber(locale, value)}${t(locale, "calls.summary.countSuffix")}`;
  return (
    <ul aria-label={t(locale, "customers.visitCounts.aria")} className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {statuses.map((status) => (
        <li className="inline-flex items-center gap-1.5" key={status.key}>
          <StatusIndicator label={t(locale, status.labelKey)} tone={status.tone} />
          <span className="text-sm font-semibold text-foreground">{countLabel(counts[status.key])}</span>
        </li>
      ))}
    </ul>
  );
}
