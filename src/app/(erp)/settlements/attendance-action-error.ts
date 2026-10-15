import type { ActionResult } from "@/lib/action-result";
import { AuthorizationError } from "@/lib/authorization";
import { AuditDomainError } from "@/modules/audit/audit-event";
import { EarcareAttendanceDomainError } from "@/modules/settlements/earcare-attendance-service";
import { OpsAttendanceDomainError } from "@/modules/settlements/ops-attendance-service";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { resolveDomainErrorMessage } from "@/lib/i18n/errors";

export function mapAttendanceActionError<T>(error: unknown, locale: Locale): ActionResult<T> {
  if (error instanceof EarcareAttendanceDomainError || error instanceof OpsAttendanceDomainError) {
    const message = resolveDomainErrorMessage(locale, error.code, error.message);
    const field = ({ OPERATING_MONTH_DATE_OUT_OF_RANGE: "attendanceDate", ATTENDANCE_STATUS_NOT_FOUND: "statusCode", EARCARE_EMPLOYEE_NOT_FOUND: "employeeId", OPS_EMPLOYEE_NOT_FOUND: "employeeId" } as Record<string, string>)[error.code];
    return { ok: false, ...(field ? { fieldErrors: { [field]: [message] } } : {}), formError: message, domainErrorCode: error.code };
  }
  if (error instanceof AuthorizationError) return { ok: false, formError: t(locale, "action.error.noPermission") };
  if (error instanceof AuditDomainError) return { ok: false, formError: t(locale, "action.error.auditFailed"), domainErrorCode: error.code };
  return { ok: false, formError: t(locale, "action.error.saveFailed") };
}
