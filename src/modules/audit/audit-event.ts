export const auditActionPattern = /^[a-z]+(_[a-z]+)*\.[a-z]+(_[a-z]+)*$/;

export class AuditDomainError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "AuditDomainError";
  }
}

export type AuditJsonSnapshot =
  | string
  | number
  | boolean
  | null
  | AuditJsonSnapshot[]
  | { [key: string]: AuditJsonSnapshot };

export type AuditEventTarget = {
  targetType: string;
  targetId: string;
};

export type RecordAuditEventInput = AuditEventTarget & {
  actorId: string;
  action: string;
  beforeValue?: AuditJsonSnapshot | null;
  afterValue?: AuditJsonSnapshot | null;
  reason?: string | null;
};

export type AuditLogQuery = {
  targetType?: string | null;
  from?: Date | null;
  to?: Date | null;
  limit?: number;
};

export function isValidAuditAction(action: string) {
  return auditActionPattern.test(action);
}

export function assertValidAuditAction(action: string) {
  if (!isValidAuditAction(action)) {
    throw new AuditDomainError(
      "감사 로그 action은 service_call.status_changed 같은 dot notation이어야 합니다.",
      "INVALID_AUDIT_ACTION"
    );
  }
}

export function normalizeAuditText(value: string, fieldName: string) {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new AuditDomainError(`감사 로그 ${fieldName} 값은 비어 있을 수 없습니다.`, "EMPTY_AUDIT_FIELD");
  }

  return normalized;
}
