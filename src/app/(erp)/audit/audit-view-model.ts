import type { Role } from "@/lib/authorization";
import { t, type MessageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canAccessRoute } from "@/lib/routes";

/**
 * 감사 화면이 서버 페이지와 클라이언트 작업면에서 함께 쓰는 값과 규칙. "use client" 모듈에 두면
 * 서버 페이지에서 값이 아니라 클라이언트 참조가 되므로 여기에 둔다.
 */

/** 고른 감사 기록의 id. 주소에 남아 새로고침과 링크로 같은 상세 패널이 열린다. */
export const AUDIT_LOG_PARAM = "log";

type Snapshot = unknown;

type AuditEntry = {
  targetType: string;
  targetId: string;
  beforeValue: Snapshot;
  afterValue: Snapshot;
};

/** 변경 전·후 비교의 한 줄. field가 null이면 객체가 아닌 값 전체를 비교한 줄이다. */
export type AuditFieldChange = { field: string | null; before: string; after: string; changed: boolean };

export type AuditChangeSummary = { kind: "created" | "changed" | "none"; changes: AuditFieldChange[]; more: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function change(field: string | null, before: unknown, after: unknown): AuditFieldChange {
  const beforeText = formatValue(before);
  const afterText = formatValue(after);
  return { field, before: beforeText, after: afterText, changed: beforeText !== afterText };
}

function fieldsOf(before: Record<string, unknown>, after: Record<string, unknown>) {
  return [...new Set([...Object.keys(after), ...Object.keys(before)])];
}

/** 객체이거나 없는 값. 양쪽이 모두 이렇고 하나라도 객체면 항목별로 펼친다(null은 값으로 본다). */
function isOpenable(value: unknown): value is Record<string, unknown> | undefined {
  return value === undefined || isRecord(value);
}

/**
 * 변경 후 값의 항목 순서대로, 변경 전에만 있던 항목은 뒤에 붙여 모든 항목을 한 번씩 비교한다.
 * 콜의 assignments처럼 객체인 항목은 한 단계 펼쳐 "assignments.therapist1Id"로 비교한다.
 */
export function auditFieldChanges(before: Snapshot, after: Snapshot): AuditFieldChange[] {
  const beforeRecord = before === null || before === undefined ? {} : before;
  const afterRecord = after === null || after === undefined ? {} : after;
  if (!isRecord(beforeRecord) || !isRecord(afterRecord)) {
    return [change(null, before, after)];
  }
  return fieldsOf(beforeRecord, afterRecord).flatMap((field) => {
    const beforeValue = beforeRecord[field];
    const afterValue = afterRecord[field];
    if (isOpenable(beforeValue) && isOpenable(afterValue) && (isRecord(beforeValue) || isRecord(afterValue))) {
      const beforeNested = beforeValue ?? {};
      const afterNested = afterValue ?? {};
      return fieldsOf(beforeNested, afterNested).map((key) => change(`${field}.${key}`, beforeNested[key], afterNested[key]));
    }
    return [change(field, beforeValue, afterValue)];
  });
}

/** 목록 행에 보일 변경 요약: 새로 만든 기록인지, 바뀐 앞 항목 몇 개와 나머지 수. */
export function auditChangeSummary(before: Snapshot, after: Snapshot, limit = 2): AuditChangeSummary {
  if ((before === null || before === undefined) && after !== null && after !== undefined) {
    return { kind: "created", changes: [], more: 0 };
  }
  const changed = auditFieldChanges(before, after).filter((item) => item.changed);
  if (changed.length === 0) return { kind: "none", changes: [], more: 0 };
  return { kind: "changed", changes: changed.slice(0, limit), more: Math.max(changed.length - limit, 0) };
}

/** 기록의 사유. 마감 재오픈처럼 사유를 변경 후 값 안에 담은 기록도 사유 칸에 보인다. */
export function auditReason(entry: { reason: string | null; afterValue: Snapshot }) {
  const recorded = entry.reason?.trim();
  if (recorded) return recorded;
  const nested = isRecord(entry.afterValue) ? entry.afterValue.reason : null;
  return typeof nested === "string" && nested.trim() ? nested.trim() : null;
}

function snapshotText(entry: AuditEntry, field: string) {
  for (const snapshot of [entry.afterValue, entry.beforeValue]) {
    const value = isRecord(snapshot) ? snapshot[field] : undefined;
    if (typeof value === "string" && value) return value;
  }
  return null;
}

function withQuery(path: string, params: Array<[string, string | null]>) {
  if (params.some(([, value]) => value === null)) return path;
  return `${path}?${new URLSearchParams(params as Array<[string, string]>).toString()}`;
}

const masterPaths: Record<string, string> = {
  operating_month: "/masters/operating-months",
  room: "/masters/rooms",
  code_item: "/masters/codes",
  time_slot: "/masters/codes",
  employee: "/masters/employees",
  user_account: "/masters/employees",
  course: "/masters/courses",
  course_policy: "/masters/courses",
  therapist_course_rate: "/masters/courses",
  ops_daily_incentive_rule: "/masters/courses",
  ops_monthly_incentive_rule: "/masters/courses"
};

/**
 * 기록이 가리키는 원본 화면. 날짜가 있는 기록은 그 운영월·날짜로 연다.
 * 스냅샷에 날짜가 없으면 화면만 열고, 원본 화면이 없는 대상이면 null이다.
 */
export function auditSourcePath(entry: AuditEntry): string | null {
  const month = snapshotText(entry, "operatingMonthId");
  switch (entry.targetType) {
    case "service_call":
      return withQuery("/calls", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "serviceDate")]]);
    case "daily_expense":
      return withQuery("/calls", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "expenseDate")], ["tab", "cashbook"]]);
    case "customer":
      return withQuery("/customers", [["visitCustomer", entry.targetId]]);
    case "therapist_attendance":
      return withQuery("/settlements", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "attendanceDate")]]);
    case "earcare_attendance":
      return withQuery("/settlements/earcare", [["operatingMonthId", month], ["attendanceDate", snapshotText(entry, "attendanceDate")]]);
    case "ops_attendance":
      return withQuery("/settlements/operations", [["operatingMonthId", month], ["attendanceDate", snapshotText(entry, "attendanceDate")]]);
    case "monthly_close":
      return withQuery("/closing", [["operatingMonthId", month]]);
    default:
      return masterPaths[entry.targetType] ?? null;
  }
}

/** 보는 사람의 역할이 들어갈 수 있는 원본 화면만 링크한다. 감사 내용이 다른 화면의 권한을 열어 주지 않는다. */
export function auditSourceHref(role: Role, entry: AuditEntry) {
  const path = auditSourcePath(entry);
  if (!path) return null;
  return canAccessRoute(role, path.split("?")[0]) ? path : null;
}

const targetLabelKeys: Record<string, MessageKey> = {
  service_call: "audit.target.serviceCall",
  customer: "audit.target.customer",
  daily_expense: "audit.target.dailyExpense",
  therapist_attendance: "audit.target.therapistAttendance",
  earcare_attendance: "audit.target.earcareAttendance",
  ops_attendance: "audit.target.opsAttendance",
  monthly_close: "audit.target.monthlyClose",
  operating_month: "audit.target.operatingMonth",
  room: "audit.target.room",
  code_item: "audit.target.codeItem",
  time_slot: "audit.target.timeSlot",
  employee: "audit.target.employee",
  user_account: "audit.target.userAccount",
  course: "audit.target.course",
  course_policy: "audit.target.coursePolicy",
  therapist_course_rate: "audit.target.therapistCourseRate",
  ops_daily_incentive_rule: "audit.target.opsDailyIncentiveRule",
  ops_monthly_incentive_rule: "audit.target.opsMonthlyIncentiveRule"
};

/** 화면이 이름을 아는 대상 종류. 필터 칸의 제안 목록에 쓴다. */
export const AUDIT_TARGET_TYPES = Object.keys(targetLabelKeys);

/** 대상 종류의 화면 이름. 모르는 종류는 기록된 그대로 둔다. */
export function auditTargetLabel(locale: Locale, targetType: string) {
  const key = targetLabelKeys[targetType];
  return key ? t(locale, key) : targetType;
}
