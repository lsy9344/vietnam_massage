import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { type Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { resolveKoreanMessage } from "@/lib/i18n/errors";

const safePaymentActionMessages = new Set([
  "운영월을 선택하세요.",
  "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.",
  "마사지사를 선택하세요.",
  "처리자를 확인할 수 없습니다.",
  "운영월을 찾을 수 없습니다.",
  "마감확정 또는 잠금 운영월의 지급완료 상태는 변경할 수 없습니다.",
  "운영월 범위를 벗어난 날짜입니다.",
  "마사지사를 찾을 수 없습니다.",
  "활성 마사지사만 지급완료 상태를 변경할 수 있습니다.",
  "해당 날짜에 정산 대상 콜이 없는 마사지사는 지급완료로 표시할 수 없습니다.",
  "지급완료 상태값이 올바르지 않습니다."
]);

export function mapTherapistDailySettlementPaymentActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
  if (error instanceof AuthorizationError) {
    return {
      ok: false,
      formError: t(locale, "action.error.noPermission")
    };
  }

  if (error instanceof AuditDomainError) {
    return {
      ok: false,
      formError: t(locale, "action.error.auditFailed"),
      domainErrorCode: error.code
    };
  }

  if (error instanceof Error && safePaymentActionMessages.has(error.message)) {
    return {
      ok: false,
      formError: resolveKoreanMessage(locale, error.message)
    };
  }

  return {
    ok: false,
    formError: t(locale, "settlements.payment.saveFailed")
  };
}
