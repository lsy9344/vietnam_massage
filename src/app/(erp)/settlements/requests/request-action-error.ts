import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { TherapistAttendanceDomainError } from "@/modules/settlements/therapist-attendance-service";
import { TherapistRequestDomainError } from "@/modules/therapists/therapist-request-service";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";

export function mapTherapistRequestActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
  if (error instanceof TherapistRequestDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);
    return { ok: false, ...(error.field ? { fieldErrors: { [error.field]: [message] } } : {}), formError: message, domainErrorCode: error.code };
  }
  // 정정 요청 승인(09)이 upsertTherapistAttendance를 그대로 불러 그 서비스의 도메인 오류(예:
  // 그사이 운영월이 잠겨 OPERATING_MONTH_LOCKED)가 그대로 샐 수 있다.
  if (error instanceof TherapistAttendanceDomainError) {
    return { ok: false, formError: resolveDomainErrorMessage(locale, error.code, error.message), domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) return { ok: false, formError: t(locale, "action.error.noPermission") };
  if (error instanceof AuditDomainError) return { ok: false, formError: t(locale, "action.error.auditFailed"), domainErrorCode: error.code };
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}
