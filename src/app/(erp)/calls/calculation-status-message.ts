import type { MessageKey } from "@/lib/i18n/types";
import type { ServiceCallCalculationStatus } from "@/modules/calls/service-call-service";

// 서비스가 만든 한국어 calculationErrorMessage 대신, 안정적인 calculationStatus(kind)로
// 번역 키를 골라 표시한다. 원장 표와 하루 수납·지출의 계산 경고가 같은 문구를 쓴다.
export function calculationErrorMessageKey(status: ServiceCallCalculationStatus): MessageKey {
  if (status === "course_policy_missing") return "calls.calc.coursePolicyMissing";
  if (status === "therapist_rate_missing") return "calls.calc.therapistRateMissing";
  if (status === "second_therapist_required") return "calls.calc.secondTherapistRequired";
  return "calls.calc.policyMissing";
}
