import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { OpsDailyIncentiveResultDto } from "@/modules/settlements/ops-daily-incentive-service";

type OpsRule = Pick<OpsDailyIncentiveResultDto, "ruleStatus" | "appliedThresholdCallCount">;

export function opsThresholdLabel(locale: Locale, result: OpsRule) {
  if (result.ruleStatus === "missing_policy") return t(locale, "settlements.ops.threshold.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t(locale, "settlements.ops.threshold.belowThreshold");
  return t(locale, "settlements.ops.threshold.applied", { count: result.appliedThresholdCallCount ?? 0 });
}

// 서비스가 만든 한국어 warningMessage 대신, 안정적인 ruleStatus(kind)로 번역 키를 골라 표시한다.
export function opsWarningNoticeMessage(locale: Locale, result: OpsRule) {
  if (result.ruleStatus === "missing_policy") return t(locale, "settlements.ops.warningNotice.missingPolicy");
  if (result.ruleStatus === "below_threshold") return t(locale, "settlements.ops.warningNotice.belowThreshold");
  return null;
}
