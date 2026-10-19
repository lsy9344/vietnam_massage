import { courseItemKey } from "@/app/(erp)/masters/courses/course-item";
import { MASTER_ITEM_PARAM } from "@/app/(erp)/masters/master-view-model";
import { EMPLOYEE_PARAM } from "@/app/(erp)/settlements/settlement-view-model";
import type { Role } from "@/lib/authorization";
import { t, type MessageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { canAccessRoute } from "@/lib/routes";
import { SYSTEM_AUDIT_ACTOR_ID } from "@/modules/audit/audit-event";

/**
 * 감사 화면이 서버 페이지와 클라이언트 작업면에서 함께 쓰는 값과 규칙. "use client" 모듈에 두면
 * 서버 페이지에서 값이 아니라 클라이언트 참조가 되므로 여기에 둔다.
 */

/** 처리자 이름: 서버가 한 일(자동 종료)은 시스템, 계정이면 그 이름, 풀 수 없는 옛 기록은 저장된 id 그대로다. */
export function auditActorName(locale: Locale, actorId: string, actor: { name: string } | undefined) {
  if (actorId === SYSTEM_AUDIT_ACTOR_ID) return t(locale, "audit.actor.system");
  return actor?.name ?? actorId;
}

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

/** 필수 값이 하나라도 없으면 화면만 연다. 선택 값은 있을 때만 붙인다. */
function withQuery(path: string, required: Array<[string, string | null]>, optional: Array<[string, string | null]> = []) {
  if (required.some(([, value]) => value === null)) return path;
  const params = [...required, ...optional].filter((param): param is [string, string] => param[1] !== null);
  return params.length > 0 ? `${path}?${new URLSearchParams(params).toString()}` : path;
}

function courseItem(courseId: string | null) {
  return courseId ? courseItemKey({ kind: "course", courseId }) : null;
}

/** 기준정보 대상의 화면과, 그 화면 패널을 여는 item 값(티켓 07). item을 알 수 없으면 null이다. */
const masterSources: Record<string, { path: string; item: (entry: AuditEntry) => string | null }> = {
  operating_month: { path: "/masters/operating-months", item: (entry) => entry.targetId },
  room: { path: "/masters/rooms", item: (entry) => entry.targetId },
  code_item: { path: "/masters/codes", item: (entry) => entry.targetId },
  time_slot: { path: "/masters/codes", item: (entry) => entry.targetId },
  employee: { path: "/masters/employees", item: (entry) => entry.targetId },
  // 계정은 연결된 직원의 패널에서 다룬다.
  user_account: { path: "/masters/employees", item: (entry) => snapshotText(entry, "employeeId") },
  course: { path: "/masters/courses", item: (entry) => courseItem(entry.targetId) },
  course_policy: { path: "/masters/courses", item: (entry) => courseItem(snapshotText(entry, "courseId")) },
  therapist_course_rate: {
    path: "/masters/courses",
    item: (entry) => {
      const therapistId = snapshotText(entry, "therapistId");
      const courseId = snapshotText(entry, "courseId");
      return therapistId && courseId ? courseItemKey({ kind: "rate", therapistId, courseId }) : null;
    }
  },
  ops_daily_incentive_rule: { path: "/masters/courses", item: (entry) => courseItemKey({ kind: "daily", ruleId: entry.targetId }) },
  ops_monthly_incentive_rule: { path: "/masters/courses", item: (entry) => courseItemKey({ kind: "monthly", ruleId: entry.targetId }) }
};

/**
 * 기록이 가리키는 원본 화면. 날짜가 있는 기록은 그 운영월·날짜로, 출근 기록은 그 직원 패널(티켓 05)까지,
 * 기준정보는 그 항목 패널까지 연다. 스냅샷에 날짜나 항목이 없으면 화면만 열고, 원본 화면이 없는 대상이면 null이다.
 */
export function auditSourcePath(entry: AuditEntry): string | null {
  const month = snapshotText(entry, "operatingMonthId");
  const employee: [string, string | null] = [EMPLOYEE_PARAM, snapshotText(entry, "employeeId")];
  switch (entry.targetType) {
    case "service_call":
      return withQuery("/calls", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "serviceDate")]]);
    case "daily_expense":
      return withQuery("/calls", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "expenseDate")], ["tab", "cashbook"]]);
    case "customer":
      return withQuery("/customers", [["visitCustomer", entry.targetId]]);
    case "therapist_attendance":
      return withQuery("/settlements", [["operatingMonthId", month], ["serviceDate", snapshotText(entry, "attendanceDate")]], [employee]);
    case "ops_attendance":
      return withQuery("/settlements/operations", [["operatingMonthId", month], ["attendanceDate", snapshotText(entry, "attendanceDate")]], [employee]);
    case "monthly_close":
      return withQuery("/closing", [["operatingMonthId", month]]);
    default: {
      const source = masterSources[entry.targetType];
      return source ? withQuery(source.path, [[MASTER_ITEM_PARAM, source.item(entry)]]) : null;
    }
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
  // 귀케어 담당 기능 폐기 후에도 과거 audit_logs 행의 대상 종류 라벨을 보이기 위해 남긴다.
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
