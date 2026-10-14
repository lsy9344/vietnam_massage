import { StatusIndicator } from "@/components/ui/status-indicator";
import { createTranslator } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";

/**
 * 경고 요약: 가장 앞선 경고 하나와 나머지 건수("+N"). 경고 순서는 부르는 쪽(서비스)이 정한다.
 * 저장 상태와는 다른 자리에 둔다.
 */
export function WarningSummary({ warnings, locale }: { warnings: string[]; locale: Locale }) {
  if (warnings.length === 0) {
    return null;
  }
  const t = createTranslator(locale);
  const rest = warnings.length - 1;
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusIndicator label={warnings[0]} tone="warning" />
      {rest > 0 ? (
        <span aria-label={t("common.warning.moreAria", { count: rest })} className="text-sm font-semibold text-warning [font-variant-numeric:tabular-nums]">
          {t("common.warning.more", { count: rest })}
        </span>
      ) : null}
    </span>
  );
}

/** 경고 목록: 콜 상세 같은 패널에서 경고를 모두 보인다. */
export function WarningList({ warnings, label }: { warnings: string[]; label: string }) {
  if (warnings.length === 0) {
    return null;
  }
  return (
    <ul aria-label={label} className="grid gap-1.5">
      {warnings.map((warning) => (
        <li key={warning}>
          <StatusIndicator label={warning} tone="warning" />
        </li>
      ))}
    </ul>
  );
}
