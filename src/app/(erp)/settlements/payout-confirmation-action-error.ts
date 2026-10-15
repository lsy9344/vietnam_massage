import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { type Locale } from "@/lib/i18n/config";
import { t } from "@/lib/i18n";
import { resolveDomainErrorMessage, resolveKoreanMessage } from "@/lib/i18n/errors";
import { OperatingMonthPayoutLockError } from "@/modules/closing/month-lock-guard";
import { PayoutConfirmationDomainError } from "@/modules/settlements/payout-confirmation-service";

const safePayoutActionMessages = new Set([
  "운영월을 선택하세요.",
  "조회 날짜는 YYYY-MM-DD 형식이어야 합니다.",
  "직원을 선택하세요.",
  "마사지사를 선택하세요.",
  "이 지급 확인 단위에는 날짜가 필요합니다.",
  "월 단위 지급 확인에는 날짜를 지정할 수 없습니다.",
  "금액은 0 이상의 정수여야 합니다.",
  "처리자를 확인할 수 없습니다.",
  "사유는 500자 이하로 입력하세요.",
  "재확인 사유를 입력하세요.",
  "해제 사유를 입력하세요.",
  "지급 확인 입력값이 올바르지 않습니다.",
  "지급 재확인 입력값이 올바르지 않습니다.",
  "지급 확인 해제 입력값이 올바르지 않습니다.",
  "운영월을 찾을 수 없습니다.",
  "마사지사를 찾을 수 없습니다.",
  "활성 마사지사만 지급 확인을 변경할 수 있습니다.",
  "해당 날짜에 정산 대상 콜이 없는 마사지사는 지급 확인을 할 수 없습니다.",
  // 티켓 31: 귀케어·운영팀 지급 확인 가드(services의 plain Error)
  "귀케어사를 선택하세요.",
  "귀케어사를 찾을 수 없습니다.",
  "활성 귀케어사만 지급 확인을 변경할 수 있습니다.",
  "해당 날짜의 귀케어 정산 대상을 찾을 수 없습니다.",
  "운영팀 직원을 선택하세요.",
  "운영팀 직원을 찾을 수 없습니다.",
  "활성 운영팀 직원만 지급 확인을 변경할 수 있습니다.",
  "해당 날짜의 운영팀 정산 대상을 찾을 수 없습니다.",
  "해당 월의 운영팀 정산 대상을 찾을 수 없습니다."
]);

/** 지급 확인(확인/재확인/해제) 서버 액션의 오류를 locale 문구로 매핑한다. 세 직군이 같은 서비스를 쓰므로 공통으로 둔다. */
export function mapPayoutConfirmationActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
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

  if (error instanceof PayoutConfirmationDomainError || error instanceof OperatingMonthPayoutLockError) {
    return {
      ok: false,
      formError: resolveDomainErrorMessage(locale, error.code, error.message),
      domainErrorCode: error.code
    };
  }

  if (error instanceof Error && safePayoutActionMessages.has(error.message)) {
    return {
      ok: false,
      formError: resolveKoreanMessage(locale, error.message)
    };
  }

  return {
    ok: false,
    formError: t(locale, "settlements.payout.error.generic")
  };
}
