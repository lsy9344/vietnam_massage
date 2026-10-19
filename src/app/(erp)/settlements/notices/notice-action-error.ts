import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { TherapistNoticeDomainError } from "@/modules/therapists/therapist-notice-service";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";

export function mapTherapistNoticeActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
  if (error instanceof TherapistNoticeDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);
    return { ok: false, ...(error.field ? { fieldErrors: { [error.field]: [message] } } : {}), formError: message, domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) return { ok: false, formError: t(locale, "action.error.noPermission") };
  if (error instanceof AuditDomainError) return { ok: false, formError: t(locale, "action.error.auditFailed"), domainErrorCode: error.code };
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}
